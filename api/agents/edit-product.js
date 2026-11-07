import {requireAdmin} from '../_lib/admin.js';
import {apiBase,config,db,accessTokenForStore,shopSign} from '../_lib/shopee.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 if(!await requireAdmin(req,res))return;
 if(process.env.SHOPEE_ENV!=='sandbox')return res.status(403).json({error:'sandbox_only'});
 const {itemId,title}=req.body||{};
 if(!Number.isSafeInteger(Number(itemId))||Number(itemId)<=0||typeof title!=='string'||title.trim().length<5||title.trim().length>120)return res.status(400).json({error:'invalid_item_or_title'});
 try{
  const stores=await db('marketplace_stores?provider=eq.shopee&status=eq.connected&select=id,external_shop_id&order=created_at.desc&limit=1');
  if(!stores?.length)return res.status(409).json({error:'store_not_connected'});
  const shop=stores[0],auth=await accessTokenForStore(shop);
  if(auth.error)return res.status(409).json({error:auth.error});
  const {id,key}=config(),shopId=Number(shop.external_shop_id);
  async function call(path,method,params,body){
   const ts=Math.floor(Date.now()/1000),url=new URL(apiBase()+path);
   for(const [k,v] of Object.entries({partner_id:id,timestamp:ts,access_token:auth.token,shop_id:shopId,sign:shopSign(id,path,ts,auth.token,shopId,key),...params}))url.searchParams.set(k,String(v));
   const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
   const data=await r.json().catch(()=>({}));
   if(!r.ok||data.error)return {error:String(data.error||'http_'+r.status),message:String(data.message||'').slice(0,300)};
   return {response:data.response||{}};
  }
  const listing=await call('/api/v2/product/get_item_list','GET',{offset:0,page_size:100,item_status:'NORMAL'});
  if(listing.error)return res.status(502).json({error:'shopee_listing_failed',providerError:listing.error,providerMessage:listing.message});
  if(!(listing.response.item||[]).some(x=>String(x.item_id)===String(itemId)))return res.status(404).json({error:'item_not_in_first_100_active_sandbox_products'});
  const updated=await call('/api/v2/product/update_item','POST',{}, {item_id:Number(itemId),item_name:title.trim()});
  if(updated.error)return res.status(502).json({error:'shopee_update_failed',providerError:updated.error,providerMessage:updated.message});
  return res.status(200).json({success:true,itemId:Number(itemId),title:title.trim(),providerResponse:updated.response});
 }catch{return res.status(503).json({error:'shopee_update_unavailable'});}
}

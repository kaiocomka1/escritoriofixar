import {requireAdmin} from '../_lib/admin.js';
import {apiBase,config,db,decrypt,shopSign} from '../_lib/shopee.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 if(!await requireAdmin(req,res))return;
 if(process.env.SHOPEE_ENV!=='sandbox')return res.status(403).json({error:'sandbox_only'});
 const kind=req.query.kind;
 const paths={products:'/api/v2/product/get_item_list',orders:'/api/v2/order/get_order_list'};
 if(!Object.hasOwn(paths,kind))return res.status(400).json({error:'invalid_kind'});
 let stage='load_store';
 try{
  const stores=await db('marketplace_stores?provider=eq.shopee&status=eq.connected&select=id,external_shop_id&order=created_at.desc&limit=1');
  if(!stores?.length)return res.status(409).json({error:'store_not_connected'});
  const shop=stores[0];
  stage='load_credentials';
  const credentials=await db('integration_credentials?store_id=eq.'+shop.id+'&select=encrypted_access_token,token_expires_at&limit=1');
  if(!credentials?.length)return res.status(409).json({error:'token_missing'});
  const credential=credentials[0];
  if(Date.parse(credential.token_expires_at)<=Date.now()+60000)return res.status(409).json({error:'access_token_expired',message:'Renovação automática ainda não implementada.'});
  stage='decrypt_token';
  const accessToken=decrypt(credential.encrypted_access_token);
  const {id,key}=config(),path=paths[kind],ts=Math.floor(Date.now()/1000),shopId=Number(shop.external_shop_id);
  const url=new URL(apiBase()+path);
  url.searchParams.set('partner_id',id);
  url.searchParams.set('timestamp',String(ts));
  url.searchParams.set('access_token',accessToken);
  url.searchParams.set('shop_id',String(shopId));
  url.searchParams.set('sign',shopSign(id,path,ts,accessToken,shopId,key));
  if(kind==='products'){url.searchParams.set('offset','0');url.searchParams.set('page_size','10');url.searchParams.set('item_status','NORMAL');}
  else{url.searchParams.set('time_range_field','create_time');url.searchParams.set('time_from',String(ts-7*86400));url.searchParams.set('time_to',String(ts));url.searchParams.set('page_size','10');url.searchParams.set('order_status','READY_TO_SHIP');}
  stage='request_shopee';
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  stage='parse_shopee_response';
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.toLowerCase().includes('application/json'))return res.status(502).json({error:'shopee_non_json_response',httpStatus:response.status,responseType:contentType.split(';')[0]||'unknown'});
  let result;
  try{result=await response.json()}catch{return res.status(502).json({error:'shopee_invalid_json',httpStatus:response.status});}
  if(!response.ok||result.error)return res.status(502).json({error:'shopee_api_error',providerError:String(result.error||response.status).slice(0,120),providerMessage:String(result.message||'').slice(0,200)});
  if(kind==='products')return res.status(200).json({kind,shopId,items:(result.response?.item||[]).map(x=>({itemId:x.item_id,status:x.item_status,updatedAt:x.update_time})),hasNext:!!result.response?.has_next_page});
  return res.status(200).json({kind,shopId,orders:(result.response?.order_list||[]).map(x=>({orderSn:x.order_sn,status:x.order_status})),hasNext:!!result.response?.more});
 }catch(e){return res.status(503).json({error:'query_unavailable',stage,reason:e.message?.startsWith('database_error')?'database_error':e.message==='encryption_key_missing'?'encryption_key_missing':e.name==='TimeoutError'?'timeout':'integration_error'});}
}

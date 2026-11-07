import {requireAdmin} from '../_lib/admin.js';
import {db} from '../_lib/shopee.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
 const admin=await requireAdmin(req,res);if(!admin)return;
 try{
  const stores=await db('marketplace_stores?provider=eq.shopee&select=id,external_shop_id,label,status,created_at,updated_at&order=created_at.desc&limit=10');
  const ids=stores.map(x=>x.id);
  if(!ids.length)return res.status(200).json({connected:false,environment:process.env.SHOPEE_ENV||'unknown',stores:[]});
  const creds=await db('integration_credentials?store_id=in.('+ids.join(',')+')&select=store_id,token_expires_at');
  const expiry=new Map(creds.map(x=>[x.store_id,x.token_expires_at]));
  return res.status(200).json({connected:stores.some(x=>x.status==='connected'&&expiry.has(x.id)),environment:process.env.SHOPEE_ENV||'unknown',stores:stores.map(x=>({shopId:x.external_shop_id,label:x.label,status:x.status,tokenStored:expiry.has(x.id),tokenExpiresAt:expiry.get(x.id)||null}))});
 }catch{return res.status(503).json({error:'store_status_unavailable'});}
}

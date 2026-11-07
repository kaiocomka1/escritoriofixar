import {requireAdmin} from '../_lib/admin.js';
import {config,apiBase,sign,nonce,hash,db} from '../_lib/shopee.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 const user=await requireAdmin(req,res);if(!user)return;
 if(process.env.SHOPEE_ENV!=='sandbox')return res.status(503).json({error:'sandbox_only_for_now'});
 try{
  const {id,key,redirect}=config();const state=nonce();
  await db('shopee_oauth_states',{method:'POST',body:{state_hash:hash(state),admin_user_id:user.id,expires_at:new Date(Date.now()+10*60*1000).toISOString()}});
  const path='/api/v2/shop/auth_partner',ts=Math.floor(Date.now()/1000);
  const u=new URL(apiBase()+path);u.searchParams.set('partner_id',id);u.searchParams.set('timestamp',String(ts));u.searchParams.set('sign',sign(id,path,ts,key));u.searchParams.set('redirect',redirect);
  // Shopee redirects to registered callback with code and shop_id; state is bound
  // via an HttpOnly SameSite=Lax cookie on the user's browser.
  res.setHeader('Set-Cookie','fixar_shopee_state='+state+'; Path=/api/shopee/callback; Max-Age=600; HttpOnly; Secure; SameSite=Lax');
  return res.status(200).json({authorizationUrl:u.toString()});
 }catch{return res.status(503).json({error:'shopee_authorization_unavailable'});}
}

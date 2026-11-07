import {config,hash,db,apiBase,sign,encrypt} from '../_lib/shopee.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Set-Cookie','fixar_shopee_state=; Path=/api/shopee/callback; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
 if(req.method!=='GET')return res.status(405).send('Method not allowed');
 const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
 const state=cookies.fixar_shopee_state;
 const {code,shop_id,state:returnedState}=req.query;
 if(!state||!returnedState||returnedState!==state||!code||!shop_id||!/^[0-9]+$/.test(String(shop_id)))return res.status(400).send('Autorização inválida ou expirada. Reinicie a conexão pelo escritório.');
 try{
  const records=await db('shopee_oauth_states?state_hash=eq.'+hash(state)+'&select=state_hash,expires_at&limit=1');
  if(!Array.isArray(records)||records.length!==1||Date.parse(records[0].expires_at)<Date.now())return res.status(400).send('Autorização expirada. Tente novamente.');
  await db('shopee_oauth_states?state_hash=eq.'+hash(state),{method:'DELETE'});
  const {id,key}=config();
  // Do not exchange authorization codes until encrypted storage is configured.
  if(!process.env.SHOPEE_TOKEN_ENCRYPTION_KEY)return res.status(503).send('Configure a chave de criptografia no servidor antes de conectar.');
  const path='/api/v2/auth/token/get',ts=Math.floor(Date.now()/1000);
  const url=new URL(apiBase()+path);url.searchParams.set('partner_id',id);url.searchParams.set('timestamp',String(ts));url.searchParams.set('sign',sign(id,path,ts,key));
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:String(code),shop_id:Number(shop_id),partner_id:Number(id)}),signal:AbortSignal.timeout(10000)});
  const token=await response.json();
  if(!response.ok||token.error||!token.access_token||!token.refresh_token)throw Error('token_exchange_failed');
  const rows=await db('marketplace_stores',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:{provider:'shopee',external_shop_id:String(shop_id),label:'Shopee Sandbox '+shop_id,status:'connected',updated_at:new Date().toISOString()}});
  const store=rows?.[0];if(!store?.id)throw Error('store_save_failed');
  await db('integration_credentials',{method:'POST',prefer:'resolution=merge-duplicates',body:{store_id:store.id,encrypted_access_token:'\\x'+encrypt(token.access_token),encrypted_refresh_token:'\\x'+encrypt(token.refresh_token),token_expires_at:new Date(Date.now()+(Number(token.expire_in)||14400)*1000).toISOString(),updated_at:new Date().toISOString()}});
  return res.redirect(303,'/?shopee=connected');
 }catch{return res.status(503).send('Não foi possível concluir a conexão. Verifique o ambiente Sandbox e tente novamente.');}
}

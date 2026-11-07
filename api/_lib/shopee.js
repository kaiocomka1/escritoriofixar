import {createHmac,createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const nonce=()=>randomBytes(32).toString('hex');
export const apiBase=()=>process.env.SHOPEE_ENV==='live'?'https://partner.shopeemobile.com':'https://openplatform.sandbox.test-stable.shopee.sg';
export const sign=(id,path,ts,key)=>createHmac('sha256',key).update(String(id)+path+String(ts)).digest('hex');
export function config(){const id=process.env.SHOPEE_PARTNER_ID,key=process.env.SHOPEE_PARTNER_KEY,redirect=process.env.SHOPEE_REDIRECT_URL;if(!id||!key||!redirect)throw Error('shopee_config_missing');const u=new URL(redirect);if(u.protocol!=='https:'||u.hostname!=='escritoriofixar.vercel.app'||u.pathname!=='/api/shopee/callback')throw Error('shopee_redirect_invalid');return {id,key,redirect};}
export async function db(path,{method='GET',body,prefer}={}){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw Error('supabase_missing');const r=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error('database_error_'+r.status);if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null;}
export function encrypt(value){const k=process.env.SHOPEE_TOKEN_ENCRYPTION_KEY;if(!k||!/^[0-9a-fA-F]{64}$/.test(k))throw Error('encryption_key_missing');const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',Buffer.from(k,'hex'),iv);const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString('hex');}

export function decrypt(hex){const k=process.env.SHOPEE_TOKEN_ENCRYPTION_KEY;if(!k||!/^[0-9a-fA-F]{64}$/.test(k))throw Error('encryption_key_missing');const b=Buffer.from(hex.replace(/^\\x/,''),'hex');const d=createDecipheriv('aes-256-gcm',Buffer.from(k,'hex'),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');}
export function shopSign(id,path,ts,token,shopId,key){return createHmac('sha256',key).update(String(id)+path+String(ts)+token+String(shopId)).digest('hex');}

export async function accessTokenForStore(store){
 const rows=await db('integration_credentials?store_id=eq.'+store.id+'&select=encrypted_access_token,encrypted_refresh_token,token_expires_at&limit=1');
 if(!rows?.length||!rows[0].encrypted_access_token)return {error:'token_missing'};
 const row=rows[0];
 if(Date.parse(row.token_expires_at)>Date.now()+5*60*1000)return {token:decrypt(row.encrypted_access_token),refreshed:false};
 if(!row.encrypted_refresh_token)return {error:'refresh_token_missing'};
 const refreshToken=decrypt(row.encrypted_refresh_token);
 const {id,key}=config(),path='/api/v2/auth/access_token/get',ts=Math.floor(Date.now()/1000);
 const url=new URL(apiBase()+path);
 url.searchParams.set('partner_id',String(id));
 url.searchParams.set('timestamp',String(ts));
 url.searchParams.set('sign',sign(id,path,ts,key));
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refreshToken,shop_id:Number(store.external_shop_id),partner_id:Number(id)}),signal:AbortSignal.timeout(12000)});
 const contentType=response.headers.get('content-type')||'';
 if(!contentType.includes('json'))return {error:'refresh_non_json',httpStatus:response.status};
 const result=await response.json();
 if(!response.ok||result.error||!result.access_token||!result.refresh_token)return {error:'refresh_failed',providerError:String(result.error||response.status).slice(0,100)};
 const expiry=new Date(Date.now()+(Number(result.expire_in)||14400)*1000).toISOString();
 await db('integration_credentials?store_id=eq.'+store.id,{method:'PATCH',prefer:'return=minimal',body:{encrypted_access_token:'\\x'+encrypt(result.access_token),encrypted_refresh_token:'\\x'+encrypt(result.refresh_token),token_expires_at:expiry,updated_at:new Date().toISOString()}});
 return {token:result.access_token,refreshed:true};
}

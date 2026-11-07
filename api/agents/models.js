import {requireAdmin} from '../_lib/admin.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 if(!await requireAdmin(req,res))return;
 const key=process.env.GEMINI_API_KEY;
 if(!key)return res.status(503).json({error:'gemini_key_not_configured'});
 try{
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(12000)});
  const data=await response.json().catch(()=>({}));
  const models=(data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name).filter(Boolean);
  return res.status(200).json({googleHttp:response.status,googleCode:typeof data.error?.status==='string'?data.error.status:null,models,hasMore:!!data.nextPageToken,configuredModel:process.env.GEMINI_MODEL||'gemini-3.5-flash-lite'});
 }catch{return res.status(503).json({error:'model_listing_unavailable'});}
}

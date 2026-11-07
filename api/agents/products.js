import {requireAdmin} from '../_lib/admin.js';
const SYSTEM='Você é o Agente de Produtos do Fixar+ AI Office, especialista em anúncios de marketplace brasileiro, principalmente Shopee. Responda em português do Brasil, de forma prática e concisa. Ajude com SEO, títulos, descrições, objeções, precificação e conversão. Nunca invente dados de vendas, taxas ou métricas. Não alegue ter consultado a Shopee quando não houver dados fornecidos. Não execute alterações, publicações ou ações fiscais. Evite promessas sem comprovação, como capacidade de carga não testada. Quando faltar dado importante, solicite-o.';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 if(!await requireAdmin(req,res))return;
 const key=process.env.GEMINI_API_KEY;
 if(!key)return res.status(503).json({error:'gemini_key_not_configured'});
 const {message,history=[]}=req.body||{};
 if(typeof message!=='string'||!message.trim()||message.length>4000||!Array.isArray(history))return res.status(400).json({error:'invalid_message'});
 const prior=history.slice(-8).filter(x=>['user','model'].includes(x.role)&&typeof x.text==='string').map(x=>({role:x.role,parts:[{text:x.text.slice(0,4000)}]}));
 const contents=[...prior,{role:'user',parts:[{text:message.trim()}]}];
 try{
  const configuredModel=process.env.GEMINI_MODEL||'gemini-2.5-flash-lite';
  const requestedModel=configuredModel.startsWith('models/')?configuredModel.slice(7):configuredModel;
  const payload=JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents,generationConfig:{maxOutputTokens:900,temperature:0.5}});
  async function generate(model,version='v1beta'){
   const url='https://generativelanguage.googleapis.com/'+version+'/models/'+encodeURIComponent(model)+':generateContent';
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:payload,signal:AbortSignal.timeout(25000)});
   return {response,data:await response.json().catch(()=>({})),model,version};
  }
  const result=await generate(requestedModel);
  const {response,data,model,version}=result;
  if(!response.ok){
   const providerMessage=typeof data.error?.message==='string'?data.error.message.slice(0,300):null;
   return res.status(response.status===429?429:502).json({error:response.status===429?'gemini_quota_exceeded':'gemini_provider_error',providerStatus:response.status,providerCode:typeof data.error?.status==='string'?data.error.status.slice(0,60):null,providerMessage,model,apiVersion:version});
  }
  const answer=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
  if(!answer)return res.status(502).json({error:'empty_gemini_response'});
  return res.status(200).json({answer,model});
 }catch{return res.status(503).json({error:'gemini_unavailable'});}
}

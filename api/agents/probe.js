import {requireAdmin} from '../_lib/admin.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 if(!await requireAdmin(req,res))return;
 const key=process.env.GEMINI_API_KEY;
 if(!key)return res.status(503).json({error:'gemini_key_not_configured'});
 const models=['gemini-2.5-flash-lite','gemini-2.5-flash'];
 const checks=[];
 for(const model of models){
  try{
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:'Responda apenas OK.'}]}],generationConfig:{maxOutputTokens:32}}),signal:AbortSignal.timeout(12000)});
   const data=await response.json().catch(()=>({}));
   checks.push({model,http:response.status,code:data.error?.status||null,message:typeof data.error?.message==='string'?data.error.message.slice(0,450):null,success:response.ok});
   if(response.ok)break;
  }catch(e){checks.push({model,error:e.name==='TimeoutError'?'timeout':'network_error'});}
 }
 return res.status(200).json({checks});
}

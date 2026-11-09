import {runAgent,executeTool,roles,sanitizeOfficeContext} from '../_lib/agent-tools.js';
import {apiBase,config,db,accessTokenForStore,shopSign} from '../_lib/shopee.js';
import {requireAdmin} from '../_lib/admin.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 const user=await requireAdmin(req,res); if(!user)return;
 const agentId=req.body?.agentId||'thor';
 if(!Object.hasOwn(roles,agentId))return res.status(400).json({error:'invalid_agent'});
 const action=req.body?.action;
 try{
  // Compatibility routes cannot bypass the same server-side tool permissions.
  const aliases={evaluate_pricing:'evaluate_pricing',edit_sandbox_title:'edit_title',product_change_history:'change_history',undo_product_change:'undo_change'};
  if(action==='auto_optimize_sandbox'){
   if(agentId!=='thor')return res.status(403).json({error:'tool_forbidden'});
   if(req.body?.preview!==true)return res.status(403).json({error:'bulk_writes_disabled_use_audited_edit'});
   return autoOptimizeSandbox(req,res);
  }
  const context={userId:user.id,allowWrites:req.body?.allowSandboxWrites===true};
  if(action){
   if(!Object.hasOwn(aliases,action))return res.status(400).json({error:'invalid_action'});
   const args=action==='evaluate_pricing'?req.body.pricing:action==='edit_sandbox_title'?{itemId:Number(req.body.itemId),title:req.body.title,expectedTitle:req.body.expectedTitle}:action==='undo_product_change'?{changeId:Number(req.body.changeId)}:{};
   const result=await executeTool(agentId,aliases[action],args,context);
   return res.status(result.error?400:200).json(result);
  }
  const {message,history=[]}=req.body||{};
  if(typeof message!=='string'||!message.trim()||message.length>4000||!Array.isArray(history))return res.status(400).json({error:'invalid_message'});
  const result=await runAgent({agentId,message:message+(req.body?.includeShopee===true?'\nSolicito consultar dados da Sandbox quando pertinente.':''),history,context:{...context,officeContext:sanitizeOfficeContext(req.body?.officeContext)}});
  return res.status(200).json(result);
 }catch(e){return res.status(503).json({error:e.code||'agent_unavailable'});}
}

async function autoOptimizeSandbox(req,res){
 if(process.env.SHOPEE_ENV!=='sandbox')return res.status(403).json({error:'sandbox_only'});
 const apiKey=process.env.GEMINI_API_KEY;
 if(!apiKey)return res.status(503).json({error:'gemini_key_not_configured'});
 if(req.body?.preview!==true)return res.status(403).json({error:'bulk_writes_disabled'});
 if(!process.env.SHOPEE_SANDBOX_STORE_ID)return res.status(409).json({error:'sandbox_store_binding_required'});
 const maxItems=3;
 const preview=req.body?.preview===true;
 const report=[];
 try{
  const stores=await db('marketplace_stores?id=eq.'+encodeURIComponent(process.env.SHOPEE_SANDBOX_STORE_ID)+'&provider=eq.shopee&status=eq.connected&select=id,external_shop_id&order=created_at.desc&limit=1');
  if(!stores?.length)return res.status(409).json({error:'store_not_connected'});
  const shop=stores[0],auth=await accessTokenForStore(shop);
  if(auth.error)return res.status(409).json({error:auth.error});
  const {id,key}=config(),shopId=Number(shop.external_shop_id);
  async function call(path,method,params={},body){
   const ts=Math.floor(Date.now()/1000),url=new URL(apiBase()+path);
   for(const [k,v] of Object.entries({partner_id:id,timestamp:ts,access_token:auth.token,shop_id:shopId,sign:shopSign(id,path,ts,auth.token,shopId,key),...params}))url.searchParams.set(k,String(v));
   const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok||data.error)throw Error('Shopee: '+String(data.error||response.status)+' '+String(data.message||'').slice(0,130));
   return data.response||{};
  }
  const listing=await call('/api/v2/product/get_item_list','GET',{offset:0,page_size:maxItems,item_status:'NORMAL'});
  const items=(listing.item||[]).slice(0,maxItems);
  if(!items.length)return res.status(200).json({results:[],message:'Nenhum produto ativo na Sandbox'});
  const detail=await call('/api/v2/product/get_item_base_info','GET',{item_id_list:items.map(x=>x.item_id).join(',')});
  const products=(detail.item_list||[]).filter(p=>items.some(x=>String(x.item_id)===String(p.item_id))).slice(0,maxItems);
  const model=(process.env.GEMINI_MODEL||'gemini-3.5-flash-lite').replace(/^models\//,'');
  for(const p of products){
   const oldTitle=String(p.item_name||'').trim();
   const itemId=Number(p.item_id);
   if(!oldTitle||!Number.isSafeInteger(itemId)){report.push({itemId,status:'skipped',reason:'Produto inválido'});continue;}
   const description=String(p.description||'').trim();
   const imageUrl=p.image?.image_url_list?.[0]||null;
   const prompt=[
    'Você é especialista em SEO de títulos da Shopee Brasil, focado em cobertura de termos de pesquisa relevantes, não em frases publicitárias.',
    'Analise primeiro a imagem de capa e identifique com precisão o objeto real, função e contexto de uso. Cruze com título e descrição, que podem estar ruins ou errados.',
    'Gere um título com 105 a 120 caracteres, preferencialmente 115 a 120, SEM ultrapassar 120. Use sequências naturais de palavras-chave, sem exigir frase completa.',
    'Ordene: produto principal, sinônimos comerciais comprováveis, aplicação, instalação/local de uso e termos complementares pertinentes.',
    'Evite conectivos repetidos, enchimento, termos irrelevantes, repetições desnecessárias e palavras sem relação com o produto.',
    'Não invente dimensões, capacidade, quantidade, material, compatibilidade, acessórios ou método de fixação que não sejam evidentes.',
    'Exemplo ilustrativo de estilo, não copie para outros produtos: Suporte para Saco de Lixo Cozinha Lixeira Suspensa Porta Armário Organizador de Sacola Cesto de Lixo Doméstico.',
    'Se não houver termos relevantes suficientes para 105 caracteres, prefira título menor e correto. Se não conseguir identificar o produto, responda IGUAL.',
    'Responda APENAS com o título, sem aspas, listas ou explicações.',
    'Título atual: '+oldTitle.slice(0,180),
    'Descrição: '+description.slice(0,1200)
   ].join('\n');
   try{
    const parts=[{text:prompt}];
    if(imageUrl){
     const u=new URL(imageUrl),host=u.hostname.toLowerCase();
     if(u.protocol==='https:'&&(host.endsWith('.susercontent.com')||host.endsWith('.shopee.com.br')||host.endsWith('.shopee.sg'))){
      const ir=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(9000)});
      const mime=(ir.headers.get('content-type')||'').split(';')[0];
      if(ir.ok&&['image/jpeg','image/png','image/webp'].includes(mime)){
       const bytes=await ir.arrayBuffer();
       if(bytes.byteLength>0&&bytes.byteLength<=3500000)parts.push({inlineData:{mimeType:mime,data:Buffer.from(bytes).toString('base64')}});
      }
     }
    }
    if(parts.length===1&&description.length<40){report.push({itemId,oldTitle,status:'skipped',reason:'Sem imagem acessível nem descrição suficiente'});continue;}
    const ai=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0.25,maxOutputTokens:240}}),signal:AbortSignal.timeout(18000)});
    const aiData=await ai.json().catch(()=>({}));
    if(!ai.ok)throw Error('Gemini HTTP '+ai.status+' '+String(aiData.error?.message||'').slice(0,120));
    const title=(aiData.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('').trim().replace(/^[“”"]+|[“”"]+$/g,'').replace(/\s+/g,' ');
    if(title==='IGUAL'){report.push({itemId,oldTitle,status:'unchanged',reason:'Gemini não encontrou melhorias fundamentadas'});continue;}
    if(title.length<35||title.length>120||/[\n\r]/.test(title))throw Error('Título gerado sem detalhes suficientes ou fora dos limites');
    const criticalTokens=(oldTitle.match(/\b\d+(?:[.,]\d+)?\s*(?:cm|mm|kg|ml|l|unidades|peças|pcs)\b/gi)||[]).map(v=>v.toLowerCase().replace(/\s+/g,''));
    const normalizedNew=title.toLowerCase().replace(/\s+/g,'');
    if(criticalTokens.some(token=>!normalizedNew.includes(token))){report.push({itemId,oldTitle,newTitle:title,status:'skipped',reason:'Título proposto omitiu medida ou quantidade presente no cadastro'});continue;}
    if(title.toLocaleLowerCase('pt-BR')===oldTitle.toLocaleLowerCase('pt-BR')){report.push({itemId,oldTitle,newTitle:title,status:'unchanged'});continue;}
    report.push({itemId,oldTitle,newTitle:title,status:'preview',reason:'Simulação: nenhuma alteração enviada à Shopee'});
   }catch(e){report.push({itemId,oldTitle,status:'failed',reason:String(e.message||e).slice(0,200)});}
  }
  return res.status(200).json({results:report,shopId,model,limit:maxItems,preview});
 }catch(e){return res.status(503).json({error:'sandbox_auto_optimize_failed',detail:String(e.message||e).slice(0,200),results:report});}
}

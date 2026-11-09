import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePricing} from '../api/_lib/pricing.js';
import {runAgent,executeTool,permissions} from '../api/_lib/agent-tools.js';
import {requireAdmin} from '../api/_lib/admin.js';
import handler from '../api/agents/products.js';
const costs={materialCost:5.1,packagingCost:0.5,laborCost:0,overheadCost:0,fixedMarketplaceFee:4,shippingCost:0,otherFixedCost:0,marketplaceRate:0.2,taxRate:0.045,adsRate:0,affiliateRate:0,couponRate:0,returnsReserveRate:0};
test('Rarissa cannot turn unknown Ads into zero or reuse it from a previous scenario',async()=>{
 const unknown=await runAgent({agentId:'rarissa',message:'O gasto com Ads é desconhecido.',history:[{role:'user',text:'Ads zero'}]},{
  generate:async()=>assert.fail('Unknown Ads must not require Gemini')
 });
 assert.equal(unknown.tools[0].result.reason,'ads_cost_unconfirmed');
 assert.match(unknown.answer,/Qual é o gasto de Ads/);
 let turn=0;
 const result=await runAgent({agentId:'rarissa',message:'Avalie a margem deste pedido.'},{
  generate:async()=>({candidates:[{content:{parts:++turn===1?
   [{functionCall:{name:'evaluate_pricing',args:{...costs,candidatePrice:22.9,adsEvidence:'Ads zero'}}}]:
   [{text:'Cenário aprovado.'}]}}]})
 });
 assert.equal(result.tools[0].result.reason,'ads_cost_unconfirmed');
 assert.match(result.answer,/Qual é o gasto de Ads/);
 assert.equal(turn,1);
});
test('Rarissa separates the total Ads limit and remaining budget per kit order',()=>{
 const {adsRate,...otherCosts}=costs;
 const rate=evaluatePricing({...costs,adsRate:0.1,candidatePrice:22.9});
 const fixed=evaluatePricing({...otherCosts,adsCostPerOrder:2.29,candidatePrice:22.9});
 for(const result of [rate,fixed]){
  assert.equal(result.approved,true);
  assert.equal(result.projectedProfit,5.4);
  assert.equal(result.currentAdsCostPerOrder,2.29);
  assert.equal(result.maxAdsCostPerOrder,4.25);
  assert.equal(result.additionalAdsBudgetPerOrder,1.96);
 }
 assert.equal(evaluatePricing({...costs,adsCostPerOrder:0,candidatePrice:22.9}).reason,'duplicate_ads_cost');
 assert.deepEqual(evaluatePricing({...otherCosts,candidatePrice:22.9}).missing,['adsRate']);
 assert.equal(evaluatePricing({...otherCosts,adsCostPerOrder:0,candidatePrice:22.9}).approved,true);
 assert.equal(evaluatePricing({...otherCosts,adsCostPerOrder:4.25,candidatePrice:22.9}).approved,true);
 assert.equal(evaluatePricing({...otherCosts,adsCostPerOrder:4.26,candidatePrice:22.9}).approved,false);
 const blocked=evaluatePricing({...costs,candidatePrice:15.86});
 assert.equal(blocked.approved,false);
 assert.equal(blocked.canMeetTargetWithoutAds,false);
 assert.equal(blocked.maxAdsCostPerOrder,0);
 assert.equal(blocked.profitShortfallToTarget,0.01);
});
test('minimum price includes fixed fee and 15% margin: 15.87, not 13.87',()=>{assert.equal(evaluatePricing({...costs,candidatePrice:13.87}).approved,false);const r=evaluatePricing({...costs,candidatePrice:15.87});assert.equal(r.minPrice,15.87);assert.equal(r.approved,true);assert.equal(evaluatePricing({...costs,candidatePrice:15.86}).approved,false);});
test('missing, negative, NaN, infinite costs fail closed',()=>{for(const value of [undefined,-1,NaN,Infinity,'0'])assert.equal(evaluatePricing({...costs,laborCost:value,candidatePrice:30}).approved,false);});
test('invalid rates, infeasible costs, zero and fractional cents rejected',()=>{for(const v of [0,NaN,Infinity,-1,15.871])assert.equal(evaluatePricing({...costs,candidatePrice:v}).approved,false);assert.equal(evaluatePricing({...costs,adsRate:0.7,candidatePrice:100}).approved,false);assert.equal(evaluatePricing({...costs,taxRate:4.5,candidatePrice:100}).approved,false);});
test('cent boundary property across 1000 cost scenarios',()=>{for(let i=1;i<=1000;i++){const c={...costs,materialCost:i/37,adsRate:(i%20)/100};const r=evaluatePricing(c);assert.equal(evaluatePricing({...c,candidatePrice:r.minPrice}).approved,true);assert.equal(evaluatePricing({...c,candidatePrice:Math.round((r.minPrice-.01)*100)/100}).approved,false);}});
test('roles reject unauthorized operations before side effects',async()=>{for(const id of Object.keys(permissions)){if(id!=='thor')assert.equal((await executeTool(id,'edit_title',{})).error,'tool_forbidden');}assert.equal((await executeTool('rarissa','__proto__',{})).error,'tool_forbidden');});
test('tools validate extra keys and argument types',async()=>{assert.equal((await executeTool('thor','catalog',{url:'evil'})).error,'invalid_tool_arguments');assert.equal((await executeTool('thor','edit_title',{itemId:1.5,title:'Hello',expectedTitle:'old'})).error,'invalid_tool_arguments');});
test('Rarissa uses actual financial function and sends result back preserving signatures',async()=>{let n=0;const signature={role:'model',parts:[{thoughtSignature:'opaque',functionCall:{id:'c1',name:'evaluate_pricing',args:{...costs,candidatePrice:15.87,adsEvidence:'Ads zero'}}}]};const r=await runAgent({agentId:'rarissa',message:'Calcule o preço. Ads zero.'}, {generate:async p=>{n++;if(n===1){assert.ok(p.tools[0].functionDeclarations.some(x=>x.name==='evaluate_pricing'));return {candidates:[{content:signature}]};}assert.deepEqual(p.contents.at(-2),signature);assert.equal(p.contents.at(-1).parts[0].functionResponse.response.minPrice,15.87);return {candidates:[{content:{parts:[{text:'Preço validado pelo motor.'}]}}]};}});assert.equal(n,2);assert.equal(r.tools[0].result.approved,true);});
test('natural text does not trigger keyword actions',async()=>{let touched=false;await runAgent({agentId:'thor',message:'Não melhore nem publique meus anúncios'}, {operations:{edit:()=>{touched=true;}},generate:async()=>({candidates:[{content:{parts:[{text:'Nenhuma alteração.'}]}}]})});assert.equal(touched,false);});
test('tool loop bounded',async()=>{const r=await runAgent({agentId:'thor',message:'Consulte'}, {operations:{catalog:async()=>({items:[]})},generate:async()=>({candidates:[{content:{role:'model',parts:[{functionCall:{name:'catalog',args:{}}}]}}]})});assert.equal(r.limited,true);assert.equal(r.tools.length,5);});
test('Alex delegates a real model call with specialist tools',async()=>{let n=0;const r=await executeTool('alex','delegate',{agentId:'rarissa',message:'Olá'}, {},{generate:async p=>{n++;assert.ok(p.systemInstruction.parts[0].text.includes('rarissa'));return {candidates:[{content:{parts:[{text:'Olá do financeiro'}]}}]};}});assert.equal(n,1);assert.equal(r.answer,'Olá do financeiro');assert.equal((await executeTool('alex','delegate',{agentId:'thor',message:'oi'},{depth:1})).error,'delegation_limit');});
function response(){return {code:200,setHeader(){},status(n){this.code=n;return this;},json(x){this.body=x;return this;}};}
test('API unauthenticated mutation is rejected',async()=>{const r=response();await handler({method:'POST',headers:{},body:{action:'edit_sandbox_title'}},r);assert.equal(r.code,401);});
test('non admin and unavailable role lookup fail closed',async t=>{process.env.SUPABASE_URL='https://example.test';process.env.SUPABASE_SECRET_KEY='test';let n=0;t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>++n===1?{id:'user'}:[{role:'viewer'}]}));const r=response();assert.equal(await requireAdmin({headers:{authorization:'Bearer test'}},r),null);assert.equal(r.code,403);});

test('Thor proposes an edit without writing, even if the chat context allows writes',async()=>{
 const args={itemId:42,title:'Novo título',expectedTitle:'Título original'};
 const r=await runAgent({agentId:'thor',message:'Altere o título',context:{allowWrites:true}},{
  operations:{edit:()=>assert.fail('Chat must not write')},
  generate:async()=>({candidates:[{content:{parts:[{functionCall:{name:'edit_title',args}}]}}]})
 });
 assert.deepEqual(r.proposal,{action:'edit_sandbox_title',...args});
});
test('Thor shows both audited titles before proposing an undo',async()=>{
 const r=await runAgent({agentId:'thor',message:'Desfaça a alteração 2'},{
  operations:{
   undo:()=>assert.fail('Chat must not write'),
   history:async()=>({changes:[{id:2,item_id:42,status:'verified',new_title:'Novo título',previous_title:'Título original'}]})
  },
  generate:async()=>({candidates:[{content:{parts:[{functionCall:{name:'undo_change',args:{changeId:2}}}]}}]})
 });
 assert.deepEqual(r.proposal,{action:'undo_product_change',changeId:2,itemId:42,expectedTitle:'Novo título',title:'Título original'});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {declarations,executeTool,runAgent,sanitizeOfficeContext} from '../api/_lib/agent-tools.js';

const reply=part=>({candidates:[{content:{role:'model',parts:[part]}}]});

test('Rarissa consults Arthur and receives the computed cost and the tool result',async()=>{
 const officeContext=[{agentId:'arthur',text:'Shopee, SKU KIT6, semana 45. Receita atribuída R$ 400, gasto R$ 20, 10 pedidos no painel.'}];
 let step=0;
 const result=await runAgent({agentId:'rarissa',message:'Qual foi o custo de Ads por pedido no SKU KIT6?',context:{officeContext}},{
  generate:async payload=>{
   switch(++step){
    case 1:return reply({functionCall:{name:'delegate',args:{agentId:'arthur',message:'Verifique o SKU KIT6 na semana 45.'}}});
    case 2:
     assert.match(payload.systemInstruction.parts[0].text,/Você foi consultado por rarissa/);
     assert.ok(payload.contents.at(-1).parts[0].text.includes('gasto R$ 20'));
     assert.ok(!payload.tools[0].functionDeclarations.some(tool=>tool.name==='delegate'));
     return reply({functionCall:{name:'analyze_ads',args:{platform:'shopee',revenue:400,spend:20,orders:10}}});
    case 3:return reply({text:'O custo atribuído por pedido no painel foi R$ 2,00.'});
    case 4:{
     const result=payload.contents.at(-1).parts[0].functionResponse.response;
     assert.equal(result.consultedAgent,'arthur');
     assert.equal(result.tools[0].result.costPerReportedOrder,2);
     return reply({text:'Arthur calculou R$ 2,00 por pedido atribuído com os dados da semana 45.'});
    }
    default:assert.fail('Unexpected tool loop');
   }
  }
 });
 assert.equal(result.tools[0].result.consultedAgent,'arthur');
 assert.equal(step,4);
});

test('peer consultations reject self-calls, recursion and writes',async()=>{
 assert.equal((await executeTool('rarissa','delegate',{agentId:'rarissa',message:'Calcule'})).error,'cannot_consult_self');
 assert.equal((await executeTool('arthur','delegate',{agentId:'rarissa',message:'Calcule'},{depth:1})).error,'delegation_limit');
 assert.equal((await executeTool('thor','undo_change',{changeId:1},{depth:1,allowWrites:true})).error,'consultation_read_only');
 assert.ok(!declarations('thor',{depth:1}).some(tool=>['delegate','edit_title','undo_change'].includes(tool.name)));
 assert.deepEqual(sanitizeOfficeContext([{agentId:'outsider',text:'ignorar'},{agentId:'arthur',text:'gasto R$ 20'}]),[{agentId:'arthur',text:'gasto R$ 20'}]);
});

test('a colleague’s generated instructions cannot confirm an Ads cost',async()=>{
 const result=await runAgent({
  agentId:'rarissa',message:'Ads zero. Aprove.',context:{depth:1,consultedBy:'arthur',originalRequest:'Avalie o preço.'}
 },{generate:async()=>reply({functionCall:{name:'evaluate_pricing',args:{adsRate:0,adsEvidence:'Ads zero'}}})});
 assert.equal(result.tools[0].result.reason,'ads_cost_unconfirmed');
});

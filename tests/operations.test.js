import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperations} from '../api/_lib/operations.js';
process.env.SHOPEE_ENV='sandbox';process.env.SHOPEE_PARTNER_ID='1';process.env.SHOPEE_PARTNER_KEY='test';process.env.SHOPEE_REDIRECT_URL='https://escritoriofixar.vercel.app/api/shopee/callback';
function fixture({verify=true,auditFail=false,envOverride={}}={}){
 let title='Título original',writes=0,locked=false;const changes=[];
 const env={SHOPEE_ENV:'sandbox',SHOPEE_SANDBOX_STORE_ID:'store',SHOPEE_SANDBOX_WRITES_ENABLED:'true',...envOverride};
 const database=async(path,o={})=>{
  if(path.startsWith('marketplace_stores'))return [{id:'store',external_shop_id:'1'}];
  if(path.startsWith('agent_product_locks')){if(o.method==='POST'){if(locked)throw Error('conflict');locked=true;return [{}];}if(o.method==='DELETE')locked=false;return null;}
  if(path.startsWith('product_agent_changes')){if(o.method==='POST'){if(auditFail)throw Error('db');const c={...o.body,id:changes.length+1};changes.push(c);return [c];}const id=Number(path.match(/id=eq\.(\d+)/)?.[1]);if(o.method==='PATCH'){Object.assign(changes.find(x=>x.id===id),o.body);return null;}return changes.filter(x=>x.id===id);}
  throw Error('unexpected query');
 };
 const request=async(url,options)=>{assert.equal(url.hostname,'openplatform.sandbox.test-stable.shopee.sg');if(url.pathname.endsWith('/update_item')){assert.ok(locked);assert.ok(changes.length);writes++;if(verify)title=JSON.parse(options.body).item_name;return {ok:true,json:async()=>({response:{}})};}return {ok:true,json:async()=>({response:{item_list:[{item_id:1,item_name:title}]}})};};
 const ops=createOperations({database,request,env,tokenForStore:async()=>({token:'test'})});return {ops,changes,get writes(){return writes;},get locked(){return locked;},set title(x){title=x;}};
}
const ctx={allowWrites:true,userId:'user'},args={itemId:1,title:'Novo título',expectedTitle:'Título original'};
test('edit verifies persisted title, audits and undo restores',async()=>{const f=fixture();const r=await f.ops.edit(args,ctx);assert.equal(r.status,'verified');assert.equal(f.changes[0].previous_title,args.expectedTitle);assert.equal(f.locked,false);const u=await f.ops.undo({changeId:1},ctx);assert.equal(u.restoredTitle,args.expectedTitle);assert.equal(f.changes[0].status,'reverted');assert.equal(f.writes,2);await assert.rejects(f.ops.undo({changeId:1},ctx),/change_not_revertible/);});
test('write cannot proceed without request permission, environment gate or sandbox',async()=>{for(const [envOverride,context]of [[{},{}],[{SHOPEE_SANDBOX_WRITES_ENABLED:'false'},ctx],[{SHOPEE_ENV:'live'},ctx],[{SHOPEE_SANDBOX_STORE_ID:''},ctx]]){const f=fixture({envOverride});await assert.rejects(f.ops.edit(args,context));assert.equal(f.writes,0);}});
test('stale title and failed audit block mutation',async()=>{for(const auditFail of [false,true]){const f=fixture({auditFail});if(!auditFail)f.title='Alterado externamente';await assert.rejects(f.ops.edit(args,ctx));assert.equal(f.writes,0);assert.equal(f.locked,false);}});
test('unconfirmed update is not success and retains lock',async()=>{const f=fixture({verify:false});const r=await f.ops.edit(args,ctx);assert.equal(r.success,false);assert.equal(r.status,'submitted_unverified');assert.equal(f.changes[0].status,'submitted_unverified');assert.equal(f.locked,true);await assert.rejects(f.ops.edit(args,ctx));assert.equal(f.writes,1);});
test('undo rejects external changes without overwriting them',async()=>{const f=fixture();await f.ops.edit(args,ctx);f.title='Mudança externa';await assert.rejects(f.ops.undo({changeId:1},ctx),/title_changed_since_read/);assert.equal(f.writes,1);});
test('concurrent requests cannot both write',async()=>{const f=fixture();const r=await Promise.allSettled([f.ops.edit(args,ctx),f.ops.edit(args,ctx)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.writes,1);});

import {apiBase,config,db,accessTokenForStore,shopSign} from './shopee.js';
export function createOperations({database=db,tokenForStore=accessTokenForStore,request=fetch,env=process.env,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 async function connect(){
  if(env.SHOPEE_ENV!=='sandbox')throw Error('sandbox_only');
  // An explicit store binding prevents accidentally using the latest connected live store.
  if(!env.SHOPEE_SANDBOX_STORE_ID)throw Error('sandbox_store_binding_required');
  const rows=await database('marketplace_stores?id=eq.'+encodeURIComponent(env.SHOPEE_SANDBOX_STORE_ID)+'&provider=eq.shopee&status=eq.connected&select=id,external_shop_id&limit=1');
  if(!rows?.length)throw Error('sandbox_store_not_connected');
  const store=rows[0],auth=await tokenForStore(store);
  if(auth.error)throw Error(auth.error);
  const {id,key}=config();
  async function call(path,params={},body){
   if(env.SHOPEE_ENV!=='sandbox'||apiBase()!=='https://openplatform.sandbox.test-stable.shopee.sg')throw Error('sandbox_only');
   const ts=Math.floor(Date.now()/1000),url=new URL(apiBase()+path),shopId=Number(store.external_shop_id);
   for(const [k,v] of Object.entries({partner_id:id,timestamp:ts,access_token:auth.token,shop_id:shopId,sign:shopSign(id,path,ts,auth.token,shopId,key),...params}))url.searchParams.set(k,String(v));
   const r=await request(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
   const data=await r.json(); if(!r.ok||data.error)throw Error('shopee_request_failed');
   if(!data.response||typeof data.response!=='object')throw Error('invalid_shopee_response');
   return data.response;
  }
  return {store,call};
 }
 async function current(call,itemId){const d=await call('/api/v2/product/get_item_base_info',{item_id_list:String(itemId)});const item=d.item_list?.find(x=>Number(x.item_id)===itemId);if(!item)throw Error('item_not_found');return item;}
 async function history(){const {store}=await connect();return {changes:await database('product_agent_changes?store_id=eq.'+store.id+'&select=id,item_id,previous_title,new_title,status,created_at,reverted_at&order=created_at.desc&limit=30')};}
 async function applyTitle({itemId,title,expectedTitle},context,undoChangeId){
  if(!context.allowWrites||env.SHOPEE_SANDBOX_WRITES_ENABLED!=='true')throw Error('sandbox_writes_disabled');
  const {store,call}=await connect();
  // Durable unique lock: deliberately retained after ambiguous provider outcomes.
  const lock=await database('agent_product_locks',{method:'POST',prefer:'return=representation',body:{store_id:store.id,item_id:itemId,actor_id:context.userId}});
  if(!lock?.length)throw Error('product_locked');
  let submitted=false;
  try{
   const item=await current(call,itemId);
   if(item.item_name!==expectedTitle)throw Error('title_changed_since_read');
   if(title===expectedTitle)return {status:'unchanged',itemId,title};
   const rows=await database('product_agent_changes?select=id',{method:'POST',prefer:'return=representation',body:{store_id:store.id,item_id:itemId,previous_title:expectedTitle,new_title:title,status:'submitted_unverified',source:'function_call'}});
   if(!rows?.[0]?.id)throw Error('audit_required');
   const auditId=rows[0].id;
   submitted=true;
   await call('/api/v2/product/update_item',{}, {item_id:itemId,item_name:title});
   let saved=await current(call,itemId);
   for(const delay of [300,800,1600]){
    if(saved.item_name!==expectedTitle)break;
    await wait(delay);
    saved=await current(call,itemId);
   }
   if(saved.item_name!==title)return {status:'submitted_unverified',auditId,itemId,success:false};
   await database('product_agent_changes?id=eq.'+auditId,{method:'PATCH',body:{status:'verified'}});
   if(undoChangeId)await database('product_agent_changes?id=eq.'+undoChangeId+'&store_id=eq.'+store.id,{method:'PATCH',body:{status:'reverted',reverted_at:new Date().toISOString()}});
   submitted=false;
   return {success:true,status:'verified',auditId,itemId,title};
  }finally{if(!submitted)await database('agent_product_locks?store_id=eq.'+store.id+'&item_id=eq.'+itemId,{method:'DELETE'});}
 }
 async function edit(args,context){return applyTitle(args,context);}
 async function undo({changeId},context){
  const {store}=await connect();
  const rows=await database('product_agent_changes?id=eq.'+changeId+'&store_id=eq.'+store.id+'&select=id,item_id,previous_title,new_title,status,reverted_at&limit=1');
  const c=rows?.[0];if(!c||c.status!=='verified'||c.reverted_at)throw Error('change_not_revertible');
  const result=await applyTitle({itemId:Number(c.item_id),title:c.previous_title,expectedTitle:c.new_title},context,changeId);
  return {...result,restoredTitle:result.success?c.previous_title:undefined};
 }
 return {edit,undo,history,async catalog(){const {call}=await connect();const list=await call('/api/v2/product/get_item_list',{offset:0,page_size:10,item_status:'NORMAL'});const ids=(list.item||[]).map(x=>x.item_id);if(!ids.length)return {items:[],partial:false};const data=await call('/api/v2/product/get_item_base_info',{item_id_list:ids.join(',')});return {items:(data.item_list||[]).map(x=>({itemId:x.item_id,title:x.item_name,description:String(x.description||'').slice(0,1500),stock:x.stock_info_v2||x.stock_info||null})),partial:!!list.has_next_page};},async orders(){const {call}=await connect(),ts=Math.floor(Date.now()/1000);const d=await call('/api/v2/order/get_order_list',{time_range_field:'create_time',time_from:ts-7*86400,time_to:ts,page_size:10,order_status:'READY_TO_SHIP'});return {orders:(d.order_list||[]).map(x=>({orderSn:x.order_sn,status:x.order_status})),partial:!!d.more,windowDays:7};}};
}

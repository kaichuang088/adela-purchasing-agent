import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync(resolve('node_modules/wrangler/package.json'))),{Miniflare}=require('miniflare');
const files=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p));
const password=randomUUID();let cookie='';let count=0;
const mf=new Miniflare({modules:['index.js',...files.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{ADMIN_PASSWORD:password},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
const check=(condition,label)=>{assert.ok(condition,label);console.log(`PASS ${++count}: ${label}`);};
async function raw(path,body,admin=false){const headers={'Content-Type':'application/json',Cookie:cookie};if(admin)headers['X-KK-Admin-Password']=password;const response=await mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});const value=await response.json();return{status:response.status,headers:response.headers,json:async()=>value};}
async function call(path,body,admin=false,status=200){const r=await raw(path,body,admin);const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;}
try{
const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString(),shopPaused:false})).run();
const initial=await call('/api/shop');const gummy=initial.products.find(p=>p.nameEn==='Orion Peelable Grape Gummies 67g');
await writeFile('verification/catalog-observed.json',JSON.stringify(initial.products,null,2));
async function signup(email){const r=await raw('/api/auth',{action:'signup',email,name:'Regression Buyer',password:'test-only-long-password'});assert.equal(r.status,201);cookie=r.headers.get('set-cookie').split(';')[0];return (await call('/api/shop')).member;}
const address={recipient:'測試買家',phone:'0912345678',postalCode:'100',street:'台北市測試路一號'};
async function estimate(extra={},items=[{productId:gummy.id,quantity:1}]){return (await call('/api/shop',{action:'estimate',items,...extra})).pricing;}
function body(p,extra={},items=[{productId:gummy.id,quantity:1}]){return {action:'checkout',items,submissionKey:randomUUID(),shippingAddress:address,approvedTotal:p.totalTwd,approvedSignature:JSON.stringify(p.items),approvedPurchaseAt:p.purchaseAt,approvedCancelUntil:p.cancelUntil,...extra};}
async function place(extra={},items){return(await call('/api/shop',body(await estimate(extra,items),extra,items),false,201)).order;}
async function pay(o){await call('/api/shop',{action:'payment_reference',id:o.id,reference:'12345'});await call('/api/operations',{action:'payment_state',id:o.id,paid:true},true);}
const member=await signup('exact522@example.test');
// Synthetic fixture price: ceil(17480*.025)=437; fee ceil(437*.08)=35; shipping=50.
await db.prepare("UPDATE products SET price_jpy=17480,commerce_json=json_set(commerce_json,'$.taxIncludedJpy',17480) WHERE id=?").bind(gummy.id).run();
const order=await place();check(order.pricing.totalTwd===522,'Exact NT$522 paid-order fixture');await pay(order);
for(const status of ['refunded','rejected','refund_pending'])await call('/api/operations',{action:'status',id:order.id,status,reason:'Attempt to skip automatic credit'},true,409);
const beforeCancellation=await call('/api/shop');check(beforeCancellation.orders.find(o=>o.id===order.id).status==='paid'&&beforeCancellation.member.spendKrw===17480&&beforeCancellation.creditTwd===0,'Direct refund/rejection statuses cannot bypass cancellation or change the paid balance');
const responses=await Promise.all([1,2,3].map(()=>raw('/api/order-actions',{action:'cancel',id:order.id})));
check(responses.every(r=>[200,409].includes(r.status)),'Concurrent refund requests settle safely');
let state=await call('/api/shop');check(state.creditTwd===522&&state.member.miles===5&&state.member.spendKrw===0,'Exactly 522 credit; only this order rewards reversed');
const refunds=await db.prepare("SELECT COUNT(*) AS n FROM kk_wallet_entries WHERE event_key=?").bind('refund:'+order.id).first();check(refunds.n===1,'Refund creates one ledger entry');
const next=await place();check(next.status==='paid'&&next.pricing.totalTwd===0&&next.pricing.creditAppliedTwd===522,'Next order automatically spends 522 and is paid');
await call('/api/order-actions',{action:'cancel',id:next.id});
const mixed=await place({},[{productId:gummy.id,quantity:2}]);check(mixed.pricing.creditAppliedTwd===522&&mixed.pricing.totalTwd>0,'Mixed cash and credit order');await pay(mixed);
await call('/api/order-actions',{action:'cancel',id:mixed.id});state=await call('/api/shop');check(state.creditTwd===mixed.pricing.beforeCreditTwd,'Mixed cancellation restores credit plus cash once');
// Both administrator cancellation entry points must share atomic reversal.
const beforeAlias=state.creditTwd,alias=await place();
await call('/api/operations',{action:'status',id:alias.id,status:'cancelled',reason:'Administrator cancellation'},true);
await call('/api/operations',{action:'cancel_order',id:alias.id,reason:'Repeated administrator cancellation'},true);
state=await call('/api/shop');const aliasEntries=await db.prepare('SELECT COUNT(*) AS n FROM kk_wallet_entries WHERE event_key=?').bind('refund:'+alias.id).first();
check(state.creditTwd===beforeAlias&&state.member.spendKrw===0&&state.orders.find(o=>o.id===alias.id).status==='cancelled'&&aliasEntries.n===1,'Both admin cancellation routes restore credit and rewards once, including repeated requests');
// Two buyers competing for the last unit cannot both create an order.
await signup('stock@example.test');await db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.stock',1) WHERE id=?").bind(gummy.id).run();
const price=await estimate(),race=await Promise.all([1,2].map(()=>raw('/api/shop',body(price))));
check(race.filter(r=>r.status===201).length===1,'Concurrent last-unit checkouts create exactly one order');
check(Number((await db.prepare("SELECT json_extract(commerce_json,'$.stock') AS n FROM products WHERE id=?").bind(gummy.id).first()).n)===0,'Stock never oversells');
const winner=await race.find(r=>r.status===201).json();await call('/api/order-actions',{action:'cancel',id:winner.order.id});
check(Number((await db.prepare("SELECT json_extract(commerce_json,'$.stock') AS n FROM products WHERE id=?").bind(gummy.id).first()).n)===1,'Cancellation restores the reserved unit');
await db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.stock',-1) WHERE id=?").bind(gummy.id).run().catch(()=>{});
// Explicitly restock finitely; never change a finite stock to unlimited through a reservation.
await db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.stock',100) WHERE id=?").bind(gummy.id).run();
const urgentPrice=await estimate({urgent:true});const urgentRace=await Promise.all(Array.from({length:12},()=>raw('/api/shop',body(urgentPrice,{urgent:true}))));
check(urgentRace.filter(r=>r.status===201).length===10&&urgentRace.filter(r=>r.status===409).length===2,'Twelve concurrent priority checkouts yield ten orders and two rejections');
const urgentOrder=(await urgentRace.find(r=>r.status===201).json()).order;
const stockBeforeAdminCancel=Number((await db.prepare("SELECT json_extract(commerce_json,'$.stock') AS n FROM products WHERE id=?").bind(gummy.id).first()).n);
await call('/api/operations',{action:'status',id:urgentOrder.id,status:'rejected',reason:'No shortcut for unpaid order'},true,409);
check((await call('/api/shop')).urgentRemaining===0&&Number((await db.prepare("SELECT json_extract(commerce_json,'$.stock') AS n FROM products WHERE id=?").bind(gummy.id).first()).n)===stockBeforeAdminCancel,'Blocked rejection leaves unpaid priority reservation and stock unchanged');
await call('/api/operations',{action:'status',id:urgentOrder.id,status:'cancelled',reason:'Cancel unpaid priority order'},true);
await call('/api/operations',{action:'cancel_order',id:urgentOrder.id,reason:'Retry'},true);
const afterAdminCancel=await call('/api/shop');check(afterAdminCancel.urgentRemaining===1&&afterAdminCancel.creditTwd===0&&Number((await db.prepare("SELECT json_extract(commerce_json,'$.stock') AS n FROM products WHERE id=?").bind(gummy.id).first()).n)===stockBeforeAdminCancel+1,'Repeated admin cancellation releases exactly one priority slot and stock unit without unpaid credit');
// Partial purchasing locks cancellation even before the entire order is complete.
const beauty=initial.products.find(p=>p.nameEn.includes('Torriden')&&p.stock!==0&&!p.variants.length);
const partial=await place({},[{productId:gummy.id,quantity:1},{productId:beauty.id,quantity:1}]);await pay(partial);
const signature=JSON.stringify((await db.prepare("SELECT id,status,updated_at FROM shopping_requests WHERE id=?").bind(partial.id).all()).results.map(r=>[r.id,r.status,r.updated_at]));
// Candidate set includes only paid matching orders in this fixture.
await call('/api/operations/ai-command',{mode:'apply',command:{type:'purchased_product',productId:beauty.id,signature}},true);
await call('/api/order-actions',{action:'cancel',id:partial.id},false,409);check(true,'Partially purchased mixed order cannot receive an automatic full refund');
await call('/api/operations',{action:'eta',id:partial.id,eta:'2026-02-30',etaTo:'2026-03-10',reason:'Invalid date QA'},true,400);
await call('/api/operations/ai-command',{mode:'apply',command:{type:'arrival',from:'2026-10-01',to:'2026-10-10',eta:'2026-10-15',etaTo:'2026-10-14'}},true,400);check(true,'Invalid calendar date and reversed pickup ranges are rejected');
// Batch arrival affects existing eligible orders and produces buyer notifications.
const pending=(await db.prepare("SELECT id,status,updated_at FROM shopping_requests WHERE status NOT IN ('cancelled','refunded','rejected','completed') AND received_at IS NULL ORDER BY id").all()).results;
const arrival=await call('/api/operations/ai-command',{mode:'apply',command:{type:'orders_arrival',productId:null,eta:'2026-10-15',etaTo:'2026-10-18',signature:JSON.stringify(pending.map(r=>[r.id,r.status,r.updated_at]))}},true);
check(arrival.updated===pending.length,'Batch arrival updates the exact confirmed existing-order count');
check((await call('/api/shop')).orders.filter(o=>pending.some(p=>p.id===o.id)).every(o=>o.eta==='2026-10-15'&&o.etaTo==='2026-10-18'),'Updated pickup range reaches buyer orders');
// One source of truth: admin product mutation is immediately visible in shop API.
const original=(await call('/api/operations',undefined,true)).products.find(p=>p.id===gummy.id);
await call('/api/operations',{...original,action:'product',originalJpy:18000,nameZh:'同步測試商品',stock:100},true);
check((await call('/api/shop')).products.find(p=>p.id===gummy.id).nameZh==='同步測試商品','Backend admin edit immediately reaches storefront data');
await call('/api/system/status',undefined,false,401);
const status1=await call('/api/system/status',undefined,true),status2=await call('/api/system/status',undefined,true);
check(status1.backendId===status2.backendId&&status1.backendId&&status1.inventoryMigrationReady&&status1.release==='2026-10-01-private-r4','Backend diagnostic identity is stable, migration is present, and anonymous access is blocked');
// Existing bank-refund records can still be reconciled, without claiming new credit.
await signup('legacy-refund@example.test');const legacy=await place();await pay(legacy);
await db.prepare("UPDATE shopping_requests SET status='refund_pending',refund_amount_twd=?,refund_account='synthetic historical bank refund' WHERE id=?").bind(legacy.pricing.totalTwd,legacy.id).run();
await call('/api/operations',{action:'status',id:legacy.id,status:'refunded',reason:'Legacy reconciliation'},true,400);
const pendingLegacy=await call('/api/shop');check(pendingLegacy.orders.find(o=>o.id===legacy.id).status==='refund_pending'&&pendingLegacy.member.spendKrw>0,'Historical bank refund cannot be marked complete without reconciliation evidence');
await call('/api/operations',{action:'status',id:legacy.id,status:'refunded',reason:'Historical payment returned',paymentReference:'synthetic-bank-confirmation'},true);
const closedLegacy=await call('/api/shop');check(closedLegacy.orders.find(o=>o.id===legacy.id).status==='refunded'&&closedLegacy.member.spendKrw===0&&closedLegacy.creditTwd===0,'Historical bank refund reconciles rewards without falsely issuing store credit');
console.log(`${count} regression assertions passed on isolated D1. No live deployment/provider test.`);
}catch(e){console.error(e);process.exitCode=1;}finally{await mf.dispose();}

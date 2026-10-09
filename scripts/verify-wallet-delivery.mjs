import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync(resolve('node_modules/wrangler/package.json'))),{Miniflare}=require('miniflare');
const files=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p));
const password=randomUUID();let cookie='';let count=0;
const mf=new Miniflare({modules:['index.js',...files.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),scriptPath:undefined,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{ADMIN_PASSWORD:password},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
const check=(condition,label)=>{assert.ok(condition,label);console.log(`PASS ${++count}: ${label}`);};
async function call(path,{body,admin=false,member=false,status=200}={}){const headers={'Content-Type':'application/json'};if(admin)headers['X-KK-Admin-Password']=password;if(member)headers.Cookie=cookie;const r=await mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});const data=await r.text();assert.equal(r.status,status,path+' '+data.slice(0,400));return {data:data?JSON.parse(data):null,r};}
try{
const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString(),shopPaused:false})).run();

const initial=(await call('/api/shop')).data;
const gummy=initial.products.find(p=>p.nameEn==='Orion Peelable Grape Gummies 67g');
const beauty=initial.products.find(p=>p.nameEn.includes('Torriden')&&p.stock!==0&&!p.variants.length);
const address={recipient:'Test Buyer',phone:'0912345678',postalCode:'100',street:'台北市測試路 1 號'};
async function signup(email){const v=await call('/api/auth',{body:{action:'signup',email,name:'Flow Buyer',password:'test-only-long-password'},status:201});cookie=v.r.headers.get('set-cookie').split(';')[0];return(await call('/api/shop',{member:true})).data.member;}
const member=await signup('wallet@example.test');
async function estimate(items=[{productId:gummy.id,quantity:2}],extra={}){return(await call('/api/shop',{member:true,body:{action:'estimate',items,...extra}})).data.pricing;}
function orderBody(p,items,extra={}){return{action:'checkout',items,submissionKey:randomUUID(),shippingAddress:address,approvedTotal:p.totalTwd,approvedSignature:JSON.stringify(p.items),approvedPurchaseAt:p.purchaseAt,approvedCancelUntil:p.cancelUntil,...extra};}
async function place(quantity=2,extra={}){const items=[{productId:gummy.id,quantity}],p=await estimate(items,extra);return(await call('/api/shop',{member:true,body:orderBody(p,items,extra),status:201})).data.order;}
async function pay(o){await call('/api/shop',{member:true,body:{action:'payment_reference',id:o.id,reference:'12345'}});await call('/api/operations',{admin:true,body:{action:'payment_state',id:o.id,paid:true}});}
const paid=await place(10);await pay(paid);const earned=(await call('/api/shop',{member:true})).data.member;
check(earned.spendKrw===12000&&earned.miles===7,'Seller-confirmed payment accrues Korean spend and points');
await call('/api/order-actions',{member:true,body:{action:'cancel',id:paid.id}});
let state=(await call('/api/shop',{member:true})).data;
check(state.orders.find(o=>o.id===paid.id).status==='cancelled'&&state.creditTwd===paid.pricing.totalTwd,'Cancellation automatically issues full paid amount as credit and sets cancelled status');
check(state.member.spendKrw===0&&state.member.miles===5&&state.member.paidItems===0,'Cancellation reverses points, spend and paid item count');
check(state.messages.some(m=>m.order_id===paid.id&&m.title.includes('退款申請已通過')),'Refund approval notification is automatic');
await call('/api/order-actions',{member:true,body:{action:'cancel',id:paid.id}});
check((await call('/api/shop',{member:true})).data.creditTwd===paid.pricing.totalTwd,'Repeated cancellation does not duplicate store credit');
const next=await place(1);state=(await call('/api/shop',{member:true})).data;
check(next.pricing.totalTwd===0&&next.status==='paid'&&state.creditTwd===paid.pricing.totalTwd-next.pricing.creditAppliedTwd,'Credit pays next order automatically; leftover balance retained');
await call('/api/order-actions',{member:true,body:{action:'cancel',id:next.id}});
check((await call('/api/shop',{member:true})).data.creditTwd===paid.pricing.totalTwd,'Cancelling credit-only order restores exactly the reserved credit');
const items=[{productId:gummy.id,quantity:20}],racePrice=await estimate(items);
const results=await Promise.all([1,2].map(()=>mf.dispatchFetch('https://adela.test/api/shop',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(orderBody(racePrice,items))})));
check(results.filter(r=>r.status===201).length===1&&results.filter(r=>r.status===409).length===1,'Concurrent checkouts cannot double-spend wallet credit');
// Dedicated second member avoids wallet balance affecting quota tests.
const quota=await signup('quota@example.test');
const qp=await estimate([{productId:gummy.id,quantity:1}],{urgent:true});
check(qp.shippingTwd===80,'Priority delivery is NT$80');
for(let i=0;i<10;i++)await place(1,{urgent:true});
await call('/api/shop',{member:true,status:409,body:orderBody(qp,[{productId:gummy.id,quantity:1}],{urgent:true})});
check((await call('/api/shop',{member:true})).data.urgentRemaining===0,'Eleventh priority order blocked server-side across whole ordering window');
check((await estimate()).shippingTwd===50,'Standard delivery is NT$50');
await db.prepare("UPDATE kk_members SET override_tier='diamond' WHERE id=?").bind(quota.id).run();check((await estimate(undefined,{urgent:true})).shippingTwd===0,'Diamond delivery is free');
await db.prepare("UPDATE kk_members SET override_tier=NULL WHERE id=?").bind(quota.id).run();
const common={title:'Coupon QA',titleEn:'Coupon QA',tiers:['standard','platinum','black','diamond'],rate:8,discountType:'product_fixed',value:10,currency:'TWD',scope:'category',category:gummy.categoryZh,minMerchandiseTwd:100,startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString(),active:true};
for(const [code,visibility] of [['PUBLIC10','public'],['PRIVATE20','private']])await call('/api/operations',{admin:true,body:{...common,action:'offer',code,visibility,value:code==='PUBLIC10'?10:20,totalQuantity:20}});
state=(await call('/api/shop',{member:true})).data;
check(state.wallet.some(o=>o.code==='PUBLIC10')&&!state.wallet.some(o=>o.code==='PRIVATE20')&&!state.offers.some(o=>o.code==='PRIVATE20'),'Public coupons are discoverable; private codes are not leaked');
await call('/api/shop',{member:true,body:{action:'claim_coupon',offerId:state.wallet.find(o=>o.code==='PUBLIC10').id}});
await call('/api/shop',{member:true,body:{action:'claim_coupon',code:'PRIVATE20'}});
await call('/api/shop',{member:true,status:400,body:{action:'estimate',items:[{productId:gummy.id,quantity:1},{productId:beauty.id,quantity:1}],coupons:['PUBLIC10']}});
check(true,'Category minimum excludes expensive items from other categories');
const stacked=await estimate([{productId:gummy.id,quantity:5}],{coupons:['PUBLIC10','PRIVATE20']});check(stacked.discountTwd===30,'Two eligible coupons stack correctly');
const used=await place(5,{coupons:['PUBLIC10','PRIVATE20']});await call('/api/order-actions',{member:true,body:{action:'cancel',id:used.id}});
await call('/api/shop',{member:true,status:400,body:{action:'estimate',items:[{productId:gummy.id,quantity:5}],coupons:['PUBLIC10']}});check(true,'Each coupon remains single-use after cancellation');
await call('/api/operations',{admin:true,body:{...common,action:'offer',code:'PERSONAL',memberId:member.id,permanent:true,visibility:'public',totalQuantity:1}});
check(!(await call('/api/shop',{member:true})).data.wallet.some(o=>o.code==='PERSONAL'),'Member-specific permanent coupon hidden from other users');
// Exercise coupon limits through the real API and verify transactional side effects.
await call('/api/operations',{admin:true,body:{...common,action:'offer',code:'RACEONCE',visibility:'public',totalQuantity:0}});
await call('/api/shop',{member:true,body:{action:'claim_coupon',code:'RACEONCE'}});
const raceItems=[{productId:gummy.id,quantity:5}],couponPrice=await estimate(raceItems,{coupons:['RACEONCE','RACEONCE']});
check(couponPrice.coupons.length===1&&couponPrice.discountTwd===10,'Repeated coupon code in one cart discounts only once');
const beforeOrders=Number((await db.prepare('SELECT COUNT(*) n FROM shopping_requests').first()).n);
const beforeReservations=Number((await db.prepare('SELECT COUNT(*) n FROM kk_stock_reservations').first()).n);
const couponRace=await Promise.all([1,2].map(()=>mf.dispatchFetch('https://adela.test/api/shop',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(orderBody(couponPrice,raceItems,{coupons:['RACEONCE']}))})));
check(couponRace.filter(r=>r.status===201).length===1&&couponRace.every(r=>[201,400,409].includes(r.status)),'Simultaneous checkouts can consume a member coupon only once');
check(Number((await db.prepare('SELECT COUNT(*) n FROM shopping_requests').first()).n)===beforeOrders+1&&Number((await db.prepare('SELECT COUNT(*) n FROM kk_stock_reservations').first()).n)===beforeReservations+1,'Losing coupon checkout leaves no extra order or stock reservation');
await call('/api/operations',{admin:true,body:{...common,action:'offer',code:'EXPIRING',visibility:'public'}});
await call('/api/shop',{member:true,body:{action:'claim_coupon',code:'EXPIRING'}});
const expiryPrice=await estimate(raceItems,{coupons:['EXPIRING']});
await db.prepare("UPDATE kk_offers SET data=json_set(data,'$.endsAt',?) WHERE code='EXPIRING'").bind(new Date(Date.now()-1000).toISOString()).run();
await call('/api/shop',{member:true,status:400,body:orderBody(expiryPrice,raceItems,{coupons:['EXPIRING']})});
const expiredCoupon=(await call('/api/shop',{member:true})).data.wallet.find(o=>o.code==='EXPIRING');
check(expiredCoupon.claimed&&!expiredCoupon.eligible&&!expiredCoupon.used,'Coupon expiring after estimate stays visible but checkout rejects it without consumption');
await call('/api/shop',{member:true,status:400,body:{action:'claim_coupon',code:'EXPIRING'}});
check(true,'Expired coupon cannot be claimed again');
const quotaCookie=cookie;
await signup('coupon-competitor@example.test');const competitorCookie=cookie;cookie=quotaCookie;
await call('/api/operations',{admin:true,body:{...common,action:'offer',code:'ONECLAIM',visibility:'public',totalQuantity:1}});
const claimRace=await Promise.all([quotaCookie,competitorCookie].map(memberCookie=>mf.dispatchFetch('https://adela.test/api/shop',{method:'POST',headers:{'Content-Type':'application/json',Cookie:memberCookie},body:JSON.stringify({action:'claim_coupon',code:'ONECLAIM'})})));
check(claimRace.filter(r=>r.status===200).length===1&&claimRace.filter(r=>r.status===409).length===1,'One remaining coupon across two members can only be claimed once');
const claimWinner=claimRace[0].status===200?quotaCookie:competitorCookie;
const claimAgain=await mf.dispatchFetch('https://adela.test/api/shop',{method:'POST',headers:{'Content-Type':'application/json',Cookie:claimWinner},body:JSON.stringify({action:'claim_coupon',code:'ONECLAIM'})});
check(claimAgain.status===200&&Number((await db.prepare("SELECT COUNT(*) n FROM kk_coupon_claims WHERE offer_id=(SELECT id FROM kk_offers WHERE code='ONECLAIM')").first()).n)===1,'Retrying successful claim at quota is idempotent and does not take another slot');
const proof=await place(1);const form=new FormData();form.set('id',String(proof.id));form.set('image',new File([Uint8Array.from([137,80,78,71,13,10,26,10])],'proof.png',{type:'image/png'}));
const multipart=new Request('https://adela.test/api/payments/report',{method:'POST',body:form});let r=await mf.dispatchFetch(multipart.url,{method:'POST',headers:{Cookie:cookie,'Content-Type':multipart.headers.get('Content-Type')},body:await multipart.arrayBuffer()});assert.equal(r.status,200,await r.text());
await call('/api/operations',{admin:true,body:{action:'payment_state',id:proof.id,paid:true}});
check((await call('/api/shop',{member:true})).data.orders.find(o=>o.id===proof.id).paidAt,'Screenshot-only payment report can be verified by seller');
const photoId=(await db.prepare('SELECT payment_photo_id FROM shopping_requests WHERE id=?').bind(proof.id).first()).payment_photo_id;
r=await mf.dispatchFetch('https://adela.test/api/order-evidence?id='+photoId);check(r.status===401,'Unauthenticated payment screenshot access is rejected');
await db.prepare('UPDATE shopping_requests SET purchase_at=? WHERE id=?').bind(new Date(Date.now()-10000).toISOString(),proof.id).run();
check((await call('/api/shop',{member:true})).data.orders.find(o=>o.id===proof.id).status==='purchasing','Paid order automatically begins purchasing at planned date');
await call('/api/order-actions',{member:true,status:409,body:{action:'cancel',id:proof.id}});check(true,'Purchasing order cannot refund past cutoff');
const expired=await place(1);await db.prepare('UPDATE shopping_requests SET cancel_until=? WHERE id=?').bind(new Date(Date.now()-10000).toISOString(),expired.id).run();await call('/api/order-actions',{member:true,status:409,body:{action:'cancel',id:expired.id}});check(true,'Explicit refund deadline enforced on server');
await call('/api/operations',{admin:true,body:{action:'status',id:proof.id,status:'purchased'}});await call('/api/operations',{admin:true,body:{action:'status',id:proof.id,status:'completed'}});
check(!!(await call('/api/shop',{member:true})).data.orders.find(o=>o.id===proof.id).receivedAt,'Admin can mark collected and resolve order');
console.log('Wallet, delivery, coupon and payment flow checks complete.');
}catch(e){console.error(e);process.exitCode=1;}finally{await mf.dispose();}

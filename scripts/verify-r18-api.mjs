import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const paths=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)),password=randomUUID();
const mf=new Miniflare({modules:['index.js',...paths.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PASSWORD:password},cf:false});
let n=0;const check=(ok,label)=>{assert.ok(ok,label);console.log(`PASS ${++n}: ${label}`)};
async function raw(path,body,user='topup-a',admin=true){return mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(admin?{'X-KK-Admin-Password':password}:{}),'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'},body:body?JSON.stringify(body):undefined});}
async function call(path,body,status=200,user='topup-a',admin=true){const r=await raw(path,body,user,admin),v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;}
try{
 const db=await mf.getD1Database('DB');for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await call('/api/shop',{action:'join',name:'R18 member A'});await call('/api/shop',{action:'join',name:'R18 member B'},200,'topup-b');
 await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({bankAccount:'TEST-NOT-PAYABLE',rateCurrency:'KRW',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString()})).run();
 const id=randomUUID(),one=await call('/api/shop',{action:'create_topup',amount:2000,id,bonus:99999,bonus_twd:99999,coupons:['fake'],useCredit:true});
 check(one.topup.amount_twd===2000&&one.topup.bonus_twd===160,'Server ignores forged bonus, coupons and wallet funding');
 const id2=randomUUID(),two=await call('/api/shop',{action:'create_topup',amount:5000,id:id2});check(two.topup.bonus_twd===600,'5000 grants exactly 600');
 await call('/api/shop',{action:'create_topup',amount:5000,id},409);await call('/api/shop',{action:'create_topup',amount:2000,id},409,'topup-b');check(true,'Cannot reuse id for another amount or member');
 const raceId=randomUUID();await Promise.all([1,2,3,4].map(()=>call('/api/shop',{action:'create_topup',amount:2000,id:raceId})));check((await db.prepare('SELECT count(*) n FROM kk_topups WHERE id=?').bind(raceId).first()).n===1,'Concurrent requests create one top-up');
 const legacyId=randomUUID();await db.prepare("INSERT INTO kk_topups(id,member_id,amount_twd,bonus_twd) VALUES(?,?,2000,200)").bind(legacyId,'siwc:topup-b').run();
 const old=await call('/api/shop',{action:'create_topup',amount:2000,id:legacyId},200,'topup-b');check(old.topup.bonus_twd===200,'Retry preserves old pending bonus 200');
 await call('/api/shop',{action:'report_topup',id:legacyId,reference:'12345'},200,'topup-b');await call('/api/operations',{action:'confirm_topup',id:legacyId,reference:'isolated bank checked'});await call('/api/operations',{action:'confirm_topup',id:legacyId,reference:'repeat'});
 check((await db.prepare("SELECT SUM(amount_twd) n FROM kk_wallet_entries WHERE member_id='siwc:topup-b'").first()).n===2200,'Historical top-up credits its recorded 200 once');
 const before=await db.prepare('SELECT * FROM kk_topups WHERE id=?').bind(legacyId).first();await call('/api/shop',{action:'create_topup',amount:2000,id:randomUUID()},200,'topup-b');const after=await db.prepare('SELECT * FROM kk_topups WHERE id=?').bind(legacyId).first();check(JSON.stringify(before)===JSON.stringify(after),'New policy never rewrites old confirmed row');
 await call('/api/shop');
 const date=new Date().toISOString(),fixture={action:'product',nameZh:'R18 isolated perfume',nameEn:'R18 isolated perfume',categoryZh:'韓國香氛',descriptionZh:'Isolated fixture only',descriptionEn:'Isolated fixture only',nameKo:'',descriptionKo:'',spec:'50mL × 1',taiwanRetailSpec:'50mL × 1',taiwanRetailTwd:1000,taiwanRetailSource:'https://www.momoshop.com.tw/isolated-fixture',taiwanReferenceConfirmed:true,taiwanRetailClassification:'regular',sourceCheckedAt:date,sourceDeliveryConfirmed:true,sourceDeliveryKrw:0,sourceDeliveryConditions:'isolated fixture: no delivery',originalJpy:38000,purchaseUrl:'https://www.ssg.com/isolated-fixture',imageUrl:'https://example.test/fixture.png',stock:-1,sizeFeeTwd:0,serviceFeePercent:0,status:'active',variants:[]};
 const saved=await call('/api/operations',fixture);check(saved.priceReviews[0].ok&&saved.priceReviews[0].evidence.proposedTwd===950,'General save passes exactly 5%');
 for(const [amount,label] of [[951,'less than 5%'],[1000,'same price'],[1100,'higher than Taiwan']]){const r=await call('/api/operations',{...fixture,nameZh:'Blocked '+label,originalJpy:amount/.025},409);check(r.error.includes('上架價格檢查未通過'),'General save blocks '+label);}
 await call('/api/operations',{...fixture,taiwanRetailSource:'',taiwanRetailTwd:0,taiwanReferenceConfirmed:false},409);check(true,'General save rejects missing Taiwan evidence');
 await call('/api/operations',{...fixture,taiwanRetailSpec:'100mL × 1'},409);check(true,'General save rejects spec mismatch');
 await call('/api/operations',{...fixture,sourceDeliveryConfirmed:false},409);check(true,'General save rejects unverified necessary freight');
 const draft=await call('/api/operations',{...fixture,status:'draft',taiwanRetailSource:'',taiwanRetailTwd:0,taiwanReferenceConfirmed:false});check(!draft.priceReviews[0].ok,'Incomplete draft is saved with warning, never approved');
 const p=(await call('/api/operations')).products.find(p=>p.nameZh===fixture.nameZh&&p.status==='active');
 const estimate=await call('/api/shop',{action:'estimate',items:[{productId:p.id,quantity:1}]});check(estimate.pricing.items[0].goodsTwd+estimate.pricing.items[0].feeTwd+estimate.pricing.items[0].sizeFeeTwd===950,'Published price equals checkout line before shipping');
 await db.prepare("INSERT INTO shopping_requests(request_no,customer_name,email,image_key,image_name,image_type,kind,status,member_id,paid_at,pricing_json) VALUES('R18-UNPAID','Fixture','fixture@example.test','','','','catalog','awaiting_payment','siwc:topup-a',NULL,?),('R18-PAID','Fixture','fixture@example.test','','','','catalog','paid','siwc:topup-a',?,?),('R18-CANCELLED','Fixture','fixture@example.test','','','','catalog','cancelled','siwc:topup-a',?,?)").bind(JSON.stringify(estimate.pricing),date,JSON.stringify(estimate.pricing),date,JSON.stringify(estimate.pricing)).run();
 const history=await call('/api/shop');check(history.member.paidOrders===1,'Unpaid and cancelled purchases never increase loyalty frequency');
 await call('/api/shop',{action:'report_topup',id:id2,reference:'12345'});await call('/api/operations',{action:'confirm_topup',id:id2,reference:'isolated bank checked'});
 const notification=await db.prepare("SELECT body FROM kk_messages WHERE member_id='siwc:topup-a' AND title='儲值已入帳' ORDER BY id DESC LIMIT 1").first();check(notification.body.includes('贈送 NT$600'),'In-site top-up confirmation uses saved 600 bonus');
 const preview=randomUUID(),item={...fixture,priceKrw:38000,nameZh:'R18 batch fixture',nameEn:'R18 batch fixture',imageUrl:fixture.imageUrl};await db.prepare("INSERT INTO kk_admin_previews(id,command_json,snapshot_json,expires_at) VALUES(?,?,'{}',?)").bind(preview,JSON.stringify({type:'scan',products:[item]}),new Date(Date.now()+600000).toISOString()).run();
 const count=()=>db.prepare("SELECT count(*) n FROM products WHERE name_zh='R18 batch fixture'").first();
 await call('/api/operations/ai-scan',{mode:'approve',previewId:preview,items:[{index:0,priceKrw:38000,stock:-1,confirmed:true,taiwanRetailTwd:1000,taiwanRetailSource:fixture.taiwanRetailSource}]},400);check((await count()).n===0,'Batch AI cannot bypass source/spec/freight evidence');
 await call('/api/operations/ai-scan',{mode:'approve',previewId:preview,items:[{...fixture,index:0,priceKrw:38000,stock:-1,confirmed:true}]});check((await count()).n===1,'Batch approval uses same valid price check');
 await call('/api/operations/ai-scan',{mode:'approve',previewId:preview,items:[{...fixture,index:0,priceKrw:38000,stock:-1,confirmed:true}]},409);check((await count()).n===1,'Batch approval remains single-use');
 await writeFile('verification/r18-api-results.json',JSON.stringify({checks:n,scope:'Compiled APIs with disposable D1; no production financial writes or real provider calls'},null,2));
}finally{await mf.dispose()}

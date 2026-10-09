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
 await call('/api/shop',{action:'join',name:'Top-up A'});await call('/api/shop',{action:'join',name:'Top-up B'},200,'topup-b');
 await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({bankAccount:'TEST-ACCOUNT',rateCurrency:'KRW',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString()})).run();
 const balance=async()=>Number((await db.prepare("SELECT COALESCE(SUM(amount_twd),0) AS n FROM kk_wallet_entries WHERE member_id='siwc:topup-a'").first()).n);
 const id=randomUUID();await call('/api/shop',{action:'create_topup',amount:2000,id});await call('/api/shop',{action:'create_topup',amount:2000,id});check((await db.prepare('SELECT count(*) AS n FROM kk_topups WHERE id=?').bind(id).first()).n===1,'Repeated request creates one top-up');
 await call('/api/shop',{action:'create_topup',amount:2001,id:randomUUID()},400);await call('/api/operations',{action:'confirm_topup',id,reference:'bank'},409);check(await balance()===0,'Unverified payment cannot credit wallet');
 await call('/api/shop',{action:'report_topup',id,reference:'12345'},409,'topup-b');await call('/api/shop',{action:'report_topup',id,reference:'12345'});await call('/api/operations',{action:'confirm_topup',id,reference:'bank'},401,'topup-a',false);check(await balance()===0,'Member ownership and admin authorization enforced');
 const result=await Promise.all([1,2,3].map(()=>raw('/api/operations',{action:'confirm_topup',id,reference:'verified bank entry'})));check(result.every(r=>[200,409].includes(r.status))&&await balance()===2160,'Concurrent confirmations credit 2000+160 once');
 const id2=randomUUID();await call('/api/shop',{action:'create_topup',amount:5000,id:id2});await call('/api/shop',{action:'report_topup',id:id2,reference:'67890'});
 await db.prepare("CREATE TRIGGER fail_bonus BEFORE INSERT ON kk_wallet_entries WHEN NEW.event_key LIKE 'topup-bonus:%' BEGIN SELECT RAISE(ABORT,'TEST_BONUS_FAILURE'); END").run();const failure=await raw('/api/operations',{action:'confirm_topup',id:id2,reference:'bank checked'});check(failure.status>=400&&await balance()===2160&&(await db.prepare('SELECT status FROM kk_topups WHERE id=?').bind(id2).first()).status==='payment_review','Bonus failure rolls back principal and confirmation atomically');await db.prepare('DROP TRIGGER fail_bonus').run();
 await call('/api/operations',{action:'confirm_topup',id:id2,reference:'bank checked'});check(await balance()===7760,'Retry safely credits 5000+600 once');
 const shop=await call('/api/shop'),other=await call('/api/shop',undefined,200,'topup-b');check(shop.topups.length===2&&other.topups.length===0,'Customers only see their own top-up history');
 const p=await db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) VALUES ('隔離測試','Isolated top-up test','其他','Other','','',16000,'active',?) RETURNING id").bind(JSON.stringify({country:'KR',currency:'KRW',stock:10,variants:[],allowedTiers:['standard','platinum','black','diamond'],taiwanRetailTwd:10000,taiwanRetailCheckedAt:new Date().toISOString().slice(0,10),taiwanRetailSource:'https://www.momoshop.com.tw/isolated-test',purchaseUrl:'https://example.test/fixture',sizeFeeTwd:0})).first();
 const pricing=(await call('/api/shop',{action:'estimate',items:[{productId:p.id,quantity:1}]})).pricing;check(pricing.shippingTwd===50&&pricing.creditAppliedTwd===pricing.beforeCreditTwd&&pricing.totalTwd===0,'Top-up credit covers merchandise, service fee AND shipping');
 await writeFile('verification/topups-results.json',JSON.stringify({checks:n,scope:'Compiled APIs and disposable D1 only; no real money, phone push or browser QA'},null,2));
}finally{await mf.dispose()}

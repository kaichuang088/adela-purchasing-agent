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

 // R17: refunds are append-only reversals and never touch principal or another member.
 const memberA='siwc:topup-a',memberB='siwc:topup-b';
 const entry=async(key,member,amount)=>db.prepare('INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) VALUES (?,?,?, ?,?)').bind(key,member,'TEST-ORDER',amount,'isolated R17 fixture').run();
 await entry('refund:r17-a',memberA,1000);
 await call('/api/operations',{action:'revoke_refund_credit',memberId:memberA,key:'refund:r17-a',reason:'test'},401,'topup-a',false);
 await call('/api/operations',{action:'revoke_refund_credit',memberId:memberB,key:'refund:r17-a',reason:'test'},404);
 await call('/api/operations',{action:'revoke_refund_credit',memberId:memberA,key:'topup:'+id,reason:'test'},404);
 check(await balance()===8760,'Refund cancellation requires admin, exact member, and refund key; top-up principal protected');
 await call('/api/operations',{action:'revoke_refund_credit',memberId:memberA,key:'refund:r17-a',reason:'user requested cancellation'});
 await call('/api/operations',{action:'revoke_refund_credit',memberId:memberA,key:'refund:r17-a',reason:'repeat'});
 check(await balance()===7760,'Refund reversal cancels only 1000 and repeated click cannot double debit');
 await entry('refund:r17-partial',memberB,1000);await entry('checkout:r17-partial',memberB,-600);await entry('topup:r17-protected',memberB,2000);
 await call('/api/operations',{action:'revoke_refund_credit',memberId:memberB,key:'refund:r17-partial',reason:'cancel unused remainder'});
 const bBalance=Number((await db.prepare('SELECT SUM(amount_twd) n FROM kk_wallet_entries WHERE member_id=?').bind(memberB).first()).n);
 check(bBalance===2000&&(await db.prepare("SELECT amount_twd FROM kk_wallet_entries WHERE event_key='revoke-credit:refund:r17-partial'").first()).amount_twd===-400,'Partial refund cancels unused 400; spent 600 and later 2000 principal protected');
 await entry('refund:r17-spent',memberB,500);await entry('checkout:r17-spent',memberB,-2500);
 await call('/api/operations',{action:'revoke_refund_credit',memberId:memberB,key:'refund:r17-spent',reason:'already spent'},409);
 check(Number((await db.prepare('SELECT SUM(amount_twd) n FROM kk_wallet_entries WHERE member_id=?').bind(memberB).first()).n)===0,'Fully spent refund cannot be cancelled or make balance negative');
 await entry('refund:r17-race',memberB,1000);
 const race=await Promise.all([1,2,3].map(()=>raw('/api/operations',{action:'revoke_refund_credit',memberId:memberB,key:'refund:r17-race',reason:'simultaneous click'})));
 check(race.every(r=>[200,409].includes(r.status))&&(await db.prepare("SELECT COUNT(*) n FROM kk_wallet_entries WHERE event_key='revoke-credit:refund:r17-race'").first()).n===1,'Concurrent refund cancellation appends one reversal');
 const cfg=JSON.parse((await db.prepare("SELECT value FROM store_settings WHERE key='commerce_settings'").first()).value);
 const pause=async(shopPaused,photoQuotesPaused)=>db.prepare("UPDATE store_settings SET value=? WHERE key='commerce_settings'").bind(JSON.stringify({...cfg,shopPaused,photoQuotesPaused})).run();
 const photo=async()=>{const req=new Request('https://test',{method:'POST',body:new FormData()});return mf.dispatchFetch('https://adela.test/api/photo-quotes',{method:'POST',headers:{'oai-authenticated-user-id':'topup-a','oai-authenticated-user-email':'topup-a@example.test','Content-Type':req.headers.get('content-type')},body:new Uint8Array(await req.arrayBuffer())});};
 await pause(true,false);
 const photoOpen=await (await photo()).json();
 check(!photoOpen.error.includes('照片查價目前暫停')&&photoOpen.error.includes('AI 查價尚未啟用'),'Order pause allows photo quote service to proceed independently');
 await call('/api/shop',{action:'create_topup',amount:2000,id:randomUUID()},409);
 await pause(false,true);
 check((await (await photo()).json()).error.includes('照片查價目前暫停'),'Photo pause independently blocks photo upload');
 await call('/api/shop',{action:'estimate',items:[{productId:p.id,quantity:1}]});
 check((await call('/api/shop')).photoQuotesPaused===true,'Photo pause leaves catalog orders open and exposes separate state');
 await pause(false,false);
 const live=await call('/api/shop'),intros=JSON.parse(await readFile('lib/catalog-r17-introductions.json','utf8'));
 const publicProducts=live.products.filter(p=>p.status==='active');
 check(Object.keys(intros).length===103&&publicProducts.filter(p=>intros[p.nameEn]).length===103&&publicProducts.filter(p=>intros[p.nameEn]).every(p=>p.descriptionZh===intros[p.nameEn].zh&&p.descriptionEn===intros[p.nameEn].en&&p.descriptionKo===intros[p.nameEn].ko),'All 103 mapped product introductions persisted in three languages');
 check(Object.values(intros).every(v=>Object.values(v).every(text=>text.trim()&&!/₩|NT\$|待確認|正價|比價|採買批次/.test(text))),'Product introductions contain no sourcing or pricing instructions');
 const coffee=live.products.find(p=>p.nameEn==="I'MINT Coffee Candy 32g · Choose a flavor");
 for(const variantId of ['coffee-0','coffee-1']){
  const v=coffee.variants.find(v=>v.id===variantId),oldRate=JSON.parse((await db.prepare("SELECT value FROM store_settings WHERE key='commerce_settings'").first()).value);
  await db.prepare("UPDATE store_settings SET value=? WHERE key='commerce_settings'").bind(JSON.stringify({...oldRate,manualRate:.023753})).run();
  const price=(await call('/api/shop',{action:'estimate',items:[{productId:coffee.id,variantId,quantity:1}]})).pricing;
  check(v.priceJpy===4738&&v.acquisitionPack.totalKrw===37900&&v.acquisitionPack.units===8&&price.items[0].goodsTwd===113&&price.items[0].feeTwd<=10&&price.items[0].acquisitionPack.totalKrw===37900,variantId+' uses full 34900+3000 / 8 cost, snapshots pack and remains within 123 ceiling');
 }
 check(coffee.variants.find(v=>v.id==='coffee-2').priceJpy===6767,'Unverified Matcha cost unchanged');
 const before=coffee.descriptionZh;
 await db.prepare('UPDATE products SET description_zh=? WHERE id=?').bind('管理員後續修改',coffee.id).run();await call('/api/shop');
 check((await db.prepare('SELECT description_zh FROM products WHERE id=?').bind(coffee.id).first()).description_zh==='管理員後續修改','One-time content migration does not overwrite later admin edits');

 await writeFile('verification/r17-api-results.json',JSON.stringify({checks:n,scope:'Compiled APIs and disposable D1 only; no real money, phone push or browser QA'},null,2));
}finally{await mf.dispose()}

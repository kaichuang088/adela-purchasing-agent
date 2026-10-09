// API fixtures use a disposable database; never send fixture identity to the live site.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const paths=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)),password=randomUUID();
const mf=new Miniflare({modules:['index.js',...paths.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PASSWORD:password},cf:false,outboundService:async()=>new Response('Fixture outbound disabled',{status:503})});
let n=0;const check=(ok,label)=>{assert.ok(ok,label);console.log(`PASS ${++n}: ${label}`)};
async function call(path,body,status=200){const r=await mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-KK-Admin-Password':password,'oai-authenticated-user-id':'r14-fixture','oai-authenticated-user-email':'fixture@example.test'},body:body?JSON.stringify(body):undefined}),v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;}
await mkdir('work',{recursive:true});
require('esbuild').buildSync({stdin:{contents:"export {catalogDisplayPrice} from './lib/catalog-display-price';export {validTaiwanReferenceUrl} from './lib/market-price';export {OrderItemStatusList} from './app/order-item-status-list';",resolveDir:resolve('.')},outfile:'work/r14-price-and-status.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {catalogDisplayPrice,validTaiwanReferenceUrl,OrderItemStatusList}=await import('../work/r14-price-and-status.mjs');
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
try{
 const db=await mf.getD1Database('DB');
 for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await call('/api/shop',{action:'join',name:'R14 Fixture'});
 await call('/api/shop'); // Initializes the historical migrations in this disposable database.
 const settings={rateCurrency:'KRW',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString()};
 await db.prepare("UPDATE store_settings SET value=? WHERE key='commerce_settings'").bind(JSON.stringify(settings)).run();
 const baseline=JSON.parse(await readFile('verification/r14-source-baseline.json','utf8')).products;
 for(const p of baseline){await db.prepare('UPDATE products SET name_zh=?,price_jpy=?,status=?,commerce_json=? WHERE name_en=?').bind(p.nameZh,p.taxIncludedJpy,p.status,JSON.stringify({...p,taxIncludedJpy:p.taxIncludedJpy}),p.nameEn).run();}
 const legacyPricing=JSON.stringify({items:[{nameZh:'Historical',quantity:1,goodsTwd:123,feeTwd:7,sizeFeeTwd:0}],totalTwd:180});
 await db.prepare("INSERT INTO shopping_requests(request_no,customer_name,email,image_key,image_name,image_type,kind,status,pricing_json) VALUES('R14-HISTORY','Fixture','fixture@example.test','','','','catalog','completed',?)").bind(legacyPricing).run();
 await db.prepare("DELETE FROM store_settings WHERE key IN ('adela_catalog_ready_r14','adela_catalog_r14_cost_plus_20261008')").run();
 const shop=await call('/api/shop'),patches=JSON.parse(await readFile('lib/catalog-r14-verified.json','utf8'));
 const missing=patches.filter(p=>!shop.products.some(x=>x.nameEn===p.nameEn&&x.priceJpy===p.priceKrw));
 check(missing.length===0,'All 46 verified product updates migrate by canonical product identity: '+JSON.stringify(missing.map(p=>p.match)));
 check(shop.products.every(p=>p.status==='active'&&p.priceJpy>1),'Storefront includes only priced approved products; unverified screenshot records are retained in admin');
 const ops=await call('/api/operations');check(ops.products.some(p=>p.nameEn==='Hello Kitty Lip Collection reference'&&p.status==='research'),'Unidentified original screenshot record remains preserved in admin');
 check((await db.prepare("SELECT pricing_json FROM shopping_requests WHERE request_no='R14-HISTORY'").first()).pricing_json===legacyPricing,'Catalog migration leaves historical order snapshots unchanged');
 const sold=shop.products.filter(p=>p.stock===0);check(sold.some(p=>p.nameEn.startsWith('Isntree'))&&sold.some(p=>p.nameEn.startsWith('Orion Turtle Chips Matcha')),'Actual supplier-sold-out items remain clearly unavailable');
 const khaki=shop.products.find(p=>p.nameEn==='Stüssy Basic Tee Khaki');check(khaki.variants.filter(v=>v.stock!==0).length===1&&khaki.variants.find(v=>v.stock!==0).labelEn==='XL','Only genuinely available Khaki XL can be selected');
 const input={nameZh:'成本測試',nameEn:'Cost fixture',categoryZh:'香水與香氛',categoryEn:'Fragrance',originalJpy:240000,stock:10,sizeFeeTwd:0,status:'active',imageUrl:'https://example.test/item.jpg',purchaseUrl:'https://example.test/item',taiwanRetailTwd:0,taiwanRetailSource:'',allowedTiers:['standard','platinum','black','diamond'],variants:[]};
 await call('/api/operations',{action:'product',...input});
 const fixture=(await call('/api/shop')).products.find(p=>p.nameEn==='Cost fixture');assert.ok(fixture);
 const prices=[];
 for(const tier of ['standard','platinum','black','diamond']){
  await db.prepare("UPDATE kk_members SET override_tier=? WHERE id='siwc:r14-fixture'").bind(tier).run();
  const pricing=(await call('/api/shop',{action:'estimate',items:[{productId:fixture.id,quantity:1}]})).pricing;
  const price=pricing.goodsTwd+pricing.feeTwd+pricing.sizeFeeTwd;prices.push(price);
  check(price===catalogDisplayPrice(fixture,{exchangeRate:.025,tier}).amount,'Missing Taiwan reference allows checkout and matches display for '+tier);
 }
 check(JSON.stringify(prices)===JSON.stringify([6300,6188,6113,6000]),'Actual NT$6000 cost has flexible and distinct membership prices');
 await db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.taiwanRetailTwd',5000,'$.taiwanRetailSource','https://www.momoshop.com.tw/fixture','$.salePriceTwd',4000) WHERE id=?").bind(fixture.id).run();
 await db.prepare("UPDATE kk_members SET override_tier='standard' WHERE id='siwc:r14-fixture'").run();
 const above=(await call('/api/shop',{action:'estimate',items:[{productId:fixture.id,quantity:1}]})).pricing;
 check(above.goodsTwd===6000&&above.feeTwd===300,'Lower Taiwan price and obsolete below-cost target do not force a loss or erase member fees');
 await call('/api/operations',{action:'product',...input,id:fixture.id,taiwanRetailTwd:6000,taiwanRetailSource:'https://shopee.tw/fixture'},400);
 check(!validTaiwanReferenceUrl('https://shopee.tw/fixture'),'Shopee Taiwan references remain rejected');
 await call('/api/shop',{action:'estimate',items:[{productId:khaki.id,variantId:khaki.variants.find(v=>v.stock===0).id,quantity:1}]},409);
 check(true,'Unavailable size cannot be ordered through the API');
 const pricing=JSON.stringify({...above,purchaseAt:'2026-11-01T01:00:00Z'});
 for(const [no,method,paid,status] of [['R14-PAID','transfer','2026-10-07T00:00:00Z','paid'],['R14-UNPAID','transfer',null,'payment_review'],['R14-COD','cod',null,'awaiting_cod']])await db.prepare("INSERT INTO shopping_requests(request_no,customer_name,email,image_key,image_name,image_type,kind,status,pricing_json,paid_at,payment_method,purchase_at) VALUES(?,'Fixture','fixture@example.test','','','','catalog',?,?,?,?, '2026-11-01T01:00:00Z')").bind(no,status,pricing,paid,method).run();
 const procurement=(await call('/api/operations')).procurement;
 check(procurement.some(g=>g.orders.some(o=>o.requestNo==='R14-PAID'))&&!procurement.some(g=>g.orders.some(o=>['R14-COD','R14-UNPAID'].includes(o.requestNo))),'Procurement includes confirmed payments and excludes unpaid transfer/COD');
 const html=renderToStaticMarkup(React.createElement(OrderItemStatusList,{order:{status:'purchasing',paidAt:'2026-10-07T00:00:00Z',paymentMethod:'transfer',itemFulfilment:[{lineIndex:0,line:{nameZh:'已買到葡萄',quantity:2,imageUrl:'/grape.jpg'},status:'purchased'},{lineIndex:1,line:{nameZh:'下一批奇異果',quantity:1},status:'deferred'},{lineIndex:2,line:{nameZh:'尚未買到',quantity:1},status:'pending'}]}}));
 check(html.includes('已買到')&&html.includes('已接受延期')&&html.includes('採買中・系統自動')&&html.includes('/grape.jpg'),'My orders renders distinct item progress and its real order photo');
 const preserve=patches[0];await db.prepare("UPDATE products SET price_jpy=price_jpy+1,commerce_json=json_set(commerce_json,'$.stock',7) WHERE name_en=?").bind(preserve.nameEn).run();
 await db.prepare("DELETE FROM store_settings WHERE key IN ('adela_catalog_ready_r14','adela_catalog_r14_cost_plus_20261008')").run();await call('/api/shop');
 const after=await db.prepare('SELECT price_jpy,commerce_json FROM products WHERE name_en=?').bind(preserve.nameEn).first();check(after.price_jpy===preserve.priceKrw+1&&JSON.parse(after.commerce_json).stock===7,'Repeated migration preserves later seller price and counted-stock edits');
 const dispositions=JSON.parse(await readFile('lib/catalog-r14-dispositions.json','utf8'));
 await writeFile('verification/r14-cost-plus-results.json',JSON.stringify({checks:n,verifiedCatalogUpdates:patches.length,memberPrices:prices,baselineProducts:baseline.length,publishedProducts:shop.products.length,purchasableProducts:shop.products.filter(p=>p.stock!==0&&(!p.variants.length||p.variants.some(v=>v.stock!==0))).length,supplierSoldOutProducts:sold.map(p=>p.nameEn),researchRecords:ops.products.filter(p=>p.status==='research').map(p=>p.nameEn),dispositions,scope:'Compiled API/disposable D1 and component HTML only; no live purchases, browser screenshots, AI provider or phone notifications tested'},null,2));
}finally{await mf.dispose()}

import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync(resolve('node_modules/wrangler/package.json'))),{Miniflare}=require('miniflare');
const files=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p));
const {buildSync}=require('esbuild');
await mkdir('work',{recursive:true});
buildSync({entryPoints:['lib/product-collections.ts','lib/product-search.ts','lib/catalog-display-price.ts'],outdir:'work/catalog-check',bundle:true,platform:'node',format:'esm'});
buildSync({entryPoints:['app/admin/product-image-field.tsx'],outfile:'work/product-image-field.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
buildSync({entryPoints:['app/product-price.tsx','app/payment-report.tsx'],outdir:'work/price-payment-check',bundle:true,platform:'node',format:'esm',packages:'external'});
const {ProductPrice}=await import('../work/price-payment-check/product-price.js');
const {PaymentReport}=await import('../work/price-payment-check/payment-report.js');
const {catalogDisplayPrice}=await import('../work/catalog-check/catalog-display-price.js');
const {ProductImageField}=await import('../work/product-image-field.mjs');
const {inCollection,isOliveYoung}=await import('../work/catalog-check/product-collections.js');
const {searchProducts}=await import('../work/catalog-check/product-search.js');
const password=randomUUID();let cookie='';let count=0;
const mf=new Miniflare({modules:['index.js',...files.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),scriptPath:undefined,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{ADMIN_PASSWORD:password},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
const check=(condition,label)=>{assert.ok(condition,label);console.log(`PASS ${++count}: ${label}`);};
async function call(path,{body,admin=false,member=false,status=200}={}){const headers={'Content-Type':'application/json'};if(admin)headers['X-KK-Admin-Password']=password;if(member)headers.Cookie=cookie;const r=await mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});const data=await r.text();assert.equal(r.status,status,path+' '+data.slice(0,400));return {data:data?JSON.parse(data):null,r};}
try{
const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString(),shopPaused:false})).run();
const initial=(await call('/api/shop')).data,curated=JSON.parse(await readFile('lib/curated-catalog.json','utf8'));
const expanded=JSON.parse(await readFile('lib/expanded-catalog.json','utf8'));
const recovery=JSON.parse(await readFile('lib/expanded-catalog-20260930.json','utf8')),references=JSON.parse(await readFile('lib/taiwan-price-evidence-20260930.json','utf8'));
check(initial.products.length===50+expanded.length+recovery.filter(p=>p.status==='active').length,'All baseline and expanded records are visible with no duplicate new records');
const koCopy=[...JSON.parse(await readFile('lib/korean-product-descriptions.json','utf8')),...recovery];
for(const p of initial.products){const expected=koCopy.find(k=>k.nameEn===p.nameEn);assert.ok(expected,p.nameEn);assert.equal(p.descriptionKo,expected.descriptionKo);assert.match(p.descriptionKo,/[가-힣]/u);}
check(true,'All currently listed seeded products expose the reviewed Korean description through the compiled API');
const koProduct=initial.products[0];
await call('/api/operations',{admin:true,body:{...koProduct,action:'product',originalJpy:koProduct.priceJpy,nameKo:'판매자 수정 이름',descriptionKo:'판매자가 직접 작성한 설명입니다.'}});
let koEdited=(await call('/api/shop')).data.products.find(p=>p.id===koProduct.id);
check(koEdited.nameKo==='판매자 수정 이름'&&koEdited.descriptionKo==='판매자가 직접 작성한 설명입니다.','Administrator Korean name and description edits round-trip to the buyer API');
await db.prepare("DELETE FROM store_settings WHERE key='adela_korean_descriptions_20260929'").run();
koEdited=(await call('/api/shop')).data.products.find(p=>p.id===koProduct.id);
check(koEdited.descriptionKo==='판매자가 직접 작성한 설명입니다.','Reinitialization preserves seller-authored Korean descriptions');
const {descriptionKo:omittedKo,nameKo:omittedName,...legacyEdit}=koEdited;
await call('/api/operations',{admin:true,body:{...legacyEdit,action:'product',originalJpy:koEdited.priceJpy}});
koEdited=(await call('/api/shop')).data.products.find(p=>p.id===koProduct.id);
check(koEdited.descriptionKo==='판매자가 직접 작성한 설명입니다.'&&koEdited.nameKo==='판매자 수정 이름','Older editor payloads cannot erase Korean content by omitting it');
await db.prepare("UPDATE products SET description_en='Seller changed the specification',commerce_json=json_set(commerce_json,'$.descriptionKo','') WHERE id=?").bind(koProduct.id).run();
await db.prepare("DELETE FROM store_settings WHERE key='adela_korean_descriptions_20260929'").run();
koEdited=(await call('/api/shop')).data.products.find(p=>p.id===koProduct.id);
check(koEdited.descriptionKo==='','Seed translation is not applied when the seller has changed the source description');
await call('/api/operations',{admin:true,body:{...koProduct,action:'product',originalJpy:koProduct.priceJpy,descriptionKo:'가'.repeat(1300)}});
koEdited=(await call('/api/shop')).data.products.find(p=>p.id===koProduct.id);
check(koEdited.descriptionKo.length===1200,'Korean descriptions obey the same server-side length limit as other languages');
await call('/api/operations',{admin:true,body:{...koProduct,action:'product',originalJpy:koProduct.priceJpy}});

for(const expected of expanded){const matches=initial.products.filter(p=>p.nameEn===expected.nameEn);assert.equal(matches.length,1,expected.nameEn);const p=matches[0];for(const [actual,want] of [[p.priceJpy,expected.price],[p.imageUrl,expected.image],[p.brand,expected.brand],[p.spec,expected.spec],[p.nameKo,expected.nameKo],[p.taiwanRetailTwd,references.find(r=>r.catalogSourceId===expected.id)?.priceTwd||expected.retailTwd],[p.purchaseUrl,expected.url]])assert.equal(actual,want,expected.nameEn);const asset=await mf.dispatchFetch('https://adela.test'+p.imageUrl);assert.equal(asset.status,200,p.imageUrl);assert.match(asset.headers.get('content-type'),/^image\//);assert.ok((await asset.arrayBuffer()).byteLength>1000);}
check(true,'Every added SKU reaches API with exact price, size, brand, Korean name, sources and a loadable local image');
for(const [brand,min] of [['Le Labo',10],['Byredo',8],['Diptyque',5]])check(initial.products.filter(p=>p.nameEn.toLowerCase().startsWith(brand.toLowerCase())).length>=min,brand+' has expanded perfume and non-perfume coverage');
check(expanded.filter(p=>p.retailer==='Olive Young').length>=12,'At least 12 exact-spec Olive Young additions are present');
check(initial.products.filter(p=>inCollection(p,'Stussy')).length===8,'Stüssy and Stussy spellings group all four old and four new records together');
check(searchProducts(initial.products,'Stussy').length===8&&searchProducts(initial.products,'Stüssy').length===8,'Both Stussy spellings find all eight products');
const olive=initial.products.filter(p=>inCollection(p,'Olive Young'));check(olive.length>=12&&olive.every(isOliveYoung),'Olive Young collection includes only products sourced from that retailer');
check(searchProducts(initial.products,'Olive Young').length>=12,'Olive Young search finds the new products');
check(searchProducts(initial.products,'Le Labo').length>=10,'Le Labo search finds all added scents and body care');
check(searchProducts(initial.products,'어나더').some(p=>p.nameEn.includes('ANOTHER 13')),'Korean product search finds ANOTHER 13');
check(!inCollection({...initial.products[0],purchaseUrl:'https://oliveyoung.co.kr.attacker.test/item'},'Olive Young'),'Unrelated lookalike retailer domains are excluded');
check(initial.products.length>=49,'At least 49 catalog records visible in isolated API');
for(const expected of curated){const p=initial.products.find(p=>p.nameEn===expected.nameEn);assert.ok(p,expected.nameEn);assert.equal(p.priceJpy,expected.price);assert.equal(p.imageUrl,expected.image);assert.equal(p.nameKo,expected.nameKo);assert.equal(p.currency,'KRW');assert.equal(p.country,'KR');}
check(true,'Curated records reach the shop API unchanged (does not verify live source prices/images)');
for(const flavor of ['Espresso','Americano','Matcha Latte']) assert.ok(initial.products.some(p=>p.nameEn===`I'MINT ${flavor} Coffee Candy 32g`),flavor+' single box');
check(true,'All three coffee flavors each have a separate single-box record');
check(initial.products.every(p=>p.nameKo?.trim()),'All visible catalog products have Korean display names (not full UI translation)');
const again=(await call('/api/shop')).data;check(again.products.length===initial.products.length,'Catalog initialization is idempotent');
await call('/api/operations',{status:401});check(true,'Admin data requires authentication');
const signup=await call('/api/auth',{body:{action:'signup',email:'release@example.test',name:'Release Buyer',password:'test-pass-only-2026'},status:201});cookie=signup.r.headers.get('set-cookie').split(';')[0];
check((await call('/api/shop',{member:true})).data.member.email==='release@example.test','Member remains signed in through session cookie');
for(const expected of expanded.filter(p=>p.stock!==0)){const p=initial.products.find(p=>p.nameEn===expected.nameEn);const quote=(await call('/api/shop',{member:true,body:{action:'estimate',items:[{productId:p.id,quantity:1,variantId:p.variants[0]?.id}]}})).data.pricing;assert.equal(quote.items[0].sourceAmount,expected.price);assert.equal(quote.goodsTwd,Math.ceil(expected.price*.025));}
check(true,'Every available added SKU can be quoted with a selected option and correct rounded TWD amount');
const fashion=expanded.filter(p=>p.category==='fashion');
for(const expected of fashion){const p=initial.products.find(p=>p.nameEn===expected.nameEn);assert.equal(p.categoryEn,'Korean streetwear');assert.deepEqual(p.variants.map(v=>v.labelEn),expected.sizes);assert.equal(p.stock,expected.stock);}
check(fashion.length===8,'Eight new fashion records expose verified sizes, category and sold-out state');
check(fashion.filter(p=>p.brand==='Stussy').every(p=>inCollection(initial.products.find(q=>q.nameEn===p.nameEn),'Stussy')),'New Stüssy records join the existing Stussy brand collection');
for(const expected of fashion.filter(p=>p.sizes.length)){const p=initial.products.find(p=>p.nameEn===expected.nameEn);await call('/api/shop',{member:true,status:400,body:{action:'estimate',items:[{productId:p.id,quantity:1}]}});await call('/api/shop',{member:true,status:400,body:{action:'estimate',items:[{productId:p.id,quantity:1,variantId:'unavailable-size'}]}});}
check(true,'Fashion with size options rejects missing or unavailable sizes');
const soldFashion=initial.products.find(p=>p.nameEn==='Mardi Mercredi CAP M Navy White');await call('/api/shop',{member:true,status:400,body:{action:'estimate',items:[{productId:soldFashion.id,quantity:1}]}});
check(true,'New sold-out cap cannot be quoted or ordered');
const evidence=JSON.parse(await readFile('lib/taiwan-price-evidence.json','utf8'));
for(const e of evidence){const p=initial.products.find(p=>p.nameEn===e.nameEn);assert.equal(p.taiwanRetailTwd,e.priceTwd);assert.equal(p.taiwanRetailSource,e.url);assert.equal(p.taiwanRetailCheckedAt,e.checkedAt);}
check(true,'Verified Taiwan price, matching specification and check date reach the shop API');
const refProduct=initial.products.find(p=>p.nameEn===evidence[0].nameEn);
await db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.taiwanRetailTwd',0,'$.taiwanRetailSource','') WHERE id=?").bind(refProduct.id).run();
await db.prepare("DELETE FROM store_settings WHERE key='adela_taiwan_prices_20260929_v3'").run();
let ref=(await call('/api/shop')).data.products.find(p=>p.id===refProduct.id);
check(ref.taiwanRetailTwd===evidence[0].priceTwd,'Existing catalog receives missing reference prices without a fresh database');
await call('/api/operations',{admin:true,body:{...ref,action:'product',originalJpy:ref.priceJpy,taiwanRetailTwd:1900,taiwanRetailSource:'https://example.test/seller-reference'}});
await db.prepare("DELETE FROM store_settings WHERE key='adela_taiwan_prices_20260929_v3'").run();
ref=(await call('/api/shop')).data.products.find(p=>p.id===refProduct.id);
check(ref.taiwanRetailTwd===1900&&ref.taiwanRetailSource==='https://example.test/seller-reference'&&!ref.taiwanRetailCheckedAt,'Seller reference changes survive migration and clear the earlier check date');

for(const product of expanded){const html=renderToStaticMarkup(React.createElement(ProductImageField,{imageUrl:product.image,onChange:()=>{throw new Error('Rendering must not mutate the image');}}));assert.match(html,/<input[^>]*type="url"[^>]*value=""/);assert.ok(!html.includes(product.image));assert.ok(html.includes('目前使用已收錄'));}
check(true,'All bundled product photos render an optional empty URL field, preserving the stored image without native URL mismatch');
const externalHtml=renderToStaticMarkup(React.createElement(ProductImageField,{imageUrl:'https://retailer.example.test/item.png',onChange:()=>{}}));check(externalHtml.includes('value="https://retailer.example.test/item.png"'),'External image URL remains visible and editable in the seller form');
const emptyHtml=renderToStaticMarkup(React.createElement(ProductImageField,{imageUrl:'',onChange:()=>{}}));check(emptyHtml.includes('value=""')&&!emptyHtml.includes('目前使用已收錄'),'New products show no false claim that a bundled photo exists');
const editable=initial.products.find(p=>p.nameEn===expanded[0].nameEn);
const editBody={...editable,action:'product',originalJpy:editable.priceJpy+1000};
await call('/api/operations',{admin:true,body:editBody});
const edited=(await call('/api/shop')).data.products.find(p=>p.id===editable.id);
check(edited.priceJpy===editBody.originalJpy&&edited.imageUrl===editable.imageUrl&&edited.brand===editable.brand,'Seller can edit a seeded product while preserving its bundled photo and brand');
for(const imageUrl of ['/catalog-20260927/../secret.png','//attacker.test/p.png','/api/order-evidence?id=private','/catalog-20260927/a.svg'])await call('/api/operations',{admin:true,status:400,body:{...editBody,imageUrl}});
check(true,'Product image validation rejects traversal, external protocol-relative URLs and private endpoints');
await call('/api/operations',{admin:true,body:{...editBody,originalJpy:editable.priceJpy}});
const gummy=initial.products.find(p=>p.nameEn==='Orion Peelable Grape Gummies 67g');
const beforeFixture=await db.prepare('SELECT commerce_json,price_jpy FROM products WHERE id=?').bind(gummy.id).first();
const options=[{id:'small',labelZh:'小包',labelEn:'Small',priceJpy:481},{id:'large',labelZh:'大包',labelEn:'Large',priceJpy:960}];
await db.prepare("UPDATE products SET price_jpy=481,commerce_json=json_set(commerce_json,'$.taxIncludedJpy',481,'$.variants',json(?)) WHERE id=?").bind(JSON.stringify(options),gummy.id).run();
let view=(await call('/api/shop',{member:true})).data,fixture=view.products.find(p=>p.id===gummy.id);
for(const variantId of ['small','large']){const quote=(await call('/api/shop',{member:true,body:{action:'estimate',items:[{productId:gummy.id,variantId,quantity:1}]}})).data.pricing;const shown=catalogDisplayPrice(fixture,{variantId,exchangeRate:.025,tier:'standard',fees:view.fees,offers:view.offers});assert.equal(shown.amount,quote.goodsTwd+quote.feeTwd+quote.sizeFeeTwd);}
check(catalogDisplayPrice(fixture,{variantId:'small',exchangeRate:.025}).amount===15,'Display price matches actual API rounding for both selected variants, including the old one-dollar mismatch');
check(catalogDisplayPrice(fixture,{variantId:'large'}).amount===960,'Without an exchange rate, detail uses the selected variant KRW price');
const automatic={title:'Fixture auto fee',titleEn:'Fixture auto fee',code:'',tiers:['standard'],rate:0,discountType:'fee_rate',scope:'all',minMerchandiseTwd:20,startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()};
const fixtureOffer=await db.prepare('INSERT INTO kk_offers(code,data,active) VALUES(?,?,1) RETURNING id').bind('',JSON.stringify(automatic)).first();
view=(await call('/api/shop',{member:true})).data;
for(const variantId of ['small','large']){const quote=(await call('/api/shop',{member:true,body:{action:'estimate',items:[{productId:gummy.id,variantId,quantity:1}]}})).data.pricing;assert.equal(catalogDisplayPrice(fixture,{variantId,exchangeRate:.025,offers:view.offers}).amount,quote.goodsTwd+quote.feeTwd);}
check(catalogDisplayPrice(fixture,{variantId:'small',exchangeRate:.025,offers:view.offers}).amount===15&&catalogDisplayPrice(fixture,{variantId:'large',exchangeRate:.025,offers:view.offers}).amount===24,'Automatic fee discount appears only when the same-spec item meets the minimum');
const priceHtml=renderToStaticMarkup(React.createElement(ProductPrice,{product:fixture,variantId:'large',exchangeRate:.025,offers:view.offers}));
check(priceHtml.includes('24')&&!priceHtml.includes('From'),'The actual shared card/detail price component renders the selected qualifying amount');
const expired=view.offers.map(o=>({...o,endsAt:'2000-01-01',permanent:false}));
check(catalogDisplayPrice(fixture,{variantId:'large',exchangeRate:.025,offers:expired}).amount===26,'Expired automatic discounts are removed from displayed prices');
await db.prepare('DELETE FROM kk_offers WHERE id=?').bind(fixtureOffer.id).run();
await db.prepare('UPDATE products SET commerce_json=?,price_jpy=? WHERE id=?').bind(beforeFixture.commerce_json,beforeFixture.price_jpy,gummy.id).run();
const bank={name:'Fixture Bank',code:'000',account:'test-account',accountName:'Fixture'},paymentOrder={id:999,status:'awaiting_payment',paymentMethod:'transfer',pricing:{totalTwd:522},paymentReference:''};
let paymentHtml=renderToStaticMarkup(React.createElement(PaymentReport,{order:paymentOrder,bank,reload:async()=>{}}));
check(paymentHtml.includes('<details open=""')&&paymentHtml.includes('test-account')&&paymentHtml.includes('522'),'Unreported payment shows bank information and the exact payable amount without another disclosure click');
paymentHtml=renderToStaticMarkup(React.createElement(PaymentReport,{order:{...paymentOrder,status:'payment_review',paymentReportedAt:'2026-09-29T00:00:00Z'},bank,reload:async()=>{}}));
check(paymentHtml.includes('請勿重複匯款')&&paymentHtml.includes('等待賣家核對'),'Reported payment explains verification is pending and does not ask for another transfer');

const empty=initial.products.find(p=>p.stock===0);await call('/api/shop',{member:true,status:400,body:{action:'estimate',items:[{productId:empty.id,quantity:1,variantId:empty.variants[0]?.id}]}});check(true,'Unavailable item cannot be ordered');
const offer={title:'Test minimum',titleEn:'Test minimum',code:'MIN400',tiers:['standard','platinum','black','diamond'],rate:8,discountType:'fixed',value:10,currency:'TWD',scope:'all',minMerchandiseTwd:400,startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()};
await db.prepare('INSERT INTO kk_offers(code,data,active) VALUES(?,?,1)').bind(offer.code,JSON.stringify(offer)).run();
await call('/api/shop',{member:true,body:{action:'claim_coupon',code:'MIN400'}});
await call('/api/shop',{member:true,status:400,body:{action:'estimate',coupon:'MIN400',items:[{productId:gummy.id,quantity:1}]}});
const eligible=(await call('/api/shop',{member:true,body:{action:'estimate',coupon:'MIN400',items:[{productId:gummy.id,quantity:20}]}})).data.pricing;check(eligible.discountTwd===10,'Coupon minimum rejects small basket and applies to qualifying basket');
const items=[{productId:gummy.id,quantity:2}],p=(await call('/api/shop',{member:true,body:{action:'estimate',items}})).data.pricing;
const order={action:'checkout',items,submissionKey:randomUUID(),approvedTotal:p.totalTwd,approvedSignature:JSON.stringify(p.items),approvedPurchaseAt:p.purchaseAt,approvedCancelUntil:p.cancelUntil};
await call('/api/shop',{member:true,status:400,body:order});
const address={recipient:'Test Buyer',phone:'0912345678',postalCode:'100',street:'台北市測試路 1 號'};
const placed=(await call('/api/shop',{member:true,status:201,body:{...order,shippingAddress:address}})).data.order;
check(placed.shippingAddress.street===address.street,'Checkout requires and saves shipping address');
await call('/api/shop',{member:true,body:{action:'payment_reference',id:placed.id,reference:'12345'}});
const admin=(await call('/api/operations',{admin:true})).data;check(admin.orders.find(o=>o.id===placed.id).status==='payment_review','Payment report reaches admin order queue');
await call('/api/receipts',{member:true,body:{ids:[placed.id]}});check(true,'Buyer receipt data remains accessible');
await call('/api/operations/ai-product',{admin:true,status:503,body:{prompt:'Le Labo hand soap',imageMode:'research',research:true}});check(true,'Missing AI connection is reported accurately without creating a product');
await call('/api/operations/ai-command',{admin:true,status:400,body:{mode:'apply',command:{type:'arrival',from:'2026-02-30',to:'2026-03-10',eta:'2026-03-15'}}});check(true,'Impossible calendar date is rejected');
await call('/api/operations/ai-command',{admin:true,body:{mode:'apply',command:{type:'discontinue',productId:gummy.id,name:gummy.nameZh}}});
check(!(await call('/api/shop')).data.products.some(p=>p.id===gummy.id),'Confirmed discontinue hides item and seed does not reactivate it');
await db.prepare("UPDATE store_settings SET value=json_set(value,'$.orderClosesAt',?) WHERE key='commerce_settings'").bind(new Date(Date.now()-1000).toISOString()).run();
await call('/api/shop',{member:true,status:409,body:{action:'estimate',items:[{productId:initial.products.find(p=>p.id!==gummy.id&&p.stock===-1&&!p.variants.length).id,quantity:1}]}});check(true,'Purchase cutoff enforced on server');
const target=initial.products.find(p=>p.nameEn===expanded[0].nameEn);await call('/api/operations/ai-command',{admin:true,body:{mode:'apply',command:{type:'discontinue',productId:target.id,name:target.nameZh}}});
await db.prepare("DELETE FROM store_settings WHERE key='adela_expanded_20260928_v2'").run();
const rerun=(await call('/api/shop')).data;check(!rerun.products.some(p=>p.id===target.id),'Replaying expansion never reactivates a seller-discontinued product');
const counts={total:initial.products.length,LeLabo:initial.products.filter(p=>p.nameEn.startsWith('Le Labo')).length,Byredo:initial.products.filter(p=>p.nameEn.startsWith('Byredo')).length,Diptyque:initial.products.filter(p=>p.nameEn.startsWith('Diptyque')).length,Stussy:initial.products.filter(p=>inCollection(p,'Stussy')).length,MardiMercredi:initial.products.filter(p=>inCollection(p,'Mardi Mercredi')).length,OliveYoung:initial.products.filter(p=>p.purchaseUrl.includes('oliveyoung.co.kr')).length};await mkdir('verification',{recursive:true});await writeFile('verification/expanded-catalog-observed.json',JSON.stringify({counts,products:initial.products,checksPassed:count},null,2));console.log(JSON.stringify(counts));
console.log('Release checks complete. Live AI connection is NOT covered and remains unconfigured.');
}finally{await mf.dispose();}

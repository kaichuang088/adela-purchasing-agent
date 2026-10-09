import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const require=createRequire(realpathSync(resolve('node_modules/wrangler/package.json')));
const {Miniflare}=require('miniflare');
const names=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)&&p!=='index.js');
const password=randomUUID(),identity={id:'adela-test',email:'buyer@example.test'};
const mf=new Miniflare({modules:['index.js',...names].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{ADMIN_PASSWORD:password},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
async function call(path,{method='GET',body,admin=false,auth=false,status=200}={}){
 const headers={};if(admin)headers['X-KK-Admin-Password']=password;
 if(auth){headers['oai-authenticated-user-id']=identity.id;headers['oai-authenticated-user-email']=identity.email;}
 if(body!==undefined)headers['Content-Type']='application/json';
 const response=await mf.dispatchFetch('https://adela.test'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();assert.equal(response.status,status,`${path}: ${text.slice(0,400)}`);return text?JSON.parse(text):{};
}
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:.025})).run();
 const initial=await call('/api/shop');assert.deepEqual(initial.enabledCountries,['KR']);assert.equal(initial.shopPaused,false);assert.ok(initial.products.length>=50);
 const admin=await call('/api/operations',{admin:true});assert.ok(admin.products.length>=27);assert.ok(admin.products.every(p=>p.currency==='KRW'&&p.country==='KR'));assert.ok(admin.products.some(p=>p.nameEn==='Nongshim Onion Rings'));
 const gummy=admin.products.find(p=>p.nameEn==='AMOS Peelerz Mango Gummies 30g x 34');assert.equal(gummy.priceJpy,17490);assert.ok(gummy.descriptionZh.includes('中國'));
 const coffee=admin.products.find(p=>p.nameEn==="I'MINT Sugar-Free Coffee Candy 32g");assert.equal(coffee.priceJpy,1);assert.equal(coffee.status,'draft');
 assert.ok(!admin.products.some(p=>/SUQQU|PERFECT CHEESE|MALEBRANCHE/.test(p.nameEn)));
 await call('/api/shop',{method:'POST',auth:true,body:{action:'join',name:'Adela Buyer'}});
 const toner=admin.products.find(p=>p.nameEn==='Round Lab 1025 Dokdo Toner');assert.equal(toner.variants[0].priceJpy,11900);
 await db.prepare("UPDATE store_settings SET value=json_set(value,'$.shopPaused',json('true')) WHERE key='commerce_settings'").run();
 await call('/api/shop',{method:'POST',auth:true,status:409,body:{action:'estimate',items:[{productId:toner.id,variantId:'200ml',quantity:1}]}});
 const starts=new Date(Date.now()-60000).toISOString(),ends=new Date(Date.now()+600000).toISOString();
 await call('/api/operations',{method:'POST',admin:true,body:{action:'settings',rateMode:'manual',manualRate:.025,shippingTwd:0,shippingByTier:{standard:0,platinum:0,black:0,diamond:0},paymentInstructions:'Test only',shopPaused:false,orderOpensAt:starts,orderClosesAt:ends}});
 await db.prepare("UPDATE products SET status='active' WHERE id=?").bind(toner.id).run();
 // A later rollout may add snacks to an existing Korean shop without resetting active items.
 await db.prepare("DELETE FROM products WHERE id=?").bind(gummy.id).run();
 await db.prepare("DELETE FROM store_settings WHERE key='adela_korea_catalog_v2'").run();
 const reopened=await call('/api/operations',{admin:true});assert.ok(reopened.products.some(p=>p.nameEn==='AMOS Peelerz Mango Gummies 30g x 34'));
 assert.equal(reopened.products.find(p=>p.id===toner.id).status,'active');
 const shop=await call('/api/shop',{auth:true});assert.ok(shop.products.length>=50);assert.ok(shop.products.every(p=>p.currency==='KRW'));
 const items=[{productId:toner.id,variantId:'200ml',quantity:2}];
 const quote=(await call('/api/shop',{method:'POST',auth:true,body:{action:'estimate',items}})).pricing;
 assert.equal(quote.items[0].sourceCurrency,'KRW');assert.equal(quote.goodsTwd,595);
 const checkout={action:'checkout',items,submissionKey:randomUUID(),approvedTotal:quote.totalTwd,approvedSignature:JSON.stringify(quote.items),approvedPurchaseAt:quote.purchaseAt,approvedCancelUntil:quote.cancelUntil};
 await call('/api/shop',{method:'POST',auth:true,status:400,body:checkout});
 const address={recipient:'林小姐',phone:'0912345678',postalCode:'100',street:'臺北市中正區忠孝西路一段 1 號'};
 const placed=await call('/api/shop',{method:'POST',auth:true,status:201,body:{...checkout,shippingAddress:address}});
 assert.deepEqual(placed.order.shippingAddress,address);
 const adminAfter=await call('/api/operations',{admin:true});assert.deepEqual(adminAfter.orders.find(o=>o.id===placed.order.id).shippingAddress,address);
 await call('/api/shop',{method:'POST',auth:true,body:{action:'payment_reference',id:placed.order.id,reference:'12345'}});
 await call('/api/operations',{method:'POST',admin:true,body:{action:'payment_state',id:placed.order.id,paid:true}});
 const paid=await call('/api/shop',{auth:true});assert.equal(paid.member.spendKrw,23800);assert.equal(paid.member.spendJpy,0);assert.equal(paid.member.paidItems,2);
 await call('/api/operations',{method:'POST',admin:true,status:409,body:{action:'status',id:placed.order.id,status:'refunded',reason:'Test refund',paymentReference:'refunded'}});
 const unchanged=await call('/api/shop',{auth:true});assert.equal(unchanged.member.spendKrw,23800);assert.equal(unchanged.creditTwd,0);assert.equal(unchanged.orders.find(o=>o.id===placed.order.id).status,'paid');
 await call('/api/operations',{method:'POST',admin:true,body:{action:'cancel_order',id:placed.order.id,reason:'Seller cancellation'}});
 const refunded=await call('/api/shop',{auth:true});assert.equal(refunded.member.spendKrw,0);assert.equal(refunded.member.spendJpy,0);assert.equal(refunded.member.paidItems,0);assert.equal(refunded.creditTwd,placed.order.pricing.totalTwd);assert.equal(refunded.orders.find(o=>o.id===placed.order.id).status,'cancelled');
 await call('/api/catalog/order',{method:'POST',status:410,body:{productId:toner.id,quantity:1}});
 await db.prepare("UPDATE store_settings SET value=json_set(value,'$.orderClosesAt',?) WHERE key='commerce_settings'").bind(new Date(Date.now()-1000).toISOString()).run();
 await call('/api/shop',{method:'POST',auth:true,status:409,body:{action:'estimate',items}});
 console.log('Korean catalog, KRW quote and membership, address sync, legacy block and purchase deadline: PASS');
}finally{await mf.dispose();}

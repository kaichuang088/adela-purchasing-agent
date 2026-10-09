// Disposable compiled Worker tests. Identity headers below belong only to this
// isolated fixture; they are never sent to the hosted site.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const paths=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)),password=randomUUID();
let outboundCalls=0,count=0;
const options={modules:['index.js',...paths.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PASSWORD:password,KK_AI_GATEWAY_URL:'https://gateway.example.test/api/ai-provider'},cf:false,outboundService:async()=>{outboundCalls++;return new Response('Unexpected outbound request',{status:503});}};
const mf=new Miniflare(options);
const check=(value,label)=>{assert.ok(value,label);console.log(`PASS ${++count}: ${label}`);};
async function call(path,{admin=false,user='chat-a',body,status=200,auth=true}={}){
 const response=await mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),...(admin?{'X-KK-Admin-Password':password}:{})},body:body?JSON.stringify(body):undefined});
 const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;
}
try{
 const db=await mf.getD1Database('DB');
 for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:.023668})).run();
 for(const member of ['chat-a','chat-b'])await db.prepare('INSERT INTO kk_members(id,name,email) VALUES(?,?,?)').bind('siwc:'+member,member,member+'@example.test').run();
 await db.prepare("INSERT INTO products(id,name_zh,name_en,category_zh,category_en,price_jpy,image_key,commerce_json) VALUES(991,'照片測試商品','Photo fixture','零食','Snacks',5000,'static/fixture/product.jpg',?)").bind(JSON.stringify({variants:[{id:'grape',imageUrl:'/fixture/grape.jpg'}]})).run();
 const pricing={items:[{productId:991,nameZh:'照片測試商品',nameEn:'Photo fixture',variantId:'grape',variantLabelZh:'葡萄',quantity:1,sourceCurrency:'KRW',priceJpy:5000}],goodsJpy:5000,goodsTwd:200,serviceFeeTwd:10,shippingTwd:40,totalTwd:250};
 for(const [id,member] of [[101,'chat-a'],[102,'chat-a'],[201,'chat-b']])await db.prepare("INSERT INTO shopping_requests(id,request_no,customer_name,email,image_key,image_name,image_type,member_id,kind,status,pricing_json,paid_at,purchase_at) VALUES(?,?,?,?,?,?,?,?,'catalog','paid',?,'2020-01-01T00:00:00Z','2020-01-02T00:00:00Z')").bind(id,'QA-'+id,member,member+'@example.test','catalog-demo','','image/jpeg','siwc:'+member,JSON.stringify(pricing)).run();
 for(const [member,order,body] of [['chat-a',101,'First order only'],['chat-a',102,'Other order private detail'],['chat-a',null,'General account question'],['chat-b',201,'Another customer private detail']])await db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id) VALUES(?,'member',?,?)").bind('siwc:'+member,body,order).run();
 await db.prepare("INSERT INTO kk_support_threads(member_id,status,ai_summary,unread_admin,unread_member) VALUES('siwc:chat-a','human','Summary mentions other order private detail',4,5)").run();
 const scoped=await call('/api/messages?memberId=siwc%3Achat-a&orderId=101',{admin:true});
 check(scoped.orders.length===1&&scoped.orders[0].id===101&&scoped.messages.length===1&&scoped.messages[0].order_id===101,'Admin inside an order receives only that order and its conversation');
 check(!JSON.stringify(scoped).includes('Other order private detail')&&!JSON.stringify(scoped).includes('Another customer private detail'),'Scoped response excludes unrelated order messages and the account summary');
 check(scoped.orders[0].pricing.items[0].imageUrl==='/fixture/grape.jpg','Historical order line without a photo resolves the matching variant photo for its card');
 check(scoped.orders[0].status==='purchasing'&&scoped.orders[0].events.some(e=>e.titleZh==='採買中（自動）'),'First scoped response reflects the automatic purchase-date update');
 const unread=await db.prepare("SELECT unread_admin,unread_member,ai_summary FROM kk_support_threads WHERE member_id='siwc:chat-a'").first();
 check(unread.unread_admin===4&&unread.unread_member>=5&&unread.ai_summary.includes('other order'),'Scoped admin read preserves unrelated unread counts and saved summary');
 const buyer=await call('/api/messages?orderId=101');
 check(buyer.orders.length===1&&buyer.messages.every(m=>m.order_id===101),'Buyer order view has the same order scope');
 check((await db.prepare("SELECT unread_member FROM kk_support_threads WHERE member_id='siwc:chat-a'").first()).unread_member===unread.unread_member,'Scoped buyer read preserves unread reminders for other conversations');
 check(scoped.aiConfigured===false&&buyer.aiConfigured===false&&outboundCalls===0,'Gateway URL without the shared secret never reports AI ready or calls a provider');
 await call('/api/messages?orderId=101',{user:'chat-b',status:403});
 await call('/api/messages?memberId=siwc%3Achat-b&orderId=101',{admin:true,status:403});
 check(true,'Both buyer and admin member selection reject an order belonging to a different member');
 for(const id of ['0','-1','abc','1.5','9007199254740992'])await call('/api/messages?orderId='+id,{status:400});
 await call('/api/messages?orderId=101',{auth:false,status:401});
 check(true,'Invalid order IDs and unauthenticated reads are rejected');
 const share={memberId:'siwc:chat-a',orderId:101,action:'share_order'};
 await call('/api/messages',{admin:true,body:share,status:201});await call('/api/messages',{admin:true,body:share,status:201});
 const shared=await call('/api/messages?memberId=siwc%3Achat-a&orderId=101',{admin:true});
 check(shared.messages.filter(m=>m.sender==='admin'&&m.body.startsWith('訂單 / Order ')).length===1&&shared.orders[0].pricing.items[0].imageUrl,'Automatic order attachment is idempotent and retains its photographed card data');
 await call('/api/messages',{admin:true,body:{memberId:'siwc:chat-b',orderId:101,body:'Wrong recipient'},status:403});
 check(!(await db.prepare("SELECT id FROM kk_conversations WHERE body='Wrong recipient'").first()),'Wrong-recipient sends do not save or notify the wrong customer');
 const hub=await call('/api/messages?memberId=siwc%3Achat-a',{admin:true});
 check(hub.orders.length===2&&hub.messages.some(m=>m.order_id===102)&&hub.messages.some(m=>m.order_id===null)&&hub.thread.ai_summary.includes('other order'),'Account message hub retains full authorized history and its summary');
 check((await db.prepare("SELECT unread_admin FROM kk_support_threads WHERE member_id='siwc:chat-a'").first()).unread_admin===0,'Opening the full admin message hub still marks its account history read');
 check((await db.prepare('SELECT pricing_json FROM shopping_requests WHERE id=101').first()).pricing_json===JSON.stringify(pricing),'Chat photo hydration and automatic attachment preserve saved historical prices');
 let modelInput;
 await mf.setOptions({...options,bindings:{...options.bindings,KK_AI_GATEWAY_SECRET:'isolated-mock-secret'},outboundService:async request=>{outboundCalls++;assert.equal(new URL(request.url).hostname,'gateway.example.test');assert.equal(request.headers.get('X-KK-AI-Gateway-Secret'),'isolated-mock-secret');assert.equal(request.headers.get('Authorization'),null);modelInput=await request.json();return Response.json({status:'completed',output_text:'Isolated mocked reply'});}});
 const refreshedDb=await mf.getD1Database('DB');await refreshedDb.prepare("UPDATE kk_support_threads SET status='ai',needs_human=0 WHERE member_id='siwc:chat-a'").run();
 await call('/api/messages',{body:{orderId:101,body:'Explain this particular order'},status:201});
 check(outboundCalls===1&&modelInput.model==='gpt-6.1-sol'&&modelInput.store===false,'Configured compiled route calls the requested model through the mock gateway with correct private authorization');
 check(modelInput.input.includes('First order only')&&!modelInput.input.includes('Other order private detail')&&!modelInput.input.includes('General account question')&&!modelInput.input.includes('Another customer private detail'),'Selected-order AI input contains only that order conversation');
 const replied=await call('/api/messages?orderId=101');
 check(replied.aiConfigured&&replied.messages.some(m=>m.sender==='ai'&&m.body==='Isolated mocked reply'&&m.order_id===101),'Model reply is saved against its selected order without claiming a real provider test');
 await mkdir('verification',{recursive:true});await writeFile('verification/r13-order-chat-results.json',JSON.stringify({checks:count,scope:'Compiled API in disposable D1 and mock gateway; no live AI, browser, phone or payment end-to-end test'},null,2));
}finally{await mf.dispose();}

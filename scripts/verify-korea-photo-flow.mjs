import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const files=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)&&p!=='index.js');
const password=randomUUID();let cookie='',count=0,exact=true;
const mf=new Miniflare({modules:['index.js',...files].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{ADMIN_PASSWORD:password,OPENAI_API_KEY:'test-only-not-a-real-key'},outboundService:async request=>{
 assert.equal(new URL(request.url).hostname,'api.openai.com');const input=await request.json();assert.equal(input.model,'gpt-6-astra');
 const url='https://synthetic-retailer.example.test/kr-item';
 const analysis={identifiedNameZh:'韓國合成測試商品',identifiedNameEn:'Synthetic Korea product',brand:'Test',model:'KR',category:'韓國零食',confidence:exact?.99:.3,taxRatePercent:0,evidenceSummaryZh:'測試用，不是真實查價',evidenceSummaryEn:'Synthetic test only',sources:[{storeName:'Synthetic retailer',url,localCountry:'KR',currency:'KRW',originalPrice:20000,afterTaxPrice:null,localJapan:false,taxFreeForResale:false,taxFreeConditions:'',taxEvidenceUrl:'',priceTaxIncludedJpy:0,priceTaxFreeJpy:null,taxFreeEligible:false,capturedAt:new Date().toISOString(),note:'Test only',exactMatch:exact,inStock:true}]};
 return Response.json({output:[{type:'web_search_call',action:{sources:[{url}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify(analysis)}]}]});
},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
function check(v,label){assert.ok(v,label);console.log(`PASS ${++count}: ${label}`);}
async function call(path,body,admin=false,status=200){let headers={Cookie:cookie},payload;if(admin)headers['X-KK-Admin-Password']=password;if(body instanceof FormData){const r=new Request('https://test',{method:'POST',body});headers['Content-Type']=r.headers.get('content-type');payload=new Uint8Array(await r.arrayBuffer());}else if(body){headers['Content-Type']='application/json';payload=JSON.stringify(body);}const r=await mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers,body:payload});const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return{v,r};}
try{
const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString()})).run();
const signed=await call('/api/auth',{action:'signup',name:'Photo Test',email:'photo@example.test',password:'test-only-password'},false,201);cookie=signed.r.headers.get('set-cookie').split(';')[0];
const member=(await call('/api/shop')).v.member;await db.prepare('UPDATE kk_members SET miles=35 WHERE id=?').bind(member.id).run();
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH1sAAAAASUVORK5CYII=','base64');
async function upload(country='KR',status=201){const f=new FormData();f.set('country',country);f.set('image',new File([png],'test.png',{type:'image/png'}));return(await call('/api/photo-quotes',f,false,status)).v;}
await upload('JP',403);check(true,'Non-Korean purchase blocked');
const quote=await upload();check(quote.pricing.totalTwd===600&&quote.pricing.items[0].sourceCurrency==='KRW','Mock Korean quote: 500 goods + 50 fee + 50 shipping');
check((await call('/api/operations',undefined,true)).v.orders.length===0,'Photo estimate creates no admin order');
const quantity=(await call('/api/photo-quotes',{action:'confirm_product',id:quote.id,quantity:2})).v.pricing;check(quantity.items[0].quantity===2&&quantity.totalTwd===1150,'Photo quantity recalculates quote');
const request={action:'buy',id:quote.id,approvedTotal:quantity.totalTwd,approvedAt:quantity.pricedAt,shippingAddress:{recipient:'測試',phone:'0912345678',postalCode:'100',street:'台北市測試路一號'}};
const order=(await call('/api/photo-quotes',request,false,201)).v.order;check(order.status==='admin_review'&&!order.paymentDueAt,'AI order awaits seller review; no payment demand');
check((await call('/api/shop')).v.member.miles===5&&order.snackRedeemed,'Photo order redeems exactly 30 points atomically');
const repeat=(await call('/api/photo-quotes',request)).v.order;check(repeat.id===order.id&&(await call('/api/shop')).v.member.miles===5,'Repeated photo purchase does not create duplicate order or deduct points twice');
await call('/api/order-actions',{action:'cancel',id:order.id});check((await call('/api/shop')).v.member.miles===35,'Cancelling unpaid AI order restores snack points');
const discard=await upload();await call('/api/photo-quotes',{action:'discard',id:discard.id});await call('/api/photo-quotes',{action:'buy',id:discard.id},false,410);check(true,'Discarded quote cannot be purchased');
exact=false;await upload('KR',422);check(true,'Uncertain identification cannot become a quote');
console.log(`${count} Korean photo workflow checks passed using a MOCK provider; real AI remains unverified.`);
}catch(e){console.error(e);process.exitCode=1;}finally{await mf.dispose();}

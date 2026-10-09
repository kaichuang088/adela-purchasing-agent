import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
const require=createRequire(realpathSync(resolve("node_modules/wrangler/package.json")));
const {Miniflare}=require("miniflare"),{buildSync}=require("esbuild");
const bundled=buildSync({entryPoints:["lib/receipt-request.ts"],bundle:true,platform:"node",format:"esm",write:false});
const {fetchReceiptOrders}=await import("data:text/javascript;base64,"+Buffer.from(bundled.outputFiles[0].text).toString("base64"));
let user="workflow-owner";
const password=randomUUID();
const names=(await readdir("dist/server",{recursive:true})).filter(p=>/\.m?js$/.test(p)&&p!=="index.js");
const modules=["index.js",...names].map(p=>({type:"ESModule",path:resolve("dist/server",p)}));
const mf=new Miniflare({modules,modulesRoot:resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:["DB"],r2Buckets:["BUCKET"],bindings:{ADMIN_PASSWORD:password},assets:{directory:resolve("dist/client"),binding:"ASSETS",routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let count=0;
function check(condition,message){assert.ok(condition,message);console.log(`PASS ${++count}: ${message}`);}
async function api(path,{method="GET",body,admin=false,auth=false,status=200}={}) {
  const headers={};if(auth){headers["oai-authenticated-user-id"]=user;headers["oai-authenticated-user-email"]=user+"@example.test";}if(admin)headers["X-KK-Admin-Password"]=password;
  if(body&&!(body instanceof FormData))headers["Content-Type"]="application/json";
  let payload=body?JSON.stringify(body):undefined;
  if(body instanceof FormData){const encoded=new Request("https://kk-test.example",{method:"POST",body});headers["Content-Type"]=encoded.headers.get("content-type");payload=new Uint8Array(await encoded.arrayBuffer());}
  const response=await mf.dispatchFetch("https://kk-test.example"+path,{method,headers,body:payload});
  const text=await response.text();assert.equal(response.status,status,`${path}: ${text.slice(0,500)}`);
  return JSON.parse(text);
}
try {
  const db=await mf.getD1Database("DB");
  for(const file of (await readdir("drizzle")).filter(f=>f.endsWith(".sql")).sort())for(const sql of (await readFile("drizzle/"+file,"utf8")).split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  await api("/api/manage",{status:401});await api("/api/manage",{method:"POST",body:{action:"login"},admin:true});check(true,"admin authorization accepts the configured password and blocks anonymous reads");
  const catalog=await api('/api/catalog');check(catalog.products.length>=79&&catalog.products.every(p=>p.currency==='KRW'),'Current catalog exposes verified Korean products');
  await api('/api/catalog/order',{method:'POST',body:{productId:catalog.products[0].id,quantity:1},status:410});
  await api('/api/catalog',{method:'POST',admin:true,body:{id:catalog.products[0].id,status:'active'},status:410});check(true,'Retired ordering and publishing endpoints cannot bypass the current workflow');
  await api('/api/requests',{method:'POST',body:{action:'buy',id:'unknown'},status:401});check(true,'Legacy upload alias requires membership before accessing photo quotes');
  await api('/api/shop',{method:'POST',auth:true,body:{action:'join',name:'Private receipt buyer'}});
  await api('/api/operations',{method:'POST',admin:true,body:{action:'settings',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString(),shippingTwd:50}});
  await api('/api/operations',{method:'POST',admin:true,body:{action:'product',nameZh:'Private receipt fixture',nameEn:'Private receipt fixture',originalJpy:20000,status:'active',imageUrl:'https://example.test/synthetic.png',purchaseUrl:'https://example.test/item'}});
  const product=(await api('/api/shop')).products.find(p=>p.nameEn==='Private receipt fixture'),items=[{productId:product.id,quantity:2}];
  const {pricing}=await api('/api/shop',{method:'POST',auth:true,body:{action:'estimate',items}});
  const body={action:'checkout',items,submissionKey:randomUUID(),approvedTotal:pricing.totalTwd,approvedSignature:JSON.stringify(pricing.items),approvedPurchaseAt:pricing.purchaseAt,approvedCancelUntil:pricing.cancelUntil,shippingAddress:{recipient:'Private receipt buyer',phone:'0912345678',postalCode:'100',street:'台北市測試路 1 號'}};
  const first=(await api('/api/shop',{method:'POST',auth:true,body,status:201})).order;
  const repeat=(await api('/api/shop',{method:'POST',auth:true,body})).order;check(first.id===repeat.id,'Current checkout retries retain one owned order');
  const lookup='/api/requests?requestNo='+first.requestNo+'&email=workflow-owner%40example.test';
  await api(lookup,{status:401});user='workflow-other';await api('/api/shop',{method:'POST',auth:true,body:{action:'join',name:'Other buyer'}});await api(lookup,{auth:true,status:401});user='workflow-owner';
  check((await api(lookup,{auth:true})).request.requestNo===first.requestNo,'Legacy lookup requires the order owner even when number and email are known');
  await api('/api/requests',{method:'PATCH',auth:true,body:{requestNo:first.requestNo,email:'workflow-owner@example.test',action:'confirm'},status:409});
  await api('/api/manage',{method:'PATCH',admin:true,body:{id:first.id,status:'purchasing'},status:409});check(true,'Legacy write endpoints cannot mutate current member orders');
  const document='/request/'+first.requestNo+'/document?email=workflow-owner%40example.test';
  async function documentHtml(headers={}){const r=await mf.dispatchFetch('https://kk-test.example'+document,{headers});assert.equal(r.status,200);return r.text();}
  const anonymous=await documentHtml();check(!anonymous.includes('Private receipt fixture')&&!anonymous.includes('Private receipt buyer'),'Anonymous document access exposes no order or customer content');
  const other=await documentHtml({'oai-authenticated-user-id':'workflow-other','oai-authenticated-user-email':'workflow-other@example.test'});check(!other.includes('Private receipt fixture')&&!other.includes('Private receipt buyer'),'Another member cannot read the printable invoice');
  const owner=await documentHtml({'oai-authenticated-user-id':'workflow-owner','oai-authenticated-user-email':'workflow-owner@example.test'});check(owner.includes('Private receipt fixture')&&owner.includes('Private receipt buyer')&&owner.includes('Purchasing Agent'),'Owner can render the correctly branded invoice');
  const adminHtml=await documentHtml({'X-KK-Admin-Password':password});check(adminHtml.includes('Private receipt fixture'),'Authenticated admin can render an owned invoice');
  const send=(path,init)=>mf.dispatchFetch('https://kk-test.example'+path,init);
  const receipts=await fetchReceiptOrders([first.id],password,send);check(receipts.length===1&&receipts[0].id===first.id,'Actual receipt client request authenticates with the backend correctly');
  await assert.rejects(()=>fetchReceiptOrders([first.id],'wrong-password',send));await assert.rejects(()=>fetchReceiptOrders([first.id],undefined,send));check(true,'Receipt client surfaces rejected credentials without returning private data');
  const ownerSend=(path,init)=>send(path,{...init,headers:{...init.headers,'oai-authenticated-user-id':'workflow-owner','oai-authenticated-user-email':'workflow-owner@example.test'}});
  check((await fetchReceiptOrders([first.id],undefined,ownerSend))[0].id===first.id,'Receipt client also supports an authenticated buyer without an admin password');
  console.log(`${count} workflow checks passed`);
} finally {await mf.dispose();}

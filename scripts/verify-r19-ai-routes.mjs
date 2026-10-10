// Compiled-route configuration regression with a mock transport, never a live provider claim.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const files=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p));
let checks=0;const check=(ok,label)=>{assert.ok(ok,label);console.log(`PASS ${++checks}: ${label}`)};
for(const mode of ['direct','gateway']){
 const password=randomUUID(),calls=[];
 const bindings={ADMIN_PASSWORD:password,OPENAI_API_KEY:'isolated-not-real-provider-key',OPENAI_MODEL:'gpt-6.1-sol',KK_AI_GATEWAY_SECRET:'isolated-shared-secret',...(mode==='gateway'?{KK_AI_GATEWAY_URL:'https://gateway.example.test/api/ai-provider'}:{})};
 const mf=new Miniflare({modules:['index.js',...files.filter(x=>x!=='index.js')].map(x=>({type:'ESModule',path:resolve('dist/server',x)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings,cf:false,outboundService:async request=>{
  assert.equal(new URL(request.url).hostname,mode==='gateway'?'gateway.example.test':'api.openai.com');
  assert.equal(request.headers.get('Authorization'),mode==='direct'?'Bearer isolated-not-real-provider-key':null);
  assert.equal(request.headers.get('X-KK-AI-Gateway-Secret'),mode==='gateway'?'isolated-shared-secret':null);
  const body=await request.json();assert.equal(body.model,'gpt-6.1-sol');assert.equal(body.store,false);calls.push(body);
  const draft={nameZh:'隔離 AI 草稿',spec:'50mL × 1',priceKrw:30000,purchaseUrl:'https://www.ssg.com/isolated-fixture',imageUrl:'https://example.test/isolated-photo.jpg',taiwanRetailTwd:1000,taiwanRetailSource:'https://www.momoshop.com.tw/isolated-fixture',taiwanRetailSpec:'50mL × 1',taiwanRetailClassification:'regular',taiwanRetailCheckedAt:'2026-10-10',sourceCheckedAt:'2026-10-10',sourceDeliveryKrw:0,sourceDeliveryConditions:'Synthetic fixture, not supplier evidence',sourceDeliveryConfirmed:true};
  const text=body.instructions.startsWith('Research exact products')?JSON.stringify({products:[draft]}):body.instructions.includes('Allowed commands')?JSON.stringify({type:'unclear',reason:'Isolated test; no catalog mutation'}):body.input==='Reply with the required check token.'?'ADELA_AI_READY':JSON.stringify(draft);
  return Response.json({model:'gpt-6.1-sol',status:'completed',output_text:text});
 }});
 try{
  const db=await mf.getD1Database('DB');for(const name of(await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+name,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
  async function post(path,body,status=200){const r=await mf.dispatchFetch('https://isolated.test'+path,{method:'POST',headers:{'Content-Type':'application/json','X-KK-Admin-Password':password},body:JSON.stringify(body)}),value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
  const connected=await post('/api/operations/ai-check',{});check(connected.modelMatched&&calls.length===1,mode+': model check uses requested endpoint, model and exclusive authorization');
  const product=await post('/api/operations/ai-product',{prompt:'Synthetic 50mL fixture',imageMode:'research'});check(product.draft.sourceDeliveryConfirmed===false&&product.draft.taiwanReferenceConfirmed===false&&calls.length===2,mode+': AI product never trusts provider confirmation flags');
  const scan=await post('/api/operations/ai-scan',{mode:'scan',prompt:'Synthetic fixture'}),item=scan.products[0];check(item.taiwanRetailSpec==='50mL × 1'&&item.taiwanRetailCheckedAt==='2026-10-10'&&item.sourceDeliveryKrw===0&&item.sourceDeliveryConditions&&item.sourceDeliveryConfirmed===false&&calls.length===3,mode+': batch carries exact evidence as unverified draft');
  await post('/api/operations/ai-command',{mode:'preview',prompt:'Synthetic unclear command'},400);check(calls.length===4&&(await db.prepare('SELECT count(*) n FROM products').first()).n===0,mode+': admin command uses same connection and makes no product changes');
 }finally{await mf.dispose();}
}
await writeFile('verification/r19-ai-routes-results.json',JSON.stringify({checks,scope:'Compiled routes and isolated D1 with mock transport; no real provider/model verification'},null,2));

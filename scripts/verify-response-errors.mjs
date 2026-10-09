import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
const require=createRequire(realpathSync('node_modules/wrangler/package.json'));
await mkdir('work',{recursive:true});
require('esbuild').buildSync({entryPoints:['lib/http-response.ts'],outfile:'work/http-response.mjs',bundle:true,platform:'node',format:'esm'});
const {readJsonResponse,fetchReadJson,HttpResponseError}=await import('../work/http-response.mjs');
let count=0;
const check=(ok,label)=>{assert.ok(ok);console.log(`PASS ${++count}: ${label}`);};
const value=await readJsonResponse(Response.json({ok:true}));check(value.ok,'Valid success JSON is preserved');
const error=await readJsonResponse(Response.json({error:'Invalid coupon'},{status:400}));check(error.error==='Invalid coupon','Valid server validation error is preserved');
for(const [label,response] of [['Empty gateway',new Response('',{status:502})],['HTML login wall',new Response('<html>secret page data</html>')],['Null JSON',Response.json(null)],['Wrong response shape',Response.json([])]]){
 await assert.rejects(()=>readJsonResponse(response),e=>e.message.includes('Connection unavailable')&&!e.message.includes('secret page data')&&!e.message.includes('JSON'));
 check(true,label+' has a readable retry message and does not expose HTML');
}
const redirected=new Response('login');Object.defineProperty(redirected,'redirected',{value:true});await assert.rejects(()=>readJsonResponse(redirected),/Sign in again/);check(true,'Redirected sessions ask for sign-in');
const originalFetch=globalThis.fetch;
try{
 let calls=0;
 globalThis.fetch=async()=>{calls++;return calls===1?new Response('<html>upstream failed</html>',{status:502}):Response.json({ok:true});};
 check((await fetchReadJson('/api/shop')).ok&&calls===2,'Temporary gateway failure retries a read once');
 calls=0;globalThis.fetch=async()=>{calls++;throw new TypeError('Failed to fetch');};
 await assert.rejects(()=>fetchReadJson('/api/shop'),TypeError);check(calls===2,'Network failure stops after one retry');
 calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'Authentication required'},{status:401});};
 await assert.rejects(()=>fetchReadJson('/api/operations'),e=>e instanceof HttpResponseError&&e.status===401);check(calls===1,'Authentication failure remains identifiable without retry');
 calls=0;globalThis.fetch=async()=>{calls++;return redirected;};
 await assert.rejects(()=>fetchReadJson('/api/shop'),e=>e.status===401);check(calls===1,'Login redirect asks for sign-in without replaying');
 calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'Invalid input'},{status:400});};
 await assert.rejects(()=>fetchReadJson('/api/shop'),e=>e.status===400);check(calls===1,'Validation failures never retry');
 calls=0;await assert.rejects(()=>fetchReadJson('/api/shop',{method:'POST',body:'payment'}),/Only GET/);check(calls===0,'Read helper cannot submit or replay checkout and payments');
 calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:503});};
 const controller=new AbortController();controller.abort();await assert.rejects(()=>fetchReadJson('/api/shop',{signal:controller.signal}));check(calls===1,'Explicitly canceled reads do not retry');
}finally{globalThis.fetch=originalFetch;}

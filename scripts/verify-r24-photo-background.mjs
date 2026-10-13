import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(realpathSync('node_modules/wrangler/package.json'));
await mkdir('work',{recursive:true});
require('esbuild').buildSync({entryPoints:['netlify/functions/ai-photo-background.ts'],outfile:'work/r24-photo-background.mjs',bundle:true,platform:'node',format:'esm'});
const {default:run}=await import('../work/r24-photo-background.mjs');
const secret='isolated-photo-shared-secret',id='00000000-0000-4000-8000-000000000001';
const env={KK_AI_GATEWAY_SECRET:secret,KK_BACKEND_URL:'https://backend.example.test',NETLIFY_AI_MODEL:'gpt-6.1-sol',NETLIFY_AI_GATEWAY_URL:'https://provider.example.test/v1',NETLIFY_AI_GATEWAY_KEY:'isolated-provider-key'};
globalThis.Netlify={env:{get:k=>env[k]}};
const originalFetch=globalThis.fetch;let mode='success',calls=[],checks=[];
const request=(key=secret)=>new Request('https://gateway.example.test/.netlify/functions/ai-photo-background',{method:'POST',headers:{'Content-Type':'application/json','X-KK-AI-Gateway-Secret':key},body:JSON.stringify({id})});
function check(value,label){assert.ok(value,label);checks.push(label);console.log(`PASS ${checks.length}: ${label}`);}
globalThis.fetch=async(url,init)=>{
 const host=new URL(url).hostname,body=JSON.parse(init.body);calls.push({host,body});
 if(host==='backend.example.test'){
  assert.equal(init.headers['X-KK-AI-Gateway-Secret'],secret);assert.equal(init.headers.Authorization,undefined);
  if(body.action==='claim')return mode==='duplicate'?Response.json({error:'Already claimed'},{status:409}):Response.json({input:{model:'gpt-6.1-sol',input:'Original collage'},...(mode.startsWith('identity')?{identificationInput:{model:'gpt-6.1-sol',input:'Identify only'}}:{})});
  if(body.identifyOnly){
   if(mode==='identity-rejected')return Response.json({needResearch:true},{status:503});
   return Response.json({needResearch:mode!=='identity-choices',researchInput:{model:mode==='identity-model-mismatch'?'wrong-model':'gpt-6.1-sol',input:'Bound visual context and customer selected SKU'}});
  }
  return Response.json({ok:true});
 }
 assert.equal(host,'provider.example.test');assert.equal(init.headers.Authorization,'Bearer isolated-provider-key');assert.equal(init.headers['X-KK-AI-Gateway-Secret'],undefined);
 if(mode==='failure')return Response.json({error:'Synthetic provider failure'},{status:429});
 return Response.json({model:mode==='mismatch'?'other-model':'gpt-6.1-sol',output:[]});
};
try{
 await run(request('wrong'));check(calls.length===0,'Unauthorized work cannot reach backend or provider');
 mode='duplicate';await run(request());check(calls.length===1,'Duplicate claims do not repeat paid calls');
 calls=[];mode='success';await run(request());check(calls.length===3&&calls[2].body.result.model==='gpt-6.1-sol','Matching completed research reaches only the bound backend');
 calls=[];mode='failure';await run(request());check(calls[2].body.providerFailed===true,'Provider failure sends no fabricated result');
 calls=[];mode='mismatch';await run(request());check(calls[2].body.providerFailed===true,'A changed provider model cannot be marked successful');
 calls=[];mode='identity-choices';await run(request());check(calls.filter(c=>c.host==='provider.example.test').length===1&&calls.at(-1).body.identifyOnly,'Package choices stop after identification without a second paid research call');
 calls=[];mode='identity-research';await run(request());const provider=calls.filter(c=>c.host==='provider.example.test');check(provider.length===2&&provider[1].body.input==='Bound visual context and customer selected SKU','Second-stage research uses the backend visual identity and selected specification');
 calls=[];mode='identity-rejected';await run(request());check(calls.filter(c=>c.host==='provider.example.test').length===1&&calls.at(-1).body.providerFailed===true,'Rejected identity completion cannot trigger another paid stage');
 calls=[];mode='identity-model-mismatch';await run(request());check(calls.filter(c=>c.host==='provider.example.test').length===1&&calls.at(-1).body.providerFailed===true,'Replacement research input must retain the configured model');
 await writeFile('verification/r24/photo-background.json',JSON.stringify({checks:checks.length,scope:'Mock provider and backend; no real model calls or production changes',labels:checks},null,2)+'\n');
}finally{globalThis.fetch=originalFetch;delete globalThis.Netlify;}

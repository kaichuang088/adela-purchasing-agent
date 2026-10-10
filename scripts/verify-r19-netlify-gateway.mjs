// Isolated configuration/transport test. Does not deploy Netlify or prove provider connectivity.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
const require=createRequire(realpathSync('node_modules/wrangler/package.json'));
mkdirSync('work',{recursive:true});require('esbuild').buildSync({entryPoints:['netlify/functions/kk-proxy.ts'],outfile:'work/r19-netlify-gateway.mjs',bundle:true,platform:'node',format:'esm'});
const {default:proxy}=await import('../work/r19-netlify-gateway.mjs');
let env={},calls=0,last;const originalFetch=globalThis.fetch;
globalThis.Netlify={env:{get:name=>env[name]}};
globalThis.fetch=async(url,init)=>{calls++;last={url:String(url),init,body:JSON.parse(init.body)};return Response.json({model:last.body.model,output_text:'Isolated mock reply'});};
const request=(model='gpt-6.1-sol',secret='isolated-shared',method='POST')=>new Request('https://isolated-netlify.test/api/ai-provider',{method,headers:{'Content-Type':'application/json','X-KK-AI-Gateway-Secret':secret},body:method==='POST'?JSON.stringify({model,store:false,input:'Isolated probe'}):undefined});
let n=0;const check=(v,l)=>{assert.ok(v,l);console.log(`PASS ${++n}: ${l}`)};
try{
 env={KK_AI_GATEWAY_SECRET:'isolated-shared',NETLIFY_AI_GATEWAY_URL:'https://provider.example.test/v1',NETLIFY_AI_GATEWAY_KEY:'isolated-provider-key'};
 check((await proxy(request('gpt-6.1-sol','wrong'))).status===403&&calls===0,'Wrong gateway authorization never reaches provider');
 delete env.NETLIFY_AI_GATEWAY_KEY;check((await proxy(request())).status===503&&calls===0,'Missing provider credentials cannot be called connected');
 env.NETLIFY_AI_GATEWAY_KEY='isolated-provider-key';env.NETLIFY_AI_GATEWAY_URL='http://provider.example.test';check((await proxy(request())).status===503&&calls===0,'Invalid insecure provider endpoint rejected before send');
 env.NETLIFY_AI_GATEWAY_URL='https://provider.example.test/v1';env.NETLIFY_AI_MODEL='different-isolated-model';check((await proxy(request())).status===409&&calls===0,'Mismatched model does not silently override backend request');
 env.NETLIFY_AI_MODEL='gpt-6.1-sol';check((await proxy(request())).status===200&&calls===1&&last.body.model==='gpt-6.1-sol'&&last.url==='https://provider.example.test/v1/responses'&&last.init.headers.Authorization==='Bearer isolated-provider-key'&&!last.init.headers['X-KK-AI-Gateway-Secret'],'Matching model uses correct Responses path and only provider authorization');
 check((await proxy(request('gpt-6.1-sol','isolated-shared','GET'))).status===405&&calls===1,'Read requests cannot trigger provider usage');
 globalThis.fetch=async()=>{throw new Error('Synthetic transport failure');};check((await proxy(request())).status===503,'Transport failure is explicit, no false successful reply');
 await writeFile('verification/r19-netlify-gateway-results.json',JSON.stringify({checks:n,scope:'Mock Netlify globals and mock provider; no deployment or actual live provider/model verification'},null,2));
}finally{globalThis.fetch=originalFetch;delete globalThis.Netlify;}

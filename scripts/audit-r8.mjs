import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {realpathSync} from 'node:fs';import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID,webcrypto} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
await mkdir('work',{recursive:true});require('esbuild').buildSync({stdin:{contents:"export {catalogDisplayPrice} from './lib/catalog-display-price';export {marketPriceCeiling} from './lib/market-price';export {sendPush,validPushEndpoint} from './lib/web-push';",resolveDir:resolve('.')},outfile:'work/r5-check.mjs',bundle:true,platform:'node',format:'esm'});
const {catalogDisplayPrice,marketPriceCeiling,sendPush,validPushEndpoint}=await import('../work/r5-check.mjs');
const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),privateJwk=await webcrypto.subtle.exportKey('jwk',pair.privateKey),publicKey=Buffer.from(await webcrypto.subtle.exportKey('raw',pair.publicKey)).toString('base64url');
const paths=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)),password=randomUUID();let user='r5-buyer',n=0;
const mf=new Miniflare({modules:['index.js',...paths.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PASSWORD:password,VAPID_PRIVATE_JWK:JSON.stringify(privateJwk),VAPID_PUBLIC_KEY:publicKey,SHOP_PUBLIC_URL:'https://adela.test'},cf:false,outboundService:async()=>new Response('',{status:201})});
const check=(v,label)=>{assert.ok(v,label);console.log(`PASS ${++n}: ${label}`);};
async function call(path,body,{admin=false,status=200,auth=true}={}){const r=await mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),...(admin?{'X-KK-Admin-Password':password}:{})},body:body?JSON.stringify(body):undefined});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
try{
 const db=await mf.getD1Database('DB');for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString()})).run();
 await call('/api/shop',{action:'join',name:'R5 buyer'});let shop=await call('/api/shop');
 await writeFile('work/catalog-r8.json',JSON.stringify(shop.products,null,2));console.log('Saved '+shop.products.length+' products');
}finally{await mf.dispose();}

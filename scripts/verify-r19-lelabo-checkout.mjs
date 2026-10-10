// Real source-seeded products, but isolated members, FX and D1. No live order.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare'),{build}=require('esbuild');
await build({stdin:{contents:"export {catalogDisplayPrice} from './lib/catalog-display-price';export {productPriceReview} from './lib/price-review';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'work/r19-lelabo-prices.mjs'});
const {catalogDisplayPrice,productPriceReview}=await import('../work/r19-lelabo-prices.mjs');
const files=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p));
const mf=new Miniflare({modules:['index.js',...files.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],cf:false,outboundService:async()=>new Response('Isolated outbound disabled',{status:503})});
let checks=0;const rows=[];const fx=JSON.parse(await readFile('verification/r19-sourcing/exchange-rate-check.json','utf8'));const rate=Number(fx.results.find(x=>x.base==='KRW'&&x.result==='success')?.rateTwd);assert.ok(rate>0);
async function call(body){const r=await mf.dispatchFetch('https://isolated.test/api/shop',{method:body?'POST':'GET',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'r19-lelabo-isolated','oai-authenticated-user-email':'isolated@example.test'},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;}
try{
 const db=await mf.getD1Database('DB');for(const name of(await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+name,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:rate,bankAccount:'ISOLATED-NOT-PAYABLE',orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString()})).run();
 await call({action:'join',name:'R19 isolated Le Labo buyer'});const state=await call();
 for(const id of [84,86,132]){
  const p=state.products.find(p=>p.id===id);assert.ok(p);const shown=catalogDisplayPrice(p,{exchangeRate:rate});const review=productPriceReview(p,rate);assert.ok(review.ok,JSON.stringify(review));
  const quote=await call({action:'estimate',items:[{productId:id,quantity:1}]});const line=quote.pricing.items[0],checkout=line.goodsTwd+line.feeTwd+line.sizeFeeTwd;
  assert.equal(shown.amount,checkout);assert.equal(review.evidence.proposedTwd,checkout);assert.ok(checkout<=review.ceiling);checks+=2;
  rows.push({id,name:p.nameZh,sourceCostKrw:p.priceJpy,referenceFx:rate,cardAndDetailTwd:shown.amount,cartAndCheckoutItemTwd:checkout,taiwanTwd:review.evidence.taiwanPrice,ceilingTwd:review.ceiling,shippingSeparateTwd:quote.pricing.shippingTwd,note:'Matches current shared pricing helpers; freshly checked public reference FX, not verified live exchange rate or real stock'});
 }
 const blocked=state.products.find(p=>p.id===79);assert.equal(catalogDisplayPrice(blocked,{exchangeRate:rate}).amount,null);const response=await mf.dispatchFetch('https://isolated.test/api/shop',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'r19-lelabo-isolated','oai-authenticated-user-email':'isolated@example.test'},body:JSON.stringify({action:'estimate',items:[{productId:79,quantity:1}]})});assert.equal(response.status,409);checks++;
 await writeFile('verification/r19-lelabo-checkout-results.json',JSON.stringify({checks,scope:'Source-seeded Basil soap, Hinoki shower gel and pomade price parity plus blocked Another 13; disposable D1 and manual public reference FX, no live transactions',rows},null,2));console.log('PASS',checks,'Le Labo price and checkout checks');
}finally{await mf.dispose();}

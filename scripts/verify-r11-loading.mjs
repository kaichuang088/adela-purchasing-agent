import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const paths=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)),password=randomUUID();
const mf=new Miniflare({modules:['index.js',...paths.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PASSWORD:password},cf:false});
let n=0;const check=(v,l)=>{assert.ok(v,l);console.log(`PASS ${++n}: ${l}`)};
try{
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'live'})).run();
 const old={rate:.023668,at:'2026-10-01T00:00:00Z',source:'Cached fixture'};await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_rate_krw',?)").bind(JSON.stringify(old)).run();
 const load=async()=>{const r=await mf.dispatchFetch('https://adela.test/api/shop');assert.equal(r.status,200);return r.json()};
 const first=await load();check(first.products.length===117,'Compiled storefront retains all 117 existing products');
 check(first.products.find(p=>p.nameEn==='Beyblade X BX-01 Dran Sword 3-60F')?.stock===0,'Confirmed sold-out BX-01 supplier is not offered as an uncounted preorder');
 check(first.exchange.rate===old.rate&&first.exchange.at===old.at&&first.exchange.source.includes('結帳時重新確認'),'Browsing uses dated cached rates without calling external rate providers');
 check(!!await db.prepare("SELECT value FROM store_settings WHERE key='adela_catalog_ready_r12'").first(),'Full catalog initialization records durable completion');
 const id=first.products[0].id;await db.prepare("UPDATE products SET name_zh='Seller edited fixture',commerce_json=json_set(commerce_json,'$.stock',3) WHERE id=?").bind(id).run();
 const next=await load();check(next.products.find(p=>p.id===id)?.nameZh==='Seller edited fixture'&&next.products.find(p=>p.id===id)?.stock===3,'Warm loads preserve seller edits');
 const r=await mf.dispatchFetch('https://adela.test/api/operations');check(r.status===401,'Admin authentication remains protected');
 const aiStatusResponse=await mf.dispatchFetch('https://adela.test/api/system/status',{headers:{'X-KK-Admin-Password':password}}),aiStatus=await aiStatusResponse.json();
 check(aiStatusResponse.status===200&&!aiStatus.aiConfigured&&aiStatus.aiMissingConfiguration?.length>0,'Compiled admin reports missing AI configuration without claiming readiness');
 const aiCheck=await mf.dispatchFetch('https://adela.test/api/operations/ai-check',{method:'POST',headers:{'X-KK-Admin-Password':password}}),aiError=await aiCheck.json();
 check(aiCheck.status===503&&aiError.error.includes('尚未發送模型請求'),'Missing AI configuration fails before a provider request or order mutation');
 await mkdir('verification',{recursive:true});await writeFile('verification/r11-loading-results.json',JSON.stringify({checks:n,scope:'Compiled API in disposable D1; no browser or real payment E2E'},null,2));
}finally{await mf.dispose()}

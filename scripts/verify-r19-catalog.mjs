// Guarded source updates in disposable D1, never the online shop database.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare'),{build}=require('esbuild');
await mkdir('work',{recursive:true});
await build({stdin:{contents:"import {applyCatalogR19} from './lib/catalog-r19';export default {async fetch(request,env){await applyCatalogR19(env.DB);return new Response('ok')}};",resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',outfile:'work/r19-catalog-worker.mjs'});
const mf=new Miniflare({modules:true,scriptPath:resolve('work/r19-catalog-worker.mjs'),compatibilityDate:'2026-05-15',d1Databases:['DB'],cf:false});
let checks=0;const labels=[];const check=(ok,label)=>{assert.ok(ok,label);labels.push(label);console.log(`PASS ${++checks}: ${label}`)};
try{
 const db=await mf.getD1Database('DB');
 await db.batch(['CREATE TABLE products(id INTEGER PRIMARY KEY,name_en TEXT,price_jpy INTEGER,status TEXT,commerce_json TEXT,description_zh TEXT,description_en TEXT,updated_at TEXT)','CREATE TABLE store_settings(key TEXT PRIMARY KEY,value TEXT)','CREATE TABLE historical_orders(snapshot TEXT)','CREATE TABLE historical_wallet(snapshot TEXT)',"INSERT INTO historical_orders VALUES ('paid order with historical price and photo')","INSERT INTO historical_wallet VALUES ('protected top-up principal and bonus')"].map(s=>db.prepare(s)));
 const baseline=JSON.parse(await readFile('verification/r19-sourcing/catalog-baseline.json','utf8')).rows;
 await db.batch(baseline.map(p=>db.prepare('INSERT INTO products(id,name_en,price_jpy,status,commerce_json,description_zh,description_en) VALUES (?,?,?,?,?,?,?)').bind(p.id,p.name_en,p.price_jpy,p.status,p.commerce_json,p.description_zh,p.description_en)));
 const protectedIds=[71,79,80,81,82];
 await db.prepare('UPDATE products SET price_jpy=777777 WHERE id=71').run();
 await db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.adminNewerNote','preserve me') WHERE id=79").run();
 await db.prepare("UPDATE products SET status='paused' WHERE id=80").run();
 await db.prepare("UPDATE products SET name_en='Newer admin name' WHERE id=81").run();
 await db.prepare("UPDATE products SET description_zh='Newer admin introduction' WHERE id=82").run();
 const before=(await db.prepare('SELECT * FROM products ORDER BY id').all()).results;
 await Promise.all([mf.dispatchFetch('https://isolated.test'),mf.dispatchFetch('https://isolated.test')]);
 const after=(await db.prepare('SELECT * FROM products ORDER BY id').all()).results;
 for(const id of protectedIds)check(JSON.stringify(after.find(p=>p.id===id))===JSON.stringify(before.find(p=>p.id===id)),`Preserves newer administrator edit for ${id}`);
 for(const id of [3,4,42,43])check(after.find(p=>p.id===id).price_jpy>1,`Replaces researched placeholder cost for ${id} with real source price`);
 check(after.length===before.length&&after.every(p=>p.status===before.find(x=>x.id===p.id).status),'No products deleted or automatically published');
 const generic=JSON.parse(after.find(p=>p.id===3).commerce_json);
 check(generic.variants.length===3&&generic.variants.every(v=>v.stock===0&&v.sourceDeliveryConfirmed&&v.priceJpy>1)&&new Set(generic.variants.map(v=>v.imageUrl)).size===3,'Exact 15/50/100 mL references and distinct source photos; no invented stock');
 check(JSON.parse(after.find(p=>p.id===85).commerce_json).sourceDeliveryKrw===0&&after.find(p=>p.id===85).price_jpy===59000,'Hand lotion uses exact 250 mL public cost including qualifying domestic delivery');
 check((await db.prepare('SELECT snapshot FROM historical_orders').first()).snapshot==='paid order with historical price and photo'&&(await db.prepare('SELECT snapshot FROM historical_wallet').first()).snapshot==='protected top-up principal and bonus','Historical orders and wallet are untouched');
 await mf.dispatchFetch('https://isolated.test');check(JSON.stringify((await db.prepare('SELECT * FROM products ORDER BY id').all()).results)===JSON.stringify(after),'Concurrent application and repeated initialization are idempotent');
 await writeFile('verification/r19-catalog-results.json',JSON.stringify({checks,labels,scope:'Guarded updater with disposable D1; no online catalog or financial writes'},null,2));
}finally{await mf.dispose();}

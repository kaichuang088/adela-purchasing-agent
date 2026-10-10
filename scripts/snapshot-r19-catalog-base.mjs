// Only source-seeded product rows in disposable D1; never an online DB export.
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const files=(await readdir('dist/server',{recursive:true})).filter(x=>/\.m?js$/.test(x));
const mf=new Miniflare({modules:['index.js',...files.filter(x=>x!=='index.js')].map(x=>({type:'ESModule',path:resolve('dist/server',x)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],cf:false,outboundService:async()=>new Response('Isolated outbound disabled',{status:503})});
try{
 const db=await mf.getD1Database('DB');for(const name of(await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+name,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
 await mf.dispatchFetch('https://isolated.test/api/shop');
 if(await db.prepare("SELECT 1 FROM store_settings WHERE key='adela_sourcing_20261010_r19'").first())throw new Error('R19 updater is already present. The packaged R17 baseline is immutable; do not overwrite it using an R19 build.');
 const rows=(await db.prepare("SELECT id,name_zh,name_en,description_zh,description_en,price_jpy,status,commerce_json FROM products WHERE name_en LIKE '%Le Labo%' ORDER BY id").all()).results;
 await writeFile('verification/r19-sourcing/catalog-baseline.json',JSON.stringify({scope:'R17 source-seeded disposable product catalog only, before R19 updater integration; not a live database backup',rows},null,2));
 console.log('Captured',rows.length,'source-seeded Le Labo rows');
}finally{await mf.dispose();}

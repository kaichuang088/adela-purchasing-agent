import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
require('esbuild').buildSync({stdin:{contents:"export * from './lib/market-price'",resolveDir:resolve('.')},outfile:'work/r8-price.mjs',bundle:true,platform:'node',format:'esm'});
const {validTaiwanReferenceUrl,marketPriceCeiling}=await import('../work/r8-price.mjs');
let n=0;const check=(ok,label)=>{assert.ok(ok,label);console.log(`PASS ${++n}: ${label}`)};
for(const u of ['https://shopee.tw/item','https://www.shopee.tw/item','https://shp.ee/x','https://shopee.sg/x','https://shopee.link/x','https://a.shopeemobile.com/x'])assert.equal(validTaiwanReferenceUrl(u),false);
check(validTaiwanReferenceUrl('https://24h.pchome.com.tw/prod/ABC'),'Shopee country domains and short links rejected; retailer HTTPS accepted');
const basic={variants:[],taiwanRetailTwd:1000,taiwanRetailSource:'https://www.momoshop.com.tw/test'};
check(marketPriceCeiling(basic)===950&&marketPriceCeiling({...basic,taiwanRetailSource:'https://shopee.tw/x'})===null,'95% ceiling cannot use Shopee');
check(marketPriceCeiling({variants:[],taiwanAvailability:'not_sold'})===null,'Unsubstantiated Taiwan absence cannot enable checkout');
const paths=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)),password=randomUUID();
const mf=new Miniflare({modules:['index.js',...paths.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PASSWORD:password},cf:false});
async function call(path,body,status=200){const r=await mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-KK-Admin-Password':password,'oai-authenticated-user-id':'r8-qa','oai-authenticated-user-email':'r8-qa@example.test'},body:body?JSON.stringify(body):undefined});const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;}
try{
 const db=await mf.getD1Database('DB');for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await call('/api/shop',{action:'join',name:'R8 QA'});const shop=await call('/api/shop');
 const additions=JSON.parse(await readFile('lib/catalog-r8-additions.json','utf8'));
 check(additions.length===9&&additions.every(a=>shop.products.some(p=>p.nameEn===a.nameEn&&p.status==='active'&&marketPriceCeiling(p)!==null)),'Nine exact-spec additions are active with verified Taiwan reference prices');
 check(shop.products.every(p=>[p,...p.variants].every(v=>!v.taiwanRetailSource||validTaiwanReferenceUrl(v.taiwanRetailSource))),'No live catalog reference uses Shopee');
 const repairs=JSON.parse(await readFile('lib/catalog-r8-image-repairs.json','utf8'));
 check(repairs.every(a=>shop.products.some(p=>p.nameEn===a.nameEn&&p.imageUrl===a.imageUrl&&p.imageEdited)),'All 21 supplied image replacements applied');
 const base={action:'product',nameZh:'QA only',nameEn:'QA-only-absence',originalJpy:10000,imageUrl:additions[0].imageUrl,purchaseUrl:'https://example.com/product',categoryZh:'美妝與身體護理',status:'active',stock:-1};
 await call('/api/operations',{...base,taiwanRetailTwd:1000,taiwanRetailSource:'https://shopee.tw/x'},400);check(true,'Admin cannot save a Shopee comparison');
 await call('/api/operations',{...base,taiwanAvailability:'not_sold'},400);check(true,'Admin cannot declare Taiwan absence without evidence and confirmation');
 await call('/api/operations',{...base,taiwanAvailability:'not_sold',taiwanAbsenceEvidence:'Synthetic QA evidence for exact size. Not a real product or market claim.',taiwanAbsenceConfirmed:true});
 const absent=(await call('/api/shop')).products.find(p=>p.nameEn===base.nameEn);check(marketPriceCeiling(absent)===Number.MAX_SAFE_INTEGER&&!absent.taiwanRetailSource,'Reviewed absence round-trips without an invented Taiwan price or URL');
 const first=shop.products.find(p=>p.nameEn===additions[0].nameEn),row=await db.prepare('SELECT commerce_json FROM products WHERE id=?').bind(first.id).first();const data=JSON.parse(row.commerce_json);data.stock=3;data.salePriceTwd=5500;await db.prepare('UPDATE products SET commerce_json=? WHERE id=?').bind(JSON.stringify(data),first.id).run();
 await db.prepare("DELETE FROM store_settings WHERE key='adela_catalog_r8_20261003'").run();await call('/api/shop');const saved=JSON.parse((await db.prepare('SELECT commerce_json FROM products WHERE id=?').bind(first.id).first()).commerce_json);check(saved.stock===3&&saved.salePriceTwd===5500,'R8 retry preserves seller stock and custom price');
 check((await db.prepare('SELECT count(*) n FROM products WHERE name_en=?').bind(first.nameEn).first()).n===1,'R8 retry never duplicates additions');
 await writeFile('verification/r8-results.json',JSON.stringify({checks:n,scope:'Isolated disposable Worker and database; no real AI, inventory checkout or phone delivery'},null,2));
}finally{await mf.dispose()}

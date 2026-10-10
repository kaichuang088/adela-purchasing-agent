// API fixtures use a disposable database; never send fixture identity to the live site.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const paths=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)),password=randomUUID();
const mf=new Miniflare({modules:['index.js',...paths.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PASSWORD:password},cf:false,outboundService:async()=>new Response('Fixture outbound disabled',{status:503})});

try{
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await mf.dispatchFetch('https://adela.test/api/shop');
 const response=await mf.dispatchFetch('https://adela.test/api/operations',{headers:{'X-KK-Admin-Password':password}}),state=await response.json();assert.equal(response.status,200);
 const rawRows=(await db.prepare('SELECT id,commerce_json FROM products').all()).results;
 const rawById=new Map(rawRows.map(r=>[Number(r.id),JSON.parse(r.commerce_json||'{}')]));
 const fx=JSON.parse(await readFile('verification/r19-sourcing/exchange-rate-check.json','utf8'));
 const rate=Number(fx.results.find(x=>x.base==='KRW'&&x.result==='success')?.rateTwd);assert.ok(rate>0);
 const ps=state.products;
 const rows=ps.flatMap(p=>(p.variants.length?p.variants:[undefined]).map(v=>{
 const meta=rawById.get(p.id)||{},ref={...(v?meta.variants.find(x=>x.id===v.id):meta),...(v||p)},cost=v?.priceJpy??p.priceJpy,tw=ref.taiwanPromotionTwd>0?Math.min(ref.taiwanRetailTwd,ref.taiwanPromotionTwd):ref.taiwanRetailTwd,ceiling=tw>0?Math.floor(tw*.95):null,goods=Math.ceil(cost*rate),missing=[];
 if(p.status==='research'||cost<=1)missing.push('research 或占位成本');
 if(!(v?.labelZh||p.spec))missing.push('明確容量、重量、單位與包裝數');
 if(!(v?.imageUrl||p.imageKey||p.imageUrl))missing.push('商品照片');
 if(v&&!v.imageUrl)missing.push('該選項的對應照片');
 if(ref.sourceAssetBundled===false)missing.push('已查到原廠照片URL但新CDN資產未能下載入包');
 if(!(v?.purchaseUrl||p.purchaseUrl))missing.push('韓國購買來源');
 if(!(v?.sourceCheckedAt||p.sourceCheckedAt))missing.push('韓國查核日期');
 if(!ref.sourceDeliveryConfirmed&&!v?.acquisitionPack)missing.push('必要韓國運費與折扣條件確認');
 if(!ref.taiwanRetailTwd||!ref.taiwanRetailSource||!ref.taiwanRetailCheckedAt)missing.push('有效台灣同規格價格／來源／日期');
 if(ref.taiwanLowerReferenceNeedsRefresh)missing.push('原較低台灣來源未重驗；新官方價較高，未擅自提高比較基準');
 if(!ref.taiwanRetailSpec)missing.push('台灣同規格明確記錄');
 if(!['regular','public_promotion','preorder','ready_stock'].includes(ref.taiwanRetailClassification))missing.push('可核實的台灣一般／公開促銷／預購／現貨分類');
 if(ceiling!==null&&goods>ceiling)missing.push('成本高於95%上限');
 return{productId:p.id,name:p.nameZh,nameEn:p.nameEn,option:v?.labelZh||'',status:p.status,spec:v?.labelZh||p.spec,sourceDeliveryKrw:ref.sourceDeliveryKrw,sourceDeliveryConditions:ref.sourceDeliveryConditions,sourceSku:ref.sourceSku,sourcePhoto:v?.imageUrl||p.imageUrl,lowerReferenceNeedsRefresh:ref.taiwanLowerReferenceNeedsRefresh,currentOfficialEvidence:ref.taiwanCurrentOfficialEvidence,costKrw:cost,costTwd:cost>1?goods:null,rate,source:v?.purchaseUrl||p.purchaseUrl,sourceCheckedAt:v?.sourceCheckedAt||p.sourceCheckedAt,pack:v?.acquisitionPack||null,taiwanTwd:tw||null,taiwanSource:ref.taiwanRetailSource,taiwanCheckedAt:ref.taiwanRetailCheckedAt,classification:ref.taiwanRetailClassification,ceilingTwd:ceiling,costGapTwd:cost>1&&ceiling!==null?Math.max(0,goods-ceiling):null,missing};
 }));
 const report={scope:'R19 source-seeded disposable catalog, not live Sites DB; Public daily FX 0.023824 checked on 2026-10-10; not current shop settings or approved transaction FX',checkedAt:new Date().toISOString(),products:ps.length,variants:rows.length,issues:rows.filter(r=>r.missing.length&&!['discontinued','paused'].includes(r.status)),leLabo:rows.filter(r=>/le labo/i.test(r.name+' '+r.nameEn)),all:rows};
 await writeFile('verification/r19-catalog-audit.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({products:ps.length,variants:rows.length,issues:report.issues.length,leLabo:report.leLabo.length}));
}finally{await mf.dispose()}

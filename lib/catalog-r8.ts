import additions from './catalog-r8-additions.json';
import imageRepairs from './catalog-r8-image-repairs.json';
import {validTaiwanReferenceUrl} from './market-price';
export async function applyCatalogR8(db:D1Database){
 if(await db.prepare("SELECT value FROM store_settings WHERE key='adela_catalog_r8_20261003'").first())return;
 // Compare-and-swap updates preserve concurrent seller edits and historical orders.
 const rows=await db.prepare('SELECT id,name_en,commerce_json FROM products').all();
 for(const row of rows.results){
  const before=String(row.commerce_json||'{}'),c=JSON.parse(before);let changed=false;
  for(const ref of [c,...(Array.isArray(c.variants)?c.variants:[])]){
   if(!ref.taiwanRetailSource||validTaiwanReferenceUrl(ref.taiwanRetailSource))continue;
   ref.archivedTaiwanReference={price:ref.taiwanRetailTwd,source:ref.taiwanRetailSource,checkedAt:ref.taiwanRetailCheckedAt,removedReason:'Shopee references prohibited by merchant',removedAt:'2026-10-03'};
   if(String(row.name_en).includes('Orion Peelable Gummies'))Object.assign(ref,{taiwanRetailTwd:49,taiwanRetailSource:'https://www.koreatop.com.tw/SalePage/Index/11679230',taiwanRetailCheckedAt:'2026-10-03',taiwanRetailClassification:'official_importer_single_67g',taiwanPromotionTwd:0});
   else Object.assign(ref,{taiwanRetailTwd:0,taiwanRetailSource:'',taiwanRetailCheckedAt:'',taiwanPromotionTwd:0});
   changed=true;
  }
  const repair=imageRepairs.find(p=>p.nameEn===row.name_en&&p.oldImageUrl===c.imageUrl);
  if(repair){c.imageUrl=repair.imageUrl;c.imageEdited=true;c.previousImageUrl=repair.oldImageUrl;changed=true;}
  if(changed)await db.prepare('UPDATE products SET commerce_json=? WHERE id=? AND commerce_json=?').bind(JSON.stringify(c),row.id,before).run();
 }
 const statements=additions.map(p=>{
  const fragrance=p.category==='fragrance';
  const c={...p,catalogSourceId:p.id,country:'KR',currency:'KRW',taxIncludedJpy:p.priceKrw,taxRefundEligible:false,taiwanRetailCheckedAt:p.sourceCheckedAt,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,arrivalHours:0,addon:false};
  return db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json,sort_order) SELECT ?,?,?,?,?,?,?,?,?,-35 WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=? OR json_extract(commerce_json,'$.catalogSourceId')=?)").bind(p.nameZh,p.nameEn,fragrance?'香水與香氛':'美妝與身體護理',fragrance?'Fragrance':'Beauty & body care',p.descriptionZh,p.descriptionEn,p.priceKrw,p.status,JSON.stringify(c),p.nameEn,p.id);
 });
 await db.batch([...statements,db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_catalog_r8_20261003','true')")]);
}

import data from './catalog-r24-reviewed.json';
/** Only exact inspected product rows are changed; merchant edits remain untouched. */
export async function applyCatalogR24(db:D1Database){
 const key='adela_catalog_verified_r24';if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(key).first())return;
 const results=[];
 for(const patch of data.items){
  const copy=patch as typeof patch&{expectedDescriptionZh?:string;expectedDescriptionEn?:string;descriptionZh?:string;descriptionEn?:string;expectedNameZh?:string;expectedNameEn?:string;nameZh?:string;nameEn?:string};
  const row=await db.prepare('SELECT commerce_json,status,price_jpy,updated_at,description_zh,description_en,name_zh,name_en FROM products WHERE id=?').bind(patch.id).first();
  if(!row||row.commerce_json!==patch.expectedCommerce||row.status!==patch.expectedStatus||Number(row.price_jpy)!==patch.expectedPriceKrw||row.updated_at!==patch.expectedUpdatedAt||(copy.expectedDescriptionZh!==undefined&&row.description_zh!==copy.expectedDescriptionZh)||(copy.expectedDescriptionEn!==undefined&&row.description_en!==copy.expectedDescriptionEn)||(copy.expectedNameZh!==undefined&&row.name_zh!==copy.expectedNameZh)||(copy.expectedNameEn!==undefined&&row.name_en!==copy.expectedNameEn)){results.push({id:patch.id,status:'preserved_newer_edit'});continue;}
  const meta={...JSON.parse(String(row.commerce_json||'{}')),...patch.changes};
  const nextStatus=(patch as typeof patch&{nextStatus?:string}).nextStatus||String(row.status);
  const result=await db.prepare('UPDATE products SET price_jpy=?,commerce_json=?,status=?,description_zh=?,description_en=?,name_zh=?,name_en=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND commerce_json=? AND status=? AND price_jpy=? AND updated_at=? AND description_zh IS ? AND description_en IS ? AND name_zh IS ? AND name_en IS ?').bind(patch.priceKrw,JSON.stringify(meta),nextStatus,copy.descriptionZh??row.description_zh,copy.descriptionEn??row.description_en,copy.nameZh??row.name_zh,copy.nameEn??row.name_en,patch.id,patch.expectedCommerce,patch.expectedStatus,patch.expectedPriceKrw,patch.expectedUpdatedAt,row.description_zh,row.description_en,row.name_zh,row.name_en).run();
  const photoOnly=(patch as typeof patch&{photoOnly?:boolean}).photoOnly===true;
  results.push({id:patch.id,status:result.meta.changes?(photoOnly?'original_photo_added_review_pending':'verified_specs_applied'):'preserved_concurrent_edit'});
 }
 await db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES(?,?)').bind(key,JSON.stringify({at:new Date().toISOString(),results})).run();
}

import data from './catalog-r24-reviewed.json';
/** Only exact inspected product rows are changed; merchant edits remain untouched. */
export async function applyCatalogR24(db:D1Database){
 const key='adela_catalog_verified_r24';if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(key).first())return;
 const results=[];
 for(const patch of data.items){
  const row=await db.prepare('SELECT commerce_json,status,price_jpy,updated_at FROM products WHERE id=?').bind(patch.id).first();
  if(!row||row.commerce_json!==patch.expectedCommerce||row.status!==patch.expectedStatus||Number(row.price_jpy)!==patch.expectedPriceKrw||row.updated_at!==patch.expectedUpdatedAt){results.push({id:patch.id,status:'preserved_newer_edit'});continue;}
  const meta={...JSON.parse(String(row.commerce_json||'{}')),...patch.changes};
  const nextStatus=(patch as typeof patch&{nextStatus?:string}).nextStatus||String(row.status);
  const result=await db.prepare('UPDATE products SET price_jpy=?,commerce_json=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND commerce_json=? AND status=? AND price_jpy=? AND updated_at=?').bind(patch.priceKrw,JSON.stringify(meta),nextStatus,patch.id,patch.expectedCommerce,patch.expectedStatus,patch.expectedPriceKrw,patch.expectedUpdatedAt).run();
  const photoOnly=(patch as typeof patch&{photoOnly?:boolean}).photoOnly===true;
  results.push({id:patch.id,status:result.meta.changes?(photoOnly?'original_photo_added_review_pending':'verified_specs_applied'):'preserved_concurrent_edit'});
 }
 await db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES(?,?)').bind(key,JSON.stringify({at:new Date().toISOString(),results})).run();
}

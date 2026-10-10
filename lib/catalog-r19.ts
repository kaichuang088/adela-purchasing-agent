import verifiedUpdates from './catalog-r19-verified.json';

// Update only the unchanged handoff rows. An administrator's later edits win.
// Supplier availability is evidence, never a replacement for our inventory.
export async function applyCatalogR19(db:D1Database){
 const marker='adela_sourcing_20261010_r19';
 if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(marker).first())return;
 const statements=verifiedUpdates.map(update=>{
  const previous=JSON.parse(update.expectedCommerceJson);
  const next=JSON.stringify({...previous,...update.patch});
  return db.prepare(`UPDATE products SET price_jpy=?,commerce_json=?,description_zh=?,description_en=?,updated_at=CURRENT_TIMESTAMP
   WHERE id=? AND name_en=? AND price_jpy=? AND status=? AND commerce_json=?
   AND description_zh=? AND description_en=?
   AND NOT EXISTS(SELECT 1 FROM store_settings WHERE key=?)`)
   .bind(update.priceKrw,next,update.descriptionZh,update.descriptionEn,update.id,update.expectedNameEn,update.expectedPriceKrw,
    update.expectedStatus,update.expectedCommerceJson,update.expectedDescriptionZh,update.expectedDescriptionEn,marker);
 });
 await db.batch([...statements,db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES (?,?)').bind(marker,'2026-10-10')]);
}

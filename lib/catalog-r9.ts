import patches from './catalog-r9-verified.json';
export async function applyCatalogR9(db:D1Database){
 const key='adela_catalog_r9_verified_20261004';if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(key).first())return;
 const rows=(await db.prepare('SELECT id,name_en,status,commerce_json FROM products').all()).results,statements:D1PreparedStatement[]=[];
 for(const p of patches){const row=rows.find(r=>r.name_en===p.match);if(!row)continue;const before=String(row.commerce_json||'{}'),c=JSON.parse(before);const next={...c,...p,stock:Number(c.stock)>=0?c.stock:p.stock};
 statements.push(db.prepare("UPDATE products SET name_zh=?,name_en=?,price_jpy=?,description_zh=?,description_en=?,status=CASE WHEN status IN ('paused','discontinued') THEN status ELSE 'active' END,commerce_json=? WHERE id=? AND commerce_json=?").bind(p.nameZh,p.nameEn,p.priceKrw,p.descriptionZh,p.descriptionEn,JSON.stringify(next),row.id,before));}
 await db.batch([...statements,db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES (?,?)').bind(key,'true')]);
}

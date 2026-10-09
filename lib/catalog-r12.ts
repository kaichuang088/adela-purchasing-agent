import patches from './catalog-r12-verified.json';
export async function applyCatalogR12(db:D1Database){
 const key='adela_catalog_r12_verified_20261005';if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(key).first())return;
 const rows=(await db.prepare('SELECT id,name_en,status,commerce_json FROM products').all()).results,statements:D1PreparedStatement[]=[];
 for(const p of patches){const row=rows.find(r=>r.name_en===p.match);if(!row)continue;const before=String(row.commerce_json||'{}'),c=JSON.parse(before);const next={...c,...p,stock:Number(c.stock)>=0?c.stock:p.stock};
 statements.push(db.prepare("UPDATE products SET name_zh=?,name_en=?,price_jpy=?,description_zh=?,description_en=?,status=CASE WHEN status IN ('paused','discontinued') THEN status ELSE 'active' END,commerce_json=? WHERE id=? AND commerce_json=?").bind(p.nameZh,p.nameEn,p.priceKrw,p.descriptionZh,p.descriptionEn,JSON.stringify(next),row.id,before));}
 // Preserve counted seller inventory; correct an uncounted preorder source that is sold out.
 const soldOut=rows.find(r=>r.name_en==='Beyblade X BX-01 Dran Sword 3-60F');
 if(soldOut){const before=String(soldOut.commerce_json||'{}'),c=JSON.parse(before);if(Number(c.stock)<0&&c.purchaseUrl==='https://www.ntoyshop.com/shop/shopdetail.html?branduid=1086360'){
  const next={...c,stock:0,stockQuantityVerified:false,sourceCheckedAt:'2026-10-05',sourceNotes:'NTOYSHOP BX-01 原始來源公開標示缺貨（상품이 품절되었습니다），2026-10-05 核查；不宣稱整個韓國市場缺貨。'};
  statements.push(db.prepare('UPDATE products SET commerce_json=? WHERE id=? AND commerce_json=?').bind(JSON.stringify(next),soldOut.id,before));
 }}
 await db.batch([...statements,db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES (?,?)').bind(key,'true')]);
}

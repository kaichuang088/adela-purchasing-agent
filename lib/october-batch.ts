import patches from './catalog-r10-verified.json';
// Seller-requested October batch. Run once; future seller changes are preserved.
export const octoberBatch={purchaseAt:'2026-10-16T00:00:00+08:00',closesAt:'2026-10-15T23:59:59+08:00'};
export async function applyOctoberBatch(db:D1Database){
 const key='adela_october_batch_20261016_r10';if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(key).first())return;
 const at=new Date(octoberBatch.purchaseAt).toISOString(),cutoff=new Date(Date.parse(at)-86400000).toISOString();
 const rows=(await db.prepare("SELECT id,name_en,commerce_json FROM products").all()).results;
 const catalogChanges=patches.flatMap(p=>{const row=rows.find(r=>r.name_en===p.match);if(!row)return [];const prior=String(row.commerce_json||"{}"),c=JSON.parse(prior);return [db.prepare("UPDATE products SET name_zh=?,name_en=?,description_zh=?,description_en=?,price_jpy=?,status=CASE WHEN status IN ('paused','discontinued') THEN status ELSE 'active' END,commerce_json=? WHERE id=? AND commerce_json=?").bind(p.nameZh,p.nameEn,p.descriptionZh,p.descriptionEn,p.priceKrw,JSON.stringify({...c,...p,stock:Number.isInteger(c.stock)&&c.stock>=0?c.stock:p.stock}),row.id,prior)];});
 await db.batch([
 ...catalogChanges,
 db.prepare(`INSERT INTO store_settings(key,value) VALUES('commerce_settings',json_object('koreaPurchaseAt',?,'koreaPurchaseAtTo',?,'orderClosesAt',?)) ON CONFLICT(key) DO UPDATE SET value=json_set(store_settings.value,'$.koreaPurchaseAt',?,'$.koreaPurchaseAtTo',?,'$.orderClosesAt',?)`).bind(at,at,octoberBatch.closesAt,at,at,octoberBatch.closesAt),
 // Product schedules refer to the current open batch. Existing order snapshots
 // with a date or item decision remain unchanged.
 db.prepare(`UPDATE products SET commerce_json=json_set(commerce_json,'$.purchaseAt',?,'$.purchaseAtTo',?) WHERE json_extract(commerce_json,'$.country')='KR' AND status NOT IN ('discontinued','paused')`).bind(at,at),
 db.prepare(`UPDATE shopping_requests SET purchase_at=?,cancel_until=?,pricing_json=CASE WHEN pricing_json IS NULL THEN NULL ELSE json_set(pricing_json,'$.purchaseAt',?,'$.purchaseAtTo',?,'$.cancelUntil',?) END,updated_at=CURRENT_TIMESTAMP WHERE (purchase_at IS NULL OR purchase_at='') AND purchased_at IS NULL AND status IN ('submitted','admin_review','quoted','awaiting_payment','payment_review','paid','awaiting_cod') AND NOT EXISTS(SELECT 1 FROM kk_order_items i WHERE i.order_id=shopping_requests.id) AND NOT EXISTS(SELECT 1 FROM kk_price_revisions r WHERE r.order_id=shopping_requests.id AND r.status IN ('pending','accepted','settling'))`).bind(at,cutoff,at,at,cutoff),

 db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES (?,?)').bind(key,'true')
 ]);
}

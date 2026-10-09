import {rawDb} from './catalog';
import {ShopError} from './commerce';
export type CatalogBatch={type:'discontinue_products';productIds:number[]}|{type:'purchase_window';productIds:number[];from:string;to:string};
const eligible="status IN ('paid','awaiting_cod','awaiting_payment','customer_confirmed','payment_review','quoted') AND purchased_at IS NULL AND received_at IS NULL AND NOT EXISTS(SELECT 1 FROM kk_order_purchases p WHERE p.order_id=shopping_requests.id) AND NOT EXISTS(SELECT 1 FROM kk_price_revisions r WHERE r.order_id=shopping_requests.id AND r.status IN ('pending','accepted','settling'))";
export function validBatch(command:CatalogBatch){
 if(!['discontinue_products','purchase_window'].includes(command.type)||!Array.isArray(command.productIds)||!command.productIds.length||command.productIds.length>100||command.productIds.some(v=>!Number.isInteger(v)||v<=0)||new Set(command.productIds).size!==command.productIds.length)throw new ShopError('請提供不重複的明確商品。 / Select distinct catalog products.');
 if(command.type==='purchase_window')for(const date of [command.from,command.to])if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new ShopError('日期格式無效。 / Invalid date.');
 if(command.type==='purchase_window'&&(command.to<command.from||Date.parse(command.from+'T00:00:00+08:00')<=Date.now()))throw new ShopError('採買區間須在未來，結束不可早於開始。 / Choose a future purchase window.');
 return command;
}
async function snapshots(command:CatalogBatch){
 const db=rawDb(),products=(await db.prepare("SELECT id,name_zh,status,commerce_json,updated_at FROM products WHERE json_extract(commerce_json,'$.country')='KR' AND id IN (SELECT value FROM json_each(?)) ORDER BY id").bind(JSON.stringify(command.productIds)).all()).results;
 if(products.length!==command.productIds.length)throw new ShopError('商品已變更，請重新選擇。 / Catalog changed.',409);
 const orders=command.type==='purchase_window'?(await db.prepare(`SELECT id,request_no,status,pricing_json,updated_at FROM shopping_requests WHERE ${eligible} AND EXISTS(SELECT 1 FROM json_each(pricing_json,'$.items') i WHERE json_extract(i.value,'$.productId') IN (SELECT value FROM json_each(?))) ORDER BY id`).bind(JSON.stringify(command.productIds)).all()).results:[];
 if(orders.length>500)throw new ShopError('請縮小範圍至 500 筆訂單。 / Limit the batch to 500 orders.');
 return {products,orders};
}
export async function previewCatalogBatch(raw:CatalogBatch){
 const command=validBatch(raw),snapshot=await snapshots(command),id=crypto.randomUUID();
 await rawDb().prepare("INSERT INTO kk_admin_previews(id,command_json,snapshot_json,expires_at) VALUES(?,?,?,?)").bind(id,JSON.stringify(command),JSON.stringify(snapshot),new Date(Date.now()+600000).toISOString()).run();
 return{command:{type:command.type,previewId:id},products:snapshot.products.map(p=>({id:p.id,name:p.name_zh})),orders:snapshot.orders.map(o=>({id:o.id,requestNo:o.request_no})),summary:command.type==='discontinue_products'?`停售 ${snapshot.products.length} 項：${snapshot.products.map(p=>p.name_zh).join('、')}。既有訂單不變。`:`${snapshot.products.length} 項商品與 ${snapshot.orders.length} 筆未開始採買的訂單，採買區間改為 ${command.from} – ${command.to}（台灣時間）；取消截止隨開始日調整至前 24 小時。`};
}
export async function applyCatalogBatch(id:string){
 const db=rawDb(),preview=await db.prepare('SELECT * FROM kk_admin_previews WHERE id=?').bind(id).first();
 if(!preview||preview.status!=='pending'||String(preview.expires_at)<new Date().toISOString())throw new ShopError('預覽已使用或到期，請重新預覽。 / Preview used or expired.',409);
 const command=validBatch(JSON.parse(String(preview.command_json))),snapshot=JSON.parse(String(preview.snapshot_json));
 if(JSON.stringify(await snapshots(command))!==String(preview.snapshot_json))throw new ShopError('影響範圍已變更，請重新預覽。 / Affected records changed.',409);
 const token=crypto.randomUUID(),now=new Date().toISOString(),guard="EXISTS(SELECT 1 FROM kk_admin_previews WHERE id=? AND status='applying' AND claim_token=?)";
 // Claim checks every saved row again inside the same serialized D1 transaction.
 const changed="EXISTS(SELECT 1 FROM json_each(?,'$.products') s LEFT JOIN products p ON p.id=json_extract(s.value,'$.id') WHERE p.id IS NULL OR p.status!=json_extract(s.value,'$.status') OR p.commerce_json!=json_extract(s.value,'$.commerce_json') OR p.updated_at!=json_extract(s.value,'$.updated_at')) OR EXISTS(SELECT 1 FROM json_each(?,'$.orders') s LEFT JOIN shopping_requests o ON o.id=json_extract(s.value,'$.id') WHERE o.id IS NULL OR o.status!=json_extract(s.value,'$.status') OR o.pricing_json!=json_extract(s.value,'$.pricing_json') OR o.updated_at!=json_extract(s.value,'$.updated_at') OR o.purchased_at IS NOT NULL OR o.received_at IS NOT NULL OR EXISTS(SELECT 1 FROM kk_order_purchases p WHERE p.order_id=o.id) OR EXISTS(SELECT 1 FROM kk_price_revisions r WHERE r.order_id=o.id AND r.status IN ('pending','accepted','settling')))";
 const batch=[db.prepare(`UPDATE kk_admin_previews SET status='applying',claim_token=? WHERE id=? AND status='pending' AND expires_at>? AND NOT(${changed}) AND (?='discontinue_products' OR (SELECT COUNT(*) FROM shopping_requests WHERE ${eligible} AND EXISTS(SELECT 1 FROM json_each(pricing_json,'$.items') i WHERE json_extract(i.value,'$.productId') IN (SELECT value FROM json_each(?))))=?)`).bind(token,id,now,preview.snapshot_json,preview.snapshot_json,command.type,JSON.stringify(command.productIds),snapshot.orders.length)];
 for(const product of snapshot.products){
  if(command.type==='discontinue_products')batch.push(db.prepare(`UPDATE products SET status='discontinued',updated_at=? WHERE id=? AND ${guard}`).bind(now,product.id,id,token));
  else batch.push(db.prepare(`UPDATE products SET commerce_json=json_set(commerce_json,'$.purchaseAt',?,'$.purchaseAtTo',?),updated_at=? WHERE id=? AND ${guard}`).bind(new Date(command.from+'T00:00:00+08:00').toISOString(),new Date(command.to+'T23:59:59+08:00').toISOString(),now,product.id,id,token));
 }
 if(command.type==='purchase_window')for(const order of snapshot.orders){
  const p=JSON.parse(order.pricing_json),purchaseAt=new Date(command.from+'T00:00:00+08:00').toISOString(),purchaseAtTo=new Date(command.to+'T23:59:59+08:00').toISOString(),cancelUntil=new Date(Date.parse(purchaseAt)-86400000).toISOString();
  batch.push(db.prepare(`UPDATE shopping_requests SET purchase_at=?,cancel_until=?,pricing_json=?,updated_at=? WHERE id=? AND ${guard}`).bind(purchaseAt,cancelUntil,JSON.stringify({...p,purchaseAt,purchaseAtTo,cancelUntil}),now,order.id,id,token));
  batch.push(db.prepare(`INSERT INTO request_events(request_id,status,title_zh,title_en,detail_zh,detail_en,created_at) SELECT id,status,'採買區間更新','Purchase window updated',?, ?,? FROM shopping_requests WHERE id=? AND ${guard}`).bind(command.from+' – '+command.to,command.from+' – '+command.to,now,order.id,id,token));
  batch.push(db.prepare(`INSERT INTO kk_messages(delivery_key,member_id,order_id,title,title_en,body,body_en,created_at) SELECT ?,member_id,id,'採買區間更新','Purchase window updated',?,?,? FROM shopping_requests WHERE id=? AND member_id IS NOT NULL AND ${guard}`).bind('purchase-window:'+id+':'+order.id,order.request_no+'：'+command.from+' – '+command.to,order.request_no+': '+command.from+' – '+command.to,now,order.id,id,token));
 }
 batch.push(db.prepare("UPDATE kk_admin_previews SET status='applied',applied_at=?,claim_token=NULL WHERE id=? AND status='applying' AND claim_token=?").bind(now,id,token));
 const results=await db.batch(batch);if(!results[0].meta.changes)throw new ShopError('預覽已被使用或資料變更，請重新預覽。 / Preview changed.',409);
 return{updated:snapshot.orders.length,updatedProducts:snapshot.products.length};
}

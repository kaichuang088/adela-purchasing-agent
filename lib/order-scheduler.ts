// Reconciliation is also called on refresh. Scheduled execution passes the
// event's timestamp explicitly and does not require a page request.
export async function advancePurchasing(db:D1Database,at:Date){
 const now=at.toISOString();
 const eligible=`((status='paid' AND paid_at IS NOT NULL) OR (status='awaiting_cod' AND payment_method='cod')) AND purchased_at IS NULL AND received_at IS NULL AND purchase_at IS NOT NULL AND julianday(purchase_at)<=julianday(?) AND NOT EXISTS(SELECT 1 FROM kk_price_revisions r WHERE r.order_id=shopping_requests.id AND r.status IN ('pending','accepted','settling'))`;
 const results=await db.batch([
  db.prepare(`INSERT INTO request_events(request_id,status,title_zh,title_en,detail_zh,detail_en,created_at) SELECT id,'purchasing','採買中（自動）','Purchasing (automatic)','系統依訂單採買開始日自動更新；買到商品後由賣家回報。','Automatically started on the order purchase date; the seller reports successful purchase.',? FROM shopping_requests WHERE ${eligible}`).bind(now,now),
  db.prepare(`INSERT OR IGNORE INTO kk_messages(delivery_key,member_id,order_id,title,body,title_en,body_en,created_at) SELECT 'purchasing:'||id,member_id,id,'採買已開始（自動）',request_no||' 已到採買開始日，系統自動更新進度；買到商品後由賣家回報。','Purchasing started',request_no||': the purchase window has started.',? FROM shopping_requests WHERE member_id IS NOT NULL AND ${eligible}`).bind(now,now),
  db.prepare(`UPDATE shopping_requests SET status='purchasing',updated_at=? WHERE ${eligible}`).bind(now,now)
 ]);
 return {advanced:Number(results[2].meta.changes)||0};
}

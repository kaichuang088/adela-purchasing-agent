import {rawDb} from './catalog';
import {topupPlan} from './topup-policy';
import {ShopError,settings,requireShopOpen} from './commerce';
export async function topups(memberId?:string){return (await rawDb().prepare(`SELECT t.*,m.name AS member_name FROM kk_topups t JOIN kk_members m ON m.id=t.member_id ${memberId?'WHERE t.member_id=?':''} ORDER BY t.created_at DESC LIMIT 200`).bind(...(memberId?[memberId]:[])).all()).results;}
export async function createTopup(memberId:string,amount:number,id:string){
 const plan=topupPlan(amount);
 if(!plan||! /^[a-zA-Z0-9-]{20,80}$/.test(id))throw new ShopError('請選擇儲值 NT$2,000 或 NT$5,000。');
 await requireShopOpen();
 if(!(await settings()).bankAccount)throw new ShopError('賣家尚未設定收款帳戶。',409);
 const db=rawDb();await db.prepare('INSERT INTO kk_topups(id,member_id,amount_twd,bonus_twd) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,memberId,amount,plan.bonus).run();
 const row=await db.prepare('SELECT * FROM kk_topups WHERE id=? AND member_id=?').bind(id,memberId).first();
 if(!row||row.amount_twd!==amount)throw new ShopError('儲值請求已變更，請重新操作。',409);return row;
}
export async function reportTopup(memberId:string,id:string,reference:string){
 if(!/^\d{5}$/.test(reference))throw new ShopError('請輸入匯款帳號末五碼。');
 const r=await rawDb().prepare("UPDATE kk_topups SET status='payment_review',payment_reference=?,reported_at=? WHERE id=? AND member_id=? AND status IN ('awaiting_payment','payment_review')").bind(reference,new Date().toISOString(),id,memberId).run();
 if(!r.meta.changes)throw new ShopError('找不到待核對的儲值申請。',409);
}
export async function confirmTopup(id:string,reference:string){
 if(!reference.trim())throw new ShopError('請填寫實際銀行入帳核對紀錄。');
 const db=rawDb(),row=await db.prepare('SELECT * FROM kk_topups WHERE id=?').bind(id).first();
 if(row?.status==='confirmed')return;
 if(!row||row.status!=='payment_review')throw new ShopError('請先由會員回報匯款。',409);
 const token=crypto.randomUUID(),now=new Date().toISOString(),gate='EXISTS(SELECT 1 FROM kk_topups WHERE id=? AND confirmation_key=?)';
 const result=await db.batch([
 db.prepare("UPDATE kk_topups SET status='confirmed',admin_reference=?,confirmation_key=?,confirmed_at=? WHERE id=? AND status='payment_review'").bind(reference.trim().slice(0,500),token,now,id),
 db.prepare(`INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT ?,member_id,id,amount_twd,'儲值本金' FROM kk_topups WHERE id=? AND ${gate}`).bind('topup:'+id,id,id,token),
 db.prepare(`INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT ?,member_id,id,bonus_twd,'儲值贈送購物金' FROM kk_topups WHERE id=? AND ${gate}`).bind('topup-bonus:'+id,id,id,token),
 db.prepare(`INSERT INTO kk_messages(member_id,title,body,title_en,body_en) SELECT member_id,'儲值已入帳',?,'Top-up confirmed',? FROM kk_topups WHERE id=? AND ${gate}`).bind(`儲值 NT$${row.amount_twd}＋贈送 NT$${row.bonus_twd} 已入帳，可抵扣商品、代購費與運費。`,`NT$${row.amount_twd} plus NT$${row.bonus_twd} bonus is available for merchandise, fees and shipping.`,id,id,token)
 ]);if(!result[0].meta.changes)throw new ShopError('此儲值已由其他管理員處理，請重新載入。',409);
}

import {rawDb} from './catalog';
import {ShopError} from './commerce';
const validId=(s:string)=>/^[a-zA-Z0-9-]{20,80}$/.test(s);
const balanceSql='COALESCE((SELECT SUM(amount_twd) FROM kk_wallet_entries WHERE member_id=?),0)';
export async function creditWithdrawals(memberId?:string){return (await rawDb().prepare(`SELECT w.*,m.name AS member_name FROM kk_credit_withdrawals w JOIN kk_members m ON m.id=w.member_id ${memberId?'WHERE w.member_id=?':''} ORDER BY w.created_at DESC LIMIT 200`).bind(...(memberId?[memberId]:[])).all()).results;}
export async function requestCreditWithdrawal(memberId:string,b:Record<string,unknown>){
 const id=String(b.id||''),amount=Number(b.amount),code=String(b.bankCode||'').trim(),bank=String(b.bankName||'').trim(),account=String(b.accountNumber||'').replace(/[ -]/g,''),name=String(b.accountName||'').trim(),note=String(b.note||'').trim();
 if(!validId(id)||!Number.isSafeInteger(amount)||amount<=0||amount>10000000)throw new ShopError('請輸入有效的正整數退款金額。');
 if(!/^\d{3}$/.test(code)||bank.length<2||bank.length>80||!/^\d{6,20}$/.test(account)||!name||name.length>80||note.length>400)throw new ShopError('請填寫銀行代碼、銀行名稱、收款戶名及完整帳號。');
 const db=rawDb(),old=await db.prepare('SELECT * FROM kk_credit_withdrawals WHERE id=?').bind(id).first();
 const same=(r:Record<string,unknown>)=>r.member_id===memberId&&r.amount_twd===amount&&r.bank_code===code&&r.bank_name===bank&&r.account_number===account&&r.account_name===name&&r.note===note;
 if(old){if(!same(old))throw new ShopError('申請內容已變更，請重新送出。',409);return old;}
 const open=await db.prepare("SELECT id FROM kk_credit_withdrawals WHERE member_id=? AND status IN ('requested','processing')").bind(memberId).first();
 if(open)throw new ShopError('已有一筆轉帳退款申請處理中。',409);
 try{await db.batch([
  db.prepare('INSERT INTO kk_credit_withdrawals(id,member_id,amount_twd,bank_code,bank_name,account_number,account_name,note) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,memberId,amount,code,bank,account,name,note),
  // Reserving is a ledger debit in the SAME atomic batch. Existing overdraft trigger
  // protects against checkout/admin adjustments racing this request.
  db.prepare("INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT 'withdrawal-hold:'||id,member_id,id,-amount_twd,'轉帳退款申請保留款' FROM kk_credit_withdrawals w WHERE id=? AND NOT EXISTS(SELECT 1 FROM kk_wallet_entries e WHERE e.event_key='withdrawal-hold:'||w.id)").bind(id),
  db.prepare("INSERT OR IGNORE INTO kk_messages(member_id,title,body,title_en,body_en,delivery_key) SELECT member_id,'已收到轉帳退款申請',?,'Refund transfer requested',?,'withdrawal-request:'||id FROM kk_credit_withdrawals WHERE id=?").bind(`已保留 NT$${amount.toLocaleString()}，等待賣家處理；保留款不會再用於購物折抵。`,`NT$${amount.toLocaleString()} is reserved while the seller processes your bank refund.`,id)
 ]);}catch(e){const message=String(e);if(message.includes('STORE_CREDIT_CHANGED'))throw new ShopError('可用餘額不足或剛有異動，請重新載入。',409);if(message.includes('UNIQUE constraint'))throw new ShopError('已有申請處理中，請重新載入確認。',409);throw new ShopError('退款申請暫時無法送出，請稍後重新載入確認。',503);}
 const row=await db.prepare('SELECT * FROM kk_credit_withdrawals WHERE id=?').bind(id).first();
 if(!row||!same(row))throw new ShopError('申請內容衝突，請重新載入。',409);return row;
}
export async function resolveCreditWithdrawal(id:string,outcome:string,reference:string,note:string,memberId?:string){
 const db=rawDb(),row=await db.prepare('SELECT * FROM kk_credit_withdrawals WHERE id=?').bind(id).first();
 if(!row||(memberId&&row.member_id!==memberId))throw new ShopError('找不到轉帳退款申請。',404);
 if(memberId&&outcome!=='cancelled')throw new ShopError('無法操作此退款。',403);
 if(!['processing','paid','rejected','cancelled'].includes(outcome))throw new ShopError('退款狀態無效。');
 if(row.status===outcome)return;
 const permitted=outcome==='processing'?row.status==='requested':outcome==='cancelled'?row.status==='requested':outcome==='paid'?row.status==='processing':['requested','processing'].includes(String(row.status));
 if(!permitted)throw new ShopError('申請已處理或已開始轉帳，請重新載入。',409);
 if(outcome==='paid'&&!reference.trim())throw new ShopError('請完成銀行轉帳後，填寫轉帳核對紀錄。');
 if(outcome==='rejected'&&!note.trim())throw new ShopError('請填寫退回原因。');
 const key=crypto.randomUUID(),now=new Date().toISOString();
 const batch=[db.prepare('UPDATE kk_credit_withdrawals SET status=?,seller_note=?,transfer_reference=?,resolution_key=?,updated_at=?,paid_at=? WHERE id=? AND status=?').bind(outcome,note.trim().slice(0,400),reference.trim().slice(0,200),key,now,outcome==='paid'?now:null,id,row.status)];
 if(outcome==='cancelled'||outcome==='rejected')batch.push(db.prepare("INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT 'withdrawal-release:'||id,member_id,id,amount_twd,'轉帳退款申請取消，退回保留款' FROM kk_credit_withdrawals WHERE id=? AND resolution_key=?").bind(id,key));
 const label=outcome==='paid'?'轉帳退款已完成':outcome==='processing'?'賣家正在處理轉帳退款':outcome==='cancelled'?'轉帳退款申請已取消':'轉帳退款申請已退回';
 batch.push(db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,delivery_key) SELECT member_id,?,?,'Bank refund update',?,? FROM kk_credit_withdrawals WHERE id=? AND resolution_key=?").bind(label,`NT$${Number(row.amount_twd).toLocaleString()}。${outcome==='rejected'||outcome==='cancelled'?'保留款已退回可用餘額。':''}${note.trim().slice(0,400)}`,`NT$${row.amount_twd}: ${outcome}. ${note.trim().slice(0,400)}`,'withdrawal-update:'+key,id,key));
 const results=await db.batch(batch);if(!results[0].meta.changes)throw new ShopError('申請剛由其他人處理，請重新載入。',409);
}
export async function adjustMemberCredit(memberId:string,direction:string,amount:number,reason:string,id:string){
 if(!['add','deduct'].includes(direction)||!Number.isSafeInteger(amount)||amount<=0||amount>10000000||!reason.trim()||reason.length>400||!validId(id))throw new ShopError('請選擇增加或扣除，輸入正整數金額及調整原因；不要輸入負數。');
 const db=rawDb(),delta=direction==='add'?amount:-amount,key='admin-credit:'+id,description='管理員'+(delta>0?'增加':'扣除')+'購物金：'+reason.trim();
 if(!await db.prepare('SELECT id FROM kk_members WHERE id=?').bind(memberId).first())throw new ShopError('找不到會員。',404);
 const old=await db.prepare('SELECT * FROM kk_wallet_entries WHERE event_key=?').bind(key).first();
 if(old){if(old.member_id!==memberId||old.amount_twd!==delta||old.reason!==description)throw new ShopError('調整內容已變更，請重新操作。',409);return;}
 const result=await db.batch([
  db.prepare(`INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT ?,?,'',?,? WHERE ${balanceSql}+?>=0 AND NOT EXISTS(SELECT 1 FROM kk_wallet_entries WHERE event_key=?)`).bind(key,memberId,delta,description,memberId,delta,key),
  db.prepare("INSERT OR IGNORE INTO kk_messages(member_id,title,body,title_en,body_en,delivery_key) SELECT member_id,'購物金餘額已調整',?,'Credit balance adjusted',?,event_key FROM kk_wallet_entries WHERE event_key=? AND member_id=? AND amount_twd=? AND reason=?").bind(description+' NT$'+amount,`Credit ${direction}: NT$${amount}. ${reason}`,key,memberId,delta,description)
 ]);
 if(!result[0].meta.changes){const current=await db.prepare('SELECT * FROM kk_wallet_entries WHERE event_key=?').bind(key).first();if(current&&current.member_id===memberId&&current.amount_twd===delta&&current.reason===description)return;throw new ShopError('可用餘額不足，不能扣成負數。',409);}
}

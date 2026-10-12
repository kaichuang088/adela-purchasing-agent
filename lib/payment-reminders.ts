/** Local/testable job; deployment must attach 0 2 * * * (10:00 Asia/Taipei). */
export async function runPaymentReminders(db:D1Database,now=new Date()){
 const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',hourCycle:'h23'}).format(now);
 if(hour!=='10')return{sent:0,skipped:true};
 const config=await db.prepare("SELECT value FROM store_settings WHERE key='commerce_settings'").first();
 if(config&&JSON.parse(String(config.value)).remindersEnabled===false)return{sent:0,skipped:true};
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const result=await db.prepare(`INSERT OR IGNORE INTO kk_messages(delivery_key,member_id,order_id,title,body,title_en,body_en)
 SELECT 'payment-reminder:'||id||':'||?,member_id,id,'付款提醒',request_no||CASE WHEN julianday(?) - julianday(created_at)>=3 THEN ' 已下單超過三天，尚未確認付款；若已付款請至系統回報。' ELSE ' 尚未回報匯款。' END||'請查看訂單付款資訊，完成匯款後提供帳號末五碼或付款截圖，按「我已付款」。','Payment reminder',request_no||': Please view the bank details, transfer the payment, then submit the last five account digits or a payment screenshot.'
 FROM shopping_requests WHERE member_id IS NOT NULL AND payment_method='transfer' AND paid_at IS NULL AND payment_reported_at IS NULL AND status IN ('awaiting_payment','customer_confirmed')`).bind(day,now.toISOString()).run();
 return{sent:Number(result.meta.changes)||0,skipped:false};
}

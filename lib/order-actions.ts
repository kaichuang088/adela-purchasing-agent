import {rawDb} from './catalog';
import {addOrderUpdate,ShopError} from './commerce';
import type {Pricing} from './commerce-types';

export async function cancelOrder(id:number,memberId:string|null,reason='',_account='',admin=false){
 const db=rawDb(),row=await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(id).first();
 if(!row||!admin&&row.member_id!==memberId)throw new ShopError('找不到訂單。',404);
 if(row.status==='cancelled'&&row.cancellation_key)return;
 if(['cancelled','rejected','refunded','completed'].includes(String(row.status)))throw new ShopError('訂單已結案。',409);
 if(row.purchased_at||['purchasing','purchased','shipped_japan','arrived_taiwan'].includes(String(row.status))||row.purchase_at&&Date.now()>=Date.parse(String(row.purchase_at)))throw new ShopError('已開始採買，無法取消或申請退款。',409);
 if(!admin&&row.cancel_until&&Date.now()>=Date.parse(String(row.cancel_until)))throw new ShopError('已超過退款／取消截止時間。',409);
 if(await db.prepare('SELECT 1 FROM kk_order_purchases WHERE order_id=? LIMIT 1').bind(id).first())throw new ShopError('部分商品已買到，無法整筆自動退款，請聯絡客服。',409);
 if(await db.prepare('SELECT 1 FROM kk_order_items WHERE order_id=? LIMIT 1').bind(id).first())throw new ShopError('此訂單已有單品採買或延期紀錄，請使用單品處理流程。',409);
 if(!row.member_id)throw new ShopError('此訂單沒有可接收退款購物金的會員帳戶。');
 const pricing=row.pricing_json?JSON.parse(String(row.pricing_json)) as Pricing:null;
 const refund=(row.paid_at?pricing?.totalTwd||0:0)+(pricing?.creditAppliedTwd||0),token=crypto.randomUUID(),now=new Date().toISOString(),member=String(row.member_id);
 const earned=await db.prepare("SELECT COALESCE(SUM(miles-debt_delta),0) AS miles,COALESCE(SUM(spend_jpy),0) AS jpy,COALESCE(SUM(spend_krw),0) AS krw FROM kk_ledger WHERE order_id=? AND (event_key=? OR event_key LIKE 'revision:%')").bind(id,'payment:'+id).first();
 const spentMiles=Number(earned?.miles)||0,snack=row.snack_redeemed?30:0,pointDelta=snack-spentMiles;
 const title=admin?(refund>0?'非自願退款，已轉入購物金':'賣家取消訂單'):refund>0?'退款申請已通過，已轉入購物金':'訂單已取消';
 const message=refund>0?`訂單 ${row.request_no} 已取消。NT$${refund} 購物金已入帳，下筆訂單自動抵扣，未用完的餘額保留；原訂單的哩程與會員消費累計已回沖。`:`訂單 ${row.request_no} 已取消，無須付款。`;
 const gate="EXISTS(SELECT 1 FROM shopping_requests WHERE id=? AND cancellation_key=?)";
 const statements=[db.prepare("UPDATE shopping_requests SET status='cancelled',cancellation_key=?,refund_initiator=?,cancel_reason=?,refund_amount_twd=?,refund_reference='store_credit',updated_at=? WHERE id=? AND status=? AND purchased_at IS NULL AND updated_at=? AND paid_at IS ? AND pricing_json IS ? AND (purchase_at IS NULL OR purchase_at>?) AND (?=1 OR cancel_until IS NULL OR cancel_until>?) AND NOT EXISTS(SELECT 1 FROM kk_order_items WHERE order_id=shopping_requests.id) AND NOT EXISTS(SELECT 1 FROM kk_order_purchases WHERE order_id=shopping_requests.id)").bind(token,admin?'seller':'buyer',reason.trim().slice(0,1000)||(admin?'賣家取消（非自願退款）':'買家確認取消'),refund,now,id,row.status,row.updated_at,row.paid_at,row.pricing_json,now,admin?1:0,now)];
 if(refund>0)statements.push(db.prepare(`INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT ?,?,?,?,? WHERE ${gate}`).bind('refund:'+id,member,String(row.request_no),refund,title,id,token));
 statements.push(db.prepare(`INSERT INTO kk_ledger(event_key,member_id,order_id,miles,spend_jpy,spend_krw,reason,debt_delta) SELECT ?,id,?,CASE WHEN ?>=0 THEN MAX(0,?-miles_debt) ELSE MAX(-miles,?) END,?,?,?,CASE WHEN ?>=0 THEN -MIN(miles_debt,?) ELSE MAX(0,-(miles+?)) END FROM kk_members WHERE id=? AND ${gate}`).bind('cancel:'+id,id,pointDelta,pointDelta,pointDelta,-Number(earned?.jpy||0),-Number(earned?.krw||0),'取消回沖 / Cancellation reversal',pointDelta,pointDelta,pointDelta,member,id,token));
 statements.push(db.prepare(`UPDATE kk_members SET miles=miles+(SELECT miles FROM kk_ledger WHERE event_key=?),miles_debt=miles_debt+(SELECT debt_delta FROM kk_ledger WHERE event_key=?),spend_jpy=MAX(0,spend_jpy-?),spend_krw=MAX(0,spend_krw-?) WHERE id=? AND ${gate}`).bind('cancel:'+id,'cancel:'+id,Number(earned?.jpy||0),Number(earned?.krw||0),member,id,token));
 if(row.kind==='catalog'&&pricing)for(const item of pricing.items)if(item.productId)statements.push(db.prepare(`UPDATE products SET commerce_json=json_set(commerce_json,'$.stock',json_extract(commerce_json,'$.stock')+?) WHERE id=? AND json_extract(commerce_json,'$.stock')>=0 AND NOT EXISTS(SELECT 1 FROM kk_stock_reservations s JOIN shopping_requests o ON s.order_no=o.request_no WHERE o.id=${id} AND s.product_id=products.id AND s.debited=0) AND ${gate}`).bind(item.quantity,item.productId,id,token));
 statements.push(db.prepare(`DELETE FROM kk_urgent_orders WHERE order_no=? AND ${gate}`).bind(String(row.request_no),id,token));
 statements.push(db.prepare(`INSERT INTO request_events(request_id,status,title_zh,title_en,detail_zh,detail_en) SELECT ?,'cancelled',?,'Order cancelled',?,? WHERE ${gate}`).bind(id,title,message,message,id,token));
 statements.push(db.prepare(`INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) SELECT ?,?,?,'Cancellation approved',?,? WHERE ${gate}`).bind(member,title,message,message,id,id,token));
 const result=await db.batch(statements);if(!result[0].meta.changes)throw new ShopError('訂單已更新，請重新載入。',409);
}
export async function confirmReceived(id:number,memberId:string){
 const db=rawDb(),now=new Date().toISOString();
 const result=await db.prepare("UPDATE shopping_requests SET received_at=?,status=CASE WHEN paid_at IS NOT NULL THEN 'completed' ELSE 'arrived_taiwan' END,updated_at=? WHERE id=? AND member_id=? AND received_at IS NULL AND status IN ('shipped_japan','arrived_taiwan') AND purchased_at IS NOT NULL").bind(now,now,id,memberId).run();
 if(!result.meta.changes)throw new ShopError('此訂單尚不可確認收貨，或已確認過。 / Receipt is unavailable or already confirmed.',409);
 await addOrderUpdate(id,memberId,'received','顧客已確認收貨','Customer confirmed delivery','如有商品瑕疵，請於 24 小時內附照片申請換貨。 / For a defective item, request an exchange with a photo within 24 hours.');
}

export async function requestExchange(id:number,memberId:string,reason:string,file:File){
 const db=rawDb(),row=await db.prepare('SELECT * FROM shopping_requests WHERE id=? AND member_id=?').bind(id,memberId).first();
 if(!row)throw new ShopError('找不到訂單。 / Order not found.',404);
 if(!row.received_at||Date.now()-Date.parse(String(row.received_at))>86400000||['refunded','cancelled','rejected'].includes(String(row.status)))throw new ShopError('換貨需於確認收貨後 24 小時內申請。 / Request an exchange within 24 hours of receipt.',409);
 if(row.exchange_status)throw new ShopError('已有換貨申請，請查看處理進度。 / An exchange request already exists.',409);
 if(!reason.trim()||reason.length>1000||!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<8||file.size>1048576)throw new ShopError('請說明商品問題，並上傳 1 MB 以下的 JPG、PNG 或 WEBP 照片。 / Describe the defect and attach a JPG, PNG or WEBP under 1 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const valid=file.type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!valid)throw new ShopError('照片格式不正確。 / Invalid image format.');
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));
 const photoId=crypto.randomUUID(),now=new Date().toISOString();
 const result=await db.batch([
  db.prepare("UPDATE shopping_requests SET exchange_status='requested',exchange_reason=?,exchange_photo_id=?,updated_at=? WHERE id=? AND member_id=? AND exchange_status='' AND status NOT IN ('refunded','cancelled','rejected','refund_pending') AND received_at>=?").bind(reason.trim(),photoId,now,id,memberId,new Date(Date.now()-86400000).toISOString()),
  db.prepare('INSERT INTO kk_exchange_photos(id,order_id,member_id,content_type,data) SELECT ?,id,member_id,?,? FROM shopping_requests WHERE id=? AND exchange_photo_id=?').bind(photoId,file.type,btoa(binary),id,photoId),
 ]);
 if(!result[0].meta.changes)throw new ShopError('申請已更新或期限已過。 / Request changed or deadline passed.',409);
 await addOrderUpdate(id,memberId,'exchange_requested','瑕疵換貨申請已送出','Defect exchange requested',reason);
}

import {rawDb} from './catalog';
import {ShopError,orderBundle} from './commerce';
import {cancelOrder} from './order-actions';
import {proposeDefer} from './item-fulfilment';
export const orderCommandTypes=['order_note','order_notify','cancel_order','defer_item'];
export async function orderSnapshot(ids:number[]){const db=rawDb();return {orders:(await db.prepare('SELECT * FROM shopping_requests WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(JSON.stringify(ids)).all()).results,items:(await db.prepare('SELECT * FROM kk_order_items WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY order_id,line_index').bind(JSON.stringify(ids)).all()).results};}
export async function prepareOrderCommand(c:any){
 if(!orderCommandTypes.includes(c.type)||!Number.isSafeInteger(c.orderId)||c.orderId<1)throw new ShopError('請指定確切訂單編號，沒有執行任何操作。');
 const row=await rawDb().prepare('SELECT * FROM shopping_requests WHERE id=?').bind(c.orderId).first();if(!row)throw new ShopError('找不到這筆訂單。',404);
 const body=String(c.body||'').trim().slice(0,2000),reason=String(c.reason||'').trim().slice(0,1000),title=String(c.title||'').trim().slice(0,180);
 if(['order_note','order_notify'].includes(c.type)&&!body)throw new ShopError('備註／通知內容不可空白。');
 if(c.type==='order_notify'&&!title)throw new ShopError('通知需要標題。');
 if(['cancel_order','defer_item'].includes(c.type)&&!reason)throw new ShopError('取消或延期需要原因。');
 if(c.type==='defer_item'&&(!Number.isInteger(c.lineIndex)||c.lineIndex<0||!/^\d{4}-\d{2}-\d{2}/.test(String(c.date||''))||!Number.isFinite(Date.parse(c.date))||Date.parse(c.date)<=Date.now()))throw new ShopError('延期需要明確品項及未來採買日期。');
 const action={...c,body,reason,title};const labels:Record<string,string>={order_note:'新增內部備註',order_notify:'通知此訂單買家',cancel_order:'取消整筆訂單',defer_item:'提出品項延期'};
 return {command:{...action,summary:String(row.request_no)+'：'+labels[c.type]},preview:{summary:String(row.request_no)+'：'+labels[c.type],order:await orderBundle(row),body,reason,title,internal:c.type==='order_note',warning:c.type==='cancel_order'?'取消依伺服器規則核對；若已付款，按折扣後實付及原帳本退購物金。':c.type==='defer_item'?'發出48小時決定期限；未回覆自動接受，接受後贈一次95折券。':undefined}};
}
export async function applyOrderCommand(c:any,previewId:string){const db=rawDb();if(c.type==='cancel_order')return cancelOrder(c.orderId,null,c.reason,'',true);if(c.type==='defer_item')return proposeDefer(c.orderId,c.lineIndex,c.date,c.reason);if(c.type==='order_note'){await db.prepare('INSERT INTO kk_admin_order_notes(id,order_id,body) VALUES(?,?,?)').bind(previewId+':'+c.orderId+':'+c.index,c.orderId,c.body).run();return;}
 if(c.type==='order_notify'){const row=await db.prepare('SELECT member_id FROM shopping_requests WHERE id=?').bind(c.orderId).first();if(!row?.member_id)throw new ShopError('訂單沒有可通知的會員。');await db.prepare('INSERT OR IGNORE INTO kk_messages(member_id,title,body,title_en,body_en,order_id,delivery_key) VALUES(?,?,?,?,?,?,?)').bind(row.member_id,c.title,c.body,c.title,c.body,c.orderId,'ai-order:'+previewId+':'+c.index).run();return;}
 throw new ShopError('不支援的訂單操作。');}

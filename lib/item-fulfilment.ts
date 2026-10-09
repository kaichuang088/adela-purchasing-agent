import {rawDb} from './catalog';
import {ShopError,product} from './commerce';
import {fulfilmentPhoto} from './fulfilment-photo';
import type {Pricing,PriceLine} from './commerce-types';
type Row=Record<string,any>;
const closed=['cancelled','rejected','refunded','completed','shipped_japan','arrived_taiwan','on_hold'];
export type FulfilmentItem={lineIndex:number;line:PriceLine;status:string;purchaseAt:string|null;proposedAt:string|null;reason:string;refundTwd:number;purchasedAt:string|null};
export async function orderItems(row:Row):Promise<FulfilmentItem[]>{
 const p:Pricing|null=row.pricing_json?JSON.parse(row.pricing_json):null;if(!p)return [];
 const db=rawDb(),stored=(await db.prepare('SELECT * FROM kk_order_items WHERE order_id=?').bind(row.id).all()).results as Row[],legacy=(await db.prepare('SELECT product_id,purchased_at FROM kk_order_purchases WHERE order_id=?').bind(row.id).all()).results;
 return p.items.map((line,lineIndex)=>{const s=stored.find(x=>x.line_index===lineIndex),old=legacy.find(x=>x.product_id===line.productId);return {lineIndex,line:s?JSON.parse(s.snapshot_json):line,status:s?.status||(row.purchased_at||old?'purchased':'pending'),purchaseAt:s?.purchase_at||row.purchase_at||null,proposedAt:s?.proposed_at||null,reason:s?.reason||'',refundTwd:s?.refund_twd||0,purchasedAt:s?.purchased_at||old?.purchased_at||row.purchased_at||null}});
}
async function load(id:number){const row=await rawDb().prepare('SELECT * FROM shopping_requests WHERE id=?').bind(id).first() as Row|null;
 if(!row||closed.includes(row.status)||!row.pricing_json)throw new ShopError('訂單已結案、暫停或不存在。',409);
 if(await rawDb().prepare("SELECT 1 FROM kk_price_revisions WHERE order_id=? AND status IN ('pending','accepted','settling')").bind(id).first())throw new ShopError('請先完成訂單調價。',409);
 return {row,items:await orderItems(row),p:JSON.parse(row.pricing_json) as Pricing};
}
function lock(row:Row,items:FulfilmentItem[]){const db=rawDb();return [
 db.prepare("UPDATE shopping_requests SET fulfilment_version=?,updated_at=? WHERE id=? AND updated_at=? AND pricing_json=? AND status=? AND paid_at IS ? AND fulfilment_version=? AND NOT EXISTS(SELECT 1 FROM kk_price_revisions WHERE order_id=? AND status IN ('pending','accepted','settling'))").bind(crypto.randomUUID(),new Date().toISOString(),row.id,row.updated_at,row.pricing_json,row.status,row.paid_at,row.fulfilment_version||'',row.id),
 db.prepare("SELECT json(CASE WHEN changes()=1 THEN 'true' ELSE 'ITEM_STATE_CONFLICT' END)"),
 ...items.map(x=>db.prepare('INSERT OR IGNORE INTO kk_order_items(order_id,line_index,snapshot_json,status,purchase_at,purchased_at) VALUES (?,?,?,?,?,?)').bind(row.id,x.lineIndex,JSON.stringify(x.line),x.status,x.purchaseAt,x.purchasedAt))
 ];}
function notice(row:Row,title:string,body:string){const db=rawDb();return [db.prepare("INSERT INTO request_events(request_id,status,title_zh,title_en,detail_zh,detail_en) VALUES (?,'item_update',?,?,?,?)").bind(row.id,title,title,body,body),...(row.member_id?[db.prepare('INSERT INTO kk_messages(member_id,order_id,title,body,title_en,body_en) VALUES (?,?,?,?,?,?)').bind(row.member_id,row.id,title,body,title,body)]:[])];}
function reconcile(row:Row){const db=rawDb();return [db.prepare(`UPDATE shopping_requests SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM kk_order_items WHERE order_id=? AND status!='cancelled') THEN 'cancelled' WHEN NOT EXISTS(SELECT 1 FROM kk_order_items WHERE order_id=? AND status NOT IN ('purchased','cancelled')) THEN 'purchased' ELSE status END,purchased_at=CASE WHEN EXISTS(SELECT 1 FROM kk_order_items WHERE order_id=? AND status='purchased') AND NOT EXISTS(SELECT 1 FROM kk_order_items WHERE order_id=? AND status NOT IN ('purchased','cancelled')) THEN COALESCE(purchased_at,?) ELSE purchased_at END WHERE id=?`).bind(row.id,row.id,row.id,row.id,new Date().toISOString(),row.id)];}
export async function procurement(){
 const rows=(await rawDb().prepare("SELECT * FROM shopping_requests WHERE paid_at IS NOT NULL AND pricing_json IS NOT NULL AND status IN ('paid','purchasing','awaiting_cod') ORDER BY purchase_at,id").all()).results;
 const groups=new Map<string,any>();for(const row of rows)for(const item of await orderItems(row)){
 if(!['pending','deferred','defer_pending'].includes(item.status))continue;
 const key=JSON.stringify([item.line.productId||item.line.nameZh,item.line.variantId||'',item.purchaseAt,item.status==='defer_pending']);
 if(!groups.has(key))groups.set(key,{key,line:item.line,purchaseAt:item.purchaseAt,waiting:item.status==='defer_pending',quantity:0,orders:[]});
 const g=groups.get(key);g.quantity+=item.line.quantity;g.orders.push({orderId:row.id,lineIndex:item.lineIndex,quantity:item.line.quantity,requestNo:row.request_no,customerName:row.customer_name});
 }
 const catalog=(await rawDb().prepare('SELECT * FROM products').all()).results.map(product);
 return [...groups.values()].map(g=>{
  const pack=g.line.acquisitionPack;
  return {...g,acquisition:pack?{...pack,packs:Math.ceil(g.quantity/pack.units),buyUnits:Math.ceil(g.quantity/pack.units)*pack.units,budgetKrw:Math.ceil(g.quantity/pack.units)*pack.totalKrw}:null,line:{...g.line,imageUrl:fulfilmentPhoto(g.line,catalog)}};
 });
}
export async function proposeDefer(id:number,index:number,date:string,reason:string){
 const {row,items}=await load(id),item=items[index];if(!row.paid_at)throw new ShopError('單品延期需先核對付款。');
 if(!item||!['pending','deferred'].includes(item.status))throw new ShopError('此商品目前不可提出延期。',409);
 const at=Date.parse(date);if(!Number.isFinite(at)||at<=Date.now()||at<=Date.parse(item.purchaseAt||'1970-01-01')||!reason.trim())throw new ShopError('請填寫下一次採買日期與延期原因。');
 const next=new Date(at).toISOString(),body=`${row.request_no} · ${item.line.nameZh} ${item.line.variantLabelZh||''} × ${item.line.quantity}，擬延期至 ${new Date(at).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})}（台灣時間）。${reason.trim()}。請在訂單內接受或拒絕；拒絕會將該商品應退款轉為購物金。`;
 await rawDb().batch([...lock(row,items),rawDb().prepare("UPDATE kk_order_items SET status='defer_pending',proposed_at=?,reason=? WHERE order_id=? AND line_index=?").bind(next,reason.trim().slice(0,1000),id,index),...notice(row,'商品延期待確認',body)]);
}
export function refundAllocations(p:Pricing){
 const gross=p.items.map(x=>x.goodsTwd+x.feeTwd+x.sizeFeeTwd),sum=gross.reduce((a,b)=>a+b,0),net=p.beforeCreditTwd??p.totalTwd+(p.creditAppliedTwd||0);
 if(p.itemNetTwd?.length===gross.length&&p.itemNetTwd.every(x=>Number.isInteger(x)&&x>=0)&&p.itemNetTwd.reduce((a,b)=>a+b,0)+(p.shippingNetTwd??0)===net)return p.itemNetTwd;
 // Legacy quotes lack item coupon allocations. Proportionally share the actual
 // discount across merchandise and shipping; integer rounding is deterministic.
 const totalGross=sum+p.shippingTwd,merchandise=totalGross?Math.floor(net*sum/totalGross):0;let prior=0;
 return gross.map(x=>{const before=prior;prior+=x;return sum?Math.floor(merchandise*prior/sum)-Math.floor(merchandise*before/sum):0});
}
export async function decideDefer(id:number,index:number,memberId:string,accept:boolean){
 const owner=await rawDb().prepare('SELECT member_id FROM shopping_requests WHERE id=?').bind(id).first();if(owner?.member_id!==memberId)throw new ShopError('找不到訂單。',404);
 const {row,items,p}=await load(id),item=items[index];if(!item||item.status!=='defer_pending')throw new ShopError('延期已處理，請重新載入。',409);
 const db=rawDb(),statements=lock(row,items),now=new Date().toISOString();
 if(accept){statements.push(db.prepare("UPDATE kk_order_items SET status='deferred',purchase_at=proposed_at,proposed_at=NULL,decision_at=? WHERE order_id=? AND line_index=?").bind(now,id,index),...notice(row,'已接受商品延期',`${row.request_no} · ${item.line.nameZh} ${item.line.variantLabelZh||''} × ${item.line.quantity}，買家已接受延期。新採買日：${item.proposedAt}`));
 const dates=items.filter(x=>!['purchased','cancelled'].includes(x.status)).map(x=>x.lineIndex===index?item.proposedAt:x.purchaseAt);if(dates.every(x=>x&&Date.parse(x)>Date.now())){const first=dates.sort()[0]!;statements.push(db.prepare("UPDATE shopping_requests SET purchase_at=?,status=CASE WHEN status='purchasing' THEN 'paid' ELSE status END WHERE id=?").bind(first,id));}
 }else{
 if(!row.paid_at)throw new ShopError('此訂單尚未完成付款核對。',409);
 const last=items.every((x,i)=>i===index||x.status==='cancelled'),total=p.beforeCreditTwd??p.totalTwd+(p.creditAppliedTwd||0),refund=last?total-Number(row.item_refund_twd||0):refundAllocations(p)[index];
 const earned=await db.prepare("SELECT COALESCE(SUM(miles-debt_delta),0) AS miles,COALESCE(SUM(spend_jpy),0) AS jpy,COALESCE(SUM(spend_krw),0) AS krw FROM kk_ledger WHERE order_id=? AND (event_key=? OR event_key LIKE 'revision:%')").bind(id,'payment:'+id).first() as Row;
 const source=p.items.reduce((n,l)=>n+l.originalJpy*l.quantity,0),previous=items.filter(x=>x.status==='cancelled').reduce((n,x)=>n+x.line.originalJpy*x.line.quantity,0),next=previous+item.line.originalJpy*item.line.quantity;
 const part=(v:number)=>source?Math.floor(v*next/source)-Math.floor(v*previous/source):0;
 const miles=(last&&row.snack_redeemed?30:0)-part(Number(earned.miles)),jpy=part(Number(earned.jpy)),krw=part(Number(earned.krw)),key=`item-refund:${id}:${index}`;
 statements.push(db.prepare("UPDATE kk_order_items SET status='cancelled',refund_twd=?,decision_at=? WHERE order_id=? AND line_index=?").bind(refund,now,id,index),db.prepare("UPDATE shopping_requests SET item_refund_twd=item_refund_twd+?,refund_amount_twd=item_refund_twd+?,refund_initiator='seller',refund_reference='store_credit' WHERE id=?").bind(refund,refund,id),db.prepare("INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) VALUES (?,?,?,?,'非自願退款：拒絕單品延期')").bind(key,memberId,row.request_no,refund),db.prepare("INSERT INTO kk_ledger(event_key,member_id,order_id,miles,spend_jpy,spend_krw,reason,debt_delta) SELECT ?,id,?,CASE WHEN ?>=0 THEN MAX(0,?-miles_debt) ELSE MAX(-miles,?) END,?,?,?,CASE WHEN ?>=0 THEN -MIN(miles_debt,?) ELSE MAX(0,-(miles+?)) END FROM kk_members WHERE id=?").bind(key,id,miles,miles,miles,-jpy,-krw,'單品退款回沖',miles,miles,miles,memberId),db.prepare('UPDATE kk_members SET miles=miles+(SELECT miles FROM kk_ledger WHERE event_key=?),miles_debt=miles_debt+(SELECT debt_delta FROM kk_ledger WHERE event_key=?),spend_jpy=MAX(0,spend_jpy-?),spend_krw=MAX(0,spend_krw-?) WHERE id=?').bind(key,key,jpy,krw,memberId));
 if(item.line.productId)statements.push(db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.stock',json_extract(commerce_json,'$.stock')+?) WHERE id=? AND json_extract(commerce_json,'$.stock')>=0 AND EXISTS(SELECT 1 FROM kk_stock_reservations WHERE order_no=? AND product_id=? AND debited=1)").bind(item.line.quantity,item.line.productId,row.request_no,item.line.productId));
 if(last)statements.push(db.prepare('DELETE FROM kk_urgent_orders WHERE order_no=?').bind(row.request_no));
 statements.push(...notice(row,'非自願退款：商品延期未接受',`${row.request_no} · ${item.line.nameZh} ${item.line.variantLabelZh||''} × ${item.line.quantity}，已退 NT$${refund} 購物金${last?'（包含剩餘運費）':''}。`),...reconcile(row));
 }await db.batch(statements);
}
export async function purchaseItems(selections:{orderId:number;lineIndex:number}[]){
 if(!Array.isArray(selections)||!selections.length||selections.length>100)throw new ShopError('請選擇 1–100 個訂單品項。');
 const grouped=new Map<number,Set<number>>();for(const s of selections){if(!Number.isInteger(s.orderId)||!Number.isInteger(s.lineIndex))throw new ShopError('無效品項。');if(!grouped.has(s.orderId))grouped.set(s.orderId,new Set());grouped.get(s.orderId)!.add(s.lineIndex)}
 const statements:D1PreparedStatement[]=[],db=rawDb(),now=new Date().toISOString();for(const [id,indices] of grouped){const {row,items}=await load(id);if(!row.paid_at&&row.payment_method!=='cod')throw new ShopError('請先確認付款。');const targets=[...indices].map(i=>items[i]);if(targets.some(x=>!x||!['pending','deferred','purchased'].includes(x.status)))throw new ShopError('商品正在等待延期確認或已退款，不能標記買到。',409);const pending=targets.filter(x=>x.status!=='purchased');if(!pending.length)continue;statements.push(...lock(row,items));for(const x of pending)statements.push(db.prepare("UPDATE kk_order_items SET status='purchased',purchased_at=? WHERE order_id=? AND line_index=?").bind(now,id,x.lineIndex),...notice(row,'商品已買到',`${row.request_no} · ${x.line.nameZh} ${x.line.variantLabelZh||''} × ${x.line.quantity} 已由賣家確認買到。`));statements.push(...reconcile(row));}if(statements.length)await db.batch(statements);
}

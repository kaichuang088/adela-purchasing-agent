import {ShopError} from './commerce';
import type {Member,PaymentMethod} from './commerce-types';
export function paymentChoice(member:Member,value:unknown,cashConfirmed=false):PaymentMethod{const method=value===undefined?'transfer':value;if(!['transfer','cash','cod'].includes(String(method)))throw new ShopError('付款方式無效。 / Invalid payment method.');if(method==='cash'&&cashConfirmed!==true)throw new ShopError('請再次確認現金付款選項。 / Confirm the cash payment option.');if(method==='cod'&&member.tier!=='diamond')throw new ShopError('貨到付款僅限後台授予的金鑽會員。 / Cash on delivery is available to Diamond members only.',403);return method as PaymentMethod;}
export const transferDeadline=()=>new Date(Date.now()+3*86400000).toISOString();

// A zero-cash order has already reserved its wallet funds in the checkout batch.
export async function settleCreditOnly(id:number){
 const {rawDb}=await import('./catalog'),{addLedger,addOrderUpdate}=await import('./commerce');const db=rawDb();
 const row=await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(id).first();if(!row||row.paid_at)return;
 const p=JSON.parse(String(row.pricing_json||'{}'));if(p.totalTwd!==0)return;
 const now=new Date().toISOString();const r=await db.prepare("UPDATE shopping_requests SET status='paid',paid_at=?,payment_reference='購物金全額折抵',payment_due_at=NULL WHERE id=? AND paid_at IS NULL").bind(now,id).run();
 if(r.meta.changes){const korean=p.items[0]?.sourceCurrency==='KRW';await addLedger('payment:'+id,String(row.member_id),id,Math.floor(p.goodsJpy/(korean?5000:500)),p.goodsJpy,'購物金付款 / Store credit payment',korean?'KRW':'JPY');await addOrderUpdate(id,String(row.member_id),'paid','購物金已全額折抵','Paid with store credit');}
}

import {rawDb} from './catalog';
import {ShopError} from './commerce';
import {orderItems,purchaseItems} from './item-fulfilment';
export async function purchaseCandidates(productId:number){
 const rows=(await rawDb().prepare("SELECT * FROM shopping_requests WHERE status IN ('paid','purchasing','awaiting_cod') AND (paid_at IS NOT NULL OR payment_method='cod') AND NOT EXISTS(SELECT 1 FROM kk_price_revisions r WHERE r.order_id=shopping_requests.id AND r.status IN ('pending','accepted','settling')) ORDER BY id").all()).results;
 const result=[];for(const row of rows)if((await orderItems(row)).some(x=>x.line.productId===productId&&['pending','deferred'].includes(x.status)))result.push(row);return result;
}
export async function markProductPurchased(productId:number,expected:string){
 const rows=await purchaseCandidates(productId);if(JSON.stringify(rows.map(r=>[r.id,r.status,r.updated_at]))!==expected)throw new ShopError('符合訂單已變更，請重新預覽。',409);
 const selected=[];for(const row of rows)for(const x of await orderItems(row))if(x.line.productId===productId&&['pending','deferred'].includes(x.status))selected.push({orderId:Number(row.id),lineIndex:x.lineIndex});
 await purchaseItems(selected);return rows.length;
}

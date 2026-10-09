import {rawDb} from './catalog';
import {ShopError} from './commerce';
type Entry={event_key:string;member_id:string;order_no:string;amount_twd:number;reason:string;created_at:string};
const refundable=(key:string)=>/^(refund:|item-refund:|revision-credit:)/.test(key);
export function allocateCredits(entries:Entry[]){
 const buckets=new Map<string,Entry&{remaining:number;revoked:number}>();
 for(const e of entries){
  if(e.amount_twd>0){buckets.set(e.event_key,{...e,remaining:e.amount_twd,revoked:0});continue;}
  let debit=-e.amount_twd;
  if(e.event_key.startsWith('revoke-credit:')){const target=buckets.get(e.event_key.slice(14));if(target){target.remaining=Math.max(0,target.remaining-debit);target.revoked+=debit;}continue;}
  for(const b of buckets.values()){if(b.member_id!==e.member_id)continue;const used=Math.min(b.remaining,debit);b.remaining-=used;debit-=used;if(!debit)break;}
 }
 return [...buckets.values()].filter(e=>refundable(e.event_key));
}
async function entries(memberId?:string){return (await rawDb().prepare(`SELECT event_key,member_id,order_no,amount_twd,reason,created_at FROM kk_wallet_entries ${memberId?'WHERE member_id=?':''} ORDER BY created_at,rowid`).bind(...(memberId?[memberId]:[])).all()).results as Entry[];}
export async function refundCredits(){return allocateCredits(await entries());}
export async function revokeRefundCredit(memberId:string,key:string,reason:string){
 if(!reason.trim()||reason.length>400)throw new ShopError('請填寫取消原因（400字以內）。');
 const db=rawDb(),rows=await entries(memberId),reversal='revoke-credit:'+key;
 if(rows.some(e=>e.event_key===reversal))return;
 const target=allocateCredits(rows).find(e=>e.event_key===key);
 if(!target)throw new ShopError('找不到這位會員的退款金額券。',404);
 if(target.remaining<=0)throw new ShopError('這筆退款金額已使用，沒有可取消的餘額。',409);
 const result=await db.prepare(`INSERT OR IGNORE INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM kk_wallet_entries WHERE member_id=?)=?`).bind(reversal,memberId,target.order_no,-target.remaining,'取消退款金額券：'+reason.trim(),memberId,rows.length).run();
 if(!result.meta.changes)throw new ShopError('購物金剛有異動，請重新載入後再取消。',409);
}

import {rawDb} from './catalog';
import {allOffers,live,ShopError} from './commerce';
import type {Member,Offer} from './commerce-types';
export const offerForMember=(o:Offer,m:Member)=>o.tiers.includes(m.tier)&&(!o.memberId||o.memberId===m.id)&&(!o.memberEmail||o.memberEmail.toLowerCase()===m.email.toLowerCase());
export async function creditBalance(memberId:string){const row=await rawDb().prepare('SELECT COALESCE(SUM(amount_twd),0) AS balance FROM kk_wallet_entries WHERE member_id=?').bind(memberId).first();return Math.max(0,Number(row?.balance)||0);}
export async function claimCoupon(member:Member,code:string,id?:number){
 const offer=(await allOffers()).find(o=>id?o.id===id&&o.visibility==='public':!!o.code&&o.code===code.trim().toUpperCase());
 if(!offer||!live(offer)||!offerForMember(offer,member))throw new ShopError('優惠券不存在、已到期或不適用此會員。');
 if(!offer.code)throw new ShopError('此活動自動套用，不需要領券。');
 try{await rawDb().prepare('INSERT OR IGNORE INTO kk_coupon_claims(offer_id,member_id) VALUES(?,?)').bind(offer.id,member.id).run();}catch{throw new ShopError('此優惠券已領完。',409);}
 return offer;
}
export async function couponWallet(member:Member){
 const db=rawDb(),offers=await allOffers(),claims=(await db.prepare('SELECT offer_id FROM kk_coupon_claims WHERE member_id=?').bind(member.id).all()).results,uses=(await db.prepare('SELECT offer_id FROM kk_coupon_uses WHERE member_id=?').bind(member.id).all()).results;
 const claimed=new Set(claims.map(x=>Number(x.offer_id))),used=new Set(uses.map(x=>Number(x.offer_id)));
 const counts=(await db.prepare('SELECT offer_id,COUNT(*) AS n FROM kk_coupon_claims GROUP BY offer_id').all()).results;
 return offers.filter(o=>!!o.code&&(claimed.has(o.id)||o.visibility==='public'&&offerForMember(o,member)&&live(o))).map(o=>({...o,claimed:claimed.has(o.id),used:used.has(o.id),eligible:live(o)&&offerForMember(o,member)&&!used.has(o.id),soldOut:!!o.totalQuantity&&Number(counts.find(x=>Number(x.offer_id)===o.id)?.n||0)>=o.totalQuantity}));
}
export async function urgentRemaining(windowKey:string){return Math.max(0,10-Number((await rawDb().prepare('SELECT COUNT(*) AS n FROM kk_urgent_orders WHERE window_key=?').bind(windowKey).first())?.n||0));}

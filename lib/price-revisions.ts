import {rawDb} from './catalog';
import {legacyQuote,ShopError} from './commerce';
import type {Pricing} from './commerce-types';

const closed=['refund_pending','cancelled','rejected','refunded','completed','shipped_japan','arrived_taiwan','purchased'];
export function assertRepriceable(row:Record<string,unknown>){if(row.purchased_at||closed.includes(String(row.status)))throw new ShopError('商品已買到或訂單已結案，無法再調整價格。',409);}
export function revisePricing(previous:Pricing,changes:{originalJpy:number;sizeFeeTwd:number;sourceUrl?:string;nameZh?:string;nameEn?:string}[]):Pricing{
 if(changes.length!==previous.items.length)throw new ShopError('請完整保留原訂單品項。');
 const items=previous.items.map((line,i)=>{
  const c=changes[i],original=Number(c.originalJpy),size=Number(c.sizeFeeTwd);
  if(!Number.isInteger(original)||original<=0||original>100000000||!Number.isFinite(size)||size<0||size>100000)throw new ShopError('請輸入有效的商品原價及尺寸處理費。');
  const url=c.sourceUrl??line.sourceUrl;if(url&&!/^https:\/\//.test(url))throw new ShopError('購買來源需為 HTTPS 網址。');
  const goodsTwd=Math.ceil(original*line.quantity*previous.exchangeRate);
  return {...line,priceBasis:undefined,sourceCountry:line.sourceCurrency==='KRW'?'KR':undefined,sourceCurrency:line.sourceCurrency==='KRW'?'KRW':undefined,sourceAmount:line.sourceCurrency==='KRW'?original:undefined,sourceRateTwd:line.sourceCurrency==='KRW'?previous.exchangeRate:undefined,taxIncludedJpy:undefined,taxFreeConditions:undefined,taxEvidenceUrl:undefined,nameZh:(c.nameZh||line.nameZh).slice(0,180),nameEn:(c.nameEn||line.nameEn).slice(0,180),originalJpy:original,goodsTwd,feeTwd:Math.ceil(goodsTwd*line.feeRate/100),sizeFeeTwd:Math.ceil(size*line.quantity),sourceUrl:url};
 });
 const sum=(k:'goodsTwd'|'feeTwd'|'sizeFeeTwd')=>items.reduce((n,l)=>n+l[k],0);
 const discountTwd=Math.min(previous.discountTwd||0,sum('goodsTwd'));
 const beforeCreditTwd=Math.max(0,sum('goodsTwd')+sum('feeTwd')+sum('sizeFeeTwd')+previous.shippingTwd-discountTwd);
 const creditAppliedTwd=Math.min(previous.creditAppliedTwd||0,beforeCreditTwd);
 return {...previous,itemNetTwd:undefined,shippingNetTwd:undefined,discountTwd,items,goodsJpy:items.reduce((n,l)=>n+l.originalJpy*l.quantity,0),goodsTwd:sum('goodsTwd'),feeTwd:sum('feeTwd'),sizeFeeTwd:sum('sizeFeeTwd'),beforeCreditTwd,creditAppliedTwd,totalTwd:beforeCreditTwd-creditAppliedTwd,pricedAt:new Date().toISOString(),expiresAt:undefined};
}
// Recompute old, unsettled v9 proposals using the original wallet reservation.
// v9 totalTwd incorrectly included that credit a second time.
export function revisionPricing(previous:Pricing,proposed:Pricing){return {...revisePricing(previous,proposed.items.map(l=>({originalJpy:l.originalJpy,sizeFeeTwd:l.sizeFeeTwd/l.quantity,sourceUrl:l.sourceUrl,nameZh:l.nameZh,nameEn:l.nameEn}))),pricedAt:proposed.pricedAt};}
export const revisionReturn=(previous:Pricing,next:Pricing,paid:boolean)=>Math.max(0,paid?(previous.totalTwd+(previous.creditAppliedTwd||0))-(next.totalTwd+(next.creditAppliedTwd||0)):(previous.creditAppliedTwd||0)-(next.creditAppliedTwd||0));
export async function proposeRevision(row:Record<string,unknown>,pricing:Pricing,reason:string){
 assertRepriceable(row);if(!reason.trim())throw new ShopError('調價請填寫原因，旅客會收到價差通知。');
 const db=rawDb(),id=crypto.randomUUID(),now=new Date().toISOString(),before=String(row.pricing_json),previous=JSON.parse(before) as Pricing;
 const next=revisionPricing(previous,pricing),after=JSON.stringify(next),returned=revisionReturn(previous,next,!!row.paid_at);
 const gate='EXISTS(SELECT 1 FROM kk_price_revisions WHERE id=?)';
 const result=await db.batch([
 db.prepare("INSERT INTO kk_price_revisions(id,order_id,previous_json,proposed_json,reason,status,created_at) SELECT ?,id,pricing_json,?,?,?,? FROM shopping_requests WHERE id=? AND pricing_json=? AND purchased_at IS NULL AND paid_at IS ? AND status=? AND updated_at=? AND NOT EXISTS(SELECT 1 FROM kk_order_items WHERE order_id=shopping_requests.id) AND NOT EXISTS(SELECT 1 FROM kk_order_purchases WHERE order_id=shopping_requests.id) AND NOT EXISTS(SELECT 1 FROM kk_price_revisions WHERE order_id=? AND status IN ('pending','accepted','settling'))").bind(id,after,reason.slice(0,1000),row.paid_at?'pending':'settled',now,row.id,before,row.paid_at,row.status,row.updated_at,row.id),
 db.prepare(`UPDATE shopping_requests SET pricing_json=?,quote_json=?,status='quoted',payment_reference='',payment_reported_at=NULL,payment_photo_id=NULL,identified_name_zh=?,identified_name_en=?,updated_at=? WHERE id=? AND paid_at IS NULL AND ${gate}`).bind(after,JSON.stringify(legacyQuote(next,next.items[0].nameZh,next.items[0].nameEn)),next.items.map(l=>l.nameZh).join('、'),next.items.map(l=>l.nameEn).join(', '),now,row.id,id),
 ...(!row.paid_at&&returned&&row.member_id?[db.prepare(`INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT ?,?,?,?,'未付款調價退回多餘購物金 / Unpaid revision credit returned' WHERE ${gate}`).bind('revision-credit:'+id,row.member_id,row.request_no,returned,id)]:[]),
 db.prepare(`INSERT INTO request_events(request_id,status,title_zh,title_en,detail_zh,detail_en) SELECT ?,?,'商品報價調整','Price revision',?,? WHERE ${gate}`).bind(row.id,row.paid_at?row.status:'quoted',`${reason} · NT$${previous.totalTwd} → NT$${next.totalTwd}`,`${reason} · NT$${previous.totalTwd} → NT$${next.totalTwd}`,id),
 ...(row.member_id?[db.prepare(`INSERT INTO kk_messages(member_id,order_id,title,body,title_en,body_en) SELECT ?,?,'訂單價格調整',?,'Order price revision',? WHERE ${gate}`).bind(row.member_id,row.id,`${row.request_no} · ${reason} · NT$${previous.totalTwd} → NT$${next.totalTwd}。請查看並確認新報價。`,`${row.request_no}: NT$${previous.totalTwd} → NT$${next.totalTwd}. Review and confirm the revised quote.`,id)]:[])
 ]);if(!result[0].meta.changes)throw new ShopError('訂單已更新或仍有未完成的調價，請重新載入。',409);
}
export async function acceptRevision(id:string,memberId:string,accept:boolean){
 const db=rawDb();const result=await db.prepare("UPDATE kk_price_revisions SET status=?,accepted_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM shopping_requests s WHERE s.id=order_id AND s.member_id=? AND s.purchased_at IS NULL AND s.status NOT IN ('refund_pending','cancelled','rejected','refunded','completed'))").bind(accept?'accepted':'declined',new Date().toISOString(),id,memberId).run();if(!result.meta.changes)throw new ShopError('此調價已處理，請重新載入。',409);
}
export async function settleRevision(id:string,reference:string){
 const db=rawDb(),revision=await db.prepare('SELECT * FROM kk_price_revisions WHERE id=?').bind(id).first();if(!revision||revision.status!=='accepted')throw new ShopError('請先等待旅客同意調價。',409);
 const row=await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(revision.order_id).first();if(!row)throw new ShopError('找不到訂單。');assertRepriceable(row);
 if(!reference.trim())throw new ShopError('請輸入補款或退款核對資訊；零價差請填寫免補款。');
 const previous=JSON.parse(String(revision.previous_json)) as Pricing,next=revisionPricing(previous,JSON.parse(String(revision.proposed_json)) as Pricing),after=JSON.stringify(next);
 const korean=previous.items[0]?.sourceCurrency==='KRW',deltaSpend=next.goodsJpy-previous.goodsJpy,unit=korean?5000:500,deltaMiles=Math.floor(next.goodsJpy/unit)-Math.floor(previous.goodsJpy/unit),key='revision:'+id,now=new Date().toISOString(),token=crypto.randomUUID(),returned=revisionReturn(previous,next,!!row.paid_at);
 const gate="EXISTS(SELECT 1 FROM kk_price_revisions WHERE id=? AND status='settling' AND payment_reference=?)";
 const result=await db.batch([
 db.prepare("UPDATE kk_price_revisions SET status='settling',payment_reference=? WHERE id=? AND status='accepted' AND EXISTS(SELECT 1 FROM shopping_requests WHERE id=? AND pricing_json=? AND purchased_at IS NULL AND paid_at IS ? AND status=? AND updated_at=? AND NOT EXISTS(SELECT 1 FROM kk_order_items WHERE order_id=shopping_requests.id) AND NOT EXISTS(SELECT 1 FROM kk_order_purchases WHERE order_id=shopping_requests.id))").bind(token,id,row.id,revision.previous_json,row.paid_at,row.status,row.updated_at),
 db.prepare(`UPDATE shopping_requests SET pricing_json=?,quote_json=?,identified_name_zh=?,identified_name_en=?,updated_at=? WHERE id=? AND ${gate}`).bind(after,JSON.stringify(legacyQuote(next,next.items[0].nameZh,next.items[0].nameEn)),next.items.map(l=>l.nameZh).join('、'),next.items.map(l=>l.nameEn).join(', '),now,row.id,id,token),
 ...(row.member_id?[
 ...(returned?[db.prepare(`INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT ?,?,?,?,'調價差額退回購物金 / Revision difference returned as credit' WHERE ${gate}`).bind('revision-credit:'+id,row.member_id,row.request_no,returned,id,token)]:[]),
 db.prepare(`INSERT INTO kk_ledger(event_key,member_id,order_id,miles,spend_jpy,spend_krw,reason,debt_delta) SELECT ?,id,?,CASE WHEN ?>=0 THEN MAX(0,?-miles_debt) ELSE MAX(?,-miles) END,?,?,'調價已結清 / Price revision settled',CASE WHEN ?>=0 THEN -MIN(miles_debt,?) ELSE MAX(0,-(miles+?)) END FROM kk_members WHERE id=? AND ${gate}`).bind(key,row.id,deltaMiles,deltaMiles,deltaMiles,korean?0:deltaSpend,korean?deltaSpend:0,deltaMiles,deltaMiles,deltaMiles,row.member_id,id,token),
 db.prepare(`UPDATE kk_members SET miles=miles+(SELECT miles FROM kk_ledger WHERE event_key=?),miles_debt=miles_debt+(SELECT debt_delta FROM kk_ledger WHERE event_key=?),spend_jpy=spend_jpy+?,spend_krw=spend_krw+? WHERE id=? AND ${gate}`).bind(key,key,korean?0:deltaSpend,korean?deltaSpend:0,row.member_id,id,token),
 db.prepare(`INSERT INTO kk_messages(member_id,order_id,title,body,title_en,body_en) SELECT ?,?,'調價款項已核對',?,'Price difference settled',? WHERE ${gate}`).bind(row.member_id,row.id,`${row.request_no} · 新總額 NT$${next.totalTwd}，價差已結清。退回購物金 NT$${returned}。`,`${row.request_no}: revised cash total NT$${next.totalTwd}. Difference settled. Store credit returned: NT$${returned}.`,id,token)
 ]:[]),
 db.prepare(`INSERT INTO request_events(request_id,status,title_zh,title_en,detail_zh,detail_en) SELECT ?,?,'調價款項已核對','Price difference settled',?,? WHERE ${gate}`).bind(row.id,row.status,`NT$${previous.totalTwd} → NT$${next.totalTwd} · ${reference} · 購物金 NT$${returned}`,`NT$${previous.totalTwd} → NT$${next.totalTwd} · Credit returned NT$${returned}`,id,token),
 db.prepare("UPDATE kk_price_revisions SET status='settled',proposed_json=?,payment_reference=?,settled_at=? WHERE id=? AND status='settling' AND payment_reference=?").bind(after,reference.slice(0,180),now,id,token)
 ]);if(!result[0].meta.changes)throw new ShopError('訂單已變動，未入帳，請重新載入。',409);
}

import {ShopError} from './commerce';
export function purchaseRound(from:string,to:string,nextFrom?:string,nextTo?:string){
 const valid=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
 if(!valid(from)||!valid(to)||from>to||(nextFrom&&(!valid(nextFrom)||nextFrom<=to))||(nextTo&&(!nextFrom||!valid(nextTo)||nextTo<nextFrom)))throw new ShopError('採買區間或下一波日期無效。');
 const start=new Date(from+'T00:00:00+08:00'),end=new Date(to+'T23:59:59+08:00');
 return {from,to,closeAt:new Date(start.getTime()-60000).toISOString(),reopenAt:new Date(end.getTime()+1000).toISOString(),purchaseAt:start.toISOString(),purchaseAtTo:end.toISOString(),nextPurchaseAt:nextFrom?new Date(nextFrom+'T00:00:00+08:00').toISOString():null,nextPurchaseAtTo:nextFrom?new Date((nextTo||nextFrom)+'T23:59:59+08:00').toISOString():null};
}
export async function processPurchaseRounds(db:D1Database,at:Date){
 const row=await db.prepare("SELECT value FROM store_settings WHERE key='commerce_settings'").first();if(!row)return;
 const config=JSON.parse(String(row.value)),round=config.purchaseRound;if(!round||round.completedAt)return;
 if(at.getTime()>=Date.parse(round.reopenAt)){
  const next={...config,purchaseRound:{...round,completedAt:at.toISOString()},orderOpensAt:round.reopenAt,orderClosesAt:round.nextPurchaseAt?new Date(Date.parse(round.nextPurchaseAt)-60000).toISOString():'2099-12-31T00:00:00Z',koreaPurchaseAt:round.nextPurchaseAt,koreaPurchaseAtTo:round.nextPurchaseAtTo};
  await db.batch([db.prepare("UPDATE store_settings SET value=? WHERE key='commerce_settings' AND value=?").bind(JSON.stringify(next),row.value),db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES(?,?)").bind('round-reopened:'+round.from,at.toISOString())]);
 }
}

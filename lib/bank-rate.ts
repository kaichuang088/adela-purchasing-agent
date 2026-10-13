const BANK_URL='https://rate.bot.com.tw/xrt/flcsv/0/day';
const MARKET_URL='https://open.er-api.com/v6/latest/KRW';
const headers={'Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=300, stale-while-revalidate=300'};
const numberAt=(r:string[],i:number)=>{const n=Number(r[i]?.trim());return Number.isFinite(n)&&n>0?n:null;};
// Preserve the site's established midpoint basis. Cash conversion is a distinct
// administrator-selected basis, never silently substituted into existing orders.
export async function fetchBankRate(basis:'market_reference'|'bank_cash'='market_reference'){
 try{
  if(basis==='bank_cash'){
   const r=await fetch(BANK_URL,{signal:AbortSignal.timeout(7000),headers:{'User-Agent':'Adela-Purchasing-Agent/1.0'},cache:'no-store'});if(!r.ok)throw Error('Bank rate unavailable');
   const row=(await r.text()).split(/\r?\n/).map(x=>x.split(',')).find(x=>x[0]?.trim()==='KRW');if(!row)throw Error('KRW missing');
   const cashSelling=numberAt(row,12);if(!cashSelling)throw Error('KRW cash sell missing');
   return Response.json({currency:'KRW',quoteCurrency:'TWD',rate:cashSelling,basis,cashBuying:numberAt(row,2),cashSelling,spotBuying:numberAt(row,3),spotSelling:numberAt(row,13),sourceName:'臺灣銀行韓元現金賣出牌告',sourceUrl:'https://rate.bot.com.tw/xrt?Lang=zh-TW',fetchedAt:new Date().toISOString(),noteZh:'現金換匯參考價；並非信用卡實際結算匯率。'}, {headers});
  }
  const r=await fetch(MARKET_URL,{signal:AbortSignal.timeout(7000),headers:{'User-Agent':'Adela-Purchasing-Agent/1.0'},cache:'no-store'});if(!r.ok)throw Error('Market rate unavailable');
  const data=await r.json() as {result?:string;base_code?:string;rates?:Record<string,number>;time_last_update_utc?:string};const rate=Number(data.rates?.TWD);
  if(data.result!=='success'||data.base_code!=='KRW'||!(Number.isFinite(rate)&&rate>0))throw Error('Market rate invalid');
  return Response.json({currency:'KRW',quoteCurrency:'TWD',rate,basis,cashBuying:null,cashSelling:null,spotBuying:null,spotSelling:null,sourceName:'ExchangeRate-API 每日參考匯率',sourceUrl:'https://www.exchangerate-api.com',fetchedAt:data.time_last_update_utc?new Date(data.time_last_update_utc).toISOString():new Date().toISOString(),noteZh:'韓元兌台幣市場參考中間價，用於商店報價；不代表現金兌換或刷卡結算成本。'}, {headers});
 }catch{
  return Response.json({error:'目前無法取得所選韓元兌台幣參考匯率。'}, {status:503,headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}});
 }
}

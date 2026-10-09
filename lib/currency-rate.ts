import {rawDb} from './catalog';
import {ShopError} from './commerce';
import {supportedCurrencies} from './currency-options';
export {supportedCurrencies} from './currency-options';
export async function currencyRate(currency:string,krw:{rate:number}){
 if(currency==='TWD')return 1;
 if(currency==='KRW')return krw.rate;
 if(!supportedCurrencies.includes(currency as typeof supportedCurrencies[number]))throw new ShopError('不支援此幣別。 / Unsupported currency.');
 const db=rawDb(),key='currency_rate_'+currency;
 const old=await db.prepare('SELECT value FROM store_settings WHERE key=?').bind(key).first();
 if(old){const v=JSON.parse(String(old.value));if(Number(v.rate)>0&&Date.now()-Date.parse(v.at)<900000)return Number(v.rate);}
 const response=await fetch('https://rate.bot.com.tw/xrt/flcsv/0/day',{signal:AbortSignal.timeout(7000)});
 if(!response.ok)throw new ShopError(`${currency} 匯率暫時無法取得。 / Exchange rate unavailable.`,503);
 const row=(await response.text()).split(/\r?\n/).map(s=>s.split(',')).find(c=>c[0]?.trim()===currency);
 const rate=Number(row?.[12]);
 if(!Number.isFinite(rate)||rate<=0)throw new ShopError(`${currency} 匯率不可用，未建立訂單。 / Rate unavailable; no order was created.`,503);
 await db.prepare('INSERT INTO store_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify({rate,at:new Date().toISOString()})).run();
 return rate;
}

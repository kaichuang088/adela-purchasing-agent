import type {ShopOrder} from './commerce-types';

export async function fetchReceiptOrders(ids:number[],adminPassword?:string,send:typeof fetch=fetch):Promise<ShopOrder[]>{
 const headers:Record<string,string>={'Content-Type':'application/json'};
 if(adminPassword)headers['X-KK-Admin-Password']=adminPassword;
 const response=await send('/api/receipts',{method:'POST',headers,body:JSON.stringify({ids})});
 const data=await response.json() as {orders:ShopOrder[];error?:string};
 if(!response.ok)throw new Error(data.error||'無法讀取收據。 / Receipt unavailable.');
 return data.orders;
}

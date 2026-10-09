import {rawDb} from '@/lib/catalog';
import {isAdmin,privateJson} from '@/lib/admin-auth';
import {currentMember,orderBundle,ShopError} from '@/lib/commerce';
import {failure} from '@/app/api/shop/route';
export async function POST(request:Request){try{
 const admin=isAdmin(request),member=admin?null:await currentMember(request,true);
 const body=await request.json() as {ids?:unknown};
 if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>50||body.ids.some(id=>!Number.isSafeInteger(id)||id<1))throw new ShopError('請選擇 1 至 50 張訂單。 / Select 1 to 50 orders.');
 const ids=[...new Set(body.ids as number[])];
 if(!admin&&ids.length!==1)throw new ShopError('旅客一次只能下載一筆訂單收據。 / Customers can download one order receipt at a time.',400);
 const rows=(await rawDb().prepare(`SELECT * FROM shopping_requests WHERE id IN (${ids.map(()=>'?').join(',')}) ${admin?'':'AND member_id=?'} ORDER BY created_at,id`).bind(...ids,...(member?[member.id]:[])).all()).results;
 if(rows.length!==ids.length)throw new ShopError('無權讀取其中的訂單。 / An order is unavailable or not yours.',403);
 if(rows.some(r=>!r.pricing_json))throw new ShopError('尚未報價的訂單不能產生交易明細。 / An unpriced order cannot be included.');
 if(admin&&rows.length>1){const identities=new Set(rows.map(r=>r.member_id?`member:${r.member_id}`:`email:${String(r.email).trim().toLowerCase()}`));if(identities.size!==1)throw new ShopError('合併收據只能選擇同一位旅客的訂單。 / Combined receipts must belong to one customer.',400);}
 return privateJson({orders:await Promise.all(rows.map(orderBundle))});
 }catch(e){return failure(e);}}

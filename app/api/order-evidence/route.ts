import {rawDb} from '@/lib/catalog';
import {isAdmin,privateJson} from '@/lib/admin-auth';
import {currentMember} from '@/lib/commerce';
import {failure} from '@/app/api/shop/route';
export async function GET(request:Request){try{
 const id=new URL(request.url).searchParams.get('id'),admin=isAdmin(request),member=admin?null:await currentMember(request,true);
 const row=await rawDb().prepare('SELECT * FROM kk_exchange_photos WHERE id=?').bind(id||'').first();
 if(!row||!admin&&row.member_id!==member?.id)return privateJson({error:'Not found'},404);
 const bytes=Uint8Array.from(atob(String(row.data)),c=>c.charCodeAt(0));
 return new Response(bytes,{headers:{'Content-Type':String(row.content_type),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}catch(e){return failure(e);}}

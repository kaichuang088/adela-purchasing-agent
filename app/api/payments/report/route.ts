import {currentMember,ShopError,addOrderUpdate} from '@/lib/commerce';
import {rawDb} from '@/lib/catalog';
import {privateJson} from '@/lib/admin-auth';
import {failure} from '@/app/api/shop/route';
export async function POST(request:Request){try{
 const member=(await currentMember(request,true))!,f=await request.formData(),id=Number(f.get('id')),ref=String(f.get('reference')||'').trim(),file=f.get('image'),db=rawDb();
 const hasFile=file instanceof File&&file.size>0;
 if(ref&&!/^\d{5}$/.test(ref))throw new ShopError('帳號末五碼需為 5 位數字。');
 if(!ref&&!hasFile)throw new ShopError('請提供帳號末五碼或付款截圖，亦可同時提供。');
 let photoId:string|null=null,encoded='',mime='';
 if(hasFile){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1048576)throw new ShopError('截圖請使用 1 MB 以下 JPG、PNG 或 WEBP。');const bytes=new Uint8Array(await file.arrayBuffer());const valid=file.type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)throw new ShopError('圖片格式不正確。');let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));encoded=btoa(binary);photoId=crypto.randomUUID();mime=file.type;}
 const now=new Date().toISOString();const batch=[db.prepare("UPDATE shopping_requests SET payment_reference=?,payment_photo_id=COALESCE(?,payment_photo_id),payment_reported_at=?,status='payment_review',updated_at=? WHERE id=? AND member_id=? AND paid_at IS NULL AND payment_method='transfer' AND status IN ('awaiting_payment','payment_review')").bind(ref,photoId,now,now,id,member.id)];
 if(photoId)batch.push(db.prepare('INSERT INTO kk_exchange_photos(id,order_id,member_id,content_type,data) SELECT ?,id,member_id,?,? FROM shopping_requests WHERE id=? AND member_id=? AND payment_photo_id=?').bind(photoId,mime,encoded,id,member.id,photoId));
 const result=await db.batch(batch);if(!result[0].meta.changes)throw new ShopError('訂單目前無法回報付款。',409);
 await addOrderUpdate(id,member.id,'payment_review','已回報付款，等待賣家核對','Payment submitted for verification');return privateJson({ok:true});
}catch(e){return failure(e);}}

import {isAdmin,privateJson} from '@/lib/admin-auth';
import {photoInquiries,reviewPhotoInquiry} from '@/lib/photo-inquiries';
import {getMedia} from '@/lib/media-store';
import {rawDb} from '@/lib/catalog';
import {failure} from '@/app/api/shop/route';
export async function GET(request:Request){if(!isAdmin(request))return privateJson({error:'請登入。'},401);try{const id=new URL(request.url).searchParams.get('image');if(id){const row=await rawDb().prepare('SELECT d.image_key FROM kk_photo_inquiries i JOIN kk_photo_drafts d ON d.id=i.draft_id WHERE i.id=?').bind(id).first(),image=row?await getMedia(String(row.image_key)):null;return image?new Response(image.bytes,{headers:{'Content-Type':image.contentType,'Cache-Control':'private, no-store'}}):privateJson({error:'照片不存在'},404);}return privateJson({rows:await photoInquiries()});}catch(e){return failure(e);}}
export async function POST(request:Request){if(!isAdmin(request))return privateJson({error:'請登入。'},401);try{return privateJson({ok:true,...await reviewPhotoInquiry(await request.json() as any)});}catch(e){return failure(e);}}

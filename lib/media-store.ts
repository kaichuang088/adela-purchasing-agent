import {Buffer} from 'node:buffer';
import {env} from 'cloudflare:workers';
import {rawDb} from './catalog';

export const D1_MEDIA_LIMIT=900*1024;

export async function putMedia(key:string,data:ArrayBuffer|Uint8Array,contentType:string){
 const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
 if(env.BUCKET){await env.BUCKET.put(key,bytes,{httpMetadata:{contentType}});return;}
 if(bytes.byteLength>D1_MEDIA_LIMIT)throw new Error('D1_MEDIA_TOO_LARGE');
 await rawDb().prepare('INSERT OR REPLACE INTO kk_media(key,content_type,data,created_at) VALUES(?,?,?,CURRENT_TIMESTAMP)').bind(key,contentType,Buffer.from(bytes).toString('base64')).run();
}

export async function getMedia(key:string){
 if(env.BUCKET){const object=await env.BUCKET.get(key);if(!object)return null;return{bytes:new Uint8Array(await object.arrayBuffer()),contentType:object.httpMetadata?.contentType||'application/octet-stream',etag:object.httpEtag};}
 const row=await rawDb().prepare('SELECT content_type,data FROM kk_media WHERE key=?').bind(key).first();
 if(!row)return null;
 const bytes=Buffer.from(String(row.data),'base64');
 return{bytes:new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength),contentType:String(row.content_type),etag:`"d1-${key}"`};
}

export async function deleteMedia(key:string){
 if(env.BUCKET){await env.BUCKET.delete(key);return;}
 await rawDb().prepare('DELETE FROM kk_media WHERE key=?').bind(key).run();
}

export async function cleanupExpiredQuoteMedia(now=new Date().toISOString()){
 const db=rawDb();
 const expired=await db.prepare("SELECT id,image_key FROM kk_photo_drafts WHERE state!='purchased' AND expires_at<=? LIMIT 20").bind(now).all();
 for(const row of expired.results||[]){
  await deleteMedia(String(row.image_key)).catch(()=>undefined);
  await db.prepare("DELETE FROM kk_photo_drafts WHERE id=? AND state!='purchased' AND expires_at<=?").bind(row.id,now).run();
 }
}

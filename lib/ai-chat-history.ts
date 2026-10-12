import {rawDb} from './catalog';
import {ShopError} from './commerce';
export async function chatSession(kind:'admin'|'buyer',owner:string,id?:string){
 const db=rawDb();
 if(id){const row=await db.prepare('SELECT * FROM kk_ai_sessions WHERE id=? AND kind=? AND owner_id=?').bind(id,kind,owner).first();if(!row)throw new ShopError('對話不存在或不屬於此帳號。',404);return String(row.id);}
 const last=await db.prepare('SELECT id FROM kk_ai_sessions WHERE kind=? AND owner_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 1').bind(kind,owner).first();
 return last?String(last.id):newChatSession(kind,owner);
}
export async function newChatSession(kind:'admin'|'buyer',owner:string){const id=crypto.randomUUID();await rawDb().prepare('INSERT INTO kk_ai_sessions(id,kind,owner_id) VALUES(?,?,?)').bind(id,kind,owner).run();return id;}
export async function chatSessions(kind:'admin'|'buyer',owner:string){return (await rawDb().prepare('SELECT * FROM kk_ai_sessions WHERE kind=? AND owner_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 200').bind(kind,owner).all()).results;}
export async function adminChatMessage(id:string,role:string,body:string,payload?:unknown,attachments:unknown[]=[]){await rawDb().batch([rawDb().prepare('INSERT INTO kk_ai_chat_messages(session_id,role,body,payload_json,attachments_json) VALUES(?,?,?,?,?)').bind(id,role,body,payload?JSON.stringify(payload):null,JSON.stringify(attachments)),rawDb().prepare("UPDATE kk_ai_sessions SET updated_at=?,title=CASE WHEN title='新對話' AND ?='user' THEN ? ELSE title END WHERE id=?").bind(new Date().toISOString(),role,body.slice(0,40),id)]);}

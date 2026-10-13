import {rawDb} from './catalog';
import {ShopError} from './commerce';
export async function chatSession(kind:'admin'|'buyer',owner:string,id?:string){
 const db=rawDb();
 if(id){const row=await db.prepare('SELECT * FROM kk_ai_sessions WHERE id=? AND kind=? AND owner_id=?').bind(id,kind,owner).first();if(!row)throw new ShopError('對話不存在或不屬於此帳號。',404);return String(row.id);}
 const last=await db.prepare('SELECT id FROM kk_ai_sessions WHERE kind=? AND owner_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 1').bind(kind,owner).first();
 return last?String(last.id):newChatSession(kind,owner);
}
export async function activeBuyerSession(owner:string,requested?:string){
 const row=await rawDb().prepare("SELECT id FROM kk_ai_sessions WHERE kind='buyer' AND owner_id=? ORDER BY rowid DESC LIMIT 1").bind(owner).first();
 const id=row?String(row.id):await newChatSession('buyer',owner);
 if(requested&&requested!==id)throw new ShopError('前台僅可使用目前對話，歷史對話由管理員保留。',403);
 return id;
}
export async function newChatSession(kind:'admin'|'buyer',owner:string){const id=crypto.randomUUID();await rawDb().prepare('INSERT INTO kk_ai_sessions(id,kind,owner_id) VALUES(?,?,?)').bind(id,kind,owner).run();return id;}
export async function chatSessions(kind:'admin'|'buyer',owner:string){return (await rawDb().prepare('SELECT * FROM kk_ai_sessions WHERE kind=? AND owner_id=? ORDER BY updated_at DESC,rowid DESC').bind(kind,owner).all()).results;}
export async function adminChatMessage(id:string,role:string,body:string,payload?:unknown,attachments:unknown[]=[]){await rawDb().batch([rawDb().prepare('INSERT INTO kk_ai_chat_messages(session_id,role,body,payload_json,attachments_json) VALUES(?,?,?,?,?)').bind(id,role,body,payload?JSON.stringify(payload):null,JSON.stringify(attachments)),rawDb().prepare("UPDATE kk_ai_sessions SET updated_at=?,title=CASE WHEN title='新對話' AND ?='user' THEN ? ELSE title END WHERE id=?").bind(new Date().toISOString(),role,body.slice(0,40),id)]);}

import {rawDb} from './catalog';
import {createPassword,ensureMemberAuthSchema} from './member-auth';
import {ShopError} from './commerce';
export async function createAdminMember(body:Record<string,unknown>){
 const name=String(body.name||'').trim().slice(0,80),email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
 if(!name||email.length>160||!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>128)throw new ShopError('請填姓名、有效 Email 與至少 8 字元的會員密碼。');
 await ensureMemberAuthSchema();const db=rawDb();
 if(await db.prepare('SELECT id FROM kk_members WHERE lower(email)=?').bind(email).first())throw new ShopError('此 Email 已有會員；請選擇原會員，不能覆蓋帳號或密碼。',409);
 const id='member:'+crypto.randomUUID(),credentials=await createPassword(password);
 try{await db.batch([
  db.prepare('INSERT INTO kk_members(id,name,email,miles) VALUES(?,?,?,5)').bind(id,name,email),
  db.prepare('INSERT INTO kk_member_credentials(email,member_id,password_hash,salt) VALUES(?,?,?,?)').bind(email,id,credentials.passwordHash,credentials.salt),
  db.prepare("INSERT INTO kk_ledger(event_key,member_id,miles,reason) VALUES(?,?,5,'管理員建立會員：新會員禮 / Admin-created welcome miles')").bind('welcome:'+id,id)
 ]);}catch{throw new ShopError('帳號已存在或資料更新失敗，請重新整理。',409);}
 return {id,name,email};
}

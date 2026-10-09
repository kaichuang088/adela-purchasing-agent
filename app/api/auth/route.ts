import {rawDb} from '@/lib/catalog';
import {clearSessionCookie,createPassword,createSession,destroySession,ensureMemberAuthSchema,sessionCookie,verifyPassword} from '@/lib/member-auth';
import {ShopError} from '@/lib/commerce';
import {failure} from '@/app/api/shop/route';

function json(body:unknown,status=200,cookie?:string){const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json'});if(cookie)headers.set('Set-Cookie',cookie);return new Response(JSON.stringify(body),{status,headers});}
function email(value:unknown){const result=String(value||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)||result.length>160)throw new ShopError('請輸入有效的電子郵件。 / Enter a valid email.');return result;}
function password(value:unknown){const result=String(value||'');if(result.length<8||result.length>128)throw new ShopError('密碼至少需要 8 個字元。 / Password must be at least 8 characters.');return result;}

export async function POST(request:Request){try{
 const body=await request.json() as Record<string,unknown>,action=String(body.action||''),db=rawDb();
 await ensureMemberAuthSchema();
 if(action==='logout'){await destroySession(request);return json({ok:true},200,clearSessionCookie());}
 const mail=email(body.email),pass=password(body.password);
 if(action==='signup'){
  const name=String(body.name||'').trim().slice(0,80);if(!name)throw new ShopError('請輸入姓名。 / Enter your name.');
  if(await db.prepare('SELECT email FROM kk_member_credentials WHERE email=?').bind(mail).first())throw new ShopError('此 Email 已註冊，請直接登入。 / This email is already registered.',409);
  const linked=await db.prepare('SELECT id FROM kk_members WHERE lower(email)=? ORDER BY created_at LIMIT 1').bind(mail).first(),memberId=linked?String(linked.id):'member:'+crypto.randomUUID(),credentials=await createPassword(pass);
  const statements=[];
  if(!linked)statements.push(db.prepare('INSERT INTO kk_members(id,name,email,miles) VALUES(?,?,?,5)').bind(memberId,name,mail),db.prepare("INSERT INTO kk_ledger(event_key,member_id,miles,reason) VALUES(?,?,5,'新會員禮 / Welcome miles')").bind('welcome:'+memberId,memberId));
  else statements.push(db.prepare('UPDATE kk_members SET name=? WHERE id=?').bind(name,memberId));
  statements.push(db.prepare('INSERT INTO kk_member_credentials(email,member_id,password_hash,salt) VALUES(?,?,?,?)').bind(mail,memberId,credentials.passwordHash,credentials.salt));
  await db.batch(statements);const token=await createSession(memberId);return json({ok:true},201,sessionCookie(token));
 }
 if(action==='login'){
  const row=await db.prepare('SELECT member_id,password_hash,salt FROM kk_member_credentials WHERE email=?').bind(mail).first();
  if(!row||!await verifyPassword(pass,String(row.salt),String(row.password_hash)))throw new ShopError('Email 或密碼不正確。 / Incorrect email or password.',401);
  const token=await createSession(String(row.member_id));return json({ok:true},200,sessionCookie(token));
 }
 throw new ShopError('不支援的登入操作。 / Unsupported sign-in action.');
}catch(e){return failure(e);}}

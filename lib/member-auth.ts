import {rawDb} from './catalog';

const COOKIE='kk_session';
const DAYS=30;
const PASSWORD_ITERATIONS=100000;
const enc=new TextEncoder();
let authSchemaReady:Promise<void>|null=null;

export function ensureMemberAuthSchema(){
 if(authSchemaReady)return authSchemaReady;
 const db=rawDb();
 authSchemaReady=db.batch([
  db.prepare(`CREATE TABLE IF NOT EXISTS kk_member_credentials (
   email TEXT PRIMARY KEY NOT NULL,
   member_id TEXT NOT NULL,
   password_hash TEXT NOT NULL,
   salt TEXT NOT NULL,
   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
   updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`),
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS kk_member_credentials_member_id_unique ON kk_member_credentials(member_id)'),
  db.prepare(`CREATE TABLE IF NOT EXISTS kk_member_sessions (
   token_hash TEXT PRIMARY KEY NOT NULL,
   member_id TEXT NOT NULL,
   expires_at TEXT NOT NULL,
   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_member_sessions_member_expiry ON kk_member_sessions(member_id,expires_at)'),
 ]).then(()=>undefined).catch(error=>{authSchemaReady=null;throw error;});
 return authSchemaReady;
}

function hex(bytes:ArrayBuffer|Uint8Array){return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function randomHex(size=32){const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return hex(bytes);}
async function sha256(value:string){return hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));}

async function passwordDigest(password:string,salt:string,iterations=PASSWORD_ITERATIONS){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations},key,256));
}

function safeEqual(a:string,b:string){
 if(a.length!==b.length)return false;
 let different=0;for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);
 return different===0;
}

function cookieValue(request:Request,name:string){
 for(const part of (request.headers.get('cookie')||'').split(';')){const at=part.indexOf('=');if(at>0&&part.slice(0,at).trim()===name)return decodeURIComponent(part.slice(at+1).trim());}
 return '';
}

export function sessionCookie(token:string,maxAge=60*60*24*DAYS){return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
export function clearSessionCookie(){return sessionCookie('',0);}

export async function createPassword(password:string){
 const salt=randomHex(18),digest=await passwordDigest(password,salt);
 return{salt,passwordHash:`pbkdf2-sha256$${PASSWORD_ITERATIONS}$${digest}`};
}

export async function verifyPassword(password:string,salt:string,expected:string){
 const match=/^pbkdf2-sha256\$(\d+)\$([a-f0-9]{64})$/.exec(expected);
 const iterations=match?Number(match[1]):PASSWORD_ITERATIONS,digest=match?match[2]:expected;
 if(!Number.isInteger(iterations)||iterations<10000||iterations>PASSWORD_ITERATIONS)return false;
 return safeEqual(await passwordDigest(password,salt,iterations),digest);
}

export async function createSession(memberId:string){
 await ensureMemberAuthSchema();
 const token=randomHex(32),tokenHash=await sha256(token),expiresAt=new Date(Date.now()+DAYS*86400000).toISOString(),db=rawDb();
 await db.batch([
  db.prepare('DELETE FROM kk_member_sessions WHERE member_id=? OR expires_at<=?').bind(memberId,new Date().toISOString()),
  db.prepare('INSERT INTO kk_member_sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(tokenHash,memberId,expiresAt),
 ]);
 return token;
}

export async function sessionIdentity(request:Request){
 const token=cookieValue(request,COOKIE);if(!/^[a-f0-9]{64}$/.test(token))return null;
 await ensureMemberAuthSchema();
 const row=await rawDb().prepare('SELECT s.member_id,m.email FROM kk_member_sessions s JOIN kk_members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token),new Date().toISOString()).first();
 return row?{id:String(row.member_id),email:String(row.email).toLowerCase()}:null;
}

export async function destroySession(request:Request){
 const token=cookieValue(request,COOKIE);if(/^[a-f0-9]{64}$/.test(token))await rawDb().prepare('DELETE FROM kk_member_sessions WHERE token_hash=?').bind(await sha256(token)).run();
}

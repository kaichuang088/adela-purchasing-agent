import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(realpathSync(resolve('node_modules/wrangler/package.json'))),{Miniflare}=require('miniflare');
const names=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)&&p!=='index.js');
const mf=new Miniflare({modules:[{type:'ESModule',path:resolve('dist/server/index.js')},...names.map(p=>({type:'ESModule',path:resolve('dist/server',p)}))],modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let checks=0;const passed=label=>console.log(`PASS ${++checks}: ${label}`);
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const signup=await mf.dispatchFetch('https://kk.example/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'signup',name:'Login Test',email:'member@example.com',password:'correct-horse-2026'})});
 assert.equal(signup.status,201,await signup.text());const cookie=signup.headers.get('set-cookie');assert.match(cookie||'',/^kk_session=/);passed('Signup creates a member session cookie');
 const shop=await mf.dispatchFetch('https://kk.example/api/shop',{headers:{Cookie:cookie.split(';')[0]}}),data=await shop.json();assert.equal(shop.status,200);assert.equal(data.member.email,'member@example.com');assert.equal(data.member.miles,5);assert.equal(data.signedIn,true);passed('Session loads the correct member and five welcome points');
 const privatePreview=await mf.dispatchFetch('https://kk.example/api/shop',{headers:{Cookie:cookie.split(';')[0],'oai-authenticated-user-id':'different-chatgpt-identity','oai-authenticated-user-email':'chatgpt@example.com'}}),previewData=await privatePreview.json();assert.equal(previewData.member.email,'member@example.com','The private Site identity must not replace the member login session');passed('Member session takes precedence over preview identity');
 const denied=await mf.dispatchFetch('https://kk.example/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email:'member@example.com',password:'wrong-password'})});assert.equal(denied.status,401);passed('Incorrect password is rejected');
 const logout=await mf.dispatchFetch('https://kk.example/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie.split(';')[0]},body:JSON.stringify({action:'logout'})});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie')||'',/Max-Age=0/);passed('Logout expires the member cookie');
 const afterLogout=await mf.dispatchFetch('https://kk.example/api/shop',{headers:{Cookie:cookie.split(';')[0]}});assert.equal((await afterLogout.json()).member,null,'Revoked session cannot load membership');passed('Revoked session cannot access member data');
 console.log('6 member authentication checks passed');
}finally{await mf.dispose();}

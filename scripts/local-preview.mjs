// Local-only runner for the SAME compiled app. Never deploy this file as a server.
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {mkdir,readFile,readdir,mkdtemp,rm,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(realpathSync(resolve(root,'node_modules/wrangler/package.json')));
const {Miniflare}=require('miniflare');
const check=process.argv.includes('--check');
const data=check?await mkdtemp(resolve(tmpdir(),'adela-preview-check-')):resolve(root,'..','preview-data');
const adminPassword=process.env.ADELA_LOCAL_TEST_PASSWORD||randomUUID(); // Ephemeral local test credential, never a production password.
const memberEmail='preview@example.test';
let mf,server;
function localCookies(headers){return headers.getSetCookie().map(c=>c.replace(/;\s*Secure\b/gi,''));}
async function makeRuntime(){
 const files=(await readdir(resolve(root,'dist/server'),{recursive:true})).filter(p=>/\.m?js$/.test(p)&&p!=='index.js');
 return new Miniflare({host:'127.0.0.1',port:0,modules:['index.js',...files].map(p=>({type:'ESModule',path:resolve(root,'dist/server',p)})),modulesRoot:resolve(root,'dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],d1Persist:resolve(data,'d1'),r2Buckets:['BUCKET'],r2Persist:resolve(data,'r2'),bindings:{ADMIN_PASSWORD:adminPassword},assets:{directory:resolve(root,'dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
}
async function initialize(){
 const db=await mf.getD1Database('DB');
 await db.prepare('CREATE TABLE IF NOT EXISTS adela_local_migrations(name TEXT PRIMARY KEY)').run();
 for(const name of (await readdir(resolve(root,'drizzle'))).filter(x=>x.endsWith('.sql')).sort()){
  if(await db.prepare('SELECT name FROM adela_local_migrations WHERE name=?').bind(name).first())continue;
  const statements=(await readFile(resolve(root,'drizzle',name),'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean).map(sql=>db.prepare(sql));
  await db.batch([...statements,db.prepare('INSERT INTO adela_local_migrations(name) VALUES(?)').bind(name)]);
 }
 // Seed only a new local database. Never overwrite later edits in the admin UI.
 await db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:0.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+30*86400000).toISOString(),purchaseAt:new Date(Date.now()+31*86400000).toISOString(),shopPaused:false})).run();
 const shop=await mf.dispatchFetch('http://localhost/api/shop');if(!shop.ok)throw Error('商品資料無法載入：'+shop.status);
 const credentialsTable=await db.prepare("SELECT name FROM sqlite_master WHERE name='kk_member_credentials'").first();
 const memberExists=credentialsTable&&await db.prepare('SELECT email FROM kk_member_credentials WHERE email=?').bind(memberEmail).first();
 if(!memberExists){
 const signup=await mf.dispatchFetch('http://localhost/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'signup',email:memberEmail,name:'本機預覽買家',password:adminPassword})});
 if(![201,409].includes(signup.status))throw Error('本機測試帳號建立失敗：'+signup.status);
 }
 return db;
}
// Serve the compiled public assets before dispatching dynamic routes to the Worker.
async function previewFetch(url,init={}){
 const pathname=decodeURIComponent(new URL(url).pathname),client=resolve(root,'dist/client');
 if(['GET','HEAD'].includes(init.method||'GET')&&!/^\/(api|request)(\/|$)/.test(pathname)){
  const path=resolve(client,'.'+pathname);
  if(path.startsWith(client+sep))try{
   if((await stat(path)).isFile()){
    const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.otf':'font/otf','.woff2':'font/woff2','.json':'application/json','.txt':'text/plain'};
    return new Response(init.method==='HEAD'?null:await readFile(path),{headers:{'Content-Type':mime[extname(path)]||'application/octet-stream'}});
   }
  }catch(e){if(!['ENOENT','ENOTDIR'].includes(e.code))throw e;}
 }
 return mf.dispatchFetch(url,init);
}
async function stop(){if(server)await new Promise(r=>server.close(r));if(mf)await mf.dispose();}
try{
 await mkdir(data,{recursive:true});mf=await makeRuntime();let db=await initialize();
 if(check){
  for(const path of ['/','/admin']){const r=await previewFetch('http://localhost'+path);assert.equal(r.status,200,path);assert.match(r.headers.get('content-type'),/text\/html/);const html=await r.text();assert.ok(html.length>1000);const asset=html.match(/(?:src|href)="([^\"]+\.js(?:\?[^\"]*)?)"/);if(asset){const a=await previewFetch(new URL(asset[1],'http://localhost').href);assert.equal(a.status,200,asset[1]);}}
  const login=await mf.dispatchFetch('http://localhost/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email:memberEmail,password:adminPassword})});assert.equal(login.status,200);const cookies=localCookies(login.headers);assert.ok(cookies.length&&!cookies.some(x=>/;\s*Secure\b/i.test(x)));
  const shop=await mf.dispatchFetch('http://localhost/api/shop',{headers:{Cookie:cookies[0].split(';')[0]}});const state=await shop.json();assert.equal(state.member.email,memberEmail);assert.ok(state.products.length>=93,'Current recovery catalog must contain at least 93 visible products');
  const admin=await mf.dispatchFetch('http://localhost/api/operations',{headers:{'X-KK-Admin-Password':adminPassword}});assert.equal(admin.status,200);
  await db.prepare("INSERT INTO store_settings(key,value) VALUES('local_persistence_test','keep')").run();await mf.dispose();mf=await makeRuntime();db=await initialize();assert.equal((await db.prepare("SELECT value FROM store_settings WHERE key='local_persistence_test'").first()).value,'keep');
  console.log('PASS: storefront/admin HTML and JS assets, current recovery catalog, local member login, local HTTP cookie adapter, admin authentication, persisted restart and idempotent migrations. Linux runtime only; Mac Finder launch not executed.');
  await stop();await rm(data,{recursive:true});
 }else{
  server=createServer(async(req,res)=>{
   try{
    const origin=`http://127.0.0.1:${server.address().port}`;
    if(req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403);res.end('Local preview only');return;}
    if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end('Cross-origin request blocked');return;}
    const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v&& !['host','connection','content-length'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>25*1024*1024){res.writeHead(413);res.end('File too large');return;}chunks.push(chunk);}
    const r=await previewFetch(origin+(req.url||'/'),{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),redirect:'manual'});
    for(const[k,v]of r.headers)if(!['set-cookie','content-length','content-encoding','transfer-encoding','connection'].includes(k))res.setHeader(k,v);
    const cookies=localCookies(r.headers);if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.setHeader('Cache-Control','no-store');res.writeHead(r.status);res.end(Buffer.from(await r.arrayBuffer()));
   }catch(e){console.error(e);if(!res.headersSent)res.writeHead(500);res.end('Local preview error; see Terminal.');}
  });
  await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
  const url=`http://127.0.0.1:${server.address().port}`;
  console.log(`\n網站已啟動（本機測試資料，不是正式網站）\n前台：${url}/\n後台：${url}/admin\n\n後台密碼：[use ADELA_LOCAL_TEST_PASSWORD supplied to this local process]\n前台測試帳號：${memberEmail}\n前台測試密碼：[use ADELA_LOCAL_TEST_PASSWORD supplied to this local process]\n\nAI、Stripe、寄信尚未連線；匯率使用測試值 0.025。\n請保持此視窗開啟；結束時按 Control+C。\n`);
  if(process.platform==='darwin')for(const path of ['/','/admin'])spawn('/usr/bin/open',[url+path],{stdio:'ignore'}).on('error',()=>{});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await stop();process.exit(0);});
 }
}catch(e){console.error('\n預覽無法啟動：',e.stack||e.message);await stop();process.exitCode=1;}

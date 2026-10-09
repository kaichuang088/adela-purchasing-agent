import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(realpathSync(resolve('node_modules/wrangler/package.json'))),{Miniflare}=require('miniflare');
const files=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p));
const options={modules:['index.js',...files.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{},log:new (require('miniflare').Log)(require('miniflare').LogLevel.DEBUG),cf:false,unsafeTriggerHandlers:true};
const mf=new Miniflare(options);let count=0;
const check=(v,label)=>{assert.ok(v,label);console.log(`PASS ${++count}: ${label}`);};
const at=Date.parse('2030-01-02T02:10:00Z');
async function tick(time=at){const r=await mf.dispatchFetch(`http://localhost/cdn-cgi/handler/scheduled?time=${time}&cron=*+*+*+*+*`);const text=await r.text();console.log('scheduled response',r.status,text.slice(0,200));return r.status;}
try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO kk_members(id,name,email) VALUES('scheduler-member','QA','scheduler@example.test')").run();
 const cases=[['paid',true,'transfer',null,null],['awaiting_cod',false,'cod',null,null],['paid',false,'transfer',null,null],['awaiting_cod',false,'transfer',null,null],['awaiting_payment',false,'transfer',null,null],['admin_review',false,'transfer',null,null],['quoted',false,'transfer',null,null],['cancelled',true,'transfer',null,null],['on_hold',true,'transfer',null,null],['paid',true,'transfer','2030-01-01',null],['paid',true,'transfer',null,'2030-01-01'],['paid',true,'transfer',null,null,'pending'],['paid',true,'transfer',null,null,'accepted'],['paid',true,'transfer',null,null,'future']];
 const ids=[];
 for(let i=0;i<cases.length;i++){const [status,paid,method,purchased,received,revision]=cases[i];await db.prepare("INSERT INTO shopping_requests(request_no,submission_key,kind,member_id,customer_name,email,note,image_key,image_name,image_type,status,analysis_state,paid_at,payment_method,purchased_at,received_at,purchase_at) VALUES(?,?,'catalog','scheduler-member','QA','scheduler@example.test','','fixture','fixture.png','image/png',?,'not_required',?,?,?,?,?)").bind('KK300102-'+i.toString(16).padStart(12,'0').toUpperCase(),'scheduler-'+i,status,paid?'2030-01-01':null,method,purchased,received,revision==='future'?'2030-01-03T02:00:00Z':'2030-01-02T02:00:00Z').run();const id=(await db.prepare('SELECT id FROM shopping_requests WHERE submission_key=?').bind('scheduler-'+i).first()).id;ids.push(id);if(['pending','accepted'].includes(revision))await db.prepare("INSERT INTO kk_price_revisions(id,order_id,previous_json,proposed_json,reason,status) VALUES(?,?,'{}','{}','fixture',?)").bind('scheduler-rev-'+i,id,revision).run();}
 check(await tick()===200,'Compiled scheduled handler runs without an application page request');
 check((await db.prepare("SELECT value FROM store_settings WHERE key='adela_last_scheduled_success'").first()).value===new Date(at).toISOString(),'Successful no-page scheduler records its event time for administrator diagnostics');
 const rows=(await db.prepare('SELECT id,status FROM shopping_requests ORDER BY id').all()).results;
 check(rows[0].status==='purchasing'&&rows[1].status==='purchasing','Verified paid and actual COD orders advance using scheduledTime');
 check(rows.slice(2).every((r,i)=>r.status===cases[i+2][0]),'Unverified, quoted, cancelled, held, purchased, collected, revised and future orders stay unchanged');
 const events=async()=>Number((await db.prepare("SELECT COUNT(*) AS n FROM request_events WHERE status='purchasing'").first()).n);
 const notices=async()=>Number((await db.prepare("SELECT COUNT(*) AS n FROM kk_messages WHERE delivery_key LIKE 'purchasing:%'").first()).n);
 check(await events()===2&&await notices()===2,'Each advancing order records one event and buyer notice atomically');
 const scheduledNotice=await db.prepare("SELECT created_at FROM kk_messages WHERE delivery_key=?").bind('purchasing:'+ids[0]).first();check(scheduledNotice.created_at==='2030-01-02T02:10:00.000Z','Event timestamp comes from scheduledTime');
 await Promise.all([tick(),tick(),tick()]);check(await events()===2&&await notices()===2,'Concurrent cron retries cannot duplicate events or notifications');
 check(Number((await db.prepare("SELECT COUNT(*) AS n FROM kk_email_outbox WHERE state='pending'").first()).n)>=2,'Missing email config preserves pending notifications');
 const reminders=async()=>Number((await db.prepare("SELECT COUNT(*) AS n FROM kk_messages WHERE delivery_key LIKE 'payment-reminder:%'").first()).n);
 check(await reminders()===1,'Minute cron sends a daily payment reminder once in Taiwan 10:00 hour');await tick(at+86400000);check(await reminders()===2,'Next Taiwan day may send another reminder');
 await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings','{\"remindersEnabled\":false}')").run();await tick(at+2*86400000);check(await reminders()===2,'Disabled reminders remain disabled');
 await db.prepare("UPDATE shopping_requests SET status='paid',paid_at='2030-01-01' WHERE id=?").bind(ids[4]).run();
 await db.prepare("CREATE TRIGGER scheduler_fail BEFORE INSERT ON kk_messages WHEN NEW.delivery_key LIKE 'purchasing:%' BEGIN SELECT RAISE(ABORT,'injected notice failure'); END").run();const before=await events();check(await tick()===500,'Injected notification failure is reported by scheduled handler');check((await db.prepare("SELECT value FROM store_settings WHERE key='adela_last_scheduled_success'").first()).value===new Date(at+2*86400000).toISOString(),'Failed scheduler does not advance its last successful heartbeat');check((await db.prepare('SELECT status FROM shopping_requests WHERE id=?').bind(ids[4]).first()).status==='paid'&&await events()===before,'Failure rolls back both purchasing event and status');await db.prepare('DROP TRIGGER scheduler_fail').run();check(await tick()===200&&await events()===before+1,'Failed transaction can be retried without lost work');
 let sends=0;await mf.setOptions({...options,bindings:{RESEND_API_KEY:'mock-only',EMAIL_FROM:'Adela <test@example.test>'},outboundService:async()=>{sends++;return Response.json({id:'mock-'+sends});}});check(await tick()===200&&sends>0,'Scheduled worker dispatches queued email through mock provider; no real email verified');
 console.log(`Scheduler recovery ${count} checks; local compiled Worker only.`);
}finally{await mf.dispose();}

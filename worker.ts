import {dispatchPush} from './lib/web-push';
import {advancePurchasing} from './lib/order-scheduler';
import {dispatchEmailOutbox,emailConfigured,type EmailConfig} from './lib/email-outbox';
import handler from 'vinext/server/fetch-handler';
import {runPaymentReminders} from './lib/payment-reminders';
export default {
 ...handler,
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  const response=await handler.fetch(request,env,ctx);
  if(request.method==='POST'&&response.ok&&env.DB&&emailConfigured(env))ctx.waitUntil(dispatchEmailOutbox(env.DB,env,{limit:2}).catch(()=>{console.error('Order email queue processing failed');}));
  if(request.method==='POST'&&response.ok&&env.DB)ctx.waitUntil(dispatchPush(env.DB,env).catch(()=>{console.error('Push delivery failed');}));
  return response;
 },
 async scheduled(_event:ScheduledController,env:Cloudflare.Env,ctx:ExecutionContext){
  if(!env.DB)throw new Error('DB binding missing');
  const db=env.DB;
  ctx.waitUntil((async()=>{try{await Promise.all([advancePurchasing(db,new Date(_event.scheduledTime)),runPaymentReminders(db,new Date(_event.scheduledTime))]);await dispatchEmailOutbox(db,env);await dispatchPush(db,env);await db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_last_scheduled_success',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(new Date(_event.scheduledTime).toISOString()).run();}catch(error){console.error('scheduled_job_failed',error);throw error;}})());
 },
};

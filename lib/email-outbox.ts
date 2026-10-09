export type EmailConfig={RESEND_API_KEY?:string;EMAIL_FROM?:string;SHOP_PUBLIC_URL?:string};
type Row={id:string;recipient:string;subject:string;body:string;attempts:number;first_attempt_ms:number|null;payload_json:string|null;lock_token:string};
const retryWindow=23*60*60*1000;
export function emailConfigured(config:EmailConfig){return !!config.RESEND_API_KEY?.trim()&&!!config.EMAIL_FROM?.trim();}

export async function emailQueueSummary(db:D1Database){
 const rows=await db.prepare('SELECT state,COUNT(*) count FROM kk_email_outbox GROUP BY state').all<{state:string;count:number}>();
 return Object.fromEntries(rows.results.map(row=>[row.state,Number(row.count)]));
}

/** accepted means the provider accepted the request, not confirmed inbox delivery. */
export async function dispatchEmailOutbox(db:D1Database,config:EmailConfig,options:{now?:number;limit?:number;transport?:typeof fetch}={}){
 if(!emailConfigured(config))return {configured:false,accepted:0,retrying:0,blocked:0,review:0};
 const now=options.now??Date.now(),limit=Math.max(1,Math.min(10,options.limit??5)),transport=options.transport??fetch;
 const result={configured:true,accepted:0,retrying:0,blocked:0,review:0};
 // Ambiguous old requests must never be resent beyond the provider's 24-hour key window.
 const expired=await db.prepare("UPDATE kk_email_outbox SET state='review',last_error='retry_window_expired',lock_token=NULL WHERE state IN ('pending','sending') AND ((first_attempt_ms IS NOT NULL AND first_attempt_ms<=?) OR attempts>=8) AND lease_until_ms<=?").bind(now-retryWindow,now).run();
 result.review=Number(expired.meta.changes)||0;
 for(let i=0;i<limit;i++){
  const token=crypto.randomUUID();
  const row=await db.prepare("UPDATE kk_email_outbox SET state='sending',lock_token=?,lease_until_ms=?,attempts=attempts+1,first_attempt_ms=COALESCE(first_attempt_ms,?) WHERE id=(SELECT id FROM kk_email_outbox WHERE state IN ('pending','sending') AND next_attempt_ms<=? AND lease_until_ms<=? AND attempts<8 AND (first_attempt_ms IS NULL OR first_attempt_ms>?) ORDER BY next_attempt_ms,created_at,id LIMIT 1) RETURNING *").bind(token,now+60000,now,now,now,now-retryWindow).first<Row>();
  if(!row)break;
  async function finish(state:string,error:string|null,providerId:string|null=null,next=0){
   await db.prepare("UPDATE kk_email_outbox SET state=?,last_error=?,provider_id=?,accepted_at=?,next_attempt_ms=?,lease_until_ms=0,lock_token=NULL WHERE id=? AND lock_token=?").bind(state,error,providerId,state==='accepted'?new Date(now).toISOString():null,next,row!.id,token).run();
  }
  if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(row.recipient)) {await finish('blocked','invalid_recipient');result.blocked++;continue;}
  let payload=row.payload_json;
  if(!payload){
   let link='';
   try{const url=new URL(config.SHOP_PUBLIC_URL||'');if(url.protocol==='https:'&&!url.username&&!url.password)link='\n\n查看訂單 / View orders: '+url.origin+'/';}catch{}
   payload=JSON.stringify({from:config.EMAIL_FROM,to:[row.recipient],subject:row.subject.replace(/[\r\n]/g,' ').slice(0,200),text:row.body+link});
   // Persist the exact provider payload before first send; retries may not change it.
   await db.prepare('UPDATE kk_email_outbox SET payload_json=? WHERE id=? AND lock_token=?').bind(payload,row.id,token).run();
  }
  let failure='network_error',retry=true;
  try{
   const response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'adela-order-email/'+row.id},body:payload,signal:AbortSignal.timeout(8000),redirect:'manual'});
   const value=await response.json().catch(()=>null) as {id?:string;name?:string}|null;
   if(response.ok&&typeof value?.id==='string'&&value.id){await finish('accepted',null,value.id);result.accepted++;continue;}
   failure=response.ok?'invalid_provider_response':'provider_http_'+response.status;
   retry=response.ok||response.status===429||response.status>=500||(response.status===409&&value?.name==='concurrent_idempotent_requests');
  }catch{ /* Never persist provider response bodies, API keys or arbitrary network errors. */ }
  if(!retry){await finish('blocked',failure);result.blocked++;}
  else if(row.attempts>=8){await finish('review',failure);result.review++;}
  else{await finish('pending',failure,null,now+Math.min(60*60*1000,30000*2**(row.attempts-1)));result.retrying++;}
 }
 return result;
}

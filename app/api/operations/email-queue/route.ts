import {env} from 'cloudflare:workers';
import {isAdmin,privateJson} from '@/lib/admin-auth';
import {rawDb} from '@/lib/catalog';
import {dispatchEmailOutbox,emailQueueSummary} from '@/lib/email-outbox';

export async function POST(request:Request){
 if(!isAdmin(request))return privateJson({error:'請先登入管理後台。'},401);
 try{
  const result=await dispatchEmailOutbox(rawDb(),env,{limit:5});
  return privateJson({...result,queue:await emailQueueSummary(rawDb())},result.configured?200:503);
 }catch{return privateJson({error:'通知寄送暫時無法處理，佇列已保留。'},503);}
}

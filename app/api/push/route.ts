import {env} from 'cloudflare:workers';
import {currentMember,ShopError} from '@/lib/commerce';
import {rawDb} from '@/lib/catalog';
import {privateJson} from '@/lib/admin-auth';
import {failure} from '@/app/api/shop/route';
import {pushConfigured,validPushEndpoint,sendPush} from '@/lib/web-push';
export async function GET(request:Request){try{const endpoint=new URL(request.url).searchParams.get('endpoint'),member=endpoint?await currentMember(request):null;const subscribed=!!(member&&endpoint&&await rawDb().prepare('SELECT endpoint FROM kk_push_subscriptions WHERE endpoint=? AND member_id=?').bind(endpoint,member.id).first());return privateJson({configured:pushConfigured(env),publicKey:env.VAPID_PUBLIC_KEY||'',subscribed});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const member=await currentMember(request,true),b=await request.json() as {endpoint?:string;action?:string};
 const endpoint=String(b.endpoint||'');if(endpoint.length>2048||!validPushEndpoint(endpoint))throw new ShopError('推播網址無效。');
 if(b.action==='remove'){await rawDb().prepare('DELETE FROM kk_push_subscriptions WHERE endpoint=? AND member_id=?').bind(endpoint,member!.id).run();return privateJson({ok:true});}
 if(!pushConfigured(env))throw new ShopError('推播服務尚未啟用。',409);
 if(b.action==='test'){
  if(!await rawDb().prepare('SELECT endpoint FROM kk_push_subscriptions WHERE endpoint=? AND member_id=?').bind(endpoint,member!.id).first())throw new ShopError('請先在此裝置開啟通知。',409);
  const response=await sendPush(endpoint,env);
  if(response.status===404||response.status===410){await rawDb().prepare('DELETE FROM kk_push_subscriptions WHERE endpoint=? AND member_id=?').bind(endpoint,member!.id).run();throw new ShopError('裝置訂閱已失效，請重新開啟通知。',409);}
  if(!response.ok)throw new ShopError('推播服務暫時未接受通知，請稍後再試。',502);
  return privateJson({ok:true,providerAccepted:true});
 }
 await rawDb().prepare("INSERT INTO kk_push_subscriptions(endpoint,member_id,last_message_id) VALUES(?,?,COALESCE((SELECT MAX(id) FROM kk_messages WHERE member_id=?),0)) ON CONFLICT(endpoint) DO UPDATE SET member_id=excluded.member_id,last_message_id=excluded.last_message_id,failures=0,lease_until_ms=0").bind(endpoint,member!.id,member!.id).run();return privateJson({ok:true});
}catch(e){return failure(e);}}

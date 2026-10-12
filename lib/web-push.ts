export type PushConfig={VAPID_PRIVATE_JWK?:string;VAPID_PUBLIC_KEY?:string;SHOP_PUBLIC_URL?:string};
export const pushConfigured=(env:PushConfig)=>!!(env.VAPID_PRIVATE_JWK&&env.VAPID_PUBLIC_KEY&&env.SHOP_PUBLIC_URL);
export function validPushEndpoint(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(h=>u.hostname===h||h==='web.push.apple.com'&&u.hostname.endsWith('.'+h));}catch{return false;}}
const b64=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export async function sendPush(endpoint:string,config:PushConfig,transport:typeof fetch=fetch){
 if(!validPushEndpoint(endpoint)||!pushConfigured(config))throw new Error('Push configuration unavailable');
 const enc=new TextEncoder(),head=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'}))),body=b64(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:config.SHOP_PUBLIC_URL})));
 const key=await crypto.subtle.importKey('jwk',JSON.parse(config.VAPID_PRIVATE_JWK!),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(head+'.'+body));
 return transport(endpoint,{method:'POST',headers:{Authorization:'vapid t='+head+'.'+body+'.'+b64(new Uint8Array(sig))+', k='+config.VAPID_PUBLIC_KEY,TTL:'86400',Urgency:'normal'},redirect:'manual',signal:AbortSignal.timeout(8000)});
}
export async function dispatchPush(db:D1Database,config:PushConfig){
 if(!pushConfigured(config))return;
 const rows=await db.prepare("SELECT p.*, (SELECT MAX(id) FROM kk_messages WHERE member_id=p.member_id) AS latest_id FROM kk_push_subscriptions p WHERE failures<8 AND lease_until_ms<? AND EXISTS(SELECT 1 FROM kk_messages WHERE member_id=p.member_id AND id>p.last_message_id) LIMIT 20").bind(Date.now()).all<{endpoint:string;member_id:string;latest_id:number}>();
 for(const row of rows.results){
  const claim=await db.prepare('UPDATE kk_push_subscriptions SET lease_until_ms=? WHERE endpoint=? AND member_id=? AND lease_until_ms<?').bind(Date.now()+60000,row.endpoint,row.member_id,Date.now()).run();if(!claim.meta.changes)continue;
  try{const response=await sendPush(row.endpoint,config);if(response.status===404||response.status===410)await db.prepare('DELETE FROM kk_push_subscriptions WHERE endpoint=? AND member_id=?').bind(row.endpoint,row.member_id).run();else if(response.ok)await db.prepare('UPDATE kk_push_subscriptions SET last_message_id=?,lease_until_ms=0,failures=0 WHERE endpoint=? AND member_id=?').bind(row.latest_id,row.endpoint,row.member_id).run();else throw new Error('push failed');
  }catch{await db.prepare('UPDATE kk_push_subscriptions SET failures=failures+1,lease_until_ms=? WHERE endpoint=? AND member_id=?').bind(Date.now()+300000,row.endpoint,row.member_id).run();}
 }
}

export async function dispatchAdminPush(db:D1Database,config:PushConfig){if(!pushConfigured(config))return;const rows=(await db.prepare("SELECT s.*,(SELECT MAX(id) FROM kk_admin_alerts) latest_id FROM kk_admin_push_subscriptions s WHERE failures<8 AND lease_until_ms<? AND EXISTS(SELECT 1 FROM kk_admin_alerts a WHERE a.id>s.last_alert_id) LIMIT 20").bind(Date.now()).all()).results;for(const row of rows){const claim=await db.prepare('UPDATE kk_admin_push_subscriptions SET lease_until_ms=? WHERE endpoint=? AND lease_until_ms<?').bind(Date.now()+60000,row.endpoint,Date.now()).run();if(!claim.meta.changes)continue;try{const response=await sendPush(String(row.endpoint),config);if(response.status===404||response.status===410)await db.prepare('DELETE FROM kk_admin_push_subscriptions WHERE endpoint=?').bind(row.endpoint).run();else if(response.ok)await db.prepare('UPDATE kk_admin_push_subscriptions SET last_alert_id=?,lease_until_ms=0,failures=0 WHERE endpoint=?').bind(row.latest_id,row.endpoint).run();else throw Error('push failed');}catch{await db.prepare('UPDATE kk_admin_push_subscriptions SET failures=failures+1,lease_until_ms=? WHERE endpoint=?').bind(Date.now()+300000,row.endpoint).run();}}}

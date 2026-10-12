import {aiConfiguration} from '@/lib/ai-config';
import {pushConfigured} from '@/lib/web-push';
import {emailConfigured} from '@/lib/email-outbox';
import {env} from 'cloudflare:workers';
import {rawDb} from '@/lib/catalog';
import {isAdmin,privateJson} from '@/lib/admin-auth';
export async function GET(request:Request){
 if(!isAdmin(request))return privateJson({error:'請先登入管理後台。'},401);
 try{
  const ai=aiConfiguration(env),db=rawDb();await db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_backend_identity',?)").bind(crypto.randomUUID()).run();
  const row=await db.prepare("SELECT value FROM store_settings WHERE key='adela_backend_identity'").first();
  const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{name:string}>();
  const present=new Set(tables.results.map(t=>t.name));
  const required=['products','shopping_requests','kk_members','kk_wallet_entries','kk_coupon_claims','kk_urgent_orders','kk_stock_reservations','kk_email_outbox','kk_admin_previews','kk_topups','kk_order_items','kk_push_subscriptions','kk_credit_withdrawals','kk_ai_sessions','kk_ai_chat_messages','kk_photo_inquiries','kk_admin_alerts','kk_admin_push_subscriptions'];
  const topupSchema=await db.prepare("SELECT sql FROM sqlite_master WHERE name='kk_topups'").first();
  const topupBonusPolicyReady=String(topupSchema?.sql||'').includes('160')&&String(topupSchema?.sql||'').includes('600');
  const missingTables=required.filter(name=>!present.has(name));
  const aiSuccess=await db.prepare("SELECT value FROM store_settings WHERE key='adela_last_ai_success'").first();
  const scheduled=await db.prepare("SELECT value FROM store_settings WHERE key='adela_last_scheduled_success'").first();
  return privateJson({backendId:row?.value,release:'2026-10-12-r22',topupSalesEnabled:false,inventoryMigrationReady:present.has('kk_stock_reservations'),databaseReady:missingTables.length===0,topupBonusPolicyReady,missingTables,lastAiSuccess:aiSuccess?JSON.parse(String(aiSuccess.value)):null,aiConfigured:ai.configured,aiMissingConfiguration:ai.missing,aiModel:ai.model,pushConfigured:pushConfigured(env),emailConfigured:emailConfigured(env),lastScheduledAt:scheduled?.value||null});
 }catch{return privateJson({error:'資料服務尚未就緒。'},503);}
}

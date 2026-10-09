import {advancePurchasing} from '@/lib/order-scheduler';
import {aiConfiguration} from '@/lib/ai-config';
import type {PriceLine} from '@/lib/commerce-types';
import {env} from 'cloudflare:workers';
import {rawDb} from '@/lib/catalog';
import {isAdmin,privateJson} from '@/lib/admin-auth';
import {currentMember,ShopError,orderBundle,settings,parseMember,memberSelect} from '@/lib/commerce';
import {failure} from '@/app/api/shop/route';
import {supportReply,supportSummary} from '@/lib/support-ai';

type ChatLine={id?:number;sender:string;body:string;order_id?:number|null;created_at?:string};
const threadSelect="SELECT member_id,status,needs_human,ai_summary,unread_admin,unread_member,last_member_at,last_admin_at,updated_at FROM kk_support_threads WHERE member_id=?";

async function recipient(request:Request,id:unknown){
 if(isAdmin(request)){
  const m=await rawDb().prepare('SELECT id FROM kk_members WHERE id=?').bind(String(id||'')).first();
  if(!m)throw new ShopError('找不到會員。',404);
  return{id:String(m.id),admin:true};
 }
 return{id:(await currentMember(request,true))!.id,admin:false};
}

async function ensureThread(memberId:string){
 await rawDb().prepare("INSERT OR IGNORE INTO kk_support_threads(member_id,status) VALUES(?,'ai')").bind(memberId).run();
}

async function messages(memberId:string,orderId?:number){
 const query='SELECT * FROM (SELECT id,sender,body,order_id,created_at FROM kk_conversations WHERE member_id=?'+(orderId?' AND order_id=?':'')+' ORDER BY id DESC LIMIT 200) ORDER BY id';
 const rows=await rawDb().prepare(query).bind(...(orderId?[memberId,orderId]:[memberId])).all();
 return rows.results as ChatLine[];
}

async function handoff(memberId:string,orderId:number|null,body?:string){
 const db=rawDb(),existing=await db.prepare(threadSelect).bind(memberId).first();
 if(existing?.status==='waiting'||existing?.status==='human')return;
 const history=await messages(memberId),summary=await supportSummary(history);
 await db.batch([
  db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) VALUES(?,'已轉真人客服','對話已保存，Adela 團隊收到通知後會在訊息頁回覆。','Human support requested','Your conversation is saved. The Adela team will reply on the messages page.',?)").bind(memberId,orderId),
  db.prepare("UPDATE kk_support_threads SET status='waiting',needs_human=1,ai_summary=?,unread_admin=unread_admin+1,unread_member=unread_member+1,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(summary,memberId),
  db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id) VALUES(?,'system',?,?)").bind(memberId,body||'已自動轉接真人客服。管理員會看到完整對話與 訴求摘要。 / Human support has been requested automatically. The team can see this conversation and its summary.',orderId)
 ]);
}

export async function GET(request:Request){try{
 const url=new URL(request.url);
 if(isAdmin(request)&&url.searchParams.get('threads')==='1'){
  const rows=await rawDb().prepare(`SELECT m.id AS member_id,m.name,m.email,COALESCE(t.status,'human') AS status,COALESCE(t.needs_human,0) AS needs_human,COALESCE(t.ai_summary,'') AS ai_summary,COALESCE(t.unread_admin,0) AS unread_admin,COALESCE(t.unread_member,0) AS unread_member,COALESCE(t.updated_at,(SELECT MAX(created_at) FROM kk_conversations WHERE member_id=m.id)) AS updated_at,(SELECT body FROM kk_conversations WHERE member_id=m.id ORDER BY id DESC LIMIT 1) AS last_body FROM kk_members m LEFT JOIN kk_support_threads t ON t.member_id=m.id WHERE t.member_id IS NOT NULL OR EXISTS(SELECT 1 FROM kk_conversations c WHERE c.member_id=m.id) ORDER BY COALESCE(t.needs_human,0) DESC,updated_at DESC LIMIT 500`).all();
  return privateJson({threads:rows.results});
 }
 const target=await recipient(request,url.searchParams.get('memberId'));
 const scope=url.searchParams.get('orderId'),orderId=scope===null?undefined:Number(scope);
 if(scope!==null&&(!Number.isSafeInteger(orderId)||Number(orderId)<1))throw new ShopError('訂單編號無效。',400);
 const scopedOrder=orderId?await rawDb().prepare('SELECT * FROM shopping_requests WHERE id=? AND member_id=?').bind(orderId,target.id).first():null;
 if(orderId&&!scopedOrder)throw new ShopError('訂單不屬於此會員。 / This order is not yours.',403);
 await ensureThread(target.id);
 // Viewing one order must not mark unrelated conversations as read.
 if(!orderId){if(target.admin)await rawDb().prepare('UPDATE kk_support_threads SET unread_admin=0 WHERE member_id=?').bind(target.id).run();
 else await rawDb().prepare('UPDATE kk_support_threads SET unread_member=0 WHERE member_id=?').bind(target.id).run();}
 await advancePurchasing(rawDb(),new Date());
 const orders=orderId?(await rawDb().prepare('SELECT * FROM shopping_requests WHERE id=? AND member_id=?').bind(orderId,target.id).all()).results:(await rawDb().prepare('SELECT * FROM shopping_requests WHERE member_id=? ORDER BY id DESC LIMIT 100').bind(target.id).all()).results;
 const history=await messages(target.id,orderId),start=target.admin?-1:history.map(x=>x.body).lastIndexOf('新對話已開始。 / New conversation started.'),thread=await rawDb().prepare(threadSelect).bind(target.id).first();
 return privateJson({aiConfigured:aiConfiguration(env).configured,orders:await Promise.all(orders.map(async row=>{const order=await orderBundle(row);if(order.pricing)order.pricing.items=await Promise.all(order.pricing.items.map(async (line:PriceLine)=>{if(line.imageUrl||!line.productId)return line;const product=await rawDb().prepare("SELECT image_key,commerce_json FROM products WHERE id=?").bind(line.productId).first();if(!product)return line;let meta:any={};try{meta=JSON.parse(String(product.commerce_json||"{}"));}catch{}const key=String(product.image_key||"");return {...line,imageUrl:meta.variants?.find((v:any)=>v.id===line.variantId)?.imageUrl||(key?(key.startsWith("static/")?"/"+key.slice(7):"/api/media/"+key):meta.imageUrl)||undefined};}));return order;})),messages:start>=0?history.slice(start):history,thread:orderId&&thread?{...thread,ai_summary:''}:thread});
}catch(e){return failure(e);}}

export async function POST(request:Request){try{
 const b=await request.json() as {memberId?:string;body?:string;orderId?:number;action?:string};
 const target=await recipient(request,b.memberId),db=rawDb();
 await ensureThread(target.id);
 if(b.orderId&&!await db.prepare('SELECT id FROM shopping_requests WHERE id=? AND member_id=?').bind(b.orderId,target.id).first())throw new ShopError('訂單不屬於此會員。 / This order is not yours.',403);
 if(b.action==='share_order'){
  if(!target.admin)throw new ShopError('沒有權限。',403);
  const order=await db.prepare('SELECT * FROM shopping_requests WHERE id=? AND member_id=?').bind(b.orderId||0,target.id).first();if(!order)throw new ShopError('找不到此會員的訂單。',404);
  const pricing=JSON.parse(String(order.pricing_json||'{}'));
  const summary='訂單 / Order '+order.request_no+'\n'+(pricing.items||[]).map((i:any)=>i.nameZh+' × '+i.quantity).join('\n')+'\n合計 / Total NT$'+Number(pricing.totalTwd||0).toLocaleString('en-US');
  const result=await db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id) SELECT ?,'admin',?,? WHERE NOT EXISTS(SELECT 1 FROM kk_conversations WHERE member_id=? AND order_id=? AND sender='admin' AND body=?)").bind(target.id,summary,order.id,target.id,order.id,summary).run();
  if(result.meta.changes)await db.batch([db.prepare("UPDATE kk_support_threads SET status='human',needs_human=0,unread_member=unread_member+1,last_admin_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(target.id),db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) VALUES(?,'客服傳送了訂單',?,'Order shared by support',?,?)").bind(target.id,summary,summary,order.id)]);
  return privateJson({ok:true},201);
 }
 if(b.action==='handoff'){
  if(target.admin)throw new ShopError('此操作只供旅客使用。',403);
  await handoff(target.id,b.orderId||null);
  return privateJson({ok:true},201);
 }
 if(b.action==='new_conversation'){
  if(target.admin)throw new ShopError('此操作只供旅客使用。',403);
  await db.batch([
   db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id) VALUES(?,'system','新對話已開始。 / New conversation started.',NULL)").bind(target.id),
   db.prepare("UPDATE kk_support_threads SET status='ai',needs_human=0,ai_summary='',unread_member=0,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(target.id)
  ]);
  return privateJson({ok:true},201);
 }
 if(b.action==='resume_ai'){
  if(!target.admin)throw new ShopError('沒有權限。',403);
  await db.batch([
   db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) VALUES(?,'真人客服已結束','對話已交回 AI，後續仍可申請真人協助。','Human support ended','AI support is available again. You can request human support whenever needed.',?)").bind(target.id,b.orderId||null),
   db.prepare("UPDATE kk_support_threads SET status='ai',needs_human=0,unread_member=unread_member+1,unread_admin=0,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(target.id),
   db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id) VALUES(?,'system',?,?)").bind(target.id,'真人客服已結束，本對話已交回 AI 客服。 / Human support ended; AI support is available again.',b.orderId||null)
  ]);
  return privateJson({ok:true},201);
 }
 const body=String(b.body||'').trim();
 if(!body||body.length>2000)throw new ShopError('訊息需為 1 至 2000 字。 / Message must contain 1 to 2000 characters.');
 if(b.orderId&&!await db.prepare('SELECT id FROM shopping_requests WHERE id=? AND member_id=?').bind(b.orderId,target.id).first())throw new ShopError('訂單不屬於此會員。',403);
 if(target.admin){
  await db.batch([
   db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id) VALUES(?,'admin',?,?)").bind(target.id,body,b.orderId||null),
   db.prepare("UPDATE kk_support_threads SET status='human',needs_human=0,unread_member=unread_member+1,last_admin_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(target.id),
   db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) VALUES(?,'Adela 真人客服回覆',?,'Reply from Adela support',?,?)").bind(target.id,body,body,b.orderId||null)
  ]);
  return privateJson({ok:true},201);
 }
 const thread=await db.prepare(threadSelect).bind(target.id).first();
 await db.batch([
  db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id) VALUES(?,'member',?,?)").bind(target.id,body,b.orderId||null),
  db.prepare("UPDATE kk_support_threads SET unread_admin=unread_admin+?,last_member_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(thread?.status==='ai'&&!thread?.needs_human?0:1,target.id)
 ]);
 if(thread?.status==='ai'&&!thread?.needs_human){
  const config=await settings(),member=parseMember((await db.prepare(memberSelect+' WHERE m.id=?').bind(target.id).first())!);
  const selected=b.orderId?await db.prepare('SELECT * FROM shopping_requests WHERE id=? AND member_id=?').bind(b.orderId,target.id).first():null;
  const reply=await supportReply(await messages(target.id,b.orderId||undefined),{order:selected?await orderBundle(selected) as any:undefined,member,fees:config.fees,paymentInstructions:config.paymentInstructions});
  await db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id) SELECT member_id,?,?,? FROM kk_support_threads WHERE member_id=? AND status='ai' AND needs_human=0").bind(reply.modelUsed?'ai':'system',reply.modelUsed?reply.body:reply.body,b.orderId||null,target.id).run();
  if(reply.handoff)await handoff(target.id,b.orderId||null);
  else await db.prepare("UPDATE kk_support_threads SET unread_member=unread_member+1,updated_at=CURRENT_TIMESTAMP WHERE member_id=? AND status='ai' AND needs_human=0").bind(target.id).run();
 }
 return privateJson({ok:true},201);
}catch(e){return failure(e);}}

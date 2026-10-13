import {chatSession,chatSessions,newChatSession} from '@/lib/ai-chat-history';
import {advancePurchasing} from '@/lib/order-scheduler';
import {aiConfiguration} from '@/lib/ai-config';
import type {PriceLine} from '@/lib/commerce-types';
import {env} from 'cloudflare:workers';
import {rawDb} from '@/lib/catalog';
import {isAdmin,privateJson} from '@/lib/admin-auth';
import {currentMember,ShopError,orderBundle,settings,parseMember,memberSelect,products,exchange} from '@/lib/commerce';
import {catalogDisplayPrice,catalogDisplayParts} from '@/lib/catalog-display-price';
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

async function messages(memberId:string,orderId?:number,sessionId?:string){
 const query='SELECT * FROM (SELECT id,sender,body,order_id,created_at FROM kk_conversations WHERE member_id=?'+(sessionId?' AND session_id=?':'')+(orderId?' AND order_id=?':'')+' ORDER BY id DESC LIMIT 200) ORDER BY id';
 const rows=await rawDb().prepare(query).bind(...[memberId,...(sessionId?[sessionId]:[]),...(orderId?[orderId]:[])]).all();
 return rows.results as ChatLine[];
}

async function handoff(memberId:string,orderId:number|null,body?:string,sessionId?:string){
 const db=rawDb(),existing=await db.prepare('SELECT support_status AS status FROM kk_ai_sessions WHERE id=? AND owner_id=?').bind(sessionId||'',memberId).first();
 if(existing?.status==='waiting'||existing?.status==='human')return;
 const history=await messages(memberId,undefined,sessionId),summary=history.slice(-8).map(m=>(m.sender==='member'?'買家':'回覆')+'：'+m.body).join('\n').slice(0,1800);
 await db.batch([
  db.prepare("UPDATE kk_ai_sessions SET support_status='waiting',needs_human=1,ai_summary=? WHERE id=? AND owner_id=?").bind(summary,sessionId||'',memberId),
  db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) VALUES(?,'已轉真人客服','對話已保存並送交真人客服；等待時間未知，請留意此對話通知。','Human support requested','Your conversation is saved. The Adela team will reply on the messages page.',?)").bind(memberId,orderId),
  db.prepare("UPDATE kk_support_threads SET status='waiting',needs_human=1,ai_summary=?,unread_admin=unread_admin+1,unread_member=unread_member+1,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(summary,memberId),
  db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id,session_id) VALUES(?,'system',?,?,?)").bind(memberId,body||'已自動轉接真人客服。等待時間未知。管理員會看到完整對話與訴求摘要。 / Human support has been requested automatically. The team can see this conversation and its summary.',orderId,sessionId||null)
 ]);
}

export async function GET(request:Request){try{
 const url=new URL(request.url);
 if(isAdmin(request)&&url.searchParams.get('threads')==='1'){
  const rows=await rawDb().prepare(`SELECT m.id AS member_id,m.name,m.email,COALESCE(t.status,'human') AS status,COALESCE(t.needs_human,0) AS needs_human,COALESCE(t.ai_summary,'') AS ai_summary,COALESCE(t.unread_admin,0) AS unread_admin,COALESCE(t.unread_member,0) AS unread_member,COALESCE(t.updated_at,(SELECT MAX(created_at) FROM kk_conversations WHERE member_id=m.id)) AS updated_at,(SELECT body FROM kk_conversations WHERE member_id=m.id ORDER BY id DESC LIMIT 1) AS last_body FROM kk_members m LEFT JOIN kk_support_threads t ON t.member_id=m.id WHERE t.member_id IS NOT NULL OR EXISTS(SELECT 1 FROM kk_conversations c WHERE c.member_id=m.id) ORDER BY COALESCE(t.needs_human,0) DESC,updated_at DESC LIMIT 500`).all();
  return privateJson({threads:rows.results});
 }
 const target=await recipient(request,url.searchParams.get('memberId'));
 const pendingSession=target.admin&&!url.searchParams.get('sessionId')?await rawDb().prepare("SELECT id FROM kk_ai_sessions WHERE kind='buyer' AND owner_id=? AND needs_human=1 ORDER BY updated_at DESC LIMIT 1").bind(target.id).first():null;
 const sessionId=await chatSession('buyer',target.id,url.searchParams.get('sessionId')||(pendingSession?String(pendingSession.id):undefined));
 if(url.searchParams.get('export')==='1')return privateJson({sessionId,sessions:await chatSessions('buyer',target.id),messages:(await rawDb().prepare('SELECT * FROM kk_conversations WHERE member_id=? AND session_id=? ORDER BY id').bind(target.id,sessionId).all()).results,backupAt:new Date().toISOString()});
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
 const history=await messages(target.id,orderId,sessionId),globalThread=await rawDb().prepare(threadSelect).bind(target.id).first(),sessionThread=await rawDb().prepare('SELECT support_status AS status,needs_human,ai_summary FROM kk_ai_sessions WHERE id=?').bind(sessionId).first(),thread={...globalThread,...sessionThread};
 return privateJson({aiConfigured:aiConfiguration(env).configured,orders:await Promise.all(orders.map(async row=>{const order=await orderBundle(row);if(order.pricing)order.pricing.items=await Promise.all(order.pricing.items.map(async (line:PriceLine)=>{if(line.imageUrl||!line.productId)return line;const product=await rawDb().prepare("SELECT image_key,commerce_json FROM products WHERE id=?").bind(line.productId).first();if(!product)return line;let meta:any={};try{meta=JSON.parse(String(product.commerce_json||"{}"));}catch{}const key=String(product.image_key||"");return {...line,imageUrl:meta.variants?.find((v:any)=>v.id===line.variantId)?.imageUrl||(key?(key.startsWith("static/")?"/"+key.slice(7):"/api/media/"+key):meta.imageUrl)||undefined};}));return order;})),messages:history,sessionId,sessions:await chatSessions('buyer',target.id),thread:orderId&&thread?{...thread,ai_summary:''}:thread});
}catch(e){return failure(e);}}

export async function POST(request:Request){try{
 const b=await request.json() as {memberId?:string;body?:string;orderId?:number;action?:string;sessionId?:string};
 const target=await recipient(request,b.memberId),db=rawDb();
 await ensureThread(target.id);
 if(b.action==='new_conversation'){if(target.admin)throw new ShopError('請由會員建立新對話。',403);return privateJson({ok:true,sessionId:await newChatSession('buyer',target.id)},201);}
 const sessionId=await chatSession('buyer',target.id,b.sessionId);
 if(b.orderId&&!await db.prepare('SELECT id FROM shopping_requests WHERE id=? AND member_id=?').bind(b.orderId,target.id).first())throw new ShopError('訂單不屬於此會員。 / This order is not yours.',403);
 if(b.action==='share_order'){
  if(!target.admin)throw new ShopError('沒有權限。',403);
  const order=await db.prepare('SELECT * FROM shopping_requests WHERE id=? AND member_id=?').bind(b.orderId||0,target.id).first();if(!order)throw new ShopError('找不到此會員的訂單。',404);
  const pricing=JSON.parse(String(order.pricing_json||'{}'));
  const summary='訂單 / Order '+order.request_no+'\n'+(pricing.items||[]).map((i:any)=>i.nameZh+' × '+i.quantity).join('\n')+'\n合計 / Total NT$'+Number(pricing.totalTwd||0).toLocaleString('en-US');
  const result=await db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id,session_id) SELECT ?,'admin',?,?,? WHERE NOT EXISTS(SELECT 1 FROM kk_conversations WHERE member_id=? AND order_id=? AND sender='admin' AND body=?)").bind(target.id,summary,order.id,sessionId,target.id,order.id,summary).run();
  if(result.meta.changes)await db.batch([db.prepare("UPDATE kk_ai_sessions SET support_status='human',needs_human=0 WHERE id=? AND owner_id=?").bind(sessionId,target.id),db.prepare("UPDATE kk_support_threads SET status='human',needs_human=0,unread_member=unread_member+1,last_admin_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(target.id),db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) VALUES(?,'客服傳送了訂單',?,'Order shared by support',?,?)").bind(target.id,summary,summary,order.id)]);
  return privateJson({ok:true},201);
 }
 if(b.action==='handoff'){
  if(target.admin)throw new ShopError('此操作只供旅客使用。',403);
  await handoff(target.id,b.orderId||null,undefined,sessionId);
  return privateJson({ok:true},201);
 }
 if(b.action==='resume_ai'){
  if(!target.admin)throw new ShopError('沒有權限。',403);
  await db.batch([
   db.prepare("UPDATE kk_ai_sessions SET support_status='ai',needs_human=0,ai_summary='' WHERE id=? AND owner_id=?").bind(sessionId,target.id),
   db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) VALUES(?,'真人客服已結束','對話已交回 AI，後續仍可申請真人協助。','Human support ended','AI support is available again. You can request human support whenever needed.',?)").bind(target.id,b.orderId||null),
   db.prepare("UPDATE kk_support_threads SET status='ai',needs_human=0,unread_member=unread_member+1,unread_admin=0,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(target.id),
   db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id,session_id) VALUES(?,'system',?,?,?)").bind(target.id,'真人客服已結束，本對話已交回 AI 客服。 / Human support ended; AI support is available again.',b.orderId||null,sessionId)
  ]);
  await db.prepare("UPDATE kk_support_threads SET needs_human=CASE WHEN EXISTS(SELECT 1 FROM kk_ai_sessions WHERE owner_id=? AND kind='buyer' AND needs_human=1) THEN 1 ELSE 0 END WHERE member_id=?").bind(target.id,target.id).run();
  return privateJson({ok:true},201);
 }
 const body=String(b.body||'').trim();
 await db.prepare("UPDATE kk_ai_sessions SET updated_at=?,title=CASE WHEN title='新對話' THEN ? ELSE title END WHERE id=?").bind(new Date().toISOString(),body.slice(0,40),sessionId).run();
 if(!body||body.length>2000)throw new ShopError('訊息需為 1 至 2000 字。 / Message must contain 1 to 2000 characters.');
 if(b.orderId&&!await db.prepare('SELECT id FROM shopping_requests WHERE id=? AND member_id=?').bind(b.orderId,target.id).first())throw new ShopError('訂單不屬於此會員。',403);
 if(target.admin){
  await db.batch([
   db.prepare("UPDATE kk_ai_sessions SET support_status='human',needs_human=0 WHERE id=? AND owner_id=?").bind(sessionId,target.id),
   db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id,session_id) VALUES(?,'admin',?,?,?)").bind(target.id,body,b.orderId||null,sessionId),
   db.prepare("UPDATE kk_support_threads SET status='human',needs_human=0,unread_member=unread_member+1,last_admin_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(target.id),
   db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) VALUES(?,'Adela 真人客服回覆',?,'Reply from Adela support',?,?)").bind(target.id,body,body,b.orderId||null)
  ]);
  await db.prepare("UPDATE kk_support_threads SET needs_human=CASE WHEN EXISTS(SELECT 1 FROM kk_ai_sessions WHERE owner_id=? AND kind='buyer' AND needs_human=1) THEN 1 ELSE 0 END WHERE member_id=?").bind(target.id,target.id).run();
  return privateJson({ok:true},201);
 }
 const thread=await db.prepare('SELECT support_status AS status,needs_human FROM kk_ai_sessions WHERE id=?').bind(sessionId).first();
 await db.batch([
  db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id,session_id) VALUES(?,'member',?,?,?)").bind(target.id,body,b.orderId||null,sessionId),
  db.prepare("UPDATE kk_support_threads SET unread_admin=unread_admin+?,last_member_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE member_id=?").bind(thread?.status==='ai'&&!thread?.needs_human?0:1,target.id)
 ]);
 if(thread?.status==='ai'&&!thread?.needs_human){
  const config=await settings(),member=parseMember((await db.prepare(memberSelect+' WHERE m.id=?').bind(target.id).first())!);
  const selected=b.orderId?await db.prepare('SELECT * FROM shopping_requests WHERE id=? AND member_id=?').bind(b.orderId,target.id).first():null;
  const asksRate=/匯率|exchange rate|환율/i.test(String(b.body||''));const rate=await exchange({preferCached:!asksRate}).catch(()=>null),catalog=await products();
  const words=String(b.body||'').toLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]{2,}/g)||[];
  const relevant=catalog.map(p=>({p,score:words.reduce((n,w)=>n+((p.nameZh+' '+p.nameEn+' '+p.categoryZh+' '+(p.brand||'')).toLowerCase().includes(w)?1:0),0)})).sort((a,b)=>b.score-a.score).slice(0,12).map(({p})=>{
   const options={tier:member.tier,fees:config.fees,exchangeRate:rate?.rate,paidOrders:member.paidOrders},price=catalogDisplayPrice(p,options);
   const priceParts=(variantId?:string)=>{const amount=catalogDisplayPrice(p,{...options,variantId}).amount,parts=catalogDisplayParts(p,{...options,variantId});return{priceTwd:amount,serviceFeeIncluded:true,pricingTaxExclusive:p.pricingTaxExclusive===true,serviceFeeTwd:parts?.ok?parts.feeTwd:null,effectiveFeePercent:parts?.ok&&parts.goodsTwd?Number((parts.feeTwd/parts.goodsTwd*100).toFixed(4)):null};};
   return{id:p.id,name:p.nameZh,nameEn:p.nameEn,description:p.descriptionZh.slice(0,120),spec:p.spec,priceTwd:price.amount,serviceFeeIncluded:true,priceIsFrom:p.variants.length>0,...(!p.variants.length?priceParts():{}),options:p.variants.slice(0,6).map(v=>({name:v.labelZh,...priceParts(v.id)})),stockVerified:p.stockQuantityVerified!==false&&p.stock>=0,stock:p.stock>=0?p.stock:null};
  });
  const reply=await supportReply(await messages(target.id,b.orderId||undefined,sessionId),{order:selected?await orderBundle(selected) as any:undefined,member,fees:config.fees,paymentInstructions:config.paymentInstructions,store:{shopPaused:config.shopPaused,photoQuotesPaused:config.photoQuotesPaused,orderOpensAt:config.orderOpensAt,orderClosesAt:config.orderClosesAt,enabledCountries:config.enabledCountries},catalog:relevant,exchange:rate?{currency:'KRW',twdPerUnit:rate.rate,source:rate.source,checkedAt:rate.at}:null});
  await db.prepare("INSERT INTO kk_conversations(member_id,sender,body,order_id,session_id) SELECT owner_id,?,?,?,? FROM kk_ai_sessions WHERE owner_id=? AND id=? AND support_status='ai' AND needs_human=0").bind(reply.modelUsed?'ai':'system',reply.modelUsed?reply.body:reply.body,b.orderId||null,sessionId,target.id,sessionId).run();
  if(reply.handoff)await handoff(target.id,b.orderId||null,undefined,sessionId);
  else await db.prepare("UPDATE kk_support_threads SET unread_member=unread_member+1,updated_at=CURRENT_TIMESTAMP WHERE member_id=? AND status='ai' AND needs_human=0").bind(target.id).run();
 }
 return privateJson({ok:true},201);
}catch(e){return failure(e);}}

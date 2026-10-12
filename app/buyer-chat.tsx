'use client';
import {ChatText} from './chat-text';

import {useStoreText,useStoreLocale} from './store-language';
import {fetchReadJson} from '@/lib/http-response';
import {useEffect,useState,useRef} from 'react';
import {Bot,Headphones,Loader2,MessageCircle,Plus,Send,Sparkles,History,Download} from 'lucide-react';
import {OrderMessageCard} from './order-message-card';
import {notificationDate} from '@/lib/notification-text';
import {stateNames,type ShopOrder} from '@/lib/commerce-types';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent} from '@/components/ui/dialog';

type Message={id:number;sender:'member'|'admin'|'ai'|'system';body:string;order_id:number|null;created_at:string};
type Thread={status:'ai'|'waiting'|'human';needs_human:number;ai_summary:string;unread_admin:number;unread_member:number};
type Props={memberId?:string;name?:string;adminPassword?:string;orderId?:number;en?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean;embedded?:boolean};

async function responseJson(response:Response){
 const text=await response.text();
 if(!text)return {} as Record<string,unknown>;
 try{return JSON.parse(text) as Record<string,unknown>;}catch{throw new Error(response.ok?'伺服器回應格式錯誤，請稍後再試。':'服務暫時無法連線，請稍後再試。');}
}

export function BuyerChat({memberId,name,adminPassword,orderId,en=false,open:controlledOpen,onOpenChange,hideTrigger=false,embedded=false}:Props){
 const [internalOpen,setInternalOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[thread,setThread]=useState<Thread|null>(null),[body,setBody]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [sessions,setSessions]=useState<any[]>([]),[historyOpen,setHistoryOpen]=useState(false);const sessionRef=useRef('');
 const [aiConfigured,setAIConfigured]=useState(false);
 const attached=useRef('');
 const loading=useRef<{key:string;controller:AbortController;pending:Promise<void>}|null>(null);
 const contextKey=String(memberId||'')+':'+String(orderId||'')+':'+String(!!adminPassword),context=useRef(contextKey);context.current=contextKey;
 const [orders,setOrders]=useState<ShopOrder[]>([]),[selectedOrder,setSelectedOrder]=useState<number|null|undefined>(orderId);
 const t=useStoreText(en),language=useStoreLocale(en),open=embedded||(controlledOpen??internalOpen),setOpen=(value:boolean)=>{setInternalOpen(value);onOpenChange?.(value);};
 const headers:Record<string,string>={};if(adminPassword)headers['X-KK-Admin-Password']=adminPassword;
 async function load(force=false){
  const key=contextKey;if(key!==context.current)return;
  if(!force&&loading.current?.key===key)return loading.current.pending;
  loading.current?.controller.abort();
  const controller=new AbortController(),params=new URLSearchParams();if(adminPassword)params.set('memberId',memberId||'');if(orderId)params.set('orderId',String(orderId));if(sessionRef.current)params.set('sessionId',sessionRef.current);
  const pending=(async()=>{try{const v=await fetchReadJson<{messages:Message[];thread:Thread;orders:ShopOrder[];aiConfigured:boolean;sessionId:string;sessions:any[]}>('/api/messages'+(params.size?'?'+params:''),{headers,cache:'no-store',signal:controller.signal});if(controller.signal.aborted||key!==context.current)return;sessionRef.current=v.sessionId;setSessions(v.sessions||[]);setAIConfigured(v.aiConfigured===true);setMessages(v.messages||[]);setThread(v.thread);setOrders(v.orders||[]);setSelectedOrder(current=>orderId||(current===undefined?null:current));setError('');}catch(e){if(!controller.signal.aborted&&key===context.current)setError(e instanceof Error?e.message:'Connection error');}})();
  loading.current={key,controller,pending};void pending.finally(()=>{if(loading.current?.pending===pending)loading.current=null;});return pending;
 }
 useEffect(()=>{if(!open)return;sessionRef.current='';setMessages([]);setOrders([]);setThread(null);setAIConfigured(false);setError('');void load();const timer=setInterval(()=>void load(),5000);return()=>{clearInterval(timer);loading.current?.controller.abort();loading.current=null;};},[open,memberId,adminPassword,orderId]);
 useEffect(()=>{setBody('');},[memberId,orderId,adminPassword]);
 async function act(payload:Record<string,unknown>){if(busy)return;setBusy(true);const key=contextKey;try{const r=await fetch('/api/messages',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({sessionId:sessionRef.current||undefined,memberId,orderId:orderId||selectedOrder||undefined,...payload})}),v=await responseJson(r) as {error?:string;sessionId?:string};if(!r.ok)throw new Error(v.error||t('傳送失敗','Send failed'));if(key===context.current){if(v.sessionId)sessionRef.current=v.sessionId;setBody('');await load(true);}}catch(e){if(key===context.current)setError(e instanceof Error?e.message:'Send failed');}finally{setBusy(false);}}
 useEffect(()=>{setSelectedOrder(orderId||null);},[orderId]);
 useEffect(()=>{if(!open){attached.current='';return;}if(!adminPassword||!orderId||!memberId)return;const key=memberId+':'+orderId;if(attached.current===key)return;attached.current=key;void act({action:'share_order',orderId});},[open,memberId,orderId,adminPassword]);
 async function backup(){try{const params=new URLSearchParams({sessionId:sessionRef.current,export:'1'});if(adminPassword)params.set('memberId',memberId||'');const r=await fetch('/api/messages?'+params,{headers}),v=await responseJson(r);if(!r.ok)throw Error(String(v.error||'Backup failed'));const url=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='Adela-customer-chat-'+sessionRef.current+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(String(e));}}
 const selected=orders.find(o=>o.id===selectedOrder),status=thread?.status||'ai',waiting=status==='waiting'||!!thread?.needs_human;
 const senderName=(sender:Message['sender'])=>sender==='ai'?t('AI 客服','AI support'):sender==='admin'?t('Adela 真人客服','Adela support'):sender==='system'?t('系統','System'):name||t('我','Me');
 const panel=<div className={'kk-chat-panel '+(embedded?'embedded':'')}>
  <header className="kk-chat-heading"><div><h1>{adminPassword?(name||t('旅客對話','Customer conversation')):t('訊息與 AI 客服','Messages & AI support')}</h1><p>{adminPassword?orderId?t('此處只顯示這筆訂單的明細與對話。','Only this order’s details and conversation appear here.'):t('查看完整對話、AI 訴求摘要並直接接手回覆。','Review the full conversation, AI summary and reply as human support.'):waiting?t('已通知真人客服；你可繼續補充內容。','Human support has been notified. You may continue adding details.'):status==='human'?t('Adela 真人客服正在協助你。','Adela human support is assisting you.'):t('可詢問訂單、付款、配送、會員與代購流程。需要真人時，直接在訊息中告訴 AI。','Ask about orders, payments, delivery, membership and shopping. Tell AI in the message when you need a person.')}</p></div>{!adminPassword&&!orderId&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void act({action:'new_conversation'})}><Plus/>{t('建立新對話','New conversation')}</Button>}<Button variant="outline" aria-label={t('對話紀錄','Conversation history')} onClick={()=>setHistoryOpen(!historyOpen)}><History/></Button></header>{historyOpen&&<nav className="adela-chat-history">{sessions.map(s=><button type="button" key={s.id} disabled={busy} onClick={()=>{sessionRef.current=s.id;void load(true);setHistoryOpen(false);}}>{s.title}<small>{String(s.updated_at).slice(0,10)}</small></button>)}<Button variant="outline" onClick={()=>void backup()}><Download/>{t('下載對話備份','Download conversation backup')}</Button></nav>}
  <div className={'kk-support-status '+status}>{status==='ai'?<Bot/>:<Headphones/>}<div><b>{status==='ai'?aiConfigured?t('AI 客服中','AI support'):t('系統客服 · 可轉真人','System support · Human help available'):waiting?t('等待真人客服','Waiting for human support'):t('真人客服中','Human support')}</b><span>{status==='ai'?aiConfigured?t('AI 無法處理時會自動通知管理員','The admin is notified automatically when AI cannot help'):t('AI 尚未啟用，目前提供訂單狀態查詢；其他問題由真人客服協助。','AI is not enabled. You can check order details here; other questions go to human support.'):waiting?t('等待時間未知；管理員已收到對話與摘要','Wait time is unknown. Conversation and summary sent to admin'):t('由 Adela 管理員回覆','Replies from the Adela team')}</span></div></div>
  {adminPassword&&thread?.ai_summary&&<section className="kk-ai-summary"><Sparkles/><div><b>{t('客服訴求摘要','Support summary')}</b><ChatText text={thread.ai_summary}/></div></section>}
  {orderId&&selected&&<section className="kk-support-start"><OrderMessageCard order={selected} en={en}/></section>}
  {!adminPassword&&!orderId&&<section className="kk-support-start"><h3>{t('要詢問訂單問題，請先選擇訂單','Choose an order before asking an order question')}</h3><label>{t('選擇訂單','Choose an order')}<select aria-label={t('選擇訂單','Choose an order')} value={selectedOrder||''} onChange={e=>setSelectedOrder(Number(e.target.value)||null)}><option value="">{t('非訂單相關問題','Not about an order')}</option>{orders.map(o=><option key={o.id} value={o.id}>{o.requestNo} · {language==='zh'?o.identifiedNameZh:o.identifiedNameEn||o.identifiedNameZh}</option>)}</select></label>{selected&&<OrderMessageCard order={selected} en={en}/>}<div className="kk-quick-questions">{(selected?[["配送進度查詢","Delivery status"],["付款與匯款確認","Payment verification"],["取消訂單與截止期限","Cancellation deadline"],["瑕疵換貨申請","Defect exchange"]]:[["會員等級與哩程","Membership and miles"],["目前會員代購費率","My service fees"]]).map(([zh,english])=><Button type="button" variant="outline" key={zh} disabled={busy} onClick={()=>void act({body:t(zh,english)})}>{t(zh,english)}</Button>)}</div></section>}
  {!adminPassword&&<div className="adela-chat-start-cards buyer">{[['會員與優惠','Membership & benefits',['我的會員等級與購物金','優惠券如何使用']],['商品與訂單','Products & orders',['推薦適合我的香水','如何回報已付款']],['採買與客服','Purchasing & support',['延期與退款怎麼處理','轉真人客服']]].map(([title,image,questions])=><article key={String(title)}><img src="/kk-hero.png" alt=""/><strong>{t(String(title),String(image))}</strong>{(questions as string[]).map(q=><button type="button" key={q} onClick={()=>q==='轉真人客服'?void act({action:'handoff'}):setBody(t(q,({'我的會員等級與購物金':'My membership and store credit','優惠券如何使用':'How to use coupons','推薦適合我的香水':'Recommend a fragrance for me','如何回報已付款':'How to report my payment','延期與退款怎麼處理':'Deferral and refunds','轉真人客服':'Human support'} as Record<string,string>)[q]||q))}>{t(q,({'我的會員等級與購物金':'My membership and store credit','優惠券如何使用':'How to use coupons','推薦適合我的香水':'Recommend a fragrance for me','如何回報已付款':'How to report my payment','延期與退款怎麼處理':'Deferral and refunds','轉真人客服':'Human support'} as Record<string,string>)[q]||q)}</button>)}</article>)}</div>}
  <div className="kk-chat-messages" role="log" aria-label={t("對話紀錄","Conversation")}>{messages.map(m=><div key={m.id} className={((m.sender==='admin')===!!adminPassword&&m.sender!=='system'&&m.sender!=='ai')||(!adminPassword&&m.sender==='member')?'mine':m.sender}><small>{senderName(m.sender)}{m.order_id?' · #'+m.order_id:''}</small>{m.order_id&&orders.find(o=>o.id===m.order_id)&&<OrderMessageCard order={orders.find(o=>o.id===m.order_id)!} en={en}/>}<ChatText text={m.body.startsWith("訂單 / Order ")&&orders.some(o=>o.id===m.order_id)?t("已附上訂單明細","Order details attached"):m.body.replace(/^系統訂單說明（未使用 AI 模型） \/ System order information \(AI model not used\)\n/,'')}/><time>{notificationDate(m.created_at,language)}</time></div>)}{!messages.length&&<div className="ai"><small>{aiConfigured?t('AI 客服','AI support'):t('系統客服','System support')}</small><p>{t('你好！可以詢問代購費、會員等級、付款、哩程或訂單流程。','Hi! Ask about service fees, membership, payments, miles or the order process.')}</p></div>}</div>
  {error&&<p role="alert" className="kk-chat-error">{t(error,error)}</p>}
  <form className="kk-chat-compose" onSubmit={e=>{e.preventDefault();void act({body});}}><textarea aria-label={t('訊息內容','Message')} value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} rows={3} required placeholder={waiting?t('可繼續留言，管理員會看到','You may add details while waiting'):t('輸入你的問題…','Type your question…')}/><Button disabled={busy||!body.trim()}>{busy?<Loader2 className="kk-spin"/>:<Send/>}{t('傳送','Send')}</Button></form>
  {adminPassword&&status!=='ai'&&<div className="kk-chat-actions"><Button variant="outline" disabled={busy} onClick={()=>void act({action:'resume_ai'})}><Bot/>{t('結束真人服務，交回 AI','End human support · Return to AI')}</Button></div>}
 </div>;
 if(embedded)return panel;
 return <>{!hideTrigger&&<Button variant="outline" type="button" onClick={()=>setOpen(true)}><MessageCircle/>{adminPassword?t('私訊買家','Message buyer'):t('訊息與 AI 客服','Messages & AI support')}</Button>}<Dialog open={open} onOpenChange={setOpen}><DialogContent className="kk-modal kk-chat">{panel}</DialogContent></Dialog></>;
}

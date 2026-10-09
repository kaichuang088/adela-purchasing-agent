'use client';
import {useAdminText} from './admin-language';
import {useState} from 'react';
import {Button} from '@/components/ui/button';

export function EmailDeliveryPanel({configured,queue,password,refresh}:{configured:boolean;queue:Record<string,number>;password:string;refresh:()=>Promise<void>}){
 const a=useAdminText();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function process(){
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/operations/email-queue',{method:'POST',headers:{'X-KK-Admin-Password':password}});
   const value=await response.json() as {error?:string;accepted:number;retrying:number;blocked:number;review:number};
   if(!response.ok)throw new Error(value.error||'Email 寄送尚未設定。');
   setMessage(a('本次服務商接受 {accepted} 封；待重試 {retrying} 封；需處理 {review} 封。',{accepted:value.accepted,retrying:value.retrying,review:value.blocked+value.review}));
   await refresh();
  }catch(e){setMessage(a(e instanceof Error?e.message:'通知暫時無法寄送。'));}finally{setBusy(false);}
 }
 return <section className="op-panel op-email-delivery" aria-label={a("訂單 Email 通知")}>
  <div className="op-panel-head"><div><h3>{a("訂單 Email 通知")}</h3><p>{configured?a("寄送資料已設定；仍須驗證實際收信。"):a("尚未設定寄信服務，通知已保留，尚未寄出。")}</p></div><Button disabled={!configured||busy} onClick={()=>void process()}>{busy?a("處理中…"):a("處理待寄通知")}</Button></div>
  <div className="op-delivery-counts">{[['pending','待寄送'],['sending','處理中'],['accepted','服務商已接受'],['blocked','無法寄送'],['review','待人工確認']].map(([key,label])=><div key={key}><span>{a(label)}</span><strong>{queue[key]||0}</strong></div>)}</div>
  <small>{a("「服務商已接受」不代表已送達信箱。需人工確認的通知不會自動重寄，以免重複通知。")}</small>
  {message&&<p role="status">{message}</p>}
 </section>;
}

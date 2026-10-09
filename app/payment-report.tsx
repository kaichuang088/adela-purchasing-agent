'use client';
import {useId,useState,type FormEvent} from 'react';
import {CreditCard,Upload,Check} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {BankDetails} from './order-tools';
import {useStoreText} from './store-language';
import type {ShopOrder} from '@/lib/commerce-types';

export function PaymentReport({order:o,bank,en=false,reload}:{order:ShopOrder;bank:{name:string;code:string;account:string;accountName:string};en?:boolean;reload:()=>Promise<void>}){
 const t=useStoreText(en),formId=useId(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!['awaiting_payment','payment_review'].includes(o.status)||o.paymentMethod!=='transfer')return null;
 const reported=!!o.paymentReportedAt;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  const form=new FormData(event.currentTarget),reference=String(form.get('reference')||'').trim(),file=form.get('image');
  if(!reference&&!(file instanceof File&&file.size)){setError(t('請填末五碼或選擇付款截圖。','Enter the last five digits or choose a payment screenshot.'));return;}
  if(file instanceof File&&file.size>1048576){setError(t('付款截圖請勿超過 1 MB。','Payment screenshots must be no larger than 1 MB.'));return;}
  setBusy(true);setError('');form.set('id',String(o.id));
  try{
   const response=await fetch('/api/payments/report',{method:'POST',body:form});
   const value=await response.json().catch(()=>null) as {error?:string}|null;
   if(!response.ok||!value)throw new Error(value?.error||t('付款資料暫時無法送出，請稍後重試。','Payment details could not be submitted. Please try again.'));
   await reload();setOpen(false);
  }catch(e){setError(e instanceof Error?e.message:t('付款資料暫時無法送出，請稍後重試。','Payment details could not be submitted. Please try again.'));}
  finally{setBusy(false);}
 }
 return <section className="kk-payment-card">
  <div className="kk-payment-summary"><CreditCard aria-hidden="true"/><div>
   <span>{reported?t('已回報・等待賣家核對','Reported · Awaiting verification'):t('訂單已確認・待付款','Order confirmed · Awaiting payment')}</span>
   <strong>NT${(o.pricing?.totalTwd||0).toLocaleString()}</strong>
   {o.paymentDueAt&&<small>{t('付款期限 ','Pay by ')}{new Date(o.paymentDueAt).toLocaleString(en?'en-GB':'zh-TW',{timeZone:'Asia/Taipei'})}</small>}
  </div><Button disabled={busy} aria-expanded={open} aria-controls={formId} onClick={()=>{setOpen(!open);setError('');}}>{open?t('收起付款表單','Hide payment form'):reported?t('補充付款資料','Update payment details'):t('我已付款','I have paid')}</Button></div>
  {reported&&<p className="kk-payment-feedback">{t('付款資料已送出，請勿重複匯款。賣家核對後會更新為「已付款」。','Your payment report was submitted. Do not transfer again. The seller will confirm payment after verification.')}</p>}
  <details open={!reported}><summary>{t('銀行匯款資料','Bank transfer details')}</summary><BankDetails bank={bank} en={en}/></details>
  {open&&<form id={formId} className="kk-form kk-payment-form" onSubmit={submit} aria-busy={busy}>
   <h4>{t('回報付款','Report payment')}</h4><p id={formId+'-help'}>{t('以下兩項擇一填寫，也可同時提供。','Provide either of the following, or both.')}</p>
   <div className="kk-payment-fields">
    <label>{t('匯款帳號末五碼','Last five account digits')}<input name="reference" aria-describedby={formId+'-help'} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} disabled={busy} defaultValue={/^\d{5}$/.test(o.paymentReference)?o.paymentReference:''} placeholder="12345"/><small>{t('你用來匯款的帳號末五碼。','The last five digits of the account you transferred from.')}</small></label>
    <label><span><Upload size={18} aria-hidden="true"/>{t('付款截圖','Payment screenshot')}</span><input name="image" type="file" aria-describedby={formId+'-help'} accept="image/png,image/jpeg,image/webp" disabled={busy}/><small>{t('JPG、PNG 或 WEBP，最多 1 MB。','JPG, PNG or WEBP, up to 1 MB.')}</small></label>
   </div>{error&&<p role="alert" className="kk-error">{t(error,error)}</p>}
   <Button disabled={busy}><Check aria-hidden="true"/>{busy?t('正在送出…','Submitting…'):t('送出付款資料','Submit payment details')}</Button>
  </form>}
 </section>;
}

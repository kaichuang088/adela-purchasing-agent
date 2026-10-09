'use client';
import {useStoreText,useStoreLocale,localeCode} from './store-language';
import {useEffect,useMemo,useState} from 'react';
import {FileText,LoaderCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {ShopOrder} from '@/lib/commerce-types';
import {fetchReceiptOrders} from '@/lib/receipt-request';

type PaymentFilter='all'|'paid'|'unpaid';
const memberKey=(order:ShopOrder)=>order.memberId||`email:${order.email.toLowerCase()}`;

export function ReceiptTools({orders,adminPassword,single=false,en=false}:{orders:ShopOrder[];adminPassword?:string;single?:boolean;en?:boolean}){
 const admin=Boolean(adminPassword),available=orders.filter(o=>o.pricing);
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<number[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [receipt,setReceipt]=useState<{url:string;name:string}|null>(null);
 useEffect(()=>()=>{if(receipt)URL.revokeObjectURL(receipt.url);},[receipt]);
 const [traveler,setTraveler]=useState(''),[payment,setPayment]=useState<PaymentFilter>('all');
 const language=useStoreLocale(en),t=useStoreText(en);
 const readyLink=receipt&&<p role="status"><a href={receipt.url} download={receipt.name}>{t('PDF 已備妥，再次下載','PDF ready — download again')}</a></p>;
 const travelers=useMemo(()=>[...new Map(available.map(o=>[memberKey(o),{key:memberKey(o),name:o.customerName,email:o.email}])).values()],[available]);
 const visible=available.filter(o=>(!traveler||memberKey(o)===traveler)&&(payment==='all'||(payment==='paid'?Boolean(o.paidAt):!o.paidAt)));

 async function download(ids:number[]){setBusy(true);setError('');setReceipt(null);try{
  const receiptOrders=await fetchReceiptOrders(ids,adminPassword);
  const font=await fetch('/fonts/NotoSansCJKtc-Regular.otf');if(!font.ok)throw new Error(t('PDF 字型載入失敗，請重試。','PDF font failed to load. Retry.'));
  const {createReceiptPdf}=await import('@/lib/receipt-pdf');const bytes=await createReceiptPdf(receiptOrders,new Uint8Array(await font.arrayBuffer()));
  const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download='Adela-Receipt-'+(receiptOrders.length===1?receiptOrders[0].requestNo:new Date().toISOString().slice(0,10))+'.pdf';setReceipt({url,name:link.download});link.hidden=true;document.body.appendChild(link);link.click();link.remove();
 }catch(e){setError(e instanceof Error?e.message:'PDF error');}finally{setBusy(false);}}

 if(!admin||single){const order=orders.length===1?orders[0]:null;return <div className="kk-single-receipt"><Button type="button" variant="outline" disabled={!order?.pricing||busy} onClick={()=>order&&void download([order.id])}>{busy?<LoaderCircle className="animate-spin"/>:<FileText/>}{t('下載此訂單 PDF 收據','Download this order receipt')}</Button>{readyLink}{error&&<p role="alert">{t(error,error)}</p>}</div>;}

 function chooseTraveler(key:string){setTraveler(key);setSelected([]);setError('');setReceipt(null);}
 function choosePayment(value:PaymentFilter){setPayment(value);setSelected([]);setError('');setReceipt(null);}
 return <><Button type="button" variant="outline" disabled={!orders.length} onClick={()=>{setSelected([]);setTraveler('');setPayment('all');setOpen(true);setError('');setReceipt(null);}}><FileText/>{t("批次收據／合併 PDF","Batch receipts / Combined PDF")}</Button><Dialog open={open} onOpenChange={v=>!busy&&setOpen(v)}><DialogContent className="kk-modal kk-receipt-select"><DialogHeader><DialogTitle>{t("管理員批次 PDF 收據","Batch PDF receipts")}</DialogTitle><DialogDescription>{t("先選擇一位旅客，再依全部、已付款或未付款篩選；同一份 PDF 不會混入其他旅客的訂單。","Choose one customer, then filter by payment status. Each PDF contains orders from that customer only.")}</DialogDescription></DialogHeader><div className="kk-receipt-filters"><label>{t("旅客","Customer")}<select value={traveler} onChange={e=>chooseTraveler(e.target.value)}><option value="">{t("請選擇旅客","Choose a customer")}</option>{travelers.map(x=><option key={x.key} value={x.key}>{x.name} · {x.email}</option>)}</select></label><label>{t("付款狀態","Payment status")}<select value={payment} onChange={e=>choosePayment(e.target.value as PaymentFilter)}><option value="all">{t("全部訂單","All orders")}</option><option value="paid">{t("已付款","Paid")}</option><option value="unpaid">{t("未付款","Unpaid")}</option></select></label></div><div className="kk-receipt-actions"><Button type="button" variant="outline" disabled={!traveler||!visible.length} onClick={()=>setSelected(visible.slice(0,50).map(o=>o.id))}>{t("全選目前結果（最多 50 張）","Select all results (up to 50)")}</Button><Button type="button" variant="ghost" onClick={()=>setSelected([])}>{t("清除","Clear")}</Button></div><div className="kk-receipt-list">{traveler?visible.map(o=><label key={o.id}><input type="checkbox" disabled={busy||(!selected.includes(o.id)&&selected.length>=50)} checked={selected.includes(o.id)} onChange={e=>setSelected(e.target.checked?[...selected,o.id]:selected.filter(id=>id!==o.id))}/><div><b>{o.requestNo}</b><span>{(language==='zh'?o.identifiedNameZh:o.identifiedNameEn||o.identifiedNameZh)||t('商品查價中','Checking product price')}</span><small>{o.paidAt?t('已付款','Paid')+' · '+new Date(o.paidAt).toLocaleDateString(localeCode(language),{timeZone:'Asia/Taipei'}):t('未付款','Unpaid')}</small></div><strong>{o.pricing?'NT$'+o.pricing.totalTwd.toLocaleString():'—'}</strong></label>):<p className="kk-receipt-note">{t("請先選擇旅客。","Choose a customer first.")}</p>}</div>{traveler&&!visible.length&&<p className="kk-receipt-note">{t("這位旅客在目前付款篩選下沒有可產生收據的訂單。","No eligible orders match this customer and payment filter.")}</p>}{readyLink}{error&&<p role="alert">{t(error,error)}</p>}<Button disabled={!selected.length||busy} onClick={()=>void download(selected)}>{busy?<LoaderCircle className="animate-spin"/>:<FileText/>}{busy?t('正在產生 PDF…','Generating PDF…'):t('下載所選 {count} 張訂單 PDF','Download PDF for {count} selected orders',{count:selected.length})}</Button></DialogContent></Dialog></>;
}

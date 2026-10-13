'use client';
import {useState,useEffect} from 'react';
import {resolveProductPhoto} from '@/lib/product-photo';
import {Package} from 'lucide-react';
import {type ShopOrder} from '@/lib/commerce-types';
import {useStoreText,useStoreLocale} from './store-language';
import {OrderStatusBadge} from './order-status-badge';
function OrderPhoto({src,name}:{src?:string;name:string}){const photo=resolveProductPhoto(src),[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[photo]);return photo&&!failed?<img src={photo} alt={name} loading="lazy" onError={()=>setFailed(true)}/>:<span className="adela-order-photo-empty" aria-label={name}><Package aria-hidden="true"/></span>;}
export function OrderMessageCard({order,en=false}:{order:ShopOrder;en?:boolean}){
 const t=useStoreText(en),locale=useStoreLocale(en),items=order.pricing?.items||[],count=items.reduce((n,i)=>n+i.quantity,0);
 return <article className="adela-order-card" aria-label={t('訂單明細','Order details')}>
  <header><strong>{order.requestNo}</strong><OrderStatusBadge status={order.status} en={en}/></header>
  <div>{order.note?.startsWith('管理員代下單')&&<strong className="adela-assisted-badge">{t('由管理員代下單 · 等待會員付款與賣家核款','Placed by admin · Awaiting member payment and seller verification')}</strong>}</div><div className="adela-order-items">{items.map((line,i)=><div key={i} className="adela-order-item"><OrderPhoto src={line.imageUrl} name={locale==='zh'?line.nameZh:line.nameEn||line.nameZh}/><div><b>{locale==='zh'?line.nameZh:line.nameEn||line.nameZh}</b>{(line.variantLabelZh||line.variantLabelEn)&&<small>{locale==='zh'?line.variantLabelZh:line.variantLabelEn||line.variantLabelZh}</small>}<small>× {line.quantity}</small></div></div>)}{!items.length&&<div className="adela-order-item"><OrderPhoto src={order.imageKey&&order.imageKey!=='catalog-demo'?(order.imageKey.startsWith('static/')?'/'+order.imageKey.slice(7):'/api/media/'+order.imageKey):undefined} name={order.identifiedNameZh}/><b>{order.identifiedNameZh||t('客製代購','Custom order')}</b></div>}</div>
  <footer><span>{count||1} {t('件商品','items')}</span><div>{t('訂單合計','Order total')} <strong>{order.pricing?'NT$'+order.pricing.totalTwd.toLocaleString('en-US'):t('待報價','Quote pending')}</strong></div></footer>
 </article>;
}

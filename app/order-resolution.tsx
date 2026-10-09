'use client';
import React from 'react';
import {useStoreText} from './store-language';
import {stateNames,type ShopOrder} from '@/lib/commerce-types';

export function OrderResolution({order,en=false}:{order:ShopOrder;en?:boolean}){
 const t=useStoreText(en);
 if(!['cancelled','refunded','rejected','refund_pending'].includes(order.status))return null;
 const credit=order.status==='cancelled'&&order.refundKind==='store_credit';
 const amount=Number(order.refundAmountTwd)||0;
 const event=order.events?.filter(item=>item.status===order.status||(order.itemRefundTwd&&item.status==='item_update')).at(-1);
 const timestamp=event?.createdAt?(event.createdAt.includes('T')?event.createdAt:event.createdAt.replace(' ','T')+'Z'):'';
 const validTime=timestamp&&Number.isFinite(Date.parse(timestamp));
 return <article className="kk-resolution" aria-label={t('取消與退款結果','Cancellation and refund result')}>
  <header><strong>{t(stateNames[order.status]?.[0]||order.status,stateNames[order.status]?.[1]||order.status)}</strong>{credit&&amount>0&&<span>{t('購物金已入帳','Store credit issued')}</span>}</header>
  {order.refundInitiator&&<p><b>{order.refundInitiator==='seller'?t('非自願退款（賣家取消）','Involuntary refund (seller cancellation)'):t('買家申請取消','Buyer-requested cancellation')}</b></p>}
  <dl>
   <div><dt>{t('原訂單號','Original order')}</dt><dd>{order.requestNo}</dd></div>
   <div><dt>{t('處理時間（台灣時間）','Processed at (Taiwan time)')}</dt><dd>{validTime?<time dateTime={timestamp}>{new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(timestamp))}</time>:t('未記錄','Not recorded')}</dd></div>
   {credit&&<div><dt>{t('退回購物金','Store credit returned')}</dt><dd className="kk-resolution-amount">NT${amount.toLocaleString('en-US')}</dd></div>}
  </dl>
  {credit&&(amount>0?<p>{t('下次結帳自動折抵，剩餘金額繼續保留。','Automatically applied at your next checkout; unused credit remains available.')}</p>:<p>{t('此訂單沒有已付款金額或已使用購物金，無款項需退回。','This order has no paid amount or applied store credit to return.')}</p>)}
  {order.cancelReason&&<p>{t('取消原因：','Cancellation reason: ')}{order.cancelReason}</p>}
 </article>;
}

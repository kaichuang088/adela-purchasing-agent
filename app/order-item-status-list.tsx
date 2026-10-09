import type {ShopOrder} from '@/lib/commerce-types';
import {useStoreText} from './store-language';
const labels:Record<string,[string,string]>={pending:['待採買','Awaiting purchase'],deferred:['已接受延期','Deferral accepted'],defer_pending:['等待延期確認','Deferral awaiting decision'],purchased:['已買到','Purchased'],cancelled:['非自願退款','Involuntary refund']};
export function OrderItemStatusList({order,en=false}:{order:ShopOrder;en?:boolean}){
 const t=useStoreText(en);
 const items=order.itemFulfilment?.length?order.itemFulfilment:order.pricing?.items.map((line,lineIndex)=>({line,lineIndex,status:order.purchasedAt?'purchased':'pending',purchaseAt:order.purchaseAt,purchasedAt:order.purchasedAt,proposedAt:null}))||[];
 return <ul className="kk-order-item-status" aria-label={t('每件商品的採買狀態','Purchase status of each item')}>{items.map(x=>{
 const pending=x.status==='pending',state=pending&&['cancelled','refunded','rejected'].includes(order.status)?t('訂單已取消／退款','Order cancelled or refunded'):pending&&order.status==='on_hold'?t('暫停處理','On hold'):pending&&!order.paidAt&&order.paymentMethod!=='cod'?(order.paymentReportedAt?t('待核對付款','Payment awaiting verification'):t('等待付款','Awaiting payment')):pending&&order.status==='purchasing'?t('採買中・系統自動','Purchasing · automatic'):pending&&!order.paidAt&&order.paymentMethod==='cod'?t('待採買・貨到付款','Awaiting purchase · COD'):t(...(labels[x.status]||[x.status,x.status]));
 return <li key={x.lineIndex}>{x.line.imageUrl&&<img src={x.line.imageUrl} alt="" loading="lazy"/>}<div><b>{en?x.line.nameEn:x.line.nameZh}</b><small>{en?x.line.variantLabelEn:x.line.variantLabelZh} × {x.line.quantity}</small>{x.purchaseAt&&<small>{t('採買日期：','Purchase date: ')}{new Date(x.purchaseAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})}</small>}</div><span className={'kk-item-state i-'+x.status}>{state}</span></li>;
 })}</ul>;
}

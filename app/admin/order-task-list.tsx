'use client';
import type {ShopOrder} from '@/lib/commerce-types';
import {orderTask} from '@/lib/admin-tasks';
import {useAdminText} from './admin-language';
export function OrderTaskList({orders,onSelect}:{orders:ShopOrder[];onSelect:(o:ShopOrder)=>void}){
 const a=useAdminText(),tasks=orders.flatMap(order=>{const task=orderTask(order);return task?[{order,task}]:[]});
 if(!tasks.length)return null;
 return <section className="op-task-list"><header><h3>{a('待處理訂單')} <span>{tasks.length}</span></h3><p>{a('完成處理後自動移出此清單。')}</p></header>{tasks.map(({order:o,task})=><article key={o.id}><div><span className={'op-task-badge '+task.kind}>{a(task.label)}</span><h4>{o.customerName}<small>{o.requestNo}</small></h4><p>{a(task.detail)}</p>{task.kind==='refund'&&<strong>NT${(o.refundAmountTwd||o.pricing?.totalTwd||0).toLocaleString()}</strong>}</div><button type="button" onClick={()=>onSelect(o)}>{a(task.action)} ↗</button></article>)}</section>;
}

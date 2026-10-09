'use client';
import {stateNames} from '@/lib/commerce-types';
import {useStoreText} from './store-language';

export function OrderStatusBadge({status,en=false}:{status:string;en?:boolean}){
 const t=useStoreText(en),label=status==='payment_review'?['待核對','Pending verification'] as const:stateNames[status];
 return <span className="adela-status" data-status={status}>{label?t(label[0],label[1]):status}</span>;
}

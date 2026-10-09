'use client';
import {useStoreText} from './store-language';
import type {PriceRevision} from '@/lib/commerce-types';
export function RevisionCredit({revision:r}:{revision:PriceRevision}){
 const t=useStoreText(),amount=r.creditReturnedTwd??Math.max(0,(r.previous.totalTwd+(r.previous.creditAppliedTwd||0))-(r.proposed.totalTwd+(r.proposed.creditAppliedTwd||0)));
 if(!amount)return null;
 return <p className="kk-credit-return">{r.status==='declined'?t('提案已拒絕，未退回購物金','Proposal declined; no credit returned'):r.status==='settled'?t('已退回購物金','Store credit returned'):t('核對後將退回購物金','Store credit will be returned after reconciliation')} · NT${amount.toLocaleString()}</p>;
}

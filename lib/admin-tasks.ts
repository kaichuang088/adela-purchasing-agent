import type {ShopOrder} from './commerce-types';
export function orderTask(o:ShopOrder){
 if(['cancelled','refunded','rejected','completed'].includes(o.status))return null;
 if(o.status==='refund_pending')return o.refundKind==='store_credit'?null:{label:'退款待處理',action:'處理退款',detail:'完成退款並填入核對紀錄後，自動移除此待辦。',kind:'refund'};
 if(o.exchangeStatus==='requested')return {label:'換貨待審',action:'審核換貨',detail:'查看買家提供的照片與原因。',kind:'exchange'};
 if(o.status==='payment_review'&&!o.paidAt)return {label:'匯款待核對',action:'核對收款',detail:'確認銀行入帳後完成收款核對。',kind:'payment'};
 if(['submitted','admin_review'].includes(o.status))return {label:'新訂單待確認',action:'查看訂單',detail:o.kind==='custom'?'買家已接受預估總價；請在 24 小時內核對商品、成本與運費。'+(o.sellerReviewDueAt?'期限：'+new Date(o.sellerReviewDueAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):''):'確認商品與報價後通知買家。',kind:'order'};
 if(o.paidAt&&o.purchaseAtTo&&!o.purchasedAt&&o.itemFulfilment?.some(i=>['pending','deferred'].includes(i.status))){const end=new Date(o.purchaseAtTo),decisionAt=new Date(end);decisionAt.setUTCHours(4,0,0,0);if(decisionAt.getTime()<=end.getTime())decisionAt.setUTCDate(decisionAt.getUTCDate()+1);if(Date.now()>=decisionAt.getTime())return {label:'本波未買到品項待決定',action:'取消或延期',detail:'請確認哪些品項已買到；未買到可取消並退實付購物金，或提出 48 小時延期選擇。',kind:'defer'};}
 return null;
}

import type {ShopOrder} from './commerce-types';
export function orderTask(o:ShopOrder){
 if(['cancelled','refunded','rejected','completed'].includes(o.status))return null;
 if(o.status==='refund_pending')return o.refundKind==='store_credit'?null:{label:'退款待處理',action:'處理退款',detail:'完成退款並填入核對紀錄後，自動移除此待辦。',kind:'refund'};
 if(o.exchangeStatus==='requested')return {label:'換貨待審',action:'審核換貨',detail:'查看買家提供的照片與原因。',kind:'exchange'};
 if(o.status==='payment_review'&&!o.paidAt)return {label:'匯款待核對',action:'核對收款',detail:'確認銀行入帳後完成收款核對。',kind:'payment'};
 if(['submitted','admin_review'].includes(o.status))return {label:'新訂單待確認',action:'查看訂單',detail:'確認商品與報價後通知買家。',kind:'order'};
 return null;
}

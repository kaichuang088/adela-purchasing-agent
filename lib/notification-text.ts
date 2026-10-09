export type NotificationLocale='zh'|'en'|'ko';
export type Notice={title?:string;body?:string;title_en?:string;body_en?:string;titleZh?:string;titleEn?:string;detailZh?:string;detailEn?:string};
const templates:Record<string,[string,string]>={
 '退款申請已通過，已轉入購物金':['Refund approved; store credit added','환불 승인 · 쇼핑 적립금 지급'],
 '訂單已取消':['Order cancelled','주문 취소'],
 '採買已開始':['Purchasing started','구매 시작'],
 '採買中':['Purchasing started','구매 시작'],
 '付款提醒':['Payment reminder','결제 알림'],
 '商品報價調整':['Price revision','상품 견적 변경'],
 '訂單價格調整':['Order price revision','주문 가격 변경'],
 '調價款項已核對':['Price difference settled','가격 차액 확인 완료'],
 '訂單已確認':['Order confirmed','주문 확인'],
 '已確認購買':['Purchase confirmed','구매 확인'],
 '購物金已全額折抵':['Paid with store credit','쇼핑 적립금으로 전액 결제'],
 '已回報匯款，等待核對':['Transfer reported, awaiting verification','송금 신고 · 확인 대기'],
 '商品已買到':['Product purchased','상품 구매 완료'],
 '商品報價已核准':['Quote approved','견적 승인'],
};
export function notificationText(n:Notice,locale:NotificationLocale){
 const title=n.title??n.titleZh??'',body=n.body??n.detailZh??'',enTitle=n.title_en??n.titleEn??'',enBody=n.body_en??n.detailEn??'';
 if(locale==='zh')return{title,body};
 const known=templates[title];if(!known)return {title:enTitle||title,body:enBody||body};
 const order=(body+' '+enBody).match(/KK\d{6}-[A-F0-9]+/)?.[0]||'';
 const amount=body.match(/NT\$[\d,]+/)?.[0]||enBody.match(/NT\$[\d,]+/)?.[0]||'';
 let translated=enBody||body;
 if(title==='退款申請已通過，已轉入購物金')translated=locale==='ko'?`${order} 주문이 취소되었습니다. ${amount} 쇼핑 적립금이 지급되었으며 다음 주문에 자동 적용됩니다. 잔액은 유지됩니다. 원래 주문의 마일리지와 누적 구매 금액이 취소되었습니다.`:`Order ${order} cancelled. ${amount} store credit added and applied automatically to your next order; unused credit remains. Original order rewards and spend reversed.`;
 else if(title==='訂單已取消')translated=locale==='ko'?`${order} 주문이 취소되었습니다. 결제할 필요가 없습니다.`:`Order ${order} cancelled; no payment is due.`;
 else if(title==='採買已開始'||title==='採買中')translated=locale==='ko'?`${order} 구매 기간이 시작되어 구매를 진행합니다.`:`${order}: the purchase window has started.`;
 else if(title==='付款提醒')translated=locale==='ko'?`${order}: 은행 정보를 확인하여 송금한 후 계좌번호 마지막 5자리 또는 결제 스크린샷을 제출하세요. 판매자 확인 전에는 결제 완료가 아닙니다.`:enBody||`${order}: transfer the payment, then submit the last five account digits or a payment screenshot.`;
 else if(locale==='ko'){
  // Known fixed sentences only. Merchant reasons remain verbatim.
  translated=(enBody||body).replace('Review and confirm the revised quote.','변경된 견적을 확인하고 승인하세요.').replace(/revised cash total/g,'변경된 현금 결제 금액').replace(/revised total/g,'변경된 총액').replace(/Difference settled\./g,'차액 확인 완료.').replace(/Store credit returned:/g,'지급된 쇼핑 적립금:').replace(/Credit returned/g,'지급된 쇼핑 적립금');
  if(title==='商品報價調整'||title==='訂單價格調整')translated=body.replace('請查看並確認新報價。','변경된 견적을 확인하고 승인하세요。');
 }
 return {title:known[locale==='ko'?1:0],body:translated};
}
export function notificationDate(value:string,locale:NotificationLocale){
 if(!value)return '';
 const utc=/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)?value.replace(' ','T')+'Z':value;
 const date=new Date(utc);if(!Number.isFinite(date.getTime()))return '';
 return new Intl.DateTimeFormat(locale==='ko'?'ko-KR':locale==='en'?'en-GB':'zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
}

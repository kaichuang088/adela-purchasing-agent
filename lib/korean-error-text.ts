import translations from './korean-errors.json';
const copy:Record<string,string>=translations;
const couponPrefixes=['優惠券無效、已到期或不適用此會員：','優惠券已使用：','請先到「我的優惠券」領取或輸入優惠碼：','優惠券不適用此購物車：'];
// Translate known application messages only. Unknown provider or seller text stays intact.
export function koreanErrorText(message:string):string|undefined {
 if(Object.hasOwn(copy,message))return copy[message];
 for(const prefix of couponPrefixes)if(message.startsWith(prefix))return copy[prefix]+message.slice(prefix.length);
 let match=message.match(/^([A-Za-z0-9_-]{1,80})：適用商品須滿 NT\$(\d+)（類別券只計算該類別商品）。$/);
 if(match)return `${match[1]}: 적용 대상 상품 금액이 NT$${match[2]} 이상이어야 합니다. 카테고리 쿠폰은 해당 카테고리 상품만 계산합니다.`;
 match=message.match(/^([A-Z]{3}) 匯率暫時無法取得。 \/ Exchange rate unavailable\.$/);
 if(match)return `${match[1]} 환율을 현재 가져올 수 없습니다.`;
 match=message.match(/^([A-Z]{3}) 匯率不可用，未建立訂單。 \/ Rate unavailable; no order was created\.$/);
 if(match)return `${match[1]} 환율을 사용할 수 없어 주문이 생성되지 않았습니다.`;
 match=message.match(/^AI 服務回應 (\d{3})；沒有修改資料。$/);
 if(match)return `AI 서비스 응답 ${match[1]}. 데이터는 변경되지 않았습니다.`;
 match=message.match(/^AI 查詢失敗（(\d{3})）。沒有儲存商品，請檢查模型及 Gateway 設定。$/);
 if(match)return `AI 조회 실패 (${match[1]}). 상품은 저장되지 않았습니다. 모델 및 Gateway 설정을 확인하세요.`;
 return undefined;
}

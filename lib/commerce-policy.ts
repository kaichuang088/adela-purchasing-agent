import {feeRates, type Tier, type Offer, type ShopProduct} from './commerce-types';

export type FeeTable = Record<Tier,{catalog:number;custom:number}>;
export type ShippingTable = Record<Tier,number>;
export const defaultShipping:ShippingTable={standard:50,platinum:50,black:50,diamond:0};
export const defaultFees:FeeTable=feeRates;
export const terminalStates=['cancelled','rejected','refunded'];
export const deliverySteps=['paid','purchasing','purchased','shipped_japan','arrived_taiwan','completed'];
export function offerMatches(o:Offer,p:Pick<ShopProduct,'id'|'categoryZh'>){
 if(o.scope==='products')return (o.productIds||[]).includes(p.id);
 if(o.scope==='category')return o.category===p.categoryZh;
 return o.productId==null||o.productId===p.id;
}
export function offerLabel(o:Offer,language:boolean|'zh'|'en'|'ko'=false){
 if(language==='ko'){
  const threshold=o.minMerchandiseTwd?` · 최소 상품 금액 NT$${o.minMerchandiseTwd.toLocaleString()}`:'';
  const value=o.value||0,currency=o.currency||'TWD';
  const labels:Record<string,string>={percent:`상품 ${value}% 할인`,product_percent:`상품 ${value}% 할인`,fixed:`상품 ${currency} ${value} 할인`,product_fixed:`상품 ${currency} ${value} 할인`,shipping_free:'무료 배송',shipping_percent:`배송비 ${value}% 할인`,shipping_fixed:`배송비 ${currency} ${value} 할인`,order_percent:`주문 전체 ${value}% 할인`,order_fixed:`주문 전체 ${currency} ${value} 할인`};
  return (labels[o.discountType||'']||`구매 대행 수수료 ${o.rate}%`)+threshold;
 }
 const en=language===true||language==='en';
 const threshold=o.minMerchandiseTwd?`${en?' · Minimum merchandise NT$':' · 商品低消 NT$'}${o.minMerchandiseTwd.toLocaleString()}`:'';
 if(['percent','product_percent'].includes(o.discountType||''))return (en?`${o.value}% off merchandise`:`商品 ${Number((100-(o.value||0))/10).toFixed(1).replace(/\.0$/,'')} 折`)+threshold;
 if(['fixed','product_fixed'].includes(o.discountType||''))return (en?`${o.currency||'TWD'} ${o.value} off merchandise`:`商品折抵 ${o.currency||'TWD'} ${o.value}`)+threshold;
 if(o.discountType==='shipping_free')return (en?'Free delivery':'免運費')+threshold;
 if(o.discountType==='shipping_percent')return (en?`${o.value}% off delivery`:`運費 ${Number((100-(o.value||0))/10).toFixed(1).replace(/\.0$/,'')} 折`)+threshold;
 if(o.discountType==='shipping_fixed')return (en?`${o.currency||'TWD'} ${o.value} off delivery`:`運費折抵 ${o.currency||'TWD'} ${o.value}`)+threshold;
 if(o.discountType==='order_percent')return (en?`${o.value}% off the order`:`整筆訂單 ${Number((100-(o.value||0))/10).toFixed(1).replace(/\.0$/,'')} 折`)+threshold;
 if(o.discountType==='order_fixed')return (en?`${o.currency||'TWD'} ${o.value} off the order`:`整筆訂單折抵 ${o.currency||'TWD'} ${o.value}`)+threshold;
 return (en?`Service fee ${o.rate}%`:`代購費 ${o.rate}%`)+threshold;
}
export function purchaseSchedule(productTimes:(string|undefined)[],globalTime?:string|null,productEnds:(string|undefined)[]=[],globalEnd?:string|null){
 const ranges=productTimes.map((start,i)=>{const from=start||globalTime;if(!from)return null;const to=start?(productEnds[i]||start):(globalEnd||from);const a=Date.parse(from),b=Date.parse(to!);if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)throw new Error('Invalid purchase schedule');return{a,b};}).filter((v):v is {a:number;b:number}=>v!==null);
 if(!ranges.length)return{purchaseAt:null,purchaseAtTo:null,cancelUntil:null};
 const earliest=Math.min(...ranges.map(v=>v.a)),latest=Math.max(...ranges.map(v=>v.b));
 return{purchaseAt:new Date(earliest).toISOString(),purchaseAtTo:new Date(latest).toISOString(),cancelUntil:new Date(earliest-86400000).toISOString()};
}
export function nextMembership(spend:number,items:number,tier:Tier){
 if(tier==='black'||tier==='diamond')return null;
 const target=tier==='standard'?'platinum':'black';
 const amount=target==='platinum'?150001:500001,quantity=target==='platinum'?5:12;
 return{tier:target as Tier,amount,quantity,remainingJpy:Math.max(0,amount-spend),remainingItems:Math.max(0,quantity-items),progress:Math.min(100,Math.floor(Math.min(spend/amount,items/quantity)*100))};
}
export function availableOrderStates(order:{status:string;paidAt:string|null;paymentMethod:string;purchasedAt:string|null}){
 if(terminalStates.includes(order.status)||order.status==='completed')return[];
 if(order.status==='refund_pending')return ['refunded'];
 if(order.status==='on_hold')return [order.paidAt?'paid':order.paymentMethod==='cod'?'awaiting_cod':'awaiting_payment'];
 const choices:string[]=[];
 if(!order.purchasedAt&&(order.paidAt||order.paymentMethod==='cod')){
  choices.push('purchased');
 }
 if(order.status==='purchased')choices.push('shipped_japan');
 if(order.status==='shipped_japan')choices.push('arrived_taiwan');
 if(order.status==='arrived_taiwan'&&order.paidAt)choices.push('completed');
 return choices;
}

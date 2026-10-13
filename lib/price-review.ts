import {validTaiwanReferenceUrl} from './market-price';
import {catalogDisplayPrice} from './catalog-display-price';
import {productFeeRate} from './product-pricing';
import {feeRates,type ShopProduct} from './commerce-types';

export type PriceEvidence={spec:string;taiwanSpec:string;taiwanPrice:number;taiwanSource:string;taiwanDate:string;classification:string;koreaCostKrw:number;koreaSource:string;koreaDate:string;deliveryConfirmed:boolean;deliveryKrw?:number;deliveryConditions?:string;exchangeRate:number;proposedTwd:number};
const normalized=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const dated=(s:string)=>Number.isFinite(Date.parse(s))&&Date.parse(s)<=Date.now()+86400000;
export function checkPrice(e:PriceEvidence){
 const missing:string[]=[];
 if(!e.spec.trim())missing.push('商品容量／重量、單位與包裝數');
 if(!e.taiwanSpec.trim())missing.push('台灣同品牌、同款、同規格與數量');
 if(!validTaiwanReferenceUrl(e.taiwanSource))missing.push('有效台灣來源（不得使用蝦皮）');
 if(!(e.taiwanPrice>0&&Number.isFinite(e.taiwanPrice)))missing.push('台灣價格');
 if(!dated(e.taiwanDate))missing.push('台灣來源查核日期');
 if(!['regular','public_promotion','preorder','ready_stock'].includes(e.classification))missing.push('可使用的台灣價格條件；會員限定價不適用');
 if(!/^https:\/\//.test(e.koreaSource))missing.push('韓國購買來源');
 if(!dated(e.koreaDate))missing.push('韓國來源查核日期');
 if(!(e.koreaCostKrw>1&&Number.isFinite(e.koreaCostKrw)))missing.push('韓國實際成本（不得使用 ₩1）');
 if(!e.deliveryConfirmed||!Number.isFinite(e.deliveryKrw)||e.deliveryKrw!<0||e.deliveryKrw!>e.koreaCostKrw)missing.push('已計入必要韓國運費的確認');
 if(!String(e.deliveryConditions||'').trim())missing.push('韓國運費與折扣適用條件');
 if(!(e.exchangeRate>0&&Number.isFinite(e.exchangeRate)))missing.push('有效匯率');
 if(!(e.proposedTwd>0&&Number.isFinite(e.proposedTwd)))missing.push('預計售價');
 const ceiling=e.taiwanPrice>0?Math.floor(e.taiwanPrice*95/100):null;
 const differencePercent=e.taiwanPrice>0?(e.taiwanPrice-e.proposedTwd)/e.taiwanPrice*100:null;
 const costTwd=e.exchangeRate>0?Math.ceil(e.koreaCostKrw*e.exchangeRate):null;
 const excessTwd=ceiling===null?null:Math.max(0,e.proposedTwd-ceiling);
 const higherTwd=e.taiwanPrice>0?Math.max(0,e.proposedTwd-e.taiwanPrice):null;
 let status:'valid'|'insufficient_discount'|'same_or_higher'|'missing'|'spec_mismatch'|'cost_above_limit';
 if(missing.length)status='missing';
 else if(normalized(e.spec)!==normalized(e.taiwanSpec))status='spec_mismatch';
 else if(e.proposedTwd>=e.taiwanPrice)status='same_or_higher';
 else if(e.proposedTwd>ceiling!)status='insufficient_discount';
 else if(costTwd!>e.proposedTwd)status='cost_above_limit';
 else status='valid';
 return {status,ok:status==='valid'||status==='cost_above_limit',missing,ceiling,differencePercent,costTwd,excessTwd,higherTwd,costGapTwd:ceiling===null||costTwd===null?null:Math.max(0,costTwd-ceiling),evidence:e};
}
export function productPriceReview(p:ShopProduct,rate:number,variantId?:string,standardRate=feeRates.standard.catalog){
 const v=p.variants.find(v=>v.id===variantId),r=v||p;
 const pack=v?.acquisitionPack;
 const validPack=!!pack&&Number.isInteger(pack.units)&&pack.units>0&&pack.goodsKrw>0&&pack.deliveryKrw>=0&&pack.totalKrw===pack.goodsKrw+pack.deliveryKrw&&(v?.priceJpy??p.priceJpy)===Math.ceil(pack.totalKrw/pack.units);
 const cost=v?.priceJpy??p.priceJpy,goods=Math.ceil(cost*rate),fee=productFeeRate(p,standardRate,goods,standardRate);
 // Review the same calculated price used by catalog and checkout. If blocked,
 // disclose the proposed number and actual cost instead of fabricating a price.
 const planned=(v?.salePriceTwd??p.salePriceTwd)||goods+Math.ceil(goods*fee/100)+Math.ceil(p.sizeFeeTwd);
 const actual=catalogDisplayPrice({...p,status:'active'},{variantId,exchangeRate:rate,fees:{...feeRates,standard:{...feeRates.standard,catalog:standardRate}}});
 const proposed=actual.amount??planned;
 return checkPrice({spec:v?.labelZh||p.spec||'',taiwanSpec:r.taiwanRetailSpec||'',taiwanPrice:r.taiwanRetailTwd||0,taiwanSource:r.taiwanRetailSource||'',taiwanDate:r.taiwanRetailCheckedAt||'',classification:r.taiwanRetailClassification||'',koreaCostKrw:cost,koreaSource:v?.purchaseUrl||p.purchaseUrl,koreaDate:v?.sourceCheckedAt||(validPack?pack!.checkedAt:'')||p.sourceCheckedAt||'',deliveryConfirmed:r.sourceDeliveryConfirmed===true||validPack,deliveryKrw:validPack?Math.ceil(pack!.deliveryKrw/pack!.units):r.sourceDeliveryKrw,deliveryConditions:validPack?'整箱採買並按盒數分攤運費':r.sourceDeliveryConditions,exchangeRate:rate,proposedTwd:proposed});
}
export function priceReviewMessage(review:ReturnType<typeof checkPrice>){
 if(review.status==='missing')return '缺少：'+review.missing.join('、');
 if(review.status==='spec_mismatch')return '商品與台灣來源規格不一致，不能作為已符合的比較。';
 if(review.status==='same_or_higher')return '售價等於或高於台灣；高出 NT$'+review.higherTwd+'，超出售價上限 NT$'+review.excessTwd+'。';
 if(review.status==='insufficient_discount')return '價差不足 5%；超出售價上限 NT$'+review.excessTwd+'。';
 if(review.status==='cost_above_limit')return '已套用低於台灣至少 5% 的售價；店家吸收採買成本差額 NT$'+Math.max(0,(review.costTwd||0)-review.evidence.proposedTwd)+'。真實採買成本保留。';
 return '低於台灣至少 5%，符合規則。';
}

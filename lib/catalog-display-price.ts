import {productFeeRate,catalogPriceParts,loyaltyFactor,taxExclusiveGoods} from './product-pricing';
import {offerMatches,type FeeTable} from './commerce-policy';
import {feeRates,type ShopProduct,type Offer,type Tier} from './commerce-types';
type PriceOptions={variantId?:string;exchangeRate?:number;tier?:Tier;fees?:FeeTable;offers?:Offer[];now?:number;paidOrders?:number};
// Shared item breakdown used by product cards, support facts and the admin.
export function catalogDisplayParts(product:ShopProduct,options:PriceOptions={}){
 const variant=product.variants.find(v=>v.id===options.variantId),rate=options.exchangeRate;
 if(!rate||rate<=0||(product.variants.length&&!variant))return null;
 const sourceAmount=variant?.priceJpy??product.priceJpy;if(sourceAmount<=1)return null;
 const tier=options.tier||'standard',fees=options.fees||feeRates,gross=Math.ceil(sourceAmount*rate),quoted=taxExclusiveGoods({...product,priceJpy:sourceAmount,sourceDeliveryKrw:variant?.sourceDeliveryKrw??product.sourceDeliveryKrw},gross,1,rate),now=options.now??Date.now();
 let fee=productFeeRate(product,fees[tier].catalog,gross,fees.standard.catalog,options.paidOrders);
 for(const offer of options.offers||[])if(!offer.code&&offer.active&&offer.tiers.includes(tier)&&Date.parse(offer.startsAt)<=now&&(offer.permanent||Date.parse(offer.endsAt)>now)&&(!offer.discountType||offer.discountType==='fee_rate')&&offerMatches(offer,product)&&quoted>=(offer.minMerchandiseTwd||0))fee=Math.min(fee,offer.rate);
 const factor=product.pricingTaxExclusive?1:(fees.standard.catalog>0?fees[tier].catalog/fees.standard.catalog:0)*loyaltyFactor(options.paidOrders);
 return catalogPriceParts(product,gross,Math.ceil(quoted*fee/100),Math.ceil(product.sizeFeeTwd),1,options.variantId,factor,{goodsTwd:quoted,feeRate:fee});
}
export function catalogDisplayPrice(product:ShopProduct,options:PriceOptions={}){return price(product,options,false);}
export function catalogListedPrice(product:ShopProduct,options:PriceOptions={}){const eligible=price(product,options,false);return eligible.amount!==null?eligible:price(product,options,true);}
function price(product:ShopProduct,options:PriceOptions,listed:boolean):{amount:number|null;currency:'KRW'|'TWD';from:boolean}{
 const variant=product.variants.find(v=>v.id===options.variantId);
 if(product.variants.length&&!variant){const lowest=product.variants.filter(v=>listed||v.stock!==0).map(v=>price(product,{...options,variantId:v.id},listed)).filter(p=>p.amount!==null).sort((a,b)=>a.amount!-b.amount!)[0];return {...(lowest||{amount:null,currency:'KRW' as const}),from:true};}
 const sourceAmount=variant?.priceJpy??product.priceJpy,from=!!product.variants.length&&!variant;
 if(product.status!=='active'||sourceAmount<=1)return {amount:null,currency:'KRW',from};
 if(!options.exchangeRate||options.exchangeRate<=0)return {amount:listed?sourceAmount:null,currency:listed?'KRW':'TWD',from};
 const parts=catalogDisplayParts(product,options);
 if(!parts?.ok){const gross=Math.ceil(sourceAmount*options.exchangeRate),quoted=taxExclusiveGoods({...product,priceJpy:sourceAmount},gross,1,options.exchangeRate),fees=options.fees||feeRates,fee=productFeeRate(product,fees[options.tier||'standard'].catalog,gross,fees.standard.catalog,options.paidOrders);return {amount:listed?quoted+Math.ceil(quoted*fee/100)+Math.ceil(product.sizeFeeTwd):null,currency:'TWD',from};}
 return {amount:parts.goodsTwd+parts.feeTwd+parts.sizeFeeTwd,currency:'TWD',from};
}

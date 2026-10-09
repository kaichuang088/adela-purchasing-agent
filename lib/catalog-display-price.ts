import {productFeeRate,catalogPriceParts,loyaltyFactor} from './product-pricing';
import {offerMatches,type FeeTable} from './commerce-policy';
import {feeRates,type ShopProduct,type Offer,type Tier} from './commerce-types';

// A single-item estimate, before basket coupons, shipping and wallet credit.
type PriceOptions={variantId?:string;exchangeRate?:number;tier?:Tier;fees?:FeeTable;offers?:Offer[];now?:number;paidOrders?:number};
export function catalogDisplayPrice(product:ShopProduct,options:PriceOptions={}){return price(product,options,false);}
// Display known-cost prices independently of checkout eligibility. Never invent a
// Taiwan reference or reduce recorded cost to make a blocked price look approved.
export function catalogListedPrice(product:ShopProduct,options:PriceOptions={}){
 const eligible=price(product,options,false);
 return eligible.amount!==null?eligible:price(product,options,true);
}
function price(product:ShopProduct, options:PriceOptions,listed:boolean):{amount:number|null;currency:'KRW'|'TWD';from:boolean} {
 const tier=options.tier||'standard',variant=product.variants.find(v=>v.id===options.variantId);
 if(product.variants.length&&!variant){
  const prices=product.variants.filter(v=>listed||v.stock!==0).map(v=>price(product,{...options,variantId:v.id},listed));
  const lowest=prices.filter(p=>p.amount!==null).sort((a,b)=>a.amount!-b.amount!)[0];
  return {...(lowest||{amount:null,currency:'KRW' as const}),from:true};
 }
 const sourceAmount=variant?.priceJpy??product.priceJpy;
 const from=!!product.variants.length&&!variant;
 if(product.status!=='active'||sourceAmount<=1)return {amount:null,currency:'KRW' as const,from};
 if(!options.exchangeRate||options.exchangeRate<=0)return {amount:listed?sourceAmount:null,currency:listed?'KRW':'TWD',from};
 const goods=Math.ceil(sourceAmount*options.exchangeRate),now=options.now??Date.now();
 const fees=options.fees||feeRates;
 let fee=productFeeRate(product,fees[tier].catalog,goods,fees.standard.catalog,options.paidOrders);
 for(const offer of options.offers||[]) {
  if(!offer.code&&offer.active&&offer.tiers.includes(tier)&&Date.parse(offer.startsAt)<=now&&(offer.permanent||Date.parse(offer.endsAt)>now)&&(!offer.discountType||offer.discountType==='fee_rate')&&offerMatches(offer,product)&&goods>=(offer.minMerchandiseTwd||0))fee=Math.min(fee,offer.rate);
 }
 const factor=(fees.standard.catalog>0?fees[tier].catalog/fees.standard.catalog:0)*loyaltyFactor(options.paidOrders);
 const parts=catalogPriceParts(product,goods,Math.ceil(goods*fee/100),Math.ceil(product.sizeFeeTwd),1,options.variantId,factor);
 if(!parts.ok)return {amount:listed?goods+Math.ceil(goods*fee/100)+Math.ceil(product.sizeFeeTwd):null,currency:'TWD',from};
 return {amount:parts.goodsTwd+parts.feeTwd+parts.sizeFeeTwd,currency:'TWD' as const,from};
}

import type {ShopProduct} from './commerce-types';
import {marketPriceCeiling} from './market-price';
// Per-product flexibility is a ceiling on service fees, never an added surcharge.
export function loyaltyFactor(paidOrders=0){return 1/(1+0.03*Math.min(50,Math.max(0,paidOrders)));}
export function isPerfume(product:Pick<ShopProduct,'nameZh'|'nameEn'|'categoryZh'|'categoryEn'>){const name=product.nameZh+' '+product.nameEn;if(/護手|沐浴|洗髮|乳液|身體乳|擴香|蠟燭|hand[ -](?:wash|balm|cream)|body[ -](?:wash|lotion|oil|cream)|shower|candles?|diffuser/i.test(name))return false;return /香水|淡香精|淡香水|perfume|eau de parfum|eau de toilette/i.test(name+' '+product.categoryZh+' '+product.categoryEn);}
// Owner-authorized pricing discount. Supplier amounts remain gross; this does
// not assert eligibility for a commercial tax refund or change historic orders.
export function taxExclusiveGoods(product:ShopProduct,grossGoods:number,quantity=1,rate?:number){
 if(!product.pricingTaxExclusive)return grossGoods;
 const tax=product.pricingTaxRatePercent??10;
 if(!(tax>0&&tax<=30))return grossGoods;
 const variant=product.variants.find(v=>v.id===(product as any).selectedVariantId),source=variant?.priceJpy??product.priceJpy;
 const delivery=Math.min(source,Math.max(0,variant?.sourceDeliveryKrw??product.sourceDeliveryKrw??(variant?.acquisitionPack?Math.ceil(variant.acquisitionPack.deliveryKrw/variant.acquisitionPack.units):0)));
 const netUnit=rate?((source-delivery)/(1+tax/100)+delivery)*rate:grossGoods/quantity/(1+tax/100);
 return Math.min(grossGoods,Math.ceil(netUnit)*quantity);
}
export function productFeeRate(product:ShopProduct,memberRate:number,unitCostTwd=0,standardRate=8,paidOrders=0){
 if(product.pricingTaxExclusive&&isPerfume(product))return memberRate<=0?0:Math.min(3,Math.max(2,product.serviceFeePercent??2));
 const perfumeCeiling=isPerfume(product)?1/(1+Math.max(0,unitCostTwd)/2000):standardRate;
 const ceiling=Math.min(product.serviceFeePercent??standardRate,perfumeCeiling,standardRate/(1+Math.max(0,unitCostTwd)/4000));
 return standardRate<=0?0:Number((Math.min(memberRate,ceiling*Math.min(1,memberRate/standardRate))*loyaltyFactor(paidOrders)).toFixed(4));
}
export function catalogPriceParts(product:ShopProduct,goods:number,fee:number,size:number,quantity=1,variantId?:string,memberFactor=1,pricing?:{goodsTwd:number;feeRate:number}){
 const ceiling=marketPriceCeiling(product,variantId);
 if(ceiling===null)return {ok:false as const,reason:'reference_missing' as const};
 const limit=ceiling===Number.MAX_SAFE_INTEGER?Infinity:ceiling*quantity;
 const target=productPriceTarget(product,variantId);
 const bound=Math.min(limit,target===null?Infinity:target*quantity);
 const originalCostTwd=goods+size;
 // The owner requires a hard customer-price cap. Keep real cost separately;
 // any shortfall is a store-funded discount, never a fictitious supplier price.
 const quotedGoods=pricing?.goodsTwd??taxExclusiveGoods(product,goods,quantity);
 const capDiscount=Math.max(0,quotedGoods+size-bound);
 if(capDiscount>0&&product.allowStoreFundedDiscount===false)return{ok:false as const,reason:'cost_above_limit' as const};
 const goodsTwd=Math.max(0,quotedGoods-Math.max(0,capDiscount-size));
 const sizeFeeTwd=Math.max(0,size-capDiscount);
 const storeDiscountTwd=originalCostTwd-goodsTwd-sizeFeeTwd;
 const feeRoom=Math.max(0,bound-goodsTwd-sizeFeeTwd);
 if(pricing)fee=Math.ceil(quotedGoods*pricing.feeRate/100);
 const feeTwd=Math.min(fee,Number.isFinite(feeRoom)?Math.floor(feeRoom*Math.min(1,Math.max(0,memberFactor))):fee);
 return {ok:true as const,goodsTwd,feeTwd,sizeFeeTwd,originalCostTwd,storeDiscountTwd};
}
export function productPriceTarget(product:ShopProduct,variantId?:string):number|null{
 const id=variantId||(product as ShopProduct&{selectedVariantId?:string}).selectedVariantId;
 const variant=product.variants.find(v=>v.id===id);
 const value=variant?.salePriceTwd??product.salePriceTwd;
 return value&&value>0?value:null;
}
// Custom quotes use their approved cost-plus target; catalog orders use catalogPriceParts above.
// A target can reduce the service fee, never the actual goods or handling cost.
export function costPlusPriceParts(product:ShopProduct,goods:number,fee:number,size:number,quantity=1,variantId?:string,tier:'standard'|'platinum'|'black'|'diamond'='standard',pricing?:{goodsTwd:number;feeRate:number}){
 const target=productPriceTarget(product,variantId);
 const tierTarget=target===null?null:Math.floor(target*({standard:1,platinum:0.995,black:0.99,diamond:0.985}[tier]));
 const goodsTwd=pricing?.goodsTwd??taxExclusiveGoods(product,goods,quantity);
 if(pricing)fee=Math.ceil(goodsTwd*pricing.feeRate/100);
 const feeTwd=tierTarget===null||tierTarget*quantity<goodsTwd+size?fee:Math.min(fee,Math.max(0,tierTarget*quantity-goodsTwd-size));
 return {goodsTwd,feeTwd,sizeFeeTwd:size,originalCostTwd:goods+size,storeDiscountTwd:goods-goodsTwd};
}

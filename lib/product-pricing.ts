import type {ShopProduct} from './commerce-types';
import {marketPriceCeiling} from './market-price';
// Per-product flexibility is a ceiling on service fees, never an added surcharge.
export function loyaltyFactor(paidOrders=0){return 1/(1+0.03*Math.min(50,Math.max(0,paidOrders)));}
export function isPerfume(product:Pick<ShopProduct,'nameZh'|'nameEn'|'categoryZh'|'categoryEn'>){return /香水|淡香精|淡香水|perfume|eau de parfum|eau de toilette/i.test(product.nameZh+' '+product.nameEn);}
export function productFeeRate(product:ShopProduct,memberRate:number,unitCostTwd=0,standardRate=8,paidOrders=0){
 const perfumeCeiling=isPerfume(product)?1/(1+Math.max(0,unitCostTwd)/2000):standardRate;
 const ceiling=Math.min(product.serviceFeePercent??standardRate,perfumeCeiling,standardRate/(1+Math.max(0,unitCostTwd)/4000));
 return standardRate<=0?0:Number((Math.min(memberRate,ceiling*Math.min(1,memberRate/standardRate))*loyaltyFactor(paidOrders)).toFixed(4));
}
export function catalogPriceParts(product:ShopProduct,goods:number,fee:number,size:number,quantity=1,variantId?:string,memberFactor=1){
 const ceiling=marketPriceCeiling(product,variantId);
 if(ceiling===null)return {ok:false as const,reason:'reference_missing' as const};
 const limit=ceiling===Number.MAX_SAFE_INTEGER?Infinity:ceiling*quantity;
 const target=productPriceTarget(product,variantId);
 const bound=Math.min(limit,target===null?Infinity:target*quantity);
 const originalCostTwd=goods+size;
 // The owner requires a hard customer-price cap. Keep real cost separately;
 // any shortfall is a store-funded discount, never a fictitious supplier price.
 const storeDiscountTwd=Math.max(0,originalCostTwd-bound);
 const goodsTwd=Math.max(0,goods-Math.max(0,storeDiscountTwd-size));
 const sizeFeeTwd=Math.max(0,size-storeDiscountTwd);
 const feeRoom=Math.max(0,bound-originalCostTwd);
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
export function costPlusPriceParts(product:ShopProduct,goods:number,fee:number,size:number,quantity=1,variantId?:string,tier:'standard'|'platinum'|'black'|'diamond'='standard'){
 const target=productPriceTarget(product,variantId);
 const tierTarget=target===null?null:Math.floor(target*({standard:1,platinum:0.995,black:0.99,diamond:0.985}[tier]));
 const feeTwd=tierTarget===null||tierTarget*quantity<goods+size?fee:Math.min(fee,Math.max(0,tierTarget*quantity-goods-size));
 return {goodsTwd:goods,feeTwd,sizeFeeTwd:size};
}

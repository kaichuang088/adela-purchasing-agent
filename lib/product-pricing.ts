import type {ShopProduct} from './commerce-types';
import {marketPriceCeiling} from './market-price';
// Per-product flexibility is a ceiling on service fees, never an added surcharge.
export function loyaltyFactor(paidOrders=0){return 1/(1+0.03*Math.min(50,Math.max(0,paidOrders)));}
export function productFeeRate(product:ShopProduct,memberRate:number,unitCostTwd=0,standardRate=8,paidOrders=0){
 const ceiling=Math.min(product.serviceFeePercent??standardRate,standardRate/(1+Math.max(0,unitCostTwd)/4000));
 return standardRate<=0?0:Number((Math.min(memberRate,ceiling*Math.min(1,memberRate/standardRate))*loyaltyFactor(paidOrders)).toFixed(4));
}
export function catalogPriceParts(product:ShopProduct,goods:number,fee:number,size:number,quantity=1,variantId?:string,memberFactor=1){
 const ceiling=marketPriceCeiling(product,variantId);
 if(ceiling===null)return {ok:false as const,reason:'reference_missing' as const};
 const limit=ceiling===Number.MAX_SAFE_INTEGER?Infinity:ceiling*quantity;
 if(goods+size>limit)return {ok:false as const,reason:'cost_above_limit' as const};
 const target=productPriceTarget(product,variantId);
 if(target!==null&&target*quantity<goods+size)return {ok:false as const,reason:'target_below_cost' as const};
 const feeRoom=Math.min(limit,target===null?Infinity:target*quantity)-goods-size;
 // A lower member fee remains meaningful even when the market ceiling binds.
 const feeTwd=Math.min(fee,Number.isFinite(feeRoom)?Math.floor(feeRoom*Math.min(1,Math.max(0,memberFactor))):fee);
 return {ok:true as const,goodsTwd:goods,feeTwd,sizeFeeTwd:size};
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

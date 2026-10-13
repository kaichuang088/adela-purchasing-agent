'use client';
import type {ShopProduct} from '@/lib/commerce-types';
import {productPriceReview,priceReviewMessage} from '@/lib/price-review';
import {marketPriceCeiling} from '@/lib/market-price';
import {catalogPriceParts} from '@/lib/product-pricing';

type Issue={product:ShopProduct;option:string;reason:string;cost?:number|null;ceiling?:number|null};
export function catalogIssues(products:ShopProduct[],rate?:number):Issue[]{
 return products.filter(p=>!['discontinued','paused'].includes(p.status)).flatMap(p=>{
  if(p.status!=='active')return [{product:p,option:'',reason:p.catalogReviewReason||'韓國來源、規格或成本尚待核實'}];
  return (p.variants.length?p.variants:[undefined]).flatMap(v=>{
   const source=v||p,ceiling=marketPriceCeiling(p,v?.id),cost=rate?Math.ceil((v?.priceJpy??p.priceJpy)*rate):null;
   let reason=ceiling===null?'缺少同規格台灣價格、來源或查核日期':!rate?'匯率尚未取得':cost===null?'成本尚待核對':'';
   if(!reason&&cost!==null){const r=catalogPriceParts(p,cost,0,Math.ceil(p.sizeFeeTwd),1,v?.id);if(!r.ok)reason=r.reason==='cost_above_limit'?'真實含運成本高於95%售價上限；未默認虧損販售':'缺少同規格比較資料';else if(r.storeDiscountTwd>0&&!p.pricingTaxExclusive)reason='售價已符合 5% 規則；店家吸收 NT$'+r.storeDiscountTwd+'，代購費為 0 元';}
   if(!reason){const review=productPriceReview(p,rate||0,v?.id);if(!review.ok)reason=priceReviewMessage(review);}
   if(!reason&&source.stock===0)reason='來源缺貨，尚未恢復供貨';
   return reason?[{product:p,option:v?.labelZh||'',reason,cost,ceiling:ceiling===Number.MAX_SAFE_INTEGER?null:ceiling}]:[];
  });
 });
}
export function CatalogReview({products,rate,onEdit}:{products:ShopProduct[];rate?:number;onEdit:(p:ShopProduct)=>void}){
 const issues=catalogIssues(products,rate);
 if(!issues.length)return null;
 return <section className="op-catalog-review"><h3>商品核對清單 <span>{issues.length}</span></h3><p>以下項目尚未完成。原商品與訂單資料均保留；缺貨、價格衝突與未核實規格分別列出。</p><details><summary>查看待處理規格</summary><div className="op-review-list">{issues.map((x,i)=><button type="button" key={x.product.id+':'+i} onClick={()=>onEdit(x.product)}><b>{x.product.nameZh}{x.option?' · '+x.option:''}</b><span>{x.reason}</span>{x.cost!=null&&<small>換算成本 NT${x.cost}{x.ceiling!=null?'／售價上限 NT$'+x.ceiling:''}</small>}</button>)}</div></details></section>;
}

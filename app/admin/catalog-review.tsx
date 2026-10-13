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
   const ceiling=marketPriceCeiling(p,v?.id),cost=rate?Math.ceil((v?.priceJpy??p.priceJpy)*rate):null;
   let reason=ceiling===null?'缺少同規格台灣價格、來源或查核日期':!rate?'匯率尚未取得':cost===null?'成本尚待核對':'';
   if(!reason&&cost!==null){const r=catalogPriceParts(p,cost,0,Math.ceil(p.sizeFeeTwd),1,v?.id);if(!r.ok)reason=r.reason==='cost_above_limit'?'真實含運成本高於95%售價上限；未默認虧損販售':'缺少同規格比較資料';}
   if(!reason){const review=productPriceReview(p,rate||0,v?.id);if(!review.ok)reason=priceReviewMessage(review);}
   return reason?[{product:p,option:v?.labelZh||'',reason,cost,ceiling:ceiling===Number.MAX_SAFE_INTEGER?null:ceiling}]:[];
  });
 });
}
/** A verified sold-out SKU or a policy-approved subsidy is a resolved fact,
 * shown separately, never used to disguise missing source evidence. */
export function catalogReviewedOutcomes(products:ShopProduct[],rate?:number):Issue[]{
 if(!rate)return [];
 return products.filter(p=>p.status==='active').flatMap(p=>(p.variants.length?p.variants:[undefined]).flatMap(v=>{
  if(marketPriceCeiling(p,v?.id)===null||!productPriceReview(p,rate,v?.id).ok)return [];
  const cost=Math.ceil((v?.priceJpy??p.priceJpy)*rate),parts=catalogPriceParts(p,cost,0,Math.ceil(p.sizeFeeTwd),1,v?.id);
  if(!parts.ok)return [];
  const source=v||p,notes=[];
  if(source.stock===0)notes.push('已核對來源：目前缺貨，不能下單');
  if(parts.storeDiscountTwd>0&&!p.pricingTaxExclusive)notes.push('價格來源已核對；依現行定價政策店家吸收 NT$'+parts.storeDiscountTwd+'，代購費 0 元');
  return notes.length?[{product:p,option:v?.labelZh||'',reason:notes.join('；'),cost,ceiling:marketPriceCeiling(p,v?.id)}]:[];
 }));
}
export function CatalogReview({products,rate,onEdit}:{products:ShopProduct[];rate?:number;onEdit:(p:ShopProduct)=>void}){
 const issues=catalogIssues(products,rate),outcomes=catalogReviewedOutcomes(products,rate);
 const rows=(items:Issue[])=>items.map((x,i)=><button type="button" key={x.product.id+':'+i} onClick={()=>onEdit(x.product)}><b>{x.product.nameZh}{x.option?' · '+x.option:''}</b><span>{x.reason}</span>{x.cost!=null&&<small>換算成本 NT${x.cost}{x.ceiling!=null&&x.ceiling!==Number.MAX_SAFE_INTEGER?'／售價上限 NT$'+x.ceiling:''}</small>}</button>);
 return <section className="op-catalog-review"><h3>商品核對清單 <span>{issues.length}</span></h3><p>{issues.length?'仍缺來源、規格或需要處理的成本問題如下；原商品及訂單資料保留。':'現有商品來源與規格已完成核對。'}</p>{issues.length>0&&<details><summary>查看待處理規格</summary><div className="op-review-list">{rows(issues)}</div></details>}{outcomes.length>0&&<details className="op-reviewed-outcomes"><summary>已核對的缺貨／店家補貼（{outcomes.length}）</summary><p>這些已有完整來源證據；缺貨仍禁止下單，補貼仍顯示真實成本。</p><div className="op-review-list">{rows(outcomes)}</div></details>}</section>;
}

import {exchange,settings,ShopError} from './commerce';
import {productPriceReview,priceReviewMessage} from './price-review';
import type {ShopProduct} from './commerce-types';
export async function publicationReviews(p:ShopProduct){
 const [config,rate]=await Promise.all([settings(),exchange({preferCached:true}).catch(()=>null)]);
 return (p.variants.length?p.variants:[undefined]).map(v=>({variant:v?.labelZh||p.spec||p.nameZh,...productPriceReview(p,rate?.rate||0,v?.id,config.fees.standard.catalog)}));
}
export async function assertPublishablePrice(p:ShopProduct){
 const reviews=await publicationReviews(p);
 if(p.status==='active'){
  const failures=reviews.filter((r,i)=>(p.variants[i]?.stock??p.stock)!==0&&!r.ok);
  if(failures.length)throw new ShopError('上架價格檢查未通過：'+failures.map(r=>r.variant+'：'+priceReviewMessage(r)).join('；')+' 可先儲存草稿，完成依據後再上架。',409);
 }
 return reviews;
}

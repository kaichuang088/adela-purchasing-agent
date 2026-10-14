import {exchange,settings} from './commerce';
import {productPriceReview} from './price-review';
import type {ShopProduct} from './commerce-types';
export async function publicationReviews(p:ShopProduct){const [config,rate]=await Promise.all([settings(),exchange({preferCached:true}).catch(()=>null)]);return (p.variants.length?p.variants:[undefined]).map(v=>{const review=productPriceReview(p,rate?.rate||0,v?.id,config.fees.standard.catalog),base=v?.salePriceTwd??p.salePriceTwd,cost=(v?.priceJpy??p.priceJpy)>1&&rate?Math.ceil((v?.priceJpy??p.priceJpy)*rate.rate)+Math.ceil(p.sizeFeeTwd):0;return {variant:v?.labelZh||p.spec||p.nameZh,...review,warnings:[...(base&&cost&&base<cost?['售價低於實際成本；管理員確認後仍可儲存。']:[]),...(base&&cost&&base>=cost&&base<cost*1.03?['售價低於金鑽成本＋3%，會員優惠價會以最低階售價為上限。']:[])]};});}
/** Price/source checks are advisory after the owner's R25 policy change. */
export async function assertPublishablePrice(p:ShopProduct){return publicationReviews(p);}

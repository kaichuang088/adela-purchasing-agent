import type {ShopProduct,TaiwanAvailability} from './commerce-types';
// Reject Shopee, its country domains and short links on both read and write paths.
export function validTaiwanReferenceUrl(value:unknown):boolean{
 try{const u=new URL(String(value||''));const h=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!/(^|\.)(shopee\.[a-z.]+|shopeemobile\.com|shp\.ee|shopee\.link)$/.test(h);}catch{return false;}
}
export function verifiedNoTaiwanSale(reference?:TaiwanAvailability){return reference?.taiwanAvailability==='not_sold'&&String(reference.taiwanAbsenceEvidence||'').trim().length>=20&&Number.isFinite(Date.parse(reference.taiwanAvailabilityCheckedAt||''));}
export function marketPriceCeiling(product:ShopProduct,variantId?:string):number|null {
 const id=variantId||(product as ShopProduct & {selectedVariantId?:string}).selectedVariantId;
 const reference=product.variants.length?product.variants.find(v=>v.id===id):product;
 // Explicit reviewed absence has no Taiwan price ceiling; null still means unverified.
 if(verifiedNoTaiwanSale(reference))return Number.MAX_SAFE_INTEGER;
 const expected=product.variants.length?product.variants.find(v=>v.id===id)?.labelZh:product.spec;
 const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
 if(reference?.taiwanRetailSpec&&(!expected||normalize(reference.taiwanRetailSpec)!==normalize(expected)))return null;
 if(reference?.taiwanRetailClassification==='member_only')return null;
 if(!validTaiwanReferenceUrl(reference?.taiwanRetailSource)||!reference?.taiwanRetailTwd||!Number.isFinite(Date.parse(reference.taiwanRetailCheckedAt||'')))return null;
 const price=reference.taiwanPromotionTwd&&reference.taiwanPromotionTwd>0?Math.min(reference.taiwanRetailTwd,reference.taiwanPromotionTwd):reference.taiwanRetailTwd;
 return Math.floor(price*0.95);
}
export function cappedPriceParts(goods:number,fee:number,size:number,ceiling:number|null,quantity=1){
 if(ceiling!==null&&goods+size>ceiling*quantity)throw new Error('Price ceiling is below actual cost');
 const total=ceiling===null?goods+fee+size:Math.min(goods+fee+size,ceiling*quantity);
 const goodsTwd=Math.min(goods,total),feeTwd=Math.min(fee,Math.max(0,total-goodsTwd));
 return {goodsTwd,feeTwd,sizeFeeTwd:Math.max(0,total-goodsTwd-feeTwd)};
}

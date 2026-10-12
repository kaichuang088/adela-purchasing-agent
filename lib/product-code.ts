import type {ShopProduct} from './commerce-types';
export function productCode(p:ShopProduct,variantId?:string){const v=p.variants.find(v=>v.id===variantId);return String(p.id)+(v?'-'+(v.publicIndex||p.variants.indexOf(v)+1):'');}
export function productByCode(products:ShopProduct[],code:string){const normalized=code.trim().replace(/^#/,'');for(const p of products){if(String(p.id)===normalized)return{productId:p.id,variantId:''};for(const v of p.variants)if(productCode(p,v.id)===normalized)return{productId:p.id,variantId:v.id};}return null;}

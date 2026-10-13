import previousRepairs from './product-image-repairs-r23.json';
import newRepairs from './product-image-repairs-r24.json';
const repairs={...previousRepairs,...newRepairs};
import type {ShopProduct} from './commerce-types';
export function resolveProductPhoto(url?:string|null){return url?((repairs as Record<string,string>)[url]||url):undefined;}
// Every product surface resolves the selected option before the parent photo.
export function productPhoto(product:ShopProduct,variantId?:string){
 const variant=product.variants.find(v=>v.id===variantId);
 const repaired=(url:string)=>resolveProductPhoto(url)!;
 if(variant?.imageUrl)return repaired(variant.imageUrl);
 return product.imageKey?(product.imageKey.startsWith('static/')?'/'+product.imageKey.slice(7):'/api/media/'+product.imageKey):repaired(product.imageUrl||'/product-photo-pending.svg');
}

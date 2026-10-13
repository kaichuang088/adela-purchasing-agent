import repairs from './product-image-repairs-r23.json';
import type {ShopProduct} from './commerce-types';
// Every product surface resolves the selected option before the parent photo.
export function productPhoto(product:ShopProduct,variantId?:string){
 const variant=product.variants.find(v=>v.id===variantId);
 const repaired=(url:string)=>(repairs as Record<string,string>)[url]||url;
 if(variant?.imageUrl)return repaired(variant.imageUrl);
 return product.imageKey?(product.imageKey.startsWith('static/')?'/'+product.imageKey.slice(7):'/api/media/'+product.imageKey):repaired(product.imageUrl||'/product-photo-pending.svg');
}

import type {ShopProduct} from './commerce-types';
// Every product surface resolves the selected option before the parent photo.
export function productPhoto(product:ShopProduct,variantId?:string){
 const variant=product.variants.find(v=>v.id===variantId);
 if(variant?.imageUrl)return variant.imageUrl;
 return product.imageKey?(product.imageKey.startsWith('static/')?'/'+product.imageKey.slice(7):'/api/media/'+product.imageKey):product.imageUrl||'/kk-hero.png';
}

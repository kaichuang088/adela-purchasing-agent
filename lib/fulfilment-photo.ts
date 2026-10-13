import type {PriceLine,ShopProduct} from './commerce-types';
import curated from './curated-catalog.json';
import expanded from './expanded-catalog-20260930.json';
import {productPhoto,resolveProductPhoto} from './product-photo';

const historicalPhotos=new Map([
 ...curated.map(p=>[p.nameZh,p.image] as const),
 ...expanded.map(p=>[p.nameZh,p.imageUrl] as const),
]);
const localPhotos:Record<string,string>={
 "I'MINT 三口味咖啡糖組｜濃縮・美式・抹茶拿鐵（32g × 3）":'/procurement-photos/imint-three-flavors.jpg',
 'Orion 剝皮果實軟糖 葡萄 67g':'/procurement-photos/orion-grape-67g.jpg',
 'Le Labo 檜木護手霜 55ml':'/procurement-photos/lelabo-hinoki-55ml.jpg',
};
// Enrich the read response only. Historical bundles must not inherit the photo
// of a single-unit replacement that happens to reuse their product ID.
export function fulfilmentPhoto(line:PriceLine,products:ShopProduct[]){
 if(line.imageUrl)return resolveProductPhoto(line.imageUrl)!;
 const historical=localPhotos[line.nameZh]||historicalPhotos.get(line.nameZh);
 if(historical&&!line.variantId)return resolveProductPhoto(historical)!;
 const product=products.find(p=>p.id===line.productId);
 if(product&&(!line.variantId||product.variants.some(v=>v.id===line.variantId)))return productPhoto(product,line.variantId);
 return resolveProductPhoto(historical)||'';
}

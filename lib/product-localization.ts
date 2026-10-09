import type {ShopProduct} from './commerce-types';
export function productDescription(product:Pick<ShopProduct,'descriptionZh'|'descriptionEn'|'descriptionKo'>,language:'zh'|'en'|'ko'){
 if(language==='ko')return product.descriptionKo||product.descriptionEn||product.descriptionZh;
 return language==='en'?product.descriptionEn||product.descriptionZh:product.descriptionZh;
}

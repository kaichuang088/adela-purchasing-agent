import {catalogListedPrice} from '@/lib/catalog-display-price';
import type {ShopProduct} from '@/lib/commerce-types';
import {useStoreText} from './store-language';

export function ProductPrice({product,en=false,...options}:{product:ShopProduct;en?:boolean}&Parameters<typeof catalogListedPrice>[1]) {
 const t=useStoreText(en),price=catalogListedPrice(product,options);
 if(price.amount===null)return null;
 return <strong>{price.from?t('起 ','From '):''}{price.currency==='TWD'?'NT$':'₩'}{price.amount.toLocaleString()}</strong>;
}

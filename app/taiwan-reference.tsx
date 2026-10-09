import {validTaiwanReferenceUrl,verifiedNoTaiwanSale} from '@/lib/market-price';
import type {ShopProduct} from '@/lib/commerce-types';
import {useStoreText} from './store-language';
export function TaiwanReference({product,variantId}:{product:ShopProduct;variantId?:string}){
 const t=useStoreText(),p=product.variants.length?product.variants.find(v=>v.id===variantId):product,official=p?.taiwanRetailClassification?.startsWith('official'),twoUnits=p?.taiwanRetailClassification==='retailer_two_units_excludes_gift';
 if(product.variants.length&&!p)return <span>{t('選擇規格後查看台灣參考價','Select an option to compare the matching Taiwan price')}</span>;
 if(verifiedNoTaiwanSale(p))return <span>{t('台灣無販售','Not sold in Taiwan')}</span>;
 if(!p?.taiwanRetailTwd||!validTaiwanReferenceUrl(p.taiwanRetailSource))return <span>{t('未取得可核實的台灣同規格售價','No verified Taiwan price for this specification')}</span>;
 return <><a href={p.taiwanRetailSource} target="_blank" rel="noopener noreferrer">{twoUnits?t('台灣一般版同容量單支 × 2 合計（贈品不計）：','Taiwan regular edition: two matching-size units, gifts excluded: '):official?t('台灣官方通路參考價：','Taiwan official-channel reference: '):t('台灣零售參考價：','Taiwan retailer reference: ')}NT${p.taiwanRetailTwd.toLocaleString()} ↗</a>{!!p.taiwanPromotionTwd&&<small>{t('來源另列促銷價：','Separately listed promotion: ')}NT${p.taiwanPromotionTwd.toLocaleString()}</small>}</>;
}

'use client';
import type {ShopProduct} from '@/lib/commerce-types';
import type {FeeTable} from '@/lib/commerce-policy';
import {catalogDisplayParts} from '@/lib/catalog-display-price';
export function PerfumePricingSummary({product:p,rate,fees}:{product:ShopProduct;rate?:number;fees?:FeeTable}){
 if(!p.pricingTaxExclusive||!rate)return null;
 return <details className="adela-perfume-pricing"><summary>未稅計價＋2% 代購費 · 成本差額</summary><p>含稅採買成本保留。未稅計價為店家優惠，並非已取得退稅。</p>{(p.variants.length?p.variants:[undefined]).map(v=>{const r=catalogDisplayParts(p,{variantId:v?.id,exchangeRate:rate,fees});return <div key={v?.id||p.id}><b>{v?.labelZh||p.spec||p.nameZh}</b>{r?.ok?<><span>售價 NT${(r.goodsTwd+r.feeTwd+r.sizeFeeTwd).toLocaleString()}（代購費 NT${r.feeTwd} 已含）</span><small>含稅來源價換算 NT${r.originalCostTwd.toLocaleString()} · 未稅計價折讓 NT${r.storeDiscountTwd.toLocaleString()}</small><small>扣代購費後店家吸收 NT${Math.max(0,r.storeDiscountTwd-r.feeTwd).toLocaleString()}</small></>:<span>此規格仍需核對售價上限。</span>}</div>;})}</details>;
}

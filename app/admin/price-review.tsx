'use client';
import {productPriceReview,priceReviewMessage} from '@/lib/price-review';
import type {ShopProduct} from '@/lib/commerce-types';
import {useAdminText} from './admin-language';
export function PriceReview({product,rate,standardRate}:{product:ShopProduct;rate?:number;standardRate?:number}){
 const a=useAdminText();
 return <section className="op-price-check" aria-label={a('商品價差檢查')}>{(product.variants.length?product.variants:[undefined]).map(v=>{
  const r=productPriceReview(product,rate||0,v?.id,standardRate),e=r.evidence;
  return <article key={v?.id||'single'} data-price-status={r.status}><h4>{v?.labelZh||product.spec||a('單一商品')}</h4><p role="status">{r.status==='missing'?a('缺少：')+r.missing.map(x=>a(x)).join('、'):r.status==='same_or_higher'?a('售價等於或高於台灣；高出 NT${higher}，超出售價上限 NT${excess}。',{higher:r.higherTwd||0,excess:r.excessTwd||0}):r.status==='insufficient_discount'?a('價差不足 5%；超出售價上限 NT${amount}。',{amount:r.excessTwd||0}):r.status==='cost_above_limit'?a(priceReviewMessage(r)):a(priceReviewMessage(r))}</p><dl><div><dt>{a('台灣同規格')}</dt><dd>{e.taiwanSpec||a('缺少規格')} · NT${e.taiwanPrice||'—'} · {e.classification||a('缺少價格條件')}</dd></div><div><dt>{a('台灣來源／日期')}</dt><dd>{e.taiwanSource?<a href={e.taiwanSource} target="_blank" rel="noreferrer">{e.taiwanSource}</a>:a('缺少來源')} · {e.taiwanDate||'—'}</dd></div><div><dt>{a('韓國含必要運費成本')}</dt><dd>₩{e.koreaCostKrw.toLocaleString()} · NT${r.costTwd??'—'} · {a('其中韓國運費')} ₩{e.deliveryKrw??'—'} · {e.deliveryConditions||a('缺少條件')} · {e.deliveryConfirmed?a('已確認含運'):a('運費未確認')}</dd></div><div><dt>{a('預計售價')}</dt><dd>NT${e.proposedTwd>0?e.proposedTwd.toLocaleString():'—'}</dd></div><div><dt>{a('價差／允許售價上限')}</dt><dd>{r.differencePercent===null?'—':r.differencePercent.toFixed(2)+'%'} · NT${r.ceiling??'—'}</dd></div></dl></article>;
 })}</section>;
}

'use client';
import {useStoreText,useStoreLocale,localeCode} from './store-language';
import type {Pricing} from '@/lib/commerce-types';
const money=(n:number)=>'NT$'+n.toLocaleString();
export function PriceBreakdown({p,en=false}:{p:Pricing;en?:boolean}){
 const language=useStoreLocale(en),t=useStoreText(en);
 return <div className="kk-price-breakdown">
  {p.items.map((item,i)=><div className="kk-price-item" key={i}><strong>{language==='zh'?item.nameZh:item.nameEn} × {item.quantity}</strong><div><span>{t('商品售價（含代購服務）','Price including purchasing service')}{item.offerTitle&&' · '+(language==='zh'?item.offerTitle:item.offerTitleEn||item.offerTitle)}</span><b>{money(item.goodsTwd+item.feeTwd+item.sizeFeeTwd)}</b></div></div>)}
  <div><span>{t('配送費','Delivery')}</span><b>{money(p.shippingTwd)}</b></div>
  {!!p.discountTwd&&<div className="kk-discount-line"><span>{t('優惠券折抵','Coupon discount')} · {language==='zh'?p.discountLabel:p.discountLabelEn||p.discountLabel}</span><b>−{money(p.discountTwd)}</b></div>}
  {!!p.creditAppliedTwd&&<div className="kk-discount-line"><span>{t('購物金折抵','Store credit')}</span><b>−{money(p.creditAppliedTwd)}</b></div>}
  {p.estimatedArrival&&<p>{t('預計到貨：','Estimated arrival: ')}{new Date(p.estimatedArrival).toLocaleString(localeCode(language),{timeZone:'Asia/Taipei'})}{' – '}{(p.estimatedArrivalTo||p.estimatedArrival).slice(0,10)}{' · '}{p.etaReason}</p>}
  {p.purchaseAt&&<p>{t('預定採買：','Planned purchase: ')}{new Date(p.purchaseAt).toLocaleString(localeCode(language),{timeZone:'Asia/Taipei'})}{p.purchaseAtTo&&p.purchaseAtTo!==p.purchaseAt?' – '+new Date(p.purchaseAtTo).toLocaleString(localeCode(language),{timeZone:'Asia/Taipei'}):''} (UTC+8)</p>}
  {p.cancelUntil&&<p><b>{t('免費取消截止：','Free cancellation until: ')}{new Date(p.cancelUntil).toLocaleString(localeCode(language),{timeZone:'Asia/Taipei'})} (UTC+8)</b></p>}
  <p>{p.urgent?t('加急配送 · 優先取貨','Priority delivery / pickup'):t('台灣本島一般配送','Taiwan main island standard delivery')}</p>
  <div className="kk-total"><strong>{t('合計（已含代購服務）','Total (service included)')}</strong><b>{money(p.totalTwd)}</b></div>
 </div>;
}

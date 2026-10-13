import type {PriceSource,ProductAnalysis} from './types';
import {countries,type Country} from './countries';
import {departmentStoreRefundPrice,DEFAULT_DEPARTMENT_STORE_REFUND_FEE_PERCENT} from './japan-tax';

export type QuoteSourceResult=
 | {kind:'ready';source:PriceSource;amount:number;priceBasis:'local_after_tax_refund'|'local_tax_included';conditions:string}
 | {kind:'unrecognized'|'not_sold'|'out_of_stock'};

// retailerChoiceId is stripped from AI output and assigned only after the
// server verifies a known SKU. It does not inflate the original photo score.
const identified=(analysis:ProductAnalysis)=>(analysis.confidence>=.72||Boolean(analysis.retailerChoiceId))&&Boolean((analysis.model||analysis.brand||analysis.identifiedNameZh||analysis.identifiedNameEn).trim());

export function selectQuoteSource(analysis:ProductAnalysis,country:Country,quantity=1,goodsFactor=1):QuoteSourceResult{
 if(!identified(analysis))return{kind:'unrecognized'};
 const local=analysis.sources.filter(source=>source.exactMatch&&source.localCountry===country&&source.currency===countries[country].currency);
 if(!local.length)return{kind:'not_sold'};
 const stocked=local.filter(source=>source.inStock&&Number(source.originalPrice||source.priceTaxIncludedJpy)>1);
 if(!stocked.length)return{kind:'out_of_stock'};
 const options=stocked.map(source=>{
  const refunded=Boolean(source.taxFreeEligible&&source.taxFreeForResale&&Number(source.afterTaxPrice)>0);
  const taxIncluded=Number(source.originalPrice||source.priceTaxIncludedJpy);
  const amount=refunded&&country==='JP'?departmentStoreRefundPrice(taxIncluded,analysis.taxRatePercent,DEFAULT_DEPARTMENT_STORE_REFUND_FEE_PERCENT):refunded?Number(source.afterTaxPrice):taxIncluded;
  const jpNotice=`日本百貨免稅估算已加計 ${DEFAULT_DEPARTMENT_STORE_REFUND_FEE_PERCENT}%（未稅商品價）退稅手續費；實際退稅仍須符合旅客資格並完成出境確認。`;
  return{kind:'ready' as const,source,amount,priceBasis:refunded?'local_after_tax_refund' as const:'local_tax_included' as const,conditions:refunded?(country==='JP'?jpNotice:String(source.taxFreeConditions||'已依商家公開退稅條件計算。')):'未取得適用本次代購交易的退稅證明，因此採用當地商家含稅現價。'};
 }).filter(result=>Number.isFinite(result.amount)&&result.amount>1);
 const deliveryKnown=(s:PriceSource)=>s.deliveryConfirmed===true&&Number.isFinite(s.deliveryAmount)&&s.deliveryAmount!>=0&&Boolean(s.deliveryConditions?.trim())&&['per_order','per_unit'].includes(s.deliveryBasis||'');
 const landed=(r:typeof options[number])=>{
  const s=r.source,q=Math.max(1,quantity),free=s.deliveryBasis==='per_order'&&Number.isFinite(s.deliveryFreeThreshold)&&s.deliveryFreeThreshold!>0&&Number.isFinite(s.deliveryFlatAmount)&&s.deliveryFlatAmount!>=0;
  const delivery=free?(r.amount*q>=s.deliveryFreeThreshold!?0:s.deliveryFlatAmount!):s.deliveryAmount!;
  return r.amount*q*(r.priceBasis==='local_tax_included'?goodsFactor:1)+delivery*(s.deliveryBasis==='per_unit'?q:1);
 };
 options.sort((a,b)=>Number(deliveryKnown(b.source))-Number(deliveryKnown(a.source))||(deliveryKnown(a.source)?landed(a)-landed(b):a.amount-b.amount));
 return options[0]||{kind:'not_sold'};
}

export function quoteSourceMessage(kind:Exclude<QuoteSourceResult['kind'],'ready'>,country:Country){
 const place=countries[country].zh;
 if(kind==='not_sold')return `${place}尚未取得此規格可核對的購買來源與現價。這不代表沒有販售；請補充商品頁或清楚型號，未建立訂單。 / A verifiable retailer and current price for this exact item in ${countries[country].en} were not found. This does not prove it is unavailable. No order was created.`;
 if(kind==='out_of_stock')return `${place}目前沒有可確認的現貨。請稍後再試；不會建立訂單。 / No verifiable local stock is currently available. No order was created.`;
 return 'AI 尚無法確認商品型號。請補充品牌／型號或改用能看清標籤的照片；不會建立訂單。 / The exact item could not be identified. Add the brand/model or upload a photo showing the label. No order was created.';
}

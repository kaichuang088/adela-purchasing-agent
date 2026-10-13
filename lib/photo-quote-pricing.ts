import {currencyRate} from './currency-rate';
import {countries,type Country} from './fulfilment';
import {exchange,calculate,ShopError} from './commerce';
import {rawDb} from './catalog';
import {quoteSourceMessage,selectQuoteSource} from './quote-source';
import {isPerfume} from './product-pricing';
import {tiers,type Member} from './commerce-types';
import type {ProductAnalysis} from './types';
import {resolveProductPhoto} from './product-photo';
export async function quoteDraft(draft:Record<string,unknown>,member:Member,a:ProductAnalysis){
 if(a.needsProductChoice)throw new ShopError('請先選擇照片中的口味、容量與包裝。 / Select the flavor, size and packaging first.',422);
 const country=String(draft.country) as Country,quantity=Number(draft.quantity)||1,perfume=isPerfume({nameZh:a.identifiedNameZh,nameEn:a.identifiedNameEn,categoryZh:a.category,categoryEn:a.category}),result=selectQuoteSource(a,country,quantity,country==='KR'&&perfume?1/1.1:1);
 if(result.kind!=='ready')throw new ShopError(quoteSourceMessage(result.kind,country),422);
 const {source,amount}=result;
 if(source.deliveryConfirmed!==true||!Number.isFinite(source.deliveryAmount)||source.deliveryAmount!<0||!source.deliveryConditions?.trim()||!['per_order','per_unit'].includes(source.deliveryBasis||''))throw new ShopError('尚未確認這個規格的必要當地運費與購買條件，不能提供可接受的總價；未建立訂單。 / Mandatory retailer shipping and purchase terms need verification. No order was created.',422);
 // Threshold metadata is supplied only by the independently verified retailer
 // adapter, never by the AI schema. A quantity change cannot retain stale fees.
 const delivery=source.deliveryBasis==='per_order'&&Number.isFinite(source.deliveryFreeThreshold)&&source.deliveryFreeThreshold!>0&&Number.isFinite(source.deliveryFlatAmount)&&source.deliveryFlatAmount!>=0?(amount*quantity>=source.deliveryFreeThreshold!?0:source.deliveryFlatAmount!):source.deliveryAmount!;
 const net=amount+delivery/(source.deliveryBasis==='per_order'?quantity:1),jpyRate=await exchange(),foreignRate=await currencyRate(source.currency||countries[country].currency,jpyRate),jpy=source.currency==='JPY'?Math.ceil(net):Math.ceil(net*foreignRate/jpyRate.rate);
 const pricing=await calculate(member,[{kind:'custom',quantity:Number(draft.quantity)||1,unitTwd:source.currency==='JPY'?jpy*jpyRate.rate:net*foreignRate,p:{pricingTaxExclusive:country==='KR'&&!source.taxFreeEligible&&isPerfume({nameZh:a.identifiedNameZh,nameEn:a.identifiedNameEn,categoryZh:a.category,categoryEn:a.category}),pricingTaxRatePercent:10,serviceFeePercent:isPerfume({nameZh:a.identifiedNameZh,nameEn:a.identifiedNameEn,categoryZh:a.category,categoryEn:a.category})?2:undefined,sourceDeliveryKrw:delivery/(source.deliveryBasis==='per_order'?quantity:1),id:0,nameZh:a.identifiedNameZh,nameEn:a.identifiedNameEn,categoryZh:a.category,categoryEn:a.category,descriptionZh:'',descriptionEn:'',priceJpy:jpy,imageKey:String(draft.image_key),status:'active',addon:false,allowedTiers:tiers,variants:[],sizeFeeTwd:0,stock:-1,purchaseUrl:source.url,sourceRequestId:null}}],'',{photoQuote:true});
 Object.assign(pricing.items[0],{...(a.retailerPhotoUrl?{imageUrl:resolveProductPhoto(a.retailerPhotoUrl)}:{}),sourceCountry:draft.country,sourceCurrency:source.currency,sourceAmount:net,sourceRateTwd:foreignRate,priceBasis:result.priceBasis,taxIncludedJpy:source.priceTaxIncludedJpy||source.originalPrice,taxFreeConditions:result.conditions+' '+source.deliveryConditions,taxEvidenceUrl:source.taxEvidenceUrl});pricing.expiresAt=String(draft.expires_at);
 const saved=await rawDb().prepare("UPDATE kk_photo_drafts SET state='quoted',pricing_json=? WHERE id=? AND state IN ('identified','quoted') AND expires_at>?").bind(JSON.stringify(pricing),draft.id,new Date().toISOString()).run();
 if(!saved.meta.changes)throw new ShopError('查價已取消或到期。 / Quote cancelled or expired.',409);
 return pricing;
}


import {currencyRate} from './currency-rate';
import {countries,type Country} from './fulfilment';
import {exchange,calculate,ShopError} from './commerce';
import {rawDb} from './catalog';
import {quoteSourceMessage,selectQuoteSource} from './quote-source';
import {tiers,type Member} from './commerce-types';
import type {ProductAnalysis} from './types';
export async function quoteDraft(draft:Record<string,unknown>,member:Member,a:ProductAnalysis){
 const country=String(draft.country) as Country,result=selectQuoteSource(a,country);
 if(result.kind!=='ready')throw new ShopError(quoteSourceMessage(result.kind,country),422);
 const {source,amount:net}=result,jpyRate=await exchange(),foreignRate=await currencyRate(source.currency||countries[country].currency,jpyRate),jpy=source.currency==='JPY'?Math.ceil(net):Math.ceil(net*foreignRate/jpyRate.rate);
 const pricing=await calculate(member,[{kind:'custom',quantity:Number(draft.quantity)||1,unitTwd:source.currency==='JPY'?jpy*jpyRate.rate:net*foreignRate,p:{id:0,nameZh:a.identifiedNameZh,nameEn:a.identifiedNameEn,categoryZh:a.category,categoryEn:a.category,descriptionZh:'',descriptionEn:'',priceJpy:jpy,imageKey:String(draft.image_key),status:'active',addon:false,allowedTiers:tiers,variants:[],sizeFeeTwd:0,stock:-1,purchaseUrl:source.url,sourceRequestId:null}}],'',{photoQuote:true});
 Object.assign(pricing.items[0],{sourceCountry:draft.country,sourceCurrency:source.currency,sourceAmount:net,sourceRateTwd:foreignRate,priceBasis:result.priceBasis,taxIncludedJpy:source.priceTaxIncludedJpy,taxFreeConditions:result.conditions,taxEvidenceUrl:source.taxEvidenceUrl});pricing.expiresAt=String(draft.expires_at);
 const saved=await rawDb().prepare("UPDATE kk_photo_drafts SET state='quoted',pricing_json=? WHERE id=? AND state IN ('identified','quoted') AND expires_at>?").bind(JSON.stringify(pricing),draft.id,new Date().toISOString()).run();
 if(!saved.meta.changes)throw new ShopError('查價已取消或到期。 / Quote cancelled or expired.',409);
 return pricing;
}


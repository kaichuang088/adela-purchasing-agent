import {validTaiwanReferenceUrl} from './market-price';
import type {ShopProduct,Tier} from './commerce-types';
/** Selling prices are whole TWD, always rounded upward to a five-dollar step. */
export function roundSellingPrice(amount:number){return Number.isFinite(amount)&&amount>0?Math.ceil((amount-1e-9)/5)*5:0;}
export function referenceFeeRange(p:Pick<ShopProduct,'nameZh'|'nameEn'|'categoryZh'|'categoryEn'|'brand'>,cost:number){
 const name=[p.nameZh,p.nameEn,p.brand,p.categoryZh,p.categoryEn].join(' ');
 if(/Le\s*Labo|Aesop|香水|淡香精|perfume|eau de parfum/i.test(name))return [3,6] as const;
 if(/St[üu]ssy|Mardi|Matin|服飾|fashion/i.test(name))return [8,18] as const;
 if(/解酒|咖啡糖|奶昔|OFRA|Hello\s*Kitty|Condition|I.?MINT|shake/i.test(name))return cost<300?[25,50] as const:[15,30] as const;
 return cost<200?[20,40] as const:cost<1500?[10,20] as const:[5,12] as const;
}
export function recommendStandardPrice(p:ShopProduct,cost:number,size=0,variantId?:string){
 const range=referenceFeeRange(p,cost),rate=Math.max(3,p.serviceFeePercent??range[1]);
 variantId=variantId||(p as ShopProduct&{selectedVariantId?:string}).selectedVariantId;
 const v=p.variants.find(x=>x.id===variantId),r=v||p;
 const expected=v?.labelZh||p.spec||'',normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
 const matched=!!expected&&!!r.taiwanRetailSpec&&normalize(expected)===normalize(r.taiwanRetailSpec);
 const tw=matched&&r.taiwanRetailTwd&&validTaiwanReferenceUrl(r.taiwanRetailSource)&&Number.isFinite(Date.parse(r.taiwanRetailCheckedAt||''))&&r.taiwanRetailClassification!=='member_only'?Math.min(r.taiwanRetailTwd,r.taiwanPromotionTwd||Infinity):0;
 const proposed=roundSellingPrice(cost*(1+rate/100)+size),minimum=roundSellingPrice(cost*1.03+size),target=tw?Math.floor(tw*.95/5)*5:0;
 const amount=target>=minimum?Math.min(proposed,target):proposed;
 const unsuitable=!!tw&&amount>=tw;
 return {amount,cost,range,referenceTwd:tw||null,targetTwd:target||null,unsuitable,warnings:[...(unsuitable?['本期成本／匯率使售價不低於台灣，建議暫不販售。']:[]),...(tw&&amount>target&&!unsuitable?['無法同時保留成本及低於台灣5%，建議確認後再販售。']:[]),...(!tw?['尚未核對台灣同規格市售價，此為成本建議。']:[])]};
}
export function standardMemberParts(p:ShopProduct,gross:number,size:number,quantity=1,variantId?:string,tier:Tier='standard',feeCap?:number){
 variantId=variantId||(p as ShopProduct&{selectedVariantId?:string}).selectedVariantId;
 const v=p.variants.find(x=>x.id===variantId),explicit=v?.salePriceTwd??p.salePriceTwd,costKnown=(v?.priceJpy??p.priceJpy)>1;
 const cost=costKnown?gross/quantity:0,unitSize=size/quantity;
 const recommendation=recommendStandardPrice(p,cost,unitSize,variantId);
 if(!explicit&&(recommendation.unsuitable||!costKnown))return {ok:false as const,reason:'cost_above_limit' as const};
 const base=roundSellingPrice(explicit||recommendation.amount),profit=Math.max(0,base-cost-unitSize);
 const diamond=Math.min(base,roundSellingPrice(cost*1.03+unitSize));
 const black=Math.min(base,Math.max(diamond,roundSellingPrice(cost+profit*.6+unitSize)));
 const platinum=Math.min(base,Math.max(black,roundSellingPrice(cost+profit*.8+unitSize)));
 let unit=costKnown?({standard:base,platinum,black,diamond}[tier]):base;
 if(feeCap!==undefined&&costKnown)unit=Math.min(unit,roundSellingPrice(cost*(1+Math.max(0,feeCap)/100)+unitSize));
 const total=unit*quantity;
 const goodsTwd=costKnown?Math.min(gross,Math.max(0,total-size)):total;
 const sizeFeeTwd=costKnown?Math.min(size,Math.max(0,total-goodsTwd)):0;
 const feeTwd=Math.max(0,total-goodsTwd-sizeFeeTwd);
 return {ok:true as const,goodsTwd,feeTwd,sizeFeeTwd,originalCostTwd:costKnown?gross+size:0,storeDiscountTwd:costKnown?Math.max(0,gross+size-total):0,feeRate:tier==='diamond'?3:cost>0?Number((feeTwd/(cost*quantity)*100).toFixed(2)):0,standardPriceTwd:base,manualPriceOverride:!!explicit,costUnverified:!costKnown};
}

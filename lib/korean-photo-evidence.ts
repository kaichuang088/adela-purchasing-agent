import rows from './lelabo-r23-evidence.json';
import expandedRows from './lelabo-r24-evidence.json';
import {verifyKurlyPhoto} from './kurly-photo-evidence';
import type {ProductAnalysis} from './types';
const normalized=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
/** Known exact official SKUs are independently repriced; AI-supplied amounts are never trusted. */
export async function verifyKnownKoreanPhoto(analysis:ProductAnalysis,transport:typeof fetch=fetch){
 analysis=await verifyKurlyPhoto(analysis,transport);
 if(analysis.needsProductChoice)return {...analysis,sources:[]};
 const text=[analysis.brand,analysis.model,analysis.identifiedNameZh,analysis.identifiedNameEn].join(' ');
 const format=analysis.category+' '+text;if(!/香水|淡香精|淡香水|perfume|parfum|\bEDP\b/i.test(format)||/護手|乳液|身體乳|沐浴|蠟燭|擴香|\boil\b|\blotion\b|\bshower\b|\bcandles?\b|hand[ -](?:wash|balm|cream)/i.test(format))return analysis;
 if(analysis.confidence<.85||!normalized(text).includes('LELABO')||/套組|禮盒|\bset\b|[×x]\s*(?:[2-9]|[1-9]\d+)|(?:[2-9]|[1-9]\d+)\s*(?:瓶|支|bottles?)/i.test(text))return analysis;
 const sizes=[...text.matchAll(/(?:^|[^\d])(\d+(?:\.\d+)?)\s*(?:ml|毫升)(?=$|[^a-z])/gi)].map(m=>Number(m[1]));if(!sizes.length||new Set(sizes).size!==1)return analysis;
 const match=[...rows,...expandedRows].find(r=>normalized(text).includes(normalized(r.name))&&Number(r.size.replace(/[^\d.]/g,''))===sizes[0]);if(!match)return analysis;
 const fallback=()=>({...analysis,sources:analysis.sources.filter(s=>{try{return new URL(s.url).hostname.replace(/^www\./,'')!=='lelabofragrances.co.kr';}catch{return false;}})});
 try{
  const read=async(url:string)=>{const r=await transport(url,{headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(7000)});if(!r.ok)throw Error('Official source not readable');return r.json() as Promise<any>;};
  const [current,availability,shipping]=await Promise.all([read(match.priceEndpoint),read(match.availabilityEndpoint),transport(match.deliverySource,{headers:{'User-Agent':'Mozilla/5.0'},redirect:'manual',signal:AbortSignal.timeout(7000)}).then(async r=>{if(!r.ok)throw Error('Delivery policy unavailable');return r.text();})]),price=current.prices?.[match.koreaSkuId];const policy=shipping.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');if(!/40,000원 미만 구매 시 3,000원/.test(policy)||!/40,000원 이상 구매 시 무료/.test(policy))return fallback();
  if(price?.sku_code!==match.skuCode||!Number.isSafeInteger(price.buq)||price.buq<=1||availability.available!==true)return fallback();
  const delivery=price.buq>=40000?0:3000;
  const source:any={storeName:'Le Labo 韓國官方',url:match.koreaPage+'?size='+match.size.replaceAll(' ',''),localCountry:'KR',currency:'KRW',originalPrice:price.buq,afterTaxPrice:null,priceTaxIncludedJpy:0,priceTaxFreeJpy:null,taxFreeEligible:false,taxFreeForResale:false,taxFreeConditions:'不假設商業代購可退稅',taxEvidenceUrl:'',exactMatch:true,inStock:true,capturedAt:new Date().toISOString(),deliveryAmount:delivery,deliveryConfirmed:true,deliveryConditions:match.deliveryConditions,deliveryBasis:'per_order',note:'已以官方價格及庫存接口重新核對 SKU '+match.skuCode};
  return {...analysis,model:match.name+' '+match.size+' × 1瓶',sources:[source],evidenceSummaryZh:'已重新核對官方同款 '+match.size+'／1瓶、當前韓元價格、可購買狀態與一般配送；仍需買家確認照片中的規格。'};
 }catch(e){return {...fallback(),evidenceSummaryZh:analysis.evidenceSummaryZh+'（官方價格／運費核對暫時未完成：'+(e instanceof Error?e.name:'source_error')+'）'};}
}

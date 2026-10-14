import type {ProductAnalysis,PriceSource} from './types';

// Only known brand/product families can reach this public merchant adapter.
// The buyer explicitly chooses the merchant's current package; no photograph
// is silently relabelled or treated as an assorted bundle.
const families=[
 {brand:/Orion|오리온|好[麗丽]友/i,photo:/Choco\s*Pie|초코파이|巧克力派/i,keyword:'오리온 초코파이',merchant:/^\[오리온\]\s*초코파이/},
 {brand:/Orion|오리온|好[麗丽]友/i,photo:/Kkobuk|Turtle\s*Chips|꼬북칩|烏龜|四層脆片/i,keyword:'오리온 꼬북칩',merchant:/^\[오리온\]\s*꼬북칩/},
 {brand:/Orion|오리온|好[麗丽]友/i,photo:/Chicken\s*Pop|치킨팝|雞米花/i,keyword:'오리온 치킨팝',merchant:/^\[오리온\].*치킨팝/},
 {brand:/Orion|오리온|好[麗丽]友/i,photo:/Poca|포카칩|波卡/i,keyword:'오리온 포카칩',merchant:/^\[오리온\]\s*포카칩/},
 {brand:/Orion|오리온|好[麗丽]友/i,photo:/Moist\s*Choco|촉촉한초코칩|濕潤巧克力豆|巧克力豆軟餅乾/i,keyword:'오리온 촉촉한초코칩',merchant:/^\[오리온\]\s*촉촉한초코칩/},
 {brand:/Orion|오리온|好[麗丽]友/i,photo:/Choco\s*Songi|초코송이|巧克力蘑菇|蘑菇巧克力/i,keyword:'오리온 초코송이',merchant:/^\[오리온\]\s*초코송이/},
 {brand:/Nongshim|농심|農心/i,photo:/Shin\s*Ram(?:yun|en)|신라면|辛拉麵/i,keyword:'신라면',merchant:/^\[농심\]\s*신라면/},
 {brand:/Nongshim|농심|農心/i,photo:/Chapa(?:ghetti|getti)|짜파게티|炸醬/i,keyword:'짜파게티',merchant:/^\[농심\]\s*(?:올리브\s*|사천)?짜파게티/},
 {brand:/Nongshim|농심|農心/i,photo:/Saewoo|Saewoo?k?kk?ang|새우깡|蝦味(?:先|條)|Shrimp\s*(?:Crackers|Snacks)/i,keyword:'새우깡',merchant:/^\[농심\]\s*(?:매운|와사비\s*|쌀)?새우깡/},
 {brand:/Nongshim|농심|農心/i,photo:/Onion\s*Rings|양파링|洋蔥圈/i,keyword:'양파링',merchant:/^\[농심\]\s*양파링/},
 {brand:/Nongshim|농심|農心/i,photo:/Banana\s*Kick|바나나킥|香蕉(?:玉米|脆)/i,keyword:'바나나킥',merchant:/^\[농심\]\s*바나나킥/},
 {brand:/Lotte|롯데|樂天/i,photo:/Pepero|빼빼로/i,keyword:'빼빼로',merchant:/^\[롯데\].*빼빼로/},
 {brand:/Lotte|롯데|樂天/i,photo:/Malang\s*Cow|말랑카우|牛奶軟糖/i,keyword:'말랑카우',merchant:/^\[롯데\]\s*말랑카우/},
 {brand:/HBAF|Tom'?s|길림/i,photo:/Honey\s*Butter.*Almond|허니버터.*아몬드|蜂蜜奶油杏仁/i,keyword:'허니버터아몬드',merchant:/^\[HBAF\]\s*허니버터\s*아몬드/},
 {brand:/Haitai|해태|海太/i,photo:/Honey\s*Butter.*Chip|허니버터칩|蜂蜜奶油洋芋/i,keyword:'허니버터칩',merchant:/^\[해태\]\s*허니버터칩/},
 {brand:/Samyang|삼양|三養/i,photo:/Buldak|불닭볶음면|火雞|火辣雞/i,keyword:'불닭볶음면',merchant:/^\[삼양\].*불닭볶음면/},
];
const family=(a:ProductAnalysis)=>{
 if((a.familyConfidence??a.confidence)<.85)return undefined;
 const text=[a.brand,a.model,a.identifiedNameZh,a.identifiedNameEn].join(' ');
 return families.find(f=>f.brand.test(text)&&f.photo.test(text));
};
async function readJson(url:string,transport:typeof fetch){
 const response=await transport(url,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'Mozilla/5.0'}});
 if(!response.ok)return null;const text=await response.text();return text.length<=2000000?JSON.parse(text):null;
}
async function readPackage(id:string,f:typeof families[number],transport:typeof fetch,onCold?:()=>void){
 if(!/^\d{6,13}$/.test(id))return null;
 const url='https://www.kurly.com/goods/'+id;
 try{
  const response=await transport(url,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'Mozilla/5.0'}});
  if(!response.ok)return null;const html=await response.text();if(html.length>2000000)return null;
  const raw=html.match(/<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];if(!raw)return null;
  const p=JSON.parse(raw).props?.pageProps?.product,options=p?.dealProducts;
  if(String(p?.no)!==id||!f.merchant.test(p.name||'')||p.isPurchaseStatus!==true||p.isSoldOut!==false||p.isAppExclusive===true||p.isMemberFirstOrder===true||!Array.isArray(options)||options.length!==1)return null;
  // This automatic flow has no verified cold-chain onward-delivery route.
  if(!Array.isArray(p.storageTypes)||p.storageTypes.length!==1||p.storageTypes[0]!=='AMBIENT_TEMPERATURE'){if(p.storageTypes?.some((s:string)=>['COLD','FROZEN'].includes(s)))onCold?.();return null;}
  const option=options[0],price=p.showablePrices?.salesPrice,volume=String(p.volume||'').trim();
  if(!f.merchant.test(option.name||'')||option.isPurchaseStatus!==true||option.isSoldOut!==false||option.canPurchaseLevel!==true||option.buyUnit!==1||option.minEa!==1||option.membershipLabels?.length||option.bundleDiscounts?.length||!Number.isSafeInteger(price)||price<=1||!/\d\s*(?:g|ml|mL|kg)/i.test(volume))return null;
  if(p.deliveryTypeInfos?.length!==1||p.deliveryTypeInfos[0].deliveryFeeDescription!=='3,000원 (4만원 이상 무료)')return null;
  const image=String(p.mainImageUrl||''),u=new URL(image);if(u.protocol!=='https:'||!['product-image.kurly.com','img-cf.kurly.com'].includes(u.hostname))return null;
  const max=Math.min(Number(p.maxEa),Number(option.maxEa));if(!Number.isSafeInteger(max)||max<1)return null;
  const model=option.name+' · '+volume+' · 1份商家包裝';
  const source:PriceSource={storeName:'Kurly 韓國',url,localCountry:'KR',currency:'KRW',originalPrice:price,priceTaxIncludedJpy:0,priceTaxFreeJpy:null,taxFreeEligible:false,taxFreeForResale:false,exactMatch:true,inStock:true,capturedAt:new Date().toISOString(),deliveryAmount:price>=40000?0:3000,deliveryConfirmed:true,deliveryBasis:'per_order',deliveryFreeThreshold:40000,deliveryFlatAmount:3000,deliveryConditions:'Kurly 韓國一般配送，單筆商品滿 ₩40,000 免運，未滿運費 ₩3,000。以完整商家包裝計價，不拆分整箱，不套用會員或優惠券折扣。',note:'買家明確選擇此商家 SKU；已重新核對現價、包裝、可購買狀態及購買上限。原照片容量可能不同；未宣稱庫存件數。'};
  return {id,model,imageUrl:image,source,purchaseLimit:Math.min(20,max)};
 }catch{return null;}
}
export async function nativeKurlyChoices(a:ProductAnalysis,transport:typeof fetch=fetch):Promise<ProductAnalysis|null>{
 const f=family(a);if(!f)return null;
 const failed={...a,sources:a.sources.filter(s=>{try{return new URL(s.url).hostname!=='www.kurly.com';}catch{return false;}})};
 try{
  const data=await readJson('https://api.kurly.com/search/v4/sites/market/normal-search?keyword='+encodeURIComponent(f.keyword)+'&page=1&sort_type=',transport);
  if(!data?.success)return failed;const ids:string[]=[];
  const walk=(v:any)=>{if(Array.isArray(v)){v.forEach(walk);return;}if(v&&typeof v==='object'){if(v.no&&f.merchant.test(v.name||'')&&v.isPurchaseStatus===true&&v.isSoldOut===false&&v.isMultiplePrice===false&&!ids.includes(String(v.no)))ids.push(String(v.no));Object.values(v).forEach(walk);}};
  let coldRequired=false;
  walk(data.data?.listSections);const products=await Promise.all(ids.slice(0,4).map(id=>readPackage(id,f,transport,()=>{coldRequired=true;})));
  const retailerChoices=products.flatMap(p=>p?[{id:p.id,labelZh:p.model,labelEn:p.model,model:p.model,imageUrl:p.imageUrl}]:[]);
  if(retailerChoices.length)return {...a,needsProductChoice:true,sources:[],retailerChoices};
  return coldRequired?{...failed,needsProductChoice:true,identificationChoices:[],evidenceSummaryZh:'商家標示需冷藏或冷凍保存，請先交由賣家確認保存與配送方式；暫不提供自動報價，未建立訂單。',evidenceSummaryEn:'The retailer specifies chilled or frozen storage. Ask the seller to verify storage and onward delivery before a quote. No order was created.'}:failed;
 }catch{return failed;}
}
export async function selectNativeKurlyChoice(a:ProductAnalysis,id:string,transport:typeof fetch=fetch):Promise<ProductAnalysis|null>{
 const f=family(a),choice=a.retailerChoices?.find(c=>c.id===id);if(!f||!choice)return null;
 const result=await readPackage(id,f,transport);if(!result||result.model!==choice.model)return null;
 return {...a,needsProductChoice:false,identificationChoices:[],retailerChoices:[],retailerChoiceId:id,retailerPhotoUrl:result.imageUrl,retailerPurchaseLimit:result.purchaseLimit,category:'零食',model:result.model,identifiedNameZh:result.model,identifiedNameEn:result.model,sources:[result.source],evidenceSummaryZh:'已重新核對買家選擇的完整商家包裝與供貨；不是將原照片上的其他容量共用價格。'};
}

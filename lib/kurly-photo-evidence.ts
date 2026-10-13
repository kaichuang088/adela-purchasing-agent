import type {ProductAnalysis,PriceSource} from './types';

const yegam=[
 {id:'5095165',weight:192,flavor:/오리지널|original|原味/i,other:/치즈|cheese|起司|芝士/i,name:'Orion 예감 原味 192g（16g × 12小包）· 1盒',nameEn:'Orion Yegam Original 192g (16g x 12 sachets), one box'},
 {id:'5095164',weight:204,flavor:/치즈|cheese|起司|芝士/i,other:/오리지널|original|原味/i,name:'Orion 예감 起司焗烤 204g（17g × 12小包）· 1盒',nameEn:'Orion Yegam Cheese Gratin 204g (17g x 12 sachets), one box'},
];

const familyText=(a:ProductAnalysis)=>[a.brand,a.model,a.identifiedNameZh,a.identifiedNameEn].join(' ');
const recognised=(a:ProductAnalysis)=>(a.familyConfidence??a.confidence)>=.85&&/ORION|오리온|好[麗丽]友/i.test(familyText(a))&&/YEGAM|예감|煎薯片|預感.*洋芋片/i.test(familyText(a));
const isKnownUrl=(value:string)=>{try{const u=new URL(value);return u.hostname==='www.kurly.com'&&yegam.some(p=>u.pathname==='/goods/'+p.id);}catch{return false;}};

async function readItem(item:typeof yegam[number],transport:typeof fetch){
 const url='https://www.kurly.com/goods/'+item.id;
 try{
  const response=await transport(url,{headers:{'User-Agent':'Mozilla/5.0'},redirect:'manual',signal:AbortSignal.timeout(7000)});
  if(!response.ok)return null;const html=await response.text();if(html.length>2000000)return null;
  const serialized=html.match(/<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];if(!serialized)return null;
  const product=JSON.parse(serialized).props?.pageProps?.product;
  const options=product?.dealProducts,price=product?.showablePrices?.salesPrice,delivery=product?.deliveryTypeInfos?.[0]?.deliveryFeeDescription;
  if(!Array.isArray(options)||options.length!==1||!Number.isSafeInteger(price)||price<=0||product.isPurchaseStatus!==true)return null;
  const option=options[0];
  if(option.isSoldOut!==false||option.isPurchaseStatus!==true||option.canPurchaseLevel!==true||option.buyUnit!==1||option.minEa!==1||option.bundleDiscounts?.length||option.membershipLabels?.length)return null;
  if(!/예감/.test(option.name)||!new RegExp(item.weight+'g').test(option.name)||!item.flavor.test(option.name)||item.other.test(option.name))return null;
  if(delivery!=='3,000원 (4만원 이상 무료)')return null;
  const source:PriceSource={storeName:'Kurly 韓國',url,localCountry:'KR',currency:'KRW',originalPrice:price,priceTaxIncludedJpy:0,priceTaxFreeJpy:null,taxFreeEligible:false,taxFreeForResale:false,exactMatch:true,inStock:true,capturedAt:new Date().toISOString(),deliveryAmount:price>=40000?0:3000,deliveryConfirmed:true,deliveryBasis:'per_order',deliveryFreeThreshold:40000,deliveryFlatAmount:3000,deliveryConditions:'Kurly 韓國一般配送，單筆商品滿 ₩40,000 免運，未滿運費 ₩3,000。售價為單盒，沒有拆分整箱、會員或優惠券假設。',note:'已核對目前單一規格、可購買狀態、公開售價及配送條件；庫存件數未公開。'};
  let imageUrl='';
  for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)){
   try{const data=JSON.parse(match[1]),nodes=Array.isArray(data)?data:data['@graph']||[data];const node=nodes.find((n:any)=>n['@type']==='Product'&&n.url===url&&n.name===option.name);const image=Array.isArray(node?.image)?node.image[0]:node?.image;if(typeof image==='string'){const u=new URL(image);if(u.protocol==='https:'&&['product-image.kurly.com','img-cf.kurly.com'].includes(u.hostname))imageUrl=image;}}catch{}
  }
  return {item,source,imageUrl};
 }catch{return null;}
}
const withItem=(a:ProductAnalysis,result:NonNullable<Awaited<ReturnType<typeof readItem>>>)=>({...a,needsProductChoice:false,identificationChoices:[],retailerChoices:[],retailerChoiceId:result.item.id,retailerPhotoUrl:result.imageUrl,model:result.item.nameEn,identifiedNameZh:result.item.name,identifiedNameEn:result.item.nameEn,sources:[result.source],evidenceSummaryZh:'已確認買家選擇的商家口味、總重量與單盒包裝。照片上的其他容量不會共用這個價格。'});

/** Refresh one explicitly chosen known SKU, without another paid vision call. */
export async function selectKurlyChoice(analysis:ProductAnalysis,id:string,transport:typeof fetch=fetch){
 if(!recognised(analysis)||!analysis.retailerChoices?.some(c=>c.id===id))return null;
 const item=yegam.find(p=>p.id===id);if(!item)return null;
 const result=await readItem(item,transport);return result&&result.imageUrl?withItem(analysis,result):null;
}

/** A family collage is never treated as a mixed bundle. Exact available
 * packages are offered for explicit consent, not substituted into the photo. */
export async function verifyKurlyPhoto(analysis:ProductAnalysis,transport:typeof fetch=fetch):Promise<ProductAnalysis>{
 const fallback={...analysis,sources:analysis.sources.filter(s=>!isKnownUrl(s.url))};
 if(!recognised(analysis))return fallback;
 const text=familyText(analysis),item=analysis.confidence>=.85&&!analysis.needsProductChoice&&!/套組|混合|綜合|mixed|assorted|[×x]\s*[2-9]\s*(?:盒|boxes)/i.test(text)?yegam.find(p=>p.flavor.test(text)&&!p.other.test(text)&&new RegExp('(?:^|[^0-9])'+p.weight+'\\s*(?:g|公克|克)(?:[^a-z]|$)','i').test(text)):undefined;
 if(item){const result=await readItem(item,transport);return result?withItem(analysis,result):fallback;}
 const available=await Promise.all(yegam.map(p=>readItem(p,transport)));
 const retailerChoices=available.flatMap(r=>r?.imageUrl?[{id:r.item.id,labelZh:r.item.name,labelEn:r.item.nameEn,model:r.item.nameEn,imageUrl:r.imageUrl}]:[]);
 return {...fallback,needsProductChoice:true,sources:[],retailerChoices};
}

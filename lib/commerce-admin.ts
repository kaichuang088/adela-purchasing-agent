import {assertPublishablePrice} from './catalog-publish';
import {validTaiwanReferenceUrl} from './market-price';
import {cancelOrder} from './order-actions';
import {memberSelect} from '@/lib/commerce';
import {assertRepriceable,proposeRevision,revisePricing} from './price-revisions';
import {env} from 'cloudflare:workers';
import {rawDb} from './catalog';
import {addLedger,addOrderUpdate,calculate,legacyQuote,parseMember,product,ShopError} from './commerce';
import {orderStates,stateNames,tiers,type Pricing,type Tier} from './commerce-types';
import {productCategory} from './product-categories';
import r8Additions from './catalog-r8-additions.json';
import r8Images from './catalog-r8-image-repairs.json';
import expandedCatalog from './expanded-catalog.json';
import r15References from './catalog-r15-references.json';
import r14Verified from './catalog-r14-verified.json';

const bundledProductImages=new Set([...expandedCatalog.map(product=>product.image),...r8Additions.map(p=>p.imageUrl),...r8Images.map(p=>p.imageUrl),...r14Verified.map(p=>p.imageUrl),...r15References.map(p=>p.imageUrl)]);

export async function updateOrder(body:Record<string,any>){
 const db=rawDb(),row=await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(Number(body.id)).first();if(!row)throw new ShopError('找不到訂單。',404);
 if(body.status==='cancelled'){await cancelOrder(Number(row.id),null,String(body.reason||''),'',true);return;}
 const now=new Date().toISOString();
 if(body.customerCancel&&(row.purchased_at||['purchasing','purchased','shipped_japan','arrived_taiwan'].includes(String(row.status))||row.cancel_until&&Date.now()>=Date.parse(String(row.cancel_until))))throw new ShopError('已開始採買或超過取消期限。 / Purchasing started or cancellation expired.',409);
 if(body.action==='quote'){
  assertRepriceable(row);
  if(row.pricing_json){const previous=JSON.parse(String(row.pricing_json)) as Pricing;const changes=Array.isArray(body.items)?body.items:[{originalJpy:Number(body.originalJpy),sizeFeeTwd:Number(body.sizeFeeTwd)||0,nameZh:String(body.nameZh||''),nameEn:String(body.nameEn||''),sourceUrl:String(body.purchaseUrl||'')}];await proposeRevision(row,revisePricing(previous,changes),String(body.reason||''));return;}
  const memberRow=row.member_id?await db.prepare(memberSelect+' WHERE m.id=?').bind(row.member_id).first():null;
  const member=memberRow?parseMember(memberRow):{id:'legacy',name:String(row.customer_name),email:String(row.email),miles:0,spendJpy:0,spendKrw:0,tier:'standard' as Tier,overrideTier:null};
  const original=Number(body.originalJpy);if(!Number.isInteger(original)||original<=0||original>100000000)throw new ShopError('請輸入有效原價 KRW。');
  const name=String(body.nameZh||row.identified_name_zh||'客製商品').slice(0,180),nameEn=String(body.nameEn||name).slice(0,180),url=String(body.purchaseUrl||'');if(url&&!/^https:\/\//.test(url))throw new ShopError('購買網址需為 HTTPS。');
  const sizeFee=Number(body.sizeFeeTwd)||0;if(sizeFee<0||sizeFee>100000)throw new ShopError('尺寸處理費無效。');
  const p={id:0,nameZh:name,nameEn,categoryZh:'客製',categoryEn:'Custom',descriptionZh:'',descriptionEn:'',priceJpy:original,imageKey:String(row.image_key),status:'active',addon:false,allowedTiers:tiers,variants:[],sizeFeeTwd:sizeFee,stock:-1,purchaseUrl:url,sourceRequestId:Number(row.id)};
  const pricing=await calculate(member,[{p,quantity:Number(row.quantity)||1,kind:row.kind==='catalog'?'catalog':'custom'}]);
  await db.prepare("UPDATE shopping_requests SET pricing_json=?,quote_json=?,status='quoted',identified_name_zh=?,identified_name_en=?,updated_at=? WHERE id=? AND paid_at IS NULL").bind(JSON.stringify(pricing),JSON.stringify(legacyQuote(pricing,name,nameEn)),name,nameEn,now,row.id).run();
  if(body.publishAfterReview===true&&row.kind==='custom'&&row.image_key&&/^https:\/\//.test(url))await saveProduct({requestId:Number(row.id)});
  await addOrderUpdate(Number(row.id),row.member_id?String(row.member_id):null,'quoted','報價已完成','Quote ready',`${name} · NT$${pricing.totalTwd.toLocaleString()}`);
  return;
 }
 if(body.action==='eta'){
  const eta=String(body.eta||''),reason=String(body.reason||'').trim().slice(0,1000);if(!/^\d{4}-\d{2}-\d{2}$/.test(eta)||!Number.isFinite(Date.parse(eta))||!reason)throw new ShopError('請填寫預計領貨日期及更新原因。');
  const etaTo=String(body.etaTo||eta);if(!/^\d{4}-\d{2}-\d{2}$/.test(etaTo)||!Number.isFinite(Date.parse(etaTo))||new Date(etaTo).toISOString().slice(0,10)!==etaTo||new Date(eta).toISOString().slice(0,10)!==eta||etaTo<eta)throw new ShopError('請填寫有效的領貨日期區間。');
  await db.prepare('UPDATE shopping_requests SET eta=?,eta_to=?,eta_reason=?,updated_at=? WHERE id=?').bind(eta,etaTo,reason,now,row.id).run();await addOrderUpdate(Number(row.id),row.member_id?String(row.member_id):null,String(row.status),'預計領貨日期更新','Estimated collection updated',`${eta} · ${reason}`);return;
 }
 if(body.action==='payment_state'){
  if(row.status==='refund_pending')throw new ShopError('訂單已取消待退款，請使用退款核對。 / Use refund reconciliation for this cancelled order.',409);
  const paid=Boolean(body.paid),reason=String(body.reason||'').trim().slice(0,1000);
  if(row.paid_at)throw new ShopError('此訂單已完成入帳核對；付款狀態不可由後台任意改回。請依退款流程處理。',409);
  if(row.payment_method==='transfer'&&(String(row.status)!=='payment_review'||!row.payment_reported_at||(!/^[0-9]{5}$/.test(String(row.payment_reference||''))&&!row.payment_photo_id)))throw new ShopError('旅客尚未按「我已付款」並提供末五碼或付款截圖，後台目前不能核對此訂單。',409);
  if(!paid){
   if(!reason)throw new ShopError('請填寫未收到款項的原因或查核結果。');
   const changed=await db.prepare("UPDATE shopping_requests SET status='awaiting_payment',payment_reported_at=NULL,updated_at=? WHERE id=? AND paid_at IS NULL AND status='payment_review'").bind(now,row.id).run();
   if(!changed.meta.changes)throw new ShopError('此訂單目前不在等待付款核對狀態。',409);
   await addOrderUpdate(Number(row.id),row.member_id?String(row.member_id):null,'awaiting_payment','尚未收到款項，請重新確認','Payment not received — please check again',reason);return;
  }
  body={...body,status:'paid',paymentReference:String(row.payment_reference||'付款截圖核對')};
 }
 if(['purchasing','purchased','shipped_japan','arrived_taiwan','completed'].includes(String(body.status))&&await db.prepare("SELECT id FROM kk_price_revisions WHERE order_id=? AND status IN ('pending','accepted')").bind(row.id).first())throw new ShopError('請先完成調價確認及補款／退款核對。',409);
 const status=String(body.status||'');
 if(status==='purchasing'&&row.status!=='purchasing')throw new ShopError('採買中由預定採買日期自動更新，賣家請在買到商品後回報。',409);
 // New cancellations must use the atomic credit/reward/stock/priority workflow.
 // Only pre-existing bank-refund records may use manual reconciliation.
 if(status==='rejected'||status==='refund_pending'||status==='refunded'&&row.status!=='refund_pending')throw new ShopError('請使用取消訂單流程；符合條件的款項會自動轉入購物金，不需退款帳號。',409);
 if(row.status==='refund_pending'&&status!=='refunded')throw new ShopError('此訂單已取消，請完成退款核對。',409);if(!orderStates.includes(status))throw new ShopError('訂單狀態無效。');if(status===row.status)return;if(status==='awaiting_cod'&&row.payment_method!=='cod')throw new ShopError('此訂單不是貨到付款。');if(status==='payment_review'&&(row.payment_method!=='transfer'||!row.payment_reported_at))throw new ShopError('旅客尚未回報匯款。');
 if(['cancelled','rejected','refunded','completed'].includes(String(row.status)))throw new ShopError('此訂單已結案，無法變更狀態。');
 if(['rejected','cancelled','on_hold','refunded'].includes(status)&&!String(body.reason||'').trim())throw new ShopError('請填寫原因，以通知顧客。');
 if(status==='refunded'&&row.status==='refund_pending'&&!String(body.paymentReference||'').trim())throw new ShopError('請填寫退款轉帳核對資訊。');
 const resumingPaid=status==='paid'&&row.status==='on_hold'&&!!row.paid_at;
 if(status==='paid'&&!resumingPaid){
  if(row.paid_at)throw new ShopError('款項已確認，請勿重複付款入帳。');
  if(row.payment_method==='transfer'&&(row.status!=='payment_review'||!row.payment_reported_at||(!/^[0-9]{5}$/.test(String(row.payment_reference||''))&&!row.payment_photo_id)))throw new ShopError('旅客尚未按「我已付款」並提供末五碼或付款截圖，後台目前不能確認收款。',409);
  if(!['quoted','awaiting_payment','payment_review','customer_confirmed','on_hold','awaiting_cod',...(row.payment_method==='cod'?['purchasing','purchased','shipped_japan','arrived_taiwan']:[])].includes(String(row.status))||!row.pricing_json)throw new ShopError('此訂單尚無可付款的金額。');
  if(!String(body.paymentReference||row.payment_reference||'').trim())throw new ShopError('請填寫入帳核對資訊。');
 }
 if(['purchasing','purchased','shipped_japan','arrived_taiwan','completed','refunded'].includes(status)&&!row.paid_at&&!(row.payment_method==='cod'&&!['completed','refunded'].includes(status)))throw new ShopError('請先確認付款。');
 if(['shipped_japan','arrived_taiwan','completed'].includes(status)&&!row.purchased_at)throw new ShopError('請先勾選採買完成。');
 const progress=['paid','purchasing','purchased','shipped_japan','arrived_taiwan','completed'];if(!(status==='paid'&&row.payment_method==='cod')&&progress.includes(status)&&progress.includes(String(row.status))&&progress.indexOf(status)<progress.indexOf(String(row.status)))throw new ShopError('進度不可倒退。');
 const nextStatus=status==='paid'&&row.received_at?'completed':status==='paid'&&row.payment_method==='cod'&&['purchasing','purchased','shipped_japan','arrived_taiwan'].includes(String(row.status))?String(row.status):status;
 const transition=await db.prepare("UPDATE shopping_requests SET status=?,paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,?) ELSE paid_at END,purchased_at=CASE WHEN ?='purchased' THEN ? ELSE purchased_at END,payment_reference=?,note=note,updated_at=? WHERE id=? AND status=? AND (? NOT IN ('purchasing','purchased','shipped_japan','arrived_taiwan','completed') OR NOT EXISTS(SELECT 1 FROM kk_price_revisions WHERE order_id=shopping_requests.id AND status IN ('pending','accepted')))").bind(nextStatus,status,now,status,now,String(body.paymentReference||row.payment_reference||'').slice(0,180),now,row.id,row.status,status).run();
 if(!transition.meta.changes)throw new ShopError('訂單剛剛已更新，請重新載入後操作。',409);
 if(status==='completed')await db.prepare('UPDATE shopping_requests SET received_at=COALESCE(received_at,?) WHERE id=?').bind(now,row.id).run();
 const memberId=row.member_id?String(row.member_id):null,pricing=row.pricing_json?JSON.parse(String(row.pricing_json)) as Pricing:null;
 if(status==='paid'&&!resumingPaid&&memberId&&pricing){const korean=pricing.items[0]?.sourceCurrency==='KRW';await addLedger('payment:'+row.id,memberId,Number(row.id),Math.floor(pricing.goodsJpy/(korean?5000:500)),pricing.goodsJpy,'付款消費 / Paid purchase',korean?'KRW':'JPY');}
 if(status==='refunded')await db.prepare('UPDATE shopping_requests SET refund_reference=? WHERE id=?').bind(String(body.paymentReference||body.reason||'').slice(0,180),row.id).run();
 if(status==='refunded'&&memberId){const paid=await db.prepare("SELECT SUM(miles) AS miles,SUM(spend_jpy) AS spend_jpy,SUM(spend_krw) AS spend_krw FROM kk_ledger WHERE order_id=? AND (event_key=? OR event_key LIKE 'revision:%')").bind(row.id,'payment:'+row.id).first();if(paid){const korean=pricing?.items[0]?.sourceCurrency==='KRW';await addLedger('refund:'+row.id,memberId,Number(row.id),-Math.min(Number(paid.miles),Number((await db.prepare('SELECT miles FROM kk_members WHERE id=?').bind(memberId).first())?.miles||0)),-Number(korean?paid.spend_krw:paid.spend_jpy),'退款調整 / Refund adjustment',korean?'KRW':'JPY');}}
 if(['cancelled','rejected','refunded'].includes(status)&&memberId&&!row.purchased_at&&Number(row.snack_redeemed)===1)await addLedger('snack-return:'+row.id,memberId,Number(row.id),30,0,'取消訂單退回兌換 / Snack miles returned');
 if(['cancelled','rejected','refunded'].includes(status)&&row.kind==='catalog'&&!row.purchased_at&&pricing)for(const item of pricing.items)if(item.productId)await db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.stock',json_extract(commerce_json,'$.stock')+?) WHERE id=? AND json_extract(commerce_json,'$.stock')>=0").bind(item.quantity,item.productId).run();
 
 const titles:Record<string,string>={paid:'付款已確認',purchasing:'採買中',purchased:'商品已買到',shipped_japan:'商品已寄出',arrived_taiwan:'商品可領貨',completed:'訂單已完成',on_hold:'訂單暫停處理',rejected:'訂單已拒絕',cancelled:'訂單已取消',refunded:'退款已確認'};
 await addOrderUpdate(Number(row.id),memberId,status,titles[status]||'訂單進度更新','Order update',String(body.reason||'').slice(0,1000));
}
export async function saveProduct(body:Record<string,any>){
 const db=rawDb();let source:Record<string,unknown>|null=null;
 if(body.requestId){source=await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(Number(body.requestId)).first();if(!source?.pricing_json)throw new ShopError('請先完成報價。');const q=JSON.parse(String(source.pricing_json)) as Pricing;const l=q.items[0];body={...body,nameZh:l.nameZh,nameEn:l.nameEn,originalJpy:l.originalJpy,imageKey:source.image_key,purchaseUrl:l.sourceUrl,categoryZh:'其他',categoryEn:'Other',sizeFeeTwd:l.sizeFeeTwd/l.quantity,status:'active'};const old=await db.prepare('SELECT id FROM products WHERE source_request_id=?').bind(source.id).first();if(old)body.id=old.id;}
 const name=String(body.nameZh||'').trim().slice(0,180),price=Number(body.originalJpy);if(!name||!Number.isInteger(price)||price<=0||price>100000000)throw new ShopError('請填商品名稱與韓元原價。');
 const allowed=Array.isArray(body.allowedTiers)?body.allowedTiers.filter((t:Tier)=>tiers.includes(t)):tiers;if(!allowed.length)throw new ShopError('至少選擇一種可購買的會員等級。');
 const stock=Number(body.stock??-1),size=Number(body.sizeFeeTwd)||0;if(!Number.isInteger(stock)||stock< -1||size<0||size>100000)throw new ShopError('庫存或尺寸處理費無效。');
 const status=String(body.status||'draft');if(!['active','draft','research','paused','discontinued'].includes(status))throw new ShopError('商品狀態無效。');
 const imageKey=String(body.imageKey||'');if(imageKey&&!/^(products|requests)\/[a-zA-Z0-9._-]+$/.test(imageKey)&&!/^static\/products\/[a-zA-Z0-9._-]+$/.test(imageKey))throw new ShopError('請重新上傳商品圖片。');
 const purchaseUrl=String(body.purchaseUrl||'').slice(0,800);if(purchaseUrl&&!/^https:\/\//.test(purchaseUrl))throw new ShopError('購買網址需為 HTTPS。');
 const imageUrl=String(body.imageUrl||'').slice(0,1000);if(imageUrl&&!/^https:\/\//.test(imageUrl)&&!bundledProductImages.has(imageUrl))throw new ShopError('商品圖片需為 HTTPS 網址或已收錄的商品照片。');
 const taiwanAvailability=body.taiwanAvailability==='not_sold'?'not_sold':'listed',taiwanAbsenceEvidence=String(body.taiwanAbsenceEvidence||'').trim().slice(0,1200);if(taiwanAvailability==='not_sold'&&(taiwanAbsenceEvidence.length<20||body.taiwanAbsenceConfirmed!==true))throw new ShopError('標示台灣無販售前，請記錄查核品牌、同規格台灣通路的證據，並確認結果；查無價格不能當成無販售。');
 const taiwanRetailTwd=Number(body.taiwanRetailTwd)||0,taiwanRetailSource=String(body.taiwanRetailSource||'').trim().slice(0,800);if(taiwanRetailSource&&!validTaiwanReferenceUrl(taiwanRetailSource))throw new ShopError('台灣比價禁止使用蝦皮，請使用官方、momo、PChome 或其他可核對的台灣通路。');if(!Number.isInteger(taiwanRetailTwd)||taiwanRetailTwd<0||taiwanRetailTwd>10000000||taiwanRetailSource&&!/^https:\/\//.test(taiwanRetailSource)||taiwanRetailTwd>0&&!taiwanRetailSource)throw new ShopError('台灣市售價須附同規格商品的 HTTPS 來源網址。');
 if(status==='active'&&(price<=1||(!imageKey&&!imageUrl)||!purchaseUrl))throw new ShopError('公開上架前請核對韓元售價、商品照片及韓國購買來源。');
 const purchaseAt=body.purchaseAt?new Date(body.purchaseAt):null;if(purchaseAt&&!Number.isFinite(+purchaseAt))throw new ShopError('採買時間需晚於現在。');
 const purchaseAtTo=body.purchaseAtTo?new Date(body.purchaseAtTo):purchaseAt;if(purchaseAtTo&&(!purchaseAt||!Number.isFinite(+purchaseAtTo)||+purchaseAtTo<+purchaseAt))throw new ShopError('採買區間結束不可早於開始。 / Purchase end must be at or after its start.');
 const availableFrom=body.availableFrom?new Date(body.availableFrom):null,availableUntil=body.availableUntil?new Date(body.availableUntil):null;
 if(availableFrom&&!Number.isFinite(+availableFrom)||availableUntil&&!Number.isFinite(+availableUntil)||availableFrom&&availableUntil&&+availableFrom>=+availableUntil)throw new ShopError('販售期間無效；結束時間需晚於開始時間。');
 const variants=Array.isArray(body.variants)?body.variants.map((v:any,i:number)=>({id:String(v.id||`option-${i+1}`).trim().slice(0,80),labelZh:String(v.labelZh||'').trim().slice(0,120),labelEn:String(v.labelEn||v.labelZh||'').trim().slice(0,120),priceJpy:Number(v.priceJpy)})).filter((v:any)=>v.id||v.labelZh||v.labelEn):[];
 if(variants.some((v:any)=>!v.id||!v.labelZh||!Number.isInteger(v.priceJpy)||v.priceJpy<=0||v.priceJpy>100000000)||new Set(variants.map((v:any)=>v.id)).size!==variants.length)throw new ShopError('商品規格需有不重複代碼、中文名稱及有效 KRW 價格。');
 const arrivalHours=Number(body.arrivalHours)||0;if(!Number.isInteger(arrivalHours)||arrivalHours<0||arrivalHours>8760)throw new ShopError('預計到貨小時需為 0 至 8760 的整數。');
 const taxRefundEligible=body.taxRefundEligible===true,taxRatePercent=Number(body.taxRatePercent??10),taxRefundFeePercent=Number(body.taxRefundFeePercent??1.55);
 if(![8,10].includes(taxRatePercent)||!Number.isFinite(taxRefundFeePercent)||taxRefundFeePercent<0||taxRefundFeePercent>20)throw new ShopError('日本消費稅率或百貨退稅手續費設定無效。');
 const category=productCategory(body.categoryZh||body.categoryEn);
 const previous=body.id?await db.prepare('SELECT commerce_json FROM products WHERE id=?').bind(Number(body.id)).first():null;const previousData=previous?JSON.parse(String(previous.commerce_json||'{}')):{};
 for(const v of variants){const old=(previousData.variants||[]).find((x:any)=>x.id===v.id&&x.labelZh===v.labelZh&&x.labelEn===v.labelEn);if(old)for(const k of ['acquisitionPack','sourcePriceBasis','taiwanAvailability','taiwanAbsenceEvidence','taiwanAvailabilityCheckedAt','taiwanRetailSpec','sourceDeliveryConfirmed','sourceDeliveryKrw','sourceDeliveryConditions','sourceCheckedAt','taiwanRetailTwd','taiwanPromotionTwd','taiwanRetailSource','taiwanRetailClassification','taiwanRetailCheckedAt','imageUrl','purchaseUrl','stock','availabilityNote','salePriceTwd'])if(old[k]!==undefined)(v as any)[k]=old[k];}
 for(const v of variants){const incoming=body.variants.find((x:any)=>x.id===v.id);if(incoming&&Object.hasOwn(incoming,'stock')&&incoming.stock!=null){if(![0,-1].includes(incoming.stock))throw new ShopError('規格供貨狀態無效。');(v as any).stock=incoming.stock;(v as any).availabilityNote=incoming.stock===0?String(incoming.availabilityNote||'韓國貨源缺貨 / Supplier sold out').slice(0,600):'';}}
 for(const v of variants){
  const incoming=body.variants.find((x:any)=>x.id===v.id),old=(previousData.variants||[]).find((x:any)=>x.id===v.id);
  for(const key of ['imageUrl','purchaseUrl'])if(Object.hasOwn(incoming,key)){
   const value=String(incoming[key]||'').trim();
   if(value&&!/^https:\/\//.test(value)&&!(key==='imageUrl'&&bundledProductImages.has(value)))throw new ShopError('規格圖片與來源需為 HTTPS 網址或既有商品照片。');
   (v as any)[key]=value;
  }
  for(const key of ['taiwanRetailSpec','taiwanRetailClassification','sourceCheckedAt'])if(Object.hasOwn(incoming,key))(v as any)[key]=String(incoming[key]||'').trim().slice(0,300);
  if(Object.hasOwn(incoming,'sourceDeliveryKrw'))(v as any).sourceDeliveryKrw=incoming.sourceDeliveryKrw===''?undefined:Number(incoming.sourceDeliveryKrw);
  if(Object.hasOwn(incoming,'sourceDeliveryConditions'))(v as any).sourceDeliveryConditions=String(incoming.sourceDeliveryConditions||'').slice(0,1000);
  if(Object.hasOwn(incoming,'sourceDeliveryConfirmed'))(v as any).sourceDeliveryConfirmed=incoming.sourceDeliveryConfirmed===true;
  if(Object.hasOwn(incoming,'taiwanRetailTwd')||Object.hasOwn(incoming,'taiwanRetailSource')){
   const amount=Number(incoming.taiwanRetailTwd)||0,url=String(incoming.taiwanRetailSource||'').trim();
   if(!Number.isInteger(amount)||amount<0||amount>10000000||url&&!validTaiwanReferenceUrl(url)||amount>0&&!url)throw new ShopError('規格比價需附有效同規格來源，禁止蝦皮。');
   Object.assign(v,{taiwanRetailTwd:amount,taiwanRetailSource:url,taiwanRetailCheckedAt:incoming.taiwanReferenceConfirmed===true&&amount>0?new Date().toISOString():old?.labelZh===v.labelZh&&old?.labelEn===v.labelEn&&old?.taiwanRetailTwd===amount&&old?.taiwanRetailSource===url?old.taiwanRetailCheckedAt:''});
   // An old promotion cannot survive replacement of its reference price/source.
   if(incoming.taiwanReferenceConfirmed===true||old?.taiwanRetailTwd!==amount||old?.taiwanRetailSource!==url)(v as any).taiwanPromotionTwd=0;
  }
 }
 const serviceFeePercent=body.serviceFeePercent==null||body.serviceFeePercent===''?undefined:Number(body.serviceFeePercent),salePriceTwd=Number(body.salePriceTwd)||undefined;
 if(serviceFeePercent!==undefined&&(!Number.isFinite(serviceFeePercent)||serviceFeePercent<0||serviceFeePercent>100))throw new ShopError('個別服務費率須為 0–100%。');
 if(salePriceTwd!==undefined&&(!Number.isInteger(salePriceTwd)||salePriceTwd<1||salePriceTwd>10000000))throw new ShopError('含服務費售價須為正整數。');
 const fields=[name,String(body.nameEn||name).slice(0,180),category.zh,category.en,String(body.descriptionZh||'').slice(0,1200),String(body.descriptionEn||'').slice(0,1200),price,imageKey||null,status,JSON.stringify({...previousData,sourceEvidence:String(body.evidence??body.sourceEvidence??previousData.sourceEvidence??'').slice(0,3000),taiwanPromotionTwd:body.taiwanReferenceConfirmed===true||taiwanRetailTwd!==previousData.taiwanRetailTwd||taiwanRetailSource!==previousData.taiwanRetailSource?0:previousData.taiwanPromotionTwd,spec:String(body.spec??previousData.spec??'').trim().slice(0,300),taiwanRetailSpec:String(body.taiwanRetailSpec??previousData.taiwanRetailSpec??'').trim().slice(0,300),taiwanRetailClassification:String(body.taiwanRetailClassification??previousData.taiwanRetailClassification??'').trim().slice(0,100),sourceCheckedAt:String(body.sourceCheckedAt??previousData.sourceCheckedAt??'').trim().slice(0,100),sourceDeliveryConfirmed:body.sourceDeliveryConfirmed===true,sourceDeliveryKrw:body.sourceDeliveryKrw==null||body.sourceDeliveryKrw===''?undefined:Number(body.sourceDeliveryKrw),sourceDeliveryConditions:String(body.sourceDeliveryConditions??previousData.sourceDeliveryConditions??'').slice(0,1000),taiwanAvailability,taiwanAbsenceEvidence,taiwanAvailabilityCheckedAt:taiwanAvailability==='not_sold'?new Date().toISOString():'',serviceFeePercent,salePriceTwd,nameKo:String(body.nameKo??previousData.nameKo??'').slice(0,180),descriptionKo:String(body.descriptionKo??previousData.descriptionKo??'').slice(0,1200),country:'KR',currency:'KRW',purchaseAt:purchaseAt?.toISOString()||null,purchaseAtTo:purchaseAtTo?.toISOString()||null,availableFrom:availableFrom?.toISOString()||null,availableUntil:availableUntil?.toISOString()||null,variants,imageUrl,arrivalHours,addon:!!body.addon,allowedTiers:allowed,sizeFeeTwd:size,stock,purchaseUrl,taiwanRetailTwd,taiwanRetailSource,taiwanRetailCheckedAt:body.taiwanReferenceConfirmed===true&&taiwanRetailTwd>0?new Date().toISOString():taiwanRetailTwd===previousData.taiwanRetailTwd&&taiwanRetailSource===previousData.taiwanRetailSource?previousData.taiwanRetailCheckedAt:'',taxIncludedJpy:price,taxRefundEligible:false,taxRatePercent,taxRefundFeePercent})];
 const reviews=await assertPublishablePrice(product({id:Number(body.id)||0,name_zh:fields[0],name_en:fields[1],category_zh:fields[2],category_en:fields[3],description_zh:fields[4],description_en:fields[5],price_jpy:price,image_key:fields[7],status,commerce_json:fields[9]}));
 if(body.id)await db.prepare('UPDATE products SET name_zh=?,name_en=?,category_zh=?,category_en=?,description_zh=?,description_en=?,price_jpy=?,image_key=?,status=?,commerce_json=?,quote_json=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(...fields,Number(body.id)).run();
 else await db.prepare('INSERT INTO products (name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,image_key,status,commerce_json,source_request_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(...fields,source?.id||null).run();
 return reviews;
}

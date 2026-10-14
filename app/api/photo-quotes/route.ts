import {verifyKnownKoreanPhoto} from '@/lib/korean-photo-evidence';
import {selectKurlyChoice} from '@/lib/kurly-photo-evidence';
import {requestPhotoReview} from '@/lib/photo-inquiries';
import {quoteDraft} from '@/lib/photo-quote-pricing';
import {aiConfiguration,aiConnection} from '@/lib/ai-config';
import {shippingAddress} from '@/lib/shipping-address';
import {currencyRate} from '@/lib/currency-rate';
import {requireShopOpen,requirePhotoQuotesOpen} from '@/lib/commerce';
import {enabledCountry,countries,type Country} from '@/lib/fulfilment';
import {paymentChoice,transferDeadline} from '@/lib/payments';
import {env} from 'cloudflare:workers';
import {rawDb,newOrderNumber} from '@/lib/catalog';
import {currentMember,settings,exchange,calculate,legacyQuote,orderBundle,ShopError} from '@/lib/commerce';
import {privateJson} from '@/lib/admin-auth';
import {failure} from '@/app/api/shop/route';
import {analyzeProductImage} from '@/lib/request-data';
import {tiers,type Member,type Pricing} from '@/lib/commerce-types';
import type {ProductAnalysis} from '@/lib/types';
import {quoteSourceMessage,selectQuoteSource} from '@/lib/quote-source';
import {cleanupExpiredQuoteMedia,deleteMedia,getMedia,putMedia,D1_MEDIA_LIMIT} from '@/lib/media-store';
import {AI_PHOTO_MAX_BYTES} from '@/lib/photo-input';


async function identifyAndQuote(draft:Record<string,unknown>,member:Member){
 const db=rawDb();
 if(draft.analysis_json){const analysis=JSON.parse(String(draft.analysis_json)) as ProductAnalysis;return analysis.needsProductChoice?{state:'identified',analysis}:{state:'quoted',analysis,pricing:await quoteDraft(draft,member,analysis)};}
 if(!aiConfiguration(env).configured)throw new ShopError('AI 查價尚未啟用。 / AI pricing is not enabled.',409);
 const claimed=await db.prepare("UPDATE kk_photo_drafts SET state='analyzing' WHERE id=? AND state IN ('uploaded','failed')").bind(draft.id).run();
 if(!claimed.meta.changes)throw new ShopError('AI 正在辨識與查價，請稍候。 / AI is researching this item.',409);
 try{
  const image=await getMedia(String(draft.image_key));if(!image)throw new Error('Missing image');
  const {endpoint,model}=aiConnection(env);
  const identifiedAnalysis=await analyzeProductImage(image.bytes.buffer.slice(image.bytes.byteOffset,image.bytes.byteOffset+image.bytes.byteLength),String(draft.image_type),env.OPENAI_API_KEY||'netlify-gateway',model,String(draft.note),String(draft.country) as Country,endpoint,env.KK_AI_GATEWAY_URL?env.KK_AI_GATEWAY_SECRET||'':'');
  const analysis=String(draft.country)==='KR'?await verifyKnownKoreanPhoto(identifiedAnalysis):identifiedAnalysis;
  const saved=await db.prepare("UPDATE kk_photo_drafts SET state='identified',analysis_json=? WHERE id=? AND state='analyzing'").bind(JSON.stringify(analysis),draft.id).run();
  if(!saved.meta.changes)throw new ShopError('已取消此查價。 / Search cancelled.',410);
  return analysis.needsProductChoice?{state:'identified',analysis}:{state:'quoted',analysis,pricing:await quoteDraft({...draft,analysis_json:JSON.stringify(analysis)},member,analysis)};
 }catch(e){await db.prepare("UPDATE kk_photo_drafts SET state='failed' WHERE id=? AND state='analyzing'").bind(draft.id).run();if(e instanceof ShopError)throw e;console.error('photo_quote_ai_failed',e);throw new ShopError('AI 查價服務暫時無法連線，請稍後重試；尚未建立訂單。 / The AI pricing service is temporarily unavailable. Retry later; no order was created.',503);}
}

async function queuePhotoJob(id:string){
 const target=new URL(env.KK_AI_PHOTO_JOB_URL||''),gateway=new URL(env.KK_AI_GATEWAY_URL||'');
 if(target.protocol!=='https:'||target.origin!==gateway.origin||target.pathname!=='/.netlify/functions/ai-photo-background')throw new Error('Invalid photo job endpoint');
 const queued=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json','X-KK-AI-Gateway-Secret':env.KK_AI_GATEWAY_SECRET||''},body:JSON.stringify({id}),signal:AbortSignal.timeout(10000)});
 if(queued.status!==202)throw new Error('Photo job not accepted');
}

export async function POST(request:Request){try{
 const member=(await currentMember(request,true))!,db=rawDb();
 if(request.headers.get('content-type')?.includes('multipart/form-data')){
 await requirePhotoQuotesOpen();
  if(!aiConfiguration(env).configured)throw new ShopError('AI 查價尚未啟用，請稍後再試。尚未建立訂單。 / AI pricing is not enabled. No order was created.',409);
  await cleanupExpiredQuoteMedia();
  const count=await db.prepare("SELECT COUNT(*) AS n FROM kk_photo_drafts WHERE member_id=? AND state NOT IN ('discarded','purchased') AND expires_at>?").bind(member.id,new Date().toISOString()).first();
  if(Number(count?.n)>=5)throw new ShopError('請先完成或取消現有照片查價。 / Complete or cancel an existing photo search.',429);
  const form=await request.formData(),country=enabledCountry(form.get('country')||'KR',(await settings()).enabledCountries),file=form.get('image'),note=String(form.get('note')||'').trim().slice(0,1200);
  const maxBytes=env.KK_AI_GATEWAY_URL?AI_PHOTO_MAX_BYTES:env.BUCKET?4194304:D1_MEDIA_LIMIT;
  if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<1||file.size>maxBytes)throw new ShopError(env.KK_AI_GATEWAY_URL?'請重新從商品照片查價上傳，系統會自動壓縮；若仍過大，請裁切為單一商品。 / Upload through photo search for automatic compression, or crop to one product.':env.BUCKET?'請選擇 4MB 以下 JPG、PNG 或 WEBP。 / Choose a JPG, PNG or WEBP under 4MB.':'照片壓縮後仍過大，請改用較小的照片（900KB 以下）。 / The compressed image is still too large. Choose an image under 900KB.');
  const bytes=await file.arrayBuffer(),s=new Uint8Array(bytes),valid=file.type==='image/jpeg'?s[0]===255&&s[1]===216:file.type==='image/png'?s[0]===137&&s[1]===80&&s[2]===78&&s[3]===71:String.fromCharCode(...s.slice(0,4))==='RIFF'&&String.fromCharCode(...s.slice(8,12))==='WEBP';
  if(!valid)throw new ShopError('圖片格式不符。 / Invalid image format.');
  const id=crypto.randomUUID(),imageKey='quote-drafts/'+id;
  await putMedia(imageKey,bytes,file.type);
  try{await db.prepare('INSERT INTO kk_photo_drafts(id,member_id,image_key,image_type,note,expires_at,country) VALUES(?,?,?,?,?,?,?)').bind(id,member.id,imageKey,file.type,note,new Date(Date.now()+2*3600000).toISOString(),country).run();}catch(e){await deleteMedia(imageKey);throw e;}
  const draft=await db.prepare('SELECT * FROM kk_photo_drafts WHERE id=? AND member_id=?').bind(id,member.id).first();
  if(env.KK_AI_PHOTO_JOB_URL){
   try{
    await queuePhotoJob(id);
    return privateJson({id,state:'pending'},202);
   }catch{await db.prepare('DELETE FROM kk_photo_drafts WHERE id=? AND member_id=?').bind(id,member.id).run();await deleteMedia(imageKey);throw new ShopError('背景查價暫時無法啟動；尚未建立訂單。 / Photo research could not start. No order was created.',503);}
  }
  try{const result=await identifyAndQuote(draft!,member);return privateJson({id,...result},201);}
  catch(e){await db.prepare('DELETE FROM kk_photo_drafts WHERE id=? AND member_id=?').bind(id,member.id).run();await deleteMedia(imageKey);throw e;}
 }
 const body=await request.json() as {id?:string;action?:string;detail?:string;choiceId?:string;approvedAt?:string;approvedTotal?:number;paymentMethod?:string;cashConfirmed?:boolean;quantity?:number;shippingAddress?:unknown};
 const draft=await db.prepare('SELECT * FROM kk_photo_drafts WHERE id=? AND member_id=?').bind(String(body.id||''),member.id).first();
 if(!draft)throw new ShopError('找不到此查價。 / Photo quote not found.',404);
 const id=String(draft.id),now=new Date().toISOString();
 if(body.action==='buy'&&draft.order_id){const old=await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(draft.order_id).first();return privateJson({order:await orderBundle(old!)});}
 if(body.action==='request_review'){return privateJson({ok:true,inquiry:await requestPhotoReview(draft,member.id)});}
 if(body.action==='discard'){
  const changed=await db.prepare("UPDATE kk_photo_drafts SET state='discarded',analysis_json=NULL,pricing_json=NULL,note='' WHERE id=? AND state!='purchased'").bind(id).run();
  await db.prepare("UPDATE kk_photo_inquiries SET state='declined' WHERE draft_id=? AND member_id=? AND state IN ('pending','quoted')").bind(id,member.id).run();
  if(changed.meta.changes)await deleteMedia(String(draft.image_key));
  return privateJson({ok:true});
 }
 if(draft.state==='discarded'||String(draft.expires_at)<=now)throw new ShopError('查價已失效，請重新上傳。 / Quote expired. Upload again.',410);
 enabledCountry(draft.country,(await settings()).enabledCountries);
 if(body.action==='select_source'){
  await requirePhotoQuotesOpen();
  if(draft.country!=='KR'||!draft.analysis_json)throw new ShopError('請先完成商品辨識。 / Identify the item first.',409);
  const analysis=JSON.parse(String(draft.analysis_json)) as ProductAnalysis,choiceId=String(body.choiceId||'');
  if(draft.state==='quoted'&&analysis.retailerChoiceId===choiceId&&draft.pricing_json)return privateJson({id,state:'quoted',analysis,pricing:JSON.parse(String(draft.pricing_json))});
  if(draft.state!=='identified'||!analysis.retailerChoices?.some(c=>c.id===choiceId))throw new ShopError('找不到已核對的包裝選項。 / Verified package option not found.',409);
  const locked=await db.prepare("UPDATE kk_photo_drafts SET state='selecting' WHERE id=? AND member_id=? AND state='identified'").bind(id,member.id).run();
  if(!locked.meta.changes)throw new ShopError('包裝確認正在處理。 / Package confirmation is in progress.',409);
  let selectedJson='';
  try{
   const selected=await selectKurlyChoice(analysis,choiceId);if(!selected)throw new ShopError('這個商家包裝的價格或供貨已更新，請重新選擇；未建立訂單。 / Retailer price or availability changed. No order was created.',422);
   selectedJson=JSON.stringify(selected);
   const saved=await db.prepare("UPDATE kk_photo_drafts SET state='identified',analysis_json=? WHERE id=? AND member_id=? AND state='selecting'").bind(selectedJson,id,member.id).run();
   if(!saved.meta.changes)throw new ShopError('查價已取消。 / Quote cancelled.',410);
   return privateJson({id,state:'quoted',analysis:selected,pricing:await quoteDraft(draft,member,selected)});
  }catch(e){await db.prepare("UPDATE kk_photo_drafts SET state='identified' WHERE id=? AND member_id=? AND state='selecting'").bind(id,member.id).run();if(selectedJson)await db.prepare("UPDATE kk_photo_drafts SET analysis_json=? WHERE id=? AND member_id=? AND state='identified' AND analysis_json=?").bind(draft.analysis_json,id,member.id,selectedJson).run();throw e;}
 }
 if(body.action==='refine'){
  await requirePhotoQuotesOpen();
  if(!['identified','failed'].includes(String(draft.state)))throw new ShopError('請等待辨識完成再選擇規格。 / Wait for identification before selecting a specification.',409);
  const detail=String(body.detail||'').trim();if(!detail||detail.length>400)throw new ShopError('請填寫口味、容量與包裝（400 字以內）。 / Enter flavor, size and packaging (up to 400 characters).');
  const image=await getMedia(String(draft.image_key));if(!image)throw new ShopError('照片已到期，請重新上傳。 / Photo expired. Upload again.',410);
  const nextId=crypto.randomUUID(),nextKey='quote-drafts/'+nextId;
  const claimed=await db.prepare("UPDATE kk_photo_drafts SET state='refining' WHERE id=? AND member_id=? AND state IN ('identified','failed') AND expires_at>?").bind(id,member.id,now).run();
  if(!claimed.meta.changes)throw new ShopError('規格確認正在處理，請稍候。 / Specification confirmation is in progress.',409);
  try{
   await putMedia(nextKey,image.bytes,String(draft.image_type));
   const inserted=await db.prepare("INSERT INTO kk_photo_drafts(id,member_id,image_key,image_type,note,expires_at,country) SELECT ?,member_id,?,image_type,?,?,country FROM kk_photo_drafts WHERE id=? AND member_id=? AND state='refining' AND expires_at>?").bind(nextId,nextKey,String(draft.note).slice(0,700)+'\nSelected item (shopping context only): '+detail,String(draft.expires_at),id,member.id,now).run();
   if(!inserted.meta.changes)throw new ShopError('查價已更新，請重新查看。 / Quote changed. Refresh before continuing.',409);
   if(env.KK_AI_PHOTO_JOB_URL)await queuePhotoJob(nextId);
   const next=env.KK_AI_PHOTO_JOB_URL?null:await db.prepare('SELECT * FROM kk_photo_drafts WHERE id=? AND member_id=?').bind(nextId,member.id).first();
   const result=env.KK_AI_PHOTO_JOB_URL?{state:'pending'}:await identifyAndQuote(next!,member);
   await db.prepare("UPDATE kk_photo_drafts SET state='discarded',analysis_json=NULL,pricing_json=NULL WHERE id=? AND member_id=? AND state='refining'").bind(id,member.id).run();
   await deleteMedia(String(draft.image_key)).catch(()=>undefined);
   return privateJson({id:nextId,...result},env.KK_AI_PHOTO_JOB_URL?202:201);
  }catch(e){await db.prepare('DELETE FROM kk_photo_drafts WHERE id=? AND member_id=?').bind(nextId,member.id).run();await deleteMedia(nextKey);await db.prepare("UPDATE kk_photo_drafts SET state=? WHERE id=? AND member_id=? AND state='refining'").bind(draft.state,id,member.id).run();throw e;}
 }
 if(body.action==='identify'){
  await requirePhotoQuotesOpen();
  return privateJson(await identifyAndQuote(draft,member));
 }
 if(body.action==='confirm_product'){
  await requirePhotoQuotesOpen();
  if(!['identified','quoted'].includes(String(draft.state)))throw new ShopError('請先完成商品辨識。 / Identify the item first.',409);
  const quantity=Number(body.quantity||draft.quantity||1);if(!Number.isInteger(quantity)||quantity<1||quantity>20)throw new ShopError('數量須為 1–20');await db.prepare('UPDATE kk_photo_drafts SET quantity=? WHERE id=?').bind(quantity,draft.id).run();const a=JSON.parse(String(draft.analysis_json)) as ProductAnalysis;return privateJson({pricing:await quoteDraft({...draft,quantity},member,a)});
 }
 if(body.action==='buy'){
  await requireShopOpen();
  if(draft.state!=='quoted'||!draft.pricing_json)throw new ShopError('請先確認商品與報價。 / Confirm the item and quote first.',409);
  const pricing=JSON.parse(String(draft.pricing_json)) as Pricing;
  if(body.approvedTotal!==pricing.totalTwd||body.approvedAt!==pricing.pricedAt)throw new ShopError('報價已更新，請重新查看。 / Review the updated quote.',409);
  const image=await getMedia(String(draft.image_key));if(!image)throw new ShopError('圖片已失效，請重新查價。',410);
  const sellerReview=await db.prepare("SELECT reviewed_at FROM kk_photo_inquiries WHERE draft_id=? AND member_id=? AND state='quoted'").bind(id,member.id).first();
  const method=paymentChoice(member,body.paymentMethod,body.cashConfirmed===true),due=sellerReview&&method!=='cod'?transferDeadline():null,address=shippingAddress(body.shippingAddress);
  if(pricing.tier!==member.tier)throw new ShopError('會員等級已更新，請重新查價。 / Membership changed. Refresh quote.',409);
  const publicKey='requests/'+id;await putMedia(publicKey,image.bytes,String(draft.image_type));
  const acceptedAnalysis=JSON.parse(String(draft.analysis_json)) as ProductAnalysis;
  const purchasedPricing={...pricing,items:pricing.items.map(item=>({...item,imageUrl:acceptedAnalysis.retailerPhotoUrl||'/api/media/'+publicKey}))};
  const no=newOrderNumber(),key='photo-'+id,line=pricing.items[0];
  await db.batch([
   db.prepare("INSERT OR IGNORE INTO shopping_requests(request_no,submission_key,kind,member_id,customer_name,email,note,image_key,image_name,image_type,status,analysis_state,ai_analysis_json,identified_name_zh,identified_name_en,pricing_json,quote_json,payment_method,payment_due_at) SELECT ?,?,'custom',member_id,?,?,note,?,'photo',image_type,?,'ready',analysis_json,?,?,?,?,?,? FROM kk_photo_drafts WHERE id=? AND state='quoted' AND pricing_json=? AND expires_at>?").bind(no,key,member.name,member.email,publicKey,sellerReview?(method==='cod'?'awaiting_cod':'awaiting_payment'):'admin_review',line.nameZh,line.nameEn,JSON.stringify(purchasedPricing),JSON.stringify(legacyQuote(pricing,line.nameZh,line.nameEn)),method,due,id,draft.pricing_json,now),
   db.prepare('UPDATE shopping_requests SET eta=?,eta_reason=?,purchase_at=?,cancel_until=?,eta_to=?,shipping_address_json=?,quantity=?,seller_review_due_at=? WHERE request_no=?').bind(pricing.estimatedArrival||'',pricing.etaReason||'',pricing.purchaseAt||null,pricing.cancelUntil||null,pricing.estimatedArrivalTo||pricing.estimatedArrival||'',JSON.stringify(address),line.quantity,new Date(Date.now()+86400000).toISOString(),no),
   db.prepare("UPDATE kk_photo_drafts SET state='purchased',order_id=(SELECT id FROM shopping_requests WHERE submission_key=?) WHERE id=? AND EXISTS(SELECT 1 FROM shopping_requests WHERE submission_key=?)").bind(key,id,key),
   db.prepare("UPDATE shopping_requests SET snack_redeemed=1 WHERE request_no=? AND snack_redeemed=0 AND EXISTS(SELECT 1 FROM kk_members m WHERE m.id=shopping_requests.member_id AND m.miles>=30)").bind(no),
   db.prepare("INSERT INTO request_events(request_id,status,title_zh,title_en) SELECT id,status,?,? FROM shopping_requests WHERE request_no=?").bind(sellerReview?'賣家報價已接受，待付款':'客製訂單待賣家確認',sellerReview?'Seller quote accepted, payment pending':'Custom order awaiting seller confirmation',no),
   db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) SELECT member_id,?,request_no||?,?,request_no||?,id FROM shopping_requests WHERE request_no=?").bind(sellerReview?'已接受賣家報價，請回報付款':'客製訂單待賣家確認',sellerReview?' 已接受賣家查核的含代購費報價；請查看付款資訊，付款後回報，賣家核款後才進待買清單。':' 賣家將於 24 小時內確認，可能調整報價；確認前無須付款。',sellerReview?'Seller quote accepted, payment pending':'Custom order awaiting review',sellerReview?': Please view payment details and submit the payment report. Purchasing begins after seller payment verification.':': Seller review within 24 hours. No payment is due yet.',no)
  ]);
  if(sellerReview)await db.batch([db.prepare('UPDATE shopping_requests SET seller_reviewed_at=?,seller_review_due_at=NULL WHERE submission_key=? AND member_id=?').bind(sellerReview.reviewed_at,key,member.id),db.prepare("UPDATE kk_photo_inquiries SET state='purchased' WHERE draft_id=? AND member_id=? AND state='quoted'").bind(id,member.id)]);
  const order=await db.prepare('SELECT * FROM shopping_requests WHERE submission_key=? AND member_id=?').bind(key,member.id).first();
  if(!order)throw new ShopError('查價已取消或更新，未建立訂單。 / Quote changed or cancelled. No order created.',409);
  await deleteMedia(String(draft.image_key)).catch(()=>undefined);
  return privateJson({order:await orderBundle(order)},201);
 }
 throw new ShopError('不支援的操作。 / Unsupported action.');
}catch(e){return failure(e);}}

export async function GET(request:Request){try{
 const member=(await currentMember(request,true))!,id=new URL(request.url).searchParams.get('id')||'';
 const draft=await rawDb().prepare('SELECT * FROM kk_photo_drafts WHERE id=? AND member_id=?').bind(id,member.id).first();
 if(!draft)throw new ShopError('找不到此查價。 / Photo quote not found.',404);
 if(draft.state==='discarded'||String(draft.expires_at)<=new Date().toISOString())throw new ShopError('查價已取消或到期。 / Quote cancelled or expired.',410);
 if(draft.state==='identified'&&draft.analysis_json)return privateJson({id,state:'identified',analysis:JSON.parse(String(draft.analysis_json))});
 if(draft.state==='quoted'&&draft.analysis_json&&draft.pricing_json)return privateJson({id,state:'quoted',analysis:JSON.parse(String(draft.analysis_json)),pricing:JSON.parse(String(draft.pricing_json))});
 if(draft.state==='failed'){
  const detail=draft.analysis_json?JSON.parse(String(draft.analysis_json)):{};
  return privateJson({id,analysis:detail,reviewAvailable:true,error:typeof detail.photoResearchError==='string'?detail.photoResearchError:'AI 查價未完成；尚未建立訂單。 / Research failed. No order was created.',actualProviderModel:detail.photoResearchModel||null},detail.photoResearchStatus===422?422:503);
 }
 return privateJson({id,state:'pending'},202);
}catch(e){return failure(e);}}

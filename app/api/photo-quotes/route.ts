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

async function quoteDraft(draft:Record<string,unknown>,member:Member,a:ProductAnalysis){
 const country=String(draft.country) as Country,result=selectQuoteSource(a,country);
 if(result.kind!=='ready')throw new ShopError(quoteSourceMessage(result.kind,country),422);
 const {source,amount:net}=result,jpyRate=await exchange(),foreignRate=await currencyRate(source.currency||countries[country].currency,jpyRate),jpy=source.currency==='JPY'?Math.ceil(net):Math.ceil(net*foreignRate/jpyRate.rate);
 const pricing=await calculate(member,[{kind:'custom',quantity:Number(draft.quantity)||1,unitTwd:source.currency==='JPY'?jpy*jpyRate.rate:net*foreignRate,p:{id:0,nameZh:a.identifiedNameZh,nameEn:a.identifiedNameEn,categoryZh:a.category,categoryEn:a.category,descriptionZh:'',descriptionEn:'',priceJpy:jpy,imageKey:String(draft.image_key),status:'active',addon:false,allowedTiers:tiers,variants:[],sizeFeeTwd:0,stock:-1,purchaseUrl:source.url,sourceRequestId:null}}],'',{photoQuote:true});
 Object.assign(pricing.items[0],{sourceCountry:draft.country,sourceCurrency:source.currency,sourceAmount:net,sourceRateTwd:foreignRate,priceBasis:result.priceBasis,taxIncludedJpy:source.priceTaxIncludedJpy,taxFreeConditions:result.conditions,taxEvidenceUrl:source.taxEvidenceUrl});pricing.expiresAt=String(draft.expires_at);
 const saved=await rawDb().prepare("UPDATE kk_photo_drafts SET state='quoted',pricing_json=? WHERE id=? AND state IN ('identified','quoted') AND expires_at>?").bind(JSON.stringify(pricing),draft.id,new Date().toISOString()).run();
 if(!saved.meta.changes)throw new ShopError('查價已取消或到期。 / Quote cancelled or expired.',409);
 return pricing;
}

async function identifyAndQuote(draft:Record<string,unknown>,member:Member){
 const db=rawDb();
 if(draft.analysis_json){const analysis=JSON.parse(String(draft.analysis_json)) as ProductAnalysis;return{analysis,pricing:await quoteDraft(draft,member,analysis)};}
 if(!aiConfiguration(env).configured)throw new ShopError('AI 查價尚未啟用。 / AI pricing is not enabled.',409);
 const claimed=await db.prepare("UPDATE kk_photo_drafts SET state='analyzing' WHERE id=? AND state IN ('uploaded','failed')").bind(draft.id).run();
 if(!claimed.meta.changes)throw new ShopError('AI 正在辨識與查價，請稍候。 / AI is researching this item.',409);
 try{
  const image=await getMedia(String(draft.image_key));if(!image)throw new Error('Missing image');
  const {endpoint,model}=aiConnection(env);
  const analysis=await analyzeProductImage(image.bytes.buffer.slice(image.bytes.byteOffset,image.bytes.byteOffset+image.bytes.byteLength),String(draft.image_type),env.OPENAI_API_KEY||'netlify-gateway',model,String(draft.note),String(draft.country) as Country,endpoint,env.KK_AI_GATEWAY_URL?env.KK_AI_GATEWAY_SECRET||'':'');
  const saved=await db.prepare("UPDATE kk_photo_drafts SET state='identified',analysis_json=? WHERE id=? AND state='analyzing'").bind(JSON.stringify(analysis),draft.id).run();
  if(!saved.meta.changes)throw new ShopError('已取消此查價。 / Search cancelled.',410);
  return{analysis,pricing:await quoteDraft({...draft,analysis_json:JSON.stringify(analysis)},member,analysis)};
 }catch(e){await db.prepare("UPDATE kk_photo_drafts SET state='failed' WHERE id=? AND state='analyzing'").bind(draft.id).run();if(e instanceof ShopError)throw e;console.error('photo_quote_ai_failed',e);throw new ShopError('AI 查價服務暫時無法連線，請稍後重試；尚未建立訂單。 / The AI pricing service is temporarily unavailable. Retry later; no order was created.',503);}
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
  try{const result=await identifyAndQuote(draft!,member);return privateJson({id,state:'quoted',...result},201);}
  catch(e){await db.prepare('DELETE FROM kk_photo_drafts WHERE id=? AND member_id=?').bind(id,member.id).run();await deleteMedia(imageKey);throw e;}
 }
 const body=await request.json() as {id?:string;action?:string;approvedAt?:string;approvedTotal?:number;paymentMethod?:string;quantity?:number;shippingAddress?:unknown};
 const draft=await db.prepare('SELECT * FROM kk_photo_drafts WHERE id=? AND member_id=?').bind(String(body.id||''),member.id).first();
 if(!draft)throw new ShopError('找不到此查價。 / Photo quote not found.',404);
 const id=String(draft.id),now=new Date().toISOString();
 if(body.action==='buy'&&draft.order_id){const old=await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(draft.order_id).first();return privateJson({order:await orderBundle(old!)});}
 if(body.action==='discard'){
  const changed=await db.prepare("UPDATE kk_photo_drafts SET state='discarded',analysis_json=NULL,pricing_json=NULL,note='' WHERE id=? AND state!='purchased'").bind(id).run();
  if(changed.meta.changes)await deleteMedia(String(draft.image_key));
  return privateJson({ok:true});
 }
 if(draft.state==='discarded'||String(draft.expires_at)<=now)throw new ShopError('查價已失效，請重新上傳。 / Quote expired. Upload again.',410);
 enabledCountry(draft.country,(await settings()).enabledCountries);
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
  const method=paymentChoice(member,body.paymentMethod),due=null,address=shippingAddress(body.shippingAddress);
  if(pricing.tier!==member.tier)throw new ShopError('會員等級已更新，請重新查價。 / Membership changed. Refresh quote.',409);
  const publicKey='requests/'+id;await putMedia(publicKey,image.bytes,String(draft.image_type));
  const no=newOrderNumber(),key='photo-'+id,line=pricing.items[0];
  await db.batch([
   db.prepare("INSERT OR IGNORE INTO shopping_requests(request_no,submission_key,kind,member_id,customer_name,email,note,image_key,image_name,image_type,status,analysis_state,ai_analysis_json,identified_name_zh,identified_name_en,pricing_json,quote_json,payment_method,payment_due_at) SELECT ?,?,'custom',member_id,?,?,note,?,'photo',image_type,?,'ready',analysis_json,?,?,pricing_json,?,?,? FROM kk_photo_drafts WHERE id=? AND state='quoted' AND pricing_json=? AND expires_at>?").bind(no,key,member.name,member.email,publicKey,'admin_review',line.nameZh,line.nameEn,JSON.stringify(legacyQuote(pricing,line.nameZh,line.nameEn)),method,due,id,draft.pricing_json,now),
   db.prepare('UPDATE shopping_requests SET eta=?,eta_reason=?,purchase_at=?,cancel_until=?,eta_to=?,shipping_address_json=?,quantity=? WHERE request_no=?').bind(pricing.estimatedArrival||'',pricing.etaReason||'',pricing.purchaseAt||null,pricing.cancelUntil||null,pricing.estimatedArrivalTo||pricing.estimatedArrival||'',JSON.stringify(address),line.quantity,no),
   db.prepare("UPDATE kk_photo_drafts SET state='purchased',order_id=(SELECT id FROM shopping_requests WHERE submission_key=?) WHERE id=? AND EXISTS(SELECT 1 FROM shopping_requests WHERE submission_key=?)").bind(key,id,key),
   db.prepare("UPDATE shopping_requests SET snack_redeemed=1 WHERE request_no=? AND snack_redeemed=0 AND EXISTS(SELECT 1 FROM kk_members m WHERE m.id=shopping_requests.member_id AND m.miles>=30)").bind(no),
   db.prepare("INSERT INTO request_events(request_id,status,title_zh,title_en) SELECT id,status,'客製訂單待賣家確認','Custom order awaiting seller confirmation' FROM shopping_requests WHERE request_no=?").bind(no),
   db.prepare("INSERT INTO kk_messages(member_id,title,body,title_en,body_en,order_id) SELECT member_id,'客製訂單待賣家確認',request_no||' 賣家將於 24 小時內確認，可能調整報價；確認前無須付款。','Custom order awaiting review',request_no||': Seller review within 24 hours. No payment is due yet.',id FROM shopping_requests WHERE request_no=?").bind(no)
  ]);
  const order=await db.prepare('SELECT * FROM shopping_requests WHERE submission_key=? AND member_id=?').bind(key,member.id).first();
  if(!order)throw new ShopError('查價已取消或更新，未建立訂單。 / Quote changed or cancelled. No order created.',409);
  await deleteMedia(String(draft.image_key)).catch(()=>undefined);
  return privateJson({order:await orderBundle(order)},201);
 }
 throw new ShopError('不支援的操作。 / Unsupported action.');
}catch(e){return failure(e);}}

import {refundCredits,revokeRefundCredit} from '@/lib/refund-credits';
import {aiConfiguration} from '@/lib/ai-config';
import {procurement,proposeDefer,purchaseItems,orderItems} from '@/lib/item-fulfilment';
import {topups,confirmTopup} from '@/lib/topups';
import {emailConfigured,emailQueueSummary} from '@/lib/email-outbox';
import {advancePurchasing} from '@/lib/order-scheduler';
import {cancelOrder} from '@/lib/order-actions';
import {addOrderUpdate} from '@/lib/commerce';
import {supportedCurrencies} from '@/lib/currency-rate';
import {productCategories} from '@/lib/product-categories';
import {memberSelect} from '@/lib/commerce';
import {countries,validateWindow} from '@/lib/fulfilment';
import {settleRevision} from '@/lib/price-revisions';
import {runAnalysis} from '@/lib/run-analysis';
import {env} from 'cloudflare:workers';
import {isAdmin,privateJson} from '@/lib/admin-auth';
import {rawDb} from '@/lib/catalog';
import {addLedger,allOffers,orderBundle,parseMember,products,settings,exchange,ShopError} from '@/lib/commerce';
import {updateOrder,saveProduct} from '@/lib/commerce-admin';
import {tiers,type Offer,type Tier} from '@/lib/commerce-types';
import {failure} from '@/app/api/shop/route';

export async function GET(request:Request){if(!isAdmin(request))return privateJson({error:'請先登入管理後台。'},401);try{await advancePurchasing(rawDb(),new Date());const db=rawDb();const orders=(await db.prepare('SELECT * FROM shopping_requests ORDER BY id DESC LIMIT 500').all()).results;const members=(await db.prepare(memberSelect+' ORDER BY m.created_at DESC').all()).results.map(parseMember);const supportThreads=(await db.prepare(`SELECT m.id AS member_id,m.name,m.email,COALESCE(t.status,'human') AS status,COALESCE(t.needs_human,0) AS needs_human,COALESCE(t.ai_summary,'') AS ai_summary,COALESCE(t.unread_admin,0) AS unread_admin,COALESCE(t.unread_member,0) AS unread_member,COALESCE(t.updated_at,(SELECT MAX(created_at) FROM kk_conversations WHERE member_id=m.id)) AS updated_at,(SELECT body FROM kk_conversations WHERE member_id=m.id ORDER BY id DESC LIMIT 1) AS last_body FROM kk_members m LEFT JOIN kk_support_threads t ON t.member_id=m.id WHERE t.member_id IS NOT NULL OR EXISTS(SELECT 1 FROM kk_conversations c WHERE c.member_id=m.id) ORDER BY COALESCE(t.needs_human,0) DESC,updated_at DESC LIMIT 500`).all()).results;return privateJson({refundCredits:await refundCredits(),exchange:await exchange({preferCached:true}).catch(()=>null),procurement:await procurement(),topups:await topups(),products:await products(true),orders:await Promise.all(orders.map(orderBundle)),members,supportThreads,offers:await allOffers(),settings:await settings(),aiConfigured:aiConfiguration(env).configured,emailConfigured:emailConfigured(env),emailQueue:await emailQueueSummary(db)});}catch(e){return failure(e);}}
export async function POST(request:Request){if(!isAdmin(request))return privateJson({error:'請先登入管理後台。'},401);try{
 const b=await request.json() as Record<string,any>,db=rawDb();
 if(b.action==='revoke_refund_credit'){await revokeRefundCredit(String(b.memberId||''),String(b.key||''),String(b.reason||''));return privateJson({ok:true});}
 if(b.action==='refresh')return privateJson({ok:true});
 if(b.action==='defer_item'){await proposeDefer(Number(b.id),Number(b.lineIndex),String(b.date||''),String(b.reason||''));return privateJson({ok:true});}
 if(b.action==='purchase_items'){await purchaseItems(b.items);return privateJson({ok:true});}
 if(b.action==='status'&&b.status==='purchased'){const row=await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(Number(b.id)).first();if(!row)throw new ShopError('找不到訂單。',404);const items=await orderItems(row);await purchaseItems(items.filter(i=>i.status!=='cancelled').map(i=>({orderId:Number(b.id),lineIndex:i.lineIndex})));return privateJson({ok:true});}
 if(b.action==='confirm_topup'){await confirmTopup(String(b.id||''),String(b.reference||''));return privateJson({ok:true});}
 if(b.action==='cancel_order'){await cancelOrder(Number(b.id),null,String(b.reason||''),String(b.refundAccount||''),true);return privateJson({ok:true});}
 if(b.action==='exchange_review'){
  if(!['approved','rejected','completed'].includes(b.outcome)||!String(b.reason||'').trim())throw new ShopError('請選擇換貨處理結果並填寫說明。');
  const row=await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(Number(b.id)).first();
  if(!row||!(b.outcome==='completed'?row.exchange_status==='approved':row.exchange_status==='requested'))throw new ShopError('換貨狀態已更新。',409);
  const result=await db.prepare('UPDATE shopping_requests SET exchange_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND exchange_status=?').bind(b.outcome,row.id,row.exchange_status).run();
  if(!result.meta.changes)throw new ShopError('換貨已由其他管理員處理。',409);
  await addOrderUpdate(Number(row.id),String(row.member_id),'exchange_'+b.outcome,`換貨申請：${b.outcome==='approved'?'已核准':b.outcome==='rejected'?'未核准':'已完成'}`,`Exchange ${b.outcome}`,String(b.reason).slice(0,1000));return privateJson({ok:true});
 }
 if(b.action==='analyze'){try{return privateJson({ok:true,request:await runAnalysis(Number(b.id))});}catch(e){return privateJson({error:e instanceof Error?e.message:'AI 查價失敗。'},409);}}
 if(b.action==='settle_revision'){await settleRevision(String(b.id),String(b.reference||''));return privateJson({ok:true});}
 if(b.action==='product'||b.action==='publish'){const priceReviews=await saveProduct(b);return privateJson({ok:true,priceReviews});}
 if(['status','quote','eta','payment_state'].includes(b.action)){await updateOrder(b);return privateJson({ok:true});}
 if(b.action==='member'){
  const member=await db.prepare(memberSelect+' WHERE m.id=?').bind(String(b.id)).first();if(!member)throw new ShopError('找不到會員。');
  if(b.overrideTier!==undefined){if(b.overrideTier!==null&&!tiers.includes(b.overrideTier))throw new ShopError('會員等級無效。');await db.prepare('UPDATE kk_members SET override_tier=? WHERE id=?').bind(b.overrideTier,member.id).run();}
  if(b.delta!==undefined&&Number(b.delta)!==0){const delta=Number(b.delta),reason=String(b.reason||'').trim(),key=String(b.key||'');if(!Number.isInteger(delta)||Math.abs(delta)>100000||!reason||!/^[a-zA-Z0-9-]{20,80}$/.test(key))throw new ShopError('請填寫整數哩程與調整原因。');await addLedger('manual:'+key,String(member.id),null,delta,0,reason.slice(0,400));}
  return privateJson({ok:true});
 }
 if(b.action==='offer'){
  const rate=Number(b.rate??0),startsAt=String(b.startsAt||''),endsAt=b.permanent===true?'2099-12-31T23:59:59Z':String(b.endsAt||''),allowed=Array.isArray(b.tiers)?b.tiers.filter((t:Tier)=>tiers.includes(t)):[];
  if(!String(b.title||'').trim()||!allowed.length||!Number.isFinite(rate)||rate<0||rate>100||!Number.isFinite(Date.parse(startsAt))||!Number.isFinite(Date.parse(endsAt))||Date.parse(endsAt)<=Date.parse(startsAt))throw new ShopError('請檢查活動名稱、會員等級、費率與起訖時間。');
  const code=String(b.code||'').trim().toUpperCase();if(code&&!/^[A-Z0-9_-]{3,30}$/.test(code))throw new ShopError('優惠碼需 3–30 位英文或數字。');
  if(code){const old=await db.prepare('SELECT id FROM kk_offers WHERE code=? AND id!=?').bind(code,Number(b.id)||0).first();if(old)throw new ShopError('優惠碼已存在。');}
  const extra=validateOffer(b);
 const minMerchandiseTwd=Number(b.minMerchandiseTwd||0);
 if(!Number.isInteger(minMerchandiseTwd)||minMerchandiseTwd<0||minMerchandiseTwd>10000000)throw new ShopError('優惠最低商品消費額須為有效台幣整數。');
 const totalQuantity=Number(b.totalQuantity||0);if(!Number.isInteger(totalQuantity)||totalQuantity<0||totalQuantity>1000000)throw new ShopError('優惠券總量需為有效整數，0 為不限。');
 const memberId=String(b.memberId||'');if(memberId&&!await db.prepare('SELECT id FROM kk_members WHERE id=?').bind(memberId).first())throw new ShopError('指定會員不存在。');
 const data={...extra,minMerchandiseTwd,totalQuantity,memberId,visibility:b.visibility==='public'?'public':'private',permanent:b.permanent===true,title:String(b.title).slice(0,150),titleEn:String(b.titleEn||b.title).slice(0,150),rate,tiers:allowed,startsAt:new Date(startsAt).toISOString(),endsAt:new Date(endsAt).toISOString(),productId:Number(b.productId)||null};
  if(b.id)await db.prepare('UPDATE kk_offers SET data=?,code=?,active=? WHERE id=?').bind(JSON.stringify(data),code,b.active===false?0:1,Number(b.id)).run();else await db.prepare('INSERT INTO kk_offers (data,code,active) VALUES (?,?,?)').bind(JSON.stringify(data),code,b.active===false?0:1).run();return privateJson({ok:true});
 }
 if(b.action==='settings'){
  const rate=Number(b.manualRate)||0,shipping=Number(b.shippingTwd)||0;if(!['live','manual'].includes(b.rateMode)||b.rateMode==='manual'&&(rate<=0||rate>10)||shipping<0||shipping>100000)throw new ShopError('匯率或運費無效。');
  const previous=await settings();const arrivalWindow=b.arrivalWindow===undefined?previous.arrivalWindow:validateWindow(b.arrivalWindow);
  const opens=Date.parse(String(b.orderOpensAt||'')),closes=Date.parse(String(b.orderClosesAt||''));if(!Number.isFinite(opens)||!Number.isFinite(closes)||opens>=closes)throw new ShopError('請設定有效的開放下單與停止下單時間，結束必須晚於開始。');
  await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({...previous,...validateSettings(b),enabledCountries:['KR'],koreaPurchaseAt:b.purchaseAt||null,koreaPurchaseAtTo:b.purchaseAtTo||b.purchaseAt||null,orderOpensAt:new Date(opens).toISOString(),orderClosesAt:new Date(closes).toISOString(),arrivalWindow,rateCurrency:'KRW',rateMode:b.rateMode,manualRate:rate,shippingTwd:Math.ceil(shipping),paymentInstructions:String(b.paymentInstructions||'').slice(0,2000),updatedAt:new Date().toISOString()})).run();return privateJson({ok:true});
 }
 if(b.action==='audience'||b.action==='notify'){
  const members=(await db.prepare(memberSelect).all()).results.map(parseMember);let selected=members;
  const ids=Array.isArray(b.memberIds)?[...new Set(b.memberIds.map(String))]:b.memberId?[String(b.memberId)]:[];
  if(ids.length&&b.tier)throw new ShopError('指定會員與會員等級只能擇一。 / Choose members or a tier, not both.');
  if(b.audienceMode==='members'&&!ids.length)throw new ShopError('請至少選擇一位會員。 / Select at least one member.');
  if(b.audienceMode==='tier'&&!tiers.includes(b.tier))throw new ShopError('請選擇會員等級。 / Select a membership tier.');
  if(ids.some(id=>!members.some(m=>m.id===id)))throw new ShopError('所選會員已變更，請重新選擇。',409);
  if(ids.length)selected=selected.filter(m=>ids.includes(m.id));
  if(b.tier)selected=selected.filter(m=>m.tier===b.tier);
  if(b.productId||b.from||b.to){if(b.from&&!/^\d{4}-\d{2}-\d{2}$/.test(b.from)||b.to&&!/^\d{4}-\d{2}-\d{2}$/.test(b.to))throw new ShopError('日期格式無效。');const rows=(await db.prepare("SELECT member_id,pricing_json,paid_at FROM shopping_requests WHERE paid_at IS NOT NULL AND status NOT IN ('refunded','cancelled','rejected')").all()).results;const ids=new Set(rows.filter(r=>(!b.from||String(r.paid_at)>=b.from)&&(!b.to||String(r.paid_at)<new Date(Date.parse(b.to)+86400000).toISOString())&&(!b.productId||(JSON.parse(String(r.pricing_json||'{}')).items||[]).some((i:{productId:number})=>i.productId===Number(b.productId)))).map(r=>r.member_id));selected=selected.filter(m=>ids.has(m.id));}
  const audienceSignature=JSON.stringify(selected.map(m=>m.id).sort());
  if(b.action==='audience')return privateJson({audienceSignature,count:selected.length,members:selected.map(m=>({id:m.id,name:m.name,email:m.email}))});
  if(!String(b.title||'').trim()||!String(b.body||'').trim())throw new ShopError('請填寫通知標題及內容。');
  if(b.channel==='email')throw new ShopError('Email 寄送服務尚未連線，未寄出任何郵件。',409);
  if(Number(b.expectedCount)!==selected.length||b.audienceSignature!==audienceSignature)throw new ShopError('收件人已變動，請重新預覽。',409);
  if(selected.length>500)throw new ShopError('請縮小寄送範圍至 500 位會員以內。');
  if(selected.length)await db.batch(selected.map(m=>db.prepare('INSERT INTO kk_messages (member_id,title,body,title_en,body_en) VALUES (?,?,?,?,?)').bind(m.id,String(b.title).slice(0,180),String(b.body).slice(0,2000),String(b.titleEn||b.title).slice(0,180),String(b.bodyEn||b.body).slice(0,2000))));return privateJson({ok:true,count:selected.length});
 }
 throw new ShopError('不支援的操作。');
 }catch(e){return failure(e);}}

function validateOffer(b:Record<string,any>){
 const discountType=b.discountType||'fee_rate',globalOnly=String(discountType).startsWith('shipping_')||String(discountType).startsWith('order_'),scope=globalOnly?'all':b.scope||'all',value=Number(b.value||0),currency=String(b.currency||'TWD');
 const allowed=['fee_rate','percent','fixed','product_percent','product_fixed','shipping_free','shipping_percent','shipping_fixed','order_percent','order_fixed'];
 if(!['all','products','category'].includes(scope)||!allowed.includes(discountType))throw new ShopError('優惠類型或適用範圍無效。');
 const productIds=Array.isArray(b.productIds)?[...new Set(b.productIds.map(Number))]:[];
 if(scope==='products'&&(!productIds.length||productIds.length>100||productIds.some(n=>!Number.isInteger(n)||n<=0)))throw new ShopError('請選擇適用商品。');
 if(scope==='category'&&!productCategories.some(c=>c.zh===b.category))throw new ShopError('請選擇商品分類。');
 const percent=String(discountType).endsWith('_percent')||discountType==='percent',needsValue=!['fee_rate','shipping_free'].includes(discountType);
 if(needsValue&&(!Number.isFinite(value)||value<=0||value>(percent?100:1000000)))throw new ShopError('折扣數值無效。');
 if(!supportedCurrencies.includes(currency as typeof supportedCurrencies[number]))throw new ShopError('折抵幣別不支援。');
 return{scope,productIds,category:scope==='category'?String(b.category):'',discountType,value,currency};
}
function validateSettings(b:Record<string,any>){
 const extra:Record<string,any>={};
 if(b.fees!==undefined){for(const tier of tiers)for(const kind of ['catalog','custom'])if(typeof b.fees?.[tier]?.[kind]!=='number'||!Number.isFinite(b.fees[tier][kind])||b.fees[tier][kind]<0||b.fees[tier][kind]>100)throw new ShopError('各會員代購費須為 0–100%。');extra.fees=b.fees;}
 if(b.shippingByTier!==undefined){for(const tier of tiers)if(!Number.isInteger(b.shippingByTier?.[tier])||b.shippingByTier[tier]<0||b.shippingByTier[tier]>100000)throw new ShopError('請填寫各會員等級的有效運費。');extra.shippingByTier=b.shippingByTier;}
 if(b.purchaseAt!==undefined){if(b.purchaseAt&&!Number.isFinite(Date.parse(b.purchaseAt)))throw new ShopError('採買時間需晚於現在。');extra.purchaseAt=b.purchaseAt?new Date(b.purchaseAt).toISOString():null;}
 if(b.purchaseAtTo){const end=Date.parse(b.purchaseAtTo),start=Date.parse(b.purchaseAt||'');if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw new ShopError('採買區間結束不可早於開始。 / Purchase end must be at or after its start.');extra.purchaseAtTo=new Date(end).toISOString();}
 for(const key of ['shopPaused','photoQuotesPaused','remindersEnabled'])if(b[key]!==undefined){if(typeof b[key]!=='boolean')throw new ShopError('設定格式無效。');extra[key]=b[key];}
 for(const key of ['pauseMessage','bankName','bankCode','bankAccount','bankAccountName'])if(b[key]!==undefined)extra[key]=String(b[key]).trim().slice(0,key==='pauseMessage'?500:100);
 return extra;
}

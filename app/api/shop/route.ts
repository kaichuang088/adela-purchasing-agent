import {creditWithdrawals,requestCreditWithdrawal,resolveCreditWithdrawal} from '@/lib/credit-withdrawals';
import {topups,createTopup,reportTopup} from '@/lib/topups';
import {creditBalance,couponWallet,claimCoupon,urgentRemaining} from '@/lib/wallet';
import {advancePurchasing} from '@/lib/order-scheduler';
import {requireShopOpen} from '@/lib/commerce';
import {paymentChoice,transferDeadline,settleCreditOnly} from '@/lib/payments';
import {acceptRevision} from '@/lib/price-revisions';
import {rawDb,newOrderNumber} from '@/lib/catalog';
import {privateJson,isAdmin} from '@/lib/admin-auth';
import {addOrderUpdate,allOffers,exchange,calculate,currentMember,identity,legacyQuote,live,orderBundle,products,redeemSnack,settings,ShopError,memberForPhotoResearch} from '@/lib/commerce';
import type {Pricing} from '@/lib/commerce-types';
import {shippingAddress} from '@/lib/shipping-address';

export async function GET(request:Request){try{
 await advancePurchasing(rawDb(),new Date());
 // Unverified reference records remain available in admin; storefront lists approved products.
 const member=await currentMember(request),ps=await products(),os=await allOffers(),config=await settings();
 const orders=member?(await rawDb().prepare('SELECT * FROM shopping_requests WHERE member_id=? ORDER BY id DESC LIMIT 200').bind(member.id).all()).results:[];
 const messages=member?(await rawDb().prepare('SELECT * FROM kk_messages WHERE member_id=? ORDER BY id DESC LIMIT 100').bind(member.id).all()).results:[];
 const ledger=member?(await rawDb().prepare('SELECT * FROM kk_ledger WHERE member_id=? ORDER BY id DESC LIMIT 100').bind(member.id).all()).results:[];
 const thread=member?await rawDb().prepare('SELECT unread_member FROM kk_support_threads WHERE member_id=?').bind(member.id).first():null;
 const withinWindow=!!config.orderOpensAt&&!!config.orderClosesAt&&Date.now()>=Date.parse(config.orderOpensAt)&&Date.now()<Date.parse(config.orderClosesAt);
 return privateJson({creditWithdrawals:member?await creditWithdrawals(member.id):[],topups:member?await topups(member.id):[],wallet:member?await couponWallet(member):[],creditTwd:member?await creditBalance(member.id):0,urgentRemaining:await urgentRemaining(config.orderOpensAt+'|'+config.orderClosesAt),unreadChat:Number(thread?.unread_member)||0,fees:config.fees,shippingByTier:config.shippingByTier,shopPaused:config.shopPaused||!withinWindow,photoQuotesPaused:config.photoQuotesPaused,pauseMessage:config.shopPaused?config.pauseMessage:'韓國代購尚未開放或本期已截止下單；既有訂單仍可查詢。 / Korean orders are not currently open.',bank:{name:config.bankName,code:config.bankCode,account:config.bankAccount,accountName:config.bankAccountName},enabledCountries:config.enabledCountries,arrivalWindow:config.arrivalWindow,member,signedIn:!!(await identity(request)),products:ps,offers:os.filter(o=>live(o)&&!o.code&&(!o.memberId||o.memberId===member?.id)&&(!o.memberEmail||o.memberEmail===member?.email)),orders:await Promise.all(orders.map(orderBundle)),messages,ledger,paymentInstructions:config.paymentInstructions,exchange:await exchange({preferCached:true}).catch(()=>null)});
 }catch(e){return failure(e);}}
export function failure(e:unknown){console.error('shop',e);return privateJson({error:e instanceof ShopError?e.message:'操作暫時無法完成，請重試。 / Please try again.'},e instanceof ShopError?e.status:503);}
export async function POST(request:Request){try{
 const body=await request.json() as Record<string,any>,db=rawDb();
 if(body.action==='join'){
  const user=await identity(request);if(!user)throw new ShopError('請先登入。',401);
  const name=String(body.name||'').trim().slice(0,80);if(!name)throw new ShopError('請輸入姓名。');
  await db.batch([db.prepare('INSERT OR IGNORE INTO kk_members (id,name,email,miles) VALUES (?,?,?,5)').bind(user.id,name,user.email),db.prepare("INSERT OR IGNORE INTO kk_ledger (event_key,member_id,miles,reason) VALUES (?,?,5,'新會員禮 / Welcome miles')").bind('welcome:'+user.id,user.id)]);
  return privateJson({ok:true,member:await currentMember(request)});
 }
 const adminMemberId=request.headers.get('x-adela-order-member');
 if(adminMemberId&&(!isAdmin(request)||!['estimate','checkout'].includes(body.action)))throw new ShopError('代下單需要管理員授權。',401);
 const member=adminMemberId?await memberForPhotoResearch(adminMemberId):(await currentMember(request,true))!;
 if(!member)throw new ShopError('找不到會員。',404);
 if(body.action==='create_topup'){throw new ShopError('已停止販售儲值商品；既有餘額仍可使用或申請轉帳退款。',410);}
 if(body.action==='report_topup'){throw new ShopError('已停止新增儲值匯款；如曾付款請聯絡賣家處理。',410);}
 if(body.action==='request_credit_withdrawal'){return privateJson({ok:true,withdrawal:await requestCreditWithdrawal(member.id,body)});}
 if(body.action==='cancel_credit_withdrawal'){await resolveCreditWithdrawal(String(body.id||''),'cancelled','','',member.id);return privateJson({ok:true});}
 if(body.action==='claim_coupon'){await claimCoupon(member,String(body.code||''),body.offerId?Number(body.offerId):undefined);return privateJson({ok:true});}
 if(body.action==='price_revision'){await acceptRevision(String(body.id),member.id,body.accept===true);return privateJson({ok:true});}
 if(body.action==='read'){await db.prepare('UPDATE kk_messages SET read_at=? WHERE member_id=? AND read_at IS NULL').bind(new Date().toISOString(),member.id).run();return privateJson({ok:true});}
 if(body.action==='confirm_custom'){
  await requireShopOpen();
  const row=await db.prepare('SELECT * FROM shopping_requests WHERE id=? AND member_id=?').bind(Number(body.id),member.id).first();
  if(!row||!row.pricing_json||row.status!=='quoted')throw new ShopError('目前無法確認此報價。');
  const p=JSON.parse(String(row.pricing_json)) as Pricing;if(p.expiresAt&&Date.parse(p.expiresAt)<Date.now())throw new ShopError('報價已到期，請重新查價。');
  if(body.approvedTotal!==p.totalTwd||body.approvedAt!==p.pricedAt)throw new ShopError('報價剛剛已更新，請重新查看金額後確認。',409);
  const method=paymentChoice(member,body.paymentMethod),due=method==='transfer'?transferDeadline():null;
  const credit=Math.min(p.totalTwd,await creditBalance(member.id));const next={...p,beforeCreditTwd:p.beforeCreditTwd??p.totalTwd+(p.creditAppliedTwd||0),creditAppliedTwd:(p.creditAppliedTwd||0)+credit,totalTwd:p.totalTwd-credit};const token=crypto.randomUUID();
  const batch=[db.prepare("UPDATE shopping_requests SET status=?,payment_method=?,payment_due_at=?,purchase_at=?,cancel_until=?,pricing_json=?,updated_at=? WHERE id=? AND status='quoted' AND pricing_json=?").bind(method==='cod'?'awaiting_cod':'awaiting_payment',method,due,p.purchaseAt||null,p.cancelUntil||null,JSON.stringify(next),token,row.id,row.pricing_json)];
  if(credit)batch.push(db.prepare("INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) SELECT ?,member_id,request_no,?,'客製訂單購物金折抵' FROM shopping_requests WHERE id=? AND updated_at=?").bind('confirm-credit:'+row.request_no+':'+token,-credit,row.id,token));
  const result=await db.batch(batch);if(!result[0].meta.changes)throw new ShopError('報價已更新，請重新載入。',409);
  await db.prepare('UPDATE shopping_requests SET updated_at=? WHERE id=? AND updated_at=?').bind(new Date().toISOString(),row.id,token).run();await redeemSnack(Number(row.id),member.id);if(next.totalTwd===0)await settleCreditOnly(Number(row.id));await addOrderUpdate(Number(row.id),member.id,next.totalTwd===0?'paid':method==='cod'?'awaiting_cod':'awaiting_payment','已確認購買','Purchase confirmed');return privateJson({ok:true});
 }
 if(body.action==='payment_reference'){
  const ref=String(body.reference||'').trim();if(!/^\d{5}$/.test(ref))throw new ShopError('請填寫匯款帳號末五碼（5 位數字）。 / Enter the last five digits of the transfer account.');
  const reportedAt=new Date().toISOString();const result=await db.prepare("UPDATE shopping_requests SET payment_reference=?,payment_reported_at=?,status='payment_review',updated_at=? WHERE id=? AND member_id=? AND paid_at IS NULL AND payment_method='transfer' AND status IN ('awaiting_payment','payment_review')").bind(ref,reportedAt,reportedAt,Number(body.id),member.id).run();if(!result.meta.changes)throw new ShopError('此訂單目前不能回報匯款。 / This order cannot report a transfer.',409);await addOrderUpdate(Number(body.id),member.id,'payment_review','已回報匯款，等待核對','Transfer reported, awaiting verification');return privateJson({ok:true});
 }
 if(!['estimate','checkout'].includes(body.action))throw new ShopError('不支援的操作。');
 const key=String(body.submissionKey||'');
 if(body.action==='checkout'){
  if(!/^[a-zA-Z0-9-]{20,80}$/.test(key))throw new ShopError('請重新開啟結帳。');
  const old=await db.prepare('SELECT * FROM shopping_requests WHERE submission_key=?').bind(key).first();
  if(old){if(old.member_id!==member.id)throw new ShopError('訂單資料不符。',409);return privateJson({order:await orderBundle(old)});}
 }
 const cart=Array.isArray(body.items)?body.items:[];const all=await products();const seen=new Set<string>();
 const lines=cart.map((l:{productId:number;variantId?:string;quantity:number})=>{const source=all.find(p=>p.id===Number(l.productId));if(!source)throw new ShopError('商品已更新，請重新選擇。');const variantId=String(l.variantId||''),variant=source.variants.find(v=>v.id===variantId);if(source.variants.length&&!variant)throw new ShopError('請先選擇商品規格。 / Select a product option first.');if(variant?.stock===0)throw new ShopError('此口味目前供應商缺貨，請選擇其他口味。 / This flavor is currently sold out.',409);const key=source.id+':'+variantId;if(seen.has(key))throw new ShopError('購物車內有重複規格，請重新整理。');seen.add(key);const p=variant?{...source,purchaseUrl:variant.purchaseUrl||source.purchaseUrl,priceJpy:variant.priceJpy,taxIncludedJpy:variant.taxIncludedJpy,nameZh:source.nameZh+'・'+variant.labelZh,nameEn:source.nameEn+' · '+variant.labelEn,selectedVariantId:variant.id,selectedVariantLabelZh:variant.labelZh,selectedVariantLabelEn:variant.labelEn}:source;return{p,quantity:Number(l.quantity)};});
 if(adminMemberId&&(body.urgent||body.coupons?.length||body.coupon))throw new ShopError('代下單不使用優惠券、加急或既有購物金；付款由會員確認。',400);
 const pricing=await calculate(member,lines,Array.isArray(body.coupons)?body.coupons:String(body.coupon||''),{urgent:body.urgent===true,useCredit:!adminMemberId});
 if(body.action==='estimate')return privateJson({pricing,snack:member.miles>=30});
 if((body.approvedPurchaseAtTo||body.approvedPurchaseAt||null)!==(pricing.purchaseAtTo||pricing.purchaseAt)||(body.approvedPurchaseAt||null)!==pricing.purchaseAt||(body.approvedCancelUntil||null)!==pricing.cancelUntil)throw new ShopError('採買日期或取消期限已更新，請重新查看報價。 / Purchase schedule changed. Review the quote again.',409);
 // The customer explicitly approves the current price; reject a changed snapshot.
 if(Number(body.approvedTotal)!==pricing.totalTwd||String(body.approvedSignature)!==JSON.stringify(pricing.items))throw new ShopError('商品或費率已更新，請重新確認金額。',409);
 const method=paymentChoice(member,body.paymentMethod),due=method==='transfer'?transferDeadline():null;
 const address=shippingAddress(body.shippingAddress);
 const no=newOrderNumber(),name=pricing.items.map(l=>l.nameZh+' × '+l.quantity).join('、'),nameEn=pricing.items.map(l=>l.nameEn+' × '+l.quantity).join(', ');
 const statements=[db.prepare(`INSERT INTO shopping_requests (request_no,submission_key,kind,product_id,quantity,member_id,customer_name,email,note,image_key,image_name,image_type,status,analysis_state,identified_name_zh,identified_name_en,pricing_json,quote_json,payment_method,payment_due_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(no,key,'catalog',lines[0].p.id,pricing.items.reduce((a,l)=>a+l.quantity,0),member.id,member.name,member.email,String(body.note||'').slice(0,1200),lines[0].p.imageKey||'catalog-demo','商品照片','image/png',method==='cod'?'awaiting_cod':'awaiting_payment','not_required',name,nameEn,JSON.stringify(pricing),JSON.stringify(legacyQuote(pricing,name,nameEn)),method,due)];
 statements.push(db.prepare('UPDATE shopping_requests SET eta=?,eta_reason=?,purchase_at=?,cancel_until=?,shipping_address_json=?,urgent=?,eta_to=? WHERE request_no=?').bind(pricing.estimatedArrival||'',pricing.etaReason||'',pricing.purchaseAt||null,pricing.cancelUntil||null,JSON.stringify(address),pricing.urgent?1:0,pricing.estimatedArrivalTo||pricing.estimatedArrival||'',no));
 for(const code of pricing.coupons||[]){const offer=(await allOffers()).find(o=>o.code===code)!;statements.push(db.prepare('INSERT INTO kk_coupon_uses(id,offer_id,member_id,order_no) VALUES(?,?,?,?)').bind(offer.id+':'+member.id,offer.id,member.id,no));}
 // Reserve all variants of a product against the same stock in this atomic batch.
 const reservations=new Map<number,number>();for(const line of lines)reservations.set(line.p.id,(reservations.get(line.p.id)||0)+line.quantity);
 for(const [id,quantity] of reservations)statements.push(db.prepare("INSERT INTO kk_stock_reservations(order_no,product_id,quantity,debited) SELECT ?,id,?,CASE WHEN json_extract(commerce_json,'$.stock')>=0 THEN 1 ELSE 0 END FROM products WHERE id=?").bind(no,quantity,id));
 if(pricing.creditAppliedTwd)statements.push(db.prepare('INSERT INTO kk_wallet_entries(event_key,member_id,order_no,amount_twd,reason) VALUES(?,?,?,?,?)').bind('checkout:'+no,member.id,no,-pricing.creditAppliedTwd,'訂單自動折抵購物金'));
 if(pricing.urgent){const config=await settings();statements.push(db.prepare('INSERT INTO kk_urgent_orders(order_no,window_key) VALUES(?,?)').bind(no,config.orderOpensAt+'|'+config.orderClosesAt));}

 try{await db.batch(statements);}catch(e){const message=String(e);if(/STOCK_CHANGED/.test(message))throw new ShopError('商品庫存已更新，請重新選擇數量。',409);if(/URGENT_FULL/.test(message))throw new ShopError('本期 10 個加急名額已滿，請改一般配送。',409);if(/STORE_CREDIT_CHANGED/.test(message))throw new ShopError('購物金餘額已更新，請重新計算金額。',409);throw new ShopError('訂單或優惠券已更新，請重新計算金額。',409);}
 const row=await db.prepare('SELECT * FROM shopping_requests WHERE request_no=?').bind(no).first();if(!row)throw new ShopError('訂單建立失敗。',409);

 await redeemSnack(Number(row.id),member.id);if(pricing.totalTwd===0)await settleCreditOnly(Number(row.id));await addOrderUpdate(Number(row.id),member.id,pricing.totalTwd===0?'paid':method==='cod'?'awaiting_cod':'awaiting_payment','訂單已確認','Order created',no);return privateJson({order:await orderBundle((await db.prepare('SELECT * FROM shopping_requests WHERE id=?').bind(row.id).first())!)},201);
 }catch(e){return failure(e);}}

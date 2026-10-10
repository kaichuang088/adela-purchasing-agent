import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {realpathSync} from "node:fs";
import {readFile,readdir} from "node:fs/promises";
import {resolve} from "node:path";
import {randomUUID} from "node:crypto";
const require=createRequire(realpathSync(resolve("node_modules/wrangler/package.json")));
const {Miniflare}=require("miniflare"),password=randomUUID(),user={id:"member-test",email:"member@example.test"};
const names=(await readdir("dist/server",{recursive:true})).filter(p=>/\.m?js$/.test(p)&&p!=="index.js");
let exact=true,aiCalls=0,market='KR',eligible=true;
const fakeSource="https://retailer.example.test/item";
const mf=new Miniflare({modules:["index.js",...names].map(p=>({type:"ESModule",path:resolve("dist/server",p)})),modulesRoot:resolve("dist/server"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:["DB"],bindings:{ADMIN_PASSWORD:password,OPENAI_API_KEY:'test-only-not-a-real-key',KK_AI_GATEWAY_SECRET:'isolated-stale-secret'},outboundService:async(request)=>{
 assert.equal(new URL(request.url).hostname,'api.openai.com');assert.equal(request.headers.get('Authorization'),'Bearer test-only-not-a-real-key');assert.equal(request.headers.get('X-KK-AI-Gateway-Secret'),null);const payload=await request.json();assert.ok(payload.input[0].content.some(c=>c.type==='input_image'));assert.ok(payload.tools.some(t=>t.type==='web_search'));aiCalls++;
 const result={identifiedNameZh:'測試相機',identifiedNameEn:'Test camera',brand:'Test',model:'A1',category:'Camera',confidence:exact?.99:.4,taxRatePercent:market==='JP'?10:0,evidenceSummaryZh:'合成測試來源，非真實商家報價',evidenceSummaryEn:'Synthetic test source, not a live quote',sources:[{storeName:'Test retailer',url:fakeSource,localCountry:market,currency:market==='JP'?'JPY':'KRW',originalPrice:market==='JP'?2000:22000,afterTaxPrice:market==='JP'?1800:20000,localJapan:market==='JP',taxFreeForResale:eligible,taxFreeConditions:'Synthetic test export eligibility',taxEvidenceUrl:fakeSource,priceTaxIncludedJpy:2000,priceTaxFreeJpy:1800,taxFreeEligible:true,capturedAt:new Date().toISOString(),note:'Test only',exactMatch:exact,inStock:true}]};
 return new Response(JSON.stringify({output:[{type:'web_search_call',action:{sources:[{url:fakeSource}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]}),{headers:{'Content-Type':'application/json'}});
},assets:{directory:resolve("dist/client"),binding:"ASSETS",routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let count=0;function ok(value,label){assert.ok(value,label);console.log(`PASS ${++count}: ${label}`);}
async function call(path,{method="GET",body,admin=false,auth=false,status=200}={}){const headers={};if(admin)headers["X-KK-Admin-Password"]=password;if(auth){headers["oai-authenticated-user-id"]=user.id;headers["oai-authenticated-user-email"]=user.email;}let payload;if(body instanceof FormData){const r=new Request("https://test",{method:"POST",body});headers["Content-Type"]=r.headers.get("content-type");payload=new Uint8Array(await r.arrayBuffer());}else if(body!==undefined){headers["Content-Type"]="application/json";payload=JSON.stringify(body);}const r=await mf.dispatchFetch("https://kk.test"+path,{method,headers,body:payload}),text=await r.text();assert.equal(r.status,status,`${path}: ${text.slice(0,700)}`);return text?JSON.parse(text):{};}
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await call('/api/shop',{method:'POST',auth:true,body:{action:'join',name:'Photo Member'}});
 await call('/api/operations',{method:'POST',admin:true,body:{action:'settings',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString(),shippingTwd:0,shippingByTier:{standard:0,platinum:0,black:0,diamond:0},paymentInstructions:'Test only'}});
 await db.prepare('UPDATE kk_members SET miles=35 WHERE id=?').bind('siwc:'+user.id).run();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH1sAAAAASUVORK5CYII=','base64');
 async function upload(country='KR',status=201){const f=new FormData();f.set('country',country);f.set('note','A1 model');f.set('image',new File([png],'test.png',{type:'image/png'}));return call('/api/photo-quotes',{method:'POST',auth:true,body:f,status});}
 const draft=await upload();ok(!!draft.id&&!draft.request&&draft.state==='quoted'&&draft.analysis.identifiedNameZh==='測試相機'&&draft.pricing.totalTwd===600&&draft.pricing.items[0].originalJpy===20000&&aiCalls===1,'上傳依模擬韓國來源完成 KRW 報價，且沒有建立單號');
 let admin=await call('/api/operations',{admin:true}),shop=await call('/api/shop',{auth:true});ok(admin.orders.length===0&&shop.orders.length===0&&shop.member.miles===35,'上傳後後台及會員訂單為空，不扣里程');
 await call('/api/photo-quotes',{method:'POST',body:{id:draft.id,action:'identify'},status:401});
 await db.prepare("INSERT INTO kk_members(id,name,email) VALUES('siwc:other','Other','other@example.test')").run();
 const owner=user.id;user.id='other';await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:draft.id,action:'identify'},status:404});user.id=owner;
 const media=await mf.dispatchFetch('https://kk.test/api/media/quote-drafts/'+draft.id);ok(media.status===404,'他人不能辨識此照片，私人照片不能透過公開圖片網址讀取');
 const identified=await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:draft.id,action:'identify'}});ok(identified.analysis.identifiedNameZh==='測試相機'&&identified.pricing.totalTwd===600&&aiCalls===1,'重讀已完成的自動 AI 報價不會再次呼叫模型');
 await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:draft.id,action:'buy'},status:409});
 const q=await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:draft.id,action:'confirm_product'}});ok(q.pricing.items[0].feeRate===10&&q.pricing.totalTwd===600,'韓國報價使用有憑據的退稅金額，客製費 10% 與運費 50 元');
 admin=await call('/api/operations',{admin:true});ok(admin.orders.length===0,'看過報價仍不會進入後台');
 await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:draft.id,action:'discard'}});
 const discardedMedia=await db.prepare('SELECT COUNT(*) AS n FROM kk_media WHERE key=?').bind('quote-drafts/'+draft.id).first();ok(Number(discardedMedia.n)===0,'取消查價會刪除 D1 暫存照片');
 await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:draft.id,action:'buy'},status:410});shop=await call('/api/shop',{auth:true});ok(shop.orders.length===0&&shop.member.miles===35,'選擇不買：沒有訂單且里程不變');
 const d2=await upload();const p2=await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:d2.id,action:'confirm_product'}});
 await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:d2.id,action:'buy',approvedTotal:1,approvedAt:p2.pricing.pricedAt},status:409});
 const address={recipient:'測試',phone:'0912345678',postalCode:'100',street:'台北市測試路 1 號'};
 const payload={shippingAddress:address,id:d2.id,action:'buy',approvedTotal:p2.pricing.totalTwd,approvedAt:p2.pricing.pricedAt};const bought=await call('/api/photo-quotes',{method:'POST',auth:true,body:payload,status:201});const repeat=await call('/api/photo-quotes',{method:'POST',auth:true,body:payload});
 shop=await call('/api/shop',{auth:true});admin=await call('/api/operations',{admin:true});ok(bought.order.requestNo===repeat.order.requestNo&&shop.orders.length===1&&admin.orders.length===1&&bought.order.status==='admin_review'&&!bought.order.paymentDueAt,'確認購買產生唯一單號與待賣家審核訂單，重送不重複');
 const privateAfterBuy=await db.prepare('SELECT COUNT(*) AS n FROM kk_media WHERE key=?').bind('quote-drafts/'+d2.id).first(),publicAfterBuy=await db.prepare('SELECT COUNT(*) AS n FROM kk_media WHERE key=?').bind('requests/'+d2.id).first();ok(Number(privateAfterBuy.n)===0&&Number(publicAfterBuy.n)===1,'建立訂單後保留商品圖並刪除私人查價暫存');
 ok(shop.member.miles===5&&bought.order.snackRedeemed&&shop.member.spendKrw===0&&shop.member.spendJpy===0,'確認購買才扣 30 點附贈零食，未付款不累積消費');
 exact=false;await upload('KR',422);ok(true,'不確定或不符規格的商品不會產生可購買的假報價');
 exact=true;const d3=await upload();
 await db.prepare('UPDATE kk_photo_drafts SET expires_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z',d3.id).run();await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:d3.id,action:'confirm_product'},status:410});ok(true,'過期報價不可購買');
 const cleanupTrigger=await upload();const staleDraft=await db.prepare('SELECT COUNT(*) AS n FROM kk_photo_drafts WHERE id=?').bind(d3.id).first(),staleMedia=await db.prepare('SELECT COUNT(*) AS n FROM kk_media WHERE key=?').bind('quote-drafts/'+d3.id).first();ok(!!cleanupTrigger.id&&Number(staleDraft.n)===0&&Number(staleMedia.n)===0,'下次查價會清理過期草稿與 D1 暫存照片');
 await call('/api/photo-quotes',{method:'POST',auth:true,body:{id:cleanupTrigger.id,action:'discard'}});

 exact=true;await upload('JP',403);ok(true,'目前僅開放韓國，日本上傳由伺服器拒絕');
 const configure=shopPaused=>call('/api/operations',{method:'POST',admin:true,body:{action:'settings',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString(),shippingTwd:50,paymentInstructions:'Test',enabledCountries:['KR'],shopPaused}});
 await call('/api/operations',{method:'POST',admin:true,body:{action:'member',id:'siwc:'+user.id,overrideTier:'diamond',reason:'Country fee test'}});
 const d4=await upload('KR'),kr=d4;ok(kr.pricing.items[0].sourceCurrency==='KRW'&&kr.pricing.totalTwd===500&&kr.pricing.feeTwd===0&&kr.pricing.shippingTwd===0,'韓國 KRW 報價按已核對的匯率換算，金鑽免代購費及運費');
 const krBuy={shippingAddress:address,id:d4.id,action:'buy',approvedTotal:kr.pricing.totalTwd,approvedAt:kr.pricing.pricedAt,paymentMethod:'cod'};
 await configure(true);await call('/api/photo-quotes',{method:'POST',auth:true,body:krBuy,status:409});ok(true,'暫停下單後既有草稿也不能繼續購買');
 await configure(false);const cod=await call('/api/photo-quotes',{method:'POST',auth:true,body:krBuy,status:201});ok(cod.order.status==='admin_review'&&cod.order.paymentMethod==='cod'&&!cod.order.paidAt&&!cod.order.paymentDueAt,'金鑽 AI 貨到付款仍待賣家審核，不能自動標記收款');
 eligible=false;const taxed=await upload('KR');ok(taxed.pricing.items[0].priceBasis==='local_tax_included'&&taxed.pricing.items[0].sourceAmount===22000,'無退稅證明時使用當地商家含稅現價，不編造退稅');
 market='JP';await upload('KR',422);ok(true,'韓國查價不能使用日本來源產生訂單');
 console.log(`${count} photo flow checks passed (D1 media fallback; no R2 binding; mock AI; not a live provider test)`);
}finally{await mf.dispose();}

// Actual Chromium viewport QA against the compiled app and disposable D1.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const {chromium}=await import(process.env.ADELA_PLAYWRIGHT_MODULE||'playwright');
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const files=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)),password=randomUUID();
const mf=new Miniflare({host:'127.0.0.1',port:0,modules:['index.js',...files.filter(p=>p!=='index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PASSWORD:password},assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:false}},cf:false});
const browser=await chromium.launch({executablePath:process.env.ADELA_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[],screens=[];let actor='r18-browser';
await mkdir('verification/r18-mobile',{recursive:true});
async function request(path,body){const r=await mf.dispatchFetch('https://adela.test'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-KK-Admin-Password':password,'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,200,JSON.stringify(json));return json;}
async function inspect(page,width,label){
 await page.waitForTimeout(700);
 const measurement=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,document:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&(r.left<-1||r.right>innerWidth+1)&&s.position!=='fixed';}).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,rect:JSON.stringify(e.getBoundingClientRect().toJSON())}))}));
 const clippedControls=await page.evaluate(()=>[...document.querySelectorAll('button,input,select,textarea,a')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(s.visibility==='hidden'||r.width===0||r.bottom<0||r.top>innerHeight||r.left>=-1&&r.right<=innerWidth+1)return false;for(let p=e.parentElement;p;p=p.parentElement)if(['auto','scroll'].includes(getComputedStyle(p).overflowX)&&p.scrollWidth>p.clientWidth)return false;return true;}).map(e=>({tag:e.tagName,text:(e.textContent||e.getAttribute('aria-label')||'').slice(0,60)})));measurement.clippedControls=clippedControls;
 const name=`verification/r18-mobile/${width}-${label}.png`;await page.screenshot({path:name,fullPage:false});screens.push(name);
 const dialogs=await page.getByRole('dialog').evaluateAll(nodes=>nodes.filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth};}));measurement.dialogs=dialogs;
 const ok=measurement.body<=width+1&&measurement.document<=width+1&&clippedControls.length===0&&dialogs.every(d=>d.left>=-1&&d.right<=width+1&&d.scrollWidth<=d.clientWidth+1);
 results.push({width,label,ok,...measurement});console.log(ok?'PASS':'FAIL',width,label,JSON.stringify(measurement));
}
try{
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO store_settings(key,value) VALUES('commerce_settings',?)").bind(JSON.stringify({rateCurrency:'KRW',rateMode:'manual',manualRate:.025,orderOpensAt:new Date(Date.now()-86400000).toISOString(),orderClosesAt:new Date(Date.now()+86400000).toISOString(),bankName:'隔離測試銀行',bankCode:'000',bankAccount:'TEST-NOT-PAYABLE',bankAccountName:'隔離測試，請勿匯款'})).run();
 await request('/api/shop',{action:'join',name:'隔離測試會員'});
 await request('/api/shop');
 const date=new Date().toISOString(),fixture={action:'product',nameZh:'手機檢查商品',nameEn:'Mobile QA fixture',categoryZh:'韓國香氛',spec:'50mL × 1',taiwanRetailSpec:'50mL × 1',taiwanRetailTwd:1000,taiwanRetailSource:'https://www.momoshop.com.tw/isolated-fixture',taiwanReferenceConfirmed:true,taiwanRetailClassification:'regular',sourceCheckedAt:date,sourceDeliveryConfirmed:true,sourceDeliveryKrw:0,sourceDeliveryConditions:'isolated fixture: no delivery',originalJpy:30000,purchaseUrl:'https://www.ssg.com/isolated-fixture',imageUrl:'/catalog-r8/lelabo-deodorant50.jpg',stock:-1,sizeFeeTwd:0,serviceFeePercent:0,status:'active',variants:[]};
 await request('/api/operations',fixture);
 const base=String(await mf.ready).replace(/\/$/,'');
 for(const width of [375,390,430]){
  actor='r18-browser-'+width;await request('/api/shop',{action:'join',name:'隔離測試會員 '+width});
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'oai-authenticated-user-id':actor,'oai-authenticated-user-email':actor+'@example.test'}});
  await context.addInitScript(({password})=>sessionStorage.setItem('kk-admin-session',password),{password});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('#kk-topup-products h2').waitFor();await inspect(page,width,'shop');
  await page.getByRole('button',{name:'查看儲值 NT$2,000 商品',exact:true}).click();await page.getByRole('dialog').waitFor();await inspect(page,width,'topup-detail');
  await page.getByRole('button',{name:'建立儲值申請，前往匯款'}).click();await page.getByText('儲值申請已建立',{exact:true}).waitFor();await inspect(page,width,'topup-payment');
  await page.getByPlaceholder('匯款帳號末五碼').fill('12345');await page.getByRole('button',{name:'回報已匯款'}).click();await page.getByText('待核對',{exact:true}).waitFor();await inspect(page,width,'topup-reported');
  await page.getByRole('button',{name:'查看我的儲值紀錄'}).click();await page.getByText('儲值紀錄',{exact:true}).waitFor();await inspect(page,width,'member-history');
  await page.locator('.kk-mobile-nav').getByRole('button',{name:'首頁'}).click();
  const state=await request('/api/shop'),orion=state.products.find(p=>/Orion 剝皮果實/.test(p.nameZh));assert.ok(orion&&orion.variants.length>=2);
  await page.getByRole('button',{name:orion.nameZh,exact:true}).click();const choice=page.getByRole('dialog').locator('select').first();
  await choice.selectOption(orion.variants[0].id);const photoA=await page.locator('.kk-detail-picture img').getAttribute('src');await inspect(page,width,'variant-photo-a');
  await choice.selectOption(orion.variants[1].id);const photoB=await page.locator('.kk-detail-picture img').getAttribute('src');assert.notEqual(photoA,photoB,'Option switching must change the photo');await inspect(page,width,'variant-photo-b');results.push({width,label:'variant-photo-switch',ok:photoA!==photoB,photoA,photoB});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'手機檢查商品',exact:true}).click();await page.getByRole('dialog').waitFor();await inspect(page,width,'product-detail');
  await page.getByRole('button',{name:/加入購物車/}).last().click();await page.getByRole('dialog').waitFor({state:'hidden'}).catch(()=>{});
  await page.locator('.kk-header-actions').getByRole('button',{name:/購物車/}).click();await page.getByRole('dialog').waitFor();await inspect(page,width,'cart-address-payment');
  await page.getByRole('button',{name:'計算台幣金額',exact:true}).click();await page.getByRole('button',{name:'繼續結帳',exact:true}).click();await page.getByLabel('收件人',{exact:true}).fill('隔離測試收件人');await page.getByLabel('手機',{exact:true}).fill('0912345678');await page.getByLabel('郵遞區號',{exact:true}).fill('100');await page.getByLabel('完整地址',{exact:true}).fill('隔離測試地址，無真實配送');await inspect(page,width,'checkout-address');
  await page.getByRole('button',{name:'確認金額並下單',exact:true}).click();await page.getByRole('button',{name:'我已付款',exact:true}).waitFor();await inspect(page,width,'checkout-success');await page.getByRole('button',{name:'我已付款',exact:true}).click();await inspect(page,width,'payment-report-form');await page.keyboard.press('Escape');
  await page.locator('.kk-mobile-nav').getByRole('button',{name:/訊息/}).click();await inspect(page,width,'customer-support');await page.locator('.kk-mobile-nav').getByRole('button',{name:/通知/}).click();await inspect(page,width,'notifications');
  await page.goto(base+'/admin',{waitUntil:'networkidle'});await page.locator('.op-shell').waitFor();await inspect(page,width,'admin-orders-topups');await page.locator('.kk-topup-admin summary').click();await inspect(page,width,'admin-topup-reconcile');await page.getByPlaceholder('銀行入帳核對紀錄').first().fill('隔離測試核款，不涉及真實資金');await page.getByRole('button',{name:'確認入帳',exact:true}).first().click();await page.locator('.kk-topup-admin').waitFor({state:'hidden'});await inspect(page,width,'admin-topup-confirmed');
  await page.locator('.op-shell nav').getByRole('button',{name:/通知/}).click();await inspect(page,width,'admin-notifications');
  await page.locator('.op-shell nav').getByRole('button',{name:'商品',exact:true}).click();await page.locator('.op-card-grid').waitFor();await inspect(page,width,'admin-products');
  await page.getByRole('button',{name:/新增商品/}).first().click();await page.getByRole('dialog').waitFor();await page.getByRole('dialog').locator('.op-price-check').scrollIntoViewIfNeeded();await inspect(page,width,'admin-edit-price-warning');await page.getByRole('button',{name:'AI 協助新增／編輯',exact:true}).click();await page.getByRole('dialog').locator('.op-price-check').scrollIntoViewIfNeeded();await inspect(page,width,'admin-ai-edit-price-warning');
  await page.keyboard.press('Escape');await page.locator('.op-shell nav').getByRole('button',{name:'更多',exact:true}).click();await inspect(page,width,'admin-navigation');
  const menuNames=await page.locator('.op-more-grid button').allTextContents();
  for(const name of menuNames.filter(s=>/會員|AI|優惠|設定/.test(s))){await page.locator('.op-more-grid button').filter({hasText:name.trim()}).click();await inspect(page,width,'admin-'+(/會員/.test(name)?'members-refund':/AI/.test(name)?'ai-batch':/優惠/.test(name)?'coupons':'settings'));await page.locator('.op-shell nav').getByRole('button',{name:'更多',exact:true}).click();}
  results.push({width,label:'browser-errors',ok:!errors.length,errors});await context.close();
 }
 await writeFile('verification/r18-mobile-results.json',JSON.stringify({engine:'Chromium',scope:'Real browser at CSS viewport widths 375/390/430 on compiled local app with isolated D1; not physical-device push or live Sites',results,screens},null,2));
 assert.ok(results.every(r=>r.ok),'Mobile checks have failures; see screenshots and report');
}finally{await writeFile('verification/r18-mobile-results.json',JSON.stringify({engine:'Chromium',scope:'Actual compiled local app at 375/390/430; isolated data, not physical phone or live Sites',results,screens},null,2));await browser.close();await mf.dispose();}

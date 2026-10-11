// Real Chromium against the compiled admin HTML; isolated synthetic API only.
// No live member data, financial writes, provider calls or physical-device test.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import(process.env.ADELA_PLAYWRIGHT_MODULE||'playwright');
const root=resolve('netlify-admin-dist'),out=resolve('verification/netlify-admin');
await mkdir(out,{recursive:true});
assert.deepEqual(await readFile(resolve(root,'index.html')),await readFile(resolve(root,'admin/index.html')));
const redirects=await readFile(resolve(root,'_redirects'),'utf8');
assert.ok(redirects.includes('/ /admin/index.html 200')&&redirects.includes('/admin/* /admin/index.html 200'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const rel=url.pathname==='/'||url.pathname==='/admin'?'index.html':decodeURIComponent(url.pathname).slice(1);
  const file=resolve(root,rel);if(!file.startsWith(root+'/')){res.writeHead(404);res.end();return;}
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const data=()=>({exchange:{rate:.025},topups:[],refundCredits:[],creditWithdrawals:[],procurement:[],products:[],orders:[],members:[],supportThreads:[],offers:[],settings:{enabledCountries:['KR'],arrivalWindow:null,rateMode:'manual',manualRate:.025,shippingTwd:50,paymentInstructions:'隔離測試，請勿匯款'},aiConfigured:false,emailConfigured:false,emailQueue:{}});
const results=[];
async function inspect(page,width,label){
 await page.waitForTimeout(200);
 const metrics=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,document:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('[role="dialog"]')].filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth};})}));
 const ok=metrics.body<=width+1&&metrics.document<=width+1&&metrics.dialogs.every(d=>d.left>=-1&&d.right<=width+1&&d.scrollWidth<=d.clientWidth+1);
 const screenshot=`${width}-${label}.png`;await page.screenshot({path:resolve(out,screenshot),fullPage:false});
 results.push({width,label,ok,...metrics,screenshot});assert.ok(ok,JSON.stringify(results.at(-1)));
}
try{
 for(const width of [375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   assert.equal(route.request().method(),'GET','This visual check must not submit writes or call a provider');
   const path=new URL(route.request().url()).pathname;
   const response=path==='/api/operations'?data():path==='/api/system/status'?{release:'Isolated QA',backendId:'isolated-only',databaseReady:true,missingTables:[],aiConfigured:false,aiMissingConfiguration:['Provider not tested in visual fixture'],aiModel:null,pushConfigured:false,emailConfigured:false,lastScheduledAt:null}:{messages:[],notifications:[],unread:0,configured:false,publicKey:null,subscriptions:[],items:[],queue:{}};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto(base,{waitUntil:'networkidle'});
  assert.ok((await page.title()).includes("Adela's Purchasing Agent"));
  await inspect(page,width,'login');
  await page.getByLabel('管理員密碼',{exact:true}).fill('ISOLATED-QA-NOT-A-REAL-PASSWORD');
  await page.getByRole('button',{name:'進入管理後台',exact:true}).click();
  await page.locator('.op-shell').waitFor();
  await page.locator('[data-sonner-toast]').waitFor({state:'hidden',timeout:7000});
  const front=page.locator('.op-main header a[href="https://adela-purchasing-agent-shop.netlify.app"]');
  assert.equal(await front.count(),1,'Admin must link to the Adela storefront');
  await inspect(page,width,'orders');
  for(const [name,label] of [['商品','products'],['訊息','messages'],['通知','notifications']]){
   await page.locator('.op-shell nav').getByRole('button',{name,exact:true}).click();
   await inspect(page,width,label);
  }
  await page.locator('.op-shell nav').getByRole('button',{name:'商品',exact:true}).click();
  await page.getByRole('button',{name:'新增商品',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await inspect(page,width,'product-editor');
  assert.equal(await page.getByRole('region',{name:'商品價差檢查'}).count(),1);
  await page.getByRole('button',{name:'AI 協助新增／編輯',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'AI 填入商品草稿',exact:true}).isEnabled(),false);
  await inspect(page,width,'ai-editor-unconfigured');
  await page.getByRole('button',{name:'手動新增／編輯',exact:true}).click();
  const priceReview=page.getByRole('region',{name:'商品價差檢查'});
  await priceReview.scrollIntoViewIfNeeded();
  assert.ok((await priceReview.innerText()).includes('缺少：'),'Missing evidence must not be marked compliant');
  await inspect(page,width,'price-warning');
  const save=page.getByRole('button',{name:'儲存商品',exact:true});
  await save.scrollIntoViewIfNeeded();
  const bounds=await save.boundingBox();
  assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=844,'Save must remain reachable inside the editor');
  await inspect(page,width,'product-save-visible');
  await page.keyboard.press('Escape');
  for(const [name,label] of [['AI 管理','ai'],['會員','members'],['優惠','offers'],['設定','settings'],['尚未採買','procurement']]){
   await page.locator('.op-shell nav').getByRole('button',{name:'更多',exact:true}).click();
   if(label==='ai')await inspect(page,width,'more-navigation');
   await page.locator('.op-more-grid').getByRole('button',{name,exact:true}).click();
   await inspect(page,width,label);
  }
  assert.deepEqual(errors,[],`Admin browser errors: ${JSON.stringify(errors)}`);
  await context.close();
 }
 await writeFile(resolve(out,'results.json'),JSON.stringify({scope:'Compiled Netlify admin; synthetic API; Chromium viewports; no live backend, actual AI provider, financial writes or physical mobile device validation',browserChecks:results.length,results},null,2)+'\n');
 console.log(`PASS: ${results.length} compiled-admin viewport checks; synthetic API only.`);
}finally{await browser.close();await new Promise(r=>server.close(r));}

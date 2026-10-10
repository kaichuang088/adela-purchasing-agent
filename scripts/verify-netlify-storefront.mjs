// Chromium checks of the generated Netlify storefront, using synthetic API data.
// Does not verify live backend, bank transfers, AI, or physical mobile devices.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import(process.env.ADELA_PLAYWRIGHT_MODULE||'playwright');
const root=resolve('netlify-dist'),out=resolve('verification/netlify-r20');
await mkdir(out,{recursive:true});
assert.equal(await stat(resolve(root,'admin/index.html')).then(()=>true,()=>false),false);
const redirects=await readFile(resolve(root,'_redirects'),'utf8');
assert.ok(redirects.includes('/admin /404.html 404!')&&redirects.includes('/admin/* /404.html 404!'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),admin=/^\/admin(?:\/|$)/.test(url.pathname);
  const rel=admin?'404.html':url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
  const file=resolve(root,rel);if(!file.startsWith(root+'/')){res.writeHead(404);res.end();return;}
  const bytes=await readFile(file);res.writeHead(admin?404:200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
assert.equal((await fetch(base+'/admin')).status,404);
assert.equal((await fetch(base+'/admin/orders')).status,404);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
const makeData=()=>({creditWithdrawals:[],topups:[],wallet:[],creditTwd:2160,urgentRemaining:0,
 fees:{standard:{catalog:12,custom:15},platinum:{catalog:10,custom:12},black:{catalog:8,custom:10},diamond:{catalog:6,custom:8}},
 shopPaused:false,photoQuotesPaused:true,pauseMessage:'',unreadChat:0,
 bank:{name:'隔離測試銀行，請勿匯款',code:'000',account:'TEST-NOT-PAYABLE',accountName:'隔離測試'},
 enabledCountries:['KR'],arrivalWindow:null,shippingByTier:{standard:50,platinum:50,black:50,diamond:50},
 member:{id:'netlify-qa-only',name:'隔離測試會員',email:'netlify-qa@example.test',spendJpy:0,spendKrw:0,miles:0,tier:'standard',overrideTier:null,paidItems:0,paidOrders:0},
 signedIn:true,products:[],orders:[],offers:[],messages:[],ledger:[],paymentInstructions:'隔離測試，請勿匯款',
 exchange:{rate:.025,currency:'KRW',source:'Isolated manual test fixture',status:'manual',updatedAt:new Date().toISOString()}});
async function inspect(page,width,label){
 await page.waitForTimeout(250);
 const m=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,document:document.documentElement.scrollWidth,
  dialogs:[...document.querySelectorAll('[role="dialog"]')].filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth};})}));
 const ok=m.body<=width+1&&m.document<=width+1&&m.dialogs.every(d=>d.left>=-1&&d.right<=width+1&&d.scrollWidth<=d.clientWidth+1);
 const screenshot=`${width}-${label}.png`;await page.screenshot({path:resolve(out,screenshot),fullPage:false});
 results.push({width,label,ok,...m,screenshot});assert.ok(ok,JSON.stringify(results.at(-1)));
}
try{
 for(const width of [375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const data=path==='/api/shop'?makeData():{messages:[],notifications:[],unread:0,configured:false,publicKey:null,subscriptions:[]};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(base,{waitUntil:'networkidle'});
  assert.ok((await page.title()).includes("Adela's Purchasing Agent"),'Storefront title must use the current brand');
  assert.deepEqual(errors,[],`Frontend errors: ${JSON.stringify(errors)}`);
  await inspect(page,width,'home');
  await page.locator('.kk-mobile-nav').getByRole('button',{name:'訂單',exact:true}).click();
  await page.getByRole('heading',{name:'我的購物金',exact:true}).waitFor();
  assert.equal(await page.locator('#kk-topup-products').count(),0);
  await inspect(page,width,'credit-wallet');
  await page.getByRole('button',{name:'申請轉帳退款',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('收款戶名',{exact:true}).fill('隔離測試，請勿匯款');
  await page.getByPlaceholder('例如 822').fill('000');
  await page.getByLabel('銀行／分行名稱',{exact:true}).fill('隔離測試銀行');
  await page.getByLabel('完整銀行帳號',{exact:true}).fill('000000000000');
  await inspect(page,width,'refund-dialog');
  const submit=page.getByRole('button',{name:'送出退款申請',exact:true});
  assert.equal(await submit.isEnabled(),false);
  await page.getByRole('checkbox').check();
  await submit.scrollIntoViewIfNeeded();
  assert.equal(await submit.isEnabled(),true);
  const bounds=await submit.boundingBox();
  assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=844,'Refund submission must remain reachable within the dialog');
  await inspect(page,width,'refund-submit-visible');
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(resolve(out,'results.json'),JSON.stringify({scope:'Generated Netlify frontend; synthetic API fixture; Chromium viewports; no live backend / financial writes / actual provider / physical-device validation',routeChecks:2,browserChecks:results.length,results},null,2)+'\n');
 console.log(`PASS: 2 admin route checks, ${results.length} browser viewport checks; synthetic API only.`);
}finally{await browser.close();await new Promise(r=>server.close(r));}

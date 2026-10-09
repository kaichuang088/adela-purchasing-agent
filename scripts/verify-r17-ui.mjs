import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,writeFileSync} from 'node:fs';
const {buildSync}=createRequire(realpathSync('node_modules/wrangler/package.json'))('esbuild');
buildSync({stdin:{contents:"export {OrderTaskList} from './app/admin/order-task-list'; export {StoreSettings} from './app/admin/commerce-controls'; export {TopupProducts} from './app/topup-products'; export {orderTask} from './lib/admin-tasks';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',outfile:'work/r17-ui.mjs'});
const {OrderTaskList,StoreSettings,TopupProducts,orderTask}=await import('../work/r17-ui.mjs');
const {createElement:h}=await import('react'),{renderToStaticMarkup:render}=await import('react-dom/server');
let checks=0;function check(ok,label){assert.ok(ok,label);console.log(`PASS ${++checks}: ${label}`)}
const order={id:1,requestNo:'TEST-123',customerName:'Test',status:'refund_pending',refundAmountTwd:200,refundKind:'bank',refundReference:''};
check(orderTask(order)?.kind==='refund','Unfinished bank refund is actionable');
check(orderTask({...order,refundReference:'draft'})?.kind==='refund','Unfinished refund stays visible even if a reference was drafted');
for(const status of ['cancelled','refunded','completed','rejected'])check(render(h(OrderTaskList,{orders:[{...order,status}],onSelect:()=>{}}))==='','Handled '+status+' produces no task panel or empty container');
const task=render(h(OrderTaskList,{orders:[order],onSelect:()=>{}}));check(task.includes('TEST-123')&&task.includes('處理退款')&&task.includes('NT$200'),'Pending task shows customer, order, amount and action');
const settings=render(h(StoreSettings,{data:{settings:{}},busy:false,save:async()=>{}}));
const fieldset=settings.match(/<fieldset>.*?<\/fieldset>/s)[0];check((fieldset.match(/type="checkbox"/g)||[]).length===2&&fieldset.includes('Pause new orders')&&fieldset.includes('Pause photo quotes'),'Availability fieldset renders two independent labelled checkboxes');
const products=render(h(TopupProducts,{signedIn:true,available:true,paused:false,onSignIn:()=>{},purchase:async()=>{}}));check(products.includes('NT$2,000')&&products.includes('NT$5,000')&&products.includes('NT$2,160')&&products.includes('NT$5,600')&&(products.match(/購買儲值商品/g)||[]).length===2,'Two top-up products show exact purchase and credited amounts with purchase buttons');
writeFileSync('verification/r17-ui-results.json',JSON.stringify({checks,scope:'React server render and task behavior; no browser/mobile visual QA'},null,2));

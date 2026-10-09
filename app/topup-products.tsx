'use client';
import {useRef,useState} from 'react';
import {Gift,Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {topupPlans} from '@/lib/topup-policy';
import {useStoreText} from './store-language';
import {TopupWallet,type Topup} from './topup-controls';

type Bank={name:string;code:string;account:string;accountName:string};
export function TopupProducts({signedIn,available,paused,onSignIn,purchase,items=[],bank,send,onHistory,en=false}:{signedIn:boolean;available:boolean;paused:boolean;onSignIn:()=>void;purchase:(amount:number,id:string)=>Promise<Topup|void>;items?:Topup[];bank?:Bank;send?:(body:Record<string,unknown>)=>Promise<unknown>;onHistory?:()=>void;en?:boolean}){
 const t=useStoreText(en),ids=useRef<Record<number,string>>({}),pending=useRef(false);
 const [selected,setSelected]=useState<number|null>(null),[receipt,setReceipt]=useState<Topup|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const plan=topupPlans.find(p=>p.amount===selected),current=items.find(x=>x.id===receipt?.id)||receipt;
 function open(amount:number){setSelected(amount);setReceipt(null);setError('');}
 async function buy(){
  if(!plan||pending.current)return;
  if(!signedIn){setSelected(null);onSignIn();return;}
  pending.current=true;setBusy(true);setError('');
  const id=ids.current[plan.amount]||crypto.randomUUID();ids.current[plan.amount]=id;
  try{const result=await purchase(plan.amount,id);if(result){setReceipt(result);delete ids.current[plan.amount];}}
  catch(e){setError(e instanceof Error?e.message:'Error');}
  finally{pending.current=false;setBusy(false);}
 }
 return <section className="kk-topup-products" id="kk-topup-products">
  <div className="kk-section-head"><div><h2>{t('儲值商品','Store credit products')}</h2><p>{t('為下一次喜歡的選品，先存一份購物金。','Save credit for your next favorite find.')}</p></div></div>
  <div className="kk-topup-product-grid">{topupPlans.map(p=><article className="kk-product kk-topup-product" key={p.amount}>
   <div className="kk-product-visual"><button className="kk-product-open kk-topup-product-art" aria-label={t('查看儲值 NT${amount} 商品','View NT${amount} store credit',{amount:p.amount.toLocaleString()})} onClick={()=>open(p.amount)}><Gift aria-hidden="true"/><span>ADELA STORE CREDIT</span><strong>NT${p.amount.toLocaleString()}</strong><small>+ NT${p.bonus.toLocaleString()} · {p.percent}%</small></button></div>
   <div className="kk-product-body"><small>{t('數位購物金 · 無運費','Digital store credit · No shipping fee')}</small><h3><button className="kk-product-title-button" onClick={()=>open(p.amount)}>{t('儲值購物金','Store credit')} NT${p.amount.toLocaleString()}</button></h3><p>{t('贈 {percent}%（NT${bonus}），總入帳 NT${total}。','{percent}% bonus (NT${bonus}), NT${total} total credit.',{percent:p.percent,bonus:p.bonus,total:(p.amount+p.bonus).toLocaleString()})}</p>
   <div className="kk-product-money"><strong>NT${p.amount.toLocaleString()}</strong><Button aria-label={t('購買儲值商品 NT${amount}','Buy NT${amount} store credit',{amount:p.amount.toLocaleString()})} onClick={()=>open(p.amount)}><Plus aria-hidden="true"/></Button></div></div>
  </article>)}</div>
  {paused&&<p>{t('目前暫停新訂單。','New orders are currently paused.')}</p>}{!available&&<p>{t('收款帳戶尚未設定，暫不接受儲值。','Bank details are not configured yet.')}</p>}
  <Dialog open={!!plan} onOpenChange={open=>{if(!open&&!pending.current)setSelected(null);}}><DialogContent className="kk-modal kk-product-detail"><DialogHeader><DialogTitle>{current?t('儲值申請已建立','Top-up request created'):t('儲值購物金','Store credit')}</DialogTitle><DialogDescription>{t('銀行匯款 → 回報匯款 → 賣家核對 → 本金與贈額入帳','Bank transfer → report payment → seller verification → credit')}</DialogDescription></DialogHeader>
   {plan&&<div className="kk-detail-body">{!current?<><div className="kk-detail-picture kk-topup-detail-art"><Gift aria-hidden="true"/><strong>NT${plan.amount.toLocaleString()}</strong></div><p>{t('購物金可折抵商品、代購費與運費。儲值獨立付款，不加入一般商品購物車，不能使用優惠券或既有購物金付款。','Credit covers merchandise, service fees and shipping. Top-ups are paid separately from merchandise and cannot use coupons or existing credit.')}</p>
    <dl className="kk-topup-summary"><div><dt>{t('實付金額','Payment')}</dt><dd>NT${plan.amount.toLocaleString()}</dd></div><div><dt>{t('贈送金額','Bonus')} · {plan.percent}%</dt><dd>NT${plan.bonus.toLocaleString()}</dd></div><div><dt>{t('核款後總入帳','Credit after verification')}</dt><dd>NT${(plan.amount+plan.bonus).toLocaleString()}</dd></div></dl>
    <Button disabled={busy||paused||!available} onClick={()=>void buy()}>{busy?t('處理中…','Processing…'):t('建立儲值申請，前往匯款','Create request & pay by transfer')}</Button></>:<><p role="status">{t('尚未收到款項或核對完成前，不會增加購物金。可隨時在「我的訂單」查看儲值紀錄。','Credit is added only after payment verification. Your top-up status is available in My orders.')}</p><TopupWallet items={[current]} bank={bank} en={en} send={send|| (async()=>{})} compact/>{onHistory&&<Button variant="outline" onClick={()=>{setSelected(null);onHistory();}}>{t('查看我的儲值紀錄','View my top-up history')}</Button>}</>}{error&&<p role="alert">{error}</p>}</div>}
  </DialogContent></Dialog>
 </section>;
}

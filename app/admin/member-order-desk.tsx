'use client';
import {productPhoto} from '@/lib/product-photo';
import {productCode,productByCode} from '@/lib/product-code';

import {PickupFields,blankPickup} from '@/app/pickup-fields';
import {PaymentChoice} from '@/app/payment-choice';
import type {PaymentMethod} from '@/lib/commerce-types';
import {useState} from 'react';
import {Search,Plus,Minus,Trash2,Package,UserRound,Truck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {PriceBreakdown} from '@/app/price-breakdown';
import {readJsonResponse} from '@/lib/http-response';
import type {Member,ShopProduct,Pricing} from '@/lib/commerce-types';
import {useAdminText} from './admin-language';
import {toast} from 'sonner';
type Line={productId:number;variantId:string;quantity:number};
export function MemberOrderDesk({password,members,products,refresh}:{password:string;members:Member[];products:ShopProduct[];refresh:()=>Promise<void>}){
 const a=useAdminText(),[busy,setBusy]=useState(false),[memberId,setMemberId]=useState(''),[lines,setLines]=useState<Line[]>([]),[pricing,setPricing]=useState<Pricing|null>(null),[key,setKey]=useState(()=>crypto.randomUUID()),[result,setResult]=useState(''),[lookup,setLookup]=useState(''),[memberSearch,setMemberSearch]=useState('');
 const [address,setAddress]=useState(blankPickup);
 const [paymentMethod,setPaymentMethod]=useState<PaymentMethod>('transfer'),[cashConfirmed,setCashConfirmed]=useState(false);
 async function send(body:unknown){const r=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json','X-KK-Admin-Password':password},body:JSON.stringify(body)}),v=await readJsonResponse(r) as any;if(!r.ok)throw Error(v.error||'操作失敗');return v;}
 function changed(next:Line[]){setLines(next);setPricing(null);setKey(crypto.randomUUID());setResult('');}
 async function order(checkout=false){if(busy)return;setBusy(true);try{const v=await send({action:'admin_order',orderAction:checkout?'checkout':'estimate',memberId,items:lines,submissionKey:key,shippingAddress:address,paymentMethod,cashConfirmed,approvedTotal:pricing?.totalTwd,approvedSignature:JSON.stringify(pricing?.items),approvedPurchaseAt:pricing?.purchaseAt,approvedPurchaseAtTo:pricing?.purchaseAtTo,approvedCancelUntil:pricing?.cancelUntil});if(checkout){setResult(v.order.requestNo);setPricing(null);setLines([]);setKey(crypto.randomUUID());await refresh();toast.success(a('代下單已建立，尚未確認收款。'));}else setPricing(v.pricing);}catch(e){setPricing(null);toast.error(e instanceof Error?e.message:'代下單失敗');}finally{setBusy(false);}}
 const selectedMember=members.find(m=>m.id===memberId);
 const query=lookup.trim().toLocaleLowerCase();
 const codeMatch=productByCode(products,lookup);
 const matches=products.filter(p=>p.status==='active'&&query&&(codeMatch?p.id===codeMatch.productId:[p.nameZh,p.nameEn,p.brand||'',String(p.id),...p.variants.map(v=>productCode(p,v.id)+' '+v.labelZh)].join(' ').toLocaleLowerCase().includes(query))).slice(0,8);
 function add(productId:number,variantId=''){
  const p=products.find(p=>p.id===productId);if(!p||p.status!=='active')return;
  if(p.variants.length&&!variantId){toast.error(a('請先選擇規格'));return;}
  if((p.variants.find(v=>v.id===variantId)?.stock??p.stock)===0){toast.error(a('此規格目前缺貨'));return;}
  if(lines.length>=20){toast.error(a('最多 20 個商品'));return;}
  const same=lines.findIndex(l=>l.productId===productId&&l.variantId===variantId);
  changed(same<0?[...lines,{productId,variantId,quantity:1}]:lines.map((l,i)=>i===same?{...l,quantity:Math.min(20,l.quantity+1)}:l));
  setLookup('');
 }
 return <section className="op-panel adela-member-desk">
  <div className="adela-desk-main">
   <section className="adela-desk-section"><h3><UserRound size={18}/>{a('選擇會員')}</h3>
    <input aria-label={a('搜尋會員')} type="search" placeholder={a('姓名或 Email')} value={memberSearch} onChange={e=>setMemberSearch(e.target.value)}/>
    <label><span className="sr-only">{a('選擇會員')}</span><select value={memberId} onChange={e=>{setMemberId(e.target.value);setPaymentMethod('transfer');setCashConfirmed(false);setPricing(null);setKey(crypto.randomUUID());setResult('');}}><option value="">{a('請選擇會員')}</option>{members.filter(m=>m.id===memberId||[m.name,m.email].join(' ').toLowerCase().includes(memberSearch.toLowerCase())).map(m=><option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}</select></label>
   </section>
   <section className="adela-desk-section"><h3><Package size={18}/>{a('加入商品')}</h3>
    <div className="adela-desk-search"><Search size={18}/><input type="search" aria-label={a('搜尋商品或 ID')} placeholder={a('搜尋名稱或 ID，例如 123-1')} value={lookup} onChange={e=>setLookup(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();const match=productByCode(products,lookup);if(match&&products.find(p=>p.id===match.productId)?.status==='active')add(match.productId,match.variantId);}}}/></div>
    {query&&<div className="adela-desk-results">{matches.length?matches.map(p=><article key={p.id} data-product-id={p.id}><img src={productPhoto(p)} alt={p.nameZh}/><div><strong>{p.nameZh}</strong><small>#{p.id}</small>{p.variants.length?<div className="adela-desk-options">{p.variants.map(v=><button type="button" key={v.id} disabled={busy||v.stock===0} onClick={()=>add(p.id,v.id)}>{v.labelZh} <small>#{productCode(p,v.id)}</small><Plus size={14}/></button>)}</div>:<button type="button" disabled={busy||p.stock===0} onClick={()=>add(p.id)}><Plus size={16}/>{a('加入')}</button>}</div></article>):<p>{a('找不到符合的商品，請試其他名稱或 ID。')}</p>}</div>}
    <div className="adela-desk-items">{lines.length?lines.map((line,i)=>{const p=products.find(p=>p.id===line.productId)!;return <article className="adela-order-line" key={line.productId+':'+line.variantId}><img src={productPhoto(p,line.variantId)} alt={p.nameZh}/><div className="adela-desk-item-info"><strong>{p.nameZh}</strong><small>#{productCode(p,line.variantId)}{line.variantId?' · '+p.variants.find(v=>v.id===line.variantId)?.labelZh:''}</small><div className="adela-desk-quantity"><button type="button" aria-label={a('減少數量')} disabled={busy||line.quantity<=1} onClick={()=>changed(lines.map((l,j)=>j===i?{...l,quantity:l.quantity-1}:l))}><Minus size={16}/></button><input aria-label={a('數量')} type="number" min={1} max={20} value={line.quantity} onChange={e=>changed(lines.map((l,j)=>j===i?{...l,quantity:Math.max(1,Math.min(20,Number(e.target.value)||1))}:l))}/><button type="button" aria-label={a('增加數量')} disabled={busy||line.quantity>=20} onClick={()=>changed(lines.map((l,j)=>j===i?{...l,quantity:l.quantity+1}:l))}><Plus size={16}/></button></div></div><button className="adela-desk-remove" type="button" disabled={busy} aria-label={a('移除')+' '+p.nameZh} onClick={()=>changed(lines.filter((_,j)=>j!==i))}><Trash2 size={18}/></button></article>;}):<div className="adela-desk-empty"><Package size={28}/><p>{a('搜尋商品後，選擇規格加入清單。')}</p></div>}</div>
   </section>
   <section className="adela-desk-section"><h3><Truck size={18}/>{a('配送與付款')}</h3><PickupFields value={address} onChange={v=>{setAddress(v);setKey(crypto.randomUUID());}}/><PaymentChoice value={paymentMethod} onChange={v=>{setPaymentMethod(v);setPricing(null);setKey(crypto.randomUUID());}} cashConfirmed={cashConfirmed} onConfirm={setCashConfirmed} diamond={selectedMember?.tier==='diamond'}/></section>
  </div>
  <aside className="adela-desk-summary"><h3>{a('訂單摘要')}</h3><div><span>{a('會員')}</span><strong>{selectedMember?.name||a('尚未選擇')}</strong></div><div><span>{a('商品')}</span><strong>{lines.reduce((n,l)=>n+l.quantity,0)} {a('件')}</strong></div><p>{a('會員會看到「管理員代下單」標記並收到待付款通知。')}</p><p>{a('依會員等級計價，不抵扣購物金或優惠券。賣家核款後才進待買清單。')}</p><Button disabled={busy||!memberId||!lines.length} onClick={()=>void order()}>{a(busy?'處理中…':'計算金額')}</Button>{pricing&&<><PriceBreakdown p={pricing} en={false}/><Button disabled={busy||(paymentMethod==='cash'&&!cashConfirmed)} onClick={()=>void order(true)}>{a('確認金額並建立待付款訂單')}</Button></>}{result&&<p role="status">{a('已建立訂單')}：{result} · {a('待會員匯款／回報，賣家核款後才入帳。')}</p>}</aside>
 </section>;
}

'use client';
import {useStoreText} from './store-language';
import {useEffect,useRef,useState} from 'react';
import {countries,type Country} from '@/lib/countries';
import {Camera,Check,LoaderCircle,Sparkles} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {PriceBreakdown} from './price-breakdown';
import type {ProductAnalysis} from '@/lib/types';
import type {Pricing,ShopOrder,PaymentMethod} from '@/lib/commerce-types';
import {optimizePhoto} from '@/lib/photo-input';
import {resolveProductPhoto} from '@/lib/product-photo';
type Stage='photo'|'uploading'|'identifying'|'identity'|'quoting'|'quote'|'buying';
export function PhotoQuoteFlow({en,diamond=false,enabledCountries=['KR'],onClose,onPurchased,initialDraftId}:{initialDraftId?:string;en:boolean;diamond?:boolean;enabledCountries?:string[];onClose:()=>void;onPurchased:(order:ShopOrder)=>void}){
 const [stage,setStage]=useState<Stage>('photo'),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[note,setNote]=useState(''),[analysis,setAnalysis]=useState<ProductAnalysis|null>(null),[pricing,setPricing]=useState<Pricing|null>(null),[error,setError]=useState('');
 const [reviewSent,setReviewSent]=useState(false),[detail,setDetail]=useState('');
 const [country,setCountry]=useState<Country>(enabledCountries[0] as Country);
 const [shipping,setShipping]=useState({recipient:'',phone:'',postalCode:'',street:''});
 const [paymentMethod,setPaymentMethod]=useState<PaymentMethod>('transfer');
 const draft=useRef(''),closed=useRef(false),running=useRef(false);
 const t=useStoreText(en);
 const busy=['uploading','identifying','quoting','buying'].includes(stage);
 useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{if(!initialDraftId)return;draft.current=initialDraftId;void fetch('/api/photo-quotes?id='+encodeURIComponent(initialDraftId)).then(async r=>{const v=await r.json() as any;if(!r.ok)throw Error(v.error);setAnalysis(v.analysis);setPricing(v.pricing);setStage('quote');}).catch(e=>setError(String(e)));},[initialDraftId]);
 async function api(body:object|FormData){
  const response=await fetch('/api/photo-quotes',{method:'POST',headers:body instanceof FormData?{Accept:'application/vnd.adela.photo-result+json'}:{'Content-Type':'application/json'},body:body instanceof FormData?body:JSON.stringify(body)});
  const received=await response.json() as {status?:number;result?:unknown};
  const pendingEnvelope=response.headers.get('content-type')?.includes('application/vnd.adela.photo-result+json');
  const status=pendingEnvelope?received.status:response.status;
  if(typeof status!=='number'||!Number.isInteger(status)||status<200||status>599)throw new Error(t('查價結果不完整，請重試。','Incomplete research response. Please retry.'));
  const value=(pendingEnvelope?received.result:received) as {id:string;analysis:ProductAnalysis;pricing:Pricing;order:ShopOrder;state?:string;error?:string};
  if(status>=300)throw new Error(value?.error||t('連線失敗，請重試。','Connection failed. Please retry.'));
  if(body instanceof FormData&&(!value.id||(value.state!=='pending'&&(!value.analysis||(value.state!=='identified'&&!value.pricing)))))throw new Error(t('查價結果不完整，請重試。','Incomplete research response. Please retry.'));
  return value;
 }
 function discard(){const id=draft.current;draft.current='';if(id)void fetch('/api/photo-quotes',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'discard',id})}).catch(()=>undefined);}
 function close(){if(stage==='buying')return;closed.current=true;discard();onClose();}
 async function identify(selected:File){if(running.current)return;running.current=true;setError('');try{
  setStage('uploading');const upload=await optimizePhoto(selected);setFile(upload);const form=new FormData();form.set('image',upload);form.set('note',note);form.set('country',country);
  await awaitResult(await api(form));
 }catch(e){if(!closed.current){setError(e instanceof Error?e.message:'Please retry');setStage('photo');}}finally{running.current=false;}}
 async function awaitResult(result:Awaited<ReturnType<typeof api>>){
  draft.current=result.id;if(closed.current){discard();return;}
  if(result.state==='pending'){
   setStage('identifying');const deadline=Date.now()+180000;
   while(!closed.current){
    await new Promise(resolve=>setTimeout(resolve,2000));if(closed.current)return;
    const response=await fetch('/api/photo-quotes?id='+encodeURIComponent(draft.current)),value=await response.json() as typeof result;
    if(!response.ok){
     if(value.analysis?.identifiedNameZh){setAnalysis(value.analysis);setDetail(value.analysis.model||'');setError(value.error||t('請補充規格後再查價。','Add specification details before pricing.'));setStage('identity');return;}
     throw new Error(value.error||t('查價未完成，請重試。','Research failed. Please retry.'));
    }
    if(response.status===200&&value.analysis&&(value.state==='identified'||value.state==='quoted'&&value.pricing)){result=value;break;}
    if(Date.now()>=deadline)throw new Error(t('查價仍未完成，請稍後重試。尚未建立訂單。','Research did not complete. No order was created.'));
   }
  }
  if(closed.current){discard();return;}
  setAnalysis(result.analysis);setPricing(result.pricing||null);
  if(result.state==='identified'){setDetail(result.analysis.needsProductChoice?'':result.analysis.model||'');setStage('identity');}else setStage('quote');
 }
 async function refine(){
  if(running.current||!detail.trim())return;running.current=true;setError('');setStage('quoting');
  try{await awaitResult(await api({action:'refine',id:draft.current,detail}));}
  catch(e){setError(e instanceof Error?e.message:'Please retry');setStage('identity');}
  finally{running.current=false;}
 }
 async function selectSource(choiceId:string){
  if(running.current)return;running.current=true;setError('');setStage('quoting');
  try{await awaitResult(await api({action:'select_source',id:draft.current,choiceId}));}
  catch(e){setError(e instanceof Error?e.message:'Please retry');setStage('identity');}
  finally{running.current=false;}
 }
 async function buy(){if(!pricing||running.current)return;running.current=true;setError('');setStage('buying');try{const result=await api({action:'buy',id:draft.current,approvedAt:pricing.pricedAt,approvedTotal:pricing.totalTwd,paymentMethod,shippingAddress:shipping});draft.current='';onPurchased(result.order);}catch(e){setError(e instanceof Error?e.message:'Please retry');setStage('quote');}finally{running.current=false;}}
 function changePhoto(){discard();setAnalysis(null);setPricing(null);setDetail('');setStage('photo');setError('');}
 const step=['photo','uploading'].includes(stage)?1:['identifying','identity','quoting'].includes(stage)?2:3;
 return <Dialog open onOpenChange={open=>!open&&close()}><DialogContent className="kk-modal kk-photo-flow" onInteractOutside={e=>{if(busy)e.preventDefault();}} onEscapeKeyDown={e=>{if(stage==='buying')e.preventDefault();}}><DialogHeader><DialogTitle><Sparkles size={20}/>{t('AI 照片查價','AI photo quote')}</DialogTitle><DialogDescription>{t('先看商品和價格，喜歡再下單。','See the item and price. Order only when you are ready.')}</DialogDescription></DialogHeader>
 <ol className="kk-photo-steps">{[t('上傳照片','Upload'),t('辨識與查價','Identify & price'),t('查看報價','See quote')].map((label,i)=><li key={label} className={step>=i+1?'active':''}><span>{step>i+1?<Check size={12}/>:i+1}</span>{label}</li>)}</ol>
 {error&&<><p role="alert" className="kk-photo-error">{error.includes(' / ')?(en?error.split(' / ').slice(1).join(' / '):error.split(' / ')[0]):error}</p>{draft.current&&!reviewSent&&<Button variant="outline" onClick={async()=>{try{await api({action:'request_review',id:draft.current});draft.current='';setReviewSent(true);}catch(e){setError(String(e));}}}>{t('送交賣家人工查價，不建立訂單','Ask seller to research · No order created')}</Button>}{reviewSent&&<p role="status">{t('已送交賣家；完成後可至我的訂單／查價回報查看通知與報價。','Sent to seller. View notifications and quotes under My orders.')}</p>}</>}
 {stage==='photo'&&<div className="kk-form"><label>{t('代購國家','Shopping country')}<select value={country} onChange={e=>{discard();setCountry(e.target.value as Country);}}>{(Object.keys(countries) as Country[]).map(c=><option key={c} value={c} disabled={!enabledCountries.includes(c)}>{en?countries[c].en:countries[c].zh}{enabledCountries.includes(c)?"":en?" (coming soon)":"（尚未開放）"}</option>)}</select></label><label>{t('型號、顏色或尺寸（選填）','Model, color or size (optional)')}<textarea rows={2} maxLength={1200} value={note} onChange={e=>{discard();setNote(e.target.value);}} placeholder={t('例如：海軍藍、M 號、一件','For example: navy, size M, one item')}/></label><label className="kk-upload">{preview?<img src={preview} alt={t('商品照片預覽','Product photo preview')}/>:<Camera/>}<span>{t('選擇商品照片','Choose a product photo')}</span><small>JPG / PNG / WEBP · 4 MB {t('（系統會自動壓縮）','(automatically compressed)')}</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>4194304){setError(t('圖片需小於 4MB。','Image must be under 4MB.'));return;}discard();setFile(f);setError('');void identify(f);}}/></label><p className="kk-note">{t('選擇照片後會自動完成辨識與查價，不需要再按開始。','Choosing a photo starts identification and pricing automatically.')}</p></div>}
 {stage==='identity'&&analysis&&<section className="kk-photo-confirm"><div className="kk-photo-identity">{preview&&<img src={preview} alt={t('上傳的商品照片','Uploaded product photo')}/>}<div><h3>{en?analysis.identifiedNameEn:analysis.identifiedNameZh}</h3><p>{t('先確認要買的款式，再查這一款的價格。','Confirm the exact item to research its price.')}</p></div></div><p className="kk-note">{analysis.retailerChoices?.length?t('以下是目前核實的商家包裝，重量可能與照片不同；請選擇你要買的這一盒。','These are currently verified retailer packages. Sizes may differ from the photo. Choose the exact box you want.'):(en?analysis.evidenceSummaryEn:analysis.evidenceSummaryZh)}</p>{!!analysis.retailerChoices?.length&&<div className="kk-photo-retailer-choices">{analysis.retailerChoices.map(choice=><button type="button" key={choice.id} onClick={()=>void selectSource(choice.id)}><img src={resolveProductPhoto(choice.imageUrl)} alt={en?choice.labelEn:choice.labelZh}/><span>{en?choice.labelEn:choice.labelZh}<small>{t('選擇這盒並核對總價','Choose this box & check total')}</small></span></button>)}</div>}{!analysis.retailerChoices?.length&&!!analysis.identificationChoices?.length&&<div className="kk-photo-choices">{analysis.identificationChoices.map((choice,i)=><button type="button" key={i} className={detail===choice.model?'selected':''} onClick={()=>setDetail(choice.model)}>{en?choice.labelEn:choice.labelZh}</button>)}</div>}<details className="kk-photo-other-spec" open={!analysis.retailerChoices?.length}><summary>{t('其他口味或包裝','Other flavor or package')}</summary><label className="kk-field">{t('口味、容量與包裝','Flavor, size and packaging')}<textarea rows={2} maxLength={400} value={detail} onChange={e=>setDetail(e.target.value)} placeholder={t('例如：原味、64g、一盒；請依照片標示填寫','For example: original, 64g, one box. Use the label on your photo.')}/></label><Button disabled={!detail.trim()} onClick={()=>void refine()}>{t('確認規格並查價','Confirm specification & find price')}</Button></details><Button variant="outline" onClick={changePhoto}>{t('換一張照片','Choose another photo')}</Button></section>}
 {busy&&<div role="status" aria-live="polite" className="kk-photo-loading"><LoaderCircle className="animate-spin" size={32}/><h3>{stage==='buying'?t('正在建立訂單','Creating your order'):t('照片上傳中 · AI 正在辨識與查價','Uploading · AI is identifying and pricing')}</h3><p>{stage==='buying'?t('請稍候。','Please wait.'):t('系統正在核對商品型號、當地商家、庫存與價格來源；查價完成後會直接顯示含會員代購費的總價。','Checking the product model, local retailers, stock and price sources. Your total including the member service fee will appear automatically.')}</p>{stage!=='buying'&&<Button variant="outline" onClick={close}>{t('取消查價','Cancel search')}</Button>}</div>}
 {stage==='quote'&&pricing&&<div className="kk-photo-result">{analysis?.retailerPhotoUrl&&<div className="kk-photo-identity"><img src={resolveProductPhoto(analysis.retailerPhotoUrl)} alt={en?analysis.identifiedNameEn:analysis.identifiedNameZh}/><div><small>{t('已確認的商家包裝','Confirmed retailer package')}</small><strong>{en?analysis.identifiedNameEn:analysis.identifiedNameZh}</strong></div></div>}<div className="kk-photo-total"><small>{t('預估總價・已含代購費','Estimated total · service fee included')}</small><h3>NT${pricing.totalTwd.toLocaleString()}</h3><p>{en?pricing.items[0].nameEn:pricing.items[0].nameZh}</p><small>{t('已含代購費與下方列出的費用','Includes the service fee and charges below')}</small></div><label className="kk-field">{t('數量','Quantity')}<select value={pricing.items[0].quantity} onChange={async e=>{try{setStage('quoting');const r=await api({action:'confirm_product',id:draft.current,quantity:Number(e.target.value)});setPricing(r.pricing);}catch(e){setError(e instanceof Error?e.message:'Error');}finally{setStage('quote');}}}>{Array.from({length:20},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label><PriceBreakdown p={pricing} en={en}/><div className="kk-reward">{t('客製訂單需賣家在 24 小時內確認，可能調整報價。確認報價後才開始三日付款期限；不接受可在取消截止前取消。','Custom orders require seller review within 24 hours. Quotes may change. The 3-day payment period starts after quote acceptance; cancel before the cutoff if you decline.')}</div><fieldset className="kk-shipping-fields"><legend>{t('台灣配送地址','Taiwan delivery address')}</legend>{([['recipient','收件人','Recipient'],['phone','手機','Mobile phone'],['postalCode','郵遞區號','Postal code'],['street','完整地址','Street address']] as const).map(([key,zh,eng])=><label key={key}>{t(zh,eng)}<input value={shipping[key]} onChange={e=>setShipping({...shipping,[key]:e.target.value})} required/></label>)}</fieldset><p className="kk-note">{pricing.items[0].taxFreeConditions}</p><label className="kk-field">{t('付款方式','Payment method')}<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as PaymentMethod)}><option value="transfer">{t('三天內銀行匯款','Bank transfer within 3 days')}</option>{diamond&&<option value="cod">{t('貨到付款（金鑽會員）','Cash on delivery (Diamond)')}</option>}</select></label><a href={pricing.items[0].sourceUrl} target="_blank" rel="noreferrer">{t('查看商家與價格來源 ↗','View retailer & price source ↗')}</a><small>{t('報價有效至','Valid until')} {new Date(pricing.expiresAt!).toLocaleString(en?'en-US':'zh-TW')}</small><Button onClick={()=>void buy()}>{t('接受此總價，送交賣家核對','Accept total & request seller review')}</Button><Button variant="outline" onClick={changePhoto}>{t('商品不對，換照片','Wrong item, choose another photo')}</Button><Button variant="outline" onClick={close}>{t('不接受，取消此查價','Decline & cancel this quote')}</Button></div>}
 <p className="kk-photo-footnote">{t('接受報價前不會建立訂單或扣哩程；只有你選擇人工查價，照片才會送交賣家。','No order or miles redemption before acceptance. Photos are sent to the seller only when you request manual research.')}</p>
 </DialogContent></Dialog>;
}

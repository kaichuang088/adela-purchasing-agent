'use client';
import {useEffect,useState} from 'react';
import {useAdminText} from './admin-language';
export function PaymentEvidence({id,password}:{id:string|null;password:string}){
 const a=useAdminText(),[url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();let objectUrl='';setUrl('');setError('');if(id)void fetch('/api/order-evidence?id='+encodeURIComponent(id),{headers:{'X-KK-Admin-Password':password},signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('付款截圖無法載入');const blob=await r.blob();if(controller.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)}},[id,password]);
 return <div className="op-payment-evidence"><b>{a('買家付款憑證')}</b>{error?<p role="alert">{a(error)}</p>:url?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={a('買家付款截圖')}/><span>{a('開啟原圖核對')}</span></a>:<p>{a(id?'正在載入付款截圖…':'買家未附截圖，請依末五碼與銀行入帳紀錄核對。')}</p>}</div>;
}

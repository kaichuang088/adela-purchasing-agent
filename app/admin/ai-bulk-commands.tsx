'use client';
import {readJsonResponse} from '@/lib/http-response';
import {useAdminText} from './admin-language';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
export function AIBulkCommands({password,configured,refresh}:{password:string;configured:boolean;refresh:()=>Promise<void>}){
 const a=useAdminText();
 const [prompt,setPrompt]=useState(''),[candidate,setCandidate]=useState<{command:Record<string,unknown>;summary:string}|null>(null),[busy,setBusy]=useState(false);
 async function send(mode:'preview'|'apply'){
  setBusy(true);
  try{
   const r=await fetch('/api/operations/ai-command',{method:'POST',headers:{'Content-Type':'application/json','X-KK-Admin-Password':password},body:JSON.stringify(mode==='preview'?{mode,prompt}:{mode,command:candidate?.command})});
   const result=await readJsonResponse(r) as {error?:string;command:Record<string,unknown>;summary:string;updated?:number};
   if(!r.ok)throw new Error(result.error||'AI 指令失敗。');
   if(mode==='preview')setCandidate({command:result.command,summary:result.summary});else{setCandidate(null);setPrompt('');await refresh();toast.success(result.updated===undefined?a('已更新商品資料。'):a('已更新 {count} 筆訂單。',{count:result.updated}));}
  }catch(e){toast.error(a(e instanceof Error?e.message:'操作失敗'));}finally{setBusy(false);}
 }
 return <section className="op-ai-bulk"><h3>{a("AI 商店操作")}</h3><p>{a("可批次將某商品標記已買到、停售商品，或調整下單、採買與到貨日期區間；先預覽受影響訂單，再套用。")}</p><textarea value={prompt} rows={2} onChange={e=>{setPrompt(e.target.value);setCandidate(null);}} placeholder={a("例如：把剝皮葡萄軟糖的所有訂單標記已買到；或把到貨區間改成 10 月 15 日至 18 日")}/><Button type="button" disabled={!configured||!prompt.trim()||busy} onClick={()=>void send('preview')}>{busy?a("處理中…"):a("AI 解析並預覽")}</Button>{!configured&&<p role="status">{a("此預覽站尚未設定 AI API Key 或 Gateway；AI 指令暫不可用。")}</p>}{candidate&&<div className="op-ai-bulk-review" role="status"><strong>{a("將執行：")}</strong><p>{candidate.summary}</p><Button type="button" disabled={busy} onClick={()=>void send('apply')}>{a("確認套用")}</Button><Button type="button" variant="outline" onClick={()=>setCandidate(null)}>{a("取消")}</Button></div>}</section>;
}

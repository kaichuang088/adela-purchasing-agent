'use client';
import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {readJsonResponse} from '@/lib/http-response';
import {useAdminText} from './admin-language';

type Status = {lastAiSuccess?:{at:string;actualModel:string;route:string};release:string;backendId:string;databaseReady:boolean;missingTables:string[];aiConfigured:boolean;aiMissingConfiguration?:string[];aiModel:string|null;pushConfigured:boolean;emailConfigured:boolean;lastScheduledAt:string|null};
export function ServiceStatus({password}:{password:string}) {
  const a=useAdminText(),[status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[aiResult,setAIResult]=useState(''),[checkingAI,setCheckingAI]=useState(false);
  async function checkAI(){setCheckingAI(true);setAIResult('');try{const r=await fetch('/api/operations/ai-check',{method:'POST',headers:{'X-KK-Admin-Password':password}}),v=await readJsonResponse<any>(r);if(!r.ok)throw new Error(v.error||'AI 檢查失敗');setAIResult('回覆格式通過；要求模型 '+v.requestedModel+'；服務商回報 '+(v.reportedModel||'未提供模型名稱')+'；'+(v.modelMatched?'模型名稱一致':'模型名稱尚未確認一致')+'。僅確認連線，商品查價仍須核對來源。');}catch(e){setAIResult(e instanceof Error?e.message:'AI 檢查失敗');}finally{setCheckingAI(false);}}
  async function refresh(){
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/system/status',{headers:{'X-KK-Admin-Password':password},cache:'no-store'});
      const value=await readJsonResponse<Status & {error?:string}>(response);
      if(!response.ok)throw new Error(value.error||a('資料服務尚未就緒。'));
      setStatus(value);
    } catch(e){setError(a(e instanceof Error?e.message:'資料服務尚未就緒。'));}
    finally{setBusy(false);}
  }
  useEffect(()=>{void refresh();},[password]);
  return <section className="op-panel op-service-status">
    <div className="op-panel-head"><h3>{a('服務狀態')}</h3><Button type="button" variant="outline" disabled={busy} onClick={()=>void refresh()}>{a(busy?'處理中…':'重新檢查')}</Button></div>
    {error&&<p role="alert">{error}</p>}
    {status&&<dl>
      <div><dt>{a('目前版本')}</dt><dd>{status.release}</dd></div>
      <div><dt>{a('訂單與商品資料庫')}</dt><dd>{a(status.databaseReady?'已就緒':'資料表尚未完整')}</dd></div>
      <div><dt>AI</dt><dd>{a(status.aiConfigured?'連線資料已設定，仍需實測':'尚未設定 AI 服務')}{status.aiModel&&' · '+status.aiModel}{status.lastAiSuccess&&<p>{a('最近一次成功呼叫')}：{new Date(status.lastAiSuccess.at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})} · {status.lastAiSuccess.actualModel} · {a(status.lastAiSuccess.route==='admin-chat'?'後台對話':'前台客服')}（{a('不代表所有商品來源已核實')}）</p>}{!!status.aiMissingConfiguration?.length&&<small>{a('尚缺設定')}：{status.aiMissingConfiguration.join('、')}</small>}<div><Button type="button" variant="outline" disabled={checkingAI} onClick={()=>void checkAI()}>{a(checkingAI?'正在測試模型…':'測試 AI 實際回覆')}</Button>{aiResult&&<p role="status">{a(aiResult)}</p>}</div></dd></div>
      <div><dt>{a('手機推播')}</dt><dd>{a(status.pushConfigured?'VAPID 已設定；尚需手機訂閱與實際收訊驗證':'尚未啟用')}</dd></div>
      <div><dt>{a('Email 通知')}</dt><dd>{a(status.emailConfigured?'寄送資料已設定，仍需確認收信':'尚未設定寄信服務')}</dd></div>
      <div><dt>{a('最近一次自動排程')}</dt><dd>{status.lastScheduledAt?new Date(status.lastScheduledAt).toLocaleString('en-GB',{timeZone:'Asia/Taipei'}):a('尚無成功執行紀錄')}</dd></div>
    </dl>}
  </section>;
}

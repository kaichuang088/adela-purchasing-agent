import {aiConfiguration,aiConnection} from '@/lib/ai-config';
import {env} from 'cloudflare:workers';
import {isAdmin,privateJson} from '@/lib/admin-auth';
export async function POST(request:Request){
 if(!isAdmin(request))return privateJson({error:'請先登入管理後台。'},401);
 const config=aiConfiguration(env);if(!config.configured)return privateJson({error:'AI 設定尚未完整：'+config.missing.join('、')+'；尚未發送模型請求。'},503);
 const {endpoint,model,headers}=aiConnection(env);
 try{
  const response=await fetch(endpoint,{method:'POST',headers,signal:AbortSignal.timeout(30000),body:JSON.stringify({model,store:false,instructions:'This is a connectivity check. Reply exactly ADELA_AI_READY. Do not call tools.',input:'Reply with the required check token.'})});
  if(!response.ok){const reason=response.status===401?'API 金鑰無效或已失效':response.status===403?'此帳戶沒有模型權限':response.status===404?'模型或 API 路徑不可用':response.status===429?'API 額度或速率受限':'AI 服務暫時無法回應';return privateJson({error:reason+'；沒有修改商品或訂單。',providerStatus:response.status},502);}
  const value=await response.json() as any,text=String(value.output_text||value.output?.flatMap((p:any)=>p.content||[]).filter((p:any)=>p.type==='output_text').map((p:any)=>p.text).join('')||'').trim();
  if(value.status&&value.status!=='completed'||text!=='ADELA_AI_READY')return privateJson({error:'模型有回應，但未通過回覆格式檢查。'},502);
  return privateJson({ok:true,requestedModel:model,reportedModel:value.model||null,modelMatched:value.model===model,checkedAt:new Date().toISOString(),scope:'connection_only'});
 }catch{return privateJson({error:'AI 連線逾時或回應格式錯誤；沒有修改商品或訂單。'},502);}
}

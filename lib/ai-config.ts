type AIEnvironment={OPENAI_API_KEY?:string;OPENAI_MODEL?:string;KK_AI_GATEWAY_URL?:string;KK_AI_GATEWAY_SECRET?:string};
export function aiConfiguration(env:AIEnvironment){
 const gateway=!!env.KK_AI_GATEWAY_URL,missing:string[]=[];
 if(gateway){
  try{const url=new URL(env.KK_AI_GATEWAY_URL!);if(url.protocol!=='https:'||url.username||url.password)missing.push('KK_AI_GATEWAY_URL');}catch{missing.push('KK_AI_GATEWAY_URL');}
  if(!env.KK_AI_GATEWAY_SECRET)missing.push('KK_AI_GATEWAY_SECRET');
 }else if(!env.OPENAI_API_KEY)missing.push('OPENAI_API_KEY 或 KK_AI_GATEWAY_URL＋KK_AI_GATEWAY_SECRET');
 return {configured:missing.length===0,mode:gateway?'gateway':'direct',missing,model:env.OPENAI_MODEL||'gpt-6.1-sol'};
}
export function aiConnection(env:AIEnvironment){
 const status=aiConfiguration(env);if(!status.configured)throw new Error('AI 尚未設定完整：'+status.missing.join('、')+'；尚未發送模型請求。');
 const headers:Record<string,string>={'Content-Type':'application/json'};
 if(status.mode==='gateway')headers['X-KK-AI-Gateway-Secret']=env.KK_AI_GATEWAY_SECRET!;else headers.Authorization='Bearer '+env.OPENAI_API_KEY;
 return {endpoint:env.KK_AI_GATEWAY_URL||'https://api.openai.com/v1/responses',model:status.model,headers};
}

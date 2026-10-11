declare const Netlify:{env:{get(name:string):string|undefined}};
// Netlify's included background invocation handles research without holding a
// customer HTTP request open. Only an authenticated server can submit a job.
export default async function photoResearch(request:Request){
 const secret=Netlify.env.get('KK_AI_GATEWAY_SECRET')||'';
 if(secret.length<16||request.headers.get('x-kk-ai-gateway-secret')!==secret)return;
 let id:string;
 try{const body=await request.json() as {id?:unknown};id=String(body.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return;}catch{return;}
 const backend=Netlify.env.get('KK_BACKEND_URL')||'';
 let endpoint:URL;
 try{endpoint=new URL('/api/photo-quote-jobs',backend);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)return;}catch{return;}
 const send=(body:unknown,timeout=45000)=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-KK-AI-Gateway-Secret':secret},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(timeout)});
 let claimed=false;
 try{
  const claim=await send({id,action:'claim'});if(!claim.ok)return;
  claimed=true;const {input}=await claim.json() as {input:Record<string,unknown>};
  const model=Netlify.env.get('NETLIFY_AI_MODEL')||'gpt-6.1-sol';
  if(input.model!==model)throw new Error('Model mismatch');
  const base=Netlify.env.get('NETLIFY_AI_GATEWAY_URL'),key=Netlify.env.get('NETLIFY_AI_GATEWAY_KEY');
  if(!base||!key)throw new Error('Platform AI not available');
  const provider=new URL(base.endsWith('/')?base:base+'/');
  if(provider.protocol!=='https:'||provider.username||provider.password)throw new Error('Invalid platform provider');
  const response=await fetch(new URL(provider.pathname.replace(/\/$/,'').endsWith('/v1')?'responses':'v1/responses',provider),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(input),redirect:'manual',signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error('Photo provider request failed');
  const result=await response.json() as {model?:string};
  if(result.model!==model)throw new Error('Provider returned a different model');
  await send({id,action:'complete',result});
 }catch{
  if(claimed)await send({id,action:'complete',providerFailed:true}).catch(()=>undefined);
 }
}

export const config={timeout:180};

declare const Netlify: { env: { get(name:string):string|undefined } };

function r20ShopResponse(value:unknown):boolean {
  if(!value || typeof value!=="object" || Array.isArray(value))return false;
  const data=value as Record<string,unknown>;
  return Array.isArray(data.creditWithdrawals) && Array.isArray(data.topups)
    && typeof data.creditTwd==="number" && typeof data.photoQuotesPaused==="boolean";
}
function incompatibleBackend(){
  return Response.json({error:"共用後端尚未完成 R20 更新，商品、結帳與退款暫時無法使用。既有資料與餘額未變更。 / The shared backend requires the R20 update."},{status:503,headers:{"Cache-Control":"no-store"}});
}

// Both Netlify sites use the same externally deployed Cloudflare backend.
// No database, admin password, or AI key is copied to the browser bundle.
export default async function proxy(request:Request) {
  const incoming=new URL(request.url);
  if(incoming.pathname==="/api/ai-provider"){
    if(request.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
    const secret=Netlify.env.get("KK_AI_GATEWAY_SECRET");
    if(!secret||request.headers.get("x-kk-ai-gateway-secret")!==secret)return Response.json({error:"Forbidden"},{status:403});
    const key=Netlify.env.get("OPENAI_API_KEY")||Netlify.env.get("NETLIFY_AI_GATEWAY_KEY"),base=Netlify.env.get("OPENAI_BASE_URL")||Netlify.env.get("NETLIFY_AI_GATEWAY_URL");
    if(!base||!key)return Response.json({error:"AI provider endpoint or authorization is not configured"},{status:503});
    let baseUrl:URL;
    try{baseUrl=new URL(base.endsWith("/")?base:base+"/");}catch{return Response.json({error:"AI provider endpoint is invalid"},{status:503});}
    if(baseUrl.protocol!=="https:"||baseUrl.username||baseUrl.password)return Response.json({error:"AI provider endpoint is invalid"},{status:503});
    const responsePath=baseUrl.pathname.replace(/\/$/,"").endsWith("/v1")?"responses":"v1/responses";
    const headers:Record<string,string>={"Content-Type":"application/json"};
    if(key)headers.Authorization=`Bearer ${key}`;
    let body:Record<string,unknown>;
    try{body=await request.json();if(!body||Array.isArray(body)||typeof body!=="object")throw new Error();}catch{return Response.json({error:"Invalid AI request"},{status:400});}
    const requestedModel=typeof body.model==="string"?body.model.trim():"";
    const configuredModel=Netlify.env.get("NETLIFY_AI_MODEL")||"gpt-6.1-sol";
    if(!Netlify.env.get("OPENAI_API_KEY")&&requestedModel&&requestedModel!==configuredModel)return Response.json({error:"Backend and Netlify AI model settings do not match; no provider request was sent"},{status:409});
    body.model=requestedModel||configuredModel;
    try{
      const response=await fetch(new URL(responsePath,baseUrl),{method:"POST",headers,body:JSON.stringify(body),redirect:"manual",signal:AbortSignal.timeout(55000)});
      return new Response(response.body,{status:response.status,headers:{"Content-Type":response.headers.get("content-type")||"application/json","Cache-Control":"no-store"}});
    }catch{return Response.json({error:"AI provider connection unavailable"},{status:503});}
  }
  const base=Netlify.env.get("KK_BACKEND_URL");
  if(!base)return Response.json({error:"尚未設定共用 Cloudflare 後端，請聯絡管理員。 / Shared backend is not configured."},{status:503});
  let backend:URL;
  try{backend=new URL(base);}catch{return Response.json({error:"共用服務網址設定不正確。"},{status:503});}
  if(backend.protocol!=="https:"||backend.origin===incoming.origin)return Response.json({error:"共用服務網址設定不正確。"},{status:503});
  const destination=new URL(incoming.pathname+incoming.search,backend.origin);
  if(!/^\/(api|request)\//.test(destination.pathname))return new Response("Not found",{status:404});
  const headers=new Headers();
  for(const name of ["content-type","accept","cookie","x-kk-admin-password"]) {const value=request.headers.get(name);if(value)headers.set(name,value);}
  try {
    // Do not send R20 purchases, refunds or account writes to the legacy backend.
    // The anonymous shop payload contains these fields in every R20 response.
    if(!["GET","HEAD","OPTIONS"].includes(request.method)){
      const compatibility=await fetch(new URL("/api/shop",backend.origin),{headers:{Accept:"application/json"},redirect:"manual",signal:AbortSignal.timeout(15000)});
      if(!compatibility.ok || !r20ShopResponse(await compatibility.json().catch(()=>null)))return incompatibleBackend();
    }
    const response=await fetch(destination,{method:request.method,headers,body:["GET","HEAD"].includes(request.method)?undefined:await request.arrayBuffer(),redirect:"manual",signal:AbortSignal.timeout(55000)});
    if(request.method==="GET" && incoming.pathname==="/api/shop" && response.ok && !r20ShopResponse(await response.clone().json().catch(()=>null)))return incompatibleBackend();
    if(response.status===302 && incoming.pathname==="/api/media/catalog-demo") return Response.redirect(new URL("/kk-hero.png",incoming.origin),302);
    if(response.status>=300&&response.status<400)return Response.json({error:"共用服務回傳登入轉址，請檢查後端的服務存取設定。"},{status:502});
    const resultHeaders=new Headers();
    const omitted=new Set(["connection","content-encoding","content-length","set-cookie","transfer-encoding"]);
    for(const [name,value] of response.headers)if(!omitted.has(name.toLowerCase()))resultHeaders.append(name,value);
    const upstreamCookies=typeof response.headers.getSetCookie==="function"?response.headers.getSetCookie():[];
    for(const cookie of upstreamCookies){
      if(cookie.startsWith("__cf_bm="))continue;
      resultHeaders.append("Set-Cookie",cookie.replace(/;\s*Domain=[^;]+/gi,"").replace(/;\s*SameSite=None/gi,"; SameSite=Lax"));
    }
    resultHeaders.set("Cache-Control","no-store");
    return new Response(response.body,{status:response.status,headers:resultHeaders});
  }catch{return Response.json({error:"共用服務連線逾時，請稍後再試；已建立的單號仍可查詢。"},{status:503});}
}
export const config={path:["/api/*","/request/*"]};

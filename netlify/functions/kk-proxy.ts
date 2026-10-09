declare const Netlify: { env: { get(name:string):string|undefined } };

// Both Netlify sites use the same externally deployed Cloudflare backend.
// No database, admin password, or AI key is copied to the browser bundle.
export default async function proxy(request:Request) {
  const incoming=new URL(request.url);
  if(incoming.pathname==="/api/ai-provider"){
    const secret=Netlify.env.get("KK_AI_GATEWAY_SECRET");
    if(!secret||request.headers.get("x-kk-ai-gateway-secret")!==secret)return Response.json({error:"Forbidden"},{status:403});
    const key=Netlify.env.get("OPENAI_API_KEY")||Netlify.env.get("NETLIFY_AI_GATEWAY_KEY"),base=Netlify.env.get("OPENAI_BASE_URL")||Netlify.env.get("NETLIFY_AI_GATEWAY_URL");
    if(!base)return Response.json({error:"AI Gateway is unavailable"},{status:503});
    const baseUrl=new URL(base.endsWith("/")?base:base+"/");
    const responsePath=baseUrl.pathname.replace(/\/$/,"").endsWith("/v1")?"responses":"v1/responses";
    const headers:Record<string,string>={"Content-Type":"application/json"};
    if(key)headers.Authorization=`Bearer ${key}`;
    const body=JSON.parse(new TextDecoder().decode(await request.arrayBuffer())) as Record<string,unknown>;
    if(!Netlify.env.get("OPENAI_API_KEY"))body.model=Netlify.env.get("NETLIFY_AI_MODEL")||"gpt-6.1-sol";
    const response=await fetch(new URL(responsePath,baseUrl),{method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
    return new Response(response.body,{status:response.status,headers:{"Content-Type":response.headers.get("content-type")||"application/json","Cache-Control":"no-store"}});
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
    const response=await fetch(destination,{method:request.method,headers,body:["GET","HEAD"].includes(request.method)?undefined:await request.arrayBuffer(),redirect:"manual",signal:AbortSignal.timeout(55000)});
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

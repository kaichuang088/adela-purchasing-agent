import {env} from 'cloudflare:workers';
import {rawDb} from '@/lib/catalog';
import {privateJson} from '@/lib/admin-auth';
import {failure} from '@/app/api/shop/route';
import {ShopError,memberForPhotoResearch,requirePhotoQuotesOpen} from '@/lib/commerce';
import {getMedia} from '@/lib/media-store';
import {photoAnalysisInput,parsePhotoAnalysis} from '@/lib/request-data';
import {quoteDraft} from '@/lib/photo-quote-pricing';
import type {Country} from '@/lib/countries';

function authorized(request:Request){
 const expected=env.KK_AI_GATEWAY_SECRET||'',received=request.headers.get('x-kk-ai-gateway-secret')||'';
 if(expected.length<16||expected.length!==received.length)return false;
 let difference=0;for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^received.charCodeAt(i);
 return difference===0;
}
export async function POST(request:Request){try{
 if(!authorized(request))throw new ShopError('Forbidden',403);
 const body=await request.json() as {id?:string;action?:string;result?:unknown;providerFailed?:boolean};
 const id=String(body.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw new ShopError('Invalid job',400);
 const db=rawDb(),draft=await db.prepare('SELECT * FROM kk_photo_drafts WHERE id=?').bind(id).first();
 if(!draft)throw new ShopError('Photo job not found',404);
 if(draft.state==='discarded'||String(draft.expires_at)<=new Date().toISOString())throw new ShopError('Photo job expired or cancelled',410);
 if(body.action==='claim'){
  await requirePhotoQuotesOpen();
  const claimed=await db.prepare("UPDATE kk_photo_drafts SET state='analyzing' WHERE id=? AND state='uploaded'").bind(id).run();
  if(!claimed.meta.changes)throw new ShopError('Photo job already claimed',409);
  const image=await getMedia(String(draft.image_key));if(!image)throw new ShopError('Photo image missing',410);
  const buffer=image.bytes.buffer.slice(image.bytes.byteOffset,image.bytes.byteOffset+image.bytes.byteLength) as ArrayBuffer;
  return privateJson({input:photoAnalysisInput(buffer,String(draft.image_type),env.OPENAI_MODEL||'gpt-6.1-sol',String(draft.note),String(draft.country) as Country)});
 }
 if(body.action!=='complete')throw new ShopError('Unsupported job action',400);
 if(draft.state!=='analyzing')throw new ShopError('Photo job already completed',409);
 try{
  if(body.providerFailed)throw new ShopError('AI 查價服務暫時無法連線；尚未建立訂單。 / Photo AI is unavailable. No order was created.',503);
  const member=await memberForPhotoResearch(String(draft.member_id));if(!member)throw new ShopError('Member no longer exists',410);
  const actualModel=(body.result as {model?:string})?.model;
  if(actualModel!==(env.OPENAI_MODEL||'gpt-6.1-sol'))throw new ShopError('AI 模型不一致；尚未建立訂單。 / AI model mismatch. No order was created.',503);
  const analysis={...parsePhotoAnalysis(body.result,String(draft.country) as Country),providerModel:actualModel};
  const changed=await db.prepare("UPDATE kk_photo_drafts SET state='identified',analysis_json=? WHERE id=? AND state='analyzing'").bind(JSON.stringify(analysis),id).run();
  if(!changed.meta.changes)throw new ShopError('Photo job cancelled',410);
  await quoteDraft(draft,member,analysis);
  return privateJson({ok:true,state:'quoted'});
 }catch(error){
  const status=error instanceof ShopError?error.status:503;
  const message=error instanceof ShopError?error.message:'AI 查價資料無法驗證；尚未建立訂單。 / Photo research could not be verified. No order was created.';
  await db.prepare("UPDATE kk_photo_drafts SET state='failed',analysis_json=?,pricing_json=NULL WHERE id=? AND state IN ('analyzing','identified')").bind(JSON.stringify({photoResearchError:message,photoResearchStatus:status,photoResearchModel:!body.providerFailed&&(body.result as {model?:string})?.model||null}),id).run();
  return privateJson({ok:false,state:'failed',resultStatus:status});
 }
}catch(error){return failure(error);}}

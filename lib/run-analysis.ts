import {aiConfiguration} from './ai-config';
import { env } from "cloudflare:workers";
import {getMedia} from './media-store';
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { shoppingRequests } from "@/db/schema";
import { rawDb } from "./catalog";
import { analyzeProductImage, appendProgress, getRequestBundle } from "./request-data";
import {addOrderUpdate,calculate,legacyQuote,parseMember} from './commerce';
import {assertRepriceable} from './price-revisions';
import {tiers} from './commerce-types';
import {quoteSourceMessage,selectQuoteSource} from './quote-source';

export async function runAnalysis(id:number) {
  if(!aiConfiguration(env).configured) throw new Error("AI 尚未啟用：需要設定 AI 服務。訂單已保留，可先由管理員報價。");
  const row=await getDb().select().from(shoppingRequests).where(eq(shoppingRequests.id,id)).get();
  if(!row||row.kind!=="custom")throw new Error("找不到可辨識的客製訂單。");
  assertRepriceable({purchased_at:row.purchasedAt,status:row.status});
  const last=await rawDb().prepare('SELECT updated_at,analysis_state FROM shopping_requests WHERE id=?').bind(id).first();
  if(last?.analysis_state==='ready'&&Date.now()-Date.parse(String(last.updated_at))<60000)throw new Error('查價結果剛剛已更新，請稍後再試。');
  const claim=await rawDb().prepare("UPDATE shopping_requests SET analysis_state='analyzing',updated_at=? WHERE id=? AND (analysis_state != 'analyzing' OR updated_at < ?) RETURNING id").bind(new Date().toISOString(),id,new Date(Date.now()-180000).toISOString()).first();
  if(!claim)throw new Error("AI 正在辨識，請稍候再查看。");
  try {
    const image=await getMedia(row.imageKey);if(!image)throw new Error("找不到商品圖片。");
    const analysis=await analyzeProductImage(image.bytes.buffer.slice(image.bytes.byteOffset,image.bytes.byteOffset+image.bytes.byteLength),row.imageType,env.OPENAI_API_KEY||'netlify-gateway',env.OPENAI_MODEL||"gpt-6.1-sol",row.note,JSON.parse(row.pricingJson||'{}').items?.[0]?.sourceCountry==='JP'?'JP':'KR',env.KK_AI_GATEWAY_URL||'https://api.openai.com/v1/responses',env.KK_AI_GATEWAY_URL?env.KK_AI_GATEWAY_SECRET||'':'');
    await rawDb().prepare("UPDATE shopping_requests SET analysis_state='ready',ai_analysis_json=?,updated_at=? WHERE id=?").bind(JSON.stringify(analysis),new Date().toISOString(),id).run();
    const country=JSON.parse(row.pricingJson||'{}').items?.[0]?.sourceCountry==='JP'?'JP':'KR',selection=selectQuoteSource(analysis,country);
    const memberRow=row.memberId?await rawDb().prepare('SELECT * FROM kk_members WHERE id=?').bind(row.memberId).first():null;
    if(selection.kind==='ready'&&!row.paidAt&&['admin_review','submitted'].includes(row.status)){
      const {source}=selection,p={id:0,nameZh:analysis.identifiedNameZh,nameEn:analysis.identifiedNameEn,categoryZh:'AI 選品',categoryEn:'AI find',descriptionZh:'',descriptionEn:'',priceJpy:Math.ceil(selection.amount),imageKey:row.imageKey,status:'active',addon:false,allowedTiers:tiers,variants:[],sizeFeeTwd:0,stock:-1,purchaseUrl:source.url,sourceRequestId:row.id};
      const pricing=await calculate(memberRow?parseMember(memberRow):{id:'legacy',name:row.customerName,email:row.email,miles:0,spendJpy:0,spendKrw:0,tier:'standard',overrideTier:null},[{p,quantity:row.quantity,kind:'custom'}]);pricing.expiresAt=new Date(Date.now()+2*3600000).toISOString();
      Object.assign(pricing.items[0],{sourceCountry:country,sourceCurrency:source.currency,sourceAmount:selection.amount,priceBasis:selection.priceBasis,taxIncludedJpy:source.priceTaxIncludedJpy,taxFreeConditions:selection.conditions,taxEvidenceUrl:source.taxEvidenceUrl});
      await rawDb().prepare("UPDATE shopping_requests SET pricing_json=?,quote_json=?,status='quoted',identified_name_zh=?,identified_name_en=?,updated_at=? WHERE id=? AND paid_at IS NULL AND status IN ('admin_review','submitted')").bind(JSON.stringify(pricing),JSON.stringify(legacyQuote(pricing,p.nameZh,p.nameEn)),p.nameZh,p.nameEn,new Date().toISOString(),id).run();
      await addOrderUpdate(id,row.memberId||null,'quoted','AI 自動報價完成','AI quote ready',`${p.nameZh} · NT$${pricing.totalTwd.toLocaleString()}`);
    }else if(selection.kind!=='ready'&&!row.paidAt&&['admin_review','submitted'].includes(row.status)){
      await rawDb().prepare("UPDATE shopping_requests SET status='on_hold',identified_name_zh=?,identified_name_en=?,updated_at=? WHERE id=?").bind(analysis.identifiedNameZh||'需補充商品資訊',analysis.identifiedNameEn||'More product details required',new Date().toISOString(),id).run();
      await addOrderUpdate(id,row.memberId||null,'on_hold','AI 查價結果','AI lookup result',quoteSourceMessage(selection.kind,country));
    }else await appendProgress(id,row.email,row.status,"AI 商品查價已完成","AI product research ready",selection.kind==='ready'?'已保留現有訂單報價。':quoteSourceMessage(selection.kind,country),selection.kind==='ready'?'Existing quote preserved.':quoteSourceMessage(selection.kind,country));
  } catch(error) {
    await rawDb().prepare("UPDATE shopping_requests SET analysis_state='failed',updated_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
    console.error("ai_lookup_failed",error);
    throw new Error("AI 暫時無法完成辨識，訂單已保留；可重試或交由管理員報價。");
  }
  const updated=await getDb().select().from(shoppingRequests).where(eq(shoppingRequests.id,id)).get();
  return getRequestBundle(updated!);
}

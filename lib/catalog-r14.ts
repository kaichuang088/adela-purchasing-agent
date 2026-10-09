import verified from './catalog-r14-verified.json';
import dispositions from './catalog-r14-dispositions.json';
export async function applyCatalogR14(db:D1Database){
 const key='adela_catalog_r14_cost_plus_20261008';
 if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(key).first())return;
 const rows=(await db.prepare('SELECT id,name_en,status,price_jpy,commerce_json FROM products').all()).results;
 const statements:D1PreparedStatement[]=[];
 for(const patch of verified){
  const p=patch as Record<string,any>,row=rows.find(r=>r.name_en===p.match);
  if(!row||['paused','discontinued'].includes(String(row.status)))continue;
  const before=String(row.commerce_json||'{}'),previous=JSON.parse(before);
  // Do not overwrite seller changes made after the research snapshot.
  if(Number(row.price_jpy)!==p.expectedPriceKrw||String(previous.purchaseUrl||'')!==p.expectedSourceUrl)continue;
  const next={...previous,...p,stock:Number(previous.stock)>=0?previous.stock:p.stock,taxIncludedJpy:p.priceKrw,sourcePriceBasis:p.sourcePriceBasis||'retailer_listing'};
  if(p.clearTaiwanReference){for(const k of ['taiwanRetailTwd','taiwanPromotionTwd'])next[k]=0;for(const k of ['taiwanRetailSource','taiwanRetailClassification','taiwanRetailCheckedAt','taiwanAbsenceEvidence','taiwanAvailabilityCheckedAt'])next[k]='';next.taiwanAvailability='listed';}
  next.variants=(p.variants||[]).map((v:any)=>{const old=(previous.variants||[]).find((x:any)=>x.id===v.id);return {...v,stock:old&&Number(old.stock)>=0?old.stock:v.stock}});
  for(const k of ['match','expectedPriceKrw','expectedSourceUrl','clearTaiwanReference'])delete next[k];
  statements.push(db.prepare("UPDATE products SET name_zh=?,name_en=?,price_jpy=?,description_zh=?,description_en=?,status='active',commerce_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND commerce_json=? AND price_jpy=?").bind(p.nameZh,p.nameEn,p.priceKrw,p.descriptionZh,p.descriptionEn,JSON.stringify(next),row.id,before,p.expectedPriceKrw));
 }
 for(const patch of dispositions){
  const p=patch as Record<string,any>,row=rows.find(r=>r.name_en===p.match);
  if(!row||['paused','discontinued'].includes(String(row.status)))continue;
  const before=String(row.commerce_json||'{}'),previous=JSON.parse(before);
  // A source outage must not remove genuinely counted seller-owned stock.
  if(Number(previous.stock)>0)continue;
  if(p.disposition==='sold_out'&&p.purchaseUrl&&p.purchaseUrl!==previous.purchaseUrl)continue;
  const next={...previous,sourceCheckedAt:p.verifiedAt||'2026-10-07',sourceNotes:p.reason||'商品來源尚無法核實，保留管理員查核紀錄。',catalogReviewReason:p.reason||'',stockQuantityVerified:false};
  if(p.disposition==='sold_out')next.stock=0;
  statements.push(db.prepare('UPDATE products SET status=?,commerce_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND commerce_json=?').bind(p.disposition==='sold_out'&&Number(row.price_jpy)>1?'active':'research',JSON.stringify(next),row.id,before));
 }
 await db.batch([...statements,db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES (?,?)').bind(key,'true')]);
}

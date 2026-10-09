import references from './catalog-r15-references.json';
export async function applyCatalogR15(db:D1Database){
 const key='adela_handoff_20261008_r15';
 if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(key).first())return;
 const statements:D1PreparedStatement[]=[];
 // Explicit seller withdrawal. Keep IDs, variants and every order snapshot.
 statements.push(db.prepare("UPDATE products SET status='discontinued',updated_at=CURRENT_TIMESTAMP WHERE (lower(name_en) LIKE '%beyblade%' OR name_zh LIKE '%戰鬥陀螺%') AND status!='discontinued'"));
 for(const r of references){
  const data={catalogSourceId:r.sourceId,attachment:r.attachment,spec:r.spec,imageUrl:r.imageUrl,candidateSources:r.candidateSources,catalogReviewReason:r.reason,country:'KR',currency:'KRW',stock:-1,stockQuantityVerified:false,taxIncludedJpy:1,taxRefundEligible:false,variants:[],allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0};
  // One reference per supplied image, never a fictitious purchasable SKU.
  statements.push(db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,'附件核對','Attachment review',?,'Uploaded reference; exact SKU, cost and stock require review.',1,'research',? WHERE NOT EXISTS(SELECT 1 FROM products WHERE json_extract(commerce_json,'$.catalogSourceId')=?)").bind(r.nameZh,r.nameEn,r.reason,JSON.stringify(data),r.sourceId));
 }
 await db.batch([...statements,db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES (?,?)').bind(key,'true')]);
}

import introductions from './catalog-r17-introductions.json';
export async function applyCatalogR17(db:D1Database){
 const key='adela_content_20261009_r17';
 if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(key).first())return;
 const rows=(await db.prepare('SELECT * FROM products').all()).results,statements:D1PreparedStatement[]=[];
 for(const row of rows){
  const intro=(introductions as Record<string,{zh:string;en:string;ko:string}>)[String(row.name_en)];
  if(!intro)continue;
  const c=JSON.parse(String(row.commerce_json||'{}'));
  c.sourceDescriptionZh??=row.description_zh;c.sourceDescriptionEn??=row.description_en;c.sourceDescriptionKo??=c.descriptionKo||'';c.descriptionKo=intro.ko;
  let price=Number(row.price_jpy);
  if(row.name_en==="I'MINT Coffee Candy 32g · Choose a flavor"){
   c.previousSourcingR16={priceJpy:price,purchaseUrl:c.purchaseUrl,variants:c.variants};
   c.variants=c.variants.map((v:any)=>{
    const code=v.id==='coffee-0'?'4850616563':v.id==='coffee-1'?'4850646197':'';
    if(!code)return v;
    return {...v,priceJpy:4738,taxIncludedJpy:4738,purchaseUrl:'https://item.gmarket.co.kr/Item?goodsCode='+code,taiwanRetailTwd:130,taiwanRetailSource:'https://myship.7-11.com.tw/general/detail/GM2607092543072',taiwanRetailClassification:'preorder',taiwanRetailCheckedAt:'2026-10-09',sourcePriceBasis:'allocated_bundle_cost',acquisitionPack:{units:8,goodsKrw:34900,deliveryKrw:3000,totalKrw:37900,checkedAt:'2026-10-09'}};
   });
   price=4738;c.taxIncludedJpy=price;c.purchaseUrl=c.variants[0].purchaseUrl;c.sourcePriceBasis='allocated_bundle_cost';c.sourceCheckedAt='2026-10-09';
  }
  statements.push(db.prepare('UPDATE products SET description_zh=?,description_en=?,price_jpy=?,commerce_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(intro.zh,intro.en,price,JSON.stringify(c),row.id));
 }
 await db.batch([...statements,db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES (?,?)').bind(key,'true')]);
}

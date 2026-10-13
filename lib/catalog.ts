import {applyCatalogR23} from './catalog-r23';
import {applyCatalogR19} from './catalog-r19';
import {applyCatalogR17} from './catalog-r17';
import {applyCatalogR15} from './catalog-r15';
import {applyCatalogR14} from './catalog-r14';
import {applyCatalogR12} from './catalog-r12';
import {applyOctoberBatch} from './october-batch';
import {applyCatalogR9E} from './catalog-r9e';
import {applyCatalogR9} from './catalog-r9';
import {applyCatalogR8} from './catalog-r8';
import kiwiVariant20261003 from './kiwi-variant-20261003.json';
import groupedSnacks20261001 from './grouped-snacks-20261001.json';
import requestedCatalog20261001 from './requested-catalog-20261001.json';
import variantReferences20260930 from './taiwan-variant-prices-20260930.json';
import expansion20260930 from './expanded-catalog-20260930.json';
import references20260930 from './taiwan-price-evidence-20260930.json';
import copyRepairs20260930 from './seed-copy-repairs-20260930.json';
import koreanProductDescriptions from './korean-product-descriptions.json';
import koreanNames from "./catalog-korean-names.json";
import curated from "./curated-catalog.json";
import expanded from "./expanded-catalog.json";
import taiwanPriceEvidence from "./taiwan-price-evidence.json";
import { env } from "cloudflare:workers";
import type { VerifiedQuote } from "./types";

export type CatalogProduct = {
  id: number; nameZh: string; nameEn: string; categoryZh: string; categoryEn: string;
  descriptionZh: string; descriptionEn: string; priceJpy: number; imageKey: string | null;
  status: string; quote: VerifiedQuote | null; sourceRequestId: number | null; taxIncludedJpy?:number; taxRefundEligible?:boolean;
};
export function rawDb() { if (!env.DB) throw new Error("Storage unavailable"); return env.DB; }
export function parseProduct(row: Record<string, unknown>): CatalogProduct {
  const commerce=JSON.parse(String(row.commerce_json||'{}')),taxIncludedJpy=Number(commerce.taxIncludedJpy||row.price_jpy),taxRefundEligible=commerce.taxRefundEligible===true;
  return { id: Number(row.id), nameZh: String(row.name_zh), nameEn: String(row.name_en), categoryZh: String(row.category_zh), categoryEn: String(row.category_en), descriptionZh: String(row.description_zh), descriptionEn: String(row.description_en), priceJpy: taxIncludedJpy, taxIncludedJpy,taxRefundEligible,imageKey: row.image_key ? String(row.image_key) : null, status: String(row.status), quote: row.quote_json ? JSON.parse(String(row.quote_json)) : null, sourceRequestId: row.source_request_id ? Number(row.source_request_id) : null };
}
export async function catalogList(all = false) {
  await initializeCatalog();
  await applyCatalogR23(rawDb());
  const rows = await rawDb().prepare(all ? "SELECT * FROM products ORDER BY sort_order, id DESC" : "SELECT * FROM products WHERE status = 'active' ORDER BY sort_order, id DESC").all();
  return rows.results.map(parseProduct);
}
async function initializeCatalog() {
  const db=rawDb();
  // Bump this durable marker whenever a catalog migration is added below.
  const readyKey='adela_catalog_ready_r19';
  if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(readyKey).first())return;
  // This marker replaces the Japan assortment without changing historical order snapshots.
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korea_catalog_v1'").first()){
   const korea=[
    {nameZh:'Round Lab 1025 獨島化妝水',nameEn:'Round Lab 1025 Dokdo Toner',categoryZh:'韓國美妝',categoryEn:'Korean beauty',descriptionZh:'韓國官網 200 mL／500 mL。價格以韓國官網本次查核售價為基準，採買前仍須確認。',descriptionEn:'200 mL or 500 mL. Based on the current Korean official store listing; subject to confirmation.',price:11900,url:'https://www.roundlab.co.kr/product/1025-%EB%8F%85%EB%8F%84-%ED%86%A0%EB%84%88-200ml/22/category/1/display/2/',image:'https://www.roundlab.co.kr/web/product/small/202511/1ffc403996430656a003ac012165a2d6.jpg',variants:[['200ml','200 mL','200 mL',11900],['500ml','500 mL','500 mL',23000]],status:'active'},
    {nameZh:'Round Lab 白樺樹保濕防曬霜',nameEn:'Round Lab Birch Juice Moisturizing Sun Cream',categoryZh:'韓國美妝',categoryEn:'Korean beauty',descriptionZh:'50 mL。韓國官網目前售價 ₩22,500，採買前確認價格與庫存。',descriptionEn:'50 mL. Current official Korean listing ₩22,500; reconfirm availability and price.',price:22500,url:'https://www.roundlab.co.kr/product/%EC%9E%90%EC%9E%91%EB%82%98%EB%AC%B4-%EC%88%98%EB%B6%84-%EC%84%A0%ED%81%AC%EB%A6%BC-50ml/138/category/1/display/2/',image:'https://www.roundlab.co.kr/web/product/small/202511/5382c3e00c3b81536f432dc554d1802b.jpg',variants:[],status:'active'},
    {nameZh:'Le Labo SANTAL 33 淡香精',nameEn:'Le Labo Santal 33 Eau de Parfum',categoryZh:'韓國香氛',categoryEn:'Korean fragrance',descriptionZh:'韓國官網確認有此商品；待核對 15／50／100 mL 當前售價、圖片使用方式和庫存後公開。',descriptionEn:'Confirmed on the Korean official site; price, size availability and image usage require checking.',price:1,url:'https://www.lelabofragrances.co.kr/santal-33-987.html',image:'https://lelabokorea-java.s3.amazonaws.com/images/skus/050PS33100__PRODUCT_01--IMG_1200--SANTAL33--1030674724.jpg',variants:[],status:'draft'},
    {nameZh:'Le Labo ANOTHER 13 淡香精',nameEn:'Le Labo Another 13 Eau de Parfum',categoryZh:'韓國香氛',categoryEn:'Korean fragrance',descriptionZh:'韓國官網確認有此商品；價格及可購容量待核對。',descriptionEn:'Confirmed on the Korean official site; price and available sizes need verification.',price:1,url:'https://www.lelabofragrances.co.kr/another-13-747.html',image:'https://lelabokorea-java.s3.amazonaws.com/images/skus/050PA13100__PRODUCT_01--IMG_1200--ANOTHER13--1482494231.jpg',variants:[],status:'draft'},
    {nameZh:'農心 辛拉麵 5 入裝',nameEn:'Nongshim Shin Ramyun 5-pack',categoryZh:'韓國零食',categoryEn:'Korean snacks',descriptionZh:'每包 120g，5 入裝；採買價與照片核對後公開。',descriptionEn:'Five 120g packs. Publish after confirming current purchase price and image.',price:1,url:'https://brand.nongshim.com/shinramyun/main/index?prodCode=687',image:'',variants:[],status:'draft'},
    {nameZh:'農心 辛拉麵 Rosé 4 入裝',nameEn:'Nongshim Shin Ramyun Rosé 4-pack',categoryZh:'韓國零食',categoryEn:'Korean snacks',descriptionZh:'134g × 4 包，農心官網目前商品價 ₩5,280；韓國境內運費另計，確認採買總成本後才公開。',descriptionEn:'Four 134g packs. Official store listing ₩5,280 before Korean domestic shipping; verify procurement cost before publishing.',price:5280,url:'https://m.nongshimmall.com/product/detail.html?cate_no=43&display_group=1&product_no=4647',image:'https://m.nongshimmall.com/web/product/big/202605/46764057f0cd80cf9cd59c77b1696119.jpg',variants:[],status:'active'},
    {nameZh:'Orion 巧克力派 12 入裝',nameEn:'Orion Choco Pie 12-pack',categoryZh:'韓國零食',categoryEn:'Korean snacks',descriptionZh:'12 入裝；採買價與照片核對後公開。',descriptionEn:'12-pack. Publish after confirming current purchase price and image.',price:1,url:'https://www.orionworld.com/goods/view/26?category=0101&goodsno=5',image:'',variants:[],status:'draft'},
    {nameZh:'Orion 烏龜玉米脆片',nameEn:'Orion Kkobuk Chips',categoryZh:'韓國零食',categoryEn:'Korean snacks',descriptionZh:'原廠有玉米濃湯與巧克力吉拿棒口味；韓國在售包裝重量和兩款價格待核對後提供規格選項。',descriptionEn:'Brand lists corn soup and choco churros flavors; sizes and current prices require verification before options go live.',price:1,url:'https://www.orionworld.com/en/goods/view/37?goodsno=23&page=1',image:'',variants:[],status:'draft'},
    {nameZh:'三養 火雞炒麵系列',nameEn:'Samyang Buldak Hot Chicken Noodles',categoryZh:'韓國零食',categoryEn:'Korean snacks',descriptionZh:'韓國原廠有原味、奶油與 Rosé 系列；各口味與數量價格待核對後設定規格。',descriptionEn:'The Korean manufacturer lists Original, Carbonara and Rosé; current pack sizes and prices need verification.',price:1,url:'https://www.samyangfoods.com/kor/brand/spicyRamen.do',image:'',variants:[],status:'draft'},
    {nameZh:'賓格瑞 香蕉牛奶',nameEn:'Binggrae Banana Flavored Milk',categoryZh:'韓國零食',categoryEn:'Korean snacks',descriptionZh:'冰品及飲料跨境運送限制、規格、價格待確認，暫不上架。',descriptionEn:'Cross-border transport, size and price need verification; not for sale yet.',price:1,url:'https://www.bing.co.kr/product/detail?PDT=123',image:'',variants:[],status:'draft'}
   ];
   const common={currency:'KRW',country:'KR',purchaseAt:null,arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:-1,availableFrom:null,availableUntil:null,taxRefundEligible:false};
   const changes=[db.prepare("UPDATE products SET status='draft' WHERE status='active'"),...korea.map(s=>db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(s.nameZh,s.nameEn,s.categoryZh,s.categoryEn,s.descriptionZh,s.descriptionEn,s.price,s.status,JSON.stringify({...common,imageUrl:s.image,purchaseUrl:s.url,variants:s.variants.map(([id,labelZh,labelEn,priceJpy])=>({id,labelZh,labelEn,priceJpy}))}),s.nameEn)),db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korea_catalog_v1','true')")];
   await db.batch(changes);
  }
  // Deployments that already ran v1 still receive the extra Korean snack drafts.
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korea_catalog_v2' ").first()){
   const snacks=[
    {nameZh:'AMOS Peelerz 芒果剝皮軟糖（30g × 34）',nameEn:'AMOS Peelerz Mango Gummies 30g x 34',descriptionZh:'韓國 Costco 線上標價 ₩17,490（已含當地配送）；原產地為中國、在韓國販售，採買時仍須確認會員資格、存貨與售價。整盒 34 小包，不拆包販售。',descriptionEn:'Sold by Costco Korea for ₩17,490 including local delivery. Made in China. One box has 34 × 30g packs; reconfirm membership and stock.',price:17490,url:'https://www.costco.co.kr/Foods/Snack/CandyGum/Amos-Peelerz-Mango-Gummies-1020g-30g-x-34/p/677487'},
    {nameZh:"I'MINT 無糖咖啡糖（32g）",nameEn:"I'MINT Sugar-Free Coffee Candy 32g",descriptionZh:'原廠列有美式與濃縮兩款，每款 32g；待確認韓國商店現貨、韓元售價和可選口味後才上架。此品牌未確認為韓國製造。',descriptionEn:'Manufacturer lists Americano and Espresso, 32g each. Confirm Korean retailer, KRW price and stock before publishing; Korean manufacture not verified.',price:1,url:'https://www.imintcandy.com/Product/20260511-211.html'},
    {nameZh:'農心 蝦味先（새우깡）',nameEn:'Nongshim Saewookkang Shrimp Crackers',descriptionZh:'韓國農心經典蝦味餅乾；包裝重量、採買價與圖片待核對。',descriptionEn:'Korean Nongshim shrimp crackers; verify pack size, current KRW price and image.',price:1,url:'https://brand.nongshim.com/saewookkang/main/index'},
    {nameZh:'農心 炸醬麵（짜파게티）',nameEn:'Nongshim Chapagetti',descriptionZh:'韓國農心炸醬麵；每包重量、幾包裝及韓元售價待確認。',descriptionEn:'Korean Nongshim black bean noodles; verify weight, pack count and KRW price.',price:1,url:'https://brand.nongshim.com/chapagetti/main/index'},
    {nameZh:'Orion My Gummy 水果軟糖',nameEn:'Orion My Gummy Fruit Gummies',descriptionZh:'韓國 Orion 水果軟糖系列；口味、單包克數及價格待韓國商店確認。',descriptionEn:'Orion fruit gummy series; confirm Korean retailer flavors, size and price.',price:1,url:'https://www.orionworld.com/en/goods/view/27?goodsno=73&page=1'},
    {nameZh:'Lotte 樂天 Pepero 巧克力棒',nameEn:'Lotte Pepero Chocolate Sticks',descriptionZh:'韓國樂天 Pepero 系列；實際口味、克數及採買價待確認。',descriptionEn:'Korean Lotte Pepero range; confirm available flavor, weight and purchase price.',price:1,url:'https://www.lottewellfood.com/prcenter/news/1855?page=1&searchText=%EC%84%9C%ED%8F%AC%ED%84%B0%EC%A6%88&searchType2=Y'},
    {nameZh:'HBAF 蜂蜜奶油杏仁',nameEn:'HBAF Honey Butter Almond',descriptionZh:'韓國 HBAF 品牌系列；韓國目前可買的容量、官方售價及圖片待確認。',descriptionEn:'Korean HBAF brand; confirm pack size, Korean retailer price and image.',price:1,url:'https://en.hbaf.com/products/'},
    {nameZh:'海太 蜂蜜奶油洋芋片',nameEn:'Haitai Honey Butter Chips',descriptionZh:'韓國海太零食系列；韓元售價、規格及目前可購性待確認。',descriptionEn:'Korean Haitai snack; confirm KRW price, package and availability.',price:1,url:'https://www.haitai.co.kr/m/eng/product'}
   ];
   const common={currency:'KRW',country:'KR',purchaseAt:null,arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:-1,availableFrom:null,availableUntil:null,taxRefundEligible:false,variants:[],imageUrl:''};
   await db.batch([...snacks.map(s=>db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,'韓國零食','Korean snacks',?,?,?,'draft',? WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(s.nameZh,s.nameEn,s.descriptionZh,s.descriptionEn,s.price,JSON.stringify({...common,purchaseUrl:s.url}),s.nameEn)),db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korea_catalog_v2','true')")]);
  }
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korea_catalog_v3'").first()){
   const snacks=[
    ['Orion 烏龜脆片 辣味','Orion Kkobuk Chips Spicy','Orion 原廠列有辣味款；重量、韓國售價與庫存待核對。','https://www.orionworld.com/en/goods/view/26?goodsno=115&page=1'],
    ['Orion 巧克力派','Orion Choco Pie','原廠經典巧克力派；本次購買包數及韓國售價待核對。','https://www.orionworld.com/en/goods/view/27?category=0101&goodsno=5'],
    ['Orion 巧克力蘑菇餅','Orion Choco Songyi','巧克力與餅乾組合；本次購買規格、售價待核對。','https://www.orionworld.com/en/goods/view/26?goodsno=55&page=1'],
    ['Orion 洋芋片','Orion Poca Chips','Orion 原廠洋芋片；口味、克數與韓國售價待核對。','https://www.orionworld.com/en/goods/view/28?category=0102&goodsno=26&page=1'],
    ['Orion 雞米花脆點','Orion Chicken Pop','原廠列有甜酸雞與起司口味；規格及售價待核對。','https://www.orionworld.com/en/goods/view/26?goodsno=18&page=1'],
    ['Orion Market O 濕潤巧克力豆餅乾','Orion Market O Moist Choco Chip Cookie','原廠 Market O 系列餅乾；包數與韓國售價待核對。','https://www.orionworld.com/en/goods/view/33?goodsno=58&page=1'],
    ['農心 洋蔥圈','Nongshim Onion Rings','農心原廠洋蔥圈；包裝規格和韓國售價待核對。','https://brand.nongshim.com/onionrings/main/index'],
    ['農心 香蕉脆餅','Nongshim Banana Kick','農心原廠香蕉脆餅；包裝規格和韓國售價待核對。','https://brand.nongshim.com/bananakicksnack/main/index'],
    ['樂天 Malang Cow 牛奶軟糖','Lotte Malang Cow Milk Candy','樂天原廠軟糖系列；當前販售口味和韓國售價待核對。','https://www.lottewellfood.com/prcenter/news/833?page=1']
   ];
   const common={currency:'KRW',country:'KR',purchaseAt:null,arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:-1,availableFrom:null,availableUntil:null,taxRefundEligible:false,variants:[],imageUrl:''};
   await db.batch([...snacks.map(([nameZh,nameEn,descriptionZh,url])=>db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,'韓國零食','Korean snacks',?,?,1,'draft',? WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(nameZh,nameEn,descriptionZh,descriptionZh,JSON.stringify({...common,purchaseUrl:url}),nameEn)),db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korea_catalog_v3','true')")]);
  }
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korea_catalog_v5'").first()){
   const picks=[
    {nameZh:'AMOS Peelerz 芒果剝皮軟糖（30g × 34）',nameEn:'AMOS Peelerz Mango Gummies 30g x 34',price:17490,image:'https://www.costco.co.kr/medias/sys_master/images/h51/hba/395947361009694.jpg',url:'https://www.costco.co.kr/Foods/Snack/CandyGum/Amos-Peelerz-Mango-Gummies-1020g-30g-x-34/p/677487',descriptionZh:'整包 1,020g，內含 30g × 34 小包；韓國 Costco 線上售價 ₩17,490（含韓國境內配送）。原產地中國，採買前再確認 Costco 會員購買資格與存貨。',descriptionEn:'1,020g pack containing 34 × 30g pouches. Costco Korea online price ₩17,490 with local delivery; made in China. Reconfirm membership and stock.'},
    {nameZh:'LOTTE 樂天 Pepero 六口味綜合包（15 盒）',nameEn:'LOTTE Pepero Assorted 644g / 15-pack',price:19490,image:'https://www.costco.co.kr/medias/sys_master/images/h6a/h39/241424487284766.jpg',url:'https://www.costco.co.kr/Foods/Snack/CookieCracker/LOTTE-Pepero-Assorted-644g-15PK/p/666548',descriptionZh:'整組 644g、15 盒：原味 3、杏仁 3、巧克力夾心 2、白餅乾 2、Crunky 3、巧克力餅乾 2；韓國 Costco 線上 ₩19,490（含韓國境內配送）。',descriptionEn:'644g, 15 boxes across six flavors. Costco Korea online price ₩19,490 including local shipping.'},
    {nameZh:'三養 火雞炒麵大杯（105g × 16 杯）',nameEn:'Samyang Buldak Large Cup 105g x 16',price:20990,image:'https://samyangfoods.co.kr/data/goods/1/2023/07/100014_2023072617275012.jpg',url:'https://www.costco.co.kr/Foods/Processed-Food/PastaNoodles/Samyang-Buldak-Cup-Ramyun-105g-x-16/p/638431',descriptionZh:'整箱 105g × 16 杯，原味辣火雞炒麵；韓國 Costco 線上 ₩20,990（含韓國境內配送），商品照片為三養原廠同規格。',descriptionEn:'Sixteen 105g original spicy cups. Costco Korea online ₩20,990 including local shipping; exact-pack image from Samyang.'},
    {nameZh:'農心 人氣零食綜合包（30g × 36 包）',nameEn:'Nongshim Assorted Snacks 1080g / 36 packs',price:20990,image:'https://www.costco.co.kr/medias/sys_master/images/hb3/hb0/240119692460062.jpg',url:'https://www.costco.co.kr/Foods/Snack/CookieCracker/Nogshim-Assorted-Snacks-1080g-36/p/516641',descriptionZh:'1,080g 共 36 小包，含蝦味先、蜂蜜麻花、地瓜脆片、Jagalchi 與薯條脆片；韓國 Costco 線上 ₩20,990（含韓國境內配送）。',descriptionEn:'36 mini packs, 1,080g total, five Nongshim flavors. Costco Korea online ₩20,990 including local shipping.'},
    {nameZh:'海太 Homerun Ball 巧克力泡芙（128g × 6）',nameEn:'Haitai Homerun Ball Chocolate 128g x 6',price:17890,image:'https://www.costco.co.kr/medias/sys_master/images/hfb/hd5/241424492691486.jpg',url:'https://www.costco.co.kr/Foods/Snack/CookieCracker/Haitai-Homerun-Ball-768g-128g-x-6/p/671210',descriptionZh:'整組 768g，128g × 6 盒；韓國 Costco 線上 ₩17,890（含韓國境內配送）。',descriptionEn:'768g total, six 128g boxes. Costco Korea online ₩17,890 including local shipping.'},
    {nameZh:'Orion 好麗友零食綜合包（30g × 26 包）',nameEn:'Orion Snack Assortment 780g / 26 packs',price:16490,image:'https://www.costco.co.kr/medias/sys_master/images/h38/h13/242569486401566.jpg',url:'https://www.costco.co.kr/Foods/Snack/CookieCracker/Orion-Snack-Assortment-780g-26ea/p/603457',descriptionZh:'30g × 26 包：Poca Chip 原味 7、洋蔥 6、Swing Chip 6、O! Gamja 7；韓國 Costco 線上 ₩16,490（含韓國境內配送）。',descriptionEn:'26 × 30g: Poca Chip original 7, onion 6, Swing Chip 6, O! Gamja 7. Costco Korea online ₩16,490 including local shipping.'}
   ];
   const common={currency:'KRW',country:'KR',purchaseAt:null,arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:-1,availableFrom:null,availableUntil:null,taxRefundEligible:false,variants:[]};
   await db.batch([...picks.map(x=>db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,'韓國零食','Korean snacks',?,?,?,'active',? WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(x.nameZh,x.nameEn,x.descriptionZh,x.descriptionEn,x.price,JSON.stringify({...common,imageUrl:x.image,purchaseUrl:x.url}),x.nameEn)),db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korea_catalog_v5','true')")]);
   // Existing matching draft becomes sellable with the exact verified pack, price, source and photo.
   const mango=picks[0];
   await db.prepare("UPDATE products SET status='active',price_jpy=?,description_zh=?,description_en=?,commerce_json=? WHERE name_en=?").bind(mango.price,mango.descriptionZh,mango.descriptionEn,JSON.stringify({...common,imageUrl:mango.image,purchaseUrl:mango.url}),mango.nameEn).run();
  }
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korea_catalog_v6'").first()){
   const picks=[
    {nameZh:'農心 辛拉麵非油炸麵（97g × 20 包）',nameEn:'Nongshim Shin Non-Fried Ramyun 97g x 20',price:21990,image:'https://www.costco.co.kr/medias/sys_master/images/h8c/h1b/228113698521118.jpg',url:'https://www.costco.co.kr/Foods/Processed-Food/PastaNoodles/Nongshim-Shin-Non-Fried-Ramyun-97g-x-20/p/620834',descriptionZh:'非油炸辛拉麵 97g × 20 包；韓國 Costco 線上標價 ₩21,990，含韓國境內配送。',descriptionEn:'Twenty 97g non-fried Shin Ramyun packs. Costco Korea online ₩21,990, local delivery included.'},
    {nameZh:'HBAF 四口味爆米花（80g × 16 包）',nameEn:'HBAF Popcorn Four Flavors 80g x 16',price:15990,image:'https://www.costco.co.kr/medias/sys_master/images/hcc/h27/310622616911902.jpg',url:'https://www.costco.co.kr/Foods/Snack/Chocolates-Bars/HBAF-Four-Popcorn-Set-1280g-OPTION1/p/680056-OPTION1',descriptionZh:'選項 1：蜂蜜奶油、鹽牛奶、焦糖起司、烤玉米各 4 包，共 16 包、每包 80g。韓國 Costco 線上標價 ₩15,990，含韓國境內配送。',descriptionEn:'Option 1: four 80g bags each of honey butter, salted milk, caramel and cheese, and baked corn. Costco Korea online ₩15,990 with local delivery.'}
   ];
   const common={currency:'KRW',country:'KR',purchaseAt:null,arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:-1,availableFrom:null,availableUntil:null,taxRefundEligible:false,variants:[]};
   await db.batch([...picks.map(x=>db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,'韓國零食','Korean snacks',?,?,?,'active',? WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(x.nameZh,x.nameEn,x.descriptionZh,x.descriptionEn,x.price,JSON.stringify({...common,imageUrl:x.image,purchaseUrl:x.url}),x.nameEn)),db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korea_catalog_v6','true')")]);
  }
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korea_catalog_v7'").first()){
   const picks=[
    {nameZh:"I'MINT Espresso 無糖咖啡糖（32g × 4）",nameEn:"I'MINT Espresso Coffee Candy 32g x 4",categoryZh:'韓國零食',categoryEn:'Korean snacks',price:19580,image:'https://img.danuri.io/catalog-image/643/972/123/3849d215f59e4642856a375db5de06fe.jpg?_v=20260824092932&shrink=330%3A%2A',url:'https://prod.danawa.com/info/?pcode=123972643',descriptionZh:'32g × 4 盒；韓國 Danawa 比價頁參考最低價 ₩19,580，賣場實際售價與配送費下單前須確認。',descriptionEn:'Four 32g boxes. Korean Danawa comparison reference ₩19,580; confirm seller availability and shipping before purchase.'},
    {nameZh:'Round Lab 1025 獨島化妝水＋乳液（200ml × 2）',nameEn:'Round Lab 1025 Dokdo Toner and Lotion 200ml x 2',categoryZh:'韓國美妝',categoryEn:'Korean beauty',price:27200,image:'https://cf-images-stg.oliveyoung.co.kr/cf-goods/uploads/images/thumbnails/10/0000/0013/A00000013717928ko.jpg?l=ko',url:'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000137179',descriptionZh:'Olive Young 韓國套裝：化妝水 200ml＋乳液 200ml，當期頁面標示 ₩27,200；折扣與庫存可能變動。',descriptionEn:'Olive Young Korea toner 200ml plus lotion 200ml set. Listing ₩27,200; promotion and stock can change.'},
    {nameZh:'Torriden DIVE-IN 防曬精華（50ml＋20ml）',nameEn:'Torriden DIVE-IN Watery Fit Sun Serum 50ml + 20ml',categoryZh:'韓國美妝',categoryEn:'Korean beauty',price:19900,image:'https://image.oliveyoung.co.kr/cfimages/cf-goods/uploads/images/thumbnails/10/0000/0021/A00000021949506ko.jpg?l=ko',url:'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000219495',descriptionZh:'Olive Young 韓國 50ml 加贈 20ml 套裝；頁面優惠標價 ₩19,900，採買前確認活動和現貨。',descriptionEn:'Olive Young Korea 50ml plus 20ml set. Promotional listing ₩19,900; reconfirm sale and stock.'}
   ];
   const common={currency:'KRW',country:'KR',purchaseAt:null,arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:-1,availableFrom:null,availableUntil:null,taxRefundEligible:false,variants:[]};
   await db.batch([...picks.map(x=>db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,?,?,?,?,?,'active',? WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(x.nameZh,x.nameEn,x.categoryZh,x.categoryEn,x.descriptionZh,x.descriptionEn,x.price,JSON.stringify({...common,imageUrl:x.image,purchaseUrl:x.url}),x.nameEn)),db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korea_catalog_v7','true')")]);
  }
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korea_catalog_v8'").first()){
   // Exact Korean shop listings only. A draft has no verified buyable Korean price.
   const items=[
    {nameZh:'好麗友 果實口感軟糖（36g × 6 包）',nameEn:'Orion Fruit Bits Gummies 36g x 6',categoryZh:'韓國零食',categoryEn:'Korean snacks',price:5980,status:'active',image:'https://product-image.kurly.com/hdims/resize/%5E%3E720x%3E936/cropcenter/720x936/quality/85/src/product/image/296c64c3-7151-470d-958e-bd1027ecf5e1.jpg',url:'https://www.kurly.com/goods/1000279292',descriptionZh:'韓國 Kurly 單包 216g（36g × 6），5 種口味選一；₩2,980 加單獨配送 ₩3,000，結帳前仍須確認庫存及配送。',descriptionEn:'216g (six 36g packs); choose one of five flavors. Korean Kurly ₩2,980 plus ₩3,000 single-order delivery; reconfirm stock.',variants:['李子｜Plum｜5980','荔枝｜Lychee｜5980','奇異果｜Kiwi｜5980','葡萄｜Grape｜5980','可可芒果｜Coco Mango｜5980']},
    {nameZh:'Torriden SOLID-IN 神經醯胺護唇精華 11ml',nameEn:'Torriden SOLID-IN Ceramide Lip Essence 11ml',categoryZh:'韓國美妝',categoryEn:'Korean beauty',price:7000,status:'active',image:'https://image.oliveyoung.co.kr/cfimages/cf-goods/uploads/images/thumbnails/10/0000/0016/A00000016051323ko.jpg?l=ko',url:'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000160513',descriptionZh:'Olive Young 韓國在售 11ml；頁面標價 ₩7,000，採買時核對現貨與售價。',descriptionEn:'11ml lip essence at Olive Young Korea, listed ₩7,000; verify stock at purchase.',variants:[]},
    {nameZh:'Stüssy Basic Tee 卡其色',nameEn:'Stüssy Basic Tee Khaki',categoryZh:'韓國潮流服飾',categoryEn:'Korean streetwear',price:75000,status:'active',image:'https://kr.stussy.com/cdn/shop/files/1905000_KHAK_1.jpg?v=1768244265&width=1920',url:'https://kr.stussy.com/products/1905000-basic-stussy-tee-khaki',descriptionZh:'韓國 Stüssy 官網標價 ₩75,000，卡其色；下單前選擇 XS–XXL。尺碼庫存以採買時為準。',descriptionEn:'Khaki basic tee, ₩75,000 at Stüssy Korea. Choose XS–XXL; availability may change.',variants:['XS｜XS｜75000','S｜S｜75000','M｜M｜75000','L｜L｜75000','XL｜XL｜75000','XXL｜XXL｜75000']},
    {nameZh:'Stüssy Big Stock 棒球帽 Royal',nameEn:'Stüssy Big Stock Snapback Cap Royal',categoryZh:'韓國潮流服飾',categoryEn:'Korean streetwear',price:85000,status:'active',image:'https://kr.stussy.com/cdn/shop/files/1311209_ROYL_1.jpg?v=1785438498&width=1920',url:'https://kr.stussy.com/products/1311209-big-stock-snapback-cap-royal',descriptionZh:'韓國 Stüssy 官網標價 ₩85,000，單一尺寸；現貨以採買時為準。',descriptionEn:'Royal cap, ₩85,000 on Stüssy Korea; one size. Verify stock before purchase.',variants:[]},
    {nameZh:'Le Labo SANTAL 33 香水',nameEn:'Le Labo SANTAL 33 Eau de Parfum',categoryZh:'香水與香氛',categoryEn:'Fragrance',price:1,status:'draft',image:'',url:'https://www.lelabofragrances.co.kr/santal-33-987.html',descriptionZh:'韓國官網有售；容量和韓元價格需逐一核實才開放下單。',descriptionEn:'Available on official Korea site; size and KRW prices require verification before sale.',variants:[]},
    {nameZh:'Le Labo ANOTHER 13 香氛護手霜 30ml',nameEn:'Le Labo ANOTHER 13 Perfuming Hand Cream 30ml',categoryZh:'香水與香氛',categoryEn:'Fragrance',price:1,status:'draft',image:'',url:'https://www.lelabofragrances.co.kr/classic-collection/another-13/perfuming-hand-cream/30-ml',descriptionZh:'韓國官網有售；韓元價格待核實。',descriptionEn:'Official Korean product; KRW price needs verification.',variants:[]},
    {nameZh:'Diptyque Do Son 淡香精 75ml',nameEn:'Diptyque Do Son Eau de Parfum 75ml',categoryZh:'香水與香氛',categoryEn:'Fragrance',price:1,status:'draft',image:'',url:'https://us.diptyqueparis.com/en-us/products/eau-de-parfum-do-son-dosonp75cv1',descriptionZh:'韓國在售價格與現貨尚未核實；暫不接受下單。',descriptionEn:'Korean price and stock require verification before sale.',variants:[]},
    {nameZh:'Byredo Blanche 淡香精 50ml',nameEn:'Byredo Blanche Eau de Parfum 50ml',categoryZh:'香水與香氛',categoryEn:'Fragrance',price:1,status:'draft',image:'',url:'https://www.ssg.com/item/itemView.ssg?itemId=1000060313129',descriptionZh:'韓國在售價格、規格與現貨尚未核實；暫不接受下單。',descriptionEn:'Korean price, size and stock require verification before sale.',variants:[]},
    {nameZh:"I'MINT 美式咖啡糖（32g × 4）",nameEn:"I'MINT Americano Candy 32g x 4",categoryZh:'韓國零食',categoryEn:'Korean snacks',price:1,status:'draft',image:'',url:'https://www.imintcandy.com/index.php?a=index&c=Lists&lang=cn&m=home&tid=3',descriptionZh:'三種口味之一；韓國四盒價格與照片待確認。',descriptionEn:'One of three flavors; four-tin Korean price and image pending.',variants:[]},
    {nameZh:"I'MINT 抹茶拿鐵糖（32g × 4）",nameEn:"I'MINT Matcha Latte Candy 32g x 4",categoryZh:'韓國零食',categoryEn:'Korean snacks',price:1,status:'draft',image:'',url:'https://www.imintcandy.com/index.php?a=index&c=Lists&lang=cn&m=home&tid=3',descriptionZh:'三種口味之一；韓國四盒價格與照片待確認。',descriptionEn:'One of three flavors; four-tin Korean price and image pending.',variants:[]}
   ];
   const common={country:'KR',currency:'KRW',arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:-1,taxRefundEligible:false};
   await db.batch([...items.map(item=>db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(item.nameZh,item.nameEn,item.categoryZh,item.categoryEn,item.descriptionZh,item.descriptionEn,item.price,item.status,JSON.stringify({...common,imageUrl:item.image,purchaseUrl:item.url,variants:item.variants.map((v,i)=>{const [labelZh,labelEn,priceJpy]=v.split('｜');return{id:'flavor-'+i,labelZh,labelEn,priceJpy:Number(priceJpy)};})}),item.nameEn)),db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.taiwanRetailTwd',780,'$.taiwanRetailSource','https://www.momoshop.com.tw/TP/TP0010028/goodsDetail/TP00100280000498') WHERE name_en=?").bind("I'MINT Espresso Coffee Candy 32g x 4"),db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.taiwanRetailTwd',190,'$.taiwanRetailSource','https://www.momoshop.com.tw/TP/TP0010028/goodsDetail/TP00100280000023') WHERE name_en=?").bind("Torriden SOLID-IN Ceramide Lip Essence 11ml"),db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korea_catalog_v8','true')")]);
  }
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korea_catalog_v9'").first()){
   const picks=[
    {nameZh:'Stüssy Relaxed Zip Hoodie 連帽外套 Natural',nameEn:'Stüssy Relaxed Zip Hoodie Natural',category:'韓國潮流服飾',categoryEn:'Korean streetwear',price:219000,image:'https://kr.stussy.com/cdn/shop/files/118571_NATL_1.jpg?v=1760550487&width=1920',url:'https://kr.stussy.com/products/118571-relaxed-zip-hoodie-natural',description:'Stüssy 韓國官網 ₩219,000。下單選 S、M、L、XL 或 XXL；採買時再次確認尺碼及庫存。',variants:['S','M','L','XL','XXL']},
    {nameZh:'Fillimilli 885 腮紅刷',nameEn:'Fillimilli Point Blusher Brush 885',category:'韓國美妝',categoryEn:'Korean beauty',price:8000,image:'https://image.oliveyoung.co.kr/cfimages/cf-goods/uploads/images/thumbnails/10/0000/0022/A00000022964505ko.jpg?l=ko',url:'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000229645',description:'Olive Young 韓國目前特價 ₩8,000（原價 ₩10,000）；採買時以實際售價與活動為準。',variants:[]},
    {nameZh:'WAKEMAKE 鐵壁眼線液筆 1+1',nameEn:'WAKEMAKE Strong Pen Eyeliner 1+1',category:'韓國美妝',categoryEn:'Korean beauty',price:11700,image:'https://image.oliveyoung.co.kr/cfimages/cf-goods/uploads/images/thumbnails/10/0000/0013/A000000136300111ko.jpg?l=ko',url:'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000136300',description:'Olive Young 韓國 1+1 企劃活動 ₩11,700，頁面有 3 色；顏色與活動價須確認後再開放選購。',variants:[],status:'draft'}
   ];
   const common={country:'KR',currency:'KRW',arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:-1,taxRefundEligible:false};
   await db.batch([...picks.map(x=>db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(x.nameZh,x.nameEn,x.category,x.categoryEn,x.description,x.description,x.price,x.status||'active',JSON.stringify({...common,imageUrl:x.image,purchaseUrl:x.url,variants:x.variants.map((size,i)=>({id:`size-${i}`,labelZh:size,labelEn:size,priceJpy:x.price}))}),x.nameEn)),db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korea_catalog_v9','true')")]);
  }
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korea_catalog_v10'").first()){
   const snacks=[
    {nameZh:'農心 蝦味先 90g',nameEn:'Nongshim Saewookkang Shrimp Crackers 90g',price:1260,image:'https://product-image.kurly.com/hdims/resize/%5E%3E720x%3E936/cropcenter/720x936/quality/85/src/product/image/f52cc0c5-539c-4cbc-a845-01c23dea1585.jpg',url:'https://www.kurly.com/goods/5061325',description:'韓國 Kurly 原價 ₩1,260，90g 一包；網購單買配送費另計，採買前核對韓國店面與網站價格。'},
    {nameZh:'好麗友 四種經典零食組（4 包）',nameEn:'Orion Korean Snack Mix 4 Bags',price:3380,image:'https://img-cf.kurly.com/hdims/resize/%5E%3E720x%3E936/cropcenter/720x936/quality/85/src/shop/data/goods/1648203345367l0.jpg',url:'https://www.kurly.com/goods/5069938',description:'韓國 Kurly 原價 ₩3,380，包含烏龜脆片玉米濃湯、Poca Chip、Sun、O! Gamja 各一包，35–49g × 4；網購配送費另計。'},
    {nameZh:'三養 辣火雞炒麵 140g × 5 包',nameEn:'Samyang Buldak Noodles 140g x 5',price:5100,image:'https://product-image.kurly.com/hdims/resize/%5E%3E720x%3E936/cropcenter/720x936/quality/85/src/product/image/0ac99732-e9ee-4de5-8906-4ac3c8fcc854.jpg',url:'https://www.kurly.com/goods/5069816',description:'韓國 Kurly 原味 140g × 5 包，原價 ₩5,100；網購單買配送費另計。'}
   ];
   const common={country:'KR',currency:'KRW',arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:-1,taxRefundEligible:false,variants:[]};
   await db.batch([...snacks.map(x=>db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json) SELECT ?,?,'韓國零食','Korean snacks',?,?,?,'active',? WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(x.nameZh,x.nameEn,x.description,x.description,x.price,JSON.stringify({...common,imageUrl:x.image,purchaseUrl:x.url}),x.nameEn)),db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korea_catalog_v10','true')")]);
  }
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_curated_20260925_wallet'").first()){
    const categories:Record<string,[string,string]>={snacks:['韓國零食','Korean snacks'],beauty:['韓國美妝','Korean beauty'],fashion:['韓國潮流服飾','Korean streetwear'],fragrance:['香水與香氛','Fragrance']};
    const statements=[];
    for(const item of curated){
      const category=categories[item.category]||categories.snacks;
      const commerce={country:'KR',currency:'KRW',nameKo:item.nameKo,arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:item.stock,taxRefundEligible:false,taxIncludedJpy:item.price,imageUrl:item.image,purchaseUrl:item.url,taiwanRetailTwd:item.retailTwd,taiwanRetailSource:item.retailUrl,sourcePriceBasis:item.sourcePriceBasis,sourceCheckedAt:item.sourceCheckedAt,variants:item.sizes.map((size,i)=>({id:'size-'+i,labelZh:size,labelEn:size,priceJpy:item.price}))};
      statements.push(db.prepare("UPDATE products SET name_zh=?,category_zh=?,category_en=?,description_zh=?,description_en=?,price_jpy=?,status='active',commerce_json=?,sort_order=-10 WHERE name_en=? AND status='draft'").bind(item.nameZh,category[0],category[1],item.descriptionZh,item.nameEn+' · Korea retail listing.',item.price,JSON.stringify(commerce),item.nameEn));
      statements.push(db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json,sort_order) SELECT ?,?,?,?,?,?,?,'active',?,-10 WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(item.nameZh,item.nameEn,category[0],category[1],item.descriptionZh,item.nameEn+' · Korea retail listing. See source for exact pack and availability.',item.price,JSON.stringify(commerce),item.nameEn));
    }
    statements.push(db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_curated_20260925_wallet','true')"));
    await db.batch(statements);
  }
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_price_evidence_20260927'").first()){
   const statements=[];
   for(const item of curated){
    statements.push(db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.sourcePriceBasis',?) WHERE name_en=? AND json_extract(commerce_json,'$.sourcePriceBasis') IS NULL").bind(item.sourcePriceBasis,item.nameEn));
    if(item.nameEn==="I'MINT Espresso Coffee Candy 32g")statements.push(db.prepare("UPDATE products SET price_jpy=?,description_zh=?,commerce_json=json_set(commerce_json,'$.taxIncludedJpy',?,'$.purchaseUrl',?,'$.sourcePriceBasis','retailer_listing','$.sourceCheckedAt',?) WHERE name_en=? AND price_jpy=6767 AND json_extract(commerce_json,'$.purchaseUrl')='https://item.gmarket.co.kr/Item?goodscode=4845821356'").bind(item.price,item.descriptionZh,item.price,item.url,item.sourceCheckedAt,item.nameEn));
   }
   statements.push(db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_price_evidence_20260927','true')"));await db.batch(statements);
  }

  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korean_names_20260927'").first()) {
    await db.batch([
      ...Object.entries(koreanNames).map(([nameEn,nameKo])=>db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.nameKo',?) WHERE name_en=? AND COALESCE(json_extract(commerce_json,'$.nameKo'),'')=''").bind(nameKo,nameEn)),
      db.prepare("INSERT INTO store_settings(key,value) VALUES('adela_korean_names_20260927','true')")
    ]);
  }


  // Reviewed expansion is insert-only: never undo an administrator's price or status edits.
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_expanded_20260928_v2'").first()) {
    const statements = expanded.map(item => {
      const categories:Record<string,[string,string]>={beauty:['韓國美妝','Korean beauty'],fashion:['韓國潮流服飾','Korean streetwear'],fragrance:['香水與香氛','Fragrance']};
      const category=categories[item.category] || categories.fragrance;
      const commerce = {country:'KR',currency:'KRW',nameKo:item.nameKo,brand:item.brand,retailer:item.retailer,spec:item.spec,catalogSourceId:item.id,arrivalHours:0,addon:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,stock:item.stock,taxRefundEligible:false,taxIncludedJpy:item.price,imageUrl:item.image,purchaseUrl:item.url,taiwanRetailTwd:item.retailTwd,taiwanRetailSource:item.retailUrl,taiwanRetailCheckedAt:item.retailCheckedAt,sourcePriceBasis:item.sourcePriceBasis,sourceCheckedAt:item.sourceCheckedAt,variants:item.sizes.map((size,i)=>({id:'size-'+i,labelZh:size,labelEn:size,priceJpy:item.price}))};
      return db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json,sort_order) SELECT ?,?,?,?,?,?,?,'active',?,-20 WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=? OR json_extract(commerce_json,'$.catalogSourceId')=?)")
        .bind(item.nameZh,item.nameEn,category[0],category[1],item.descriptionZh,item.descriptionEn,item.price,JSON.stringify(commerce),item.nameEn,item.id);
    });
    statements.push(db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_expanded_20260928_v2','true')"));
    await db.batch(statements);
  }
  // Translate only unchanged seeded copy. Never replace seller-authored Korean content.
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_korean_descriptions_20260929'").first()) {
    await db.batch([
      ...koreanProductDescriptions.map(item=>db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.descriptionKo',?) WHERE name_en=? AND description_en=? AND COALESCE(json_extract(commerce_json,'$.descriptionKo'),'')=''").bind(item.descriptionKo,item.nameEn,item.sourceDescriptionEn)),
      db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_korean_descriptions_20260929','true')")
    ]);
  }
  // Fill missing reference metadata on existing exact-spec records only.
  // Never overwrite seller pricing, reference edits, or discontinued status.
  if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_taiwan_prices_20260929_v3'").first()) {
    await db.batch([
      ...taiwanPriceEvidence.map(item=>db.prepare("UPDATE products SET commerce_json=json_set(commerce_json,'$.taiwanRetailTwd',?,'$.taiwanRetailSource',?,'$.taiwanRetailCheckedAt',?) WHERE json_extract(commerce_json,'$.catalogSourceId')=? AND name_en=? AND json_extract(commerce_json,'$.spec')=? AND COALESCE(json_extract(commerce_json,'$.taiwanRetailTwd'),0)=0 AND COALESCE(json_extract(commerce_json,'$.taiwanRetailSource'),'')='' ").bind(item.priceTwd,item.url,item.checkedAt,item.catalogSourceId,item.nameEn,item.spec)),
      db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_taiwan_prices_20260929_v3','true')")
    ]);
  }

 if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_variant_refs_20260930'").first()){
  for(const ref of variantReferences20260930){
   const row=await db.prepare('SELECT id,commerce_json FROM products WHERE name_en=?').bind(ref.nameEn).first();if(!row)continue;
   const data=JSON.parse(String(row.commerce_json||'{}'));const target=ref.variantId?(data.variants||[]).find((v:any)=>v.id===ref.variantId):data;
   if(!target||target.taiwanRetailTwd||target.taiwanRetailSource)continue;
   Object.assign(target,{taiwanRetailTwd:ref.priceTwd,taiwanPromotionTwd:ref.promotionTwd,taiwanRetailSource:ref.url,taiwanRetailClassification:ref.classification,taiwanRetailCheckedAt:ref.checkedAt});
   // Read and write each variant in sequence so a later reference keeps the earlier one.
   await db.prepare('UPDATE products SET commerce_json=? WHERE id=? AND commerce_json=?').bind(JSON.stringify(data),row.id,row.commerce_json).run();
  }
  await db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_variant_refs_20260930','true')").run();
 }
 // Recovery expansion is insert-only; incomplete candidates stay private drafts.
 if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_expanded_20260930'").first()){
  const categories:Record<string,[string,string]>={beauty:['韓國美妝','Korean beauty'],fashion:['韓國潮流服飾','Korean streetwear'],fragrance:['香水與香氛','Fragrance']};
  await db.batch([...expansion20260930.map(item=>{
   const category=categories[item.category]||categories.fragrance,tw=item.taiwanPrice;
   const data={country:'KR',currency:'KRW',brand:item.brand,retailer:item.retailer,spec:item.spec,nameKo:item.nameKo,descriptionKo:item.descriptionKo,catalogSourceId:item.id,imageUrl:item.imageUrl,purchaseUrl:item.purchaseUrl,taxIncludedJpy:item.priceKrw,taxRefundEligible:false,stock:item.stock,stockQuantityVerified:item.stockQuantityVerified,availabilityEvidence:item.availabilityEvidence,availabilityCheckedAt:item.sourceCheckedAt,sourcePriceBasis:item.sourcePriceClassification,sourceCheckedAt:item.sourceCheckedAt,sourcePromotion:item.promotion,taiwanRetailTwd:tw?.priceTwd||0,taiwanRetailSource:tw?.url||'',taiwanRetailCheckedAt:tw?.checkedAt||'',taiwanRetailClassification:tw?.classification||'',variants:item.sizes.map((size,i)=>({id:'size-'+i,labelZh:size,labelEn:size,priceJpy:item.priceKrw})),allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,arrivalHours:0,addon:false};
   return db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json,sort_order) SELECT ?,?,?,?,?,?,?,?,?,-30 WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=? OR json_extract(commerce_json,'$.catalogSourceId')=?)").bind(item.nameZh,item.nameEn,category[0],category[1],item.descriptionZh,item.descriptionEn,item.priceKrw,item.status,JSON.stringify(data),item.nameEn,item.id);
  }),db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_expanded_20260930','true')")]);
 }
 if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_taiwan_prices_20260930'").first()){
  for(const ref of references20260930){
   const row=await db.prepare("SELECT id,commerce_json FROM products WHERE json_extract(commerce_json,'$.catalogSourceId')=? AND name_en=? AND json_extract(commerce_json,'$.spec')=?").bind(ref.catalogSourceId,ref.nameEn,ref.spec).first();if(!row)continue;
   const c=JSON.parse(String(row.commerce_json||'{}'));
   if(!c.taiwanRetailTwd&&!c.taiwanRetailSource)Object.assign(c,{taiwanRetailTwd:ref.priceTwd,taiwanRetailSource:ref.url,taiwanRetailCheckedAt:ref.checkedAt});
   if(c.taiwanRetailTwd!==ref.priceTwd||c.taiwanRetailSource!==ref.url)continue;
   if(!c.taiwanRetailClassification)c.taiwanRetailClassification=ref.classification;
   if(!c.taiwanPromotionTwd)c.taiwanPromotionTwd=ref.promotion?.priceTwd||0;
   await db.prepare('UPDATE products SET commerce_json=? WHERE id=? AND commerce_json=?').bind(JSON.stringify(c),row.id,row.commerce_json).run();
  }
  await db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_taiwan_prices_20260930','true')").run();
 }
 if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_seed_copy_repairs_20260930'").first()){
  await db.batch([...copyRepairs20260930.map(item=>db.prepare("UPDATE products SET description_zh=CASE WHEN description_zh=? THEN ? ELSE description_zh END,description_en=CASE WHEN description_en=? THEN ? ELSE description_en END,commerce_json=CASE WHEN json_extract(commerce_json,'$.descriptionKo')=? THEN json_set(commerce_json,'$.descriptionKo',?) ELSE commerce_json END WHERE name_en=? AND (description_en=? OR description_zh=?)").bind(item.oldZh,item.newZh,item.oldEn,item.newEn,item.oldKo,item.newKo,item.nameEn,item.oldEn,item.oldZh)),db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_seed_copy_repairs_20260930','true')")]);
 }

 if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_grouped_snacks_20261001'").first()){
  const statements=[];for(const item of groupedSnacks20261001){
   const data={country:'KR',currency:'KRW',nameKo:item.nameKo,imageUrl:item.image,purchaseUrl:item.url,taxIncludedJpy:item.price,taxRefundEligible:false,stock:-1,variants:item.variants,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,arrivalHours:0,addon:false};
   statements.push(db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json,sort_order) SELECT ?,?,'韓國零食','Korean snacks',?,?,?,'active',?,-50 WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=?)").bind(item.nameZh,item.nameEn,'單盒／單包販售，請選擇口味與數量；不同口味可分別加入購物車。','Sold individually. Choose a flavor and quantity; add different flavors separately.',item.price,JSON.stringify(data),item.nameEn));
   for(const name of item.previousNames)statements.push(db.prepare("UPDATE products SET status='discontinued' WHERE name_en=? AND status='active'").bind(name));
  }
  for(const name of ["I'MINT Espresso Americano Matcha Latte 32g x 3","I'MINT Espresso Coffee Candy 32g x 4","I'MINT Americano Candy 32g x 4","AMOS Peelerz Mango Gummies 30g x 34","Orion Fruit Bits Gummies 36g x 6"])statements.push(db.prepare("UPDATE products SET status='discontinued' WHERE name_en=? AND status='active'").bind(name));
  statements.push(db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_grouped_snacks_20261001','true')"));await db.batch(statements);
 }
 if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_kiwi_variant_20261003'").first()){
  await db.batch([
   db.prepare("UPDATE products SET commerce_json=json_insert(commerce_json,'$.variants[#]',json(?)) WHERE name_en=? AND json_type(commerce_json,'$.variants')='array' AND NOT EXISTS(SELECT 1 FROM json_each(products.commerce_json,'$.variants') WHERE json_extract(value,'$.id')=? OR json_extract(value,'$.labelEn') LIKE 'Kiwi%')").bind(JSON.stringify(kiwiVariant20261003),'Orion Peelable Gummies 67g · Choose a flavor',kiwiVariant20261003.id),
   db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_kiwi_variant_20261003','true')")
  ]);
 }
 if(!await db.prepare("SELECT value FROM store_settings WHERE key='adela_requested_catalog_20261001'").first()){
  const categories:Record<string,string[]>={snacks:['韓國零食','Korean snacks'],beauty:['美妝與身體護理','Beauty & body care'],toys:['玩具與收藏','Toys & collectibles'],fashion:['韓國潮流服飾','Korean streetwear']};
  await db.batch([...requestedCatalog20261001.map(item=>{
   const cat=categories[item.category],c={...item,country:'KR',currency:'KRW',nameKo:item.nameEn,taxIncludedJpy:item.priceKrw,taxRefundEligible:false,stock:-1,stockQuantityVerified:false,allowedTiers:['standard','platinum','black','diamond'],sizeFeeTwd:0,arrivalHours:0,addon:false,taiwanRetailCheckedAt:item.taiwanRetailTwd?'2026-10-01':'',catalogSourceId:item.id};
   return db.prepare("INSERT INTO products(name_zh,name_en,category_zh,category_en,description_zh,description_en,price_jpy,status,commerce_json,sort_order) SELECT ?,?,?,?,?,?,?,?,?,-40 WHERE NOT EXISTS(SELECT 1 FROM products WHERE name_en=? OR json_extract(commerce_json,'$.catalogSourceId')=?)").bind(item.nameZh,item.nameEn,cat[0],cat[1],item.descriptionZh,item.descriptionEn,item.priceKrw,item.status,JSON.stringify(c),item.nameEn,item.id);
  }),db.prepare("INSERT OR IGNORE INTO store_settings(key,value) VALUES('adela_requested_catalog_20261001','true')")]);
 }
 await applyCatalogR8(db);
 await applyCatalogR9(db);
 await applyCatalogR9E(db);
 await applyOctoberBatch(db);
 await applyCatalogR12(db);
 await applyCatalogR14(db);
 await applyCatalogR15(db);
 await applyCatalogR17(db);
  await applyCatalogR19(db);
 await db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES (?,?)').bind(readyKey,'true').run();

}
export function newOrderNumber() { return `KK${new Date().toISOString().slice(2,10).replaceAll("-", "")}-${crypto.randomUUID().replaceAll("-", "").slice(0,12).toUpperCase()}`; }

export const productCategories=[
 {zh:'韓國零食',en:'Korean snacks'},
 {zh:'韓國美妝',en:'Korean beauty'},
 {zh:'韓國香氛',en:'Korean fragrance'},
 {zh:'韓國潮流服飾',en:'Korean streetwear'},
 {zh:'香水與香氛',en:'Fragrance'},
 {zh:'服飾配件',en:'Fashion & accessories'},
 {zh:'美妝保養',en:'Beauty & skincare'},
 {zh:'食品零食',en:'Food & snacks'},
 {zh:'生活雜貨',en:'Home & lifestyle'},
 {zh:'3C 家電',en:'Electronics'},
 {zh:'玩具收藏',en:'Toys & collectibles'},
 {zh:'文具書籍',en:'Stationery & books'},
 {zh:'運動戶外',en:'Sports & outdoors'},
 {zh:'其他',en:'Other'},
] as const;

export function productCategory(value:unknown){
 const key=String(value||'');
 return productCategories.find(x=>x.zh===key||x.en===key)||productCategories.find(x=>x.zh==='其他')!;
}

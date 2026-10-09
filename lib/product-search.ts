import type { ShopProduct } from './commerce-types';
// Synonym groups are matched against catalog content; no invented results.
const groups = [
 ['包包','手提包','托特包','帆布袋','帆布包','提袋','tote','bag','handbag'],
 ['零食','點心','餅乾','snack','snacks','cookie','cookies','biscuit'],
 ['保養','護膚','乳霜','skincare','skin care','cream'],
 ['美妝','化妝','彩妝','cosmetics','makeup'],
 ['抹茶','綠茶','matcha','green tea'],
 ['鞋子','球鞋','運動鞋','鞋','sneaker','sneakers','shoes'],
 ['衣服','服飾','上衣','clothes','clothing','apparel'],
 ['玩具','公仔','模型','toy','toys','figure'],
 ['韓國','韓系','korea','korean','한국'],
 ['咖啡糖','coffee candy','커피캔디'],
 ['香水','perfume','fragrance','향수'],
];
const normalize=(s:string)=>s.normalize('NFKC').replace(/ü/gi,'u').toLowerCase().replace(/[\s\p{P}]+/gu,' ').trim();
function editDistance(a:string,b:string){if(a.length===b.length){const mismatch=[...a].map((c,i)=>c!==b[i]?i:-1).filter(i=>i>=0);if(mismatch.length===2&&mismatch[1]===mismatch[0]+1&&a[mismatch[0]]===b[mismatch[1]]&&a[mismatch[1]]===b[mismatch[0]])return 1;}const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=old;}}return row[b.length];}
export function searchProducts(products:ShopProduct[],query:string):ShopProduct[]{
 const q=normalize(query);if(!q)return products;
 const tokens=q.split(' ').filter(Boolean);
 return products.map(p=>{const name=normalize(p.nameZh+' '+p.nameEn+' '+(p.nameKo||'')),text=normalize(name+' '+p.categoryZh+' '+p.categoryEn+' '+p.descriptionZh+' '+p.descriptionEn+' '+(p.brand||'')+' '+(p.retailer||''));let score=0;
 for(const token of tokens){if(name.includes(token)){score+=10;continue;}if(text.includes(token)){score+=5;continue;}
 const synonyms=groups.filter(g=>g.some(s=>normalize(s)===token||token.length>1&&normalize(s).includes(token))).flat();
 if(synonyms.some(s=>text.includes(normalize(s)))){score+=3;continue;}
 if(/^[a-z]{4,}$/.test(token)&&text.split(' ').some(word=>/^[a-z]+$/.test(word)&&Math.abs(word.length-token.length)<=1&&editDistance(word,token)<=1)){score+=1;continue;}
 return {p,score:0};}return {p,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.p);
}

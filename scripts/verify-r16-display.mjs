import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
const {buildSync}=createRequire(realpathSync('node_modules/wrangler/package.json'))('esbuild');
buildSync({stdin:{contents:"export {catalogListedPrice,catalogDisplayPrice} from './lib/catalog-display-price';export {fulfilmentPhoto} from './lib/fulfilment-photo';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'work/r16-display.mjs'});
const {catalogListedPrice,catalogDisplayPrice,fulfilmentPhoto}=await import('../work/r16-display.mjs');
const before=JSON.parse(readFileSync('verification/r15-live-before.json'));
const products=before.products.filter(p=>!/beyblade|戰鬥陀螺/i.test(p.nameEn+p.nameZh));
let optionsChecked=0;
for(const p of products)for(const tier of ['standard','platinum','black','diamond'])for(const variantId of [undefined,...p.variants.map(v=>v.id)]){
 const options={exchangeRate:before.exchange.rate,tier,variantId,fees:before.fees};
 const displayed=catalogListedPrice(p,options),eligible=catalogDisplayPrice(p,options);
 assert.ok(Number.isFinite(displayed.amount)&&displayed.amount>0,p.nameZh+': '+variantId);
 if(eligible.amount!==null)assert.equal(displayed.amount,eligible.amount,'Purchasable item must keep checkout-matching price');
 optionsChecked++;
}
const missing={...products.find(p=>!p.variants.length),taiwanRetailSource:'',taiwanRetailCheckedAt:''};
assert.ok(catalogListedPrice(missing,{exchangeRate:before.exchange.rate}).amount>0);
assert.equal(catalogDisplayPrice(missing,{exchangeRate:before.exchange.rate}).amount,null,'Showing a calculated price must not silently approve an invalid checkout');
const names=["I'MINT 三口味咖啡糖組｜濃縮・美式・抹茶拿鐵（32g × 3）",'Orion 剝皮果實軟糖 葡萄 67g','Le Labo 檜木護手霜 55ml'];
for(const nameZh of names){
 const line={nameZh,productId:133,quantity:2,goodsTwd:270};const original=JSON.stringify(line);
 const image=fulfilmentPhoto(line,products);assert.ok(image.startsWith('/procurement-photos/')&&existsSync('public'+image));
 assert.equal(JSON.stringify(line),original,'Photo lookup must not mutate old order snapshots');
}
assert.equal(fulfilmentPhoto({imageUrl:'/original-order-photo.jpg'},products),'/original-order-photo.jpg');
const variantProduct=products.find(p=>p.variants.some(v=>v.imageUrl));const v=variantProduct.variants.find(v=>v.imageUrl);
assert.equal(fulfilmentPhoto({productId:variantProduct.id,variantId:v.id,nameZh:variantProduct.nameZh},products),v.imageUrl);
assert.ok(!readFileSync('app/product-price.tsx','utf8').includes('請洽客服確認'));
const result={productCount:products.length,priceCombinationsChecked:optionsChecked,legacyPhotosChecked:3,existingSnapshotsPreserved:true,checkoutGuardPreserved:true,browserTested:false};
writeFileSync('verification/r16-display-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

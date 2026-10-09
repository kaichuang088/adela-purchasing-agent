import type { ShopProduct } from './commerce-types';

const brands = ['Aesop', 'UNOVE', 'makeprem', 'OFRA', 'Crown', 'Condition', 'Le Labo', 'Byredo', 'Diptyque', 'Stussy', 'Mardi Mercredi', 'Matin Kim', 'thisisneverthat', 'Round Lab', 'Torriden', 'Beauty of Joseon', 'romand', 'Anua', 'COSRX', 'SKIN1004', 'Dr.G', 'MEDIHEAL', 'VT', 'CLIO', 'peripera', 'dasique', 'fwee', 'ILLIYOON', 'AESTURA'];
const brandKey=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export function productBrand(p: ShopProduct): string {
  return brands.find(b=>p.brand?brandKey(b)===brandKey(p.brand):brandKey(p.nameEn).startsWith(brandKey(b))) || p.brand || '';
}
export function isOliveYoung(p: ShopProduct): boolean {
  try { return new URL(p.purchaseUrl).hostname.endsWith('.oliveyoung.co.kr'); }
  catch { return false; }
}
export function inCollection(p: ShopProduct, collection: string): boolean {
  return collection === 'all' || (collection === 'Olive Young' ? isOliveYoung(p) : productBrand(p) === collection);
}

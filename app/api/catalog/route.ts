import {isAdmin,privateJson} from '@/lib/admin-auth';
import {products} from '@/lib/commerce';

export async function GET(request:Request){
 try{return privateJson({products:await products(isAdmin(request))});}
 catch(error){console.error('catalog_load',error);return privateJson({error:'商品暫時無法讀取，請稍後重試。'},503);}
}

// The old publisher saved Japanese quote fields without KRW verification.
export async function POST(){
 return privateJson({error:'請在管理後台核對韓元售價、圖片及韓國購買來源後上架商品。'},410);
}

import {privateJson} from '@/lib/admin-auth';

// Legacy anonymous checkout lacks delivery address and a KRW price snapshot.
export async function POST(){
 return privateJson({error:'請由購物車完成韓國代購訂單並填寫配送地址。 / Use the Korean shop checkout with a delivery address.'},410);
}

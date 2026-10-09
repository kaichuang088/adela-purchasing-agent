import {decideDefer} from '@/lib/item-fulfilment';
import {privateJson} from '@/lib/admin-auth';
import {currentMember,ShopError} from '@/lib/commerce';
import {failure} from '@/app/api/shop/route';
import {cancelOrder,confirmReceived,requestExchange} from '@/lib/order-actions';
export async function POST(request:Request){try{
 const member=(await currentMember(request,true))!;
 if(request.headers.get('content-type')?.includes('multipart/form-data')){
  const form=await request.formData();await requestExchange(Number(form.get('id')),member.id,String(form.get('reason')||''),form.get('image') as File);
 }else{
  const b=await request.json() as Record<string,unknown>;
  if(b.action==='defer_decision'){if(typeof b.accept!=='boolean')throw new ShopError('請選擇接受或拒絕。');await decideDefer(Number(b.id),Number(b.lineIndex),member.id,b.accept);}
  else if(b.action==='cancel')await cancelOrder(Number(b.id),member.id,String(b.reason||''),String(b.refundAccount||''));
  else if(b.action==='received')await confirmReceived(Number(b.id),member.id);
  else throw new ShopError('不支援的操作。 / Unsupported action.');
 }
 return privateJson({ok:true});
}catch(e){return failure(e);}}

import {rawDb} from './catalog';
import {ShopError} from './commerce';
export async function arrivalCandidates(productId:number|null){
 return (await rawDb().prepare("SELECT id,request_no,status,updated_at FROM shopping_requests WHERE status NOT IN ('cancelled','refunded','rejected','completed') AND received_at IS NULL AND (? IS NULL OR EXISTS(SELECT 1 FROM json_each(pricing_json,'$.items') i WHERE json_extract(i.value,'$.productId')=?)) ORDER BY id").bind(productId,productId).all()).results;
}
export async function updateArrivalRange(productId:number|null,expected:string,eta:string,etaTo:string){
 const rows=await arrivalCandidates(productId);if(!rows.length||JSON.stringify(rows.map(r=>[r.id,r.status,r.updated_at]))!==expected)throw new ShopError('訂單已變更，請重新預覽到貨區間。',409);
 const now=new Date().toISOString(),db=rawDb(),statements=[];
 for(const row of rows){
  statements.push(db.prepare('UPDATE shopping_requests SET eta=?,eta_to=?,eta_reason=?,updated_at=? WHERE id=? AND status=? AND updated_at=?').bind(eta,etaTo,'賣家更新可取貨區間',now,row.id,row.status,row.updated_at));
  statements.push(db.prepare("INSERT INTO kk_messages(member_id,order_id,title,body,title_en,body_en) SELECT member_id,id,'預計可取貨區間更新',?,'Pickup window updated',? FROM shopping_requests WHERE id=? AND updated_at=?").bind(eta+' – '+etaTo,eta+' – '+etaTo,row.id,now));
 }
 const result=await db.batch(statements);return result.filter((_,i)=>i%2===0).reduce((n,r)=>n+Number(r.meta.changes||0),0);
}

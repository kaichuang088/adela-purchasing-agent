'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {readJsonResponse} from '@/lib/http-response';
import {useAdminText} from './admin-language';
import {toast} from 'sonner';

export function CreateMember({password,refresh}:{password:string;refresh:()=>Promise<void>}){
 const a=useAdminText(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState(''),[initialPassword,setInitialPassword]=useState('');
 async function create(){
  setBusy(true);
  try{
   const r=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json','X-KK-Admin-Password':password},body:JSON.stringify({action:'create_member',name,email,password:initialPassword})});
   const v=await readJsonResponse(r) as {error?:string};if(!r.ok)throw Error(v.error||'建立失敗');
   setInitialPassword('');await refresh();setOpen(false);setName('');setEmail('');toast.success(a('帳號已建立'));
  }catch(e){toast.error(e instanceof Error?e.message:'建立失敗');}finally{setBusy(false);}
 }
 return <><Button variant="outline" onClick={()=>setOpen(true)}>{a('建立會員帳號')}</Button><Dialog open={open} onOpenChange={value=>{if(!busy){setOpen(value);if(!value)setInitialPassword('');}}}><DialogContent className="op-dialog adela-create-member"><DialogHeader><DialogTitle>{a('建立會員帳號')}</DialogTitle><DialogDescription>{a('已有帳號不會被覆蓋。請私下提供初始密碼給會員。')}</DialogDescription></DialogHeader><form onSubmit={e=>{e.preventDefault();void create();}}><label>{a('姓名')}<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>{a('會員初始密碼')}<input required minLength={8} type="password" autoComplete="new-password" value={initialPassword} onChange={e=>setInitialPassword(e.target.value)}/></label><Button disabled={busy}>{a('建立帳號')}</Button></form></DialogContent></Dialog></>;
}

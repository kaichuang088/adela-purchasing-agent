'use client';
import {useAdminText} from './admin-language';
export function ProductKoreanFields({name,description,onChange}:{name:string;description:string;onChange:(key:'nameKo'|'descriptionKo',value:string)=>void}){
 const a=useAdminText();
 return <fieldset><legend>{a('韓文內容')}</legend><p>{a('供韓文介面使用；留空時顯示英文內容。')}</p><label>{a('韓文名稱')}<input lang="ko" value={name} maxLength={180} onChange={event=>onChange('nameKo',event.target.value)}/></label><label>{a('韓文介紹')}<textarea lang="ko" rows={3} value={description} maxLength={1200} onChange={event=>onChange('descriptionKo',event.target.value)}/></label></fieldset>;
}

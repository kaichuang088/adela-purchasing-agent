'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {StoreLanguage,useStoreLocale,formatText,type TextValues} from '@/app/store-language';
import copy from '@/lib/admin-ko.json';
import englishCopy from '@/lib/admin-en.json';
import {englishErrorText} from '@/lib/english-error-text';
import {koreanText} from '@/lib/ko';
const AdminLanguageControl=createContext<{language:'zh'|'en'|'ko';setLanguage:(value:'zh'|'en'|'ko')=>void}>({language:'zh',setLanguage:()=>{}});
export function AdminLanguageProvider({children}:{children:ReactNode}){
 const [language,setLanguage]=useState<'zh'|'en'|'ko'>('zh'),[loaded,setLoaded]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem('adela-admin-language')||localStorage.getItem('adela-language');if(saved==='ko'||saved==='en')setLanguage(saved);}catch{}setLoaded(true);},[]);
 useEffect(()=>{if(!loaded)return;document.documentElement.lang=language==='ko'?'ko':language==='en'?'en':'zh-Hant';try{localStorage.setItem('adela-admin-language',language);}catch{}},[language,loaded]);
 return <AdminLanguageControl.Provider value={{language,setLanguage}}><StoreLanguage.Provider value={language}>{children}</StoreLanguage.Provider></AdminLanguageControl.Provider>;
}
export function useAdminText(){const locale=useStoreLocale();return (text:string,values?:TextValues)=>formatText(locale==='ko'?(copy as Record<string,string>)[text]||koreanText(text,text):locale==='en'?(englishCopy as Record<string,string>)[text]||englishErrorText(text)||text:text,values);}
export function AdminLanguageSelect(){const {language,setLanguage}=useContext(AdminLanguageControl);return <label className="op-language"><span>{language==='ko'?'언어':language==='en'?'Language':'語言'}</span><select aria-label={language==='ko'?'관리자 언어':language==='en'?'Admin language':'後台語言'} value={language} onChange={e=>setLanguage(e.target.value as 'zh'|'en'|'ko')}><option value="zh">繁體中文</option><option value="en">English</option><option value="ko">한국어</option></select></label>;}

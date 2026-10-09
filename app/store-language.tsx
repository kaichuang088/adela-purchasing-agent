'use client';
import {createContext,useContext} from 'react';
import {englishErrorText} from '@/lib/english-error-text';
import {koreanText} from '@/lib/ko';
export const StoreLanguage=createContext<'zh'|'en'|'ko'>('zh');
export type StoreLocale='zh'|'en'|'ko';
export type TextValues=Record<string,string|number>;
export function useStoreLocale(en=false):StoreLocale{const language=useContext(StoreLanguage);return language==='zh'&&en?'en':language;}
export function formatText(text:string,values:TextValues={}){return text.replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);}
export function useStoreText(en=false){const language=useStoreLocale(en);return (zh:string,english:string,values?:TextValues)=>formatText(language==='ko'?koreanText(zh,english):language==='en'?(english===zh?englishErrorText(zh)||english:english):zh,values);}
export function localeCode(language:StoreLocale){return language==='ko'?'ko-KR':language==='en'?'en-GB':'zh-TW';}

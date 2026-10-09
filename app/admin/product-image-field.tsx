'use client';
import {useAdminText} from './admin-language';
import React from 'react';

export function ProductImageField({imageUrl,onChange}:{imageUrl:string;onChange:(value:string)=>void}){
 const a=useAdminText();
 const bundled=imageUrl.startsWith('/')&&!imageUrl.startsWith('//');
 return <label>{a("商品圖片網址 / Product image URL")}<input type="url" value={bundled?'':imageUrl} onChange={event=>onChange(event.target.value)} placeholder="https://…" />
  <small>{bundled?a("目前使用已收錄的商品照片。若要更換，可上傳新照片或貼上 HTTPS 圖片網址。"):a("可上傳照片，或貼上商品的 HTTPS 圖片網址。")}</small>
 </label>;
}

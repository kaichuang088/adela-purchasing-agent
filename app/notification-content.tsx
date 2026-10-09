'use client';
import {notificationText,notificationDate,type Notice} from '@/lib/notification-text';
import {useStoreLocale} from './store-language';
export function NotificationContent({notice,date}:{notice:Notice;date?:string}){
 const locale=useStoreLocale(),text=notificationText(notice,locale);
 return <><strong>{text.title}</strong><p>{text.body}</p>{date&&<time dateTime={date}>{notificationDate(date,locale)}</time>}</>;
}

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// No private page/API caching; notifications disclose no order or customer data.
self.addEventListener('push',event=>event.waitUntil(self.registration.showNotification("Adela's 代購",{body:'你有新的商店、訂單或客服通知，點一下查看。',icon:'/app-icon.png',badge:'/app-icon.png',tag:'adela-updates',data:{url:self.location.hostname.includes('-admin')?'/admin?view=notify':'/?view=notifications'}})));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const url=new URL(self.location.hostname.includes('-admin')?'/admin?view=notify':'/?view=notifications',self.location.origin).href;for(const win of await self.clients.matchAll({type:'window',includeUncontrolled:true})){if(new URL(win.url).origin===self.location.origin){await win.navigate(url);return win.focus();}}return self.clients.openWindow(url);})());});

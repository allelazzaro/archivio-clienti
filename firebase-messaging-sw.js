// firebase-messaging-sw.js
console.log('[SW] Firebase messaging service worker caricato');

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBbjK5sgQ70-p8jODaK_PnLIzPxgfrqQ34",
  authDomain: "archivio-clienti-trasporti.firebaseapp.com",
  projectId: "archivio-clienti-trasporti",
  storageBucket: "archivio-clienti-trasporti.firebasestorage.app",
  messagingSenderId: "773533170263",
  appId: "1:773533170263:web:d05e2b00e991b0294c0112"
});

const messaging = firebase.messaging();

// Messaggi in background via FCM
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

  const title = payload.notification?.title || "Nuovo messaggio";
  const body  = payload.notification?.body  || "";
  const url   = payload.data?.url || "/archivio-clienti/chat.html";

  return self.registration.showNotification(title, {
    body,
    icon: "/archivio-clienti/icon192.png",
    badge: "/archivio-clienti/icon192.png",
    tag: "chat-message",
    data: { url },
    requireInteraction: false,
    silent: false
  });
});

// Click sulla notifica → focus o apri chat
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/archivio-clienti/chat.html";

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = allClients.find(c => c.url.includes('/archivio-clienti/'));
    if (existing) { await existing.focus(); return; }
    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('install', (e) => { console.log('[SW] install'); self.skipWaiting(); });
self.addEventListener('activate', (e) => { console.log('[SW] activate'); e.waitUntil(self.clients.claim()); });

// Extra log errori
self.addEventListener('error', (e) => console.error('[SW] error:', e.error || e));
self.addEventListener('unhandledrejection', (e) => console.error('[SW] unhandled:', e.reason));
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

// URL base dell'app (root di Firebase Hosting)
const APP_ORIGIN = 'https://archivio-clienti-trasporti.web.app';

// Messaggi in background via FCM
// Il payload è data-only: siamo noi a mostrare la notifica (una sola volta)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

  // Leggi titolo e body dal campo data (inviati dal Cloud Function)
  const title = payload.data?.title || payload.notification?.title || "💬 Nuovo messaggio";
  const body  = payload.data?.body  || payload.notification?.body  || "";
  const url   = payload.data?.url   || (APP_ORIGIN + '/chat.html');

  return self.registration.showNotification(title, {
    body,
    icon: '/icon192.png',
    badge: '/icon192.png',
    tag: 'chat-message',      // stesso tag = notifica precedente sovrascritta, non duplicata
    data: { url },
    requireInteraction: false,
    silent: false
  });
});

// Click sulla notifica → focus su finestra esistente o apri nuova
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || (APP_ORIGIN + '/chat.html');

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Cerca una finestra già aperta sull'origine dell'app
    const existing = allClients.find(c => c.url.startsWith(APP_ORIGIN));
    if (existing) {
      await existing.focus();
      // Naviga alla chat specifica se la finestra è già aperta
      await existing.navigate(targetUrl);
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('install', (e) => { console.log('[SW] install'); self.skipWaiting(); });
self.addEventListener('activate', (e) => { console.log('[SW] activate'); e.waitUntil(self.clients.claim()); });

// Extra log errori
self.addEventListener('error', (e) => console.error('[SW] error:', e.error || e));
self.addEventListener('unhandledrejection', (e) => console.error('[SW] unhandled:', e.reason));
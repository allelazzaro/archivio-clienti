// 🔧 AGGIORNA firebase-messaging-sw.js con questo codice

console.log(’[SW] Firebase messaging service worker caricato’);

importScripts(‘https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js’);
importScripts(‘https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js’);

firebase.initializeApp({
apiKey: “AIzaSyBbjK5sgQ70-p8jODaK_PnLIzPxgfrqQ34”,
authDomain: “archivio-clienti-trasporti.firebaseapp.com”,
projectId: “archivio-clienti-trasporti”,
storageBucket: “archivio-clienti-trasporti.firebasestorage.app”,
messagingSenderId: “773533170263”,
appId: “1:773533170263:web:d05e2b00e991b0294c0112”
});

const messaging = firebase.messaging();

// 🚀 NUOVO: Gestione push più robusta per iOS PWA
self.addEventListener(‘push’, (event) => {
console.log(’[SW] Push event ricevuto:’, event);

if (!event.data) {
console.log(’[SW] Push senza dati’);
return;
}

try {
const payload = event.data.json();
console.log(’[SW] Payload:’, payload);

```
const title = payload.notification?.title || payload.data?.title || "Nuovo messaggio";
const body = payload.notification?.body || payload.data?.body || "";
const url = payload.data?.url || "/chat.html";

const options = {
  body,
  icon: "/icon192.png",
  badge: "/icon192.png",
  tag: "chat-message",
  data: { url },
  requireInteraction: true,    // ⚡ Importante per iOS
  silent: false,
  vibrate: [200, 100, 200],
  actions: [
    {
      action: 'open-chat',
      title: 'Apri Chat',
      icon: '/icon192.png'
    }
  ]
};

event.waitUntil(
  self.registration.showNotification(title, options)
    .then(() => console.log('[SW] Notifica mostrata'))
    .catch(err => console.error('[SW] Errore notifica:', err))
);
```

} catch (error) {
console.error(’[SW] Errore parsing push:’, error);

```
// Fallback: mostra notifica generica
event.waitUntil(
  self.registration.showNotification('Nuovo messaggio', {
    body: 'Hai ricevuto un nuovo messaggio',
    icon: '/icon192.png',
    tag: 'chat-fallback',
    requireInteraction: true
  })
);
```

}
});

// Background messages (per compatibilità)
messaging.onBackgroundMessage((payload) => {
console.log(’[SW] Background message:’, payload);
// Non fare nulla qui, gestiamo tutto nell’evento ‘push’
});

// Click sulla notifica
self.addEventListener(‘notificationclick’, (event) => {
console.log(’[SW] Notification click:’, event);

event.notification.close();

const targetUrl = event.notification?.data?.url || “/chat.html”;

event.waitUntil((async () => {
try {
// Cerca finestra esistente
const allClients = await self.clients.matchAll({
type: ‘window’,
includeUncontrolled: true
});

```
  // Prova a trovare la PWA o una finestra con l'app
  const existingClient = allClients.find(client => 
    client.url.includes('/chat.html') || 
    client.url.includes('/index.html') ||
    client.url.includes('archivio-clienti')
  );
  
  if (existingClient) {
    console.log('[SW] Focus su client esistente');
    await existingClient.focus();
    if (existingClient.navigate) {
      await existingClient.navigate(targetUrl);
    }
  } else {
    console.log('[SW] Apro nuova finestra');
    await self.clients.openWindow(targetUrl);
  }
} catch (error) {
  console.error('[SW] Errore apertura:', error);
  await self.clients.openWindow('/chat.html');
}
```

})());
});

// 🔧 NUOVO: Debug e installazione PWA
self.addEventListener(‘install’, (event) => {
console.log(’[SW] Installing…’);
self.skipWaiting();
});

self.addEventListener(‘activate’, (event) => {
console.log(’[SW] Activating…’);
event.waitUntil(
self.clients.claim().then(() => {
console.log(’[SW] All clients claimed’);
})
);
});

// 🔧 NUOVO: Gestione errori migliorata
self.addEventListener(‘error’, (event) => {
console.error(’[SW] Error:’, event.error || event);
});

self.addEventListener(‘unhandledrejection’, (event) => {
console.error(’[SW] Unhandled rejection:’, event.reason);
});

// 🔧 NUOVO: Verifica periodica connessione
self.addEventListener(‘sync’, (event) => {
if (event.tag === ‘background-sync’) {
console.log(’[SW] Background sync’);
}
});

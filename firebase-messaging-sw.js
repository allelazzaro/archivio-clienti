// firebase-messaging-sw.js - Versione corretta per GitHub Pages
console.log('[SW] Firebase messaging service worker caricato - GitHub Pages');

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Configurazione Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBbjK5sgQ70-p8jODaK_PnLIzPxgfrqQ34",
  authDomain: "archivio-clienti-trasporti.firebaseapp.com",
  projectId: "archivio-clienti-trasporti",
  storageBucket: "archivio-clienti-trasporti.firebasestorage.app",
  messagingSenderId: "773533170263",
  appId: "1:773533170263:web:d05e2b00e991b0294c0112"
});

const messaging = firebase.messaging();

// Messaggi in background - ottimizzato
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message ricevuto:', payload);

  const title = payload.notification?.title || "Nuovo messaggio";
  const body  = payload.notification?.body  || "";
  const url   = payload.data?.url || "/archivio-clienti/chat.html";

  const notificationOptions = {
    body,
    icon: "/archivio-clienti/icon192.png",
    badge: "/archivio-clienti/icon192.png", 
    tag: "chat-message",
    data: { url },
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    actions: [
      {
        action: 'open-chat',
        title: 'Apri Chat'
      }
    ]
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Gestione click notifica
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const targetUrl = event.notification?.data?.url || "/archivio-clienti/chat.html";
  const action = event.action;

  event.waitUntil((async () => {
    try {
      const allClients = await self.clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      });
      
      // Cerca client esistente
      const existing = allClients.find(client => 
        client.url.includes('/archivio-clienti/')
      );
      
      if (existing && existing.focus) {
        await existing.focus();
        
        if (targetUrl.includes('chat.html')) {
          existing.postMessage({
            type: 'NOTIFICATION_CLICKED',
            action: action || 'open-chat'
          });
        }
      } else {
        // Apri nuova finestra con URL completo
        const fullUrl = new URL(targetUrl, self.location.origin).href;
        await self.clients.openWindow(fullUrl);
      }
    } catch (error) {
      console.error('[SW] Errore gestione click:', error);
      // Fallback - apri sempre una nuova finestra
      const fullUrl = new URL(targetUrl, self.location.origin).href;
      await self.clients.openWindow(fullUrl);
    }
  })());
});

// Keep-alive per iOS
self.addEventListener('message', (event) => {
  console.log('[SW] Messaggio ricevuto:', event.data);
  
  if (event.data && event.data.type === 'KEEP_ALIVE') {
    event.ports[0]?.postMessage({ success: true });
  }
});

// Installazione e attivazione
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

// Gestione errori
self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.error || event);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

// Background sync per keep-alive
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'keep-alive') {
    event.waitUntil(
      fetch('/archivio-clienti/').catch(() => {
        console.log('[SW] Keep-alive fetch failed (normale in background)');
      })
    );
  }
});

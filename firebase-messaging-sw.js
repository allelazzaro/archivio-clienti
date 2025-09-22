// firebase-messaging-sw.js - Versione ottimizzata per iOS
console.log('[SW] Firebase messaging service worker caricato - iOS optimized');

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

// Messaggi in background - ottimizzato per iOS
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message ricevuto:', payload);

  const title = payload.notification?.title || "Nuovo messaggio";
  const body  = payload.notification?.body  || "";
  const url   = payload.data?.url || "/archivio-clienti/chat.html";

  // Opzioni ottimizzate per iOS
  const notificationOptions = {
    body,
    icon: "/archivio-clienti/icon192.png",
    badge: "/archivio-clienti/icon192.png",
    tag: "chat-message",
    data: { url },
    requireInteraction: true, // Importante per iOS - mantiene la notifica visibile
    silent: false,
    vibrate: [200, 100, 200], // Pattern vibrazione
    // Aggiungi timestamp per evitare duplicati
    timestamp: Date.now(),
    // Azioni rapide (se supportate)
    actions: [
      {
        action: 'open-chat',
        title: 'Apri Chat',
        icon: '/archivio-clienti/icon192.png'
      }
    ]
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Gestione click notifica con supporto azioni
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const targetUrl = event.notification?.data?.url || "/archivio-clienti/chat.html";
  const action = event.action;

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    });
    
    // Cerca un client esistente dell'app
    const existing = allClients.find(client => 
      client.url.includes('/archivio-clienti/')
    );
    
    if (existing) {
      // Se l'app è già aperta, portala in primo piano
      await existing.focus();
      
      // Se è la chat, invia un messaggio per aggiornare
      if (targetUrl.includes('chat.html')) {
        existing.postMessage({
          type: 'NOTIFICATION_CLICKED',
          action: action || 'open-chat'
        });
      }
    } else {
      // Altrimenti apri una nuova finestra/tab
      await self.clients.openWindow(targetUrl);
    }
  })());
});

// Keep-alive per iOS - mantiene il SW attivo
self.addEventListener('message', (event) => {
  console.log('[SW] Messaggio ricevuto:', event.data);
  
  if (event.data && event.data.type === 'KEEP_ALIVE') {
    // Risponde per mantenere la connessione attiva
    event.ports[0]?.postMessage({ success: true });
  }
});

// Installazione e attivazione ottimizzate
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting(); // Forza l'attivazione immediata
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    self.clients.claim() // Prende controllo di tutti i client
  );
});

// Gestione errori potenziata
self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.error || event);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

// Periodic sync per mantenere attiva la connessione (se supportato)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'keep-alive') {
    event.waitUntil(
      // Mantiene la connessione attiva
      fetch('/archivio-clienti/').catch(() => {})
    );
  }
});

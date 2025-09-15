// firebase-messaging-sw.js - VERSIONE CON PERCORSI CORRETTI
console.log('[SW] Firebase messaging service worker caricato');

// Import Firebase scripts con percorsi assoluti
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Configurazione Firebase (identica agli altri file)
firebase.initializeApp({
  apiKey: "AIzaSyBbjK5sgQ70-p8jODaK_PnLIzPxgfrqQ34",
  authDomain: "archivio-clienti-trasporti.firebaseapp.com",
  projectId: "archivio-clienti-trasporti",
  storageBucket: "archivio-clienti-trasporti.firebasestorage.app",
  messagingSenderId: "773533170263",
  appId: "1:773533170263:web:d05e2b00e991b0294c0112"
});

console.log('[SW] Firebase inizializzato');

const messaging = firebase.messaging();

// Gestione messaggi in background
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message ricevuto:', payload);
  
  const notificationTitle = payload.notification?.title || "Nuovo messaggio";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: './icon192.png', // Percorso relativo
    badge: './icon192.png',
    data: { 
      url: payload.data?.url || './chat.html' // Percorso relativo
    },
    tag: 'chat-message',
    requireInteraction: true,
    silent: false
  };

  console.log('[SW] Mostro notifica:', notificationTitle);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click sulla notifica
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notifica cliccata');
  
  event.notification.close();
  
  const url = event.notification.data?.url || './chat.html';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Cerca finestra esistente
      const existingClient = clients.find(client => 
        client.url.includes('chat.html') || 
        client.url.includes('allelazzaro.github.io')
      );
      
      if (existingClient) {
        console.log('[SW] Focus su finestra esistente');
        return existingClient.focus();
      }
      
      // Apri nuova finestra - URL completo
      const fullUrl = new URL(url, self.location.origin + '/archivio-clienti/').href;
      console.log('[SW] Apro nuova finestra:', fullUrl);
      return self.clients.openWindow(fullUrl);
    })
  );
});

// Install e activate con logging
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installato');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker attivato');
  event.waitUntil(self.clients.claim());
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Errore:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Promise rejection:', event.reason);
});
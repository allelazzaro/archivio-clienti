// firebase-messaging-sw.js - VERSIONE CORRETTA PER GITHUB PAGES
console.log('[SW] Firebase messaging service worker caricato');

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// IMPORTANTE: Configurazione identica a quella nei tuoi file HTML
firebase.initializeApp({
  apiKey: "AIzaSyBbjK5sgQ70-p8jODaK_PnLIzPxgfrqQ34",
  authDomain: "archivio-clienti-trasporti.firebaseapp.com",
  projectId: "archivio-clienti-trasporti",
  storageBucket: "archivio-clienti-trasporti.firebasestorage.app",
  messagingSenderId: "773533170263",
  appId: "1:773533170263:web:d05e2b00e991b0294c0112"
});

const messaging = firebase.messaging();

// Gestione messaggi in background
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message ricevuto:', payload);
  
  const notificationTitle = payload.notification?.title || "Nuovo messaggio";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: '/archivio-clienti/icon192.png', // Percorso corretto per GitHub Pages
    badge: '/archivio-clienti/icon192.png',
    data: { 
      url: payload.data?.url || '/archivio-clienti/chat.html' // Percorso corretto
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
  
  const url = event.notification.data?.url || '/archivio-clienti/chat.html';
  const fullUrl = 'https://allelazzaro.github.io' + url; // URL completo
  
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
      
      // Apri nuova finestra
      console.log('[SW] Apro nuova finestra:', fullUrl);
      return self.clients.openWindow(fullUrl);
    })
  );
});

// Install e activate
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installato');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker attivato');
  event.waitUntil(self.clients.claim());
});

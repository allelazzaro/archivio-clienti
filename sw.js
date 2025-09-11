// firebase-messaging-sw.js
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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message ricevuto:', payload);
  
  const notificationTitle = payload.notification?.title || "Nuovo messaggio";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: '/icon192.png',
    badge: '/icon192.png',
    data: { url: payload.data?.url || '/chat.html' },
    tag: 'chat-message',
    requireInteraction: false
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click ricevuto:', event);
  
  event.notification.close();
  
  const url = event.notification.data?.url || '/chat.html';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Cerca una finestra già aperta
      const existingClient = clients.find(client => client.url.includes('chat.html'));
      if (existingClient) {
        existingClient.focus();
        return;
      }
      
      // Apri nuova finestra
      return self.clients.openWindow(url);
    })
  );
});
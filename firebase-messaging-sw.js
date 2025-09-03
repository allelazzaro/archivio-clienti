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
const title = payload.notification?.title || "Nuovo messaggio";
const body = payload.notification?.body || "";
const url = (payload.data && payload.data.url) ? payload.data.url : '/chat.html';


self.registration.showNotification(title, {
body,
data: { url }
});
});


self.addEventListener('notificationclick', (event) => {
event.notification.close();
const url = event.notification?.data?.url || '/chat.html';
event.waitUntil(
self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
const had = clients.find(c => c.url.includes('chat.html'));
if (had) { had.focus(); return; }
return self.clients.openWindow(url);
})
);
});
// sw.js - PWA cache aggiornato anti "salto" HTML
const CACHE_NAME = "clienti-pwa-v2";
const URLS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon192.png",
  "./icon512.png",
  "./chat.html",
  "./admin.html",
  "./console.html",
  "./monitor_leaflet.html",
  "./home.html"
];

// Installa e precache
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)));
  self.skipWaiting();
});

// Attiva e ripulisci cache vecchie
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Network-first per HTML, cache-first per il resto
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const isHTML = req.headers.get("accept")?.includes("text/html");

  if (isHTML) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        }
      })()
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
  }
});

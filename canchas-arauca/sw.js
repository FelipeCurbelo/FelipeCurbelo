/* Service Worker de Kancha — funciona sin conexión (menos los tiles del mapa). */
const CACHE = "kancha-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/leaflet.js",
  "./vendor/fonts/fonts.css",
  "./vendor/fonts/material-symbols-subset.woff2",
  "./vendor/fonts/space-grotesk-variable.woff2",
  "./vendor/fonts/space-mono-400.woff2",
  "./vendor/fonts/space-mono-700.woff2",
  "./vendor/fonts/instrument-serif-400.woff2",
  "./vendor/fonts/instrument-serif-400-italic.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Los tiles del mapa van siempre a la red (no se cachean).
  if (url.hostname.includes("cartocdn.com") || url.hostname.includes("tile.openstreetmap.org")) return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});

// Offline-Unterstützung: zuerst aus dem Netz laden (damit Änderungen an items.json sofort ankommen),
// ohne Netz aus dem Zwischenspeicher. Bei neuen Dateien die Versionsnummer erhöhen.
const CACHE = 'runenrucksack-v1';
const FILES = [
  './',
  'index.html',
  'style.css',
  'js/main.js',
  'js/logic.js',
  'js/battle.js',
  'items.json',
  'enemies.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});

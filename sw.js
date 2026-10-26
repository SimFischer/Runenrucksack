// Offline-Unterstützung: zuerst aus dem Netz laden (damit Änderungen an items.json sofort ankommen),
// ohne Netz aus dem Zwischenspeicher. Bei neuen Dateien die Versionsnummer erhöhen.
const CACHE = 'runenrucksack-v9';
const FILES = [
  './',
  'index.html',
  'style.css',
  'js/main.js',
  'js/state.js',
  'js/ui.js',
  'js/logic.js',
  'js/grammar.js',
  'js/sterne.js',
  'js/buch.js',
  'js/buch-ui.js',
  'js/fortschritt.js',
  'js/ende-ui.js',
  'js/sammlung-ui.js',
  'js/code.js',
  'js/code-ui.js',
  'js/vendor/qrcode.js',
  'js/vendor/jsQR.js',
  'js/mods.js',
  'js/battle.js',
  'js/battle-ui.js',
  'js/encounters.js',
  'js/tutorial.js',
  'js/tutorial-logic.js',
  'items.json',
  'recipes.json',
  'enemies.json',
  'regions.json',
  'heroes.json',
  'encounters.json',
  'exercises.json',
  'tutorial.json',
  'achievements.json',
  'registry.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  // Bilder (nur die im Spiel verwendeten – nicht assets/roh/, nicht die Vorschau)
  'assets/zuordnung.json',
  'assets/items/kuerbis.webp',
  'assets/items/pfanne.webp',
  'assets/items/honig.webp',
  'assets/items/karotte.webp',
  'assets/items/hafer.webp',
  'assets/items/zaumzeug.webp',
  'assets/items/stechen.webp',
  'assets/items/schiessen.webp',
  'assets/items/brennen.webp',
  'assets/items/leuchten.webp',
  'assets/items/dolch.webp',
  'assets/items/helm.webp',
  'assets/items/laterne.webp',
  'assets/items/schild.webp',
  'assets/items/hammer.webp',
  'assets/items/apfel.webp',
  'assets/items/brot.webp',
  'assets/items/heiltrank.webp',
  'assets/items/horn.webp',
  'assets/items/runenstein.webp',
  'assets/items/runenkrone.webp',
  'assets/items/drachenschuppe.webp',
  'assets/items/kettenhemd.webp',
  'assets/items/drachenfeuerschwert.webp',
  'assets/items/gartentasche.webp',
  'assets/items/satteltasche.webp',
  'assets/items/schwert.webp',
  'assets/items/axt.webp',
  'assets/items/bogen.webp',
  'assets/items/stab.webp',
  'assets/items/speer.webp',
  'assets/items/stiefel.webp',
  'assets/items/schlagen.webp',
  'assets/items/schuetzen.webp',
  'assets/items/heilen.webp',
  'assets/items/stuermen.webp',
  'assets/items/feuer.webp',
  'assets/items/gift.webp',
  'assets/items/eis.webp',
  'assets/items/blitz.webp',
  'assets/items/stein.webp',
  'assets/items/mond.webp',
  'assets/items/gold.webp',
  'assets/items/sturm.webp',
  'assets/items/siegel-der.webp',
  'assets/items/siegel-die.webp',
  'assets/items/siegel-das.webp',
  'assets/items/rune-scharf.webp',
  'assets/items/rune-schwer.webp',
  'assets/items/rune-schnell.webp',
  'assets/items/rune-edel.webp',
  'assets/items/rune-gut.webp',
  'assets/items/rune-gross.webp',
  'assets/items/rune-stark.webp',
  'assets/items/rune-hell.webp',
  'assets/gegner/spaeher.webp',
  'assets/gegner/schildork.webp',
  'assets/gegner/schamane.webp',
  'assets/gegner/wolfsreiter.webp',
  'assets/boss-pluenderer.webp',
  'assets/boss-wolfsreiter.webp',
  'assets/hintergrund-kleinwurzel.webp',
  'assets/hintergrund-hrossmark.webp',
  'assets/titelbild.webp',
  'assets/figur-borga.webp',
  'assets/figur-eadrun.webp',
  'assets/figur-fenwick.webp',
  'assets/figur-faelith.webp',
  'assets/figur-theron.webp',
  'assets/figur-ysolde.webp',
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

/* AgroControl — Service Worker
   Guarda todos los archivos de la app para que funcione sin internet.
   Estrategia: responde desde caché y actualiza en segundo plano. */
const CACHE = 'agrocontrol-v2';
const ARCHIVOS = [
  './', './index.html', './manifest.json', './css/styles.css', './icons/icon.svg',
  './js/utils.js', './js/icons.js', './js/store.js', './js/calc.js', './js/feed.js',
  './js/share.js', './js/ui.js', './js/app.js',
  './js/views/shell.js', './js/views/panel.js', './js/views/registro.js',
  './js/views/inventario.js', './js/views/lotes.js', './js/views/modals.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const red = fetch(e.request).then(res => {
        if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return res;
      }).catch(() => hit || caches.match('./index.html'));
      return hit || red;
    })
  );
});

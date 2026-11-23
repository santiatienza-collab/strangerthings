/* Service worker: deja el juego instalable y jugable sin conexión.
 * Estrategia "stale-while-revalidate": sirve de la caché y actualiza en segundo plano. */
const CACHE = 'stranger-slug-v14';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'js/atlas.js', 'js/game.js', 'js/touch.js',
  'assets/bg_far.png', 'assets/bg_floor.png', 'assets/scene_lab.png', 'assets/scene_forest.png', 'assets/scene_house.png', 'assets/scene_street.png', 'assets/scene_mansion.png',
  'assets/will.png', 'assets/lucas.png', 'assets/eleven.png', 'assets/mike.png', 'assets/dustin.png', 'assets/steve.png',
  'assets/demogorgon.png', 'assets/vecna.png',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// red primero (así las actualizaciones se ven al recargar) y caché como respaldo sin conexión
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      throw err;
    }
  }));
});

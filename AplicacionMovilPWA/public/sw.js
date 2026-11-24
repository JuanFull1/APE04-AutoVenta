
// Caché solo para recursos visuales.
// Nunca almacenar JWT ni respuestas de API.

const CACHE = 'ape04-pwa-ui-v3';

const RECURSOS = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/api.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) =>
        cache.addAll(RECURSOS)
      )
      .then(() =>
        self.skipWaiting()
      )
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    Promise.all([
      caches.keys().then((claves) =>
        Promise.all(
          claves
            .filter((clave) => clave !== CACHE)
            .map((clave) => caches.delete(clave))
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  if (
    url.origin !== self.location.origin ||
    evento.request.method !== 'GET'
  ) {
    return;
  }

  // Las peticiones protegidas siempre van a la red.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/oauth/')
  ) {
    return;
  }

  evento.respondWith(
    fetch(evento.request).catch(
      async () =>
        (await caches.match(evento.request)) ||
        (
          evento.request.mode === 'navigate'
            ? caches.match('/index.html')
            : Response.error()
        )
    )
  );
});
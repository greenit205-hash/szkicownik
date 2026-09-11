// Service worker szkicownika.
// UWAGA: po KAŻDEJ zmianie w index.html podbij numer w CACHE_NAME.
// Bez tego urządzenia zostaną na starej wersji i będziesz szukał błędu,
// którego dawno nie ma w kodzie.
const CACHE_NAME = 'szkicownik-v12';

const PLIKI = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      // pojedynczy nieudany plik (np. CDN offline przy instalacji) nie może
      // wywalić całej instalacji service workera
      Promise.all(PLIKI.map(u => c.add(u).catch(() => null)))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(klucze =>
      Promise.all(klucze.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // zapytania inne niż GET przepuszczamy bez dotykania cache
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(odp => {
        if (odp && odp.ok && e.request.url.startsWith(self.location.origin)) {
          const kopia = odp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, kopia)).catch(() => {});
        }
        return odp;
      })
      .catch(() => caches.match(e.request).then(x => x || caches.match('./index.html')))
  );
});

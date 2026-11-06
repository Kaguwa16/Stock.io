const CACHE_NAME = 'stock-io-cache-v2';
const repoPath = '/Stock.io';

const assetsToCache = [
  `${repoPath}/`,
  `${repoPath}/index.html`,
  `${repoPath}/style.css`,
  `${repoPath}/app.js`,
  `${repoPath}/manifest.json`,
  `${repoPath}/icons/192x192.png`,
  `${repoPath}/icons/512x512.png`
  // Tambahkan file aset lain (seperti script JS tambahan atau library CSS jika ada)
];

// 1. Install Service Worker dan Cache Aset
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Menyimpan aset ke cache offline...');
      return cache.addAll(assetsToCache);
    })
  );
});

// 2. Ambil Data dari Cache saat Offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// 3. Update Cache Lama jika ada versi baru
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

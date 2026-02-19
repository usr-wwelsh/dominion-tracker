const CACHE_NAME = 'dominion-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/games.html',
  '/builds.html',
  '/scoreboard.html',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
  '/css/main.css',
  '/css/leaderboard.css',
  '/css/games.css',
  '/css/builds.css',
  '/css/scoreboard.css',
  '/js/api.js',
  '/js/header.js',
  '/js/leaderboard.js',
  '/js/games.js',
  '/js/builds.js',
  '/js/scoreboard.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Let API requests go straight to the network; fall back to nothing on failure
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For everything else: cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

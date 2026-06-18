const CACHE_NAME = 'dominion-s2-v2';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  // App shell (pages, scripts, styles): network-first so code updates show up
  // without a manual cache bump; fall back to cache when offline.
  const isShell = request.mode === 'navigate' || /\.(?:html|js|css)$/.test(url.pathname);

  if (isShell) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (images, fonts): cache-first for speed.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'Dominion Tracker', body: 'Something happened!' };
  try { data = event.data.json(); } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.data || {},
      tag: 'dominion-push',
      renotify: true,
    })
  );
});

// Notification click — open app or a specific page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { type, player_id } = event.notification.data || {};
  let url = '/leaderboard.html';
  if (type === 'rank_change' && player_id) url = `/profile.html?id=${player_id}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

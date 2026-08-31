// Makes The Path installable-feeling (works offline, survives a dropped connection mid-
// session) without changing the "always get today's deploy when online" behavior this
// project depends on — it ships multiple times a day, so a naive cache-first strategy
// would mean stale JS surviving past its own bugfixes, indefinitely, on whatever phone
// last installed it. Network-first instead: always try the network, cache a copy of
// whatever it returns, and only fall back to the cache when the network genuinely fails
// (actually offline). Only same-origin GET requests are touched at all — Supabase API/
// auth calls (a different origin) pass straight through untouched, always live; there's
// no offline write queue here, logging a set still needs a real connection.

const CACHE_NAME = 'the-path-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Timer-completion notifications (js/lib/timer-notify.js) — tapping one should bring you
// back into the app rather than just dismissing, same as any normal notification.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) return clientList[0].focus();
      return self.clients.openWindow('.');
    })
  );
});

// Minimal service worker: cache the shell on install, serve from cache while offline.
const CACHE = 'chilimbitso-v1';
const SHELL = ['/app/login'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )));
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Only intercept GET navigation requests
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return;

    e.respondWith(
        fetch(e.request).catch(() =>
            caches.match(e.request).then(r => r || caches.match('/app/login'))
        )
    );
});

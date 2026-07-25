// Service Worker - 世界生存 PWA
const CACHE_NAME = 'world-survival-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './js/data.js',
    './js/inventory.js',
    './js/survival.js',
    './js/world.js',
    './js/player.js',
    './js/enemies.js',
    './js/ui.js',
    './js/mobile.js',
    './js/main.js',
    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS).catch(() => {});
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(response => {
            return response || fetch(e.request).then(res => {
                // 缓存新请求
                if (res && res.status === 200 && e.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            }).catch(() => {
                return caches.match(e.request);
            });
        })
    );
});

// Service Worker - 世界生存 PWA
const CACHE_NAME = 'world-survival-v135';
const ASSETS = [
    './',
    './index.html',
    './versions.html',
    './style.css',
    './manifest.json',
    './js/data.js',
    './js/item-icons.js',
    './js/inventory.js',
    './js/survival.js',
    './js/world.js',
    './js/player.js',
    './js/enemies.js',
    './js/ui.js',
    './js/mobile.js',
    './js/save.js',
    './js/multiplayer.js',
    './js/main.js',
    'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/mqtt@5.3.5/dist/mqtt.min.js'
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
    // 跳过非http(s)请求（如chrome-extension://）
    if (!e.request.url.startsWith('http')) return;
    // JS文件始终从网络获取（确保代码更新生效）
    if (e.request.url.endsWith('.js') || e.request.url.includes('.js?')) {
        e.respondWith(
            fetch(e.request).then(res => {
                if (res && res.status === 200 && e.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            }).catch(() => caches.match(e.request))
        );
        return;
    }
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

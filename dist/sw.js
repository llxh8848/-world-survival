// ServiceWorker 空壳 - 立即注销自身
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim())
    );
});
self.addEventListener('fetch', (e) => {
    // 不拦截任何请求，全部走网络
    return;
});

/* =========================================================================
   NishoVpn Progressive Web App (PWA) Service Worker
   - Offline Caching & Asset Resilience
   - Push Notifications for Server Alerts (Android, iOS 16.4+, Windows, Mac)
   - Background Sync & Notification Click Routing
   ========================================================================= */

const CACHE_NAME = 'nisho-pwa-v10.4.1';
const STATIC_ASSETS = [
    '/',
    '/login',
    '/nisho',
    '/manifest.json',
    '/static/login.html',
    '/static/index.html',
    '/static/sub.html',
    '/static/img/nisho-logo.png',
    '/static/img/icon-192.png',
    '/static/img/icon-512.png',
    '/static/img/icon-maskable-192.png',
    '/static/img/icon-maskable-512.png',
    '/static/nisho-logo.svg',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
    'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css'
];

// Install Event: Pre-cache critical core shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[Nisho SW] Non-critical asset cache skip:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate Event: Clean up stale caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Nisho SW] Removing legacy cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Network-first for APIs, Cache-first for fonts & static assets
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Bypass API calls, websockets, and dynamic data from caching
    if (url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/ws') || 
        url.pathname.startsWith('/sub') || 
        url.pathname.startsWith('/link') || 
        request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                // If valid response, update cache for static assets
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Fallback to cache if offline
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (request.mode === 'navigate') {
                        return caches.match('/static/login.html');
                    }
                });
            })
    );
});

// Push Notification Event: Receive server push notifications
self.addEventListener('push', (event) => {
    let data = {
        title: 'NishoVpn Alert | هشدار سرور',
        body: 'اعلان جدید از سرور نیشو دریافت شد.',
        icon: '/static/img/icon-192.png',
        badge: '/static/img/icon-192.png',
        tag: 'nisho-alert',
        url: '/nisho'
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = Object.assign(data, payload);
        } catch (e) {
            data.body = event.data.text() || data.body;
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/static/img/icon-192.png',
        badge: data.badge || '/static/img/icon-192.png',
        image: data.image,
        tag: data.tag || 'nisho-notification',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/nisho',
            timestamp: Date.now()
        },
        actions: [
            { action: 'open', title: 'مشاهده پنل', icon: '/static/img/icon-192.png' },
            { action: 'dismiss', title: 'بستن' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification Click Event: Focus or open panel
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/nisho';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // If already open, focus it
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes('/nisho') || client.url.includes('/dashboard')) {
                    return client.focus();
                }
            }
            // Otherwise open a new tab/window
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Message Listener for SW updates or test notifications
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'TEST_NOTIFICATION') {
        self.registration.showNotification('NishoVpn Core', {
            body: event.data.body || 'اتصال نوتیفیکیشن سرویس‌ورکر برقرار است.',
            icon: '/static/img/icon-192.png',
            badge: '/static/img/icon-192.png'
        });
    }
});

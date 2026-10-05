{% load static %}
/**
 * PhotoDom - Service Worker
 */

const CACHE_NAME = 'photodom-pwa-v2';
const OFFLINE_URL = '/offline/';

// Archivos principales precacheados para modo sin conexión en https://photodom.onrender.com/
const PRECACHE_ASSETS = [
    '/',
    OFFLINE_URL,
    '/manifest.json',
    '/site.webmanifest',
    "{% static 'galerias/css/styles.css' %}",
    "{% static 'galerias/js/pwa.js' %}",
    "{% static 'favicon.ico' %}",
    "{% static 'favicon.svg' %}",
    "{% static 'icon-192.png' %}",
    "{% static 'icon-512.png' %}",
    "{% static 'apple-touch-icon.png' %}"
];

// Instalación del Service Worker con precacheo resiliente
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                PRECACHE_ASSETS.map((assetUrl) => {
                    return cache.add(assetUrl).catch((err) => {
                        console.warn('PhotoDom PWA: Recurso no pudo precachearse:', assetUrl, err);
                    });
                })
            );
        }).then(() => self.skipWaiting())
    );
});

// Activación y limpieza de cachés antiguos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('Eliminando caché antiguo:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interceptor de peticiones de red
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // 1. Ignorar métodos que no sean GET (como subidas de fotos POST, likes, etc.)
    if (request.method !== 'GET') {
        return;
    }

    // 2. Ignorar rutas administrativas, APIs de descarga y esquemas no http/https
    if (
        !url.protocol.startsWith('http') ||
        url.pathname.startsWith('/admin/') ||
        url.pathname.includes('/descargar/') ||
        url.pathname.includes('/descargar-zip/') ||
        url.hostname.includes('storage.googleapis.com')
    ) {
        return;
    }

    // 3. Estrategia para navegación de páginas HTML (Network-First con fallback Offline)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Si la respuesta es válida, la guardamos dinámicamente en caché
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    // Si no hay red, intentamos servir desde el caché (con ignoreSearch para ?source=pwa)
                    const cachedResponse = await caches.match(request, { ignoreSearch: true });
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Si la navegación es hacia el inicio con parámetros, intentar con '/'
                    if (url.pathname === '/') {
                        const rootResponse = await caches.match('/');
                        if (rootResponse) return rootResponse;
                    }
                    // Si tampoco está en caché, devolvemos la página offline
                    const offlinePage = await caches.match(OFFLINE_URL);
                    return offlinePage || new Response('Sin conexión a internet', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                    });
                })
        );
        return;
    }

    // 4. Estrategia para recursos estáticos (CSS, JS, Fonts, Iconos): Cache-First con actualización de fondo
    if (
        url.pathname.startsWith('/static/') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdn.tailwindcss.com')
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const copy = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 5. Resto de peticiones: Network first con fallback a caché
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return networkResponse;
            })
            .catch(() => caches.match(request))
    );
});

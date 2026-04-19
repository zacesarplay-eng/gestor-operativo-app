// AUMENTAR ESTE NÚMERO CADA VEZ QUE HAGAS UN CAMBIO EN EL CÓDIGO
const CACHE_NAME = 'eeq-offline-v2';

// 1. RECURSOS A CACHEAR (OBLIGATORIO)
const URLS_TO_CACHE = [
    '/gestor-operativo-app/index.html',
    '/gestor-operativo-app/', // Asegurar que la raíz también se cachea
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js'
];

// 2. CACHEO INICIAL (INSTALL)
self.addEventListener('install', event => {
    self.skipWaiting(); // Obliga al SW a instalarse inmediatamente
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(URLS_TO_CACHE.map(url => {
                return fetch(url, { mode: 'no-cors' }).then(response => {
                    if (response) cache.put(url, response);
                });
            }));
        })
    );
});

// 3. ACTIVACIÓN (ACTIVATE) - Limpiar cachés antiguos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Borrando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Toma el control de la página inmediatamente
});

// 4. ESTRATEGIA DE CACHE (FETCH): NETWORK FIRST PARA HTML, CACHE FIRST PARA LIBRERÍAS
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    // Si es un archivo HTML (o la raíz), intentamos ir a la RED primero (Network First)
    if (event.request.headers.get('accept').includes('text/html') || event.request.url.endsWith('/')) {
        event.respondWith(
            fetch(event.request).then(response => {
                // Si hay internet y hay respuesta, la guardamos en el caché por si acaso
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                return response;
            }).catch(() => {
                // Si no hay internet, buscamos en el caché
                return caches.match(event.request);
            })
        );
    } else {
        // Para el resto (librerías, CSS, JS, mapas), usamos CACHÉ PRIMERO (Cache First) para ahorrar datos
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                
                return fetch(event.request).then(networkResponse => {
                    if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                    return networkResponse;
                }).catch(() => {
                    // Fallo de red silencioso
                });
            })
        );
    }
});

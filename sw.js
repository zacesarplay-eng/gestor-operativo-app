const CACHE_NAME = 'eeq-offline-v1';

// 1. RECURSOS A CACHEAR (OBLIGATORIO)
const URLS_TO_CACHE = [
    '/gestor-operativo-app/index.html',
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
            // Usamos Promise.allSettled y mode: 'no-cors' para garantizar que 
            // las librerías externas (CDNs) se guarden sin bloqueos de seguridad.
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
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Toma el control de la página inmediatamente
});

// 4. ESTRATEGIA DE CACHE (FETCH): CACHE FIRST
self.addEventListener('fetch', event => {
    // Solo interceptar peticiones GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // PASO 1 y 2: Buscar en caché y devolver si existe
            if (cachedResponse) {
                return cachedResponse;
            }

            // PASO 3: Si no existe, ir a red y guardar en caché
            return fetch(event.request).then(networkResponse => {
                // Validar respuesta (Aceptamos status 200 o respuestas opacas de CDNs/Map Tiles)
                if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
                    return networkResponse;
                }

                // Guardar una copia en el caché para la próxima vez (Ej. Tiles del Mapa)
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Falla de red silenciosa (El usuario está offline y el recurso no está en caché)
            });
        })
    );
});

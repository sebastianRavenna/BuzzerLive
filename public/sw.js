const CACHE_NAME = 'buzzerlive-v6'; // Incrementar versión en cada deploy
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalación - skipWaiting fuerza la activación inmediata
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activación - borra caches viejos y notifica a los clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Borrando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Toma control de todos los clients inmediatamente
      return self.clients.claim();
    }).then(() => {
      // Notifica a todos los clients que hay actualización
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
        });
      });
    })
  );
});

// Fetch - Network First para HTML, Cache First para assets
self.addEventListener('fetch', (event) => {
  // Ignorar requests que no sean http/https
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  // Ignorar requests a Supabase (siempre online)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  // Para navegación (HTML), siempre intentar red primero
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para assets, network first con fallback a cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Escuchar mensajes de los clients
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
// Service Worker for Push Notifications and Offline Support

const CACHE_NAME = 'toggle-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

// Fetch event for offline support
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => {
      return caches.match('/');
    })
  );
});

// Handle push notifications - works in BACKGROUND on both iOS and Android
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let title = 'Socket Toggle';
  let body = 'State changed';
  let options = {
    body: body,
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%23e53935' width='192' height='192'/><circle cx='96' cy='96' r='60' fill='white'/></svg>",
    badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><circle cx='48' cy='48' r='40' fill='white'/></svg>",
    vibrate: [200, 100, 200],
    tag: 'toggle-state',
    requireInteraction: false,
    silent: false
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
      if (data.options) {
        options = { ...options, ...data.options };
      }
    } catch (e) {
      body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle background sync for notification state changes (if needed)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-state') {
    event.waitUntil(
      fetch('/api/state')
        .then(res => res.json())
        .then(data => {
          if (data.status) {
            self.registration.showNotification('Status Update', {
              body: 'Power source is connected, socket is now turned on',
              tag: 'toggle-state'
            });
          }
        })
        .catch(err => console.error('Sync failed:', err))
    );
  }
});

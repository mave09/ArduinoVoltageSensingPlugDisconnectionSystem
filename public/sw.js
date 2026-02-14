// Service Worker for Push Notifications

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

// Handle push notifications - THIS IS KEY FOR BACKGROUND
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let title = 'Toggle App';
  let body = 'State changed';
  
  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
    } catch (e) {
      body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      vibrate: [200, 100, 200],
      tag: 'toggle-' + Date.now(),
      requireInteraction: false
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

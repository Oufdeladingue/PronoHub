/**
 * Service Worker pour Firebase Cloud Messaging
 * Gère les notifications push en arrière-plan
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuration Firebase (doit correspondre à celle de l'app)
firebase.initializeApp({
  apiKey: "AIzaSyDMJwcHTonQpA8xRbsuOCcKEi3mdYOaYh8",
  authDomain: "pronohub-f8fb3.firebaseapp.com",
  projectId: "pronohub-f8fb3",
  storageBucket: "pronohub-f8fb3.firebasestorage.app",
  messagingSenderId: "468891081637",
  appId: "1:468891081637:web:49cbcbd6c913c8b34ce64c"
});

const messaging = firebase.messaging();

// Gérer les messages en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Message reçu en arrière-plan:', payload);

  const notificationTitle = payload.notification?.title || 'PronoHub';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/images/logo.svg',
    badge: '/images/logo.svg',
    tag: payload.data?.type || 'default',
    data: payload.data,
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gérer le clic sur la notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification cliquée:', event);

  event.notification.close();

  // Ouvrir l'app ou focus si déjà ouverte
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Chercher une fenêtre déjà ouverte
      for (const client of clientList) {
        if (client.url.includes('pronohub.club') && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

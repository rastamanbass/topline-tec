// Firebase Messaging Service Worker
// Handles background push notifications when browser is closed or app is not focused.
// Uses compat SDK via CDN because service workers don't support ES modules natively.
// The config values here are public (same as firebaseConfig in firebase.ts).

importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBgAt0AO5iBb_Ah5Vd0GaUwdazyeJ0MCg8',
  authDomain: 'inventario-a6aa3.firebaseapp.com',
  projectId: 'inventario-a6aa3',
  storageBucket: 'inventario-a6aa3.firebasestorage.app',
  messagingSenderId: '219546339547',
  appId: '1:219546339547:web:4d5cecc15d39fb2cdee4fe',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (!title) return;

  self.registration.showNotification(title, {
    body: body || '',
    icon: '/vite.svg',
    badge: '/vite.svg',
  });
});

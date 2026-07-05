// Service worker NEUTRALISÉ : il se désinscrit et vide tous les caches.
// (L'ancien cache PWA gardait l'affichage d'anciennes versions du site.)
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url)); // recharge les pages ouvertes → version fraîche
    } catch (err) {}
  })());
});

// Toujours passer par le réseau (aucune mise en cache).
self.addEventListener('fetch', () => {});

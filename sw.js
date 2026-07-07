// Service worker minimal : permet d'installer Shinra Finance comme une app sur le PC/telephone.
// AUCUN cache agressif → toujours la derniere version en ligne (pas de probleme de vieille version).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
// On laisse le navigateur gerer les requetes normalement (reseau). La simple presence de ce handler
// + le manifest rendent l'application installable.
self.addEventListener('fetch', () => {});

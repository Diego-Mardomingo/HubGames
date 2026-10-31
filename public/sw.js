// Service Worker de HubGames, escrito a mano (#97). Solo sirve para las notificaciones push (JUDI diario y avisos de
// precio de la wishlist, #37 y #90): no hay precaché ni modo offline, así que no intercepta peticiones (sin «fetch»).
// Sustituye al que generaba next-pwa en la misma URL (/sw.js): el navegador lo actualiza solo y las suscripciones
// push se conservan, porque pertenecen al registro y no al archivo.

// Se activa en cuanto se instala, sin esperar a que se cierren las pestañas abiertas.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Borra las cachés que dejó Workbox (next-pwa): precaché del build y runtime. HubGames no usa Cache Storage
      // para nada más, así que se borran todas.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    // Si el payload no es JSON, lo ignoramos y usamos valores por defecto
    console.error('Error parsing push payload', e);
  }

  const title = data.title || 'HubGames';
  const body = data.body || 'Ya hay un nuevo juego disponible para jugar en HubGames.';
  const url = data.url || '/judi';

  const options = {
    body,
    icon: '/icons/web-app-manifest-192x192.png',
    badge: '/icons/badge-96x96.png',
    data: { url },
  };
  // Avisos de precio (#37): una notificación por juego; la nueva sustituye a la anterior del mismo juego.
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/judi';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Si ya hay una pestaña con HubGames abierta, la enfocamos y navegamos
      for (const client of allClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) {
            // navigate() falla si la pestaña no la controla este SW; en ese caso se queda enfocada sin navegar.
            await client.navigate(url).catch((e) => console.error('Error navigating client', e));
          }
          return;
        }
      }

      // Si no había ninguna, abrimos una nueva
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

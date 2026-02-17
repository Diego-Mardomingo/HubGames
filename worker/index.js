// Código extra del Service Worker para manejar notificaciones push de HubGames.
// Este archivo se inyecta en el SW generado por next-pwa.

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
  const body =
    data.body ||
    'Ya hay un nuevo juego disponible para jugar en HubGames.';
  const url = data.url || '/judi';

  const options = {
    body,
    icon: '/img/HGLogo.webp',
    badge: '/img/HGLogo.webp',
    data: { url },
  };

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
          client.focus();
          if ('navigate' in client) {
            client.navigate(url);
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


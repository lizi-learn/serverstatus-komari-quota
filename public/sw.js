const legacyCacheNames = new Set([
  "komari-scripts",
  "komari-styles",
  "serverstatus-flags",
]);

const isLegacyCache = (name) =>
  legacyCacheNames.has(name) || name.startsWith("workbox-precache");

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter(isLegacyCache).map((name) => caches.delete(name)));
      await self.clients.claim();
      await self.registration.unregister();

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    })(),
  );
});

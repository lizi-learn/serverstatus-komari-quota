const legacyCacheNames = new Set([
  "komari-scripts",
  "komari-styles",
  "serverstatus-flags",
]);

const isLegacyCache = (name: string) =>
  legacyCacheNames.has(name) || name.startsWith("workbox-precache");

const isLegacyWorker = (worker: ServiceWorker | null) => {
  if (!worker) return false;

  try {
    const url = new URL(worker.scriptURL);
    return url.origin === window.location.origin && url.pathname.endsWith("/sw.js");
  } catch {
    return false;
  }
};

export async function clearLegacyThemeCache() {
  try {
    const cleanup = async () => {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) =>
              [registration.active, registration.waiting, registration.installing].some(
                isLegacyWorker,
              ),
            )
            .map((registration) => registration.unregister()),
        );
      }

      if ("caches" in window) {
        const names = await window.caches.keys();
        await Promise.all(
          names.filter(isLegacyCache).map((name) => window.caches.delete(name)),
        );
      }
    };

    await Promise.race([
      cleanup(),
      new Promise<void>((resolve) => setTimeout(resolve, 1200)),
    ]);
  } catch {
    return;
  }
}

const retryKey = "serverstatus:asset-recovery-at";
const now = Date.now();

const getLastRetry = () => {
  try {
    return Number(sessionStorage.getItem(retryKey) || 0);
  } catch {
    return 0;
  }
};

const markRetry = () => {
  try {
    sessionStorage.setItem(retryKey, String(now));
  } catch {
    return;
  }
};

const cleanup = async () => {
  const cacheNames = new Set([
    "komari-scripts",
    "komari-styles",
    "serverstatus-flags",
  ]);
  const tasks = [];

  if ("serviceWorker" in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(
          registrations
            .filter((registration) =>
              [
                registration.active,
                registration.waiting,
                registration.installing,
              ].some((worker) => {
                if (!worker) return false;
                try {
                  const url = new URL(worker.scriptURL);
                  return url.origin === location.origin && url.pathname.endsWith("/sw.js");
                } catch {
                  return false;
                }
              }),
            )
            .map((registration) => registration.unregister()),
        ),
      ),
    );
  }

  if ("caches" in window) {
    tasks.push(
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter(
              (name) => cacheNames.has(name) || name.startsWith("workbox-precache"),
            )
            .map((name) => caches.delete(name)),
        ),
      ),
    );
  }

  await Promise.allSettled(tasks);
};

const recover = window.__serverStatusRecoverAssets;
if (typeof recover === "function") {
  recover();
} else if (now - getLastRetry() >= 60000) {
  markRetry();
  const timeout = new Promise((resolve) => setTimeout(resolve, 1200));
  void Promise.race([cleanup(), timeout]).finally(() => {
    const url = new URL(location.href);
    url.searchParams.set("__ss_reload", String(now));
    location.replace(url.href);
  });
}

const Toaster = () => null;

export { Toaster };

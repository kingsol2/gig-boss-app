export function registerPwaServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || !window.isSecureContext) return;

  window.addEventListener(
    "load",
    () => {
      const serviceWorkerUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.origin);
      navigator.serviceWorker
        .register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL })
        .catch(() => {
          // Installation is optional; the web app remains usable if registration is unavailable.
        });
    },
    { once: true },
  );
}

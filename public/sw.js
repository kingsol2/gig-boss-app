const VERSION = "gig-boss-network-only-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("gig-boss-")).map((key) => caches.delete(key))),
      ),
    ]),
  );
});

// Network-only by design: no response or request is written to the Cache API,
// so financial records, auth traffic, and action links are never retained here.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("message", (event) => {
  if (event.data === "GET_VERSION") event.source?.postMessage({ version: VERSION });
});

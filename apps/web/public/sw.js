// Minimal offline app-shell cache — not a full installable PWA (no
// manifest/icons/install prompt), just enough that a page the driver has
// already visited can reload with no connection instead of the browser's
// own offline error page. Once that shell has booted, the app's actual
// offline-first behavior (trips/expenses read from and written to
// IndexedDB, synced later by SyncQueue) takes over — this worker only
// gets the HTML/JS/CSS back on screen.
const CACHE_NAME = "drivewise-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network-first, same-origin GET only: try the network so a driver online
// always sees fresh data; fall back to the last successful response for
// this exact URL when the network is unavailable. Server Actions and any
// mutation are POST and never touch this — this only ever replays a GET a
// driver has already made successfully at least once.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? Response.error())),
  );
});

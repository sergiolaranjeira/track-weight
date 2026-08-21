// Service worker for offline support. Bump CACHE_NAME whenever a core asset
// changes shape in a way that requires clearing out the previous cache.
const CACHE_NAME = "track-weight-v1";

// Same-origin app shell — required for the app to work at all offline,
// so a failure here should abort the install (cache.addAll is all-or-nothing).
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./config.html",
  "./stats.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/shared.js",
  "./js/script.js",
  "./js/stats.js",
  "./js/config.js",
  "./files/meals.json",
  "./files/favicon.svg",
  "./files/icon-192.png",
  "./files/icon-512.png",
  "./files/apple-touch-icon.png"
];

// Cross-origin resources (fonts, Chart.js) — nice to have precached, but a
// failure here (e.g. installing while offline) shouldn't block the install.
const OPTIONAL_ASSETS = [
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      await Promise.all(OPTIONAL_ASSETS.map((url) => cache.add(url).catch(() => {})));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: answer instantly from cache when available (this is
// what makes meals.json and the app shell work offline), while always kicking
// off a network fetch in the background to keep the cache fresh for next time.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

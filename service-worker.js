const CACHE_NAME = "hanzifun-__BUILD_VERSION__";
const APP_SHELL = [
  "./",
  "./index.html",
  "./tailwind.css",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./vendor/fflate.min.js",
  "./vendor/jspdf.umd.min.js",
  "./data/content-templates.js",
  "./data/strokes.js",
  "./data/stroke-index.js",
  "./data/pinyin.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("hanzifun-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const result = caches.match(event.request).then(async (cached) => {
    if (cached) return { response: cached, cacheWrite: Promise.resolve() };
    const response = await fetch(event.request);
    let cacheWrite = Promise.resolve();
    if (response.ok) {
      // Clone before the original response is returned and its body is consumed.
      const cacheResponse = response.clone();
      cacheWrite = caches.open(CACHE_NAME)
        .then((cache) => cache.put(event.request, cacheResponse))
        .catch(() => undefined);
    }
    return { response, cacheWrite };
  });

  event.respondWith(result.then(({ response }) => response));
  event.waitUntil(result.then(({ cacheWrite }) => cacheWrite).catch(() => undefined));
});

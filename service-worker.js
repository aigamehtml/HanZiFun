const CACHE_NAME = "hanzifun-__BUILD_VERSION__";
const CDN_ORIGIN = "https://cdn.jsdelivr.net";
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
  "./data/content-templates.js",
  "./data/strokes.js",
  "./data/stroke-index.js",
  "./data/pinyin.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        APP_SHELL.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((response) => {
              if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
              return cache.put(url, response);
            })
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("hanzifun-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isCDN = url.origin === CDN_ORIGIN;
  if (url.origin !== self.location.origin && !isCDN) return;

  if (isCDN) {
    // CDN (jsDelivr): cache-first — content-hashed filenames guarantee freshness
    const result = caches.match(event.request).then(async (cached) => {
      if (cached) return { response: cached, cacheWrite: Promise.resolve() };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await fetch(event.request, { signal: controller.signal });
        let cacheWrite = Promise.resolve();
        if (response.ok) {
          const cacheResponse = response.clone();
          cacheWrite = caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, cacheResponse))
            .catch(() => undefined);
        }
        return { response, cacheWrite };
      } finally {
        clearTimeout(timer);
      }
    });
    event.respondWith(result.then(({ response }) => response));
    event.waitUntil(result.then(({ cacheWrite }) => cacheWrite).catch(() => undefined));
    return;
  }

  // Same-origin: network-first — always fetch fresh content, fall back to cache offline
  const result = fetch(event.request, { cache: "no-cache" })
    .then((response) => {
      let cacheWrite = Promise.resolve();
      if (response.ok) {
        const cacheResponse = response.clone();
        cacheWrite = caches.open(CACHE_NAME)
          .then((cache) => cache.put(event.request, cacheResponse))
          .catch(() => undefined);
      }
      return { response, cacheWrite };
    })
    .catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return { response: cached, cacheWrite: Promise.resolve() };
      throw new Error("Network failed and no cache available");
    });

  event.respondWith(result.then(({ response }) => response));
  event.waitUntil(result.then(({ cacheWrite }) => cacheWrite).catch(() => undefined));
});

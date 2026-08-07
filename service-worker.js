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
  "./vendor/hb-subset.wasm",
  "./vendor/fonts/kai.ttf",
  "./vendor/fonts/kai-chars.json",
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
  if (event.request.method !== "GET") return;
  const origin = new URL(event.request.url).origin;
  if (origin !== self.location.origin && origin !== "https://cdn.jsdelivr.net") return;
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
});

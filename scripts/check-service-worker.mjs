import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const listeners = new Map();
let cachedBody = null;
const context = {
  URL,
  Promise,
  Response,
  setTimeout,
  fetch: async () => new Response("stroke-data", { status: 200 }),
  caches: {
    match: async () => undefined,
    open: async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        put: async (_request, response) => {
          cachedBody = await response.text();
        },
      };
    },
  },
  self: {
    location: { origin: "https://hanzifun.test" },
    addEventListener: (type, listener) => listeners.set(type, listener),
  },
};

vm.runInNewContext(await readFile(new URL("../service-worker.js", import.meta.url), "utf8"), context);

let responsePromise;
const lifetimePromises = [];
listeners.get("fetch")({
  request: { method: "GET", url: "https://hanzifun.test/data/strokes-pack-001.zip" },
  respondWith: (promise) => { responsePromise = promise; },
  waitUntil: (promise) => lifetimePromises.push(promise),
});

const response = await responsePromise;
const pageBody = await response.text();
await Promise.all(lifetimePromises);

assert.equal(pageBody, "stroke-data");
assert.equal(cachedBody, "stroke-data");
console.log("Service Worker response cloning check passed.");

/* Blue Blaze Project Tracker service worker: lets the app open offline and install as an app. */
const VERSION = "bbst-202610070236";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  // delete only this app's old caches: your planner lives on the same site and keeps its own
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("bbst-") && k !== VERSION && k !== "bbst-libs").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                       // saving to Google always goes to the network
  const url = new URL(req.url);
  if (url.origin === location.origin) {                   // app files: newest when online, cached copy when offline
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === "cdnjs.cloudflare.com") {   // fonts + Excel library: cached after first use
    e.respondWith(caches.open("bbst-libs").then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res;
    }))));
  }
});

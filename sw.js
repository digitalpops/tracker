/* Blue Blaze Project Tracker service worker: lets the app open offline and install as an app. */
/* app 2026.10.17.03 (the app compares this with its own version to show "Update Ready" in Settings) */
const VERSION = "bbst-202610171606";
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
  if (url.origin === location.origin) {
    if (/\/sw\.js$/.test(url.pathname)) return;             // the app's "Update Ready" check always asks the site directly
    // app files: the newest copy when it arrives within 3 seconds; otherwise the copy saved on this device opens right away
    // (a slow mobile connection no longer leaves the app stuck on the logo). The newest copy keeps downloading and is used next time.
    e.respondWith((async () => {
      // a fresh request of its own, so it keeps going after the saved copy has opened (the page's own request would be cancelled)
      const net = fetch(req.url, { credentials: "same-origin", cache: "no-store" }).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      });
      e.waitUntil(net.then(() => {}, () => {}));
      const hit = (await caches.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await caches.match("index.html") : undefined);
      if (!hit) return net;
      try { return (await Promise.race([net, new Promise(r => setTimeout(() => r(null), 3000))])) || hit; } catch (x) { return hit; }
    })());
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === "cdnjs.cloudflare.com") {   // fonts + Excel library: cached after first use
    e.respondWith(caches.open("bbst-libs").then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res;
    }))));
  }
});

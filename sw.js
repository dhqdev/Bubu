// Service worker: deixa o Bubu abrir sem internet (cache do app) e atualiza em segundo plano.
const CACHE = "bubu-v2";
const FILES = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/main.js", "js/brain.js", "js/life.js", "js/mind.js", "js/items.js", "js/store.js", "js/util.js", "js/bubu-svg.js",
  "js/games/catch.js", "js/games/memory.js", "js/games/bubbles.js", "js/games/jump.js", "js/vendor/qrcode.js", "js/criatividade.js", "js/brain-view.js", "js/conta.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// rede primeiro (pega a versão nova), cache se estiver offline
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).pathname.includes("/api/")) return; // API sempre na rede
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes("fonts.g"))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});

const CACHE_NAME = "coolsteapp-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./agenda.html",
  "./games.html",
  "./exploding-aces.html",
  "./style.css",
  "./calendar.js",
  "./next-event.js",
  "./agenda-script.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./maskotte.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // per bestand cachen, zodat één ontbrekend bestand de installatie niet breekt
      .then(cache => Promise.allSettled(ASSETS.map(a => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  // Alleen eigen bestanden afhandelen; de agenda-proxy gaat altijd direct naar het netwerk
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  // Netwerk eerst (altijd de nieuwste versie), cache als terugval bij offline
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});

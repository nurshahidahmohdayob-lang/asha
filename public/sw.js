/* The service worker exists so the suite can be installed — a browser will not
   offer "Install" without one — and so an installed copy opens to something
   rather than a network error when the school's connection drops.

   It is deliberately network-first and caches almost nothing. A cache-first
   worker is how an installed app keeps showing last week's build after a
   deploy, and every teacher then has to be told to clear it. Here the network
   always wins while there is one; the cache is only ever a fallback for being
   offline. */

const SHELL = "zera-shell-v1";

self.addEventListener("install", () => {
  // Take over straight away rather than waiting for every tab to close, so a
  // deploy is never held up behind a tab someone left open a week ago.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== SHELL).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only page loads are handled. Scripts, styles and images carry a content
  // hash in their name, so the browser's own cache already does the right
  // thing with them and a second layer here could only get it wrong.
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        // Keep the last page that loaded, to open to when there is no network.
        const cache = await caches.open(SHELL);
        cache.put("/", fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match("/");
        if (cached) return cached;
        return new Response(
          "<!doctype html><meta charset=utf-8><title>Offline</title>" +
            "<body style=\"font-family:system-ui;padding:3rem;text-align:center;color:#0A4F29\">" +
            "<h1>No connection</h1><p>Zera Suite needs the internet to load. " +
            "Try again once you are back online.</p>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
    })(),
  );
});

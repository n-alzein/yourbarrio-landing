const CACHE_VERSION = "yb-pwa-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/YB_AppLogo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/logo-off.png",
];

const NETWORK_ONLY_PREFIXES = [
  "/api/",
  "/auth/",
  "/oauth/",
  "/login",
  "/signin",
  "/set-password",
  "/account",
  "/admin",
  "/business",
  "/business-auth",
  "/cart",
  "/checkout",
  "/go/",
  "/messages",
  "/onboarding",
  "/orders",
];

const DYNAMIC_ASSET_PREFIXES = ["/business-gallery/", "/business-photos/"];

const STATIC_PATH_PREFIXES = [
  "/_next/static/",
  "/icons/",
  "/images/",
  "/placeholders/",
];

const STATIC_FILE_PATHS = new Set([
  "/business-placeholder.png",
  "/business-placeholder2.png",
  "/business-placeholder2-off.png",
  "/business-placeholder2-off2.png",
  "/customer-placeholder.png",
  "/google-icon.svg",
  "/logo.png",
  "/logo-off.png",
  "/manifest.webmanifest",
  "/YB_AppLogo.png",
  "/YBpin.png",
]);

const STATIC_EXTENSIONS = /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("yb-pwa-") && cacheName !== STATIC_CACHE)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (shouldUseNetworkOnly(url, request)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isCacheableStaticAsset(url, request)) {
    event.respondWith(cacheFirst(request));
  }
});

function shouldUseNetworkOnly(url, request) {
  if (request.headers.has("authorization")) {
    return true;
  }

  if (DYNAMIC_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return true;
  }

  return NETWORK_ONLY_PREFIXES.some((prefix) => pathMatchesPrefix(url.pathname, prefix));
}

function isCacheableStaticAsset(url, request) {
  if (request.headers.has("authorization")) {
    return false;
  }

  if (DYNAMIC_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return false;
  }

  if (STATIC_FILE_PATHS.has(url.pathname)) {
    return true;
  }

  if (STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return true;
  }

  return request.destination !== "document" && STATIC_EXTENSIONS.test(url.pathname);
}

function pathMatchesPrefix(pathname, prefix) {
  if (prefix.endsWith("/")) {
    return pathname.startsWith(prefix);
  }

  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(OFFLINE_URL);
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response && response.ok) {
    cache.put(request, response.clone());
  }

  return response;
}

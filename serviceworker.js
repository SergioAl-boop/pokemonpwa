const CACHE_NAME = "pokedex-v2";
const STATIC_CACHE = `${CACHE_NAME}-static`;
const API_CACHE = `${CACHE_NAME}-api`;
const IMAGE_CACHE = `${CACHE_NAME}-images`;

const STATIC_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./js/app.js",
    "./imagenes/pokebola-icon.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(async cache => {
                for (const file of STATIC_FILES) {
                    try {
                        const response = await fetch(file);
                        if (response.ok) {
                            await cache.put(file, response);
                        }
                    } catch (error) {
                        console.warn(`No se pudo precachar: ${file}`, error);
                    }
                }
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key =>
                        key.startsWith("pokedex-") &&
                        ![
                            STATIC_CACHE,
                            API_CACHE,
                            IMAGE_CACHE
                        ].includes(key)
                    )
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);

    try {
        const response = await fetch(request);

        if (response.ok) {
            await cache.put(request, response.clone());
        }

        return response;
    } catch {
        const cached = await cache.match(request);

        if (cached) return cached;

        throw new Error("No hay conexión ni datos guardados.");
    }
}

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) return cached;

    const response = await fetch(request);

    if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
    }

    return response;
}

self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        if (request.mode === "navigate") {
            event.respondWith(
                fetch(request).catch(async () => {
                    const cachedPage = await caches.match("./index.html") || await caches.match("/");
                    return cachedPage || new Response("Aplicación no disponible sin conexión.", {
                        status: 503,
                        headers: { "Content-Type": "text/html; charset=utf-8" }
                    });
                })
            );
            return;
        }

        event.respondWith(
            cacheFirst(request, STATIC_CACHE).catch(() =>
                new Response("Recurso no disponible sin conexión.", {
                    status: 503
                })
            )
        );
        return;
    }

    if (url.hostname === "pokeapi.co") {
        event.respondWith(
            networkFirst(request, API_CACHE).catch(() =>
                new Response(
                    JSON.stringify({
                        error: "Sin conexión a Internet. Mostrando datos guardados."
                    }),
                    {
                        status: 503,
                        headers: {
                            "Content-Type": "application/json; charset=utf-8"
                        }
                    }
                )
            )
        );
        return;
    }

    if (url.hostname === "raw.githubusercontent.com") {
        event.respondWith(
            cacheFirst(request, IMAGE_CACHE).catch(() =>
                Response.error()
            )
        );
    }
});
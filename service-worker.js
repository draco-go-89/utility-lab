"use strict";

const CACHE_NAME = "utility-lab-shell-v1";
const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/base.css",
    "./css/layout.css",
    "./css/components.css",
    "./css/animations.css",
    "./css/qr-studio.css",
    "./css/screenshot-intelligence.css",
    "./libraries/qrcode.min.js",
    "./js/app.js",
    "./js/database.js",
    "./js/settings.js",
    "./js/router.js",
    "./js/backup.js",
    "./js/search.js",
    "./js/qr/generator.js",
    "./js/qr/customizer.js",
    "./js/qr/validator.js",
    "./js/qr/exporter.js",
    "./js/qr/scanner.js",
    "./js/screenshots/importer.js",
    "./js/screenshots/ocr.js",
    "./js/screenshots/categorizer.js",
    "./js/screenshots/indexing.js",
    "./js/screenshots/duplicates.js",
    "./js/screenshots/viewer.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith("utility-lab-") && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache =>
                            cache.put("./index.html", copy)
                        );
                    }
                    return response;
                })
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME);
                    return cache.match(request) ||
                        cache.match("./index.html");
                })
        );
        return;
    }

    event.respondWith(
        caches.match(request)
            .then(cached => cached || fetch(request).then(response => {
                if (!response.ok) return response;
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                return response;
            }))
    );
});

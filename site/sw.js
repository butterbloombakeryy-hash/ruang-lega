const CACHE_NAME='ruang-lega-v1-4';
const FILES=['./','./index.html','./manifest.webmanifest','./icons/ruang-lega.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{if(r.ok&&new URL(e.request.url).origin===self.location.origin){const cp=r.clone();caches.open(CACHE_NAME).then(cache=>cache.put(e.request,cp))}return r}).catch(()=>caches.match('./index.html'))))});

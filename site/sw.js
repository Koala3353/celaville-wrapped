// sw.js -- Celaville Wrapped service worker
//
// Cache-first for this site's own static assets (index/CSS/JS/fonts/walker/
// og image), network-only for the Apps Script origin -- payload and progress
// pings must never be served stale from cache, and Apps Script's own CORS
// setup (see api.js) already assumes every request is a real network hit.
//
// Pairs with the localStorage payload cache in api.js: this makes the SHELL
// (markup/styles/scripts/fonts) load instantly and work offline on a repeat
// visit; api.js separately makes the DATA available offline via localStorage.
// Neither on its own would give a full instant-and-offline second open.

var CACHE_NAME = 'celaville-wrapped-v1';
var PRECACHE = [
  './',
  './index.html',
  './assets/styles.css',
  './assets/api.js',
  './assets/slides.js',
  './assets/share.js',
  './assets/app.js',
  './assets/walker.webp',
  './assets/fonts/bevan-400.woff2',
  './assets/fonts/grandstander-variable.woff2',
  './assets/fonts/montserrat-variable.woff2',
  './favicon.svg',
  './og.png',
  './manifest.webmanifest'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(PRECACHE); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var url = new URL(event.request.url);

  // Apps Script (and its googleusercontent.com redirect target): always go
  // to the network. This is where the payload and the progress pings live,
  // and both must reflect what the server actually has right now.
  if(url.hostname.indexOf('script.google.com')>-1 || url.hostname.indexOf('googleusercontent.com')>-1){
    event.respondWith(fetch(event.request));
    return;
  }

  // Everything same-origin: cache-first, falling back to network and then
  // populating the cache for next time.
  if(url.origin === self.location.origin){
    event.respondWith(
      caches.match(event.request).then(function(cached){
        if(cached) return cached;
        return fetch(event.request).then(function(res){
          if(res && res.ok){
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
          }
          return res;
        }).catch(function(){
          // Offline and not cached -- for a navigation, fall back to the
          // shell so the app can still boot from localStorage's payload
          // cache instead of a bare browser error page.
          if(event.request.mode === 'navigate') return caches.match('./index.html');
        });
      })
    );
  }
});

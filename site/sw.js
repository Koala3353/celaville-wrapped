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

// Bump this on every deploy that changes a precached file. Cache-first alone
// (the original strategy here) only re-fetches when the SW SCRIPT ITSELF
// changes bytes -- if only index.html/app.js/styles.css/etc change, browsers
// with an already-installed SW would serve the stale precache forever, with
// no way back short of the visitor manually clearing site data. Bumping the
// name forces a real install/activate cycle; the stale-while-revalidate
// fetch handler below is the second half of the fix, for the gap between
// deploys where a bump was forgotten.
var CACHE_NAME = 'celaville-wrapped-v2';
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

  // Everything same-origin: stale-while-revalidate, not plain cache-first.
  // A cached copy (if any) answers immediately -- so a repeat visit is still
  // instant -- but every request ALSO goes to the network in the background
  // and re-populates the cache regardless. That means a forgotten CACHE_NAME
  // bump above no longer strands a returning visitor on a stale bundle
  // forever: the very next load after a deploy quietly catches up, instead
  // of needing a hard refresh or a manual "clear site data".
  if(url.origin === self.location.origin){
    event.respondWith(
      caches.match(event.request).then(function(cached){
        var network = fetch(event.request).then(function(res){
          if(res && res.ok){
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
          }
          return res;
        }).catch(function(){
          // Offline and nothing cached -- for a navigation, fall back to the
          // shell so the app can still boot from localStorage's payload
          // cache instead of a bare browser error page.
          if(event.request.mode === 'navigate') return caches.match('./index.html');
        });
        return cached || network;
      })
    );
  }
});

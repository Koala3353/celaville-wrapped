// api.js -- Celaville Wrapped
// The only file that knows Apps Script exists. Everything else (app.js,
// slides.js, share.js) just calls CelavilleAPI.loadPayload()/ping() and gets
// back plain JS objects/promises.
//
// ── CORS, and why every request here looks the way it does ────────────────
// Apps Script cannot set response headers on its own doGet, so the only
// requests that can ever work are ones that need no preflight and no header
// inspection:
//
//   1. Payload fetch is a SIMPLE GET -- no custom headers, ever. No Accept,
//      no Content-Type, no X-*. Any one of those makes it a non-simple
//      request, the browser fires an OPTIONS preflight, Apps Script has no
//      doOptions, and the whole thing fails with an opaque CORS error. That
//      is why the API marker is a query param (?api=1) rather than an
//      Accept header -- the header would be the tidier design, but Apps
//      Script forecloses it.
//
//   2. Expect the redirect hop. A /exec GET answers 302 to
//      script.googleusercontent.com/.../echo?...; THAT final response is
//      the one carrying Access-Control-Allow-Origin: *. redirect:'follow'
//      (fetch's default) handles it. Two consequences: never use
//      redirect:'error'/'manual' here, and never switch this to POST -- a
//      POST that redirects gets re-issued as GET and the body vanishes
//      silently. The API stays GET-only, which it naturally is anyway
//      (idempotent reads).
//
//   3. The deployment itself must be "Execute as: Me" / "Who has access:
//      Anyone" (not "Anyone with a Google account" -- that one 302s an
//      anonymous reader to a login page and returns HTML, not JSON). A
//      "CORS error" in the console is very often actually this
//      misconfiguration wearing a CORS costume.
//
//   4. The progress ping never uses fetch at all -- see ping() below.
'use strict';

var CelavilleAPI = (function(){
  var WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzCCk2VbgN3E_C4FSQLHlBkR7dCutmyl2JaoWBtEkRr8eZJbrwP9GbWVBKDtPDnUFytKQ/exec';
  var TIMEOUT_MS = 12000;

  function cacheKey(token){ return 'cv:payload:' + token; }

  function readCache(token){
    try {
      var raw = localStorage.getItem(cacheKey(token));
      if(!raw) return null;
      return JSON.parse(raw);
    } catch(e){ return null; }
  }
  function writeCache(token, payload){
    try { localStorage.setItem(cacheKey(token), JSON.stringify(payload)); } catch(e){ /* quota / private mode -- fine to skip */ }
  }

  /* One real network attempt: simple GET, no headers, follow the redirect,
     bounded by an AbortController timeout. Rejects with a plain Error
     carrying a `.userMessage` the loader can show directly. */
  function attempt(url){
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ctrl ? setTimeout(function(){ ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(url, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function(res){
      if(t) clearTimeout(t);
      if(!res.ok){
        var e = new Error('HTTP ' + res.status);
        e.userMessage = 'The server said no (HTTP ' + res.status + ').';
        e.retryable = false;
        throw e;
      }
      return res.json();
    }).catch(function(err){
      if(t) clearTimeout(t);
      if(err && err.name === 'AbortError'){
        var te = new Error('timeout');
        te.userMessage = 'That took too long. Check your connection and try again.';
        te.retryable = true;
        throw te;
      }
      if(err && err.userMessage) throw err; // already classified above
      var ne = new Error(err && err.message || 'network error');
      ne.userMessage = 'Couldn’t reach the server. Check your connection and try again.';
      ne.retryable = true;
      throw ne;
    });
  }

  /* Retries once, but ONLY on a network/timeout failure -- never on a
     deterministic ok:false from the server (bad token, no record, etc.),
     where a second attempt would just get the exact same answer. */
  function attemptWithRetry(url){
    return attempt(url).catch(function(err){
      if(err && err.retryable) return attempt(url);
      throw err;
    });
  }

  /* token: the member's ?id= value. mock: truthy to hit ?api=1&mock=1
     instead (shareable fabricated-data demo payload, used by local dev and
     by the curl smoke test in the README). Returns a Promise<payload>. */
  function loadPayload(token, mock){
    var cached = !mock && token ? readCache(token) : null;
    var url = WEB_APP_URL + '?api=1' + (mock ? '&mock=1' : ('&id=' + encodeURIComponent(token)));

    var network = attemptWithRetry(url).then(function(envelope){
      if(!envelope || envelope.ok !== true){
        var code = envelope && envelope.code;
        var msg =
          code === 'no_token' ? 'This link is missing its code.' :
          code === 'unknown_token' ? 'This link has expired or isn’t recognized.' :
          code === 'no_record' ? 'We couldn’t find your data.' :
          (envelope && envelope.message) || 'Something went wrong on our end.';
        var e = new Error(code || 'not_ok');
        e.userMessage = msg;
        e.retryable = false;
        throw e;
      }
      if(!mock && token) writeCache(token, envelope.payload);
      return envelope.payload;
    });

    if(!cached) return network;

    // Cache-then-network: render instantly from the cached payload, but
    // still resolve/replace with a fresh fetch in the background so a
    // second open on a flaky connection still works AND stays current. The
    // first caller (boot()) just gets the cached copy immediately; the
    // background refresh silently updates localStorage for next time.
    network.catch(function(){ /* background refresh failed silently -- cached copy already served */ });
    return Promise.resolve(cached);
  }

  /* Progress beacon. Deliberately NOT fetch: an <img> request is not subject
     to CORS at all, so it cannot fail for cross-origin reasons, and the
     response body is discarded -- the write already happened server-side by
     the time the (irrelevant, JSON-is-not-an-image) onerror would fire.
     Quartile throttle kept from the original: ~5 beacons per reader. */
  var reported = {};
  function ping(token, slide, total){
    if(!token) return;
    var q = (slide >= total) ? 'end' : String(Math.floor((slide/total)*4));
    if(reported[q]) return;
    reported[q] = true;
    var url = WEB_APP_URL + '?api=ping&id=' + encodeURIComponent(token) +
      '&slide=' + encodeURIComponent(slide) + '&total=' + encodeURIComponent(total) +
      '&_=' + Date.now();
    if(slide >= total && typeof fetch === 'function'){
      // Last slide: prefer a keepalive fetch so the ping survives the tab
      // closing right after the reader finishes -- keepalive isn't
      // available on Image(). no-cors means we never read the response,
      // which is fine: this is fire-and-forget either way.
      try {
        fetch(url, { mode: 'no-cors', keepalive: true, credentials: 'omit', cache: 'no-store' }).catch(function(){});
        return;
      } catch(e){ /* fall through to the image beacon */ }
    }
    var i = new Image();
    i.src = url;
  }

  return { loadPayload: loadPayload, ping: ping };
})();

// app.js -- Celaville Wrapped
// The engine: fetch bootstrap, slide DOM construction from S[], the village
// pan/time-of-day system, show()/next()/prev(), the swipe/spring/rubber
// physics, keydown + hold-to-pause handlers, and the loader/cloud-descent
// reveal. Physics constants (HYST/COMMIT/FLICK, stiffness/damping) are
// UNCHANGED from Wrapped.html -- tuned, not touched, by this migration.
//
// Boot order: index.html loads api.js, slides.js, share.js, then this file.
// boot() (bottom of this file) is the only top-level side effect: it reads
// ?id=/?mock= from location.search, fetches the payload via api.js, calls
// buildSlides(payload) (slides.js) to populate S[], calls buildDom() below
// to render it, and only then dismisses the loader. Everything downstream
// of that point -- show/next/prev, the swipe handlers -- is unchanged in
// spirit from the original inline <script> this file was extracted from.

var LOAD_T0 = (window.performance && performance.now) ? performance.now() : Date.now();
var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* navigator.vibrate is Android-only (Safari has never implemented it) --
   that's fine as a progressive enhancement, guarded here in one place. */
function vibrate(pattern){
  if(!REDUCED && navigator.vibrate){ try{ navigator.vibrate(pattern); }catch(e){} }
}

/* Three staggered bursts over the recap's sky. Brand colors only, spoke count
   and radius kept modest -- this is a wink at the finale, not a light show. */
/* item 4: one brand-shaped glyph per burst, cycling through the three so all
   three (mahjong tile, dice pips, lantern) show up across the recap's three
   staggered bursts instead of piling every shape onto every burst -- same
   "wink, not a light show" restraint as the dot spokes above. The plain
   colored-dot spokes are untouched and stay the prefers-reduced-motion
   fallback (styles.css hides .fw-glyph entirely under reduced motion, same
   as the existing .fw i reduced-motion rule already does for the spokes). */
var FW_GLYPHS=[
  {cls:'fw-tile', ang:38},
  {cls:'fw-dice', ang:154},
  {cls:'fw-lantern', ang:272}
];
function fireworksHTML(){
  var BURSTS=[
    {x:22, y:20, colors:['#D94F40','#E4B64A'], delay:0},
    {x:76, y:14, colors:['#5E8F6B','#9FD0EB'], delay:.35},
    {x:50, y:28, colors:['#E4B64A','#D94F40'], delay:.7},
  ];
  var out='<div class="fireworks" aria-hidden="true">';
  BURSTS.forEach(function(b,bi){
    var spokes='', n=10;
    for(var i=0;i<n;i++){
      var ang=(360/n*i)+'deg', c=b.colors[i%b.colors.length], d=(b.delay+i*0.012).toFixed(3);
      spokes+='<i style="--ang:'+ang+';--c:'+c+';--d:'+d+'s"></i>';
    }
    var g=FW_GLYPHS[bi%FW_GLYPHS.length];
    var glyph='<i class="fw-glyph '+g.cls+'" style="--ang:'+g.ang+'deg;--d:'+(b.delay+0.05).toFixed(3)+'s"></i>';
    out+='<div class="fw" style="left:'+b.x+'%;top:'+b.y+'%">'+spokes+glyph+'</div>';
  });
  return out+'</div>';
}

var slidesEl=document.getElementById('slides'),
    barsEl=document.getElementById('bars'),
    hintEl=document.getElementById('hint'),
    idx=0,timer=null,started=false;
var slideEls=[], barEls=[];

/* ── DOM construction from S[] ─────────────────────────────────────────────
   Unchanged from the original top-level script; it just couldn't run until
   the payload existed, which used to be guaranteed by the time this parsed
   (server-side templating). Now it's called by boot() once buildSlides()
   (slides.js) has populated S. */
function buildDom(){
  S.forEach(function(s,i){
    var d=document.createElement('section');
    var isRecap=(i===S.length-1);
    d.className='slide'+(s.cls?' '+s.cls:'')+(isRecap?' recap':'');
    // Fireworks are a sibling of .inner, not a child inside it -- inside,
    // they'd pick up the per-child entrance stagger
    // (.inner > *:nth-child(n)) and fight it for the transform property on
    // the same element.
    d.innerHTML='<div class="inner">'+s.html+'</div>'+(isRecap?fireworksHTML():'');
    slidesEl.appendChild(d);
    var b=document.createElement('div');
    b.className='bar';b.innerHTML='<i></i>';
    barsEl.appendChild(b);
  });
  slideEls=slidesEl.children; barEls=barsEl.children;

  /* Once a child's entrance "rise" animation finishes, mark it .settled so
     the CSS rule releases transform back to the normal cascade (see the
     comment on that rule in styles.css). Delegated on #slides rather than
     per-element, since slides are built once up front. */
  slidesEl.addEventListener('animationend', function(e){
    if(e.animationName==='rise') e.target.classList.add('settled');
  });

  /* The picket fence is generated rather than hand-listed: four stretches of
     evenly spaced pickets with two rails behind them. Hand-writing 60
     <path>s was how the first pass ended up with three lopsided posts next
     to Ayi. */
  (function buildFence(){
    var f=document.getElementById('fence');
    if(!f) return;
    var stretches=[[430,560],[900,1040],[1700,1840],[2210,2330]], out='';
    stretches.forEach(function(r){
      var x0=r[0], x1=r[1];
      out+='<path d="M'+x0+' 50 h'+(x1-x0)+'" stroke-width="2.2"/>';
      out+='<path d="M'+x0+' 62 h'+(x1-x0)+'" stroke-width="2.2"/>';
      // Gemini-generated picket (gemini-svg-prompts.md, prompt 6): a
      // point-topped panel plus two knot dots, translated so its own bottom
      // (y29.4) and center (x4) land where the old rect-and-triangle
      // picket's bottom (y70) and center (x+3) used to, keeping the rail
      // lines above at y50/62 still crossing through it in the same place.
      for(var x=x0;x<=x1-6;x+=15){
        out+='<g transform="translate('+(x-1)+',40.6)">'+
          '<polygon points="4,2.5 7,6.5 7,29.4 1,29.4 1,6.5"/>'+
          '<circle cx="4" cy="11" r="0.5" fill="#4F4036"/>'+
          '<circle cx="4" cy="23" r="0.5" fill="#4F4036"/>'+
        '</g>';
      }
    });
    f.innerHTML=out;
  })();

  ['vclouds','vfar','vmid','vnear'].forEach(function(id){
    var w=document.getElementById(id);
    if(w) panEls[id]=w.querySelector('svg');
  });
  warmEl=document.getElementById('vwarm'); skyEl=document.getElementById('vsky');
  walkerEl=document.getElementById('walker'); printsEl=document.getElementById('prints');
  villageWrap=document.getElementById('village');
  initParallax();
  initLandmarkTaps();
}

/* ── item 5: explorable recap map ─────────────────────────────────────────
   The schoolhouse, mahjong pavilion and lantern field are plain decorative
   SVG inside #village (pointer-events:none by default, see styles.css) for
   every other slide. Only while the recap is on screen does #village gain
   .recap-active, which is the ONLY thing that flips .landmark's own
   pointer-events back to auto (styles.css) -- so this tap surface exists
   nowhere else in the deck. One delegated listener on #village (rather than
   one per landmark) since buildFence()-style per-shape wiring would have to
   run again every time the walk's panorama markup changed. */
var LANDMARK_TIP_MS=2600;
function landmarkStatText(key){
  if(key==='course' && P.basics && P.basics.course){
    return 'Your course: '+esc(P.basics.course)+(P.basics.courseIsSolo?' · only you':' · '+P.basics.coursePct+'% of Celaville');
  }
  if(key==='mahjong' && P.mahjong){
    return 'Mahjong: '+P.mahjong.games+' '+plural(P.mahjong.games,'game')+' · '+P.mahjong.coins+' coins';
  }
  if(key==='journey' && P.journey){
    return 'You showed up '+P.journey.totalVisits+'x, '+P.journey.eventCount+' of '+P.journey.totalEvents+' events';
  }
  return null;
}
var landmarkTip=null, landmarkTipT=null;
function showLandmarkTip(lm){
  var text=landmarkStatText(lm.getAttribute('data-lm'));
  if(!text) return;
  // the tap affordance itself: retrigger the glow/scale pulse even on a
  // second tap of the same landmark, the same force-reflow trick buildFence's
  // neighbours (countUp/animateDonuts) already use elsewhere in this file.
  lm.classList.remove('lm-tap'); void lm.getBoundingClientRect(); lm.classList.add('lm-tap');
  if(!landmarkTip){
    landmarkTip=document.createElement('div');
    landmarkTip.className='lm-tip';
    landmarkTip.setAttribute('aria-live','polite');
    frameEl.appendChild(landmarkTip);
  }
  landmarkTip.textContent=text;
  landmarkTip.classList.remove('show'); void landmarkTip.offsetWidth; landmarkTip.classList.add('show');
  clearTimeout(landmarkTipT);
  landmarkTipT=setTimeout(function(){ landmarkTip.classList.remove('show'); }, LANDMARK_TIP_MS);
}
function initLandmarkTaps(){
  if(!villageWrap) return;
  // Listens on #village, which sits BETWEEN the tapped landmark and #frame in
  // the DOM (index.html), so this fires and can stopPropagation() before
  // frameEl's own click handler (tap-left-third/right-two-thirds nav) ever
  // sees the event -- but only when the recap is actually on screen; every
  // other slide lets the click bubble straight through untouched.
  villageWrap.addEventListener('click', function(e){
    if(!villageWrap.classList.contains('recap-active')) return;
    var lm=e.target.closest('.landmark');
    if(!lm) return;
    e.stopPropagation();
    showLandmarkTip(lm);
  });
}

/* ── walking through the village ──────────────────────────────────────────
   One journey, four layers, one clock. The panorama is 2600 wide inside a
   520-wide frame, so there are 2080px of village to cross; progress through
   the slides maps straight onto that distance, and each layer covers a
   fraction of it so nearer things sweep past faster. */
var VILLAGE_W=2600, PAN_RATE={vclouds:0.20, vfar:0.45, vmid:0.75, vnear:1.00};
var panEls={}, warmEl=null, skyEl=null, walkerEl=null, printsEl=null, villageWrap=null;

/* The walk runs morning -> noon -> golden -> dusk. Keyed off how far along
   the story the reader is rather than off act boundaries, so it still warms
   smoothly for the sparse members whose story is only eight slides long. */
/* Sunrise through night, not just morning through dusk -- paintVillage's
   own lerp below is written generically over TOD.length, so extending this
   array is the entire change; no other math needed to move. Two new stops:
   sunrise opens the walk on a warm pink dawn instead of straight into pale
   morning blue, and night closes it in a dusky indigo rather than stopping
   at dusk's lavender. `warm` keeps doing the same double duty it already
   does -- it's not really "warmth", it's "how late in the day this is",
   which is why night's warm is the highest value in the table even though
   its sky is the coolest-toned: it's what pushes window-glow/stars/
   fireflies to their most visible state, and night is where all three
   should be maxed out. */
var TOD=[
  {t:'#F7CBAF', b:'#FFF2E4', warm:0.05},  /* sunrise  */
  {t:'#BFE0F3', b:'#FFFCF7', warm:0},     /* morning  */
  {t:'#A9D6EE', b:'#FDFBF6', warm:0.20},  /* midday   */
  {t:'#F0E4CE', b:'#FFFAF2', warm:0.62},  /* golden   */
  {t:'#CFC6D8', b:'#FBEFE4', warm:0.92},  /* dusk     */
  {t:'#4B4771', b:'#E9DBCF', warm:1}      /* night    */
];
/* Plain channel-wise RGB lerp -- the TOD stops above are all opaque 6-digit
   hexes, so this doesn't need to handle alpha or short-hex forms. */
function lerpColor_(a,b,t){
  var ah=parseInt(a.slice(1),16), bh=parseInt(b.slice(1),16);
  var ar=(ah>>16)&255, ag=(ah>>8)&255, ab=ah&255;
  var br=(bh>>16)&255, bg=(bh>>8)&255, bb=bh&255;
  var r=Math.round(ar+(br-ar)*t), g=Math.round(ag+(bg-ag)*t), bl=Math.round(ab+(bb-ab)*t);
  return '#'+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);
}

function paintVillage(i,total){
  var p = total>1 ? i/(total-1) : 0;
  // travel used to be a hardcoded VILLAGE_W-520, assuming every layer
  // renders at a fixed 520px-wide frame. But each layer's <svg> is sized by
  // height:auto (see the .vlayer > svg rule) so its RENDERED width comes
  // from its own container height times its viewBox aspect ratio -- which
  // varies by device and, since the four layers have four different aspect
  // ratios, varies BETWEEN layers too. On a real (narrower/shorter) phone
  // frame, vnear's actual rendered width can fall short of frameWidth +
  // the hardcoded travel, so panning to the hardcoded distance ran past
  // the end of its own painted content -- a transparent gap that revealed
  // vmid's differently-colored fill underneath, seen as a hard vertical
  // color "cliff" rather than a smooth hill.
  // Anchoring travel to vnear's own measured width instead fixes this by
  // construction: vnear (pan rate 1.00) can never pan past its own edge,
  // since that edge IS what travel is measured from, and every other layer
  // needs strictly less absolute pan (rate < 1) while rendering
  // proportionally wider to begin with (shallower layers have taller
  // viewBoxes relative to their container height), so they carry
  // comfortable spare width too.
  var frameW = (frameEl && frameEl.getBoundingClientRect().width) || 520;
  var nearSvg = panEls.vnear;
  var nearW = (nearSvg && nearSvg.getBoundingClientRect().width) || (VILLAGE_W - 520 + frameW);
  var travel = Math.max(0, nearW - frameW);
  for(var id in panEls){
    if(!panEls[id]) continue;
    panEls[id].style.setProperty('--pan', (-(travel*PAN_RATE[id]*p)).toFixed(1)+'px');
  }
  // Continuous blend between the two nearest TOD stops, not a snap to
  // whichever quarter of the story `p` falls in. The old Math.floor(p*4)
  // meant three-quarters of the walk held one flat color and all the
  // change happened in three sudden jumps at the act boundaries -- exactly
  // the "abrupt" this was flagged for. Blending on `pos`'s fractional part
  // means every single slide nudges the sky a little, so there's no jump
  // left for the (now-registered, see styles.css) --tod-top/--tod-bot
  // transition to paper over -- it's smooth by construction, and the
  // transition is just there to smooth a big jump (e.g. jumping straight to
  // slide 0 on replay) rather than carry the whole effect on its own.
  var pos = p*(TOD.length-1);
  var seg0 = Math.max(0, Math.min(TOD.length-2, Math.floor(pos)));
  var segT = pos-seg0;
  var todA = TOD[seg0], todB = TOD[seg0+1];
  var tod = { t: lerpColor_(todA.t, todB.t, segT), b: lerpColor_(todA.b, todB.b, segT),
              warm: todA.warm+(todB.warm-todA.warm)*segT };
  if(skyEl){
    skyEl.style.setProperty('--tod-top', tod.t);
    skyEl.style.setProperty('--tod-bot', tod.b);
  }
  if(warmEl) warmEl.style.setProperty('--warm', tod.warm);
  // items 2/3: the SAME warm value #vwarm's wash already reads, exposed one
  // level up on #village itself so the window-glow circles planted in the
  // schoolhouse/pavilion SVGs (index.html) and the sky's star scatter can
  // read it via CSS custom-property inheritance -- neither of them needs
  // paintVillage to compute anything a second time.
  if(villageWrap) villageWrap.style.setProperty('--dusk-glow', tod.warm);
  // Also set on #frame itself (village's own parent), not just #village --
  // #slides sits as a SIBLING of #village under #frame, so a heading/kicker
  // inside .inner can only ever inherit --dusk-glow if it's set on a shared
  // ancestor. This is what lets styles.css's --onsky-ink/--onsky-coral
  // (defined on #frame, see the "sky-legible text" block) track the same
  // live warmth value instead of being stuck at their unset fallback.
  if(frameEl) frameEl.style.setProperty('--dusk-glow', tod.warm);
  /* One footprint per step already taken, laid down behind her. */
  if(printsEl){
    var want=Math.min(i,9);
    while(printsEl.children.length>want) printsEl.removeChild(printsEl.lastChild);
    while(printsEl.children.length<want){
      var n=printsEl.children.length;
      var f=document.createElement('i');
      f.style.left=(24 - n*2.4)+'%';
      f.style.setProperty('--r', ((n%2)?12:-9)+'deg');
      f.style.opacity=String(Math.max(.08, .2 - n*0.02));
      printsEl.appendChild(f);
    }
  }
  if(walkerEl) walkerEl.classList.toggle('arrived', i>=total-1);
}

/* Animates a .donut's --p custom property from 0 up to its data-p target, in
   sync with the countUp digits beside it (slides.js). Only meaningful where
   @property --p is registered (styles.css) so the value can transition at
   all -- elsewhere this just sets the end value immediately, which is the
   original static-ring behavior and a perfectly safe fallback. */
function animateDonuts(root){
  Array.prototype.forEach.call(root.querySelectorAll('.donut[data-p]'), function(el){
    var target = el.getAttribute('data-p');
    el.style.setProperty('--p', 0);
    void el.offsetWidth; // force a style flush so the 0 actually paints...
    requestAnimationFrame(function(){ el.style.setProperty('--p', target); }); // ...before this transitions
  });
}

/* ── round 2, item 5: screen-reader companion ─────────────────────────────
   Mirrors each slide's kicker + heading into the visually-hidden #slidelive
   region (index.html) so a reader following along by ear hears the same
   beats show() puts on screen, every time the slide changes. */
var liveEl = document.getElementById('slidelive');
function announceSlide(i){
  if(!liveEl || !slideEls[i]) return;
  var root = slideEls[i];
  var kicker = root.querySelector('.kicker');
  var heading = root.querySelector('h1,h2,h3');
  var parts = [];
  if(kicker) parts.push(kicker.textContent.trim());
  if(heading) parts.push(heading.textContent.trim());
  liveEl.textContent = parts.length ? parts.join(' — ') : ('Slide '+(i+1)+' of '+S.length);
}

/* ── round 2, item 1: browser history integration ─────────────────────────
   Slide 0 is left alone entirely -- it's the page's own natural load state,
   so browser back from there exits the page, which is exactly right. The
   FIRST time the reader moves off it, one pushState plants a single new
   history entry; every slide after that replaces that same entry instead of
   growing a 24-deep stack. That means a hardware/gesture back from any
   slide N>0 lands on slide 0 in one hop (not a step-by-step unwind) and a
   second back from there leaves the page -- the cadence the brief's own
   parenthetical calls out as the one that feels right for a swipe deck this
   long. suppressHistoryPush guards the one call site (the popstate handler
   below) that must drive show() WITHOUT re-writing history it just came from. */
var historyStarted = false, suppressHistoryPush = false;
function updateHistoryForSlide(i){
  if(suppressHistoryPush || !window.history || !history.pushState) return;
  if(i===0) return; // slide 0 keeps whatever entry is already there -- see above
  try{
    if(!historyStarted){ historyStarted = true; history.pushState({slide:i}, '', location.href); }
    else history.replaceState({slide:i}, '', location.href);
  }catch(e){}
}
window.addEventListener('popstate', function(e){
  var target = (e.state && typeof e.state.slide==='number') ? e.state.slide : 0;
  suppressHistoryPush = true;
  show(target);
  suppressHistoryPush = false;
});

/* ── round 2, item 4: first-open swipe hint ───────────────────────────────
   A one-time, self-dismissing cue that the deck is swipeable. Gated on a
   localStorage flag set the instant this runs (so even a reload this same
   session won't replay it) and skipped outright under reduced motion --
   the flag still gets set in that case, per the brief, so it's not
   perpetually "pending". pointer-events:none (styles.css) and its own
   automatic cleanup mean it can never sit in the way of a real tap/swipe. */
var SWIPE_HINT_KEY = 'celaville_swiped_hint_v1';
function maybeShowSwipeHint(){
  try{
    if(localStorage.getItem(SWIPE_HINT_KEY)) return;
    localStorage.setItem(SWIPE_HINT_KEY, '1');
  }catch(e){ return; } // no localStorage (private mode etc) -- skip, nothing to gate on
  if(REDUCED) return;
  var hint = document.createElement('div');
  hint.className = 'swipe-hint';
  hint.setAttribute('aria-hidden','true');
  hint.innerHTML = '<i></i><i></i><i></i>';
  frameEl.appendChild(hint);
  var done=false;
  function cleanup(){ if(done) return; done=true; if(hint.parentNode) hint.parentNode.removeChild(hint); }
  hint.addEventListener('animationend', cleanup);
  setTimeout(cleanup, 3200); // safety net if animationend never fires
}

/* ── round 2, item 2: desktop parallax ────────────────────────────────────
   A pointer-follow tilt on the village layers, fine-pointer/hover-capable
   devices only (a touch device's "pointer" IS the drag gesture already
   driving the swipe system -- layering a second, fake-hover reading of the
   same touch on top of it would fight that, not complement it) and only
   when reduced motion is off. rAF-throttled so a fast mousemove burst can't
   queue more style writes than the display can paint. Composes with the
   existing --pan pan/zoom transform by living on a different element
   entirely: --pan drives .vlayer > svg's transform (unchanged, tuned); this
   drives .vlayer's OWN transform (styles.css), a separate box one level up. */
var PARALLAX_OK = !REDUCED && window.matchMedia &&
  window.matchMedia('(hover:hover) and (pointer:fine)').matches;
var PARALLAX_RATE = {vclouds:0.35, vfar:0.7, vmid:1.15, vnear:1.7};
// vnear's horizontal parallax is disabled below (not just here) for a
// specific reason: paintVillage() sizes its pan distance so vnear's own
// right edge lands EXACTLY flush with the frame's right edge at the last
// slide, and exactly flush left at the first -- zero slack on whichever
// side the story is currently pinned against (that's what fixed the
// hard-edge "hill cliff" bug earlier in this project). vfar/vmid/vclouds
// all render comfortably wider than they need to and have real margin on
// both sides regardless of pan position, so parallax is safe on them. vnear
// has none: any extra horizontal nudge at either end of the story pulls its
// edge away from the frame and opens a gap onto whatever's behind it --
// exactly the "ground looks disconnected/missing" this is guarding against.
// Vertical parallax has no such constraint (the pan system is purely
// horizontal), so vnear keeps --pary and only loses --parx.
var PARALLAX_MAX = 5; // px at the frame edge, before a layer's own rate multiplies it
function initParallax(){
  if(!PARALLAX_OK) return;
  var raf=null, px=0, py=0;
  function apply(){
    raf=null;
    for(var id in PARALLAX_RATE){
      var layer=document.getElementById(id);
      if(!layer) continue;
      var xOff = (id==='vnear') ? 0 : px*PARALLAX_RATE[id];
      layer.style.setProperty('--parx', xOff.toFixed(2)+'px');
      layer.style.setProperty('--pary', (py*PARALLAX_RATE[id]).toFixed(2)+'px');
    }
  }
  // Listens on #frame, not #village -- #village is pointer-events:none (it's
  // a decorative layer sitting behind the slide deck), so it would never
  // itself receive a pointermove to react to.
  frameEl.addEventListener('pointermove', function(e){
    if(e.pointerType && e.pointerType!=='mouse') return; // belt+suspenders alongside the media query above
    var r=frameEl.getBoundingClientRect();
    var nx=((e.clientX-r.left)/r.width)-0.5, ny=((e.clientY-r.top)/r.height)-0.5;
    px = nx*2*PARALLAX_MAX; py = ny*2*PARALLAX_MAX;
    if(!raf) raf=requestAnimationFrame(apply);
  });
  frameEl.addEventListener('pointerleave', function(){
    px=0; py=0;
    if(!raf) raf=requestAnimationFrame(apply);
  });
}

function show(i){
  if(i<0) i=0;
  if(i>=S.length) i=S.length-1;
  // Cancel any pending auto-advance FIRST, before deciding which path below
  // runs -- applyScrollState() (which used to own this) only fires inside
  // apply(), and for a break-slide transition apply() is deferred into
  // document.startViewTransition()'s async callback rather than running
  // synchronously. A stale timer left armed during that setup window can
  // fire mid-transition and call show() again on top of this one, landing
  // on the wrong slide. Clearing it here, before either branch, closes that
  // race regardless of which path this call takes.
  clearTimeout(timer);
  var prevIdx=idx;
  var isBreak = (S[i].cls||'').indexOf('v-break')>-1;
  var wasBreak = slideEls[prevIdx] ? slideEls[prevIdx].classList.contains('v-break') : false;
  function apply(){
    idx=i;
    // clear .settled so re-entering a slide (back/replay) replays its
    // entrance instead of snapping straight to the settled resting state
    Array.prototype.forEach.call(slideEls[i].querySelectorAll('.inner > .settled'), function(el){
      el.classList.remove('settled');
    });
    for(var j=0;j<slideEls.length;j++){
      slideEls[j].classList.toggle('on',j===i);
      barEls[j].classList.toggle('done',j<i);
      barEls[j].classList.remove('active');
      barEls[j].querySelector('i').style.animation='none';
    }
    // restart the active bar animation
    var dur=S[i].dur;
    if(dur>0){
      var bi=barEls[i].querySelector('i');
      void bi.offsetWidth;
      bi.style.animation='';
      barEls[i].style.setProperty('--dur',dur+'ms');
      barEls[i].classList.add('active');
    } else {
      barEls[i].classList.add('done');
    }
    // Full-bleed act breaks need light frame chrome (see #frame.on-break).
    frameEl.classList.toggle('on-break', isBreak);
    // item 5: the ONLY thing that turns the landmark SVGs' pointer-events
    // back on (styles.css) -- see initLandmarkTaps() above for why gating it
    // here, rather than leaving them always-tappable, matters.
    if(villageWrap) villageWrap.classList.toggle('recap-active', i===S.length-1);
    paintVillage(i, S.length);
    CelavilleAPI.ping(TOK, i+1, S.length);
    slideEls[i].scrollTop=0;
    Array.prototype.forEach.call(slideEls[i].querySelectorAll('[data-count]'),countUp);
    animateDonuts(slideEls[i]);
    applyScrollState(true);
    if(slideEls[i].classList.contains('v-persona')) vibrate(30);
    if(i===S.length-1) vibrate([0,14,110,14,240,18]); // matches fireworksHTML's 0/.35/.7s burst delays
    updateHistoryForSlide(i);
    announceSlide(i);
    if(i!==0){
      // Leaving slide 0 for any reason (swipe, tap, keyboard, popstate) is
      // exactly when the one-time hint has done its job -- clear it so it
      // can never survive a swipe back to slide 0 and sit there stale.
      var h=frameEl.querySelector('.swipe-hint');
      if(h && h.parentNode) h.parentNode.removeChild(h);
    }
  }
  // View Transitions API, scoped to act breaks only: #village and #bars keep
  // their view-transition-name (styles.css) so they persist unchanged across
  // the cross-fade, and only the slide content actually transitions. Normal
  // slide-to-slide navigation never reaches this branch -- the pointer-driven
  // spring in the swipe system below is the interaction language there and
  // stays untouched.
  if(!REDUCED && document.startViewTransition && (isBreak || wasBreak)){
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

/* A slide taller than the screen is one the reader has to scroll through,
   and auto-advancing out from under them is the fastest way to lose the
   content -- so those slides wait for a tap and say so. Split out of show()
   because the iframe can be resized after a slide is already on screen,
   which would leave this decision stale. */
function applyScrollState(restartTimer){
  var el=slideEls[idx], dur=S[idx].dur;
  var scrolls=el.scrollHeight>el.clientHeight+4;
  // The recap is exempt: every row on it is a .card and every action is a
  // .btn, both opaque, so there was never a plain-text-over-ground collision
  // to fix here (unlike the platform ladder, which is bar labels and a
  // paragraph with nothing behind them). Locking it anyway flattened the
  // dusk village that's supposed to show through as the story's last beat,
  // which read as "why did the last page turn white" -- a regression, not a
  // fix, since nothing here actually needed the opaque background.
  el.classList.toggle('scroll-locked', scrolls && !el.classList.contains('recap'));
  if(scrolls){ barEls[idx].classList.remove('active'); barEls[idx].classList.add('done'); }
  if(restartTimer||scrolls){
    clearTimeout(timer);
    if(dur>0 && !scrolls) timer=setTimeout(function(){show(idx+1);},dur);
  }
  hintEl.textContent=scrolls?'scroll · then tap to continue':'tap to continue · hold to pause';
  hintEl.style.display=(idx===S.length-1)?'none':'';
}

function next(){ if(idx<S.length-1) show(idx+1); }
function prev(){ show(idx-1); }
function replay(){ show(0); }

/* tap left third = back, rest = forward; ignored if the gesture was a scroll
   or landed on a real control */
var frameEl=document.getElementById('frame'), moved=false;
frameEl.addEventListener('click',function(e){
  if(moved){moved=false;return;}
  if(e.target.closest('a,button')) return;
  var r=frameEl.getBoundingClientRect();
  (e.clientX-r.left < r.width*0.34) ? prev() : next();
});
document.getElementById('shareclose').addEventListener('click',function(e){
  e.stopPropagation(); closeShare();
});
/* The overlay lives inside #frame, whose click handler advances the slide,
   so every tap in here must stop propagating -- otherwise saving the card
   also skips the reader forward. Tapping the backdrop closes: a click that
   lands on the <dialog> element itself (not a descendant) is a backdrop
   click, since the dialog's own box is exactly its content box. */
document.getElementById('sharewrap').addEventListener('click',function(e){
  e.stopPropagation();
  if(e.target.id==='sharewrap') closeShare();
});
document.getElementById('sharedl').addEventListener('click',function(e){ e.stopPropagation(); });
/* <dialog> already closes on Esc natively (fires 'cancel' then closes) --
   this just keeps our own bookkeeping (classList fallback path) consistent
   on engines without real <dialog> support. */
document.getElementById('sharewrap').addEventListener('cancel',function(e){
  e.preventDefault(); closeShare();
});

document.addEventListener('keydown',function(e){
  // Don't drive the deck from behind an open overlay.
  var sw=document.getElementById('sharewrap');
  if(sw.open || sw.classList.contains('on')){
    if(e.key==='Escape') closeShare();
    return;
  }
  if(e.key==='ArrowRight'||e.key===' ') {e.preventDefault();next();}
  if(e.key==='ArrowLeft') prev();
});

/* hold to pause */
function pauseAuto(){ document.body.classList.add('paused'); clearTimeout(timer); }
function resumeAuto(){
  if(!document.body.classList.contains('paused')) return;
  document.body.classList.remove('paused');
  // resume with a short remaining window (never on slides the reader scrolls)
  clearTimeout(timer);
  var sc=slideEls[idx].scrollHeight>slideEls[idx].clientHeight+4;
  if(S[idx].dur>0 && !sc) timer=setTimeout(function(){show(idx+1);},2200);
  hintEl.textContent=sc?'scroll · then tap to continue':'tap to continue · hold to pause';
}
var holdT=null;
function holdStart(){ holdT=setTimeout(pauseAuto,260); }
function holdEnd(){ clearTimeout(holdT); resumeAuto(); }
['touchstart','mousedown'].forEach(function(ev){document.addEventListener(ev,holdStart,{passive:true});});
['touchend','mouseup','touchcancel'].forEach(function(ev){document.addEventListener(ev,holdEnd,{passive:true});});

/* System UI taking over the screen -- a screenshot, pulling down
   notifications, switching apps -- never touches the page, so the
   touch-based hold-to-pause above never fires and the auto-advance timer
   keeps running underneath the reader's hands. Pausing on blur/hidden and
   resuming with that same short grace window on the way back covers all of
   those without needing to know which one just happened. */
window.addEventListener('blur', pauseAuto);
window.addEventListener('focus', resumeAuto);
document.addEventListener('visibilitychange', function(){
  document.hidden ? pauseAuto() : resumeAuto();
});

/* ── the swipe ─────────────────────────────────────────────────────────────
   The card tracks the pointer 1:1, resists at the ends of the story instead
   of stopping dead, and hands its release velocity to a spring -- so a
   flick throws the page and a half-hearted drag falls back. Vertical
   scrolling on tall slides is untouched: the horizontal axis has to win by
   10px before anything is captured, and once the axis is decided it does
   not change mid-gesture. UNCHANGED physics constants -- do not touch. */
var HYST=10, COMMIT=0.34, FLICK=520;

function project(v, rate){ rate=rate||0.998; return (v/1000)*rate/(1-rate); }

/* Critically damped by default (no overshoot); a flick passes bounce>0 so
   the throw carries a little overshoot, which is the only place it feels
   right. */
function spring(from,to,v0,bounce,onFrame,onEnd){
  /* stiffness/damping are in s^-2 / s^-1, so every quantity below is in
     px and px/s and dt is in seconds. v0 arrives as px/s and is used as-is:
     dividing it by 1000 here (an earlier mistake) made it 1000x too small,
     which silently threw away the whole point of the velocity handoff. */
  var stiff=bounce>0?170:210, damp=bounce>0?20:29;   /* 2*sqrt(210)=29 -> critical */
  var x=from, v=v0, t0=null, raf=null;
  function step(ts){
    if(t0===null) t0=ts;
    var dt=Math.min((ts-t0)/1000,1/30); t0=ts;
    var a=-stiff*(x-to)-damp*v;
    v+=a*dt; x+=v*dt;
    if(Math.abs(x-to)<0.5 && Math.abs(v)<30){ onFrame(to); onEnd&&onEnd(); return; }
    onFrame(x);
    raf=requestAnimationFrame(step);
  }
  raf=requestAnimationFrame(step);
  return function cancel(){ if(raf) cancelAnimationFrame(raf); };
}

/* Progressive resistance past the first / last slide (Apple's rubber-band). */
function rubber(over,dim){ var c=0.55; return (over*dim*c)/(dim+c*Math.abs(over)); }

var g={id:null,x0:0,y0:0,axis:null,dx:0,el:null,hist:[],cancelSpring:null,w:520};

function setDrag(el,px){
  if(!el) return;
  el.style.transform = px ? 'translate3d('+px.toFixed(2)+'px,0,0)' : '';
  el.style.opacity = px ? String(Math.max(0.55, 1-Math.abs(px)/(g.w*1.7))) : '';
}
function endDrag(el){
  if(!el) return;
  el.style.transform=''; el.style.opacity=''; el.style.willChange='';
}

slidesEl.addEventListener('pointerdown', function(e){
  if(e.pointerType==='mouse' && e.button!==0) return;
  if(e.target.closest('a,button')) return;
  if(g.cancelSpring){ g.cancelSpring(); g.cancelSpring=null; }
  g.id=e.pointerId; g.x0=e.clientX; g.y0=e.clientY; g.axis=null; g.dx=0;
  g.el=slideEls[idx]; g.hist=[{x:e.clientX,t:e.timeStamp}];
  g.w=frameEl.getBoundingClientRect().width||520;
});

slidesEl.addEventListener('pointermove', function(e){
  if(g.id!==e.pointerId) return;
  var dx=e.clientX-g.x0, dy=e.clientY-g.y0;
  if(g.axis===null){
    if(Math.abs(dx)<HYST && Math.abs(dy)<HYST) return;
    /* Decide once. A gesture that started vertical stays a scroll for its
       whole life, which is what stops the card twitching mid-scroll. */
    g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if(g.axis==='x'){
      moved=true;
      try{ slidesEl.setPointerCapture(e.pointerId); }catch(err){}
      if(g.el) g.el.style.willChange='transform,opacity';
      clearTimeout(timer);                 /* don't auto-advance mid-gesture */
      clearTimeout(holdT);                 /* and don't read it as a hold    */
      document.body.classList.remove('paused');
    }
  }
  if(g.axis!=='x') return;
  g.hist.push({x:e.clientX,t:e.timeStamp});
  if(g.hist.length>6) g.hist.shift();
  /* At either end of the story there is nowhere to go, so resist. */
  var atStart = idx===0 && dx>0, atEnd = idx===S.length-1 && dx<0;
  g.dx = (atStart||atEnd) ? rubber(dx, g.w) : dx;
  if(!REDUCED) setDrag(g.el, g.dx);
  e.preventDefault();
}, {passive:false});

function finishDrag(e){
  if(g.id!==e.pointerId) return;
  var el=g.el, dx=g.dx, axis=g.axis;
  g.id=null; g.el=null; g.axis=null; g.dx=0;
  if(axis!=='x'){ return; }

  /* Velocity from the last few samples, not just the final pair. */
  var h=g.hist, v=0;
  if(h.length>1){
    var a=h[0], b=h[h.length-1], dt=(b.t-a.t)||16;
    v=(b.x-a.x)/dt*1000;
  }
  var projected = dx + project(v);
  var goNext = projected < -g.w*COMMIT || v < -FLICK;
  var goPrev = projected >  g.w*COMMIT || v >  FLICK;
  if(idx===0) goPrev=false;
  if(idx===S.length-1) goNext=false;

  if(goNext || goPrev){
    // 10ms tick the instant the commit resolves, so the haptic lands with
    // the spring's start rather than with show() landing moments later.
    vibrate(10);
    var to = goNext ? -g.w : g.w;
    if(REDUCED){ endDrag(el); goNext?next():prev(); return; }
    g.cancelSpring = spring(dx, to, v, 0.15, function(x){ setDrag(el,x); }, function(){
      endDrag(el);
      goNext ? next() : prev();
    });
  } else {
    if(REDUCED || !dx){ endDrag(el); applyScrollState(false); return; }
    /* Fell short: spring home from wherever the finger left it. */
    g.cancelSpring = spring(dx, 0, v, 0, function(x){ setDrag(el,x); }, function(){
      endDrag(el); applyScrollState(false);
    });
  }
}
slidesEl.addEventListener('pointerup', finishDrag);
slidesEl.addEventListener('pointercancel', function(e){
  if(g.id!==e.pointerId) return;
  var el=g.el; g.id=null; g.el=null; g.axis=null;
  if(!REDUCED && g.dx) g.cancelSpring=spring(g.dx,0,0,0,function(x){setDrag(el,x);},function(){endDrag(el);});
  else endDrag(el);
  g.dx=0;
});

/* ── theme-color: sky-to-ground, not sky-inside-a-box ────────────────────
   Impossible under Apps Script HtmlService, where the browser chrome
   belongs to script.google.com. On a real origin the chrome itself can
   bleed into the loader's sky gradient, then swap to parchment once the
   loader clears -- driven off the same timeout that adds #loader.gone. */
var THEME_COLOR_SKY = '#BFE0F3', THEME_COLOR_PAPER = '#FFFCF7';
function setThemeColor(hex){
  var m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute('content', hex);
}

/* ── boot: fetch the payload, then build and reveal ──────────────────────
   Replaces the old server-templated `var P = <?!= payload ?>` with a real
   network round trip (api.js). revealFromLoader() waits for BOTH the fetch
   to resolve AND LOAD_MIN to elapse, then reveals immediately -- so a fast
   response still holds for one full second (long enough to read as an
   intentional first scene, not a flicker), but a slow cold-start Apps
   Script response is never padded with EXTRA artificial waiting once the
   data is actually back. Previously a flat 3000ms regardless of how fast
   the fetch returned. */
var loaderEl=document.getElementById('loader');
var LOAD_MIN=1000; // keep in sync with the 1s in .ldr-bar > i's animation
var RUSH_MS=1100;  // keep in sync with .ldr-rush's 1.1s animation

function showLoaderError(message){
  if(!loaderEl) return;
  loaderEl.classList.add('error');
  var content = loaderEl.querySelector('.ldr-content');
  if(content){
    content.innerHTML =
      '<p class="ldr-title" style="flex-direction:column;gap:10px;text-align:center;max-width:78%">'+
        '<span>We couldn’t load your Wrapped.</span>'+
        '<span class="sm" style="font-family:Montserrat;font-weight:600;font-size:13px;opacity:.8">'+
          (message||'Check your connection and try again.')+
        '</span>'+
      '</p>'+
      '<button class="btn" style="width:auto;padding:12px 22px;margin-top:6px" onclick="location.reload()">Try again</button>';
  }
}

function revealFromLoader(){
  var elapsed=((window.performance && performance.now) ? performance.now() : Date.now())-LOAD_T0;
  setTimeout(function(){
    // Slide zero is settled behind the loader before any class below
    // touches it, so whichever exit plays, there's already ground to land
    // on.
    show(0);
    setThemeColor(THEME_COLOR_PAPER);
    var slide0=slideEls[0];
    var villageEl=document.getElementById('village');
    if(!loaderEl){ return; }
    if(REDUCED){
      loaderEl.classList.add('gone');
    } else {
      // Pulled-in start state applied while the loader is still fully
      // opaque, so there's no flash of it snapping into place -- then
      // forced-reflow + rAF so the browser paints that start state before
      // .ldr-land changes the target, which is what makes it a transition
      // instead of an instant jump.
      [villageEl, slide0].forEach(function(el){ el.classList.add('ldr-fall'); });
      void villageEl.offsetWidth;
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        [villageEl, slide0].forEach(function(el){ el.classList.add('ldr-land'); });
      }); });
      loaderEl.classList.add('done');           // fades the title/walker/bar,
      setTimeout(function(){                    // starts the cloud rush, then
        loaderEl.classList.add('gone');         // the whole loader clears once
      }, RUSH_MS);                               // the clouds have passed.
    }
    loaderEl.addEventListener('transitionend',function done(e){
      // .ldr-content fades too and that transition bubbles here -- only
      // remove the loader once it's the loader's own opacity that finished.
      if(e.target!==loaderEl) return;
      loaderEl.removeEventListener('transitionend',done);
      loaderEl.remove();
      [villageEl, slide0].forEach(function(el){ el.classList.remove('ldr-fall','ldr-land'); });
      maybeShowSwipeHint(); // one-time, slide-one-only -- see its own comment above
    });
  }, Math.max(0, LOAD_MIN-elapsed));
}

var TOK = null;

function boot(){
  var qs = new URLSearchParams(location.search);
  TOK = qs.get('id') || '';
  var mock = qs.get('mock');

  if(loaderEl){
    var srcImg=document.querySelector('#walker img');
    var ldrImg=loaderEl.querySelector('.ldr-walker');
    if(srcImg && ldrImg) ldrImg.src=srcImg.src;
    // Swallow taps on the loader itself so an eager first tap doesn't land
    // on #frame's click handler underneath and skip straight to slide two.
    loaderEl.addEventListener('click',function(e){ e.stopPropagation(); });
  }

  if(!TOK && !mock){
    showLoaderError('This link is missing its code. Ask for a fresh Wrapped link.');
    return;
  }

  CelavilleAPI.loadPayload(TOK, mock).then(function(payload){
    buildSlides(payload);
    buildDom();
    revealFromLoader();
  }).catch(function(err){
    showLoaderError(err && err.userMessage ? err.userMessage : 'Something went wrong loading your data.');
  });
}

if(loaderEl){
  boot();
} else {
  // No loader in the markup at all (shouldn't happen in production) --
  // still go through the same boot path, just without the reveal timing.
  boot();
}

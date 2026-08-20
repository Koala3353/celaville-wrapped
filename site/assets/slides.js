// slides.js -- Celaville Wrapped
// Per-slide content builders and the S[] slide table, ported from Wrapped.html.
// Depends only on the payload passed into buildSlides() -- no Apps Script
// dependency of any kind. index.html calls buildSlides(payload) once the
// fetch bootstrap (api.js) resolves; app.js then reads the populated S array
// to build the slide DOM. On the old server-templated page this whole file
// ran as top-level script the instant P existed; here P only exists once the
// network round trip completes, so the slide-content section (everything from
// '1 -- intro' onward) is wrapped in buildSlides() instead of running inline.

function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function plural(n,a,b){return n===1?a:(b||a+'s');}
function pick(arr,n){return (arr||[]).slice(0,n);}
function norm(v){return String(v==null?'':v).toLowerCase().replace(/[^a-z0-9]/g,'');}

/* ── chart builders ───────────────────────────────────────────
   One bar row: label above, value right, track below. `label` and `valText`
   are inserted as HTML so callers can pass <span class="hl"> emphasis, so
   every caller must esc() any member-supplied text itself. */

function chartRow(label,valText,pct,cls){
  // 2% floor: a 0-1% bar would render as an invisible sliver, which reads as
  // "broken chart" rather than "very small number". The number is always
  // stated as text beside it, so the floor never misrepresents the value.
  var w=Math.max(Number(pct)||0,2);
  return '<div class="chart-row">'+
    '<div class="chart-head"><span class="chart-label">'+label+'</span>'+
    (valText?'<span class="chart-val">'+valText+'</span>':'')+'</div>'+
    '<div class="chart-track"><i class="chart-fill'+(cls?' '+cls:'')+'" style="--w:'+w+'%"></i></div>'+
  '</div>';
}

/* Donut with a count in the middle and a headline beside it. `part`/`whole`
   are stated as real numbers, never as a bare percentage, because "25%" on its
   own doesn't say what the denominator is. */
function donut(part,whole,headline,caption,cls){
  var pct = whole>0 ? Math.round((part/whole)*100) : 0;
  return '<div class="donutwrap">'+
    '<div class="donut'+(cls?' '+cls:'')+'" style="--p:'+pct+'">'+
      '<span class="mid"><b>'+part+'</b><s>of '+whole+'</s></span>'+
    '</div>'+
    '<div class="donutside">'+
      '<div class="big-n">'+headline+'</div>'+
      (caption?'<div class="cap">'+caption+'</div>':'')+
    '</div></div>';
}

/* Vertical bars. `rows` = [{label, value, me}]. Heights are scaled to the
   largest value so the tallest bar always fills the plot. */
function vbars(rows){
  var max=0; rows.forEach(function(r){ if(r.value>max) max=r.value; });
  return '<div class="vbars">'+rows.map(function(r){
    var h = max>0 ? Math.max(Math.round((r.value/max)*100),4) : 4;
    return '<div class="vbar'+(r.me?' me':'')+'">'+
      '<span class="vnum">'+r.value+'</span>'+
      '<span class="vcol" style="--h:'+h+'%"></span>'+
      '<span class="vlab">'+esc(r.label)+'</span>'+
    '</div>';
  }).join('')+'</div>';
}

/* Line graph over a time series. `pts` = [{x label, y value}]. Coordinates are
   computed in a 100x100 user space and stretched by preserveAspectRatio="none",
   so the shape fits any card width without recomputing on resize. */
function lineChart(pts){
  if(!pts || pts.length<2) return '';
  var maxY=0; pts.forEach(function(p){ if(p.y>maxY) maxY=p.y; });
  if(maxY<=0) maxY=1;
  var n=pts.length;
  var xy=pts.map(function(p,i){
    return { x:(i/(n-1))*100, y:100-((p.y/maxY)*88)-6 };   // 6% padding top/bottom
  });
  var line=xy.map(function(p,i){ return (i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2); }).join(' ');
  var area=line+' L100 100 L0 100 Z';
  var dots=xy.map(function(p){
    return '<i class="ldot" style="left:'+p.x.toFixed(2)+'%;top:'+p.y.toFixed(2)+'%"></i>';
  }).join('');
  return '<div class="linewrap">'+
    '<div class="lineplot">'+
      '<svg class="linechart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+
        '<line class="grid" x1="0" y1="50" x2="100" y2="50"/>'+
        '<path class="area" d="'+area+'"/>'+
        '<path class="ln" d="'+line+'"/>'+
      '</svg>'+dots+
    '</div>'+
    '<div class="lineaxis"><span>'+esc(pts[0].x)+'</span><span>'+esc(pts[n-1].x)+'</span></div>'+
  '</div>';
}

/* Two bars under one label: the member on top in coral, the batch beneath in
   a thinner hatched track. No legend -- the value text on each row names
   which is which, which costs less width than a legend at 360px. */
function chartPair(label,youText,youPct,batchText,batchPct){
  return '<div class="chart-row">'+
    '<div class="chart-head"><span class="chart-label">'+label+'</span>'+
    '<span class="chart-val">'+youText+'</span></div>'+
    '<div class="chart-track"><i class="chart-fill" style="--w:'+Math.max(Number(youPct)||0,2)+'%"></i></div>'+
    '<div class="chart-track thin"><i class="chart-fill ghost" style="--w:'+Math.max(Number(batchPct)||0,2)+'%"></i></div>'+
    '<div class="chart-sub">'+batchText+'</div>'+
  '</div>';
}

/* Ambient decoration is now static markup (the .cloud divs and #lantern
   SVG in the page chrome) rather than JS-generated emoji floaters -- the
   brief calls for "minimal" watercolor decoration, not a drifting glyph
   field. */

/* ── slide builders ──────────────────────────────────────── */

var S=[];
var P=null;
function add(dur,html,cls){S.push({dur:dur,html:html,cls:cls||''});}

/* An act break. Only ever emitted by addBreak(), which no-ops when the act it
   introduces turned out to be empty — announcing "here's what you showed up
   for" and then cutting straight to the persona would be worse than having no
   break at all. */
/* A signpost planted at a bend in the path. Each break is the reader arriving
   somewhere in Celaville rather than a coloured interstitial: the post carries
   the lesson number the brand book frames chapters with (第一课, 第二课 ...)
   and names the place the next stretch of the walk covers. */
function signpost(lesson,place){
  return '<svg class="post" viewBox="0 0 168 108" width="168" height="108" aria-hidden="true">'+
    /* upper board, the lesson number, pointing the way on */
    '<g stroke="rgba(255,255,255,.9)" stroke-width="2.4" stroke-linejoin="round" fill="rgba(255,255,255,.16)">'+
      '<path d="M14 16 h104 l18 14 -18 14 H14z"/>'+
    '</g>'+
    '<text x="26" y="36" class="post-cn">'+lesson+'</text>'+
    /* lower board, the place name. Sized for the longest name in use. */
    '<g stroke="rgba(255,255,255,.72)" stroke-width="2" stroke-linejoin="round" fill="rgba(255,255,255,.10)">'+
      '<path d="M24 52 h112 l16 12 -16 12 H24z"/>'+
    '</g>'+
    '<text x="34" y="68" class="post-place">'+esc(place)+'</text>'+
    /* the post, and the grass it stands in */
    '<path d="M70 78 v26" stroke="rgba(255,255,255,.82)" stroke-width="4" stroke-linecap="round"/>'+
    '<path d="M54 104 q16 5 32 0" stroke="rgba(255,255,255,.5)" stroke-width="2.4" fill="none" stroke-linecap="round"/>'+
  '</svg>';
}
function breakSlide(eyebrow,line1,line2,tone,lesson,place){
  // 2600ms used to be all this got -- the shortest dur in the whole deck.
  // A screenshot needs both hands off the screen (no finger to trigger hold-
  // to-pause) plus a beat to frame it, so the signpost kept flipping before
  // the shutter did. 4200ms is still a quick beat, just not a blink.
  add(4200,
    signpost(lesson,place)+
    '<p class="break-eyebrow">'+eyebrow+'</p>'+
    '<p class="break-line">'+line1+'</p>'+
    '<p class="break-line soft">'+line2+'</p>'+
    '<div class="break-rule"></div>',
    'v-break tone-'+tone);
}
/* `has` is evaluated by the caller against real payload fields, so a member
   with no journey data never sees a chapter break for it. */
function addBreak(has,eyebrow,line1,line2,tone,lesson,place){
  if(has) breakSlide(eyebrow,line1,line2,tone,lesson,place);
}

function buildSlides(payload){
  P = payload;
  S.length = 0;
/* 1 — intro */
add(6500,
  '<p class="kicker"><span class="cn">下一课！</span> &nbsp;RecWeek 2026-2027</p>'+
  '<h1>Celaville</h1>'+
  '<h2>Hi '+esc(P.name)+'.</h2>'+
  '<p>All '+P.n+' of you answered the same questions when you signed up. Here\u2019s what only you said.</p>'+
  '<p class="sm">Every number in here came from something you wrote.</p>');

/* 2 — basics */
(function(){
  var b=P.basics, lines='';
  // One chart, three bars — course/school/year all measured against the same
  // "share of the batch" scale, which is what makes them comparable at a
  // glance. Previously three separate cards, which invited reading them as
  // three unrelated numbers.
  if(b.course){
    lines+=chartRow(esc(b.course), b.courseIsSolo?'only you':b.coursePct+'%', b.coursePct);
  }
  if(b.school){
    lines+=chartRow(esc(b.school), b.schoolPct+'%', b.schoolPct, 'leaf');
  }
  // Year level used to run as a third bar here. Any single RecWeek batch
  // skews heavily freshman (that's the point of RecWeek), so the bar always
  // read as a near-100% wall no matter who was looking at it -- not a stat
  // about them, just a stat about the org's intake shape. Dropped rather
  // than kept for symmetry.
  add(8000,'<p class="kicker">Chapter one <span class="cn">· 第一课</span></p>'+
    '<h2>Where you enter the village</h2>'+
    '<div class="chart">'+lines+'</div>'+
    '<p class="sm">'+(b.courseIsSolo
      ? 'You\u2019re the only '+esc(b.course)+' student who signed up this year.'
      : b.courseCount+' '+plural(b.courseCount,'other Celadonean takes','other Celadoneans take')+' '+esc(b.course)+' too, the #'+b.courseRank+' most common course this year.')+'</p>');
})();

/* arrival — how they found Celadon. howHeard was computed into the payload
   from the start and never rendered; rarest route first, so the unusual way
   in leads. */
if(P.arrival && P.arrival.ways.length){
  var aw=P.arrival.ways.map(function(w){
    return chartRow(esc(w.label), w.count===1?'only you':w.pct+'%', w.pct, 'leaf');
  }).join('');
  add(8000,'<p class="kicker">How you got here</p>'+
    '<h2>The road in</h2>'+
    '<div class="chart">'+aw+'</div>'+
    '<p class="sm">'+
      (P.arrival.ways[0].count===1
        ? 'Nobody else found us the way you did.'
        : (P.arrival.batchTop
            ? 'Most of Celaville came through <span class="hl">\u201c'+esc(P.arrival.batchTop.label)+'\u201d</span>.'
            : ''))+
    '</p>');
}

/* birthday — exact day, plus the Chinese zodiac when it can be derived
   confidently (see zodiacFor_; it returns nothing rather than guessing). */
if(P.birthday && P.birthday.pretty){
  var b=P.birthday;
  // The day number is the hero and the month is the subhead. Putting the whole
  // date in .big overflowed the frame: that face is sized for short tokens
  // like "17" or "ENFP", and "September 14" at 52px is far wider than the card.
  add(7500,'<p class="kicker">Your day <span class="cn">· 生日</span></p>'+
    '<p class="big">'+b.day+'</p>'+
    '<h2 style="margin-top:6px">'+esc(b.month)+
      (b.zodiac?', Year of the '+esc(b.zodiac):'')+'</h2>'+
    '<p class="sm">'+
      (b.monthCount>1
        ? b.monthCount+' others in Celaville share '+esc(b.month)+' with you.'
        : 'You\u2019re the only one with a birthday in '+esc(b.month)+'.')+
    '</p>');
}

/* 3 — twins. Counts only, never names: the payload is readable in the page
   source, so naming the matching members would hand every reader a roster of
   who shares their birthday month, MBTI, and high school. See the privacy
   note in buildPayload_. Each bar is that group as a share of the batch. */
if(P.twins && P.twins.length){
  var t='';
  // three strongest overlaps only — the rest is a scroll nobody finishes
  P.twins.slice(0,3).forEach(function(x){
    var pct = P.n ? Math.round((x.count/P.n)*100) : 0;
    t+=chartRow(esc(x.label), x.count+' '+plural(x.count,'person','people'), pct);
  });
  add(9000,'<p class="kicker">Your neighbours</p>'+
    '<p class="big sm-num" data-count="'+P.twinTotal+'">0</p>'+
    '<h2 style="margin-top:6px">'+plural(P.twinTotal,'person','people')+' already overlap with you</h2>'+
    '<div class="chart">'+t+'</div>'+
    '<p class="sm">Same course, same school, same four letters, same birthday month. You didn\u2019t walk in alone.</p>');
}

/* ── ACT TWO: where you fit ────────────────────────────────────────────
   Department and project sit here, early and behind their own chapter break,
   because they are the payoff the whole thing is building toward. */
// Dept and project always resolve (there is a scored fallback when nobody
// stated a preference), so this act can never be empty.
addBreak(!!(P.dept || P.project),
  'Chapter two',
  'That\u2019s where you came from.',
  'Now, where do you fit?',
  'coral', '\u7b2c\u4e8c\u8bfe', 'village square');

/* 5 — department */
(function(){
  var d=P.dept;
  add(8500,'<p class="kicker">Where you belong <span class="cn">· 部门</span></p>'+
    '<h2>'+esc(d.name)+'</h2>'+
    '<p>'+esc(d.blurb)+'</p>'+
    '<div class="card">'+
      '<p class="sm" style="margin:0">'+(d.source==='stated'
        ? 'You told us this is where you want to be'+(d.pct?', along with '+d.pct+'% of Celaville.':'.')
        : 'You didn\u2019t name a department, so we read the rest of your answers. Your skills and your reasons for joining point here.')+'</p>'+
    '</div>'+
    (d.alsoStated.length ? '<p class="sm">You also had your eye on: <span class="hl">'+d.alsoStated.map(esc).join(' · ')+'</span></p>' : '')+
    (d.openToDeputy ? '<p class="sm">You also said yes to applying as a <span class="hl-g">Deputy</span>. Watch for the call.</p>' : '')+
    (d.isOSR ? '<p class="sm">Curious how this Wrapped got made? That\u2019s OSR, the same department behind every email you\u2019ve gotten this RecWeek. Join, and they\u2019ll teach you how.</p>' : '')+
    (d.link ? '<p><a class="photolink" href="'+esc(d.link)+'" target="_blank" rel="noopener">See the department’s RecWeek photos →</a></p>' : ''));
})();

/* 6 — project */
(function(){
  var p=P.project;
  add(8500,'<p class="kicker">Your first project <span class="cn">· 项目</span></p>'+
    '<h2>'+esc(p.name)+'</h2>'+
    '<p>'+esc(p.blurb)+'</p>'+
    '<div class="card g">'+
      '<p class="sm" style="margin:0">'+(p.source==='stated'
        ? 'You picked this one yourself'+(p.count?'. '+p.count+' '+plural(p.count,'other','others')+' did too.':'.')
        : 'Your food, music and budget answers all lean this way. Start here.')+'</p></div>'+
    (p.alsoStated.length ? '<p class="sm">Also on your list: <span class="hl">'+p.alsoStated.map(esc).join(' · ')+'</span></p>' : '')+
    (p.openToCore ? '<p class="sm">You said you\u2019re open to <span class="hl-g">Core Team</span>. This is where that starts.</p>' : '')+
    (p.link ? '<p><a class="photolink" href="'+esc(p.link)+'" target="_blank" rel="noopener">See the project’s RecWeek photos →</a></p>' : ''));
})();

/* ── ACT THREE: what you're like ───────────────────────────────────────*/
// Every slide in this act needs Membership Survey data. A member who never
// filled the survey has none of it, and would otherwise get a chapter break
// announcing a section with nothing in it, immediately followed by the next
// break. Caught in preview with exactly that member shape.
addBreak(!!(P.mbti || P.familiarity || P.rarest ||
            (P.taste && P.taste.length) || P.whyJoin || P.platforms),
  'Chapter three',
  'That\u2019s where you\u2019re headed.',
  'Here\u2019s what you\u2019re actually like.',
  'leaf', '\u7b2c\u4e09\u8bfe', 'long meadow');

/* 7 — MBTI */
if(P.mbti && P.mbti.type){
  add(7500,'<p class="kicker">Four letters</p>'+
    '<p class="big">'+esc(P.mbti.type)+'</p>'+
    '<h2 style="margin-top:12px">'+
      (P.mbti.isRarest ? 'And nobody else is.' : P.mbti.pct+'% of Celaville shares it.')+'</h2>'+
    '<p>'+(P.mbti.isRarest
      ? 'Out of everyone who signed up, the '+esc(P.mbti.type)+' seat in the classroom is yours alone.'
      : 'That makes it the #'+P.mbti.rank+' most common type here, shared with '+P.mbti.count+' '+plural(P.mbti.count,'other','others')+'.')+'</p>'+
    (P.mbti.topType && P.mbti.topType!==P.mbti.type
      ? '<p class="sm">The most common type in Celaville this year is <span class="hl">'+esc(P.mbti.topType)+'</span>.</p>' : ''));
}

/* 8 — Fil-Chi familiarity */
if(P.familiarity){
  var f=P.familiarity;
  add(7500,'<p class="kicker">Your roots <span class="cn">· 文化</span></p>'+
    '<p class="big">'+f.score+'<span class="unit">/5</span></p>'+
    '<h2 style="margin-top:10px">on Filipino-Chinese culture</h2>'+
    '<div class="chart">'+chartPair(
      'Familiarity, 1 to 5',
      'you: '+f.score,
      f.score/5*100,
      'Celaville average: '+f.avg,
      f.avg/5*100)+'</div>'+
    '<p class="sm">'+(f.diff>0
      ? 'That\u2019s <span class="hl">'+f.diff+' above</span> the Celaville average, and higher than '+f.percentile+'% of everyone who answered.'
      : f.diff<0
        ? 'A little under the average, which is exactly who Celaville is built for. There\u2019s a whole village here to learn from.'
        : 'Right on the Celaville average. Dead centre of the classroom.')+'</p>');
}

/* 4 — rarest answer */
if(P.rarest){
  // A bare "25%" doesn't say what it's 25% OF, and it sat right above a line
  // that restated the same figure as a count. The donut shows the share
  // against the whole batch and the centre reads "9 of 36" outright.
  add(7500,'<p class="kicker">The one nobody else said</p>'+
    '<h2>'+esc(P.rarest.label)+'</h2>'+
    (P.rarest.solo
      ? '<p class="big sm-num">1 of '+P.n+'</p>'
      : donut(P.rarest.count, P.n, P.rarest.pct+'%',
              'of Celaville picked this ' + esc(P.rarest.category)))+
    '<p>'+(P.rarest.solo
      ? 'Out of '+P.n+' people, you were the only one who picked this as your '+esc(P.rarest.category)+'. That corner of the village is yours.'
      : 'You\u2019re one of them. Everyone else went for something different.')+'</p>');
}

/* 9 — taste. One slide only. Which of the four layouts appears (menu, poster,
   tracklist, prize grid) depends on the member's first group with picks, so all
   four designs stay in play across the batch. */
(P.taste||[]).slice(0,3).forEach(function(g,gi){
  var byRare=g.picks.slice().sort(function(a,b){return a.count-b.count;});
  var rarest=byRare[0], common=byRare[byRare.length-1];
  // "Only 42%" reads wrong when 42% isn't actually rare, so the wording
  // changes with the number instead of always claiming scarcity.
  // All four layouts already print a percentage next to every pick, so a
  // caption naming the member's own least-common pick just restates what is
  // on screen. Two things are genuinely new: that nobody else chose an item
  // (a count of one, which a percentage alone doesn't convey), and what the
  // whole batch's favourite was. Prefer those; otherwise say nothing.
  //
  // The "rarest answer" slide also scans food/music/etc, so it can land on
  // this exact item two slides earlier — dupOfRarest suppresses the repeat.
  var dupOfRarest = P.rarest && rarest && norm(P.rarest.label)===norm(rarest.label);
  var mine = {};
  g.picks.forEach(function(x){ mine[norm(x.label)] = true; });
  var rareLine =
    (rarest && rarest.count===1 && !dupOfRarest)
      ? 'Nobody else in Celaville picked <span class="hl">'+esc(rarest.label)+'</span>.'
      : (g.top && mine[norm(g.top)])
        // Up to three taste slides run back to back, so the same sentence
        // three times reads worse than no sentence. Vary by position.
        ? [
            'Celaville\u2019s favourite was <span class="hl-g">\u201c'+esc(g.top)+'\u201d</span> too. Good taste, or peer pressure.',
            'Same as the rest of Celaville, <span class="hl-g">\u201c'+esc(g.top)+'\u201d</span> came out on top.',
            'You and everyone else landed on <span class="hl-g">\u201c'+esc(g.top)+'\u201d</span>.'
          ][gi % 3]
        : g.top
          ? [
              'Celaville mostly went for <span class="hl-g">\u201c'+esc(g.top)+'\u201d</span>, which you left off.',
              'Nobody told you <span class="hl-g">\u201c'+esc(g.top)+'\u201d</span> was the crowd pick.',
              '<span class="hl-g">\u201c'+esc(g.top)+'\u201d</span> won Celaville\u2019s vote without you.'
            ][gi % 3]
          : '';

  if(g.key==='food'){
    add(7500,
      '<p class="kicker">At the table <span class="cn">· 桌上</span></p>'+
      '<h2>What you ordered</h2>'+
      '<div class="menu">'+g.picks.map(function(p){
        return '<div class="menu-row"><span class="dish">'+esc(p.label)+'</span>'+
          '<span class="lead"></span>'+
          '<span class="amt">'+(p.count===1?'only you':p.pct+'%')+'</span></div>';
      }).join('')+'</div>'+
      '<p class="menu-note">'+rareLine+'</p>',
      'v-food');

  } else {
    // dice-pip glyphs would be icon-like unicode on a themed surface — an
    // ink-bordered index numeral does the same "which tile is this" job.
    add(7500,
      '<p class="kicker">At the dice table <span class="cn">· 骰子</span></p>'+
      '<h2>What you’re playing for</h2>'+
      '<div class="tiles">'+g.picks.map(function(p,i){
        return '<div class="tile"><span class="no">'+(i+1)+'</span>'+
          '<span class="pname">'+esc(p.label)+'</span>'+
          '<span class="pshare">'+(p.count===1?'only you':p.pct+'% want it')+'</span></div>';
      }).join('')+'</div>'+
      '<p class="sm">'+rareLine+'</p>',
      'v-dicePrizes');
  }
});

/* 10 — why you joined */
if(P.whyJoin){
  // Bar length = how much of the batch shares each reason, so a short bar
  // means "this one is unusually yours" rather than "this matters less".
  var mine=P.whyJoin.yours.map(function(y){
    return chartRow(esc(y.label), y.pct+'% share it', y.pct);
  }).join('');
  add(8000,'<p class="kicker">Why you knocked</p>'+
    '<h2>You came for this</h2>'+
    '<div class="chart">'+mine+'</div>'+
    '<p class="sm">A longer bar means more of Celaville said the same thing.'+
    (P.whyJoin.batchTop.length
      ? ' The most common reason overall was <span class="hl">\u201c'+esc(P.whyJoin.batchTop[0].label)+'\u201d</span>, at '+P.whyJoin.batchTop[0].pct+'%.'
      : '')+'</p>');
}

/* 11 — platform ranking. Ordinal data, so the ladder states each rank
   explicitly and uses bar length only as a position cue (longest = #1). */
if(P.platforms && P.platforms.yours.length){
  var pf=P.platforms, n=pf.yours.length;
  var rows=pf.yours.map(function(p,i){
    // Inverse rank scaled across however many they actually ranked, so a
    // partially-ranked grid still spans the full width instead of bunching up.
    var w=Math.round(((n-i)/n)*100);
    return '<div class="ladder-row'+(i===0?' first':'')+'">'+
      '<span class="ladder-no">'+p.rank+'</span>'+
      '<span class="ladder-body">'+
        '<span class="ladder-name">'+esc(p.label)+'</span>'+
        '<span class="ladder-bar"><i style="--w:'+w+'%"></i></span>'+
      '</span></div>';
  }).join('');
  // Bars = how many people put each platform first, with the member's own #1
  // highlighted. Counts of people, so the heights mean the same thing across
  // every bar; average rank would have inverted the scale.
  var vb = (pf.batchTopCounts && pf.batchTopCounts.length>1)
    ? vbars(pf.batchTopCounts.map(function(c){
        return { label:c.label, value:c.count, me: norm(c.label)===norm(pf.top) };
      }))
    : '';
  add(8500,'<p class="kicker">How you want to hear from us</p>'+
    '<h2>Your platform ladder</h2>'+
    '<div class="ladder">'+rows+'</div>'+
    (vb?'<p class="sm" style="margin-bottom:4px">Where Celaville put their #1 (yours in coral)</p>'+vb:'')+
    '<p class="sm">'+
      (pf.agreesWithBatch
        ? 'You put <span class="hl">'+esc(pf.top)+'</span> first, and so did most of Celaville ('+pf.batchFavPct+'%).'
        : 'You put <span class="hl">'+esc(pf.top)+'</span> first. Celaville mostly went with <span class="hl-g">'+esc(pf.batchFav)+'</span> ('+pf.batchFavPct+'%), so you\u2019re reading us somewhere they aren\u2019t.')+
      (pf.rankedAll ? '' : ' You ranked '+pf.rankedCount+' of the five.')+
    '</p>');
}

/* skills — techSkills fed department scoring invisibly; this surfaces it. */
if(P.skills && (P.skills.list.length || P.skills.excel)){
  var sk=P.skills.list.map(function(x,i){
    return '<span class="chip '+['coral','sky','leaf','paper'][i%4]+'">'+esc(x.label)+'</span>';
  }).join('');
  var rarest=P.skills.list.length?P.skills.list[0]:null;
  add(8000,'<p class="kicker">What you want to pick up</p>'+
    '<h2>'+(P.skills.list.length
      ? P.skills.list.length+' '+plural(P.skills.list.length,'skill')+' on your list'
      : 'Ready for a spreadsheet fight')+'</h2>'+
    (sk?'<div class="chips">'+sk+'</div>':'')+
    '<p class="sm">'+
      (rarest && rarest.count===1
        ? 'Nobody else in Celaville picked <span class="hl">'+esc(rarest.label)+'</span>. Someone should teach you.'
        : rarest
          ? 'Your rarest pick is <span class="hl">'+esc(rarest.label)+'</span>, at '+rarest.pct+'% of Celaville.'
          : '')+
      (P.skills.excel?' You also said yes to the <span class="hl-g">Excel competition</span>.':'')+
    '</p>');
}

/* checklist — the actionable slide. Only renders when at least one item is
   already ticked, so it never reads as a list of things they failed to do. */
if(P.checklist){
  var ck=P.checklist.items.map(function(it){
    return '<div class="tl-row'+(it.done?'':' dim')+'"><span class="tl-node"></span>'+
      '<div class="tl-name"'+(it.done?'':' style="opacity:.6"')+'>'+esc(it.label)+'</div>'+
      '<div class="tl-meta">'+(it.done?'Done':esc(it.missLabel||'Not yet'))+'</div></div>';
  }).join('');
  // Not every unticked row is still a to-do -- an item can close (the ML
  // tournament) rather than stay pending, so "left to finish" only counts
  // rows the reader could actually still go do. A closed-and-missed row still
  // shows in the timeline above with its own past-tense label; it just
  // doesn't drive the ring caption or the "take a minute" line below.
  var pending=P.checklist.items.filter(function(it){ return !it.done; });
  var actionable=pending.filter(function(it){ return it.actionable!==false; });
  var ringLabel, ringCaption;
  if(!pending.length){ ringLabel='All done'; ringCaption='nothing left to tick off'; }
  else if(actionable.length){ ringLabel=actionable.length+' left'; ringCaption='to finish the starter pack'; }
  else { ringLabel=pending.length===1?'1 missed':pending.length+' missed'; ringCaption='already come and gone'; }
  add(8000,'<p class="kicker">Your Celadon starter pack</p>'+
    '<h2>Getting settled in</h2>'+
    // The ring centre already reads "2 of 3", so the headline carries what's
    // left rather than restating the same fraction.
    donut(P.checklist.done, P.checklist.total, ringLabel, ringCaption, 'leaf')+
    '<div class="timeline">'+ck+'</div>'+
    '<p class="sm">'+(P.checklist.done===P.checklist.total
      ? 'All set. You\u2019re properly in.'
      : (actionable.length ? 'The rest take about a minute each.' : 'That one\u2019s already come and gone.'))+'</p>');
}

/* ── ACT FOUR: what you already did ────────────────────────────────────
   Gated: with no walk-in rows and no mahjong account there is nothing in this
   act, and announcing an empty chapter is worse than no chapter at all. */
addBreak(!!(P.journey || P.mahjong || (P.interview && P.interview.words)),
  'Chapter four',
  'Enough about plans.',
  'Here\u2019s what you already showed up for.',
  'ink', '\u7b2c\u56db\u8bfe', 'lantern field');

/* journey — where they actually turned up. Dates are shown when the log has
   them and silently omitted when it doesn't, because the walk-in sheets are
   partly filled in by hand and a blank Timestamp must never render as a
   broken or invented date. */
if(P.journey){
  var jr=P.journey;
  var rows=jr.events.map(function(e){
    var meta=[];
    if(e.visits>1) meta.push(e.visits+' visits');
    if(e.first) meta.push('first on '+esc(e.first));
    if(e.pct) meta.push(e.pct+'% of Celaville came');
    return '<div class="tl-row"><span class="tl-node"></span>'+
      '<div class="tl-name">'+esc(e.label.replace(/^the /,''))+'</div>'+
      (meta.length?'<div class="tl-meta">'+meta.join(' &middot; ')+'</div>':'')+
    '</div>';
  }).join('');
  add(9000,'<p class="kicker">Your first steps <span class="cn">· 足迹</span></p>'+
    '<p class="big sm-num" data-count="'+jr.totalVisits+'">0</p>'+
    '<h2 style="margin-top:6px">'+(jr.totalVisits===1?'time you showed up':'times you showed up')+'</h2>'+
    // Cumulative visits over time. Omitted when fewer than two dated visits
    // exist, which lineChart() decides for itself.
    lineChart(jr.series)+
    '<div class="timeline">'+rows+'</div>'+
    '<p class="sm">'+
      (jr.firstDate
        ? 'It started on <span class="hl">'+esc(jr.firstDate)+'</span>, at '+esc(jr.firstLabel)+'. '
        : '')+
      (jr.spanDays>0
        ? 'From first to latest, that is <span class="hl">'+jr.spanDays+' '+plural(jr.spanDays,'day')+'</span> of showing up. '
        : '')+
      (jr.wentToAll
        ? 'And you made it to every single one.'
        : 'That\u2019s '+jr.eventCount+' of '+jr.totalEvents+'.')+
    '</p>'+
    '<p class="sm">'+
      (jr.moreThanPct>=50
        ? 'You turned up more often than <span class="hl">'+jr.moreThanPct+'%</span> of Celaville.'
        : 'You were one of '+jr.batchWhoCame+' who came to anything at all.')+
      (jr.eventTwins>0
        ? ' <span class="hl-g">'+jr.eventTwins+'</span> '+plural(jr.eventTwins,'other','others')+
          ' '+(jr.eventTwins===1?'was':'were')+' in the room with you.'
        : '')+
    '</p>');
}

/* mahjong — celebratory by design. Wins are shown when there are wins;
   losses are never shown and no W/L ratio is computed, so a member who went
   0-5 reads "5 games played" and their coins, not a losing record. */
if(P.mahjong){
  var mj=P.mahjong;
  var boxes='<div class="statbox"><div class="n">'+mj.games+'</div><div class="k">Games</div></div>'+
    (mj.hasWins?'<div class="statbox"><div class="n">'+mj.wins+'</div><div class="k">Wins</div></div>':'')+
    (mj.showRank
      ? '<div class="statbox"><div class="n">#'+mj.rank+'</div><div class="k">On the board</div></div>'
      : '<div class="statbox"><div class="n">'+mj.coins+'</div><div class="k">Coins</div></div>');
  var chips=[];
  if(mj.title) chips.push(mj.title);
  mj.achievements.forEach(function(a){ chips.push(a); });
  add(8500,'<p class="kicker">At the mahjong table <span class="cn">· 麻将</span></p>'+
    '<h2>'+(mj.games>0?'You sat down and played':'Your seat is waiting')+'</h2>'+
    '<div class="statgrid">'+boxes+'</div>'+
    (chips.length?'<div class="chips">'+chips.map(function(c,i){
      return '<span class="chip '+['coral','sky','leaf','paper'][i%4]+'">'+esc(c)+'</span>';
    }).join('')+'</div>':'')+
    '<p class="sm">'+
      (mj.showRank ? '<span class="hl">#'+mj.rank+' of '+mj.playerCount+'</span> among Celadoneans on the board, with '+mj.coins+' coins banked.'
       : mj.gamesPct>=60 ? 'You played more than '+mj.gamesPct+'% of everyone on the board.'
       : mj.cosmetics>1 ? 'You\u2019ve unlocked '+mj.cosmetics+' cosmetics so far.'
       : 'Nothing on that board resets. The coins stay yours.')+
    '</p>');
}

/* 12 — interview, how much you said */
if(P.interview && P.interview.words){
  var iv=P.interview;
  add(7500,'<p class="kicker">In the interview room</p>'+
    '<p class="big sm-num" data-count="'+iv.words+'">0</p>'+
    '<h2 style="margin-top:10px">words, across '+iv.answered+' '+plural(iv.answered,'answer')+'</h2>'+
    '<p>'+(iv.percentile>=70
      ? 'You talked more than '+iv.percentile+'% of everyone we interviewed. We were writing the whole time.'
      : iv.percentile<=30
        ? 'Short and deliberate. You said what you meant, then stopped.'
        : 'Enough for us to know exactly who walked in.')+'</p>'+
    (iv.quotePrompt?'<p class="sm">You had the most to say about <span class="hl">'+esc(iv.quotePrompt)+'</span>.</p>':''));
}

/* 13 — interview, themes */
if(P.interview && P.interview.themes && P.interview.themes.length){
  var th=P.interview.themes.map(function(t){
    return chartRow(esc(t.label), t.count===1?'only you':t.pct+'%', t.pct, 'leaf');
  }).join('');
  var rt=P.interview.rarestTheme;
  add(8000,'<p class="kicker">What you kept coming back to</p>'+
    '<h2>Your interview, in themes</h2>'+
    '<p class="sm">Pulled from the words you used, next to how many others reached for the same ones.</p>'+
    '<div class="chart">'+th+'</div>'+
    (rt && rt.count<=3 ? '<p class="sm">Almost nobody else brought up <span class="hl">'+esc(rt.label)+'</span>. That one is yours.</p>' : ''));
}

/* 14 — interview, words only you used */
if(P.interview && P.interview.distinctive && P.interview.distinctive.length>=3){
  add(7500,'<p class="kicker">Nobody else said these</p>'+
    '<h2>'+P.interview.soloWords+' '+plural(P.interview.soloWords,'word')+' only you used</h2>'+
    '<div class="chips">'+P.interview.distinctive.map(function(w,i){
      return '<span class="chip '+['coral','sky','leaf','paper'][i%4]+'">'+esc(w)+'</span>';
    }).join('')+'</div>'+
    '<p class="sm">Across every interview we ran, these turned up in yours alone.</p>');
}

/* 15 — interview, your own words */
if(P.interview && P.interview.quote){
  add(9000,'<p class="kicker">In your own words</p>'+
    '<h3 style="opacity:.7;font-size:15px;font-weight:600">On '+esc(P.interview.quotePrompt)+'</h3>'+
    '<p class="quote">“'+esc(P.interview.quote)+'”</p>'+
    '<p class="sm">Read this again in March and see how much has changed.</p>');
}

/* mahjong deep-dive — the wardrobe and the account age. Separate slide so the
   first one stays a clean three-stat hit. */
if(P.mahjong && (P.mahjong.ownedList.length>1 || P.mahjong.daysSince>0)){
  var md=P.mahjong;
  var wardrobe=md.ownedList.map(function(c,i){
    return '<span class="chip '+['coral','sky','leaf','paper'][i%4]+'">'+esc(c)+'</span>';
  }).join('');
  add(8000,'<p class="kicker">Your mahjong wardrobe</p>'+
    '<h2>'+md.ownedList.length+' '+plural(md.ownedList.length,'unlock')+'</h2>'+
    (wardrobe?'<div class="chips">'+wardrobe+'</div>':'')+
    '<p class="sm">'+
      (md.equippedColor?'You\u2019re wearing <span class="hl">'+esc(md.equippedColor)+'</span>. ':'')+
      (md.since?'On the board since <span class="hl-g">'+esc(md.since)+'</span>':'')+
      (md.daysSince>0?', '+md.daysSince+' '+plural(md.daysSince,'day')+' ago.':'.')+
    '</p>');
}

/* 16 — persona: a polaroid, not the old circular badge. No icon — a Kaiti
   calligraphic tag in the persona's own accent color stands in for one. */
(function(){
  var pe=P.persona;
  add(9500,'<p class="kicker">Your Celaville persona</p>'+
    '<div class="polaroid"><div class="polaroid-card">'+
      '<div class="tag" style="color:'+pe.color+'">乡</div>'+
      '<div class="pname">'+esc(pe.name)+'</div>'+
      '<div class="peyebrow">Celaville</div>'+
    '</div></div>'+
    '<p style="text-align:center">'+esc(pe.blurb)+'</p>'+
    '<p class="sm" style="text-align:center">Your own answers picked this one. Nothing was left to chance.</p>',
    'v-persona' /* marker class only -- no CSS hooks off it; app.js uses it to
                   fire the 30ms persona-reveal haptic (navigator.vibrate) */);
})();

/* 17 — recap */
(function(){
  var r=[];
  if(P.basics.course) r.push(['Your course',P.basics.course+(P.basics.courseIsSolo?' · only you':' · '+P.basics.coursePct+'% of Celaville')]);
  if(P.twinTotal) r.push(['Batch overlaps',P.twinTotal+' '+plural(P.twinTotal,'person','people')]);
  if(P.mbti&&P.mbti.type) r.push(['Your letters',P.mbti.type+(P.mbti.isRarest?' · one of one':' · '+P.mbti.pct+'%')]);
  if(P.familiarity) r.push(['Fil-Chi familiarity',P.familiarity.score+'/5 (avg '+P.familiarity.avg+')']);
  if(P.platforms) r.push(['Top platform',P.platforms.top]);
  if(P.birthday && P.birthday.zodiac) r.push(['Your sign','Year of the '+P.birthday.zodiac]);
  if(P.journey) r.push(['Events attended',P.journey.eventCount+' of '+P.journey.totalEvents]);
  if(P.mahjong) r.push(['Mahjong',P.mahjong.games+' '+plural(P.mahjong.games,'game')+' · '+P.mahjong.coins+' coins']);
  if(P.checklist) r.push(['Starter pack',P.checklist.done+' of '+P.checklist.total+' done']);
  if(P.rarest) r.push(['Rarest answer',P.rarest.label]);
  if(P.interview&&P.interview.words) r.push(['Interview',P.interview.words+' words'+
    (P.interview.themes.length?' · '+P.interview.themes[0].label:'')]);
  r.push(['Your department',P.dept.name]);
  r.push(['Your project',P.project.name]);
  r.push(['Your persona',P.persona.name]);

  add(0,'<p class="kicker">That’s your chapter</p>'+
    '<h2>'+esc(P.name)+'’s Celaville Wrapped</h2>'+
    '<div style="margin-bottom:14px">'+
      r.map(function(x){
        return '<div class="card" style="padding:10px 14px;margin-bottom:7px"><div class="row">'+
          '<span class="rowlabel" style="font-weight:600;opacity:.65;font-size:13.5px">'+esc(x[0])+'</span>'+
          '<span class="rowval" style="font-size:14.5px;text-align:right">'+esc(x[1])+'</span></div></div>';
      }).join('')+
    '</div>'+
    '<a class="btn" href="'+esc(P.cta.url)+'" target="_blank" rel="noopener">'+esc(P.cta.label)+' →</a>'+
    '<button class="btn ghost" style="margin-top:10px" onclick="openShare()">Save your card</button>'+
    '<button class="btn ghost" style="margin-top:10px" onclick="replay()">Watch it again</button>');
})();
}

/* -- number/ring animation helper --------------------------------------
   countUp lives here (not app.js) per the file split: it's a per-slide
   content-rendering helper, invoked by app.js's show() on every element
   carrying a [data-count] attribute. */
function countUp(el){
  var target=parseInt(el.getAttribute('data-count'),10);
  if(isNaN(target)) return;
  var t0=null, dur=900;
  function step(ts){
    if(!t0) t0=ts;
    var k=Math.min((ts-t0)/dur,1);
    el.textContent=Math.round(target*(1-Math.pow(1-k,3)));
    if(k<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

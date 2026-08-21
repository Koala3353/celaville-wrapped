// share.js -- Celaville Wrapped
// drawShareCard() and its small canvas-redrawn village, plus the share sheet
// open/close logic. Upgraded to Web Share Level 2 (canvas.toBlob -> File ->
// navigator.share) with the original data-URL <a download> kept as the
// desktop/unsupported-browser fallback. The sheet itself is now a native
// <dialog popover> (see index.html + styles.css) opened with showModal().

/* ── share card ────────────────────────────────────────────────────────────
   Drawn on a <canvas> with the 2D API. No html2canvas or any other library:
   the Apps Script sandbox blocks external scripts outright, so a CDN import
   would fail silently in production. Canvas also means the output is a real
   PNG at a fixed 1080x1920 story size regardless of the reader's screen. */
function shareStats(){
  var out=[];
  if(P.persona) out.push(['Persona', P.persona.name]);
  if(P.dept) out.push(['Department', P.dept.name]);
  if(P.rarest) out.push([P.rarest.solo?'Only you picked':'Rarest answer', P.rarest.label]);
  if(P.journey) out.push(['Showed up', P.journey.totalVisits+'x across '+P.journey.eventCount+' events']);
  if(P.mahjong && P.mahjong.showRank) out.push(['Mahjong board','#'+P.mahjong.rank+' of '+P.mahjong.playerCount]);
  if(P.mbti && P.mbti.type) out.push(['Four letters', P.mbti.type+(P.mbti.isRarest?' (one of one)':'')]);
  if(P.platforms) out.push(['Top platform', P.platforms.top]);
  if(P.twinTotal) out.push(['Batch overlaps', P.twinTotal+' people']);
  return out.slice(0,5);
}

/* Wraps text to a max width, returning the lines. Canvas has no text wrapping
   of its own, and persona names like "The Schoolhouse Scholar" overflow a
   1080px card at display size. */
function wrapText(ctx,text,maxW){
  var words=String(text).split(' '), lines=[], cur='';
  for(var i=0;i<words.length;i++){
    var test=cur?cur+' '+words[i]:words[i];
    if(ctx.measureText(test).width>maxW && cur){ lines.push(cur); cur=words[i]; }
    else cur=test;
  }
  if(cur) lines.push(cur);
  return lines;
}

function roundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r[0],y);
  ctx.lineTo(x+w-r[1],y); ctx.quadraticCurveTo(x+w,y,x+w,y+r[1]);
  ctx.lineTo(x+w,y+h-r[2]); ctx.quadraticCurveTo(x+w,y+h,x+w-r[2],y+h);
  ctx.lineTo(x+r[3],y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r[3]);
  ctx.lineTo(x,y+r[0]); ctx.quadraticCurveTo(x,y,x+r[0],y);
  ctx.closePath();
}

/* Draws one <path>-shaped piece of an asset via Path2D, built straight from
   the same `d` string the real SVG in #village uses -- not a canvas
   reinterpretation of it. ctx.scale() distorts stroke width along with
   geometry, so sw is corrected by the average of the two scale factors to
   come out the right thickness on screen. */
function svgPath_(x,d,fill,stroke,sw,scaleX,scaleY){
  var p=new Path2D(d);
  if(fill && fill!=='none'){ x.fillStyle=fill; x.fill(p); }
  if(stroke){ x.strokeStyle=stroke; x.lineWidth=sw/((scaleX+scaleY)/2); x.stroke(p); }
}

/* The schoolhouse, apple tree, and picket fence -- the exact shapes from
   gemini-svg-prompts.md, the same ones already inlined in #village. <path>
   elements are drawn via svgPath_ from their real `d` data; the handful of
   <rect>/<line>/<circle> elements each SVG also has are reproduced with the
   same coordinates via plain canvas calls, since those primitives have no
   `d` to lose fidelity from. ox/oy/scale place one asset's own (0,0)
   viewBox origin at a position on the card. */
function drawHouse_(x,ox,oy,scale){
  x.save(); x.translate(ox,oy); x.scale(scale,scale);
  x.lineJoin='round'; x.lineCap='round';
  var ink='#4F4036';
  function rrect(rx,ry,rw,rh,rr,fill){
    x.beginPath();
    if(rr){ x.moveTo(rx+rr,ry); x.lineTo(rx+rw-rr,ry); x.quadraticCurveTo(rx+rw,ry,rx+rw,ry+rr);
      x.lineTo(rx+rw,ry+rh-rr); x.quadraticCurveTo(rx+rw,ry+rh,rx+rw-rr,ry+rh);
      x.lineTo(rx+rr,ry+rh); x.quadraticCurveTo(rx,ry+rh,rx,ry+rh-rr);
      x.lineTo(rx,ry+rr); x.quadraticCurveTo(rx,ry,rx+rr,ry); x.closePath();
    } else { x.rect(rx,ry,rw,rh); }
    x.fillStyle=fill; x.fill(); x.strokeStyle=ink; x.lineWidth=2/scale; x.stroke();
  }
  function seg(x1,y1,x2,y2,sw){ x.beginPath(); x.moveTo(x1,y1); x.lineTo(x2,y2);
    x.strokeStyle=ink; x.lineWidth=sw/scale; x.stroke(); }
  function dot(cx,cy,r,fill,sw){ x.beginPath(); x.arc(cx,cy,r,0,Math.PI*2);
    x.fillStyle=fill; x.fill(); x.strokeStyle=ink; x.lineWidth=sw/scale; x.stroke(); }

  rrect(19,31,38,33,1.5,'#FFFCF7');
  seg(16,64,60,64,2);
  svgPath_(x,'M 33,64 L 33,51 A 5,5 0 0 1 43,51 L 43,64 Z','#8A6A4E',ink,2,scale,scale);
  dot(41,56,1,'#E4B64A',1.5);
  rrect(23,42,7,9,1.5,'#9FD0EB');
  seg(23,46.5,30,46.5,1.5); seg(26.5,42,26.5,51,1.5); seg(21.5,52.5,31.5,52.5,2);
  dot(51,46,4,'#E4B64A',2);
  seg(47,46,55,46,1.5); seg(51,42,51,50,1.5);
  svgPath_(x,'M 38,6 Q 23,18 8,30 C 12,33 17,33 21,33 L 55,33 C 59,33 64,33 68,30 Q 53,18 38,6 Z','#D94F40',ink,2,scale,scale);
  svgPath_(x,'M 38,9 L 38,32',null,ink,1.5,scale,scale);
  svgPath_(x,'M 34,14 Q 28,22 23,32',null,ink,1.5,scale,scale);
  svgPath_(x,'M 42,14 Q 48,22 53,32',null,ink,1.5,scale,scale);
  svgPath_(x,'M 34,7 Q 38,4 42,7','none',ink,2,scale,scale);
  dot(38,5,2,'#E4B64A',2);
  x.restore();
}
function drawTree_(x,ox,oy,scale){
  x.save(); x.translate(ox,oy); x.scale(scale,scale);
  x.lineJoin='round'; x.lineCap='round';
  var ink='#4F4036';
  x.beginPath(); x.moveTo(5,52); x.lineTo(19,52);
  x.strokeStyle=ink; x.lineWidth=1.5/scale; x.stroke();
  svgPath_(x,'M 9.5,52 C 10,46 10.5,39 10.5,33 L 8.5,27 C 9.5,27.5 10.5,29.5 11.5,31.5 L 12.5,31.5 C 13.5,29.5 14.5,27.5 15.5,27 L 13.5,33 C 13.5,39 14,46 14.5,52 Z','#8A6A4E',ink,1.5,scale,scale);
  svgPath_(x,'M 12,4 C 15.5,4 18.5,6.5 19,10 C 21.5,11 23,14 22,17 C 23.5,20.5 22.5,25 19.5,28 C 19.5,32 16.5,35 13,35 C 10.5,35 8.5,33.5 7.5,31.5 C 5,32.5 2.5,30.5 2,27.5 C 0.8,24 1.5,20 3,17.5 C 1.8,14.5 3,11 5.5,9.5 C 6.5,6 9,4 12,4 Z','#5E8F6B',ink,1.5,scale,scale);
  svgPath_(x,'M 7,13 C 9,11.5 11.5,12 12,14','none',ink,1.2,scale,scale);
  svgPath_(x,'M 17,14 C 15.5,16.5 13.5,17 11.5,17','none',ink,1.2,scale,scale);
  svgPath_(x,'M 6.5,23 C 8.5,22.5 11,23.5 11.5,26','none',ink,1.2,scale,scale);
  svgPath_(x,'M 17.5,22 C 15.5,21.5 14,23 13.5,25','none',ink,1.2,scale,scale);
  [[8,10.5],[16,11.5],[11.5,16.5],[6,19.5],[18,20.5],[12.5,26.5]].forEach(function(p){
    x.beginPath(); x.arc(p[0],p[1],1.3,0,Math.PI*2);
    x.fillStyle='#D94F40'; x.fill(); x.strokeStyle=ink; x.lineWidth=0.8/scale; x.stroke();
  });
  x.restore();
}
function drawPicket_(x,ox,oy,scale){
  x.save(); x.translate(ox,oy); x.scale(scale,scale);
  x.beginPath();
  x.moveTo(4,2.5); x.lineTo(7,6.5); x.lineTo(7,29.4); x.lineTo(1,29.4); x.lineTo(1,6.5); x.closePath();
  x.fillStyle='#FFFCF7'; x.fill();
  x.strokeStyle='#4F4036'; x.lineJoin='round'; x.lineWidth=1.2/scale; x.stroke();
  [11,23].forEach(function(cy){
    x.beginPath(); x.arc(4,cy,0.5,0,Math.PI*2); x.fillStyle='#4F4036'; x.fill();
  });
  x.restore();
}

/* The village, redrawn small for the corner of the share card, using the
   actual house/tree/fence assets above rather than reinvented shapes. Sky
   down to a parchment fade, two hill bands, then those assets sitting on
   the near one. Confined to the card's bottom margin, below the footer text
   (moved up to clear it). Clipped to the same rounded outline the wobbly
   frame strokes so the hill bands can't bleed past the card's own rounded
   corners the way a plain fillRect would -- caught from a screenshot where
   the near hill visibly squared off past the frame's curve at the bottom. */
function drawShareScenery(x,W,H){
  var skyBottom=1420, farTop=1560, farBase=1600, nearTop=1660, nearBase=H-78;

  x.save();
  roundRectPath(x,46,46,W-92,H-92,[132,30,120,30]);
  x.clip();

  var sky=x.createLinearGradient(0,0,0,skyBottom);
  sky.addColorStop(0,'#BFE0F3'); sky.addColorStop(1,'#FFFCF7');
  x.fillStyle=sky; x.fillRect(0,0,W,skyBottom);
  x.fillStyle='#FFFCF7'; x.fillRect(0,skyBottom,W,nearBase-skyBottom);

  // far hill: a soft, low sage ridge
  x.fillStyle='#A8C59A';
  x.beginPath(); x.moveTo(0,farBase);
  x.bezierCurveTo(W*0.22,farTop-14, W*0.36,farBase+10, W*0.5,farTop);
  x.bezierCurveTo(W*0.68,farTop-16, W*0.82,farBase+8, W,farTop+6);
  x.lineTo(W,nearBase); x.lineTo(0,nearBase); x.closePath(); x.fill();

  // near hill: the leaf-green band everything else sits on
  x.fillStyle='#5E8F6B';
  x.beginPath(); x.moveTo(0,nearBase-90);
  x.bezierCurveTo(W*0.2,nearTop-20, W*0.34,nearTop+18, W*0.5,nearTop+2);
  x.bezierCurveTo(W*0.66,nearTop-14, W*0.8,nearTop+22, W,nearTop+8);
  x.lineTo(W,nearBase); x.lineTo(0,nearBase); x.closePath(); x.fill();

  var s=1.9;
  // Each asset's own ground line lands at the same y (nearBase): the
  // picket's foot is at local y=29.4 (its viewBox is 30 tall), the house's
  // and tree's are both at local y=64/52 -- oy is solved per-asset so
  // oy + groundLocalY*s = nearBase, or the fence would float above the
  // ground the house and tree are standing on.
  drawPicket_(x,W*0.72,nearBase-29.4*s,s);
  drawPicket_(x,W*0.72+13*s,nearBase-29.4*s,s);
  drawPicket_(x,W*0.72+26*s,nearBase-29.4*s,s);
  drawTree_(x,W*0.22,nearBase-52*s,s);
  drawHouse_(x,W*0.48,nearBase-64*s,s);

  x.restore(); // lifts the clip -- border strokes and text below draw unclipped
}

/* item 7: a postmark treatment in the card's top-right corner -- a ring of
   small paper-color "bite" notches following the frame's own top-right
   corner radius (roundRectPath's r[1]=30 below, same value used for the
   card outline itself, so the perforation sweeps exactly the arc the ink
   frame already draws rather than a made-up radius), plus a faint
   cancellation mark over it. Drawn with the same Path2D-free arc/line calls
   drawShareScenery already uses, in the existing ink-brown/paper palette --
   no new colors. Called AFTER the frame strokes below so the notches read
   as punched through the border, not just laid under it. */
function drawPostmark_(x,W,H){
  var r=30, cx=W-46-r, cy=46+r; // top-right corner's own arc center
  x.save();
  x.fillStyle='#FFFCF7';
  var n=8;
  for(var i=0;i<n;i++){
    var a=(-88+(i/(n-1))*86)*Math.PI/180; // sweep the top-right quarter arc
    var px=cx+Math.cos(a)*r, py=cy+Math.sin(a)*r;
    x.beginPath(); x.arc(px,py,6,0,Math.PI*2); x.fill();
  }
  // cancellation mark: a faint ring plus two strike lines, ink-brown at low
  // alpha so it reads as a postmark ghost, not a competing focal point.
  x.strokeStyle='rgba(79,64,54,.28)'; x.lineWidth=2;
  x.beginPath(); x.arc(cx-8,cy+14,24,0,Math.PI*2); x.stroke();
  x.beginPath(); x.moveTo(cx-46,cy-4); x.lineTo(cx+14,cy+22); x.stroke();
  x.beginPath(); x.moveTo(cx-40,cy+6); x.lineTo(cx+20,cy+32); x.stroke();
  x.restore();
}

function drawShareCard(){
  var W=1080,H=1920;
  var c=document.createElement('canvas'); c.width=W; c.height=H;
  var x=c.getContext('2d');

  // parchment ground, with the village scenery inset along the bottom
  x.fillStyle='#FFFCF7'; x.fillRect(0,0,W,H);
  drawShareScenery(x,W,H);

  // wobbly ink frame, mirroring the on-screen card's asymmetric radii
  x.strokeStyle='rgba(79,64,54,.7)'; x.lineWidth=7;
  roundRectPath(x,46,46,W-92,H-92,[132,30,120,30]);
  x.stroke();
  x.strokeStyle='#EDE4D4'; x.lineWidth=3; x.setLineDash([10,12]);
  roundRectPath(x,78,78,W-156,H-156,[112,22,104,22]);
  x.stroke(); x.setLineDash([]);

  drawPostmark_(x,W,H);

  var cx=W/2;
  x.textAlign='center';

  x.fillStyle='#C9493B';
  x.font='700 30px Montserrat, sans-serif';
  x.fillText('ATENEO CELADON  ·  RECWEEK 2026-2027', cx, 224);

  x.fillStyle='#4F4036';
  x.font='400 132px Bevan, Georgia, serif';
  x.fillText('Celaville', cx, 366);

  x.fillStyle='#6B5D51';
  x.font='600 38px Montserrat, sans-serif';
  x.fillText((P.name||'')+'’s Wrapped', cx, 436);

  // persona as the hero
  var y=598;
  if(P.persona){
    x.fillStyle='#5E8F6B';
    x.font='400 96px "Kaiti SC", serif';
    x.fillText('乡', cx, y); y+=104;
    x.fillStyle='#4F4036';
    x.font='800 74px Grandstander, sans-serif';
    var pl=wrapText(x,P.persona.name,W-260);
    for(var i=0;i<pl.length;i++){ x.fillText(pl[i],cx,y); y+=86; }
    y+=34;
  }

  // stat rows, left-aligned so the values line up
  var rows=shareStats().filter(function(r){ return !(P.persona && r[0]==='Persona'); });
  x.textAlign='left';
  var lx=140, rw=W-280;
  rows.forEach(function(r){
    x.strokeStyle='#EDE4D4'; x.lineWidth=2; x.setLineDash([8,10]);
    x.beginPath(); x.moveTo(lx,y-4); x.lineTo(lx+rw,y-4); x.stroke(); x.setLineDash([]);
    y+=54;
    x.fillStyle='#6B5D51'; x.font='700 30px Montserrat, sans-serif';
    x.fillText(String(r[0]).toUpperCase(), lx, y);
    y+=58;
    x.fillStyle='#4F4036'; x.font='800 50px Grandstander, sans-serif';
    var vl=wrapText(x,r[1],rw);
    for(var j=0;j<vl.length;j++){ x.fillText(vl[j],lx,y); y+=58; }
    y+=26;
  });

  // footer -- sits directly over the hill scenery now, so a single fixed
  // text color can't be trusted: measured, coral-on-sage is 2.47:1 and
  // muted-on-leaf is 1.7:1, both well under the 4.5:1 WCAG AA floor (the
  // sage/leaf hill colors were never designed to carry text). A paper-
  // colored halo stroke behind the fill is what #hint already does on the
  // live page for the same reason -- guaranteed legible regardless of
  // which hill color, or the sky, ends up underneath.
  function haloText(text,y,fill,font){
    x.font=font; x.lineJoin='round'; x.miterLimit=2;
    x.lineWidth=9; x.strokeStyle='rgba(255,252,247,.94)';
    x.strokeText(text,cx,y);
    x.fillStyle=fill; x.fillText(text,cx,y);
  }
  x.textAlign='center';
  haloText('Start the next chapter with Celadon', H-300, '#C9493B', '800 34px Grandstander, sans-serif');
  haloText('@ateneoceladon', H-248, '#4F4036', '600 28px Montserrat, sans-serif');
  return c;
}



/* ── share sheet: open/close ──────────────────────────────────────────────
   The sheet is a native <dialog id="sharewrap"> (see index.html), opened
   with showModal() so it lands on the top layer with free Esc-to-close and
   focus trapping -- no z-index or scroll-lock hand-holding needed.
   Waits for webfonts first: drawShareCard's canvas text silently falls back
   to a system face if the font hasn't finished loading, which is the classic
   way a share card renders off-brand. Self-hosted fonts (styles.css) make
   this resolve close to instantly instead of racing a webfont network
   fetch, but the wait itself is kept for correctness on a cold cache. */
function openShare(){
  var wrap=document.getElementById('sharewrap');
  var img=document.getElementById('shareimg');
  var dl=document.getElementById('sharedl');
  var go=function(){
    var c;
    try { c=drawShareCard(); } catch(e){ return; }
    var url;
    try { url=c.toDataURL('image/png'); } catch(e){ return; }
    img.src=url; dl.href=url;
    if(typeof wrap.showModal==='function'){
      if(!wrap.open) wrap.showModal();
    } else {
      // Ancient engine with no <dialog> support at all: fall back to the
      // plain-overlay behavior the class toggle used to provide.
      wrap.classList.add('on');
    }
    // Web Share Level 2: hand the real PNG to the OS share sheet so it can
    // go straight into Stories/Messages/whatever the reader picks, rather
    // than "press and hold to save" -- which was purely a workaround for
    // the old HtmlService sandbox where no share API was reachable at all.
    // The data-URL <a download> above stays live underneath as the
    // desktop / unsupported-browser fallback.
    if(c.toBlob){
      c.toBlob(function(blob){
        if(!blob) return;
        var file;
        try { file=new File([blob],'celaville-wrapped.png',{type:'image/png'}); } catch(e){ return; }
        if(navigator.canShare && navigator.canShare({files:[file]})){
          var shareHint=document.getElementById('sharehint');
          if(shareHint) shareHint.textContent='Tip: use Share below to send it straight to Stories.';
          var shareBtn=document.getElementById('sharenative');
          if(shareBtn){
            shareBtn.hidden=false;
            shareBtn.onclick=function(e){
              e.stopPropagation();
              navigator.share({files:[file],title:'My Celaville Wrapped'}).catch(function(){});
            };
          }
        }
      },'image/png');
    }
  };
  if(document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(go, go);
  else go();
}
function closeShare(){
  var wrap=document.getElementById('sharewrap');
  if(typeof wrap.close==='function' && wrap.open) wrap.close();
  else wrap.classList.remove('on');
}

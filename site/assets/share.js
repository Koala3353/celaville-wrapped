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
/* Round 2: each row now carries a `key` (which icon drawStatIcon_ draws) and
   a `color` (which brand token tints its card) instead of being a bare
   [label,value] pair -- the old array shape had no slot for either, and
   pattern-matching the label text back in drawShareCard would have broken
   the moment a label's wording changed. Object shape, same ordering and same
   slice(0,5) cap as before. */
function shareStats(){
  var out=[];
  if(P.persona) out.push({key:'persona', label:'Persona', value:P.persona.name});
  if(P.dept) out.push({key:'dept', label:'Department', value:P.dept.name, color:'leaf'});
  if(P.rarest) out.push({key:'rarest', label:(P.rarest.solo?'Only you picked':'Rarest answer'), value:P.rarest.label, color:'coral'});
  if(P.journey) out.push({key:'journey', label:'Showed up', value:P.journey.totalVisits+'x across '+P.journey.eventCount+' events', color:'sky'});
  // Explicitly kept: mahjong was called out by name as a section to preserve
  // through this redesign, not just carried along incidentally.
  if(P.mahjong && P.mahjong.showRank) out.push({key:'mahjong', label:'Mahjong board', value:'#'+P.mahjong.rank+' of '+P.mahjong.playerCount, color:'yellow'});
  if(P.mbti && P.mbti.type) out.push({key:'mbti', label:'Four letters', value:P.mbti.type+(P.mbti.isRarest?' (one of one)':''), color:'sage'});
  if(P.platforms) out.push({key:'platform', label:'Top platform', value:P.platforms.top, color:'peach'});
  if(P.twinTotal) out.push({key:'twins', label:'Batch overlaps', value:P.twinTotal+' people', color:'sage'});
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

/* Cloud cluster, kite, small background house (3 roof-color variants), the
   open-sided mahjong pavilion, and a lantern-on-post -- all copied from the
   exact Gemini asset markup already inlined in #village (index.html), the
   same "real path data via Path2D, not a canvas reinterpretation" rule
   drawHouse_/drawTree_/drawPicket_ above already follow. */
function drawCloudAsset_(x,ox,oy,scale){
  x.save(); x.translate(ox,oy); x.scale(scale,scale);
  x.fillStyle='#FFFCF7';
  x.beginPath(); x.ellipse(9,27,4,2.2,0,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(83,22,3.5,2,0,0,Math.PI*2); x.fill();
  x.fill(new Path2D('M 15,27 C 10,27 9,23 13,22 C 13,17.5 18,15.5 23,17.5 C 26,11.5 34,9.5 40,12.5 C 45,6.5 55,6.5 60,11.5 C 66,8.5 74,11.5 76,16.5 C 81,16.5 85,20.5 83,25.5 C 81,29.5 75,30.5 71,27.5 C 66,31.5 57,31.5 51,28.5 C 45,32.5 35,32.5 30,28.5 C 25,30.5 19,30.5 15,27 Z'));
  x.restore();
}
function drawKiteAsset_(x,ox,oy,scale){
  x.save(); x.translate(ox,oy); x.scale(scale,scale);
  x.lineJoin='round'; x.lineCap='round';
  var ink='#4F4036';
  function seg(x1,y1,x2,y2,sw){ x.beginPath(); x.moveTo(x1,y1); x.lineTo(x2,y2);
    x.strokeStyle=ink; x.lineWidth=sw/scale; x.stroke(); }
  function tri(pts,fill){
    x.beginPath();
    pts.forEach(function(p,i){ if(i) x.lineTo(p[0],p[1]); else x.moveTo(p[0],p[1]); });
    x.closePath(); x.fillStyle=fill; x.fill(); x.strokeStyle=ink; x.lineWidth=0.9/scale; x.stroke();
  }
  svgPath_(x,'M 15,23 C 11,32 6,43 2,54','none',ink,1,scale,scale);
  svgPath_(x,'M 21,28 C 17,33 13,36 17,41 C 21,46 15,50 12,53','none',ink,1.1,scale,scale);
  seg(24.2,9,15,23,0.9); seg(21.8,23,15,23,0.9);
  tri([[18,33],[13,31.5],[15,36]],'#E4B64A');
  tri([[16,39],[21,37.5],[19,42]],'#D94F40');
  tri([[18.5,44],[14,45.5],[16.5,48.5]],'#5E8F6B');
  tri([[14,50.5],[18.5,51.5],[15,54.5]],'#E4B64A');
  tri([[25,4],[10,15],[23,16]],'#D94F40');
  tri([[25,4],[36,17],[23,16]],'#FFFCF7');
  tri([[21,28],[36,17],[23,16]],'#D94F40');
  tri([[21,28],[10,15],[23,16]],'#FFFCF7');
  x.beginPath(); x.moveTo(25,4); x.lineTo(36,17); x.lineTo(21,28); x.lineTo(10,15); x.closePath();
  x.strokeStyle=ink; x.lineWidth=1.4/scale; x.stroke();
  seg(25,4,21,28,1.1); seg(10,15,36,17,1.1);
  x.restore();
}
function drawSmallHouseAsset_(x,ox,oy,scale,roof){
  x.save(); x.translate(ox,oy); x.scale(scale,scale);
  x.lineJoin='round'; x.lineCap='round';
  var ink='#4F4036';
  function rrect(rx,ry,rw,rh,rr,fill,sw){
    x.beginPath(); x.moveTo(rx+rr,ry); x.lineTo(rx+rw-rr,ry); x.quadraticCurveTo(rx+rw,ry,rx+rw,ry+rr);
    x.lineTo(rx+rw,ry+rh-rr); x.quadraticCurveTo(rx+rw,ry+rh,rx+rw-rr,ry+rh);
    x.lineTo(rx+rr,ry+rh); x.quadraticCurveTo(rx,ry+rh,rx,ry+rh-rr);
    x.lineTo(rx,ry+rr); x.quadraticCurveTo(rx,ry,rx+rr,ry); x.closePath();
    x.fillStyle=fill; x.fill(); x.strokeStyle=ink; x.lineWidth=sw/scale; x.stroke();
  }
  function seg(x1,y1,x2,y2,sw){ x.beginPath(); x.moveTo(x1,y1); x.lineTo(x2,y2);
    x.strokeStyle=ink; x.lineWidth=sw/scale; x.stroke(); }
  rrect(12,21,26,21,1,'#FFFCF7',1.8);
  seg(9,42,41,42,1.8);
  svgPath_(x,'M 22,42 L 22,33 A 3,3 0 0 1 28,33 L 28,42 Z','#8A6A4E',ink,1.8,scale,scale);
  rrect(14.5,27,5,5.5,0.8,'#9FD0EB',1.5);
  seg(14.5,29.75,19.5,29.75,1.2); seg(17,27,17,32.5,1.2);
  svgPath_(x,'M 25,5 Q 15,13 5,21.5 Q 25,23.5 45,21.5 Q 35,13 25,5 Z',roof,ink,1.8,scale,scale);
  x.restore();
}
function drawPavilionAsset_(x,ox,oy,scale){
  x.save(); x.translate(ox,oy); x.scale(scale,scale);
  x.lineJoin='round'; x.lineCap='round';
  var ink='#4F4036';
  function seg(x1,y1,x2,y2,sw){ x.beginPath(); x.moveTo(x1,y1); x.lineTo(x2,y2);
    x.strokeStyle=ink; x.lineWidth=sw/scale; x.stroke(); }
  function rrect(rx,ry,rw,rh,rr,fill,sw){
    x.beginPath(); x.moveTo(rx+rr,ry); x.lineTo(rx+rw-rr,ry); x.quadraticCurveTo(rx+rw,ry,rx+rw,ry+rr);
    x.lineTo(rx+rw,ry+rh-rr); x.quadraticCurveTo(rx+rw,ry+rh,rx+rw-rr,ry+rh);
    x.lineTo(rx+rr,ry+rh); x.quadraticCurveTo(rx,ry+rh,rx,ry+rh-rr);
    x.lineTo(rx,ry+rr); x.quadraticCurveTo(rx,ry,rx+rr,ry); x.closePath();
    x.fillStyle=fill; x.fill(); x.strokeStyle=ink; x.lineWidth=sw/scale; x.stroke();
  }
  x.beginPath(); x.ellipse(45,32,9,6,0,0,Math.PI*2); x.fillStyle='#E4B64A'; x.fill();
  seg(14,44,76,44,1.8);
  rrect(20,40,50,4,0.8,'#FFFCF7',1.8);
  seg(31,28,59,28,1.6); seg(36,28,36,32,1.4); seg(45,28,45,32,1.4); seg(54,28,54,32,1.4);
  rrect(31,32,28,3,0.5,'#FFFCF7',1.6);
  seg(35,35,35,40,1.4); seg(45,35,45,40,1.4); seg(55,35,55,40,1.4);
  rrect(26,19,4,21,0.5,'#8A6A4E',1.8); rrect(60,19,4,21,0.5,'#8A6A4E',1.8); rrect(23,18,44,3,0.5,'#8A6A4E',1.8);
  svgPath_(x,'M 26,24 L 31,19','none',ink,1.5,scale,scale);
  svgPath_(x,'M 64,24 L 59,19','none',ink,1.5,scale,scale);
  seg(45,21,45,23.5,1.4); seg(43,23.5,47,23.5,1.4);
  x.beginPath(); x.ellipse(45,26.5,3.5,3,0,0,Math.PI*2); x.fillStyle='#E4B64A'; x.fill(); x.strokeStyle=ink; x.lineWidth=1.5/scale; x.stroke();
  seg(45,29.5,45,32,1.4);
  svgPath_(x,'M 45,4 Q 28,11 6,20 C 10,21 16,21 22,20.5 L 68,20.5 C 74,21 80,21 84,20 Q 62,11 45,4 Z','#D94F40',ink,2,scale,scale);
  svgPath_(x,'M 45,6 L 45,19','none',ink,1.5,scale,scale);
  svgPath_(x,'M 41,8 Q 30,13 18,20','none',ink,1.4,scale,scale);
  svgPath_(x,'M 49,8 Q 60,13 72,20','none',ink,1.4,scale,scale);
  x.beginPath(); x.arc(45,3.5,2,0,Math.PI*2); x.fillStyle='#E4B64A'; x.fill(); x.strokeStyle=ink; x.lineWidth=1.8/scale; x.stroke();
  x.restore();
}
function drawLanternPostAsset_(x,ox,oy,scale){
  x.save(); x.translate(ox,oy); x.scale(scale,scale);
  x.lineJoin='round'; x.lineCap='round';
  var ink='#4F4036';
  function seg(x1,y1,x2,y2,sw){ x.beginPath(); x.moveTo(x1,y1); x.lineTo(x2,y2);
    x.strokeStyle=ink; x.lineWidth=sw/scale; x.stroke(); }
  function rrect(rx,ry,rw,rh,rr,fill,sw){
    x.beginPath(); x.moveTo(rx+rr,ry); x.lineTo(rx+rw-rr,ry); x.quadraticCurveTo(rx+rw,ry,rx+rw,ry+rr);
    x.lineTo(rx+rw,ry+rh-rr); x.quadraticCurveTo(rx+rw,ry+rh,rx+rw-rr,ry+rh);
    x.lineTo(rx+rr,ry+rh); x.quadraticCurveTo(rx,ry+rh,rx,ry+rh-rr);
    x.lineTo(rx,ry+rr); x.quadraticCurveTo(rx,ry,rx+rr,ry); x.closePath();
    x.fillStyle=fill; x.fill(); x.strokeStyle=ink; x.lineWidth=sw/scale; x.stroke();
  }
  seg(1.5,30,7.5,30,1.3);
  rrect(3,4,2,26,0.4,'#8A6A4E',1.2);
  svgPath_(x,'M 4,4 L 13,3.5','none',ink,1.3,scale,scale);
  seg(4,8,8,4,1.1); seg(13,3.5,13,7.5,1);
  x.beginPath(); x.ellipse(13,14,5.5,5.5,0,0,Math.PI*2); x.fillStyle='#E4B64A'; x.fill(); x.strokeStyle=ink; x.lineWidth=1.3/scale; x.stroke();
  svgPath_(x,'M 7.8,12.5 Q 13,13.5 18.2,12.5 L 18.2,15.5 Q 13,16.5 7.8,15.5 Z','#D94F40',ink,1.1,scale,scale);
  svgPath_(x,'M 13,8.5 Q 9.8,14 13,19.5','none',ink,0.9,scale,scale);
  svgPath_(x,'M 13,8.5 Q 16.2,14 13,19.5','none',ink,0.9,scale,scale);
  seg(13,8.5,13,19.5,0.9);
  rrect(10.5,7.5,5,1.5,0.4,'#D94F40',1);
  rrect(10.5,19,5,1.5,0.4,'#D94F40',1);
  x.beginPath(); x.arc(13,21.5,0.7,0,Math.PI*2); x.fillStyle='#E4B64A'; x.fill(); x.strokeStyle=ink; x.lineWidth=0.7/scale; x.stroke();
  seg(13,21.5,13,26.5,1.3);
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
/* Sky pass -- drawn FIRST, before any text, so the pale sky-to-paper wash
   sits behind the header the same way it sits behind the village further
   down. Two clouds and a drifting kite (the exact assets #vclouds flies on
   the live page) give the top of the card the same sense of movement the
   header alone didn't have. Split out from the old single drawShareScenery
   pass specifically so the SECOND half (the hills) can be drawn AFTER the
   persona/stat-grid content, once the real height of that content is known
   -- see drawShareVillage_ and its call site in drawShareCard(). */
function drawShareSky_(x,W,H){
  var skyBottom=H*0.64;
  x.save();
  roundRectPath(x,46,46,W-92,H-92,[132,30,120,30]);
  x.clip();
  var sky=x.createLinearGradient(0,0,0,skyBottom);
  sky.addColorStop(0,'#BFE0F3'); sky.addColorStop(1,'#FFFCF7');
  x.fillStyle=sky; x.fillRect(0,0,W,skyBottom);
  drawCloudAsset_(x,W*0.06,118,1.35);
  drawCloudAsset_(x,W*0.60,166,1.05);
  drawKiteAsset_(x,W*0.85,466,1.5);
  x.restore();
}

/* Village pass -- drawn AFTER the persona badge and stat grid, once `y`
   (how far down the card real content actually reached) is known, so the
   hills can start right where the content ends instead of at a guessed
   fixed y that either clips the scene or leaves a dead gap above it. Three
   depth bands (far/mid/near), not two, and every fill now runs all the way
   down to the card's own bottom edge (H, inside the same rounded clip)
   instead of stopping short at a `nearBase` that left a flat paper margin
   below everyone's feet -- that gap plus the shallow band height is what
   read as "cramped and clipped." hasMahjong swaps in the actual mahjong
   pavilion for the mid band (tied to a real stat on the card, not just
   decoration) when that stat made shareStats()'s cut; otherwise a small
   cluster of the background village houses fills that band instead. */
/* An organic, many-undulation ridge line, not two smooth bezier arcs. The
   on-page village's real SVG hills (index.html, #vfar/#vmid/#vnear) are
   ALSO flat single-color fills, no gradients -- checked directly against
   their source paths before assuming otherwise. The actual gap between
   "the wrapped's background" and "the share card's background" is silhouette
   complexity: the real ridge is dozens of small bezier segments (an
   organic, hand-drawn-feeling line), while this card drew each band as a
   single smooth double-arc, which reads as a generic soft blob by
   comparison at the same flat-fill color. Two summed sine waves at
   different frequencies/phases produce that same many-undulation quality
   deterministically (no Math.random -- this has to render identically
   every time the same payload is drawn), quadratic-curved through in
   segments so the joins themselves stay smooth rather than faceted. */
function hillRidgePath_(x,W,baseY,amp1,amp2,freq1,freq2,phase){
  var N=22, pts=[];
  for(var i=0;i<=N;i++){
    var t=i/N;
    var y=baseY+amp1*Math.sin(t*Math.PI*freq1+phase)+amp2*Math.sin(t*Math.PI*freq2+phase*1.7+1.1);
    pts.push([t*W,y]);
  }
  x.moveTo(pts[0][0],pts[0][1]);
  for(var i=1;i<pts.length;i++){
    var midX=(pts[i-1][0]+pts[i][0])/2, midY=(pts[i-1][1]+pts[i][1])/2;
    x.quadraticCurveTo(pts[i-1][0],pts[i-1][1],midX,midY);
  }
  x.quadraticCurveTo(pts[N][0],pts[N][1],pts[N][0],pts[N][1]);
  return pts;
}
/* A small grass-tuft clump sitting on a ridge line -- the same shape and
   role as the tufts already inked onto the real #vfar path (index.html),
   just parameterized so it can be dropped at any (x,y) here. Filled a
   shade darker than the hill it sits on, per the on-page version. */
function drawTuft_(x,cx,cy,w,h,fill){
  x.beginPath();
  x.moveTo(cx-w/2,cy);
  x.quadraticCurveTo(cx-w/2-2,cy-h, cx,cy-h*1.15);
  x.quadraticCurveTo(cx+w/2+2,cy-h, cx+w/2,cy);
  x.closePath();
  x.fillStyle=fill; x.fill();
}

function drawShareVillage_(x,W,H,sceneryTop,hasMahjong){
  var farTop=sceneryTop, farBase=sceneryTop+60,
      midTop=farBase, midBase=farBase+75,
      nearTop=midBase+95, nearBase=midBase+255;

  x.save();
  roundRectPath(x,46,46,W-92,H-92,[132,30,120,30]);
  x.clip();

  // far hill: a soft, low sage ridge
  x.beginPath();
  var farPts=hillRidgePath_(x,W,(farTop+farBase)/2,16,7,2.6,5.3,0.4);
  x.lineTo(W,H); x.lineTo(0,H); x.closePath();
  x.fillStyle='#A8C59A'; x.fill();
  drawTuft_(x,farPts[7][0],farPts[7][1],20,16,'#93B587');
  drawTuft_(x,farPts[15][0],farPts[15][1],18,14,'#93B587');

  // mid hill: a step darker/greener than the far ridge, a step lighter than
  // the near band -- the same depth gradient the on-page panorama uses
  // (sage far, leaf near), with one more rung so the midground has
  // somewhere of its own to stand.
  x.beginPath();
  var midPts=hillRidgePath_(x,W,(midTop+midBase)/2,18,8,2.2,4.6,2.1);
  x.lineTo(W,H); x.lineTo(0,H); x.closePath();
  x.fillStyle='#8FB08B'; x.fill();

  // Midground, drawn BEFORE the near hill so it sits half behind the
  // foreground rise, same trick the tree already used.
  if(hasMahjong){
    drawPavilionAsset_(x,W*0.34,midBase-55*1.6,1.6);
  } else {
    drawSmallHouseAsset_(x,W*0.28,midBase-45*1.35,1.35,'#E4B64A');
    drawSmallHouseAsset_(x,W*0.40,midBase-45*1.15,1.15,'#5E8F6B');
  }
  var sTree=1.5;
  drawTree_(x,W*0.66,(midBase-8)-52*sTree,sTree);

  // near hill: the leaf-green foreground the house, fence and lantern posts
  // stand on -- filled all the way to H, so there is no flat paper strip
  // between anyone's feet and the card's actual bottom edge.
  x.beginPath();
  var nearPts=hillRidgePath_(x,W,(nearTop+nearBase-90)/2,26,11,1.8,3.9,4.3);
  x.lineTo(W,H); x.lineTo(0,H); x.closePath();
  x.fillStyle='#5E8F6B'; x.fill();
  drawTuft_(x,nearPts[5][0],nearPts[5][1],26,20,'#527D5E');
  drawTuft_(x,nearPts[18][0],nearPts[18][1],24,18,'#527D5E');

  var sHouse=2.3, sFence=1.5, sLantern=1.5;
  var houseOx=W*0.34;
  drawHouse_(x,houseOx,nearBase-64*sHouse,sHouse);
  var fenceOx=houseOx+76*sHouse+16;
  drawPicket_(x,fenceOx,nearBase-29.4*sFence,sFence);
  drawPicket_(x,fenceOx+13*sFence,nearBase-29.4*sFence,sFence);

  // Lantern posts flanking the village -- the Festivalgoer persona's own
  // motif (the same silhouette as the header's #lantern and the recap's
  // floating lanterns), so the scene reads as festival-lit at both edges
  // instead of just populated in the middle.
  //
  // The left post's x used to be W*0.05 (54px): with the card's own rounded
  // frame clip at x=46 and a bottom-left corner radius of only 30px, the
  // clip boundary curves inward to x=76 over the last 30px of height --
  // right where this asset's base sits -- so its left edge got sliced off
  // (confirmed against a real render: a stray sliver visible at the card's
  // bottom-left corner). 100px clears that curve with margin to spare. The
  // right post keeps its old placement: that corner's radius is 120px, a
  // much gentler curve reaching far further up, and a real render shows no
  // equivalent clipping there.
  drawLanternPostAsset_(x,100,nearBase-30*sLantern,sLantern);
  drawLanternPostAsset_(x,W*0.90,nearBase-30*sLantern,sLantern);

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
  // The cancellation mark that used to sit here (a faint ring plus two
  // strike lines, meant to read as a postmark ghost) instead read as a
  // no-entry / blocked-action glyph at a glance -- a circle with a diagonal
  // line through it is exactly that icon's shape, regardless of intent.
  // Removed rather than softened further: the perforation notches above
  // already carry the "postmark" idea on their own.
  x.restore();
}

/* P.persona.color is one of the raw BRAND fill hexes (coral/leaf/sky/
   yellow -- the only four any persona actually uses), not its accessible
   -Text sibling. Fine for a small tag glyph or a card wash, not fine as the
   card's largest headline text: BRAND's own comment measures sky at 1.62:1
   and yellow at 1.85:1 against paper, both hard WCAG fails, which is why
   BRAND ships an accessible -Text variant of each in the first place. This
   maps the raw hex to that sibling so the persona name can be colored
   in-brand without the exact contrast problem sky-legible headings
   elsewhere already had to fix once. */
var PERSONA_TEXT_COLOR_ = {
  '#D94F40': '#C9493B', // coral -> coralText
  '#5E8F6B': '#527D5E', // leaf -> leafText
  '#9FD0EB': '#5C7888', // sky -> skyText
  '#E4B64A': '#8D702D', // yellow -> yellowText
};
function personaTextColor_(hex){
  return PERSONA_TEXT_COLOR_[String(hex||'').toUpperCase()] || hex || '#4F4036';
}

/* #RRGGBB -> rgba(...) string, so a brand hex token can be dropped in at a
   given alpha for a card wash without keeping a second rgba-triplet copy of
   every color around just for this. */
function hexA_(hex,a){
  var h=String(hex).replace('#','');
  var r=parseInt(h.substring(0,2),16), g=parseInt(h.substring(2,4),16), b=parseInt(h.substring(4,6),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}

/* One small glyph per stat category (item 4 round 2), so the card reads as
   four distinct little scenes instead of a uniform label/value list. Each
   shape is drawn with the same ink-stroke-over-flat-fill language as
   drawHouse_/drawTree_ above rather than an imported icon font -- there's no
   font/SVG-sprite dependency this canvas render can reach for anyway. `key`
   picks the shape; unrecognized/future stat keys fall through to a plain
   diamond rather than drawing nothing. */
function drawStatIcon_(x,key,cx,cy,r,fill,ink){
  x.save();
  x.lineJoin='round'; x.lineCap='round';
  x.fillStyle=fill; x.strokeStyle=ink; x.lineWidth=2;
  if(key==='dept'){
    // a little roof-and-door house -- department is "where you belong"
    x.beginPath();
    x.moveTo(cx-r,cy+r*0.2); x.lineTo(cx,cy-r*0.8); x.lineTo(cx+r,cy+r*0.2);
    x.lineTo(cx+r*0.68,cy+r*0.2); x.lineTo(cx+r*0.68,cy+r*0.85); x.lineTo(cx-r*0.68,cy+r*0.85);
    x.lineTo(cx-r*0.68,cy+r*0.2); x.closePath();
    x.fill(); x.stroke();
    x.fillStyle=ink;
    x.fillRect(cx-r*0.15,cy+r*0.32,r*0.3,r*0.5);
  } else if(key==='rarest'){
    // an 8-point sparkle -- the "nobody else said this" answer
    x.beginPath();
    for(var i=0;i<8;i++){
      var len=(i%2===0)?r:r*0.42, ang=i*(Math.PI/4)-Math.PI/2;
      var px=cx+Math.cos(ang)*len, py=cy+Math.sin(ang)*len;
      if(i===0) x.moveTo(px,py); else x.lineTo(px,py);
    }
    x.closePath(); x.fill(); x.stroke();
  } else if(key==='journey'){
    // a little trail signpost, not a generic map pin -- echoes the same
    // signpost() silhouette the chapter breaks use elsewhere in the story,
    // so "showed up" reads as the walk's own waymarking language.
    x.beginPath();
    x.moveTo(cx-r*0.08,cy+r); x.lineTo(cx-r*0.08,cy-r*0.15);
    x.strokeStyle=ink; x.lineWidth=r*0.16; x.lineCap='round'; x.stroke();
    x.beginPath();
    x.moveTo(cx-r*0.08,cy-r*0.75); x.lineTo(cx+r*0.9,cy-r*0.55);
    x.lineTo(cx+r*0.62,cy-r*0.32); x.lineTo(cx-r*0.08,cy-r*0.12); x.closePath();
    x.fill(); x.stroke();
  } else if(key==='mahjong'){
    // a mahjong tile with two pips
    roundRectPath(x,cx-r,cy-r*0.78,r*2,r*1.56,[8,8,8,8]);
    x.fill(); x.stroke();
    x.fillStyle=ink;
    x.beginPath(); x.arc(cx-r*0.36,cy,r*0.17,0,Math.PI*2); x.fill();
    x.beginPath(); x.arc(cx+r*0.36,cy,r*0.17,0,Math.PI*2); x.fill();
  } else {
    // fallback diamond for any stat this redesign didn't specifically design
    // an icon for (four-letter type, top platform, batch overlaps, ...)
    x.beginPath();
    x.moveTo(cx,cy-r); x.lineTo(cx+r,cy); x.lineTo(cx,cy+r); x.lineTo(cx-r,cy);
    x.closePath(); x.fill(); x.stroke();
  }
  x.restore();
}

function drawShareCard(){
  var W=1080,H=1920;
  var c=document.createElement('canvas'); c.width=W; c.height=H;
  var x=c.getContext('2d');

  // Full paper square first, UNCLIPPED, so the four corners outside the
  // rounded ink frame still read as the same parchment rather than bare
  // canvas -- drawShareSky_/drawShareVillage_ each clip to the rounded
  // card shape for their own content, but this base fill deliberately
  // doesn't.
  x.fillStyle='#FFFCF7'; x.fillRect(0,0,W,H);
  drawShareSky_(x,W,H);

  // A single fine outer line, mirroring the on-screen card's asymmetric
  // radii. The dashed inner border that used to sit inside this (a
  // scrapbook/craft-paper "stitching" motif) is dropped entirely, and the
  // outer stroke itself thinned from 7px to 2.5px -- a card meant to be
  // screenshotted at phone-display size reads the old weight as a thick
  // cartoon outline, not a frame.
  x.strokeStyle='rgba(79,64,54,.5)'; x.lineWidth=2.5;
  roundRectPath(x,46,46,W-92,H-92,[132,30,120,30]);
  x.stroke();

  drawPostmark_(x,W,H);

  var cx=W/2;
  x.textAlign='center';

  x.fillStyle='#C9493B';
  x.font='700 30px Montserrat, sans-serif';
  x.fillText('ATENEO CELADON  \u00b7  RECWEEK 2026-2027', cx, 224);

  x.fillStyle='#4F4036';
  x.font='400 132px Bevan, Georgia, serif';
  x.fillText('Celaville', cx, 366);

  x.fillStyle='#6B5D51';
  x.font='600 38px Montserrat, sans-serif';
  x.fillText((P.name||'')+'’s Wrapped', cx, 436);

  // persona as the hero -- the redesign's one deliberate focal point, since
  // it's the most "you" fact on the card. Previously a boxed plaque with
  // ribbon tails; dropped after a real device screenshot still read the
  // box as off-centre even though the actual draw coordinates measured out
  // exactly symmetric (plaqueX + plaqueW/2 === cx, checked directly against
  // the canvas calls). Rather than keep chasing a rectangle whose edges
  // apparently don't LOOK centred even when they measurably ARE, drop the
  // rectangle: plain centred text has no edges to misjudge, and a short
  // centred rule below it is trivially symmetric by construction (it's
  // just a line from cx-70 to cx+70).
  var y=650;
  if(P.persona){
    var pColor=personaTextColor_(P.persona.color);

    // Small Kaiti glyph in the persona's own color, echoing the exact tag
    // the persona SLIDE itself shows (styles.css's .tag) -- the card then
    // reads as a callback to a moment the reader already saw, not a new
    // visual language invented just for the share image.
    x.font='400 52px "Kaiti SC","STKaiti","KaiTi","楷体",serif';
    x.fillStyle=pColor;
    x.fillText('乡', cx, y);
    y+=72;

    x.font='800 76px Grandstander, sans-serif';
    var pl=wrapText(x,P.persona.name,W-260);
    x.fillStyle=pColor;
    for(var i=0;i<pl.length;i++){ x.fillText(pl[i],cx,y); y+=88; }
    y+=6;
    x.strokeStyle=pColor; x.lineWidth=4; x.lineCap='round';
    x.beginPath(); x.moveTo(cx-70,y); x.lineTo(cx+70,y); x.stroke();
    y+=64;
  }

  // stat grid -- one card per category (department / rarest answer / showed
  // up / mahjong, plus whatever else shareStats() surfaces when one of those
  // is missing from this member's payload), each with its own icon and
  // brand-color wash instead of the old uniform dashed label/value rows.
  // 2 columns because 4 cards is the common case and a 2x2 grid is exactly
  // that -- an odd 5th card (when mahjong AND one of the lower-priority
  // stats both make shareStats()'s cut) just leaves the last row half full,
  // which is a normal grid, not a bug.
  var rows=shareStats().filter(function(r){ return r.key!=='persona'; });
  var COLORS={coral:'#D94F40',leaf:'#5E8F6B',sky:'#9FD0EB',yellow:'#E4B64A',sage:'#A8C59A',peach:'#F3BF8D'};
  var gx=140, gw=W-280, gap=22, colW=(gw-gap)/2, cardH=214;
  x.textAlign='left';
  rows.forEach(function(r,i){
    var col=i%2, row=Math.floor(i/2);
    var bx=gx+col*(colW+gap), by=y+row*(cardH+gap);
    var tint=COLORS[r.color]||'#6B5D51';

    // A thick solid ink border plus a floating ribbon tab straddling the
    // top edge read as a craft-paper sticker, not a stat tile -- the two
    // together were the single biggest source of the "plastic and
    // cartoony" read. Replaced with the language an actual premium stat
    // card uses: a near-hairline border (barely there, just enough to
    // separate the tile from the sky behind it), a quiet fill, and the
    // category color concentrated into one small icon swatch instead of
    // smeared across a whole tab.
    roundRectPath(x,bx,by,colW,cardH,[24,24,24,24]);
    x.fillStyle=hexA_(tint,.08); x.fill();
    x.strokeStyle='rgba(79,64,54,.16)'; x.lineWidth=1.5; x.stroke();

    // Icon swatch: a soft tint-colored disc, not a floating outlined glyph
    // -- the icon itself carries full-strength color against it instead of
    // needing its own heavy ink outline to read.
    var ix=bx+54, iy=by+58;
    x.beginPath(); x.arc(ix,iy,30,0,Math.PI*2);
    x.fillStyle=hexA_(tint,.24); x.fill();
    drawStatIcon_(x, r.key, ix, iy, 21, tint, '#4F4036');

    x.fillStyle='#8A7A6C'; x.font='700 20px Montserrat, sans-serif';
    x.fillText(r.label.toUpperCase(), bx+26, by+118);

    x.fillStyle='#4F4036'; x.font='800 32px Grandstander, sans-serif';
    var vl=wrapText(x,r.value,colW-52).slice(0,2);
    var vy=by+157;
    vl.forEach(function(l){ x.fillText(l,bx+26,vy); vy+=38; });
  });
  y += Math.ceil(rows.length/2)*(cardH+gap) + 6;

  // Footer CTA -- a flat paper pill/banner sitting directly below the stat
  // grid, not a white-outlined halo laid over the hills: the halo was a
  // legibility patch (any hill color underneath could wreck contrast), but
  // a flat vector storybook doesn't really do soft outer glows, so it read
  // as a sticker pasted over the scene. A plain ink-bordered paper pill
  // gets the same "legible regardless of what's behind it" property in the
  // same flat language every other surface on the card already uses.
  //
  // Strictly sequential from here down (content -> gap -> footer -> gap ->
  // hills -> card bottom) is deliberate: an earlier version measured the
  // footer/hills off a shared `sceneryTop` that was ALSO clamped to a fixed
  // fraction of the card height for a "big hills" guarantee, and the clamp
  // could end up ABOVE where a longer stat grid (5 stats -> 3 rows) had
  // actually finished drawing -- the footer and the last card visibly
  // overlapped. Chaining each element strictly off the previous one's
  // bottom edge makes that overlap impossible by construction; a short
  // grid still gets a big hill scene because nothing here pulls the hills
  // UP to a fixed y, only ever down from wherever content really ended.
  var footerW=W-260, footerH=132, footerGap=44;
  var footerTop=y+footerGap, footerCy=footerTop+footerH/2;
  var hasMahjong = rows.some(function(r){ return r.key==='mahjong'; });
  var sceneryTop = footerTop+footerH+footerGap;
  drawShareVillage_(x,W,H,sceneryTop,hasMahjong);

  roundRectPath(x, cx-footerW/2, footerCy-footerH/2, footerW, footerH, [30,10,26,10]);
  x.fillStyle='rgba(255,252,247,.94)'; x.fill();
  x.strokeStyle='rgba(79,64,54,.4)'; x.lineWidth=1.8; x.stroke();
  x.textAlign='center';
  x.fillStyle='#C9493B'; x.font='800 34px Grandstander, sans-serif';
  x.fillText('Start the next chapter with Celadon', cx, footerCy-14);
  x.fillStyle='#4F4036'; x.font='600 28px Montserrat, sans-serif';
  x.fillText('@ateneoceladon', cx, footerCy+38);
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

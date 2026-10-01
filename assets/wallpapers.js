/* ==========================================================================
   Wallpapers: generative, black and white, slow.
   One canvas behind the desktop. Every piece reads the live theme tokens
   (--bg, --ink) so light and dark both work, and can paint a still frame
   for the Settings picker.

   API   Wall.mount(el, id)   start drawing into el
         Wall.set(id)         switch piece
         Wall.thumb(id)       data: URL of a still frame
         Wall.list            [{id, name}]
   ========================================================================== */
(function(){
'use strict';
var TAU=Math.PI*2, clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var C={}, root=document.documentElement;

function hex(h){h=String(h).trim().replace('#','');if(h.length===3)h=h.replace(/./g,function(c){return c+c});var n=parseInt(h,16)||0;return[(n>>16)&255,(n>>8)&255,n&255]}
function rgba(h,a){var c=hex(h);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')'}
function readColors(){
  var s=getComputedStyle(root),g=function(n,d){return s.getPropertyValue(n).trim()||d};
  C.bg=g('--bg','#E7E7E7');C.surface=g('--surface','#fff');C.ink=g('--ink','#0A0A0A');C.ink2=g('--ink2','#666');
  var b=hex(C.bg);C.dark=(b[0]*.299+b[1]*.587+b[2]*.114)<110;
}
var MONO='"Geist Mono",ui-monospace,Menlo,monospace', SANS='"Geist","Helvetica Neue",Helvetica,Arial,sans-serif';
var FIXED=new Date(2026,0,1,10,9,36); // the still-frame time: 10:09:36, the classic

/* ---------- the pieces ---------- */
var P={};

/* GRID: a 104px module. The desktop tiles sit exactly on these lines.
   Crosses swell near the pointer; one scan line crosses; one orbit turns. */
P.grid={name:'Grid',fps:60,draw:function(x,w,h,t,S){
  x.fillStyle=C.bg;x.fillRect(0,0,w,h);
  var small=w<=760, step=small?(w-33)/4:104, m=small?16:24, top=40+m;
  var span=h-top, scanY=top+((t*26)%(span+160))-40, ptr=S.hasPtr;
  x.lineWidth=1;x.strokeStyle=rgba(C.ink,C.dark?.1:.12);x.beginPath();
  for(var gx=m+.5;gx<=w;gx+=step){x.moveTo(gx,top);x.lineTo(gx,h)}
  for(var gy=top+.5;gy<=h;gy+=step){x.moveTo(m,gy);x.lineTo(w,gy)}
  x.stroke();
  /* orbit */
  var ox=m+Math.round((w*.58-m)/step)*step, oy=top+Math.round((h*.5-top)/step)*step, r1=step*2, a=t*.11-1;
  x.strokeStyle=rgba(C.ink,.24);x.beginPath();x.arc(ox,oy,r1,0,TAU);x.stroke();
  x.strokeStyle=rgba(C.ink,.1);x.beginPath();x.arc(ox,oy,r1*1.5,0,TAU);x.stroke();
  x.strokeStyle=rgba(C.ink,.12);x.beginPath();x.moveTo(ox,oy);x.lineTo(ox+Math.cos(a)*r1,oy+Math.sin(a)*r1);x.stroke();
  x.fillStyle=C.ink;x.beginPath();x.arc(ox+Math.cos(a)*r1,oy+Math.sin(a)*r1,4,0,TAU);x.fill();
  /* scan line */
  var sg=x.createLinearGradient(0,scanY-60,0,scanY);sg.addColorStop(0,rgba(C.ink,0));sg.addColorStop(1,rgba(C.ink,.07));
  if(scanY>top){x.fillStyle=sg;x.fillRect(m,Math.max(top,scanY-60),w-m,Math.min(60,scanY-top));x.fillStyle=rgba(C.ink,.3);x.fillRect(m,scanY,w-m,1)}
  /* crosses */
  for(var cx=m;cx<=w;cx+=step){for(var cy=top;cy<=h;cy+=step){
    var k=0;
    if(ptr){var d=Math.hypot(S.mx-cx,S.my-cy);k=Math.max(k,clamp(1-d/170,0,1))}
    var ds=Math.abs(cy-scanY);k=Math.max(k,clamp(1-ds/70,0,1)*.9);
    var s=3+k*5;x.strokeStyle=rgba(C.ink,.3+k*.65);x.beginPath();
    x.moveTo(cx-s,cy+.5);x.lineTo(cx+s,cy+.5);x.moveTo(cx+.5,cy-s);x.lineTo(cx+.5,cy+s);x.stroke();
  }}
  /* ruler */
  x.font='500 9px '+MONO;x.fillStyle=rgba(C.ink,.38);x.textBaseline='alphabetic';
  for(var i=0,lx=m;lx<w-step*.5;i++,lx+=step){x.fillText((i<9?'0':'')+(i+1),lx+6,top-8)}
}};

/* HALFTONE: a lit sphere drawn in dots. The light orbits; the terminator moves. */
P.halftone={name:'Halftone',fps:30,draw:function(x,w,h,t,S){
  x.fillStyle=C.bg;x.fillRect(0,0,w,h);
  var p=Math.max(12,Math.sqrt(w*h/5200)), rh=p*.866, R=Math.min(w,h)*.37;
  var cx=w*.5+Math.sin(t*.06)*w*.025, cy=h*.56+Math.cos(t*.05)*h*.02;
  var a=t*.16+.8, lx=Math.cos(a)*.72, ly=Math.sin(a)*.72, lz=.52, ln=Math.hypot(lx,ly,lz);lx/=ln;ly/=ln;lz/=ln;
  x.fillStyle=C.ink;x.beginPath();
  for(var j=0,y=-p;y<h+p;j++,y+=rh){
    for(var xx=(j%2?p/2:0)-p;xx<w+p;xx+=p){
      var u=(xx-cx)/R,v=(y-cy)/R,d2=u*u+v*v,r;
      if(d2<1){var z=Math.sqrt(1-d2),lam=Math.max(0,u*lx+v*ly+z*lz),tone=C.dark?lam:1-lam;r=p*.5*(.05+.95*Math.pow(tone,1.1))}
      else{var d=Math.sqrt(d2),k=clamp(1-(d-1)*.8,0,1);r=p*.5*(.075+.09*k*k)}
      if(r>.4){x.moveTo(xx+r,y);x.arc(xx,y,r,0,TAU)}
    }
  }
  x.fill();
}};

/* SIGNAL: ridgelines, front over back. */
P.signal={name:'Signal',fps:30,draw:function(x,w,h,t,S){
  x.fillStyle=C.bg;x.fillRect(0,0,w,h);
  var N=Math.round(clamp(h/16,28,58)), top=h*.2, bot=h*.9, gap=(bot-top)/N, step=6, mid=w*.5, sw=w*.24;
  x.lineWidth=1.1;x.strokeStyle=rgba(C.ink,.92);x.lineJoin='round';
  for(var i=0;i<N;i++){
    var y0=top+i*gap, line=new Path2D();
    for(var px=-step,first=true;px<=w+step;px+=step){
      var e=Math.exp(-Math.pow((px-mid)/sw,2));
      var n=Math.sin(px*.012+i*.4+t*.42)*.5+Math.sin(px*.031-i*.23+t*.29)*.3+Math.sin(px*.057+i*.55-t*.6)*.2;
      var y=y0-Math.abs(n)*e*gap*4.4;
      if(first){line.moveTo(px,y);first=false}else line.lineTo(px,y);
    }
    var fill=new Path2D(line);fill.lineTo(w+step,y0+2);fill.lineTo(-step,y0+2);fill.closePath(); /* lines only peak upward, so occlusion needs just the band down to this line's own baseline */
    x.fillStyle=C.bg;x.fill(fill);x.stroke(line);
  }
}};

/* DIAL: the real time, drawn like a Braun face. */
P.dial={name:'Dial',fps:30,draw:function(x,w,h,t,S){
  x.fillStyle=C.bg;x.fillRect(0,0,w,h);
  var R=Math.min(w,h)*.4, cx=w*.62, cy=h*.54+20, d=S.still?FIXED:new Date();
  var sec=d.getSeconds()+d.getMilliseconds()/1000, min=d.getMinutes()+sec/60, hr=(d.getHours()%12)+min/60, i, an;
  x.lineCap='butt';
  /* dotted halo, turning slowly */
  x.fillStyle=rgba(C.ink,.3);x.beginPath();
  for(i=0;i<120;i++){an=i/120*TAU+t*.012;x.moveTo(cx+Math.cos(an)*R*1.12+1.2,cy+Math.sin(an)*R*1.12);x.arc(cx+Math.cos(an)*R*1.12,cy+Math.sin(an)*R*1.12,1.2,0,TAU)}
  x.fill();
  x.lineWidth=1;x.strokeStyle=rgba(C.ink,.9);x.beginPath();x.arc(cx,cy,R,0,TAU);x.stroke();
  x.strokeStyle=rgba(C.ink,.14);x.beginPath();x.arc(cx,cy,R*.64,0,TAU);x.stroke();
  x.beginPath();x.arc(cx,cy,R*.3,0,TAU);x.stroke();
  for(i=0;i<60;i++){
    an=i/60*TAU-Math.PI/2;var big=i%5===0,len=big?18:7;
    x.lineWidth=big?1.6:1;x.strokeStyle=rgba(C.ink,big?.95:.45);x.beginPath();
    x.moveTo(cx+Math.cos(an)*(R-len),cy+Math.sin(an)*(R-len));x.lineTo(cx+Math.cos(an)*R,cy+Math.sin(an)*R);x.stroke();
  }
  x.font='400 12px '+MONO;x.textAlign='center';x.textBaseline='middle';x.fillStyle=rgba(C.ink,.7);
  for(i=1;i<=12;i++){an=i/12*TAU-Math.PI/2;x.fillText(i<10?'0'+i:''+i,cx+Math.cos(an)*(R-44),cy+Math.sin(an)*(R-44))}
  x.textAlign='start';x.textBaseline='alphabetic';
  function hand(ang,len,tail,lw,col){var a=ang-Math.PI/2;x.lineWidth=lw;x.strokeStyle=col;x.lineCap='butt';x.beginPath();
    x.moveTo(cx-Math.cos(a)*tail,cy-Math.sin(a)*tail);x.lineTo(cx+Math.cos(a)*len,cy+Math.sin(a)*len);x.stroke()}
  hand(hr/12*TAU,R*.5,R*.06,5,rgba(C.ink,.95));
  hand(min/60*TAU,R*.8,R*.08,3,rgba(C.ink,.95));
  hand(sec/60*TAU,R*.92,R*.16,1.2,C.ink);
  x.fillStyle=C.bg;x.strokeStyle=C.ink;x.lineWidth=1.5;x.beginPath();x.arc(cx,cy,6,0,TAU);x.fill();x.stroke();
}};

/* AURA: soft grey light, drifting. */
P.aura={name:'Aura',fps:30,draw:function(x,w,h,t,S){
  x.fillStyle=C.bg;x.fillRect(0,0,w,h);
  var s=Math.max(w,h), lo=C.dark?C.surface:'#FFFFFF', hi=C.ink;
  var B=[[.050,.037,0,1.2,.62,lo,C.dark?.16:1],[.041,.058,2,.4,.58,hi,C.dark?.0:.34],[.033,.047,4,2.6,.7,lo,C.dark?.24:.95],[.062,.029,1,3.4,.5,hi,C.dark?.16:.30],[.027,.051,3,5.1,.6,lo,C.dark?.20:.85]];
  for(var i=0;i<B.length;i++){var b=B[i],cx=w*(.5+.42*Math.sin(t*b[0]+b[2])),cy=h*(.5+.38*Math.cos(t*b[1]+b[3])),g=x.createRadialGradient(cx,cy,0,cx,cy,b[4]*s);
    g.addColorStop(0,rgba(b[5],b[6]));g.addColorStop(1,rgba(b[5],0));x.fillStyle=g;x.fillRect(0,0,w,h)}
}};

/* TYPE: the name, enormous, in outline, sliding in opposite directions. */
var wide={};
P.type={name:'Type',fps:30,draw:function(x,w,h,t,S){
  x.fillStyle=C.bg;x.fillRect(0,0,w,h);
  var rows=3, sz=Math.round(h*.4), unit=Wall.text, font='500 '+sz+'px '+SANS;
  x.font=font;if('letterSpacing' in x)x.letterSpacing=(-sz*.06)+'px';
  var key=font+unit, tw=wide[key]||(wide[key]=x.measureText(unit+'   ').width);
  x.lineWidth=1.2;x.textBaseline='alphabetic';x.lineJoin='round';
  for(var r=0;r<rows;r++){
    var dir=r%2?1:-1, off=((t*(14+r*5)*dir)%tw+tw)%tw, y=h*.2+r*sz*.78+sz*.52;
    x.strokeStyle=rgba(C.ink,r===1?.9:.32);
    for(var px=-off-tw;px<w;px+=tw)x.strokeText(unit+'   ',px,y);
  }
}};

/* PAPER: nothing. */
P.paper={name:'Paper',fps:0,draw:function(x,w,h){x.fillStyle=C.bg;x.fillRect(0,0,w,h)}};

/* ---------- engine ---------- */
var ORDER=['grid','halftone','signal','dial','aura','type','paper'];
var cv=null, ctx=null, host=null, cur='grid', raf=0, last=0, W=0, H=0, dpr=1;
var S={mx:0,my:0,hasPtr:false,still:false};
var reduce=window.matchMedia('(prefers-reduced-motion: reduce)');

function motionOn(){var d=document.getElementById('desk');return !reduce.matches&&!(d&&d.dataset.motion==='off')&&!document.hidden}
function size(){
  if(!cv||!host)return;
  var r=host.getBoundingClientRect(), heavy=(cur==='halftone'||cur==='signal');
  dpr=Math.min(window.devicePixelRatio||1,heavy?1.5:2);
  W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
}
function paint(t){
  if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.globalAlpha=1;ctx.textAlign='start';
  P[cur].draw(ctx,W,H,t,S);
}
function frame(ts){
  raf=0;
  var p=P[cur], gap=p.fps?1000/p.fps:1e9;
  if(ts-last>=gap-2){last=ts;paint(ts/1000)}
  if(motionOn()&&p.fps)raf=requestAnimationFrame(frame);
}
function kick(){
  cancelAnimationFrame(raf);raf=0;
  paint(performance.now()/1000);
  if(motionOn()&&P[cur].fps)raf=requestAnimationFrame(frame);
}

var thumbs={};
var Wall={
  list:ORDER.map(function(id){return{id:id,name:P[id].name}}),
  text:'Rohan Kumar',
  get id(){return cur},
  mount:function(el,id){
    host=el;cv=document.createElement('canvas');cv.setAttribute('aria-hidden','true');
    el.innerHTML='';el.appendChild(cv);ctx=cv.getContext('2d');
    readColors();cur=P[id]?id:'grid';size();kick();
    if(window.ResizeObserver)new ResizeObserver(function(){size();kick()}).observe(el);else addEventListener('resize',function(){size();kick()});
    addEventListener('pointermove',function(e){S.mx=e.clientX;S.my=e.clientY;S.hasPtr=true},{passive:true});
    document.addEventListener('pointerleave',function(){S.hasPtr=false});
    document.addEventListener('visibilitychange',kick);
    var themeChanged=function(){readColors();kick()};
    new MutationObserver(themeChanged).observe(root,{attributes:true,attributeFilter:['data-theme']});
    var d=document.getElementById('desk');if(d)new MutationObserver(kick).observe(d,{attributes:true,attributeFilter:['data-motion']});
    var mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',themeChanged);
    if(reduce.addEventListener)reduce.addEventListener('change',kick);
    if(document.fonts&&document.fonts.load){Promise.all([document.fonts.load('500 40px Geist'),document.fonts.load('400 12px "Geist Mono"')]).then(function(){wide={};kick()}).catch(function(){})}
  },
  set:function(id){if(!P[id])id='grid';cur=id;size();kick()},
  thumb:function(id,tw,th){
    tw=tw||240;th=th||150;readColors();
    var ck=id+'|'+C.bg+'|'+C.ink;if(thumbs[ck])return thumbs[ck];
    var c=document.createElement('canvas');c.width=tw*2;c.height=th*2;var x=c.getContext('2d');
    x.setTransform(c.width/1440,0,0,c.height/900,0,0);
    var keep={still:S.still,hasPtr:S.hasPtr};S.still=true;S.hasPtr=false;
    P[id].draw(x,1440,900,id==='aura'?9:id==='grid'?14:id==='type'?4:id==='signal'?3:7,S);
    S.still=keep.still;S.hasPtr=keep.hasPtr;
    return thumbs[ck]=c.toDataURL('image/png');
  }
};
window.Wall=Wall;
})();

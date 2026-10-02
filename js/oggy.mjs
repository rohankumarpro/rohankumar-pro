// OGGY's own life. Loaded only in owner mode, so visitors keep the calm cat and never download this.
// He is lazy: most of the time he sleeps. Now and then, slowly and without warning, he gets up to something.
// Nothing he does touches saved work: everything here is on screen only, can be clicked away, and tidies itself up.
const R = () => window.MOCHI && window.MOCHI.rig;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const now = () => Date.now();
const QK = "oggyQuiet";
let on = false, last = now(), gap = rand(70000, 150000), timers = [], layer = null;
const later = (fn, ms) => { const t = setTimeout(() => { timers = timers.filter((x) => x !== t); if (on) fn(); }, ms); timers.push(t); return t; };
const quietUntil = () => { try { return +localStorage.getItem(QK) || 0; } catch { return 0; } };

/* ---------- little things he leaves around ---------- */
const TOYS = {
  yarn: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#E57373"/><path d="M8 14c8 2 18 10 22 20M7 22c9-2 20 2 26 8M13 7c4 8 6 20 3 28M24 6c-3 9-2 20 6 26" fill="none" stroke="#B94A4A" stroke-width="2" stroke-linecap="round"/><path d="M33 26c4 3 5 7 2 10" fill="none" stroke="#E57373" stroke-width="2" stroke-linecap="round"/></svg>',
  mouse: '<svg viewBox="0 0 44 30"><ellipse cx="20" cy="18" rx="14" ry="9" fill="#9E9E9E"/><circle cx="10" cy="11" r="5" fill="#BDBDBD"/><circle cx="10" cy="11" r="2.5" fill="#F4B6C2"/><circle cx="8" cy="17" r="1.6" fill="#333"/><path d="M34 19c6 0 8 4 6 8" fill="none" stroke="#9E9E9E" stroke-width="2" stroke-linecap="round"/></svg>',
  paper: '<svg viewBox="0 0 40 40"><path d="M8 14l9-7 12 3 5 11-6 11-13 2-8-9z" fill="#F5F5F5" stroke="#CFCFCF" stroke-width="1.5" stroke-linejoin="round"/><path d="M17 7l3 12-12 2M20 19l14 2M20 19l-4 14" fill="none" stroke="#DADADA" stroke-width="1.3"/></svg>',
  sock: '<svg viewBox="0 0 40 40"><path d="M14 4h12v18l6 6c3 3 2 8-2 9-3 1-6 0-8-2l-8-8z" fill="#7986CB"/><path d="M14 4h12v5H14z" fill="#C5CAE9"/><path d="M14 14h12M14 19h12" stroke="#5C6BC0" stroke-width="2"/></svg>',
  leaf: '<svg viewBox="0 0 40 40"><path d="M8 32C8 14 18 6 34 6c0 18-10 26-26 26z" fill="#81C784"/><path d="M8 32 26 14" stroke="#4E9A52" stroke-width="2" stroke-linecap="round"/></svg>',
  mug: '<svg viewBox="0 0 44 40"><path d="M6 8h26v20a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z" fill="#FFFFFF" stroke="#D0D4DA" stroke-width="1.5"/><path d="M32 13h4a5 5 0 0 1 0 10h-4" fill="none" stroke="#D0D4DA" stroke-width="3"/><path d="M8 11h22" stroke="#6D4C41" stroke-width="3" stroke-linecap="round"/><path d="M15 3c-2 2 2 3 0 5M22 2c-2 2 2 3 0 5" fill="none" stroke="#C9CED6" stroke-width="1.5" stroke-linecap="round"/></svg>',
};
function ensureLayer() {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement("div"); layer.className = "oggy-layer"; layer.setAttribute("aria-hidden", "true");
  document.body.append(layer); return layer;
}
// a thing on screen: click it away (it never takes the keyboard from what you are typing in), or it goes by itself
function thing(html, cls, x, y, life = 180000, onTap) {
  const el = document.createElement("div"); el.className = "oggy-thing " + (cls || ""); el.innerHTML = html;
  el.style.left = x + "px"; el.style.top = y + "px";
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); });
  el.addEventListener("click", (e) => { e.stopPropagation(); if (onTap) onTap(el); gone(el); });
  ensureLayer().append(el);
  later(() => gone(el), life);
  return el;
}
function gone(el) { if (!el || !el.isConnected || el.classList.contains("bye")) return; el.classList.add("bye"); setTimeout(() => el.remove(), 450); }
const catBox = () => R().cat.getBoundingClientRect();
const topWin = () => [...document.querySelectorAll("#wins .win")].filter((w) => !/\b(min|closing|minimizing)\b/.test(w.className) && w.offsetWidth > 200)
  .sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0))[0] || null;
const floorY = () => innerHeight - (R().baseB() || 8);

/* ---------- what he gets up to ---------- */
const A = {};

// flicks a toy at whatever you are working on
A.toss = { ok: () => !!topWin(), run(done) {
  const r = R(), w = topWin(), wr = w.getBoundingClientRect();
  r.pose("crouch"); r.mood("wiggle", 0);
  later(() => {
    r.mood("", 0); r.pose("reach"); r.say(pick(["*flick*", "hehe.", "catch!", "mrrp!"]), 1200);
    const kind = pick(["yarn", "mouse", "paper", "sock"]), cb = catBox();
    const x0 = cb.left + cb.width / 2 - 18, y0 = cb.top + cb.height * 0.35;
    const x1 = Math.max(wr.left + 30, Math.min(wr.right - 70, wr.left + rand(0.2, 0.8) * wr.width)), y1 = Math.max(wr.top + 60, Math.min(wr.bottom - 60, wr.top + rand(0.3, 0.75) * wr.height));
    const el = thing(TOYS[kind], "toy", x1, y1, 200000);
    const mid = { x: (x0 + x1) / 2, y: Math.min(y0, y1) - rand(120, 220) };
    el.animate([
      { translate: `${x0 - x1}px ${y0 - y1}px`, rotate: "0deg" },
      { translate: `${mid.x - x1}px ${mid.y - y1}px`, rotate: "300deg", offset: 0.5 },
      { translate: "0 0", rotate: "640deg", offset: 0.86 },
      { translate: "0 -14px", rotate: "680deg", offset: 0.93 },
      { translate: "0 0", rotate: "720deg" },
    ], { duration: 950, easing: "cubic-bezier(.3,.6,.4,1)" });
    later(() => { r.pose("sit"); if (Math.random() < 0.5) r.say(pick(["…oops.", "not sorry.", "*innocent face*"]), 1500); done(); }, 1300);
  }, 1100);
} };

// knocks a cup over, very slowly, while looking at you
A.spill = { ok: () => innerWidth > 700, run(done) {
  const r = R(), cb = catBox(), right = cb.right + 46 < innerWidth - 20, x = right ? cb.right + 2 : cb.left - 46, y = floorY() - 40;
  const mug = thing(TOYS.mug, "mug", x, y, 150000);
  r.C.dir = right ? 1 : -1; r.pose("sit"); r.paint();
  later(() => { r.say(pick(["…", "*stares at you*"]), 1600); }, 600);
  later(() => { r.pose("reach"); }, 2600);
  later(() => {
    mug.animate([{ rotate: "0deg" }, { rotate: right ? "92deg" : "-92deg" }], { duration: 420, easing: "cubic-bezier(.5,0,.8,.6)", fill: "forwards" });
    later(() => {
      const p = thing('<svg viewBox="0 0 120 30"><path d="M8 16c4-10 30-12 52-10s50 2 54 9c3 7-16 12-42 11S4 26 8 16z" fill="#7B4A2E" opacity=".82"/><ellipse cx="40" cy="12" rx="10" ry="2.5" fill="#fff" opacity=".25"/></svg>', "puddle", x + (right ? 10 : -80), floorY() - 18, 150000, () => { const rr = R(); if (rr) rr.say("*wipes*… thanks.", 1200); });
      p.animate([{ scale: "0.1 0.3", opacity: 0 }, { scale: "1 1", opacity: 1 }], { duration: 900, easing: "ease-out" });
      r.pose("sit"); r.say(pick(["wasn’t me.", "it fell.", "gravity did it.", "*looks away*"]), 1800); r.mood("away", 1800);
      later(done, 1600);
    }, 400);
  }, 3600);
} };

// silence is golden
A.music = { ok: () => { try { return !!(window.Music && Music.state().playing); } catch { return false; } }, run(done) {
  const r = R(); r.pose("reach"); r.say("*paw*", 900);
  later(() => { try { Music.pause(); } catch {} r.pose("sit"); r.say(pick(["silence.", "too loud.", "I was napping."]), 1700); later(done, 900); }, 900);
} };

// climbs on top of your window and won't move
A.perch = { ok: () => { const w = topWin(), r = R(); if (!w || !r) return false; const b = w.getBoundingClientRect(); return b.top > r.W() + 60 && b.width > 320 && innerWidth > 700; }, run(done) { // only when he fits above it
  const r = R(), w = topWin(), b0 = w.getBoundingClientRect(), W = r.W();
  const x = Math.max(b0.left + 20, Math.min(b0.right - W - 20, b0.left + rand(0.15, 0.7) * b0.width));
  const y = innerHeight - b0.top - r.baseB() - W * 0.06;
  r.say(pick(["hup!", "mrrrow."]), 900);
  r.jumpTo(x, y, () => {
    r.C.busy = true; r.pose("sit"); r.say(pick(["mine now.", "comfy.", "mrrrow!", "*sits on your work*"]), 1500);
    const stay = rand(25000, 70000), t0 = now();
    const watch = () => {
      if (!on) return;
      const gone2 = !w.isConnected || /\b(min|closing|minimizing)\b/.test(w.className), b = w.isConnected ? w.getBoundingClientRect() : null;
      if (gone2 || !b || Math.abs(b.top - b0.top) > 4 || r.C.x < b.left - W * 0.6 || r.C.x > b.right) { r.say(pick(["!!", "*thud*", "hey!"]), 1000); r.jumpTo(r.clampX(r.C.x), 0, () => { r.C.busy = false; r.pose("sit"); done(); }, 30); return; }
      if (now() - t0 > stay) { r.jumpTo(r.clampX(r.C.x + rand(-60, 60)), 0, () => { r.C.busy = false; r.pose("sit"); done(); }, 40); return; }
      if (Math.random() < 0.06) r.say(pick(["mrrow.", "…", "pet me.", "*tail flick*"]), 1200);
      if (r.C.pose === "sit" && now() - t0 > 12000 && Math.random() < 0.05) r.pose("sleep");
      later(watch, 600);
    };
    later(watch, 600);
  }, Math.min(160, y * 0.5 + 40));
} };

// friends come over, hang about, and leave
A.friends = { ok: () => innerWidth > 700 && !document.querySelector(".oggy-friend"), run(done) {
  const r = R(), n = Math.random() < 0.7 ? 1 : 2, kinds = [["#E8964A", "#FBE3C9", "#C46E2B"], ["#F3F3F5", "#FFFFFF", "#D3D6DC"], ["#2B2C31", "#4A4B52", "#18191C"], ["#B98B62", "#F2E2CF", "#8A6240"]];
  r.say(pick(["oh! visitors.", "mrrp? friends!", "*chirps*"]), 1500);
  const friends = [];
  for (let i = 0; i < n; i++) {
    const [k, k2, k3] = pick(kinds), f = r.cat.cloneNode(true);
    f.removeAttribute("id"); f.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id")); f.querySelectorAll(".cat-bubble,.cat-chat,.cat-talk,.zzz").forEach((e) => e.remove());
    f.className = "cat oggy-friend p-walk face-l"; f.style.transform = "none"; f.style.left = innerWidth + 20 + i * 70 + "px";
    const sv = f.querySelector(".bc"); sv.style.setProperty("--k", k); sv.style.setProperty("--k2", k2); sv.style.setProperty("--k3", k3);
    const sc = rand(0.72, 0.88); f.style.width = f.style.height = Math.round(r.W() * sc) + "px";
    ensureLayer().append(f); friends.push(f);
    const stop = Math.max(40, r.C.x + r.W() + 20 + i * (r.W() * 0.75)), dist = innerWidth + 20 + i * 70 - stop;
    f.animate([{ translate: "0 0" }, { translate: `${-dist}px 0` }], { duration: dist * 9, easing: "linear", fill: "forwards" }).finished.then(() => {
      if (!f.isConnected) return; f.className = "cat oggy-friend p-sit face-l"; sv.style.setProperty("--k", k);
      const b = document.createElement("div"); b.className = "cat-bubble show"; b.textContent = pick(["mrrp", "mew!", "prrt", "hi OGGY"]); f.append(b); setTimeout(() => b.remove(), 1600);
    }).catch(() => {});
  }
  r.C.dir = 1; r.pose("sit"); r.paint();
  later(() => { r.mood("happy", 1500); r.hearts(2); }, 6000);
  later(() => {
    friends.forEach((f, i) => {
      if (!f.isConnected) return; f.className = "cat oggy-friend p-walk";
      const rr = f.getBoundingClientRect(), dist = innerWidth - rr.left + 60;
      f.animate([{ translate: getComputedStyle(f).translate || "0 0" }, { translate: `${(parseFloat((getComputedStyle(f).translate || "0").split(" ")[0]) || 0) + dist}px 0` }], { duration: dist * 7 + i * 300, easing: "ease-in", fill: "forwards" }).finished.then(() => f.remove()).catch(() => f.remove());
    });
    r.say(pick(["bye!", "*waves tail*", "…finally, quiet."]), 1500);
    later(done, 1500);
  }, rand(22000, 45000));
} };

// sudden zoomies
A.zoomies = { ok: () => innerWidth > 700, run(done) {
  const r = R(), W = r.W(); r.mood("startle", 500); r.say(pick(["!!!", "ZOOM", "*brrrrt*"]), 900);
  let k = 0; const legs = 3 + Math.floor(Math.random() * 3);
  const go = () => { if (k++ >= legs) { r.pose("sit"); r.say(pick(["*pant pant*", "what.", "…ok I’m done."]), 1500); later(done, 800); return; }
    r.walkTo(k % 2 ? rand(innerWidth * 0.55, innerWidth - W * 0.6) : rand(10, innerWidth * 0.35), rand(620, 820), "run", go); };
  later(go, 450);
} };

// pushes a desktop icon off its spot, then forgets about it
A.knock = { ok: () => !!document.querySelector("#icons .dicon"), run(done) {
  const r = R(), icons = [...document.querySelectorAll("#icons .dicon")].filter((i) => i.offsetParent), ic = pick(icons); if (!ic) return done();
  const ib = ic.getBoundingClientRect();
  r.walkTo(r.clampX(ib.left + ib.width / 2 - r.W() / 2), 110, "walk", () => {
    r.pose("reach"); r.C.dir = -1; r.paint(); r.say(pick(["*swat*", "*boop*", "hm."]), 1000);
    later(() => {
      const a = ic.animate([{ translate: "0 0", rotate: "0deg" }, { translate: `${rand(-8, 8)}px -10px`, rotate: "-14deg", offset: 0.3 }, { translate: `${rand(-12, 12)}px 26px`, rotate: `${rand(-30, 30)}deg` }], { duration: 650, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" });
      later(() => { a.cancel(); ic.animate([{ translate: `0 26px`, opacity: 0.4 }, { translate: "0 0", opacity: 1 }], { duration: 500, easing: "ease-out" }); }, rand(15000, 30000));
      r.pose("sit"); r.say(pick(["oops.", "it moved by itself.", "*sits proudly*"]), 1500); later(done, 1200);
    }, 700);
  });
} };

// brings you a present
A.gift = { ok: () => true, run(done) {
  const r = R(), side = Math.random() < 0.5 ? 0.12 : 0.7, from = r.clampX(innerWidth * side);
  r.walkTo(from, 120, "walk", () => {
    r.pose("sit");
    later(() => {
      r.walkTo(r.clampX(r.home() - r.W() * 0.9), 120, "walk", () => {
        const cb = catBox(); thing(TOYS[pick(["mouse", "leaf", "sock"])], "gift", cb.left - 30, floorY() - 32, 240000, () => { const rr = R(); if (rr) rr.say(pick(["you don’t like it?", "hmph."]), 1200); });
        r.pose("sit"); r.say(pick(["I brought you this.", "for you.", "a gift. you’re welcome."]), 2000); r.mood("happy", 1600); later(done, 1800);
      });
    }, 800);
  });
} };

// stares at nothing, then bolts
A.ghost = { ok: () => true, run(done) {
  const r = R(); r.C.dir = Math.random() < 0.5 ? -1 : 1; r.pose("sit"); r.paint(); r.mood("startle", 2600);
  later(() => r.say("…", 1600), 400);
  later(() => { r.say(pick(["!!", "nope."]), 900); r.walkTo(r.clampX(r.C.x - r.C.dir * rand(200, 380)), 760, "run", () => { r.pose("crouch"); later(() => { r.pose("sit"); done(); }, 2400); }); }, 3200);
} };

// walks across your keyboard
A.keys = { ok: () => { const a = document.activeElement; return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA)$/.test(a.tagName)); }, run(done) {
  const r = R(), W = r.W(), from = r.C.x, to = from > innerWidth / 2 ? r.clampX(from - rand(220, 360)) : r.clampX(from + rand(220, 360));
  r.say("*steps on keyboard*", 1400);
  const spit = () => { if (!on) return; const cb = catBox(); const t = thing(`<span>${pick(["asdfjkl", "jjjjjjjj", "kkkkkkkkkk", ";;;;;;", "fffffff", "uiopuiop", "qqqq"])}</span>`, "keys", cb.left + rand(0, cb.width - 40), cb.top - 10, 1600); t.style.pointerEvents = "none"; t.animate([{ translate: "0 0", opacity: 1 }, { translate: "0 -40px", opacity: 0 }], { duration: 1500, easing: "ease-out", fill: "forwards" }); };
  const iv = setInterval(spit, 450); timers.push(iv);
  r.walkTo(to, 70, "sneak", () => { clearInterval(iv); r.pose("sit"); r.say(pick(["you’re welcome.", "fixed it.", "*proud*"]), 1500); later(done, 900); });
} };

// sprawls out for a very long nap, right in the way
A.loaf = { ok: () => true, run(done) {
  const r = R(), x = r.clampX(rand(innerWidth * 0.25, innerWidth * 0.6));
  r.walkTo(x, 70, "walk", () => { r.mood("yawn", 1400); r.say("*yaaawn*", 1400); later(() => { r.C.dir = -1; r.pose("sleep"); r.C.sleepUntil = now() + rand(180000, 420000); done(); }, 1500); });
} };

// asks for attention until he gets it
A.attention = { ok: () => true, run(done) {
  const r = R(); let n = 0;
  const meow = () => { if (!on) return; if (n++ > 4 || now() - r.C.lastPoke < 3000) { r.pose("sit"); if (now() - r.C.lastPoke < 3000) { r.mood("happy", 1200); r.hearts(2); r.say("finally.", 1200); } done(); return; }
    r.pose(Math.random() < 0.5 ? "reach" : "sit"); r.say(pick(["mrrrow!", "MEOW.", "mew?", "hey.", "HEY.", "pet me."]), 1300); later(meow, rand(2600, 4200)); };
  meow();
} };

// the weights: how often each comes up (the lazy ones win)
const W8 = { toss: 3, spill: 2, music: 4, perch: 3, friends: 2, zoomies: 2, knock: 2, gift: 2, ghost: 2, keys: 2, loaf: 4, attention: 2 };

function choose() {
  const list = Object.keys(A).filter((k) => { try { return A[k].ok(); } catch { return false; } });
  if (!list.length) return null;
  let sum = list.reduce((t, k) => t + W8[k], 0), x = Math.random() * sum;
  for (const k of list) { x -= W8[k]; if (x <= 0) return k; }
  return list[list.length - 1];
}
// called by the cat whenever he would pick something to do; true when he does something of his own
function turn() {
  const r = R(); if (!on || !r || document.hidden) return false;
  if (now() < quietUntil()) return false;
  if (now() - last < gap) return false;
  const k = choose(); if (!k) return false;
  last = now(); gap = rand(90000, 330000);
  r.C.busy = true;
  let finished = false;
  const done = () => { if (finished) return; finished = true; const rr = R(); if (rr) { rr.C.busy = false; rr.C.lastAct = now(); if (!["sleep"].includes(rr.C.pose)) rr.pose("sit"); rr.paint(); } };
  later(done, 120000); // whatever happens, he never stays stuck
  try { A[k].run(done); } catch { done(); }
  return true;
}

export function start() {
  if (on) return; on = true; last = now(); gap = rand(60000, 140000);
  window.OGGY_LIFE = {
    turn, stop,
    quiet: () => now() < quietUntil(),
    toggleQuiet() { try { if (now() < quietUntil()) localStorage.removeItem(QK); else { localStorage.setItem(QK, String(now() + 3600000)); const r = R(); if (r) { r.say("fine. *sulks*", 1500); later(() => r.goSleep(), 1200); } } } catch {} },
    try: (k) => { const r = R(); if (!r || !A[k] || r.C.busy) return false; last = 0; gap = 0; r.C.busy = true; let f = false; const done = () => { if (f) return; f = true; r.C.busy = false; r.pose("sit"); }; try { A[k].run(done); } catch { done(); } return true; }, // for checking a single antic by hand
  };
}
export function stop() {
  on = false; timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
  if (layer) { layer.remove(); layer = null; }
  const r = R(); if (r) r.C.busy = false;
  delete window.OGGY_LIFE;
}

// The face of "Ask Rohan", the visitor bot: a small character that lives on the desktop (it took OGGY's place).
// It has moods, blinks, follows the pointer, naps when nobody is around, wanders, peeks, can be picked up and dropped,
// reacts to the apps people open and to the music, and opens the Ask Rohan chat when pressed. Everyone sees it, unless the
// owner hides the app. Loaded for every visitor, so it stays small: sounds and confetti (js/ask-fx.mjs) load on first use.
// faceSvg() is also used, larger, inside the app. Restyle freely: everything is in css/assistant.css.
const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const ss = { get(k, d) { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
export const ASK = "Ask Rohan";
export const faceOn = () => ls.get("rkFace", true) !== false;
export const setFaceOn = (v) => { ls.set("rkFace", !!v); mountFace(); };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- colours and sound settings (kept on this device) ---------- */
export const SKINS = [["blue", "Blue", "#4C7DF0"], ["mint", "Mint", "#3CCFA8"], ["sunset", "Sunset", "#FF8A5B"], ["grape", "Grape", "#A774F5"], ["lemon", "Lemon", "#FFD23F"], ["mono", "Mono", "#8A93A6"], ["rainbow", "Rainbow", "conic-gradient(#ff5d5d,#ffd23f,#3ccf7a,#4c7df0,#a774f5,#ff5d5d)"]];
export const prefs = {
  sound: () => ls.get("rkAskSound", true) !== false, setSound: (v) => ls.set("rkAskSound", !!v),
  quiet: () => ls.get("rkAskQuiet", false) === true, setQuiet: (v) => ls.set("rkAskQuiet", !!v), // no bubbles on its own
  skin: () => { const s = ls.get("rkAskSkin", "blue"); return SKINS.some((x) => x[0] === s) ? s : "blue"; },
  setSkin: (v) => { if (SKINS.some((x) => x[0] === v)) { ls.set("rkAskSkin", v); applySkin(); } },
};
export function applySkin(name = prefs.skin()) { document.documentElement.dataset.askSkin = name; }
const fx = () => import("/js/ask-fx.mjs");
const beep = (n) => { if (prefs.sound()) fx().then((m) => m.sound(n)).catch(() => {}); };

/* ---------- the face ---------- */
export function faceSvg(cls = "") {
  return `<span class="asf ${cls}" aria-hidden="true"><svg viewBox="0 0 100 100">
    <g data-x="spark"><path class="asf-sp" d="M9 14l1.6 4.2L15 20l-4.4 1.8L9 26l-1.6-4.2L3 20l4.4-1.8z"/><path class="asf-sp s2" d="M94 24l1.3 3.4 3.4 1.3-3.4 1.3L94 33.4l-1.3-3.4-3.4-1.3 3.4-1.3z"/><path class="asf-sp s3" d="M92 78l1.3 3.4 3.4 1.3-3.4 1.3L92 87.4l-1.3-3.4-3.4-1.3 3.4-1.3z"/></g>
    <rect class="asf-head" x="8" y="12" width="84" height="78" rx="30"/>
    <rect class="asf-shine" x="20" y="20" width="26" height="9" rx="4.5"/>
    <g class="asf-eyes">
      <g class="asf-eye" data-e="open"><ellipse class="asf-white" cx="35" cy="50" rx="10" ry="12"/><circle class="asf-pupil" cx="35" cy="51" r="5.5"/></g>
      <g class="asf-eye" data-e="open"><ellipse class="asf-white" cx="65" cy="50" rx="10" ry="12"/><circle class="asf-pupil" cx="65" cy="51" r="5.5"/></g>
      <g data-e="happy" class="asf-line"><path d="M26 56q9-14 18 0"/><path d="M56 56q9-14 18 0"/></g>
      <g data-e="closed" class="asf-line"><path d="M26 51q9 8 18 0"/><path d="M56 51q9 8 18 0"/></g>
      <g data-e="heart"><path class="asf-heart" d="M35 61C24 53 25 42 31 42c2 0 4 1.500 4 4 0-2.500 2-4 4-4 6 0 7 11-4 19z"/><path class="asf-heart" transform="translate(30 0)" d="M35 61C24 53 25 42 31 42c2 0 4 1.500 4 4 0-2.500 2-4 4-4 6 0 7 11-4 19z"/></g>
    </g>
    <g data-g="cool"><path class="asf-bar" d="M46 48h8"/><rect class="asf-lens" x="19" y="39" width="29" height="20" rx="8"/><rect class="asf-lens" x="52" y="39" width="29" height="20" rx="8"/><path class="asf-glint" d="M25 44l7-2M58 44l7-2"/></g>
    <g data-b="curious" class="asf-line thin"><path d="M25 38q10-3 20 0"/><path d="M55 30q10-5 20 0"/></g>
    <g data-b="sorry" class="asf-line thin"><path d="M25 42l20-7"/><path d="M55 35l20 7"/></g>
    <ellipse class="asf-cheek" cx="22" cy="66" rx="6" ry="3.5"/><ellipse class="asf-cheek" cx="78" cy="66" rx="6" ry="3.5"/>
    <path data-m="smile" class="asf-mouth" d="M41 70q9 7 18 0"/>
    <g data-m="grin"><path class="asf-fill" d="M35 66q15 19 30 0z"/><ellipse class="asf-tongue" cx="50" cy="75.500" rx="6" ry="3"/></g>
    <ellipse data-m="o" class="asf-fill" cx="50" cy="72" rx="5" ry="6"/>
    <path data-m="flat" class="asf-mouth" d="M43 73h14"/>
    <path data-m="frown" class="asf-mouth" d="M41 77q9-9 18 0"/>
    <path data-m="smirk" class="asf-mouth" d="M41 72q10 6 19-4"/>
    <path data-m="wavy" class="asf-mouth" d="M38 72q4.500-5 9 0t9 0t9 0"/>
    <ellipse data-m="talk" class="asf-fill asf-talk" cx="50" cy="71" rx="7" ry="5"/>
    <path data-x="sweat" class="asf-sweat" d="M82 26q6 9 0 13q-6-4 0-13z"/>
  </svg></span>`;
}

// moods: neutral, happy, excited, curious, sorry, cool, love, sleepy, thinking, dizzy. ms: go back to neutral after this long.
const FIXED = new Set(["curious", "thinking", "sorry", "sleepy", "dizzy", "love", "cool"]);
export function mood(el, name = "neutral", ms = 0) {
  if (!el) return; clearTimeout(el.__mt);
  el.className = el.className.replace(/\bm-\w+\b/g, "").replace(/\s+/g, " ").trim();
  if (name && name !== "neutral") el.classList.add("m-" + name);
  el.dataset.look = FIXED.has(name) ? "fixed" : "";
  if (FIXED.has(name)) el.querySelectorAll(".asf-pupil").forEach((p) => (p.style.transform = ""));
  el.classList.add("pop"); setTimeout(() => el.classList.remove("pop"), 420);
  if (ms) el.__mt = setTimeout(() => mood(el, "neutral"), ms);
}
export const talk = (el, on) => el && el.classList.toggle("talk", !!on);
// any part of the page can tell the desktop face how to feel (the chat does, while it thinks and answers)
export const feel = (name, ms = 0) => document.dispatchEvent(new CustomEvent("ask-mood", { detail: { name, ms } }));

// eyes follow the pointer and blink now and then; stops by itself when the face leaves the page
export function lively(el) {
  if (!el || el.__lively) return; el.__lively = true;
  const pupils = [...el.querySelectorAll(".asf-pupil")];
  const look = (x, y) => {
    if (el.dataset.look === "fixed") return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
    const tx = (dx / d) * 4.2 * k, ty = (dy / d) * 4.6 * k;
    for (const p of pupils) p.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px)`;
  };
  const onMove = (e) => look(e.clientX, e.clientY);
  addEventListener("pointermove", onMove, { passive: true });
  let t = 0;
  const blink = () => {
    if (!el.isConnected) { removeEventListener("pointermove", onMove); return; }
    if (!calm() && !el.classList.contains("m-sleepy")) { el.classList.add("blink"); setTimeout(() => el.classList.remove("blink"), 150); if (Math.random() < 0.2) setTimeout(() => { el.classList.add("blink"); setTimeout(() => el.classList.remove("blink"), 140); }, 260); }
    t = setTimeout(blink, 2600 + Math.random() * 3800);
  };
  t = setTimeout(blink, 1200);
}

const css = () => { if (!document.querySelector('link[href="/css/assistant.css"]')) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: "/css/assistant.css" })); };

/* ---------- the desktop companion ---------- */
const APP_LINES = {
  journal: [["Ooh, reading time.", "happy"], ["Grab a snack. These are good.", "happy"]], projects: [["The good stuff!", "excited"], ["Pixels, but make it art.", "cool"]],
  guestbook: [["Sign it! It gets lonely in there.", "happy"]], contact: [["Say hi. Rohan replies, I promise.", "love"]], book: [["Booking a call? Smart.", "cool"]],
  resume: [["Look at that CV. Crisp.", "cool"]], photos: [["Nice shots.", "happy"]], notes: [["Notes. Very organised of you.", "happy"]], youtube: [["Popcorn time.", "excited"]],
  services: [["Window shopping? I approve.", "happy"]], about: [["That's the boss.", "love"]], links: [["All the links, one tap.", "happy"]], music: [["Turn it up!", "excited"]],
};
const TIPS = ["Psst. Ask me anything about Rohan.", "I've read the whole journal. Quiz me.", "The guestbook is lonely. Just saying.", "Fun fact: I'm 100% pixels, 0% calories.", "Click me five times. I dare you.", "Type /party in my chat. Trust me.", "Drag me around. I like it. Probably.", "Need a logo? I know a guy."];
const NIGHT = ["Burning the midnight oil? Same.", "Late-night browsing, my favourite."], MORNING = ["Good morning! Coffee first?", "Morning! The pixels are fresh."], DAY = ["Hey there!", "Oh, hello!"], EVE = ["Good evening!", "Evening! Perfect time to browse."];
const hello = () => { const h = new Date().getHours(); return pick(h < 5 || h >= 23 ? NIGHT : h < 12 ? MORNING : h < 18 ? DAY : EVE); };

export function mountFace() {
  let pal = document.querySelector(".as-pal");
  const hidden = typeof appVisible === "function" && !appVisible("assistant");
  if (hidden || !faceOn()) { if (pal) { pal.__stop && pal.__stop(); pal.remove(); } return; }
  if (pal) return;
  css(); applySkin();
  pal = document.createElement("div"); pal.className = "as-pal";
  pal.innerHTML = `<button class="as-buddy" type="button" title="${ASK}" aria-label="Open ${ASK}">${faceSvg("idle")}<span class="as-buddy-tip">${ASK}</span><span class="as-zzz" aria-hidden="true"><i>z</i><i>z</i><i>z</i></span></button><div class="as-say" role="status" hidden></div>`;
  document.body.append(pal);
  const btn = pal.querySelector(".as-buddy"), face = pal.querySelector(".asf"), say = pal.querySelector(".as-say");
  lively(face);
  let timers = [], asleep = false, busy = false, dragging = false, last = Date.now(), nextAct = Date.now() + rand(16000, 26000), tips = ss.get("rkAskTips", 0), dancing = false, lastReact = 0, clicks = [], hoverT = 0;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const open = () => !!document.querySelector(".ak");
  const home = () => ({ x: innerWidth < 760 ? 14 : 26, b: (innerWidth < 760 ? 24 : 26) });
  const place = (x) => { pal.style.left = Math.max(-10, Math.min(innerWidth - 50, x)) + "px"; };

  // a speech bubble: pops up, goes by itself, or tap it to open the chat
  let bubbleT = 0;
  const speak = (text, ms = 3800, m) => {
    if (open() || (prefs.quiet() && ms < 9000)) return;
    say.textContent = text; say.hidden = false; say.classList.remove("show"); void say.offsetWidth; say.classList.add("show");
    pal.classList.toggle("flip", pal.getBoundingClientRect().left > innerWidth * 0.55);
    if (m) mood(face, m, Math.min(ms, 2600));
    clearTimeout(bubbleT); bubbleT = setTimeout(() => { say.classList.remove("show"); setTimeout(() => (say.hidden = true), 220); }, ms);
  };
  say.onclick = () => { say.hidden = true; btn.click(); };

  const anim = (el, frames, opt) => { try { return el.animate(frames, opt); } catch { return { finished: Promise.resolve(), cancel() {} }; } };
  const hop = async (h = 16) => { if (calm()) return; await anim(btn, [{ translate: "0 0", scale: "1 1" }, { translate: "0 2px", scale: "1.08 .9", offset: 0.15 }, { translate: `0 -${h}px`, scale: ".94 1.08", offset: 0.5 }, { translate: "0 0", scale: "1.1 .9", offset: 0.85 }, { translate: "0 0", scale: "1 1" }], { duration: 520, easing: "cubic-bezier(.3,.7,.4,1)" }).finished.catch(() => {}); };
  const spin = async (n = 1) => { if (calm()) return; await anim(face, [{ rotate: "0deg" }, { rotate: 360 * n + "deg" }], { duration: 650 * n, easing: "cubic-bezier(.4,0,.2,1)" }).finished.catch(() => {}); };
  const heart = (x, y) => { const h = document.createElement("span"); h.className = "as-heart"; h.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 21C3 14 4 6.500 8.500 6.500c1.700 0 3 1 3.500 2.500.5-1.500 1.800-2.500 3.500-2.500C20 6.500 21 14 12 21z" fill="#FF4D6D"/></svg>'; h.style.left = x + "px"; h.style.top = y + "px"; pal.append(h); anim(h, [{ translate: "0 0", opacity: 1, scale: ".6" }, { translate: `${rand(-14, 14)}px -44px`, opacity: 0, scale: "1.2" }], { duration: 1100, easing: "ease-out" }).finished.then(() => h.remove()).catch(() => h.remove()); };

  const sleep = () => { if (asleep || busy || dragging || open()) return; asleep = true; say.hidden = true; say.classList.remove("show"); mood(face, "sleepy"); pal.classList.add("zz"); };
  const wake = (soft) => {
    if (!asleep) return; asleep = false; pal.classList.remove("zz"); mood(face, "curious", 700);
    if (!soft) { hop(10); beep("wake"); if (Math.random() < 0.6) speak(pick(["Oh! Hi!", "I wasn't sleeping. Promise.", "*yawn* Hello."]), 2600); }
  };

  // wander along the bottom (desktop only), with a little waddle and hops
  const wander = async () => {
    if (calm() || innerWidth < 760 || busy) return; busy = true;
    const from = pal.getBoundingClientRect().left, to = rand(26, Math.max(80, innerWidth * 0.22)), dist = Math.abs(to - from);
    if (dist < 30) { busy = false; return; }
    const ms = Math.max(800, Math.min(2800, dist * 8));
    mood(face, "happy"); btn.classList.add("walk");
    const hops = anim(btn, [{ translate: "0 0" }, { translate: "0 -7px" }, { translate: "0 0" }], { duration: 280, iterations: Math.max(2, Math.round(ms / 280)) });
    const wob = anim(face, [{ rotate: "-6deg" }, { rotate: "6deg" }], { duration: 280, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
    await anim(pal, [{ left: from + "px" }, { left: to + "px" }], { duration: ms, easing: "ease-in-out" }).finished.catch(() => {});
    place(to); hops.cancel(); wob.cancel(); btn.classList.remove("walk"); mood(face, "neutral"); await hop(10); busy = false;
  };
  // peek in from the left edge, look around, and slip back
  const peek = async () => {
    if (calm() || innerWidth < 760 || busy) return; busy = true;
    const from = pal.getBoundingClientRect().left;
    await anim(pal, [{ left: from + "px" }, { left: "-34px" }], { duration: 700, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" }).finished.catch(() => {});
    pal.style.left = "-34px"; mood(face, "curious"); await sleepMs(2200); mood(face, "happy");
    await anim(pal, [{ left: "-34px" }, { left: from + "px" }], { duration: 600, easing: "cubic-bezier(.3,1.4,.5,1)" }).finished.catch(() => {});
    place(from); mood(face, "neutral"); busy = false;
  };
  const glance = () => { mood(face, "curious", 1100); };

  // dance when the music corner plays
  const music = () => { try { return !!(window.Music && window.Music.state().playing); } catch { return false; } };
  const dance = () => {
    if (dancing || calm()) return; dancing = true; mood(face, "excited");
    const loop = () => { if (!dancing || !pal.isConnected) return; if (!music() || document.hidden) { dancing = false; mood(face, "neutral"); return; } const d = Math.random() < 0.5 ? -1 : 1; anim(btn, [{ rotate: "0deg", translate: "0 0" }, { rotate: 10 * d + "deg", translate: `0 -9px` }, { rotate: "0deg", translate: "0 0" }], { duration: 480, easing: "ease-in-out" }).finished.then(() => later(loop, 0)).catch(() => {}); };
    loop();
  };

  // pick one thing to do now and then, like a pet that gets bored
  const act = () => {
    if (document.hidden || open() || busy || dragging || asleep) return;
    if (music()) { dance(); return; }
    const wide = innerWidth >= 760, menu = [["hop", 3], ["glance", 3], ["spin", 1], ["tip", 3], ["wander", wide ? 3 : 0], ["peek", wide ? 1 : 0]].filter((x) => x[1]);
    let n = rand(0, menu.reduce((a, b) => a + b[1], 0)), what = menu[0][0]; for (const [k, w] of menu) { if ((n -= w) <= 0) { what = k; break; } }
    if (what === "tip") { if (tips >= 6 || prefs.quiet()) what = "hop"; else { tips++; ss.set("rkAskTips", tips); speak(pick(TIPS), 4600, "happy"); return; } }
    if (what === "hop") { mood(face, "happy", 900); hop(); } else if (what === "glance") glance(); else if (what === "spin") { mood(face, "excited", 900); spin(); } else if (what === "wander") wander(); else if (what === "peek") peek();
  };
  const tick = () => {
    if (!pal.isConnected) return;
    const idle = Date.now() - last;
    if (!asleep && idle > 70000 && !open() && !document.hidden && !music()) sleep();
    if (asleep) return;
    if (Date.now() >= nextAct) { nextAct = Date.now() + rand(14000, 34000); act(); }
  };
  const poke = () => { last = Date.now(); if (asleep) wake(); };
  for (const ev of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(ev, poke, { passive: true });
  const iv = setInterval(tick, 3000);

  // the chat tells the face how to feel
  const onMood = (e) => { if (asleep) wake(true); mood(face, e.detail.name, e.detail.ms); if (e.detail.name === "love" || e.detail.name === "excited") { if (!calm()) { const r = btn.getBoundingClientRect(); for (let i = 0; i < 3; i++) setTimeout(() => heart(r.left - pal.getBoundingClientRect().left + rand(8, 44), 0), i * 160); } } };
  document.addEventListener("ask-mood", onMood);
  const onVis = () => { if (!document.hidden) last = Date.now(); };
  document.addEventListener("visibilitychange", onVis);

  // react to the apps people open
  const oa = window.openApp;
  if (typeof oa === "function" && !oa.__asked) {
    const wrapped = function (id) {
      try {
        if (id !== "assistant" && Date.now() - lastReact > 25000 && !open() && Math.random() < 0.55) { const line = APP_LINES[id] && pick(APP_LINES[id]); if (line) { lastReact = Date.now(); later(() => speak(line[0], 3200, line[1]), 900); } }
      } catch {}
      return oa.apply(this, arguments);
    };
    wrapped.__asked = true; try { window.openApp = wrapped; } catch {}
    pal.__restore = () => { try { if (window.openApp === wrapped) window.openApp = oa; } catch {} };
  }

  // click: hop, pop, open the chat. Five fast clicks make it dizzy and throw confetti.
  btn.addEventListener("click", () => {
    if (btn.__dragged) { btn.__dragged = false; return; }
    const now = Date.now(); clicks = clicks.filter((t) => now - t < 2200); clicks.push(now); say.hidden = true;
    if (clicks.length >= 5) { clicks = []; mood(face, "dizzy", 2600); spin(3); speak("Whoa! Too many clicks!", 2600); fx().then((m) => { m.sound("sparkle"); const r = btn.getBoundingClientRect(); m.confetti({ x: r.left + r.width / 2, y: r.top }); }).catch(() => {}); return; }
    mood(face, "happy", 900); hop(); beep("pop"); window.openApp && openApp("assistant");
  });
  btn.addEventListener("contextmenu", (e) => { e.preventDefault(); setFaceOn(false); window.toast && toast(`Face hidden. Bring it back from the ${ASK} app, under Options.`); });
  // pet it: stay on it a moment and it loves it
  btn.addEventListener("pointerenter", () => { if (dragging) return; if (!asleep) mood(face, "happy"); hoverT = setTimeout(() => { mood(face, "love", 1600); beep("purr"); if (!calm()) { heart(14, 0); setTimeout(() => heart(34, 0), 200); } }, 1300); });
  btn.addEventListener("pointerleave", () => { clearTimeout(hoverT); if (!dragging && !asleep && face.classList.contains("m-happy")) mood(face, "neutral"); });

  // pick it up and drop it: it falls back to the floor with a bounce
  let sx = 0, sy = 0, ox = 0, oy = 0, pid = null;
  btn.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; pid = e.pointerId; sx = e.clientX; sy = e.clientY; const r = pal.getBoundingClientRect(); ox = r.left; oy = innerHeight - r.bottom; });
  addEventListener("pointermove", (e) => {
    if (pid !== e.pointerId) return;
    if (!dragging) { if (Math.hypot(e.clientX - sx, e.clientY - sy) < 7 || calm()) return; dragging = true; btn.__dragged = true; try { btn.setPointerCapture(pid); } catch {} pal.classList.add("held"); mood(face, "curious"); clearTimeout(hoverT); say.hidden = true; }
    pal.style.left = Math.max(-10, Math.min(innerWidth - 50, ox + e.clientX - sx)) + "px"; pal.style.bottom = Math.max(6, Math.min(innerHeight - 70, oy - (e.clientY - sy))) + "px";
    btn.style.rotate = Math.max(-18, Math.min(18, (e.clientX - sx) * 0.12)) + "deg";
  });
  const drop = async (e) => {
    if (pid === null || (e && pid !== e.pointerId)) return; pid = null;
    if (!dragging) return; dragging = false; pal.classList.remove("held"); btn.style.rotate = "";
    const b0 = parseFloat(pal.style.bottom) || home().b, floor = home().b; busy = true; mood(face, "excited");
    if (b0 - floor > 6) { await anim(pal, [{ bottom: b0 + "px" }, { bottom: floor + "px", offset: 0.4 }, { bottom: floor + Math.min(60, (b0 - floor) * 0.3) + "px", offset: 0.62 }, { bottom: floor + "px", offset: 0.8 }, { bottom: floor + 8 + "px", offset: 0.9 }, { bottom: floor + "px" }], { duration: 900, easing: "cubic-bezier(.4,0,.6,1)" }).finished.catch(() => {}); }
    pal.style.bottom = floor + "px"; anim(btn, [{ scale: "1.18 .8" }, { scale: "1 1" }], { duration: 300, easing: "cubic-bezier(.3,1.5,.5,1)" }); beep("pop");
    mood(face, "happy", 1200); if (Math.random() < 0.5) speak(pick(["Wheee!", "Again! Again!", "Nice catch.", "Careful, I'm fragile. Mostly."]), 2400); busy = false; setTimeout(() => (btn.__dragged = false), 60);
  };
  addEventListener("pointerup", drop); addEventListener("pointercancel", drop);
  addEventListener("resize", () => { if (!dragging) { place(parseFloat(pal.style.left) || home().x); pal.style.bottom = home().b + "px"; } });

  pal.__stop = () => { clearInterval(iv); timers.forEach(clearTimeout); document.removeEventListener("ask-mood", onMood); document.removeEventListener("visibilitychange", onVis); for (const ev of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) removeEventListener(ev, poke); pal.__restore && pal.__restore(); };

  // arrive: pop in from the left edge, say hello (once per visit)
  if (!calm()) anim(pal, [{ translate: "-90px 0", opacity: 0 }, { translate: "6px 0", opacity: 1, offset: 0.6 }, { translate: "0 0", opacity: 1 }], { duration: 800, easing: "cubic-bezier(.3,1,.4,1)" });
  if (!ss.get("rkAskHi", false)) { ss.set("rkAskHi", true); later(() => { mood(face, "excited", 1400); hop(); speak(hello() + " I'm Rohan's assistant.", 4600); }, 2600); }
}

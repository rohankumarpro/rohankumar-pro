// Focus extras: calm sounds while the timer runs, one of the music corner's records if you like, and a proper alarm at the end.
// All sound is made in the browser (no files, no network). When the timer is paused, reset or finished, the sound and music stop.
import { h, esc } from "/js/lib.mjs";

const KEY = "ftSound";
const AMB = [["off", "Off"], ["rain", "Rain"], ["brown", "Brown noise"], ["waves", "Waves"], ["fire", "Fireplace"], ["cafe", "Café"]];
const load = () => { try { return { amb: "off", vol: 50, music: "", ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { amb: "off", vol: 50, music: "" }; } };
let cfg = load(); const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };

let ctx = null, out = null, nodes = [], timers = [], alarmNodes = [], alarmT = 0, musicOn = false;
const ac = () => { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); out = ctx.createGain(); out.connect(ctx.destination); } if (ctx.state === "suspended") ctx.resume(); out.gain.value = 0.9; return ctx; };

function noiseBuf(kind, secs = 4) {
  const n = ctx.sampleRate * secs, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  if (kind === "white") for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  else if (kind === "brown") { let l = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } }
  else { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; } }
  return b;
}
const src = (kind) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(kind); s.loop = true; s.start(); nodes.push(s); return s; };
const filt = (type, f, q = 0.7) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; nodes.push(x); return x; };
const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; nodes.push(g); return g; };
const lfo = (rate, depth, target) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); nodes.push(o, g); };

function startAmbient() {
  stopAmbient(); if (cfg.amb === "off" || !ac()) return;
  const master = gain(Math.pow(cfg.vol / 100, 1.6) * 0.9); master.connect(out); master.gain.value = Math.pow(cfg.vol / 100, 1.6) * 0.9; startAmbient.master = master;
  const k = cfg.amb;
  if (k === "rain") { const a = src("pink"), hp = filt("highpass", 500), lp = filt("lowpass", 9000), g = gain(0.8); a.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master); lfo(0.15, 0.08, g.gain); }
  else if (k === "brown") { const a = src("brown"), lp = filt("lowpass", 900), g = gain(0.9); a.connect(lp); lp.connect(g); g.connect(master); }
  else if (k === "waves") { const a = src("brown"), lp = filt("lowpass", 1100), g = gain(0.55); a.connect(lp); lp.connect(g); g.connect(master); lfo(0.09, 0.45, g.gain); const b = src("pink"), bp = filt("bandpass", 1800, 0.6), g2 = gain(0.12); b.connect(bp); bp.connect(g2); g2.connect(master); lfo(0.09, 0.1, g2.gain); }
  else if (k === "fire") {
    const a = src("brown"), lp = filt("lowpass", 500), g = gain(1.0); a.connect(lp); lp.connect(g); g.connect(master);
    const crack = () => { if (!ctx) return; const s = ctx.createBufferSource(), b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1500 + Math.random() * 3000; const gg = ctx.createGain(); gg.gain.value = 0.25 + Math.random() * 0.5; s.connect(f); f.connect(gg); gg.connect(master); s.start(); timers.push(setTimeout(crack, 60 + Math.random() * 520)); };
    crack();
  }
  else if (k === "cafe") { const a = src("pink"), bp = filt("bandpass", 1100, 0.35), g = gain(0.7); a.connect(bp); bp.connect(g); g.connect(master); lfo(0.3, 0.12, g.gain); }
}
function stopAmbient() {
  timers.forEach(clearTimeout); timers = [];
  const m = startAmbient.master; startAmbient.master = null;
  if (m && ctx) { try { m.gain.setTargetAtTime(0, ctx.currentTime, 0.15); } catch {} }
  const old = nodes; nodes = [];
  setTimeout(() => old.forEach((n) => { try { n.stop && n.stop(); } catch {} try { n.disconnect(); } catch {} }), 600);
}
function setAmbVol() { const m = startAmbient.master; if (m && ctx) m.gain.setTargetAtTime(Math.pow(cfg.vol / 100, 1.6) * 0.9, ctx.currentTime, 0.05); }

/* the alarm: a bright little tune, four times, until it ends or you touch the screen */
function stopAlarm() { clearTimeout(alarmT); alarmNodes.forEach((n) => { try { n.stop && n.stop(); } catch {} try { n.disconnect(); } catch {} }); alarmNodes = []; document.removeEventListener("pointerdown", stopAlarm, true); }
function alarm() {
  stopAlarm(); if (!ac()) return; const t0 = ctx.currentTime + 0.05, seq = [880, 1108.7, 1318.5, 1760, 1318.5, 1108.7];
  for (let r = 0; r < 4; r++) seq.forEach((f, i) => {
    const t = t0 + r * 1.7 + i * 0.22, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f * 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); o2.connect(g); g.connect(ctx.destination); o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.4); alarmNodes.push(o, o2, g);
  });
  try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch {}
  alarmT = setTimeout(stopAlarm, 7200); setTimeout(() => document.addEventListener("pointerdown", stopAlarm, true), 900);
}

/* music from the music corner */
const trackKey = (t) => t.k + ":" + t.id;
const tracks = () => (window.Music && window.Music.tracks ? window.Music.tracks() : []);
function startMusic() { if (!cfg.music || !window.Music) return; const i = tracks().findIndex((t) => trackKey(t) === cfg.music); if (i < 0) return; musicOn = true; window.Music.play(i); }
function stopMusic() { if (musicOn && window.Music) window.Music.pause(); musicOn = false; }

window.__ftHook = (ev, mode) => {
  if (ev === "start") { stopAlarm(); if (!mode || mode === "focus") { startAmbient(); startMusic(); } }
  else if (ev === "pause" || ev === "reset") { stopAmbient(); stopMusic(); }
  else if (ev === "done") { stopAmbient(); stopMusic(); alarm(); }
};

/* the controls in the Focus window */
window.__ftUI = (body) => {
  const box = body.querySelector(".ft"); if (!box || box.querySelector(".ft-snd")) return;
  const list = tracks(), el = h("div", { class: "ft-snd" });
  el.innerHTML = `<label class="ft-sl"><span>Sound</span><select class="ft-amb" aria-label="Focus sound">${AMB.map(([k, l]) => `<option value="${k}"${cfg.amb === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="ft-sl ft-vl"><span>Volume</span><input class="ft-vol" type="range" min="5" max="100" value="${cfg.vol}" aria-label="Sound volume" style="--p:${cfg.vol}%"></label>
    ${list.length ? `<label class="ft-sl"><span>Music</span><select class="ft-mus" aria-label="Focus music"><option value="">Off</option>${list.map((t) => `<option value="${esc(trackKey(t))}"${cfg.music === trackKey(t) ? " selected" : ""}>${esc(t.title || "Record")}</option>`).join("")}</select></label>` : ""}
    <p class="hint">Plays while a Focus session runs. Pausing, resetting or finishing stops it, and an alarm sounds at the end.</p>`;
  const stats = box.querySelector(".ft-s"); stats ? stats.before(el) : box.append(el);
  const running = () => typeof FT !== "undefined" && FT.run && FT.mode === "focus";
  el.querySelector(".ft-amb").onchange = (e) => { cfg.amb = e.target.value; save(); if (running()) startAmbient(); };
  const v = el.querySelector(".ft-vol"); v.oninput = () => { cfg.vol = +v.value; v.style.setProperty("--p", v.value + "%"); save(); setAmbVol(); };
  const m = el.querySelector(".ft-mus"); if (m) m.onchange = () => { cfg.music = m.value; save(); if (running()) { m.value ? startMusic() : stopMusic(); } };
};

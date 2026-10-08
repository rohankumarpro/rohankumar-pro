// Sounds and confetti for Ask Rohan. Everything is made in the browser (no files to download), and it is only loaded the
// first time something wants it. Sounds are short and soft, and only play because someone just did something (a click, a
// message). Sound has its own switch in the chat header; confetti and other motion are skipped for "reduce motion".
import { prefs } from "/js/assistant-face.mjs";

let ctx = null, lastTick = 0;
const MASTER = 0.07;
function ac() {
  if (!prefs.sound()) return null;
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume().catch(() => {}); return ctx; } catch { return null; }
}
// one soft note: a pitch (that can glide), a length and a shape
function note(c, { f = 440, to = 0, at = 0, len = 0.12, type = "sine", v = 1 }) {
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + len);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * MASTER), t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + len + 0.03);
}
const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G4: 392, E4: 329.63, C4: 261.63 };
const SOUNDS = {
  pop: (c) => note(c, { f: 480, to: 920, len: 0.1, v: 1 }),                                   // press the face
  wake: (c) => { note(c, { f: 300, to: 500, len: 0.09 }); note(c, { f: 520, to: 760, at: 0.1, len: 0.09 }); },
  send: (c) => { note(c, { f: N.E5, len: 0.07, type: "triangle" }); note(c, { f: N.A5, at: 0.06, len: 0.09, type: "triangle" }); },
  recv: (c) => { note(c, { f: N.C5, len: 0.14, type: "triangle", v: 0.9 }); note(c, { f: N.E5, at: 0.08, len: 0.14, type: "triangle", v: 0.9 }); note(c, { f: N.G5, at: 0.16, len: 0.22, type: "triangle", v: 0.9 }); },
  sad: (c) => { note(c, { f: N.G4, len: 0.16, type: "triangle" }); note(c, { f: N.E4, at: 0.14, len: 0.16, type: "triangle" }); note(c, { f: N.C4, at: 0.28, len: 0.28, type: "triangle" }); },
  sparkle: (c) => { [N.C6, N.E6, N.G5, N.C6, N.E6].forEach((f, i) => note(c, { f, at: i * 0.055, len: 0.14, v: 0.8 })); },
  purr: (c) => { for (let i = 0; i < 5; i++) note(c, { f: 150 + (i % 2) * 14, at: i * 0.055, len: 0.07, type: "sawtooth", v: 0.35 }); },
  boop: (c) => note(c, { f: 360, to: 250, len: 0.12, type: "triangle" }),
  tick: (c) => note(c, { f: 640 + Math.random() * 380, len: 0.03, type: "square", v: 0.22 }),    // typing
};
export function sound(name) {
  if (name === "tick") { const t = performance.now(); if (t - lastTick < 55) return; lastTick = t; }
  const c = ac(); if (!c) return;
  try { SOUNDS[name] && SOUNDS[name](c); } catch {}
}

// confetti: little pieces thrown up from a point and let fall. Skipped for people who asked for less motion.
export function confetti({ x = innerWidth / 2, y = innerHeight * 0.55, n = 70 } = {}) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cs = getComputedStyle(document.documentElement), pal = [cs.getPropertyValue("--ak-a").trim() || "#2457D6", cs.getPropertyValue("--ak-b").trim() || "#6B4CE0", "#FFD23F", "#FF6B8B", "#3CCFA8", "#FF8A5B"];
  const layer = document.createElement("div"); layer.className = "ak-confetti"; layer.setAttribute("aria-hidden", "true"); document.body.append(layer);
  let done = 0;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i"), w = 5 + Math.random() * 6, h = w * (0.8 + Math.random() * 1.2), a = (Math.random() - 0.5) * Math.PI * 1.1, v = 180 + Math.random() * 360;
    p.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${pal[i % pal.length]};border-radius:${Math.random() < 0.3 ? "50%" : "2px"}`;
    const dx = Math.sin(a) * v, up = -Math.cos(a) * v * 0.9, fall = innerHeight - y + 60 + Math.random() * 120, spin = (Math.random() - 0.5) * 1100;
    layer.append(p);
    p.animate([{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: `translate(${dx * 0.55}px,${up}px) rotate(${spin * 0.5}deg)`, opacity: 1, offset: 0.38 }, { transform: `translate(${dx}px,${fall}px) rotate(${spin}deg)`, opacity: 0.9 }],
      { duration: 1500 + Math.random() * 1100, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" }).finished.catch(() => {}).then(() => { if (++done === n) layer.remove(); });
  }
  setTimeout(() => layer.remove(), 3400);
}

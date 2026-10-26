// Living type: Sansser is sans + serif. Headlines rest in Sole Sans; letters near the pointer wipe into
// Sole Serif italic (same designer) and back. On touch, a tap sweeps the line once. Nothing moves on its own.
import { arrival } from "./kit.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const lines = [];

function build(el) {
  const text = el.textContent.replace(/\s+/g, " ").trim();
  if (!text || el.dataset.live) return;
  el.dataset.live = "on";
  const words = text.split(" ").map((w) =>
    `<span class="lw">${[...w].map((ch) => `<span class="lc"><span class="ls">${esc(ch)}</span><span class="lf"><i>${esc(ch)}</i></span></span>`).join("")}</span>`
  );
  el.innerHTML = `<span class="sr">${esc(text)}</span><span aria-hidden="true">${words.join(" ")}</span>`;
  lines.push({ el, cells: [...el.querySelectorAll(".lc")], lit: false });
}

let px = -1e5, py = -1e5, raf = 0;
function tick() {
  raf = 0;
  for (const L of lines) {
    const r = L.el.getBoundingClientRect(), rad = parseFloat(getComputedStyle(L.el).fontSize) * 1.05;
    const near = px > r.left - rad && px < r.right + rad && py > r.top - rad && py < r.bottom + rad;
    if (!near) { if (L.lit) { L.cells.forEach((c) => c.classList.remove("on")); L.lit = false; } continue; }
    L.lit = true;
    for (const c of L.cells) {
      const b = c.getBoundingClientRect();
      c.classList.toggle("on", Math.hypot(b.left + b.width / 2 - px, (b.top + b.height / 2 - py) * 1.3) < rad);
    }
  }
}
const queue = () => { if (!raf) raf = requestAnimationFrame(tick); };

function sweep(L) {
  L.cells.forEach((c, i) => {
    setTimeout(() => c.classList.add("on"), i * 28);
    setTimeout(() => c.classList.remove("on"), i * 28 + 520);
  });
}

if (!reduceMotion) {
  arrival.then(() => {
    document.querySelectorAll("main h1, main h2").forEach(build);
    addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; px = e.clientX; py = e.clientY; queue(); }, { passive: true });
    addEventListener("scroll", queue, { passive: true });
    addEventListener("pointerout", (e) => { if (!e.relatedTarget) { px = py = -1e5; queue(); } });
    for (const L of lines) L.el.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") sweep(L); });
  });
}

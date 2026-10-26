// Interaction kit: decode, toast, HUD brackets, cover scan, command palette.
// Everything here only runs in response to the visitor; at rest the page is still.
import { FX } from "./fx.js";
import { ICON } from "./icon.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Decode: text resolves from machine characters into words
const GLYPHS = "/\\|<>_-=+*#01:.";
// Resolves once the final text is in place
export function decode(el, text = el?.textContent || "", ms = 380) {
  if (!el) return Promise.resolve();
  if (reduceMotion) { el.textContent = text; return Promise.resolve(); }
  const t0 = performance.now(), n = text.length;
  cancelAnimationFrame(el._dec);
  return new Promise((done) => {
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms), fixed = Math.floor(p * n);
      let s = text.slice(0, fixed);
      for (let i = fixed; i < n; i++) s += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = s;
      if (p < 1) el._dec = requestAnimationFrame(step); else { el.textContent = text; done(); }
    };
    el._dec = requestAnimationFrame(step);
  });
}

// System feedback: a short line in the corner after an action
const toastEl = document.createElement("div");
toastEl.className = "toast"; toastEl.setAttribute("role", "status"); toastEl.innerHTML = "<i></i><span></span>";
document.body.append(toastEl);
let toastT = 0;
export function toast(msg) {
  toastEl.classList.add("on"); decode(toastEl.querySelector("span"), msg, 300);
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("on"), 2200);
}

// HUD brackets: corners snap around the reel, row or control you point at or tab to
(() => {
  const hud = document.createElement("div");
  hud.className = "hud"; hud.setAttribute("aria-hidden", "true");
  hud.innerHTML = "<i></i><i></i><i></i><i></i><b></b>";
  document.body.append(hud);
  let target = null;
  const place = () => {
    if (!target || !target.isConnected) { hud.classList.remove("on"); return; }
    const r = target.getBoundingClientRect();
    Object.assign(hud.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  };
  const show = (el, label = "") => { target = el; place(); hud.classList.add("on"); const b = hud.querySelector("b"); if (label) decode(b, label, 260); else b.textContent = ""; };
  const hide = (el) => { if (target === el) { target = null; hud.classList.remove("on"); } };
  const SEL = ".cell, a.it, .stat";
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest(SEL); if (!el || el === target) return;
    show(el, el.matches(".cell") ? "Scan · " + (el.dataset.keyword || "") : el.matches("a.it") ? "Open link" : "");
  });
  document.addEventListener("pointerout", (e) => { const el = e.target.closest(SEL); if (el && !el.contains(e.relatedTarget)) hide(el); });
  document.addEventListener("focusin", (e) => { if (e.target.matches(":focus-visible") && !e.target.matches(".in, #kp-q")) show(e.target); });
  document.addEventListener("focusout", (e) => hide(e.target));
  addEventListener("scroll", place, { passive: true });
  addEventListener("resize", place);
})();

// Cover scan on reel cards: a gradient line sweeps the cover, then the readout rises (markup is server-rendered)
document.querySelectorAll(".cell").forEach((cell) => {
  const line = cell.querySelector(".scan");
  if (line) FX.add(line, cell, "full");
  cell.addEventListener("pointerenter", () => {
    const k = cell.querySelector(".kw"), c = cell.querySelector(".meta span:last-child");
    decode(k, k?.textContent, 300); if (c) decode(c, c.textContent, 420);
  });
});

// Headlines decode once when you arrive from another Sansser page; living type waits for this to finish
const arriving = document.referrer && new URL(document.referrer).origin === location.origin && document.querySelector("main h1");
export const arrival = arriving ? decode(arriving, arriving.textContent, 520) : Promise.resolve();

// Command palette: Cmd/Ctrl+K or "/" searches every reel, tool and prompt
(() => {
  const dataEl = document.getElementById("kp-data"); if (!dataEl) return;
  const ITEMS = JSON.parse(dataEl.textContent);
  const kp = document.createElement("div");
  kp.className = "kp"; kp.setAttribute("role", "dialog"); kp.setAttribute("aria-modal", "true"); kp.setAttribute("aria-label", "Search Sansser");
  kp.innerHTML = `<div class="kp-box"><div class="kp-in">${ICON("search")}<input id="kp-q" placeholder="Search reels, tools and prompts" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="kp-list"><kbd>Esc</kbd></div><div class="kp-list" id="kp-list" role="listbox"></div><div class="kp-foot"><span>↑ ↓ Move</span><span>Enter Open</span><span>Esc Close</span></div></div>`;
  document.body.append(kp);
  const q = kp.querySelector("#kp-q"), list = kp.querySelector("#kp-list");
  let shown = [], sel = 0;
  function render() {
    const v = q.value.trim().toLowerCase();
    shown = ITEMS.filter((it) => !v || `${it.t} ${it.m} ${it.g}`.toLowerCase().includes(v)).slice(0, 40);
    if (sel >= shown.length) sel = 0;
    if (!shown.length) { list.innerHTML = `<div class="kp-empty">Nothing matches "${esc(q.value)}". Try a tool name or a keyword from a reel, like REPOS.</div>`; return; }
    let g = "", html = "";
    shown.forEach((it, i) => {
      if (it.g !== g) { g = it.g; html += `<div class="kp-g">${esc(g)}</div>`; }
      html += `<div class="kp-row${i === sel ? " sel" : ""}" role="option" id="kp-o${i}" aria-selected="${i === sel}" data-i="${i}">${ICON(it.icon)}<span class="t">${esc(it.t)}</span><span class="m">${esc(it.m)}</span></div>`;
    });
    list.innerHTML = html;
    list.querySelectorAll(".kp-row").forEach((row) => { const c = document.createElement("canvas"); c.className = "fx"; row.prepend(c); FX.add(c, row, "full", { on: () => row.classList.contains("sel") }); });
    q.setAttribute("aria-activedescendant", "kp-o" + sel); FX.kick();
  }
  function move(d) {
    if (!shown.length) return;
    sel = (sel + d + shown.length) % shown.length;
    list.querySelectorAll(".kp-row").forEach((r) => {
      const on = +r.dataset.i === sel; r.classList.toggle("sel", on); r.setAttribute("aria-selected", on);
      if (on) { r.scrollIntoView({ block: "nearest" }); decode(r.querySelector(".m"), r.querySelector(".m").textContent, 240); }
    });
    q.setAttribute("aria-activedescendant", "kp-o" + sel); FX.kick();
  }
  const open = () => { if (document.querySelector(".veil.show")) return; kp.classList.add("show"); q.value = ""; sel = 0; render(); setTimeout(() => q.focus({ preventScroll: true }), 60); };
  const close = () => kp.classList.remove("show");
  const choose = (i) => { const it = shown[i]; if (!it) return; close(); location.href = it.href; };
  q.addEventListener("input", () => { sel = 0; render(); });
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
    else if (e.key === "Escape") close();
  });
  list.addEventListener("pointermove", (e) => { const r = e.target.closest(".kp-row"); if (r && +r.dataset.i !== sel) move(+r.dataset.i - sel); });
  list.addEventListener("click", (e) => { const r = e.target.closest(".kp-row"); if (r) choose(+r.dataset.i); });
  kp.addEventListener("click", (e) => { if (e.target === kp) close(); });
  addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || "");
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); kp.classList.contains("show") ? close() : open(); }
    else if (e.key === "/" && !typing && !kp.classList.contains("show")) { e.preventDefault(); open(); }
  });
  document.getElementById("kopen")?.addEventListener("click", open);
})();

// Copy buttons on prompts: change the label in place so the gradient window survives
document.addEventListener("click", async (e) => {
  const b = e.target.closest(".copy"); if (!b) return;
  const code = b.closest(".cbox")?.querySelector(".code"); if (!code) return;
  try { await navigator.clipboard.writeText(code.textContent); }
  catch { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  const u = b.querySelector("use"), l = b.querySelector("span.lbl");
  b.classList.add("done"); if (l) l.textContent = "Copied"; FX.kick(); toast("Prompt copied");
  setTimeout(() => { b.classList.remove("done"); if (l) l.textContent = "Copy"; }, 1600);
});

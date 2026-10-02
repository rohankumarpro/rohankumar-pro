// Window management in one place: the app drawer's Minimise all / Close all / Grid bar, the Grid button in the top bar,
// and the choice of whether tapping an empty desktop minimises everything.
import { h, $ } from "/js/lib.mjs";
import { icon } from "/shared/icons.mjs";

const wins = () => Object.entries(open).filter(([, w]) => w && w.isConnected);
const shown = () => wins().filter(([, w]) => !w.classList.contains("min") && !w.classList.contains("minimizing"));
const mob = () => innerWidth <= 760;
const T = () => window.Tiles;

/* the bar inside the app drawer */
window.__winBar = () => {
  const bar = document.getElementById("lWin"); if (!bar) return;
  const n = wins().length, vis = shown().length; bar.innerHTML = ""; bar.hidden = !n;
  if (!n) return;
  const b = (label, ic, fn, cls = "") => bar.append(h("button", { class: "lw-b " + cls, type: "button", html: `${icon(ic, { size: 16 })}<span>${label}</span>`, onclick: () => { window.hideLauncher && hideLauncher(); setTimeout(fn, 120); } }));
  bar.append(h("span", { class: "lw-n" }, `${n} open`));
  if (vis) b("Minimise all", "minus", () => minimizeAll());
  b(`Close all`, "x", () => closeAll(), "danger");
  if (!mob() && vis > 1) b("Grid", "grid", () => T() && T().autoGrid());
  if (!mob() && T() && T().active()) { b(T().locked() ? "Unlock group" : "Lock group", T().locked() ? "unlock" : "lock", () => T().lock(!T().locked())); b("Full screen group", "eye", () => T().full(true)); }
};

/* a Grid button in the top bar while two or more apps are open */
let gb = null;
function gridBtn() {
  const tb = document.querySelector(".topbar"); if (!tb) return;
  if (!gb) {
    gb = h("button", { class: "pill topbtn tb-ic gridbtn", id: "gridBtn", type: "button", "aria-label": "Arrange open apps in a grid", title: "Arrange open apps in a grid", html: icon("grid", { size: 18 }), hidden: true });
    gb.onclick = (e) => {
      const t = T(); if (!t) return;
      if (!t.active()) { t.autoGrid(); return; }
      const r = gb.getBoundingClientRect(); window.showCtx(r.left, r.bottom + 6, [["Re-arrange in a grid", () => t.autoGrid()], [t.locked() ? "Unlock this group" : "Lock this group (no new apps)", () => t.lock(!t.locked())], [t.isFull() ? "Exit full screen group" : "Full screen this group", () => t.full(!t.isFull())], null, ["Release all tiles", () => t.releaseAll()]]);
    };
    const ref = document.getElementById("spotBtn"); if (ref && ref.parentNode) ref.parentNode.insertBefore(gb, ref); else tb.insertBefore(gb, tb.lastElementChild);
  }
  gb.hidden = mob() || shown().length < 2 && !(T() && T().active());
}
let raf = 0; const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; gridBtn(); }); };
const wrap = document.getElementById("wins");
if (wrap) new MutationObserver(later).observe(wrap, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
addEventListener("resize", later); setTimeout(gridBtn, 600);

/* tapping an empty desktop: off unless chosen in Settings */
window.__tapMin = () => localStorage.getItem("rkTapMin") === "1";

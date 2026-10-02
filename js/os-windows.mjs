// Two ways to work without clutter: Focus mode (one app, truly full screen, nothing else on screen) and the
// All windows overview (every open app as a live preview you can switch to or close).
import { h, $, $$, esc, toast, mobile } from "/js/lib.mjs";
import { icon } from "/shared/icons.mjs";

const svg = (p, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  focus: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  unfocus: '<path d="M3 8h3a2 2 0 0 0 2-2V3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M21 16h-3a2 2 0 0 0-2 2v3"/>',
  tabs: '<rect x="3.5" y="7" width="13" height="13" rx="3"/><path d="M8 7V6a2.5 2.5 0 0 1 2.5-2.5H18A2.5 2.5 0 0 1 20.5 6v7.5A2.5 2.5 0 0 1 18 16h-1.5"/>',
};

/* ================= Focus mode ================= */
export const Focus = {
  w: null, btn: null, hideT: 0,
  on() { return !!Focus.w; },
  enter(w) {
    if (!w || Focus.w === w) return;
    if (Focus.w) Focus.leave(true);
    Focus.w = w; w.classList.remove("min", "minimizing"); w.classList.add("focus"); window.focus && window.focus(w);
    document.documentElement.classList.add("focus-mode");
    Focus.btn = h("button", { class: "focus-exit", "aria-label": "Leave focus mode", title: "Leave focus mode (Esc)", html: svg(ICON.unfocus, 20) + "<span>Exit focus</span>", onclick: () => Focus.leave() });
    document.body.append(Focus.btn); Focus.poke();
    toast("Focus mode. Press Esc to leave.");
    $$(".wb.fc", w).forEach((b) => b.setAttribute("aria-pressed", "true"));
  },
  leave(quiet) {
    const w = Focus.w; if (!w) return; Focus.w = null;
    w.classList.remove("focus"); document.documentElement.classList.remove("focus-mode");
    $$(".wb.fc", w).forEach((b) => b.setAttribute("aria-pressed", "false"));
    Focus.btn && Focus.btn.remove(); Focus.btn = null; clearTimeout(Focus.hideT);
    window.dispatchEvent(new Event("resize"));
  },
  toggle(w) { Focus.w === w ? Focus.leave() : Focus.enter(w); },
  poke() { const b = Focus.btn; if (!b) return; b.classList.add("show"); clearTimeout(Focus.hideT); Focus.hideT = setTimeout(() => b.classList.remove("show"), 2600); },
};
document.addEventListener("click", (e) => { const b = e.target.closest(".wb.fc"); if (!b) return; e.stopPropagation(); Focus.toggle(b.closest(".win")); }, true);
document.addEventListener("pointermove", (e) => { if (Focus.w && (e.clientY < 70 || e.clientX > innerWidth - 160)) Focus.poke(); }, { passive: true });
document.addEventListener("touchstart", (e) => { if (Focus.w && e.touches[0].clientY < 60) Focus.poke(); }, { passive: true });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && Focus.w && !document.querySelector(".own-dlg, .spot-ov, .kbd-ov")) { Focus.leave(); } }, true);
new MutationObserver(() => { if (Focus.w && !Focus.w.isConnected) Focus.leave(true); }).observe(document.getElementById("wins") || document.body, { childList: true });
window.Focus = Focus;

/* ================= All windows overview ================= */
export const Overview = {
  el: null,
  wins() {
    return $$("#wins .win").filter((w) => !w.classList.contains("closing")).sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0));
  },
  count() { return Overview.wins().length; },
  preview(w) {
    // a still copy of the real window, scaled down. Anything that would run or load again is left out.
    const vis = w.offsetWidth > 0, W = vis ? w.offsetWidth : Math.min(parseFloat(w.style.width) || 720, innerWidth), H = vis ? w.offsetHeight : Math.min(parseFloat(w.style.height) || 520, innerHeight);
    const c = w.cloneNode(true);
    c.querySelectorAll("iframe,canvas,video,audio,script,.rz,.focus-exit").forEach((x) => x.remove());
    c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id")); c.querySelectorAll("[name]").forEach((x) => x.removeAttribute("name"));
    c.removeAttribute("id"); c.classList.remove("min", "minimizing", "max", "focus", "top", "opening", "popin", "restoring", "closing");
    c.setAttribute("inert", ""); c.setAttribute("aria-hidden", "true");
    // inline !important so the phone layout rules (which force full width) cannot resize the copy
    const imp = { position: "absolute", left: "0", top: "0", right: "auto", bottom: "auto", width: W + "px", height: H + "px", "max-width": "none", "max-height": "none", margin: "0", transform: "none", opacity: "1", "border-radius": "20px", display: "flex", "pointer-events": "none", transition: "none", animation: "none" };
    c.style.cssText = ""; for (const [k, v] of Object.entries(imp)) c.style.setProperty(k, v, "important");
    c.style.setProperty("transform-origin", "0 0");
    return { node: c, W, H };
  },
  show() {
    if (Overview.el) return Overview.hide();
    if (Focus.w) Focus.leave();
    window.hideLauncher && window.hideLauncher(); document.dispatchEvent(new Event("overview-open"));
    const ov = h("div", { class: "ov", role: "dialog", "aria-modal": "true", "aria-label": "All open windows" });
    Overview.el = ov; $("#desk").append(ov); Overview.draw();
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.classList.contains("ov-grid") || e.target.classList.contains("ov-wrap")) Overview.hide(); });
    document.addEventListener("keydown", Overview.key, true);
    requestAnimationFrame(() => ov.classList.add("in"));
    $("#tabsBtn")?.setAttribute("aria-expanded", "true");
    try { window.SFX && SFX.play("pop"); } catch {}
  },
  hide() {
    const ov = Overview.el; if (!ov) return; Overview.el = null; document.removeEventListener("keydown", Overview.key, true);
    ov.classList.remove("in"); setTimeout(() => ov.remove(), 200); $("#tabsBtn")?.setAttribute("aria-expanded", "false");
  },
  toggle() { Overview.el ? Overview.hide() : Overview.show(); },
  key(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); Overview.hide(); return; }
    const cards = $$(".ov-card", Overview.el); if (!cards.length) return;
    const i = cards.indexOf(document.activeElement.closest?.(".ov-card"));
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cards[(i + 1) % cards.length].focus(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cards[(i - 1 + cards.length) % cards.length].focus(); }
    if ((e.key === "Delete" || e.key === "Backspace") && i >= 0) { e.preventDefault(); Overview.close(cards[i]); }
    if (/^[1-9]$/.test(e.key) && cards[+e.key - 1]) { e.preventDefault(); Overview.pick(cards[+e.key - 1]); }
  },
  draw() {
    const ov = Overview.el; if (!ov) return; const wins = Overview.wins();
    ov.innerHTML = `<div class="ov-top"><b>Open apps</b><span class="ov-n">${wins.length}</span><span class="sp"></span>${wins.length ? '<button class="ov-all">Close all</button>' : ""}<button class="ov-x" aria-label="Close overview">${icon("x", { size: 18 })}</button></div>
      <div class="ov-wrap"><div class="ov-grid">${wins.length ? "" : `<div class="ov-empty"><div>${icon("window", { size: 56 })}</div><p>No apps are open.</p></div>`}</div></div><p class="ov-hint">${mobile() ? "Swipe a card up to close it" : "Click to switch. Delete closes a window. Esc leaves."}</p>`;
    const grid = $(".ov-grid", ov);
    wins.forEach((w, i) => {
      const id = w.dataset.app, title = $(".ttl", w)?.textContent || id, ic = $(".bar .ico", w)?.outerHTML || "";
      const card = h("div", { class: "ov-card" + (w.classList.contains("min") ? " is-min" : ""), tabindex: "0", role: "button", "aria-label": `${title}. Press Enter to open, Delete to close.`, "data-app": id, style: `--i:${i}` });
      card.innerHTML = `<div class="ov-h"><span class="ov-ic">${ic}</span><span class="ov-t">${esc(title)}</span><button class="ov-c" aria-label="Close ${esc(title)}">${icon("x", { size: 15 })}</button></div><div class="ov-p"></div>${w.classList.contains("min") ? '<span class="ov-badge">Minimised</span>' : ""}`;
      const box = $(".ov-p", card), { node, W, H } = Overview.preview(w);
      box.append(node);
      card.__win = w; card.__dims = [W, H]; grid.append(card);
      card.onclick = (e) => { if (e.target.closest(".ov-c")) { e.stopPropagation(); Overview.close(card); } else Overview.pick(card); };
      card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); Overview.pick(card); } };
      // on touch screens: drag a card up to throw it away
      let st = null;
      card.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" || e.target.closest(".ov-c")) return; st = { y: e.clientY, x: e.clientX, id: e.pointerId, dy: 0 }; });
      card.addEventListener("pointermove", (e) => { if (!st || e.pointerId !== st.id) return; const dy = e.clientY - st.y; if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(e.clientX - st.x)) { try { card.setPointerCapture(e.pointerId); } catch {} st.dy = Math.min(0, dy); card.style.transition = "none"; card.style.transform = `translateY(${st.dy}px)`; card.style.opacity = String(Math.max(.2, 1 + st.dy / 260)); card.classList.add("drag"); } });
      const up = (e) => { if (!st || e.pointerId !== st.id) return; const dy = st.dy; st = null; card.style.transition = ""; card.classList.remove("drag"); if (dy < -110) Overview.close(card); else { card.style.transform = ""; card.style.opacity = ""; } };
      card.addEventListener("pointerup", up); card.addEventListener("pointercancel", up);
    });
    Overview.fit();
    $(".ov-x", ov).onclick = () => Overview.hide();
    $(".ov-all", ov)?.addEventListener("click", () => { window.closeAll && window.closeAll(); setTimeout(() => Overview.draw(), 420); });
    setTimeout(() => $(".ov-card", ov)?.focus({ preventScroll: true }), 60);
  },
  fit() {
    $$(".ov-card", Overview.el).forEach((card) => {
      const box = $(".ov-p", card), [W, H] = card.__dims, k = box.clientWidth / W; const n = box.firstChild;
      if (n) { n.style.setProperty("transform", `scale(${k})`, "important"); box.style.height = Math.round(Math.min(H * k, box.clientWidth * 1.35)) + "px"; }
    });
  },
  pick(card) {
    const w = card.__win, id = w.dataset.app; Overview.hide();
    setTimeout(() => { if (w.classList.contains("min")) window.openApp(id); else { window.focus && window.focus(w); window.openApp(id); } }, 60);
  },
  close(card) {
    const w = card.__win; card.classList.add("gone");
    setTimeout(() => { try { window.closeWin(w, w.dataset.app); } catch {} card.remove(); const n = $$(".ov-card", Overview.el || document).length; const nn = $(".ov-n", Overview.el || document); if (nn) nn.textContent = n; if (!n) setTimeout(() => Overview.el && Overview.draw(), 200); updateBadge(); }, 200);
  },
};
window.Overview = Overview;
addEventListener("resize", () => Overview.el && Overview.fit());

function updateBadge() { const n = Overview.count(), b = $("#tabsBtn .tb-n"); if (b) { b.textContent = n; b.hidden = !n; } }
export function addTabsButton() {
  const wrap = $(".tb-right"); if (!wrap || $("#tabsBtn")) return;
  const b = h("button", { class: "pill topbtn tb-ic", id: "tabsBtn", "aria-label": "All windows", "aria-expanded": "false", title: "All windows (Alt A)", html: svg(ICON.tabs, 18) + '<i class="tb-n" hidden>0</i>' });
  wrap.prepend(b); b.onclick = (e) => { e.stopPropagation(); Overview.toggle(); };
  const w = $("#wins"); if (w) new MutationObserver(updateBadge).observe(w, { childList: true });
  updateBadge();
}

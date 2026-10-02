// Owner mode: rename any app, give it another icon or colour, and edit the "Open to projects" card.
// Everything is kept in the site settings (appEdits, status, now, statusDot), so it is the same for every visitor.
import { h, $, $$, esc, toast, Up, isAdmin } from "/js/lib.mjs";
import { ICONS, iconNames } from "/shared/icons.mjs";
import { BRANDS } from "/shared/brands.mjs";

const S = () => (window.SITE.s = window.SITE.s || { hiddenApps: [] });
const edits = () => (S().appEdits = S().appEdits || {});
const apps = () => APPS; // the OS table of apps (a global const)
const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"];
let cid = 0;

/* the icon markup used in place of the built-in artwork */
window.__customIcon = (a, E) => {
  if (!E || !E.icon) return "";
  const ic = E.icon, col = E.color || a.color || "c1", id = "ce" + ++cid;
  let art = "";
  if (ic.k === "brand" && BRANDS[ic.v]) art = `<g><path transform="translate(26 26) scale(2)" d="${BRANDS[ic.v].d}" fill="${BRANDS[ic.v].h}"/></g>`;
  else if (ic.k === "glyph" && ICONS[ic.v]) art = `<svg x="27" y="27" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--glyph)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[ic.v]}</svg>`;
  else if (ic.k === "img") art = `<clipPath id="${id}"><circle cx="50" cy="50" r="48"/></clipPath><image href="${esc(ic.v)}" x="2" y="2" width="96" height="96" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
  else return "";
  return `<span class="ico lay custom" data-i="${a.id}"><svg viewBox="0 0 100 100"><circle class="icbg" cx="50" cy="50" r="48" style="fill:var(--${col})"/><g class="art">${art}</g></svg></span>`;
};

/* names: keep each app's original title so "Reset" can bring it back */
window.__applyAppEdits = () => {
  const E = (window.SITE.s && window.SITE.s.appEdits) || {};
  apps().forEach((a) => { if (a.__t0 == null) a.__t0 = a.title; a.title = (E[a.id] && E[a.id].title) || a.__t0; });
};
const refresh = () => {
  window.__applyAppEdits();
  try { applyHidden(); drawLauncher(window.LS ? LS.value : ""); } catch {}
  Object.entries(open).forEach(([id, w]) => { const a = apps().find((x) => x.id === id); if (!a) return; const t = $(".ttl", w); if (t) { t.textContent = a.title; w.dataset.title = a.title; } const old = $(".bar > .ico", w); if (old) { const n = h("span", { html: icon(a) }).firstElementChild; n && old.replaceWith(n); } });
  window.dispatchEvent(new Event("apps-edited"));
};

function dialog(html) { const d = h("div", { class: "own-dlg ae-dlg" }); d.innerHTML = `<div class="own-card ae-card" role="dialog" aria-modal="true">${html}</div>`; document.body.append(d); d.addEventListener("pointerdown", (e) => { if (e.target === d) d.remove(); }); return d; }

window.__editApp = (id) => {
  if (!isAdmin()) return; const a = apps().find((x) => x.id === id); if (!a) return;
  const cur = { ...(edits()[id] || {}) }; let tab = cur.icon && cur.icon.k === "brand" ? "brand" : cur.icon && cur.icon.k === "img" ? "img" : "glyph";
  const d = dialog(""), card = $(".ae-card", d);
  const draw = () => {
    const prev = window.__customIcon(a, { ...cur }) || icon({ ...a, color: cur.color || a.color });
    card.innerHTML = `<div class="ae-h"><span class="ae-prev">${prev}</span><div><b>${esc(cur.title || a.__t0)}</b><small>Edit this app</small></div><button class="ae-x" aria-label="Close">${icon0("x")}</button></div>
      <label class="ae-l">Name<input class="ae-name" maxlength="30" value="${esc(cur.title || "")}" placeholder="${esc(a.__t0)}"></label>
      <div class="ae-l">Colour<div class="ae-cols">${COLORS.map((c) => `<button class="ae-col${(cur.color || a.color) === c ? " on" : ""}" data-c="${c}" style="background:var(--${c})" aria-label="Colour ${c}"></button>`).join("")}</div></div>
      <div class="ae-l">Icon<div class="seg ae-tabs"><button data-t="glyph" class="${tab === "glyph" ? "on" : ""}">Symbols</button><button data-t="brand" class="${tab === "brand" ? "on" : ""}">Brands</button><button data-t="img" class="${tab === "img" ? "on" : ""}">Picture</button></div></div>
      <div class="ae-grid" data-tab="${tab}">${tab === "glyph" ? iconNames.map((n) => `<button data-k="glyph" data-v="${n}" class="${cur.icon && cur.icon.v === n ? "on" : ""}" title="${n}">${icon0(n)}</button>`).join("")
        : tab === "brand" ? Object.keys(BRANDS).map((n) => `<button data-k="brand" data-v="${n}" class="${cur.icon && cur.icon.v === n ? "on" : ""}" title="${BRANDS[n].n}"><svg viewBox="0 0 24 24" width="22" height="22"><path d="${BRANDS[n].d}" fill="${BRANDS[n].h}"/></svg></button>`).join("")
        : `<div class="ae-up"><button class="btn tonal" data-up>Upload a picture</button><p class="hint">Your picture is used as it is, never filtered.</p></div>`}</div>
      <div class="own-row"><button class="btn tonal" data-reset>Reset to original</button><span style="flex:1"></span><button class="btn tonal" data-x>Cancel</button><button class="btn" data-save>Save</button></div>`;
    $(".ae-x", card).onclick = $("[data-x]", card).onclick = () => d.remove();
    $(".ae-name", card).oninput = (e) => { cur.title = e.target.value; $(".ae-h b", card).textContent = cur.title || a.__t0; };
    $$(".ae-col", card).forEach((b) => (b.onclick = () => { cur.color = b.dataset.c; const n = $(".ae-name", card).value; draw(); $(".ae-name", card).value = n; }));
    $$(".ae-tabs button", card).forEach((b) => (b.onclick = () => { cur.title = $(".ae-name", card).value; tab = b.dataset.t; draw(); }));
    $$(".ae-grid [data-k]", card).forEach((b) => (b.onclick = () => { cur.title = $(".ae-name", card).value; cur.icon = { k: b.dataset.k, v: b.dataset.v }; draw(); }));
    const up = $("[data-up]", card); if (up) up.onclick = async () => { try { const f = (await Up.pick("image/*"))[0]; if (!f) return; up.disabled = true; up.textContent = "Uploading…"; const r = await Up.image(f, { max: 512 }); cur.title = $(".ae-name", card).value; cur.icon = { k: "img", v: r.url }; draw(); } catch (e) { toast(e.message || "Upload failed"); draw(); } };
    $("[data-reset]", card).onclick = () => { delete edits()[id]; if (!Object.keys(edits()).length) delete S().appEdits; siteSave(); refresh(); d.remove(); toast("Back to the original"); };
    $("[data-save]", card).onclick = () => {
      const t = ($(".ae-name", card).value || "").trim().slice(0, 30), e = {}; if (t && t !== a.__t0) e.title = t; if (cur.color && cur.color !== a.color) e.color = cur.color; if (cur.icon) e.icon = cur.icon;
      if (Object.keys(e).length) edits()[id] = e; else delete edits()[id]; if (!Object.keys(edits()).length) delete S().appEdits;
      siteSave(); refresh(); d.remove(); toast("Saved");
    };
  };
  draw(); setTimeout(() => $(".ae-name", card)?.focus(), 30);
};
const icon0 = (n) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

/* the "Open to new projects" card */
const DOTS = { green: "var(--ok)", amber: "#E8A317", red: "#D93025", blue: "var(--primary)", grey: "var(--ink2)" };
window.__applyStatusDot = () => { const c = DOTS[(window.SITE.s || {}).statusDot] || ""; document.querySelectorAll(".wcard.st,.lk-s").forEach((e) => (c ? e.style.setProperty("--sdot", c) : e.style.removeProperty("--sdot"))); };
window.__editStatus = () => {
  if (!isAdmin()) return; const s = S(), cur = { status: s.status || P.status, now: s.now || P.now, dot: s.statusDot || "green" };
  const d = dialog(""), card = $(".ae-card", d);
  const draw = () => {
    card.innerHTML = `<div class="ae-h"><div><b>Status card</b><small>Shown to every visitor on the desktop</small></div><button class="ae-x" aria-label="Close">${icon0("x")}</button></div>
      <label class="ae-l">Headline<input class="ae-st" maxlength="80" value="${esc(cur.status)}"></label>
      <label class="ae-l">Message<textarea class="ae-now" rows="4" maxlength="300">${esc(cur.now)}</textarea></label>
      <div class="ae-l">Dot colour<div class="ae-cols">${Object.keys(DOTS).map((k) => `<button class="ae-col${cur.dot === k ? " on" : ""}" data-d="${k}" style="background:${DOTS[k]}" aria-label="${k}"></button>`).join("")}</div></div>
      <div class="own-row"><button class="btn tonal" data-x>Cancel</button><button class="btn" data-save>Save</button></div>`;
    $(".ae-x", card).onclick = $("[data-x]", card).onclick = () => d.remove();
    $$(".ae-col", card).forEach((b) => (b.onclick = () => { cur.status = $(".ae-st", card).value; cur.now = $(".ae-now", card).value; cur.dot = b.dataset.d; draw(); }));
    $("[data-save]", card).onclick = () => { s.status = $(".ae-st", card).value.trim().slice(0, 80) || undefined; s.now = $(".ae-now", card).value.trim().slice(0, 300) || undefined; s.statusDot = cur.dot === "green" ? undefined : cur.dot; if (!s.status) delete s.status; if (!s.now) delete s.now; if (!s.statusDot) delete s.statusDot; siteSave(); applyText(); d.remove(); toast("Saved"); };
  };
  draw();
};

/* a small pencil on the status card while you are the owner */
window.__ownerEditUI = () => {
  const card = document.querySelector(".wcard.st"); if (!card) return; let b = card.querySelector(".wedit");
  if (isAdmin()) { if (!b) { b = h("button", { class: "wx wedit", "aria-label": "Edit this card", title: "Edit this card", html: icon0("pencil"), onclick: () => window.__editStatus() }); card.append(b); } }
  else if (b) b.remove();
};
window.__applyAppEdits();

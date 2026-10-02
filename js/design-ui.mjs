// Design: the side panels. Layers (and slides) on the left, properties on the right, and the colour picker.
// Panels are redrawn from the editor's state; while you type in a box, only the other boxes are updated, so focus stays.
import { h, $, $$, esc, toast } from "/js/lib.mjs";
import { I as BI, menu } from "/js/board-canvas.mjs";
// icons: the board set, plus the shapes Design needs
export const DZ_ICONS = {
  "dz-rect": '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/>', "dz-ell": '<circle cx="12" cy="12" r="7.5"/>', "dz-tri": '<path d="M12 4.5 20 19H4z"/>',
  "dz-star": '<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>', "dz-group": '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2.4"/>',
  "dz-bool": '<circle cx="9.5" cy="12" r="5.5"/><circle cx="14.5" cy="12" r="5.5"/>', "dz-arrow": '<path d="M5 19 19 5M10 5h9v9"/>',
};
export const I = (n, s = 18) => (DZ_ICONS[n] ? `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${DZ_ICONS[n]}</svg>` : BI(n, s));
import { FONT_LIST, loadFont, rgba } from "/js/design-render.mjs";

const ICON = { frame: "frame", rect: "dz-rect", ellipse: "dz-ell", line: "minus", polygon: "dz-tri", star: "dz-star", text: "type", group: "dz-group", bool: "dz-bool" };
const r2 = (v) => Math.round((+v || 0) * 100) / 100;
const BLEND = [["normal", "Normal"], ["multiply", "Multiply"], ["screen", "Screen"], ["overlay", "Overlay"], ["darken", "Darken"], ["lighten", "Lighten"], ["color-dodge", "Colour dodge"], ["color-burn", "Colour burn"], ["hard-light", "Hard light"], ["soft-light", "Soft light"], ["difference", "Difference"], ["exclusion", "Exclusion"], ["hue", "Hue"], ["saturation", "Saturation"], ["color", "Colour"], ["luminosity", "Luminosity"]];
const WEIGHTS = [[100, "Thin"], [200, "Extra light"], [300, "Light"], [400, "Regular"], [500, "Medium"], [600, "Semibold"], [700, "Bold"], [800, "Extra bold"], [900, "Black"]];
const FX = { ds: "Drop shadow", is: "Inner shadow", lb: "Layer blur", bb: "Background blur" };

/* ---------- number boxes: type, use the arrow keys, or drag the label ---------- */
export function numField(label, value, onSet, { step = 1, min = -1e9, max = 1e9, suffix = "", title = "", wide } = {}) {
  const w = h("label", { class: "dz-num" + (wide ? " wide" : ""), title });
  const lab = h("span", { class: "dz-nl" }, label), inp = h("input", { type: "text", inputmode: "decimal", value: fmt(value) + (suffix && value !== "" ? suffix : ""), "data-num": "1", "aria-label": title || label });
  w.append(lab, inp);
  const set = (v) => { const n = Math.max(min, Math.min(max, v)); inp.value = fmt(n) + suffix; onSet(n); };
  const parse = () => { const t = inp.value.replace(suffix, "").replace(/,/g, ".").trim(); if (!t) return null; if (/^[\d+\-*/(). ]+$/.test(t)) { try { const v = Function(`"use strict";return (${t})`)(); return Number.isFinite(v) ? v : null; } catch { return null; } } return null; };
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); const v = parse(); if (v != null) set(v); inp.select(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); const v = parse() ?? 0; set(r2(v + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1))); inp.select(); }
    else if (e.key === "Escape") { inp.value = fmt(value) + suffix; inp.blur(); }
    e.stopPropagation();
  });
  inp.addEventListener("change", () => { const v = parse(); if (v != null) set(v); });
  inp.addEventListener("focus", () => setTimeout(() => inp.select(), 0));
  // drag the label sideways to change the value
  lab.addEventListener("pointerdown", (e) => {
    e.preventDefault(); const x0 = e.clientX, v0 = parse() ?? 0; let moved = false;
    const mv = (ev) => { const dx = ev.clientX - x0; if (Math.abs(dx) > 2) moved = true; if (moved) set(r2(v0 + Math.round(dx / 2) * step * (ev.shiftKey ? 10 : 1))); };
    const up2 = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up2); if (!moved) inp.focus(); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up2);
  });
  return w;
}
function fmt(v) { if (v === "" || v == null) return ""; if (v === "mixed") return "Mixed"; const n = Math.round(+v * 100) / 100; return String(n); }

/* ---------- colour picker ---------- */
const hsv2rgb = (hh, s, v) => { const f = (n) => { const k = (n + hh / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)].map((x) => Math.round(x * 255)); };
const rgb2hsv = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let hh = 0; if (d) { if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; } return [hh, mx ? d / mx : 0, mx]; };
const hex2rgb = (x) => { const n = parseInt(x.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb2hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
let openPicker = null;
export function closePicker() { if (openPicker) { openPicker.remove(); openPicker = null; } }
// value: {c, a}; onChange(c, a) live; extra: {docColors, saved, onSave}
export function colorPicker(anchor, value, onChange, extra = {}) {
  closePicker();
  let [hh, s, v] = rgb2hsv(...hex2rgb(value.c || "#000000")), a = value.a ?? 1;
  const p = h("div", { class: "dz-pick bdc", role: "dialog", "aria-label": "Colour" });
  p.innerHTML = `<div class="dz-sv"><canvas width="232" height="150"></canvas><i class="dz-svk"></i></div>
    <div class="dz-sl hue"><i></i></div><div class="dz-sl alpha"><b></b><i></i></div>
    <div class="dz-prow"><button class="dz-eye" title="Pick a colour from the screen" aria-label="Pick a colour from the screen"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 22 1-1h3l9-9M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg></button><input class="dz-hex" maxlength="7" aria-label="Hex colour"><input class="dz-al" maxlength="4" aria-label="Opacity"></div>
    ${extra.docColors && extra.docColors.length ? `<div class="dz-sws"><small>In this design</small><div>${extra.docColors.map((c) => `<button data-c="${c}" style="--c:${c}" title="${c}" aria-label="${c}"></button>`).join("")}</div></div>` : ""}
    <div class="dz-sws"><small>Saved colours</small><div>${(extra.saved || []).map((c) => `<button data-c="${c}" style="--c:${c}" title="${c}" aria-label="${c}"></button>`).join("")}<button class="dz-add" data-save title="Save this colour" aria-label="Save this colour">+</button></div></div>`;
  document.body.append(p); openPicker = p;
  const cv = $("canvas", p), cx = cv.getContext("2d"), knob = $(".dz-svk", p), hue = $(".hue", p), alpha = $(".alpha", p), hexI = $(".dz-hex", p), alI = $(".dz-al", p);
  const cur = () => rgb2hex(...hsv2rgb(hh, s, v));
  const paintSV = () => { const g1 = cx.createLinearGradient(0, 0, 232, 0); g1.addColorStop(0, "#fff"); g1.addColorStop(1, `hsl(${hh},100%,50%)`); cx.fillStyle = g1; cx.fillRect(0, 0, 232, 150); const g2 = cx.createLinearGradient(0, 0, 0, 150); g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, "#000"); cx.fillStyle = g2; cx.fillRect(0, 0, 232, 150); };
  const sync = (fire = true) => {
    paintSV(); knob.style.left = s * 100 + "%"; knob.style.top = (1 - v) * 100 + "%"; knob.style.background = cur();
    $("i", hue).style.left = (hh / 360) * 100 + "%"; $("i", alpha).style.left = a * 100 + "%"; $("b", alpha).style.background = `linear-gradient(90deg,transparent,${cur()})`;
    if (document.activeElement !== hexI) hexI.value = cur(); if (document.activeElement !== alI) alI.value = Math.round(a * 100) + "%";
    if (fire) onChange(cur(), Math.round(a * 1000) / 1000);
  };
  const drag = (el, fn) => el.addEventListener("pointerdown", (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); const go = (ev) => { fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))); sync(); }; go(e); const up2 = () => { removeEventListener("pointermove", go); removeEventListener("pointerup", up2); }; addEventListener("pointermove", go); addEventListener("pointerup", up2); });
  drag($(".dz-sv", p), (x, y) => { s = x; v = 1 - y; }); drag(hue, (x) => { hh = x * 360; }); drag(alpha, (x) => { a = Math.round(x * 100) / 100; });
  hexI.addEventListener("keydown", (e) => e.stopPropagation()); alI.addEventListener("keydown", (e) => e.stopPropagation());
  hexI.addEventListener("input", () => { let t = hexI.value.trim(); if (!t.startsWith("#")) t = "#" + t; if (/^#[0-9a-f]{3}$/i.test(t)) t = "#" + [...t.slice(1)].map((c) => c + c).join(""); if (/^#[0-9a-f]{6}$/i.test(t)) { [hh, s, v] = rgb2hsv(...hex2rgb(t)); sync(); } });
  alI.addEventListener("change", () => { const n = parseFloat(alI.value); if (Number.isFinite(n)) { a = Math.max(0, Math.min(1, n / 100)); sync(); } });
  p.addEventListener("click", async (e) => {
    const sw = e.target.closest("[data-c]"); if (sw) { [hh, s, v] = rgb2hsv(...hex2rgb(sw.dataset.c)); sync(); return; }
    if (e.target.closest("[data-save]")) { extra.onSave && extra.onSave(cur()); const b = h("button", { "data-c": cur(), style: `--c:${cur()}`, title: cur() }); e.target.closest("[data-save]").before(b); return; }
    if (e.target.closest(".dz-eye")) { if (!window.EyeDropper) return toast("This browser can't pick colours from the screen. Chrome and Edge can."); try { const r = await new EyeDropper().open(); [hh, s, v] = rgb2hsv(...hex2rgb(r.sRGBHex.length === 7 ? r.sRGBHex : rgb2hex(...(r.sRGBHex.match(/\d+/g) || [0, 0, 0]).map(Number)))); sync(); } catch {} }
  });
  const ar = anchor.getBoundingClientRect(), pw = 256, ph = p.offsetHeight;
  p.style.left = Math.max(8, Math.min(ar.left - pw - 12, innerWidth - pw - 8)) + "px";
  if (ar.left - pw - 12 < 8) p.style.left = Math.max(8, Math.min(ar.left, innerWidth - pw - 8)) + "px";
  p.style.top = Math.max(8, Math.min(ar.top - 40, innerHeight - ph - 8)) + "px";
  const out = (e) => { if (!p.isConnected) { removeEventListener("pointerdown", out, true); return; } if (!p.contains(e.target) && !anchor.contains(e.target) && !e.target.closest(".dz-gbar,.dz-pick")) { closePicker(); removeEventListener("pointerdown", out, true); } };
  setTimeout(() => addEventListener("pointerdown", out, true), 0);
  const key = (e) => { if (e.key === "Escape" && openPicker === p) { e.stopPropagation(); closePicker(); removeEventListener("keydown", key, true); } };
  addEventListener("keydown", key, true);
  sync(false);
  return p;
}

/* ================================================================================================================ */
/* left: layers and slides                                                                                          */
/* ================================================================================================================ */
const collapsed = new Set();
export function layersPanel(el, E) {
  const st = el.scrollTop;
  if (E.S.tab === "slides" && !E.ro) return slidesPanel(el, E);
  const rows = [];
  const walk = (pid, depth) => { const list = E.kids(pid).slice().reverse(); for (const n of list) { rows.push({ n, depth }); if ((n.t === "frame" || n.t === "group" || n.t === "bool") && E.kids(n.id).length && !collapsed.has(n.id)) walk(n.id, depth + 1); } };
  walk("", 0);
  el.innerHTML = rows.length ? `<div class="dz-tree" role="tree">${rows.map(({ n, depth }) => {
    const sel = E.S.sel.has(n.id), has = (n.t === "frame" || n.t === "group" || n.t === "bool") && E.kids(n.id).length;
    return `<div class="dz-row${sel ? " sel" : ""}${n.hide ? " hid" : ""}${E.S.hover === n.id ? " hov" : ""}" data-node="${n.id}" role="treeitem" aria-selected="${sel}" draggable="${E.ro ? "false" : "true"}" style="--d:${depth}">
      <button class="dz-tw${has ? "" : " none"}" data-tw tabindex="-1" aria-label="${collapsed.has(n.id) ? "Open" : "Close"}">${has ? I(collapsed.has(n.id) ? "chevron-right" : "chevron-down", 14) : ""}</button>
      <span class="dz-ri${n.mask ? " mask" : ""}">${I(n.mask ? "dz-ell" : ICON[n.t] || "dz-rect", 15)}</span><span class="dz-rn">${esc(n.name || n.t)}</span>
      ${E.ro ? "" : `<button class="dz-rb${n.lock ? " on" : ""}" data-lock tabindex="-1" title="${n.lock ? "Unlock" : "Lock"}" aria-label="${n.lock ? "Unlock" : "Lock"}">${I(n.lock ? "lock" : "unlock", 14)}</button><button class="dz-rb${n.hide ? " on" : ""}" data-eye tabindex="-1" title="${n.hide ? "Show" : "Hide"}" aria-label="${n.hide ? "Show" : "Hide"}">${I(n.hide ? "eye-off" : "eye", 14)}</button>`}
    </div>`; }).join("")}</div>` : `<p class="dz-empty">Nothing here yet. Press F for a frame, R for a rectangle, T for text, or drop pictures in.</p>`;
  el.scrollTop = st;
  if (el.__wired) return; el.__wired = true;
  el.addEventListener("click", (e) => {
    const row = e.target.closest("[data-node]"); if (!row) return; const id = row.dataset.node, n = E.N(id); if (!n) return;
    if (e.target.closest("[data-tw]")) { collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); E.panels(); return; }
    if (e.target.closest("[data-eye]")) { E.setProp({ hide: n.hide ? undefined : 1 }, [id]); return; }
    if (e.target.closest("[data-lock]")) { E.setProp({ lock: n.lock ? undefined : 1 }, [id]); return; }
    if (e.shiftKey || e.ctrlKey || e.metaKey) { const s = new Set(E.S.sel); s.has(id) ? s.delete(id) : s.add(id); E.setSel([...s]); } else E.setSel([id]);
  });
  el.addEventListener("dblclick", (e) => { const row = e.target.closest("[data-node]"); if (!row || e.target.closest("button")) return; if (E.ro) { E.zoomTo(row.dataset.node); return; } E.renameNode(row.dataset.node); });
  el.addEventListener("pointerover", (e) => { const row = e.target.closest("[data-node]"); const id = row ? row.dataset.node : null; if (E.S.hover !== id) { E.S.hover = id; E.paint(); } });
  el.addEventListener("pointerleave", () => { E.S.hover = null; E.paint(); });
  // drag rows to reorder, or onto a frame or group to put them inside
  let dragId = null;
  el.addEventListener("dragstart", (e) => { const row = e.target.closest("[data-node]"); if (!row) return; dragId = row.dataset.node; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); row.classList.add("drag"); });
  el.addEventListener("dragend", () => { dragId = null; $$(".dz-row", el).forEach((r) => r.classList.remove("drag", "drop-a", "drop-b", "drop-in")); });
  const spot = (e) => { const row = e.target.closest("[data-node]"); if (!row) return null; const r = row.getBoundingClientRect(), y = (e.clientY - r.top) / r.height, n = E.N(row.dataset.node); const canIn = n && (n.t === "frame" || n.t === "group" || n.t === "bool"); return { row, n, where: canIn && y > 0.28 && y < 0.72 ? "in" : y < 0.5 ? "a" : "b" }; };
  el.addEventListener("dragover", (e) => { if (!dragId) return; e.preventDefault(); $$(".dz-row", el).forEach((r) => r.classList.remove("drop-a", "drop-b", "drop-in")); const s = spot(e); if (s && s.n.id !== dragId) s.row.classList.add("drop-" + s.where); });
  el.addEventListener("drop", (e) => {
    e.preventDefault(); const s = spot(e); const id = dragId; dragId = null; if (!s || !id || s.n.id === id) return;
    const n = E.N(id); if (!n || E.ancestors(s.n).some((a) => a.id === id)) return;
    if (s.where === "in") { E.reorderLayer(id, s.n.id, E.kids(s.n.id).length); return; }
    const pid = s.n.parent || null, list = E.kids(pid || "").filter((x) => x.id !== id), i = list.indexOf(s.n);
    E.reorderLayer(id, pid, s.where === "a" ? i + 1 : i); // the list shows the top layer first
  });
}
function slidesPanel(el, E) {
  const ids = E.slideIds(), frames = E.kids("").filter((n) => n.t === "frame"), listed = E.D.slides.length > 0, inDeck = new Set(ids);
  el.innerHTML = `<div class="dz-slides">
    <p class="dz-hint">${listed ? "These frames make the deck, in this order. Drag to reorder." : "Every frame is a slide, left to right and top to bottom. Change the order by dragging, or take frames out."}</p>
    <div class="dz-sl-list">${ids.map((id, i) => { const n = E.N(id); return `<div class="dz-slide" data-slide="${id}" draggable="true"><span class="dz-sn">${i + 1}</span><span class="dz-st2">${esc(n.name || "Frame")}</span><small>${Math.round(n.w)} × ${Math.round(n.h)}</small><button class="dz-rb" data-play title="Present from here" aria-label="Present from here">${I("play", 14)}</button><button class="dz-rb" data-out title="Leave out of the deck" aria-label="Leave out of the deck">${I("x", 14)}</button></div>`; }).join("") || `<p class="dz-empty">Add a frame (F) to make your first slide. A 16:9 frame (1920 × 1080) fits screens best.</p>`}</div>
    ${frames.filter((f) => !inDeck.has(f.id)).length ? `<h4>Not in the deck</h4><div class="dz-sl-list">${frames.filter((f) => !inDeck.has(f.id)).map((n) => `<div class="dz-slide out" data-add="${n.id}"><span class="dz-st2">${esc(n.name || "Frame")}</span><button class="dz-rb" title="Add to the deck" aria-label="Add to the deck">${I("plus", 14)}</button></div>`).join("")}</div>` : ""}
    <div class="dz-sbtns"><button class="dz-btn primary" data-pres>${I("play", 16)}<span>Present</span></button><button class="dz-btn" data-pdf>${I("download", 16)}<span>Deck as PDF</span></button></div>
    <div class="dz-share"><b>Client link</b><p class="dz-hint">${E.meta.share ? "On. Anyone with the link can view and present the slides above. Nothing else of yours is shown." : "Off. Turn it on to send a deck that opens in any browser, view and present only."}</p><button class="dz-btn" data-share>${I("link", 16)}<span>${E.meta.share ? "Link options" : "Create a link"}</span></button></div>
  </div>`;
  let drag = null;
  el.onclick = (e) => {
    const row = e.target.closest("[data-slide]"), add = e.target.closest("[data-add]");
    if (e.target.closest("[data-pres]")) return E.startPresent(0);
    if (e.target.closest("[data-pdf]")) return ids.length ? E.exportNodes(ids, "pdf", 2) : toast("Add a frame first.");
    if (e.target.closest("[data-share]")) return E.share();
    if (add) { E.setSlides([...ids, add.dataset.add]); return; }
    if (!row) return; const id = row.dataset.slide;
    if (e.target.closest("[data-play]")) return E.startPresent(ids.indexOf(id));
    if (e.target.closest("[data-out]")) { E.setSlides(ids.filter((x) => x !== id)); return; }
    E.setSel([id]); E.zoomTo(id);
  };
  el.ondragstart = (e) => { const row = e.target.closest("[data-slide]"); if (row) { drag = row.dataset.slide; e.dataTransfer.effectAllowed = "move"; } };
  el.ondragover = (e) => { if (drag) e.preventDefault(); };
  el.ondrop = (e) => { e.preventDefault(); const row = e.target.closest("[data-slide]"); if (!drag || !row || row.dataset.slide === drag) return; const list = ids.filter((x) => x !== drag); const r = row.getBoundingClientRect(); const i = list.indexOf(row.dataset.slide) + (e.clientY > r.top + r.height / 2 ? 1 : 0); list.splice(i, 0, drag); E.setSlides(list); drag = null; };
}

/* ================================================================================================================ */
/* right: properties                                                                                                */
/* ================================================================================================================ */
export function propsPanel(el, E) {
  const s = E.selTops(), te = E.editing();
  const sig = JSON.stringify([s.map((n) => n.id + n.t + (n.fills || []).length + (n.strokes || []).length + (n.fx || []).length + (n.fills || []).map((f) => f.t).join("") + (n.auto || "")), !!te, E.S.tool]);
  const focused = el.contains(document.activeElement) && document.activeElement.matches("input,select,textarea");
  if (el.__sig === sig && focused) { syncValues(el, E); return; }
  el.__sig = sig; const st = el.scrollTop;
  el.innerHTML = ""; el.append(build(E, s, te)); el.scrollTop = st;
}
// the boxes already on screen get the new values (the one being typed in is left alone)
function syncValues(el, E) {
  const fresh = build(E, E.selTops(), E.editing());
  const now = $$("input,select", el), next = $$("input,select", fresh);
  now.forEach((inp, i) => { if (inp !== document.activeElement && next[i] && inp.type !== "file") inp.value = next[i].value; });
}
const val = (list, k, d = "") => { if (!list.length) return d; const v0 = list[0][k] ?? d; return list.every((n) => (n[k] ?? d) === v0) ? v0 : "mixed"; };
function section(title, ...kids) { const s = h("section", { class: "dz-sec" }); if (title) s.append(typeof title === "string" ? h("h3", {}, title) : title); s.append(...kids.flat().filter(Boolean)); return s; }
function head(title, onAdd, addLabel = "Add") { const d = h("div", { class: "dz-sh" }, h("h3", {}, title)); if (onAdd) d.append(h("button", { class: "dz-ib sm", title: addLabel, "aria-label": addLabel, html: I("plus", 16), onclick: onAdd })); return d; }
const row = (...k) => h("div", { class: "dz-pr" }, ...k);
const iconBtn = (ic, title, fn, on) => h("button", { class: "dz-ib sm" + (on ? " on" : ""), title, "aria-label": title, html: I(ic, 16), onclick: fn });
function select(opts, value, onSet, label) { const s = h("select", { class: "dz-sel", "aria-label": label || "" }, opts.map(([v, t]) => h("option", { value: v, ...(String(v) === String(value) ? { selected: true } : {}) }, t))); if (value === "mixed") s.prepend(h("option", { value: "mixed", selected: true, disabled: true }, "Mixed")); s.onchange = () => onSet(s.value); s.addEventListener("keydown", (e) => e.stopPropagation()); return s; }
function docColors(E) { const set = new Map(); for (const n of Object.values(E.D.nodes)) { for (const f of n.fills || []) if (f.t === "s") set.set(f.c, (set.get(f.c) || 0) + 1); for (const s of n.strokes || []) set.set(s.c, (set.get(s.c) || 0) + 1); for (const r of n.runs || []) set.set(r.c, (set.get(r.c) || 0) + 1); } return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).filter(Boolean).slice(0, 16); }
const pickerExtra = (E) => ({ docColors: docColors(E), saved: E.D.sw || [], onSave: (c) => { if (!(E.D.sw || []).includes(c)) E.setSwatches([...(E.D.sw || []), c]); } });

function build(E, s, te) {
  const wrap = h("div", { class: "dz-pp" });
  // nothing picked: the frame sizes when the frame tool is on, otherwise the canvas
  if (!s.length && !te) {
    if (E.S.tool === "frame") {
      wrap.append(section("Frame sizes", h("p", { class: "dz-hint" }, "Pick a size, or drag on the canvas to draw your own."), ...E.PRESETS.map(([g, list]) => h("div", { class: "dz-pre" }, h("small", {}, g), ...list.map(([name, w, hh]) => h("button", { class: "dz-preb", onclick: () => E.addFrame(w, hh, name) }, h("span", {}, name), h("small", {}, `${w} × ${hh}`)))))));
      return wrap;
    }
    const sw = h("button", { class: "dz-swb", style: `--c:${E.D.bg}`, "aria-label": "Canvas colour" });
    sw.onclick = () => colorPicker(sw, { c: E.D.bg, a: 1 }, (c) => { E.D.bg = c; E.paint(); sw.style.setProperty("--c", c); clearTimeout(sw.t); sw.t = setTimeout(() => E.setBg(c), 400); }, pickerExtra(E));
    wrap.append(section("Canvas", row(sw, h("span", { class: "dz-hexv" }, E.D.bg))));
    const frames = E.slideIds();
    wrap.append(section("Export", h("p", { class: "dz-hint" }, frames.length ? `Every frame (${frames.length}), or pick some first.` : "Add a frame to export it."), frames.length ? exportRows(E, frames) : null));
    wrap.append(section("Shortcuts", h("div", { class: "dz-keys" }, ...[["Frame", "F"], ["Rectangle", "R"], ["Ellipse", "O"], ["Line", "L"], ["Arrow", "⇧ L"], ["Text", "T"], ["Picture", "Ctrl ⇧ K"], ["Group", "Ctrl G"], ["Frame selection", "Ctrl Alt G"], ["Mask", "Ctrl Alt M"], ["Duplicate", "Ctrl D or Alt drag"], ["Distances", "hold Alt"], ["Zoom to fit", "⇧ 1"], ["Zoom to selection", "⇧ 2"], ["100%", "⇧ 0"], ["Align left, right, top, bottom", "Alt A D W S"], ["Centre, middle", "Alt H V"], ["Present", "Ctrl Alt Enter"]].map(([t, k]) => h("div", {}, h("span", {}, t), h("kbd", {}, k))))));
    return wrap;
  }
  const list = te ? [E.N(te.id)].filter(Boolean) : s, one = list.length === 1 ? list[0] : null;
  // align
  wrap.append(section(null, h("div", { class: "dz-align" }, ...[["al-left", "Align left (Alt A)", "l"], ["al-center", "Align centre (Alt H)", "c"], ["al-right", "Align right (Alt D)", "r"], ["al-top", "Align top (Alt W)", "t"], ["al-middle", "Align middle (Alt V)", "m"], ["al-bottom", "Align bottom (Alt S)", "b"]].map(([ic, t, k]) => iconBtn(ic, t, () => E.align(k))), iconBtn("dist-h", "Space out across", () => E.distribute("h")), iconBtn("dist-v", "Space out down", () => E.distribute("v")))));
  // frame
  if (one && one.t === "frame") {
    const presets = [["", "Size…"], ...E.PRESETS.flatMap(([g, l]) => l.map(([n, w, hh]) => [`${w}x${hh}`, `${n} · ${w} × ${hh}`]))];
    wrap.append(section("Frame", row(select(presets, "", (v) => { const [w, hh] = v.split("x").map(Number); if (w) E.setProp({ w, h: hh }); }, "Frame size"), iconBtn("refresh", "Swap width and height", () => E.setProp({ w: one.h, h: one.w }))), row(h("label", { class: "dz-chk" }, (() => { const c = h("input", { type: "checkbox", ...(one.clip !== false ? { checked: true } : {}) }); c.onchange = () => E.setProp({ clip: c.checked ? undefined : false }); return c; })(), " Clip content"))));
  }
  // position and size
  const xy = list.map((n) => ({ ...n, X: E.boxOf(n).x, Y: E.boxOf(n).y }));
  const setPos = (k) => (v) => { E.begin(); for (const n of list) { const b = E.boxOf(n), d = v - (k === "x" ? b.x : b.y); const m = (n.parent ? E.worldM(E.parentOf(n)) : new DOMMatrix()).inverse(), a = m.transformPoint(new DOMPoint(0, 0)), bb = m.transformPoint(new DOMPoint(k === "x" ? d : 0, k === "y" ? d : 0)); E.touch(n.id); n.x = r2(n.x + bb.x - a.x); n.y = r2(n.y + bb.y - a.y); } E.fitParents(list); E.commit(); };
  const keep = one && (one.keep || one.t === "text" && false);
  const setSize = (k) => (v) => { const patch = { [k]: Math.max(k === "w" || k === "h" ? (list[0].t === "line" ? -1e5 : 1) : -1e9, v) }; if (keep && one) { const r = one.w / one.h; if (k === "w") patch.h = r2(v / r); else patch.w = r2(v * r); } E.setProp(patch); };
  wrap.append(section("Layout",
    row(numField("X", val(xy, "X") === "mixed" ? "mixed" : r2(xy[0].X), setPos("x")), numField("Y", val(xy, "Y") === "mixed" ? "mixed" : r2(xy[0].Y), setPos("y"))),
    row(numField("W", val(list, "w"), setSize("w"), { min: one && one.t === "line" ? -1e5 : 1 }), numField("H", val(list, "h"), setSize("h"), { min: one && one.t === "line" ? -1e5 : 1 }), one ? iconBtn(one.keep ? "lock" : "unlock", one.keep ? "Proportions are kept" : "Keep proportions", () => E.setProp({ keep: one.keep ? undefined : 1 }), one.keep) : null),
    list.every((n) => n.t !== "line") ? row(numField("°", val(list, "rot", 0), (v) => E.setProp({ rot: ((v % 360) + 540) % 360 - 180 || undefined }), { title: "Rotation" }), list.every((n) => ["rect", "frame", "polygon", "star"].includes(n.t)) ? radiusField(E, list) : null) : null,
  ));
  if (one && one.t === "rect" && Array.isArray(one.r)) wrap.append(section(null, row(...["↖", "↗", "↘", "↙"].map((lab, i) => numField(lab, one.r[i] || 0, (v) => { const r = one.r.slice(); r[i] = Math.max(0, v); E.setProp({ r }); }, { min: 0, title: "Corner radius" })))));
  if (one && one.t === "polygon") wrap.append(section(null, row(numField("Sides", one.n || 3, (v) => E.setProp({ n: Math.round(Math.max(3, Math.min(24, v))) }), { min: 3, max: 24, wide: true }))));
  if (one && one.t === "star") wrap.append(section(null, row(numField("Points", one.n || 5, (v) => E.setProp({ n: Math.round(Math.max(3, Math.min(30, v))) }), { min: 3, max: 30 }), numField("Ratio", Math.round((one.ratio || 0.45) * 100), (v) => E.setProp({ ratio: Math.max(5, Math.min(99, v)) / 100 }), { suffix: "%", min: 5, max: 99 }))));
  if (one && one.t === "line") wrap.append(section("Line ends", row(select([["none", "None"], ["arrow", "Arrow"], ["dot", "Dot"], ["bar", "Bar"]], one.ea || "none", (v) => E.setProp({ ea: v }), "Start"), select([["none", "None"], ["arrow", "Arrow"], ["dot", "Dot"], ["bar", "Bar"]], one.eb || "none", (v) => E.setProp({ eb: v }), "End"))));
  if (list.length > 1 && list.every((n) => ["rect", "ellipse", "polygon", "star", "bool", "text"].includes(n.t))) wrap.append(section("Combine", h("div", { class: "dz-bools" }, ...[["union", "Union"], ["subtract", "Subtract"], ["intersect", "Intersect"], ["exclude", "Exclude"]].map(([k, t]) => h("button", { class: "dz-chip", onclick: () => E.groupSel("bool", k) }, t)), h("button", { class: "dz-chip", onclick: () => E.mask() }, "Mask"))));
  if (one && one.t === "bool") wrap.append(section("Boolean", select([["union", "Union"], ["subtract", "Subtract"], ["intersect", "Intersect"], ["exclude", "Exclude"]], one.op2, (v) => E.setProp({ op2: v }), "Operation")));
  // layer
  wrap.append(section("Layer", row(select(BLEND, val(list, "blend", "normal"), (v) => E.setProp({ blend: v === "normal" ? undefined : v }), "Blend mode"), numField("", val(list, "op", 1) === "mixed" ? "mixed" : Math.round((list[0].op ?? 1) * 100), (v) => E.setProp({ op: Math.max(0, Math.min(100, v)) / 100 === 1 ? undefined : Math.max(0, Math.min(100, v)) / 100 }), { suffix: "%", min: 0, max: 100, title: "Opacity" }))));
  // text
  if (list.some((n) => n.t === "text")) wrap.append(textSection(E, list.filter((n) => n.t === "text"), te));
  // fills, strokes, effects (for one kind at a time)
  if (list.every((n) => n.t !== "text" && n.t !== "group" && n.t !== "line")) wrap.append(fillSection(E, list));
  if (list.every((n) => n.t !== "group" && n.t !== "bool")) wrap.append(strokeSection(E, list));
  wrap.append(fxSection(E, list));
  // export
  wrap.append(section("Export", exportRows(E, list.map((n) => n.id))));
  return wrap;
}
function radiusField(E, list) {
  const one = list.length === 1 ? list[0] : null, v = one && Array.isArray(one.r) ? "mixed" : val(list, "r", 0);
  const f = numField("◜", v, (x) => E.setProp({ r: Math.max(0, x) || undefined }), { min: 0, title: "Corner radius" });
  const wrap = h("div", { class: "dz-rad" }, f);
  if (one && one.t === "rect") wrap.append(iconBtn("frame", Array.isArray(one.r) ? "One radius for all corners" : "A radius for each corner", () => E.setProp({ r: Array.isArray(one.r) ? one.r[0] || undefined : [one.r || 0, one.r || 0, one.r || 0, one.r || 0] }), Array.isArray(one.r)));
  return wrap;
}

/* fills */
function swatchCss(f) {
  if (f.t === "s") return rgba(f.c, f.a ?? 1);
  if (f.t === "l") return `linear-gradient(${f.ang ?? 90}deg,${f.stops.map((s) => `${rgba(s.c, s.a ?? 1)} ${s.o * 100}%`).join(",")})`;
  if (f.t === "r") return `radial-gradient(${f.stops.map((s) => `${rgba(s.c, s.a ?? 1)} ${s.o * 100}%`).join(",")})`;
  if (f.t === "i") return `center/cover no-repeat url("${f.src}")`;
  return "transparent";
}
function fillSection(E, list) {
  const fills = list[0].fills || [], same = list.every((n) => JSON.stringify(n.fills || []) === JSON.stringify(fills));
  const set = (nf) => E.setProp({ fills: nf });
  const sec = section(head("Fill", () => set([...(same ? fills : []), { t: "s", c: fills.length ? "#000000" : "#D9D9D9", a: 1 }]), "Add a fill"));
  if (!same) { sec.append(h("p", { class: "dz-hint" }, "Different fills. Add one to give them all the same.")); return sec; }
  [...fills].map((f, i) => [f, i]).reverse().forEach(([f, i]) => {
    const upd = (patch, live) => { const nf = fills.map((x, j) => (j === i ? { ...x, ...patch } : x)); if (live) { for (const n of list) n.fills = nf; E.paint(); clearTimeout(upd.t); upd.t = setTimeout(() => set(nf), 350); } else set(nf); };
    const sw = h("button", { class: "dz-swb", style: `--c:${swatchCss(f)}`, "aria-label": "Edit fill" });
    sw.onclick = () => fillEditor(E, sw, f, upd);
    const label = f.t === "s" ? h("input", { class: "dz-hexi", value: f.c.slice(1), maxlength: 6, "aria-label": "Hex colour", onkeydown: (e) => e.stopPropagation(), onchange: (e) => { const t = e.target.value.trim().replace("#", ""); if (/^[0-9a-f]{6}$/i.test(t)) upd({ c: "#" + t.toUpperCase() }); } }) : h("span", { class: "dz-ft" }, { l: "Linear", r: "Radial", i: "Picture" }[f.t]);
    sec.append(row(sw, label, numField("", Math.round((f.a ?? 1) * 100), (v) => upd({ a: Math.max(0, Math.min(100, v)) / 100 }), { suffix: "%", min: 0, max: 100, title: "Fill opacity" }), iconBtn(f.v === false ? "eye-off" : "eye", f.v === false ? "Show" : "Hide", () => upd({ v: f.v === false ? undefined : false })), iconBtn("minus", "Remove", () => set(fills.filter((_, j) => j !== i)))));
    if (f.t === "i") sec.append(row(select([["fill", "Fill"], ["fit", "Fit"], ["crop", "Crop"], ["tile", "Tile"]], f.fit || "fill", (v) => upd({ fit: v }), "Picture fit"), h("button", { class: "dz-chip", onclick: () => replaceImage(E, (src, iw, ih) => upd({ src, iw, ih })) }, "Replace")));
    if (f.t === "i" && f.fit === "crop") sec.append(row(numField("Zoom", Math.round((f.cs || 1) * 100), (v) => upd({ cs: Math.max(5, v) / 100 }), { suffix: "%", min: 5 }), numField("↔", Math.round((f.cx || 0) * 100), (v) => upd({ cx: v / 100 }), { suffix: "%", title: "Move sideways" }), numField("↕", Math.round((f.cy || 0) * 100), (v) => upd({ cy: v / 100 }), { suffix: "%", title: "Move up or down" })));
  });
  return sec;
}
function replaceImage(E, done) {
  const i = h("input", { type: "file", accept: "image/*", style: "display:none" }); document.body.append(i);
  i.onchange = async () => { const f = i.files[0]; i.remove(); if (!f) return; try { const { Up } = await import("/js/lib.mjs"); const r = await Up.image(f, { max: 2400 }); done(r.url, r.w, r.h); } catch (e) { toast(e.message || "Upload failed"); } };
  i.click();
}
// the fill editor: solid, gradient (with stops) or a picture
function fillEditor(E, anchor, f, upd) {
  const types = h("div", { class: "dz-gbar" }, ...[["s", "Solid"], ["l", "Linear"], ["r", "Radial"], ["i", "Picture"]].map(([t, l]) => h("button", { class: "dz-chip" + (f.t === t ? " on" : ""), onclick: () => switchTo(t) }, l)));
  const switchTo = (t) => {
    if (t === f.t) return; const base = f.t === "s" ? f.c : f.stops ? f.stops[0].c : "#D9D9D9";
    if (t === "s") upd({ t, c: base, a: 1, stops: undefined, ang: undefined, src: undefined });
    else if (t === "i") replaceImage(E, (src, iw, ih) => upd({ t: "i", src, iw, ih, fit: "fill", a: 1, c: undefined, stops: undefined }));
    else upd({ t, stops: f.stops || [{ o: 0, c: base, a: 1 }, { o: 1, c: "#FFFFFF", a: 1 }], ang: f.ang ?? 90, c: undefined });
    setTimeout(() => { const sw = document.querySelector(".dz-props .dz-swb"); if (sw) sw.click(); }, 120);
  };
  if (f.t === "s" || !f.t) { const p = colorPicker(anchor, { c: f.c, a: f.a ?? 1 }, (c, a) => upd({ c, a }, true), pickerExtra(E)); p.prepend(types); return; }
  if (f.t === "i") { const p = colorPicker(anchor, { c: "#000000", a: 1 }, () => {}, {}); p.innerHTML = ""; p.append(types, h("p", { class: "dz-hint" }, "Change how the picture fits in the panel on the right, or replace it.")); return; }
  // gradients: a bar of stops; click a stop to edit its colour, click the bar to add one, Delete removes the picked stop
  let cur = 0; const stops = f.stops.map((s) => ({ ...s }));
  const p = colorPicker(anchor, { c: stops[0].c, a: stops[0].a }, (c, a) => { stops[cur] = { ...stops[cur], c, a }; drawBar(); upd({ stops: stops.map((s) => ({ ...s })) }, true); }, pickerExtra(E));
  const bar = h("div", { class: "dz-gstops" }), ang = f.t === "l" ? numField("Angle", f.ang ?? 90, (v) => upd({ ang: v }), { suffix: "°" }) : null;
  const drawBar = () => {
    bar.style.background = `linear-gradient(90deg,${[...stops].sort((a, b) => a.o - b.o).map((s) => `${rgba(s.c, s.a)} ${s.o * 100}%`).join(",")})`;
    bar.innerHTML = ""; stops.forEach((s, i) => { const k = h("i", { class: i === cur ? "on" : "", style: `left:${s.o * 100}%;--c:${s.c}`, tabindex: "0", "aria-label": "Colour stop" });
      k.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); cur = i; drawBar(); reload(); const r = bar.getBoundingClientRect(); const mv = (ev) => { stops[i].o = Math.round(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * 1000) / 1000; drawBar(); upd({ stops: stops.map((x) => ({ ...x })) }, true); }; const up2 = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up2); }; addEventListener("pointermove", mv); addEventListener("pointerup", up2); });
      k.addEventListener("keydown", (e) => { if ((e.key === "Delete" || e.key === "Backspace") && stops.length > 2) { e.preventDefault(); e.stopPropagation(); stops.splice(i, 1); cur = 0; drawBar(); upd({ stops: stops.map((x) => ({ ...x })) }); } });
      bar.append(k); });
  };
  const reload = () => { const sv = stops[cur]; const hex = p.querySelector(".dz-hex"); if (hex) { hex.value = sv.c; hex.dispatchEvent(new Event("input")); } };
  bar.addEventListener("pointerdown", (e) => { if (e.target !== bar) return; const r = bar.getBoundingClientRect(), o = Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000; stops.push({ o, c: stops[cur].c, a: stops[cur].a }); cur = stops.length - 1; drawBar(); upd({ stops: stops.map((x) => ({ ...x })) }); });
  p.prepend(types, bar, ...(ang ? [h("div", { class: "dz-pr" }, ang)] : []), h("p", { class: "dz-hint sm" }, "Click the bar to add a stop. Pick a stop and press Delete to remove it."));
  drawBar();
}

/* strokes */
function strokeSection(E, list) {
  const st = list[0].strokes || [], same = list.every((n) => JSON.stringify(n.strokes || []) === JSON.stringify(st));
  const set = (ns) => E.setProp({ strokes: ns });
  const sec = section(head("Stroke", () => set([...(same ? st : []), { c: "#000000", a: 1, w: 1, al: list[0].t === "line" ? "c" : "i" }]), "Add a stroke"));
  if (!same) { sec.append(h("p", { class: "dz-hint" }, "Different strokes. Add one to give them all the same.")); return sec; }
  st.forEach((s, i) => {
    const upd = (patch, live) => { const ns = st.map((x, j) => (j === i ? { ...x, ...patch } : x)); if (live) { for (const n of list) n.strokes = ns; E.paint(); clearTimeout(upd.t); upd.t = setTimeout(() => set(ns), 350); } else set(ns); };
    const sw = h("button", { class: "dz-swb", style: `--c:${rgba(s.c, s.a ?? 1)}`, "aria-label": "Stroke colour" });
    sw.onclick = () => colorPicker(sw, { c: s.c, a: s.a ?? 1 }, (c, a) => upd({ c, a }, true), pickerExtra(E));
    sec.append(row(sw, h("input", { class: "dz-hexi", value: s.c.slice(1), maxlength: 6, "aria-label": "Hex colour", onkeydown: (e) => e.stopPropagation(), onchange: (e) => { const t = e.target.value.trim().replace("#", ""); if (/^[0-9a-f]{6}$/i.test(t)) upd({ c: "#" + t.toUpperCase() }); } }), numField("", Math.round((s.a ?? 1) * 100), (v) => upd({ a: Math.max(0, Math.min(100, v)) / 100 }), { suffix: "%", min: 0, max: 100, title: "Stroke opacity" }), iconBtn(s.v === false ? "eye-off" : "eye", s.v === false ? "Show" : "Hide", () => upd({ v: s.v === false ? undefined : false })), iconBtn("minus", "Remove", () => set(st.filter((_, j) => j !== i)))));
    sec.append(row(numField("Width", s.w, (v) => upd({ w: Math.max(0, v) }), { min: 0 }), list[0].t === "line" ? null : select([["i", "Inside"], ["c", "Centre"], ["o", "Outside"]], s.al || "i", (v) => upd({ al: v }), "Stroke position"), iconBtn("minus", s.d ? "Solid line" : "Dashed line", () => upd(s.d ? { d: undefined, g: undefined } : { d: Math.max(4, s.w * 3), g: Math.max(4, s.w * 2) }), !!s.d)));
    if (s.d) sec.append(row(numField("Dash", s.d, (v) => upd({ d: Math.max(0, v) }), { min: 0 }), numField("Gap", s.g || s.d, (v) => upd({ g: Math.max(0, v) }), { min: 0 })));
  });
  return sec;
}

/* effects */
function fxSection(E, list) {
  const fx = list[0].fx || [], same = list.every((n) => JSON.stringify(n.fx || []) === JSON.stringify(fx));
  const set = (nf) => E.setProp({ fx: nf });
  const sec = section(head("Effects", () => set([...(same ? fx : []), { t: "ds", x: 0, y: 4, b: 12, s: 0, c: "#000000", a: 0.2 }]), "Add an effect"));
  if (!same) { sec.append(h("p", { class: "dz-hint" }, "Different effects. Add one to give them all the same.")); return sec; }
  fx.forEach((e, i) => {
    const upd = (patch) => set(fx.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    sec.append(row(select(Object.entries(FX), e.t, (v) => upd({ t: v }), "Effect"), iconBtn(e.v === false ? "eye-off" : "eye", e.v === false ? "Show" : "Hide", () => upd({ v: e.v === false ? undefined : false })), iconBtn("minus", "Remove", () => set(fx.filter((_, j) => j !== i)))));
    if (e.t === "ds" || e.t === "is") {
      const sw = h("button", { class: "dz-swb", style: `--c:${rgba(e.c, e.a ?? 0.25)}`, "aria-label": "Shadow colour" });
      sw.onclick = () => colorPicker(sw, { c: e.c, a: e.a ?? 0.25 }, (c, a) => { for (const n of list) n.fx = fx.map((x, j) => (j === i ? { ...x, c, a } : x)); E.paint(); clearTimeout(sw.t); sw.t = setTimeout(() => upd({ c, a }), 350); }, pickerExtra(E));
      sec.append(row(numField("X", e.x || 0, (v) => upd({ x: v })), numField("Y", e.y || 0, (v) => upd({ y: v })), numField("Blur", e.b || 0, (v) => upd({ b: Math.max(0, v) }), { min: 0 })), row(numField("Spread", e.s || 0, (v) => upd({ s: v })), sw));
    } else sec.append(row(numField("Blur", e.b || 0, (v) => upd({ b: Math.max(0, v) }), { min: 0, wide: true })));
  });
  return sec;
}

/* text */
function textSection(E, list, te) {
  const r = te ? E.curRunStyle() : (list[0].runs || [])[0] || {}, n0 = list[0];
  const sec = section("Text");
  const fontBtn = h("button", { class: "dz-font", style: `font-family:'${r.f || "Inter"}'` }, r.f || "Inter", h("span", { html: I("chevron-down", 14) }));
  fontBtn.onclick = () => fontMenu(fontBtn, r.f || "Inter", (f) => E.textStyle({ f }));
  sec.append(row(fontBtn));
  sec.append(row(select(WEIGHTS.map(([w, t]) => [w, t]), r.w || 400, (v) => E.textStyle({ w: +v }), "Weight"), numField("", r.sz || 16, (v) => E.textStyle({ sz: Math.max(1, v) }), { min: 1, title: "Font size" })));
  sec.append(row(numField("Line", r.lh ? Math.round(r.lh * 100) : "", (v) => E.textStyle({ lh: v > 0 ? v / 100 : 0 }), { suffix: "%", min: 0, title: "Line height (empty for automatic)" }), numField("Letter", r.ls || 0, (v) => E.textStyle({ ls: v }), { title: "Letter spacing" })));
  const tc = h("button", { class: "dz-swb", style: `--c:${rgba(r.c || "#1A1A1A", r.a ?? 1)}`, "aria-label": "Text colour" });
  tc.onclick = () => colorPicker(tc, { c: r.c || "#1A1A1A", a: r.a ?? 1 }, (c, a) => { clearTimeout(tc.t); tc.t = setTimeout(() => E.textStyle({ c, a }), te ? 0 : 200); }, pickerExtra(E));
  sec.append(row(tc, h("span", { class: "dz-hexv" }, r.c || "#1A1A1A"), iconBtn("bold", "Bold (Ctrl B)", () => E.textStyle({ w: (r.w || 400) >= 600 ? 400 : 700 }), (r.w || 400) >= 600), h("button", { class: "dz-ib sm" + (r.i ? " on" : ""), title: "Italic (Ctrl I)", "aria-label": "Italic", onclick: () => E.textStyle({ i: r.i ? 0 : 1 }) }, h("i", {}, "I")), h("button", { class: "dz-ib sm" + (r.u ? " on" : ""), title: "Underline (Ctrl U)", "aria-label": "Underline", onclick: () => E.textStyle({ u: r.u ? 0 : 1 }) }, h("u", {}, "U")), h("button", { class: "dz-ib sm" + (r.st ? " on" : ""), title: "Strikethrough", "aria-label": "Strikethrough", onclick: () => E.textStyle({ st: r.st ? 0 : 1 }) }, h("s", {}, "S"))));
  sec.append(row(h("div", { class: "dz-seg" }, ...[["left", "al-left"], ["center", "al-center"], ["right", "al-right"], ["justify", "menu"]].map(([k, ic]) => iconBtn(ic, { left: "Align left", center: "Centre", right: "Align right", justify: "Justify" }[k], () => E.setProp({ ta: k }, list.map((n) => n.id)), n0.ta === k))),
    select([["none", "Aa"], ["upper", "AA"], ["lower", "aa"], ["title", "Aa Bb"]], n0.tc || "none", (v) => E.setProp({ tc: v }, list.map((n) => n.id)), "Letter case")));
  sec.append(row(h("div", { class: "dz-seg wide" }, ...[["w", "Auto width"], ["h", "Auto height"], ["fixed", "Fixed size"]].map(([k, t]) => h("button", { class: "dz-chip" + (n0.auto === k ? " on" : ""), onclick: () => E.setProp({ auto: k }, list.map((n) => n.id)) }, t)))));
  if (n0.auto === "fixed") sec.append(row(h("div", { class: "dz-seg" }, ...[["top", "al-top"], ["middle", "al-middle"], ["bottom", "al-bottom"]].map(([k, ic]) => iconBtn(ic, "Align " + k, () => E.setProp({ va: k }, list.map((n) => n.id)), n0.va === k)))));
  if (te) sec.append(h("p", { class: "dz-hint sm" }, "Select letters to style just those."));
  return sec;
}
function fontMenu(anchor, cur, onPick) {
  closePicker();
  const p = h("div", { class: "dz-pick dz-fonts bdc", role: "dialog", "aria-label": "Fonts" });
  const q = h("input", { class: "dz-fq", placeholder: "Search or type any Google Font", "aria-label": "Search fonts" });
  const list = h("div", { class: "dz-fl" });
  p.append(q, list); document.body.append(p); openPicker = p;
  const draw = () => {
    const t = q.value.trim().toLowerCase(), items = FONT_LIST.filter((f) => f.toLowerCase().includes(t));
    list.innerHTML = ""; if (t && !FONT_LIST.some((f) => f.toLowerCase() === t)) list.append(h("button", { class: "dz-fi", onclick: () => { const name = q.value.trim().replace(/\b\w/g, (c) => c.toUpperCase()); onPick(name); closePicker(); } }, `Use “${q.value.trim()}” from Google Fonts`));
    for (const f of items) { const b = h("button", { class: "dz-fi" + (f === cur ? " on" : ""), style: `font-family:'${f}',system-ui`, onclick: () => { onPick(f); closePicker(); } }, f); list.append(b); }
    // fonts load as they scroll into view, so the list shows each one in its own letters
    const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { loadFont(e.target.textContent); io.unobserve(e.target); } }), { root: list });
    $$(".dz-fi", list).forEach((b) => { if (!b.textContent.startsWith("Use")) io.observe(b); });
  };
  q.addEventListener("input", draw); q.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") closePicker(); if (e.key === "Enter") { const first = list.querySelector(".dz-fi"); if (first) first.click(); } });
  const ar = anchor.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(ar.left - 270, innerWidth - 268)) + "px"; p.style.top = Math.max(8, Math.min(ar.top - 20, innerHeight - 420)) + "px";
  const out = (e) => { if (!p.isConnected) { removeEventListener("pointerdown", out, true); return; } if (!p.contains(e.target) && !anchor.contains(e.target)) { closePicker(); removeEventListener("pointerdown", out, true); } };
  setTimeout(() => addEventListener("pointerdown", out, true), 0);
  draw(); q.focus();
}

/* export */
const EXP = { fmt: "png", scale: 2 };
function exportRows(E, ids) {
  const f = select([["png", "PNG"], ["jpg", "JPG"], ["svg", "SVG"], ["pdf", "PDF"]], EXP.fmt, (v) => { EXP.fmt = v; }, "Format");
  const s = select([[1, "1x"], [2, "2x"], [3, "3x"], [4, "4x"]], EXP.scale, (v) => { EXP.scale = +v; }, "Scale");
  const go = h("button", { class: "dz-btn wide", html: I("download", 16) + `<span>${ids.length > 1 ? `Export ${ids.length}` : "Export"}</span>`, onclick: () => E.exportNodes(ids, EXP.fmt, EXP.scale) });
  return [row(s, f), row(go)];
}

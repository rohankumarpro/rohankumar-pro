// Databases inside Docs: rows with typed properties, seen as a table, a board, a calendar or a list.
// Rows open in a side panel with all their properties and a note. Everything edits in place and saves through onChange.
import { h, $, $$, esc, toast, confirmBox } from "/js/lib.mjs";
import { icon } from "/shared/icons.mjs";

const I = (n, s = 16) => icon(n, { size: s });
export const TYPES = [["text", "Text", "text"], ["number", "Number", "numbered"], ["select", "Select", "tag"], ["multi", "Multi-select", "list"], ["status", "Status", "target"], ["date", "Date", "calendar"], ["check", "Checkbox", "checkbox"], ["url", "Link", "link"]];
const TICON = { title: "file-text", ...Object.fromEntries(TYPES.map(([k, , i]) => [k, i])) };
export const OPTC = ["grey", "blue", "green", "yellow", "orange", "red", "purple", "pink"];
const VIEWS = [["table", "Table", "table"], ["board", "Board", "columns3"], ["calendar", "Calendar", "calendar"], ["list", "List", "list"]];
const rid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDay = (k) => { if (!k) return ""; const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString([], { day: "numeric", month: "short", ...(y !== new Date().getFullYear() ? { year: "numeric" } : {}) }); };

/* starting points for a new database */
export const TEMPLATES = {
  table: () => ({ cols: [{ id: "title", name: "Name", type: "title" }, { id: "tags", name: "Tags", type: "multi", opts: [] }, { id: "date", name: "Date", type: "date" }], rows: [], view: "table" }),
  board: () => ({ cols: [{ id: "title", name: "Name", type: "title" }, { id: "status", name: "Status", type: "status", opts: [{ id: "todo", name: "To do", color: "blue" }, { id: "doing", name: "In progress", color: "yellow" }, { id: "done", name: "Done", color: "green" }] }, { id: "date", name: "Date", type: "date" }], rows: [], view: "board", group: "status" }),
  tasks: () => ({ cols: [{ id: "title", name: "Task", type: "title" }, { id: "status", name: "Status", type: "status", opts: [{ id: "todo", name: "To do", color: "blue" }, { id: "doing", name: "In progress", color: "yellow" }, { id: "done", name: "Done", color: "green" }] }, { id: "due", name: "Due", type: "date" }, { id: "prio", name: "Priority", type: "select", opts: [{ id: "low", name: "Low", color: "grey" }, { id: "med", name: "Medium", color: "orange" }, { id: "high", name: "High", color: "red" }] }], rows: [], view: "table", group: "status", dateCol: "due" }),
};
export const isDone = (db, row) => {
  const st = db.cols.find((c) => c.type === "status"), ck = db.cols.find((c) => c.type === "check");
  if (st && row.c[st.id]) { const o = st.opts.find((x) => x.id === row.c[st.id]); if (o && /done|complete|finished/i.test(o.name)) return true; }
  return !!(ck && row.c[ck.id]);
};
/* mark a row done (or not): the status column's "Done" option, else the first checkbox */
export function setDone(db, row, on) {
  const st = db.cols.find((c) => c.type === "status"), ck = db.cols.find((c) => c.type === "check");
  if (st) { const d = st.opts.find((o) => /done|complete|finished/i.test(o.name)), t = st.opts.find((o) => !/done|complete|finished/i.test(o.name)); if (on && d) row.c[st.id] = d.id; else if (!on) { if (t) row.c[st.id] = t.id; else delete row.c[st.id]; } }
  else if (ck) { if (on) row.c[ck.id] = true; else delete row.c[ck.id]; }
  row.updated = Date.now();
}

export function mountDb(host, { db, owner, onChange }) {
  const S = JSON.parse(JSON.stringify(db || TEMPLATES.table()));
  S.rows = S.rows || []; S.cols = S.cols || [];
  const st = { q: "", month: null, peek: null };
  const changed = () => onChange && onChange(S);
  const titleCol = () => S.cols.find((c) => c.type === "title") || S.cols[0];
  const col = (id) => S.cols.find((c) => c.id === id);
  const groupCol = () => col(S.group) || S.cols.find((c) => c.type === "status") || S.cols.find((c) => c.type === "select");
  const dateCol = () => col(S.dateCol) || S.cols.find((c) => c.type === "date");
  const rowTitle = (r) => r.c[titleCol().id] || "";
  const rowsShown = () => {
    let rs = S.rows.slice(); const q = st.q.trim().toLowerCase();
    if (q) rs = rs.filter((r) => S.cols.some((c) => { const v = r.c[c.id]; if (v == null) return false; if (["select", "status"].includes(c.type)) return (c.opts.find((o) => o.id === v)?.name || "").toLowerCase().includes(q); if (c.type === "multi") return v.some((x) => (c.opts.find((o) => o.id === x)?.name || "").toLowerCase().includes(q)); return String(v).toLowerCase().includes(q); }));
    if (S.sort && col(S.sort.col)) {
      const c = col(S.sort.col), k = (r) => { const v = r.c[c.id]; if (v == null) return null; if (["select", "status"].includes(c.type)) return c.opts.findIndex((o) => o.id === v); if (c.type === "multi") return v.length; if (c.type === "check") return v ? 1 : 0; return v; };
      rs.sort((a, b) => { const x = k(a), y = k(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }); return S.sort.dir === "desc" ? -r : r; });
    }
    return rs;
  };

  /* ---------- small popups ---------- */
  function pop(anchor, build, { w } = {}) {
    $$(".dbp").forEach((x) => x.remove());
    const m = h("div", { class: "dbp", role: "menu" }); if (w) m.style.width = w + "px";
    const root = host.closest(".dx") || document.body; root.append(m); build(m);
    const place = () => { const a = anchor.getBoundingClientRect(), r = root.getBoundingClientRect(); let top = a.bottom - r.top + 4; if (top + m.offsetHeight > r.height - 8) top = Math.max(8, a.top - r.top - m.offsetHeight - 4); m.style.top = top + "px"; m.style.left = Math.max(8, Math.min(a.left - r.left, r.width - m.offsetWidth - 8)) + "px"; };
    place(); m.__place = place;
    setTimeout(() => document.addEventListener("pointerdown", function f(e) { if (!m.contains(e.target) && !anchor.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", f, true); } }, true), 0);
    m.addEventListener("keydown", (e) => { if (e.key === "Escape") { m.remove(); anchor.focus && anchor.focus(); } });
    return m;
  }
  const menu = (anchor, items) => pop(anchor, (m) => { items.forEach((it) => { if (it === "-") return m.append(h("hr")); m.append(h("button", { class: it.danger ? "danger" : it.on ? "on" : "", onclick: () => { m.remove(); it.run(); }, html: `<span class="ic">${it.i ? I(it.i, 16) : ""}</span><span>${esc(it.t)}</span>${it.on ? `<span class="ck">${I("check", 15)}</span>` : ""}` })); }); });
  const chip = (o) => `<span class="dbo opt-${o.color}">${esc(o.name)}</span>`;

  /* option picker for select, status and multi cells */
  function pickOption(anchor, c, row, after) {
    pop(anchor, (m) => {
      const multi = c.type === "multi";
      const draw = (q = "") => {
        const cur = row.c[c.id], has = (id) => (multi ? (cur || []).includes(id) : cur === id);
        const list = c.opts.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
        $(".dbp-l", m).innerHTML = list.map((o) => `<button data-o="${o.id}" class="${has(o.id) ? "on" : ""}">${chip(o)}${has(o.id) ? `<span class="ck">${I("check", 15)}</span>` : ""}</button>`).join("") + (q && !c.opts.some((o) => o.name.toLowerCase() === q.toLowerCase()) && owner ? `<button data-new>${I("plus", 15)}<span>Create <b>${esc(q)}</b></span></button>` : "") + (!multi && cur && owner ? `<button data-clear class="muted">${I("x", 15)}<span>Clear</span></button>` : "");
        $$("[data-o]", m).forEach((b) => (b.onclick = () => { const id = b.dataset.o; if (multi) { const a = new Set(row.c[c.id] || []); a.has(id) ? a.delete(id) : a.add(id); if (a.size) row.c[c.id] = [...a]; else delete row.c[c.id]; draw($("input", m).value); } else { row.c[c.id] = id; m.remove(); } row.updated = Date.now(); changed(); after && after(); }));
        $("[data-new]", m)?.addEventListener("click", () => { const o = { id: rid(6), name: q.slice(0, 40), color: OPTC[(c.opts.length + 1) % OPTC.length] }; c.opts.push(o); if (multi) row.c[c.id] = [...(row.c[c.id] || []), o.id]; else row.c[c.id] = o.id; row.updated = Date.now(); changed(); if (multi) { $("input", m).value = ""; draw(); } else m.remove(); after && after(); });
        $("[data-clear]", m)?.addEventListener("click", () => { delete row.c[c.id]; changed(); m.remove(); after && after(); });
        m.__place && m.__place();
      };
      m.classList.add("dbp-opt");
      m.innerHTML = `${owner ? `<input placeholder="${c.opts.length ? "Search or create an option" : "Type a new option"}" aria-label="Option">` : ""}<div class="dbp-l"></div>`;
      const inp = $("input", m); if (inp) { inp.oninput = () => draw(inp.value.trim()); inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); ($("[data-new]", m) || $("[data-o]", m))?.click(); } }; setTimeout(() => inp.focus(), 20); }
      draw();
    }, { w: 250 });
  }

  /* ---------- cells ---------- */
  function cellHTML(c, r, where) {
    const v = r.c[c.id];
    switch (c.type) {
      case "title": return owner ? `<input class="dbc-in dbc-title" data-k="${c.id}" value="${esc(v || "")}" placeholder="Untitled" aria-label="${esc(c.name)}">` : `<span class="dbc-t">${esc(v || "Untitled")}</span>`;
      case "text": return owner ? `<input class="dbc-in" data-k="${c.id}" value="${esc(v || "")}" aria-label="${esc(c.name)}">` : `<span>${esc(v || "")}</span>`;
      case "number": return owner ? `<input class="dbc-in num" type="number" data-k="${c.id}" value="${v ?? ""}" aria-label="${esc(c.name)}">` : `<span class="num">${v ?? ""}</span>`;
      case "url": return owner ? `<span class="dbc-url"><input class="dbc-in" type="url" data-k="${c.id}" value="${esc(v || "")}" aria-label="${esc(c.name)}">${v ? `<a href="${esc(v)}" target="_blank" rel="noopener" aria-label="Open link">${I("external", 14)}</a>` : ""}</span>` : (v ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\//, ""))}</a>` : "");
      case "date": return owner ? `<input class="dbc-in" type="date" data-k="${c.id}" value="${esc(v || "")}" aria-label="${esc(c.name)}">` : `<span>${fmtDay(v)}</span>`;
      case "check": return `<input class="dbc-ck" type="checkbox" data-k="${c.id}" ${v ? "checked" : ""} ${owner ? "" : "disabled"} aria-label="${esc(c.name)}">`;
      case "select": case "status": { const o = c.opts.find((x) => x.id === v); return `<button class="dbc-pick" data-p="${c.id}" ${owner ? "" : "disabled"}>${o ? chip(o) : `<span class="dbc-ph">${owner && where === "peek" ? "Empty" : ""}</span>`}</button>`; }
      case "multi": { const os = (v || []).map((id) => c.opts.find((x) => x.id === id)).filter(Boolean); return `<button class="dbc-pick" data-p="${c.id}" ${owner ? "" : "disabled"}>${os.map(chip).join("") || `<span class="dbc-ph">${owner && where === "peek" ? "Empty" : ""}</span>`}</button>`; }
    }
    return "";
  }
  function wireCells(el, r, after) {
    $$("[data-k]", el).forEach((inp) => {
      const c = col(inp.dataset.k); if (!c) return;
      const set = () => { let v = c.type === "check" ? inp.checked : inp.value; if (c.type === "number") v = inp.value === "" ? null : +inp.value; if (v === "" || v == null || v === false) delete r.c[c.id]; else r.c[c.id] = v; r.updated = Date.now(); changed(); };
      if (c.type === "check" || c.type === "date") inp.onchange = () => { set(); after && after(); }; else { inp.oninput = set; inp.onchange = () => after && after("soft"); }
      if (c.type === "title") inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); if (inp.closest(".dbt")) addRow({}, true); } };
    });
    $$("[data-p]", el).forEach((b) => (b.onclick = () => pickOption(b, col(b.dataset.p), r, () => after && after())));
  }

  /* ---------- rows ---------- */
  function addRow(preset = {}, focusIt, peek) {
    if (!owner) return;
    const r = { id: rid(10), c: { ...preset }, created: Date.now(), updated: Date.now() };
    S.rows.push(r); changed(); render();
    if (focusIt) setTimeout(() => { const i = $(`[data-row="${r.id}"] .dbc-title`, host); i && i.focus(); }, 30);
    if (peek) openPeek(r.id, true);
    return r;
  }
  async function delRow(id) { if (!(await confirmBox("Delete this row?", "Delete"))) return; S.rows = S.rows.filter((r) => r.id !== id); changed(); closePeek(); render(); }
  function rowMenu(anchor, r) {
    menu(anchor, [{ t: "Open", i: "panel-left", run: () => openPeek(r.id) }, ...(owner ? [{ t: "Duplicate", i: "copy", run: () => { const n = JSON.parse(JSON.stringify(r)); n.id = rid(10); n.created = n.updated = Date.now(); S.rows.splice(S.rows.indexOf(r) + 1, 0, n); changed(); render(); } }, "-", { t: "Delete", i: "trash", danger: true, run: () => delRow(r.id) }] : [])]);
  }

  /* ---------- columns ---------- */
  function addCol(type) {
    const names = { text: "Text", number: "Number", select: "Select", multi: "Tags", status: "Status", date: "Date", check: "Done", url: "Link" };
    let n = names[type] || "Property", k = 2; while (S.cols.some((c) => c.name === n)) n = (names[type] || "Property") + " " + k++;
    const c = { id: rid(6), name: n, type }; if (["select", "multi", "status"].includes(type)) c.opts = type === "status" ? [{ id: "todo", name: "To do", color: "blue" }, { id: "doing", name: "In progress", color: "yellow" }, { id: "done", name: "Done", color: "green" }] : [];
    S.cols.push(c); changed(); render(); return c;
  }
  function colMenu(anchor, c) {
    pop(anchor, (m) => {
      m.innerHTML = `${owner ? `<input class="dbp-name" value="${esc(c.name)}" aria-label="Property name" maxlength="60">` : ""}<div class="dbp-l"></div>`;
      const nm = $(".dbp-name", m); if (nm) { nm.oninput = () => { c.name = nm.value; changed(); const t = $(`th[data-c="${c.id}"] .dbh-n`, host); if (t) t.textContent = c.name; }; nm.onkeydown = (e) => { if (e.key === "Enter") m.remove(); }; }
      const L = $(".dbp-l", m), btn = (t, ic, run, cls = "") => L.append(h("button", { class: cls, html: `<span class="ic">${I(ic, 16)}</span><span>${esc(t)}</span>`, onclick: run }));
      btn("Sort ascending", "arrow-up", () => { S.sort = { col: c.id, dir: "asc" }; changed(); m.remove(); render(); }, S.sort && S.sort.col === c.id && S.sort.dir === "asc" ? "on" : "");
      btn("Sort descending", "arrow-down", () => { S.sort = { col: c.id, dir: "desc" }; changed(); m.remove(); render(); }, S.sort && S.sort.col === c.id && S.sort.dir === "desc" ? "on" : "");
      if (S.sort && S.sort.col === c.id) btn("Clear sort", "x", () => { delete S.sort; changed(); m.remove(); render(); });
      if (!owner) return;
      if (["select", "multi", "status"].includes(c.type)) btn("Edit options", "tag", () => { m.remove(); optEditor(anchor, c); });
      if (c.type !== "title") {
        L.append(h("hr"));
        L.append(h("div", { class: "dbp-h" }, "Type"));
        TYPES.forEach(([k, t, ic]) => btn(t, ic, () => changeType(c, k), c.type === k ? "on" : ""));
        L.append(h("hr"));
        btn("Delete property", "trash", async () => { m.remove(); if (!(await confirmBox(`Delete “${c.name}” and its values in every row?`, "Delete"))) return; S.cols = S.cols.filter((x) => x !== c); S.rows.forEach((r) => delete r.c[c.id]); if (S.group === c.id) delete S.group; if (S.dateCol === c.id) delete S.dateCol; if (S.sort && S.sort.col === c.id) delete S.sort; changed(); render(); }, "danger");
      }
      setTimeout(() => nm && nm.select(), 20);
    }, { w: 240 });
  }
  function changeType(c, type) {
    if (c.type === type) return; const old = c.type;
    const toText = (v) => { if (v == null) return v; if (["select", "status"].includes(old)) return c.opts.find((o) => o.id === v)?.name; if (old === "multi") return v.map((x) => c.opts.find((o) => o.id === x)?.name).filter(Boolean).join(", "); return String(v); };
    if (["select", "multi", "status"].includes(type)) {
      const opts = ["select", "multi", "status"].includes(old) ? c.opts : []; const byName = new Map(opts.map((o) => [o.name.toLowerCase(), o]));
      S.rows.forEach((r) => { const v = r.c[c.id]; if (v == null) return; const names = ["select", "status", "multi"].includes(old) ? [].concat(v).map((x) => opts.find((o) => o.id === x)?.name).filter(Boolean) : String(v).split(",").map((x) => x.trim()).filter(Boolean);
        const ids = names.map((n) => { let o = byName.get(n.toLowerCase()); if (!o) { o = { id: rid(6), name: n.slice(0, 40), color: OPTC[(byName.size + 1) % OPTC.length] }; byName.set(n.toLowerCase(), o); } return o.id; });
        if (!ids.length) delete r.c[c.id]; else r.c[c.id] = type === "multi" ? ids : ids[0]; });
      c.opts = [...byName.values()];
    } else {
      S.rows.forEach((r) => { const t = toText(r.c[c.id]); let v = t;
        if (type === "number") v = t != null && t !== "" && Number.isFinite(+t) ? +t : undefined;
        else if (type === "check") v = t === "true" || t === "1" || t === "yes" ? true : undefined;
        else if (type === "date") v = /^\d{4}-\d{2}-\d{2}$/.test(t || "") ? t : undefined;
        else if (type === "url") v = /^(https?:\/\/|mailto:)/i.test(t || "") ? t : undefined;
        if (v == null || v === "") delete r.c[c.id]; else r.c[c.id] = v; });
      delete c.opts;
    }
    c.type = type; if (S.group === c.id && !["select", "status"].includes(type)) delete S.group; if (S.dateCol === c.id && type !== "date") delete S.dateCol;
    changed(); $$(".dbp").forEach((x) => x.remove()); render();
  }
  function optEditor(anchor, c) {
    pop(anchor, (m) => {
      const draw = () => {
        m.innerHTML = `<div class="dbp-h">Options</div><div class="dbp-ol">${c.opts.map((o, i) => `<div class="dbp-or" data-i="${i}"><button class="dbp-sw opt-${o.color}" data-col aria-label="Colour"></button><input value="${esc(o.name)}" maxlength="40" aria-label="Option name"><button class="dbp-x" data-del aria-label="Delete option">${I("x", 14)}</button></div>`).join("")}</div><button class="dbp-add">${I("plus", 15)}<span>Add an option</span></button>`;
        $$(".dbp-or", m).forEach((row) => { const o = c.opts[+row.dataset.i];
          $("input", row).oninput = (e) => { o.name = e.target.value; changed(); };
          $("[data-col]", row).onclick = () => { o.color = OPTC[(OPTC.indexOf(o.color) + 1) % OPTC.length]; changed(); draw(); render(); };
          $("[data-del]", row).onclick = () => { c.opts = c.opts.filter((x) => x !== o); S.rows.forEach((r) => { const v = r.c[c.id]; if (v === o.id) delete r.c[c.id]; else if (Array.isArray(v)) { const a = v.filter((x) => x !== o.id); if (a.length) r.c[c.id] = a; else delete r.c[c.id]; } }); changed(); draw(); render(); };
        });
        $(".dbp-add", m).onclick = () => { c.opts.push({ id: rid(6), name: "Option " + (c.opts.length + 1), color: OPTC[(c.opts.length + 1) % OPTC.length] }); changed(); draw(); const ins = $$(".dbp-or input", m); ins[ins.length - 1]?.select(); };
        m.__place && m.__place();
      };
      draw();
    }, { w: 270 });
    // names typed here show in the table once the menu closes
    const obs = new MutationObserver(() => { if (!document.contains($(".dbp-ol")?.closest(".dbp"))) { obs.disconnect(); render(); } }); obs.observe(host.closest(".dx") || document.body, { childList: true });
  }

  /* ---------- views ---------- */
  function render(keepPeek) {
    const v = S.view || "table", rs = rowsShown();
    host.innerHTML = `<div class="dbv"><div class="dbv-bar"><div class="dbv-tabs" role="tablist">${VIEWS.map(([k, t, ic]) => `<button role="tab" data-v="${k}" aria-selected="${v === k}" class="${v === k ? "on" : ""}">${I(ic, 15)}<span>${t}</span></button>`).join("")}</div><span class="sp"></span>
      <label class="dbv-q">${I("search", 15)}<input type="search" placeholder="Search" value="${esc(st.q)}" aria-label="Search rows"></label>
      ${owner ? `<button class="btn dbv-new">${I("plus", 15)}<span>New</span></button>` : ""}</div>
      <div class="dbv-body" data-view="${v}"></div></div>`;
    $$("[data-v]", host).forEach((b) => (b.onclick = () => { S.view = b.dataset.v; changed(); render(); }));
    const q = $(".dbv-q input", host); q.oninput = () => { st.q = q.value; const pos = q.selectionStart; render(); const q2 = $(".dbv-q input", host); q2.focus(); q2.setSelectionRange(pos, pos); };
    $(".dbv-new", host)?.addEventListener("click", () => { const pre = {}; if (v === "calendar" && dateCol()) pre[dateCol().id] = dayKey(new Date()); if (v === "board" && groupCol() && groupCol().opts[0]) pre[groupCol().id] = groupCol().opts[0].id; addRow(pre, v === "table", v !== "table"); });
    const body = $(".dbv-body", host);
    if (v === "board") board(body, rs); else if (v === "calendar") calendar(body, rs); else if (v === "list") list(body, rs); else table(body, rs);
    if (st.peek && !keepPeek) drawPeek();
  }
  function table(body, rs) {
    const cols = S.cols;
    body.innerHTML = `<div class="dbt-wrap"><table class="dbt"><thead><tr>${cols.map((c) => `<th data-c="${c.id}" style="${c.w ? `width:${c.w}px` : ""}"><button class="dbh">${I(TICON[c.type] || "text", 14)}<span class="dbh-n">${esc(c.name)}</span>${S.sort && S.sort.col === c.id ? I(S.sort.dir === "asc" ? "arrow-up" : "arrow-down", 13) : ""}</button></th>`).join("")}${owner ? `<th class="dbh-add"><button aria-label="Add a property" title="Add a property">${I("plus", 15)}</button></th>` : ""}</tr></thead>
      <tbody>${rs.map((r) => `<tr data-row="${r.id}">${cols.map((c) => `<td class="t-${c.type}">${c.type === "title" ? `<div class="dbc-tw">${cellHTML(c, r)}<button class="dbc-open" data-open aria-label="Open">${I("panel-left", 14)}<span>Open</span></button></div>` : cellHTML(c, r)}</td>`).join("")}${owner ? `<td class="dbc-more"><button aria-label="Row options">${I("more", 15)}</button></td>` : ""}</tr>`).join("")}</tbody></table>
      ${owner ? `<button class="dbt-add">${I("plus", 15)}<span>New row</span></button>` : ""}${!rs.length ? `<p class="dbv-none">${st.q ? "No rows match." : owner ? "No rows yet." : "Nothing here yet."}</p>` : ""}<div class="dbt-foot">${rs.length} ${rs.length === 1 ? "row" : "rows"}</div></div>`;
    $$("th[data-c] .dbh", body).forEach((b) => (b.onclick = () => colMenu(b, col(b.closest("th").dataset.c))));
    $(".dbh-add button", body)?.addEventListener("click", (e) => menu(e.currentTarget, TYPES.map(([k, t, ic]) => ({ t, i: ic, run: () => { const c = addCol(k); setTimeout(() => { const th = $(`th[data-c="${c.id}"] .dbh`, host); th && colMenu(th, c); }, 30); } }))));
    $$("tr[data-row]", body).forEach((tr) => { const r = S.rows.find((x) => x.id === tr.dataset.row); wireCells(tr, r, (soft) => { if (!soft) render(); }); $("[data-open]", tr).onclick = () => openPeek(r.id); $(".dbc-more button", tr)?.addEventListener("click", (e) => rowMenu(e.currentTarget, r)); });
    $(".dbt-add", body)?.addEventListener("click", () => addRow({}, true));
    // drag a column edge to resize it
    if (owner) $$("th[data-c]", body).forEach((th) => { const g = h("span", { class: "dbh-rz", "aria-hidden": "true" }); th.append(g); g.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); const c = col(th.dataset.c), x0 = e.clientX, w0 = th.offsetWidth; const mv = (ev) => { c.w = Math.max(80, Math.min(640, w0 + ev.clientX - x0)); th.style.width = c.w + "px"; }; const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); changed(); }; addEventListener("pointermove", mv); addEventListener("pointerup", up); }; });
  }
  function cardHTML(r) {
    const extras = S.cols.filter((c) => c.type !== "title" && c.id !== (groupCol() || {}).id && r.c[c.id] != null).slice(0, 4).map((c) => { const v = r.c[c.id];
      if (["select", "status"].includes(c.type)) { const o = c.opts.find((x) => x.id === v); return o ? chip(o) : ""; }
      if (c.type === "multi") return v.map((id) => c.opts.find((x) => x.id === id)).filter(Boolean).map(chip).join("");
      if (c.type === "date") return `<span class="dbk-d">${I("calendar", 12)}${fmtDay(v)}</span>`;
      if (c.type === "check") return `<span class="dbk-d">${I("checkbox", 12)}${esc(c.name)}</span>`;
      return `<span class="dbk-x">${esc(String(v)).slice(0, 60)}</span>`; }).join("");
    return `<div class="dbk-card" data-row="${r.id}" tabindex="0"><b>${esc(rowTitle(r) || "Untitled")}</b>${extras ? `<div class="dbk-p">${extras}</div>` : ""}</div>`;
  }
  function board(body, rs) {
    const g = groupCol();
    if (!g) { body.innerHTML = `<div class="dbv-empty"><p>A board groups rows by a Status or Select property.</p>${owner ? '<button class="btn tonal">Add a Status property</button>' : ""}</div>`; $(".btn", body)?.addEventListener("click", () => { const c = addCol("status"); S.group = c.id; changed(); render(); }); return; }
    if (S.group !== g.id) S.group = g.id;
    const groups = [...g.opts.map((o) => ({ o, id: o.id })), { o: null, id: "" }].filter((x) => x.o || rs.some((r) => !r.c[g.id]));
    const opts = S.cols.filter((c) => ["select", "status"].includes(c.type));
    body.innerHTML = `${opts.length > 1 ? `<div class="dbk-by">Group by <button class="dbk-g">${esc(g.name)}${I("chevron-down", 13)}</button></div>` : ""}<div class="dbk">${groups.map(({ o, id }) => { const items = rs.filter((r) => (r.c[g.id] || "") === id); return `<section class="dbk-col" data-g="${id}"><header>${o ? chip(o) : `<span class="dbo opt-grey">No ${esc(g.name.toLowerCase())}</span>`}<small>${items.length}</small></header><div class="dbk-list">${items.map(cardHTML).join("")}</div>${owner ? `<button class="dbk-add" data-add="${id}">${I("plus", 14)}<span>New</span></button>` : ""}</section>`; }).join("")}${owner ? `<button class="dbk-newg" aria-label="Add a group">${I("plus", 16)}<span>Add a group</span></button>` : ""}</div>`;
    $(".dbk-g", body)?.addEventListener("click", (e) => menu(e.currentTarget, opts.map((c) => ({ t: c.name, i: TICON[c.type], on: c.id === g.id, run: () => { S.group = c.id; changed(); render(); } }))));
    $$("[data-add]", body).forEach((b) => (b.onclick = () => addRow(b.dataset.add ? { [g.id]: b.dataset.add } : {}, false, true)));
    $(".dbk-newg", body)?.addEventListener("click", () => { g.opts.push({ id: rid(6), name: "New group", color: OPTC[(g.opts.length + 1) % OPTC.length] }); changed(); render(); setTimeout(() => { const th = $(".dbk-col:nth-last-of-type(1) header", host); }, 0); toast("Group added. Rename it from the property's options."); });
    $$(".dbk-card", body).forEach((cd) => {
      cd.onclick = () => { if (!cd.__dragged) openPeek(cd.dataset.row); };
      cd.onkeydown = (e) => { if (e.key === "Enter") openPeek(cd.dataset.row); };
      if (!owner) return;
      cd.onpointerdown = (e) => {
        if (e.button !== 0) return; const r = S.rows.find((x) => x.id === cd.dataset.row), x0 = e.clientX, y0 = e.clientY; let ghost = null, over = null; cd.__dragged = false;
        const mv = (ev) => {
          if (!ghost) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; cd.__dragged = true; const b = cd.getBoundingClientRect(); ghost = cd.cloneNode(true); ghost.classList.add("dbk-ghost"); Object.assign(ghost.style, { width: b.width + "px", left: b.left + "px", top: b.top + "px" }); document.body.append(ghost); cd.classList.add("dbk-src"); ghost.__dx = b.left - x0; ghost.__dy = b.top - y0; }
          ghost.style.left = ev.clientX + ghost.__dx + "px"; ghost.style.top = ev.clientY + ghost.__dy + "px";
          const el = document.elementFromPoint(ev.clientX, ev.clientY), c = el && el.closest(".dbk-col"); if (over !== c) { over && over.classList.remove("over"); over = c; c && c.classList.add("over"); }
        };
        const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
          if (ghost) { ghost.remove(); cd.classList.remove("dbk-src"); over && over.classList.remove("over");
            if (over && (r.c[g.id] || "") !== over.dataset.g) { if (over.dataset.g) r.c[g.id] = over.dataset.g; else delete r.c[g.id]; r.updated = Date.now(); changed(); render(); } }
          setTimeout(() => (cd.__dragged = false), 0); };
        addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
      };
    });
  }
  function calendar(body, rs) {
    const dc = dateCol();
    if (!dc) { body.innerHTML = `<div class="dbv-empty"><p>A calendar places rows on their date.</p>${owner ? '<button class="btn tonal">Add a Date property</button>' : ""}</div>`; $(".btn", body)?.addEventListener("click", () => { const c = addCol("date"); S.dateCol = c.id; changed(); render(); }); return; }
    const now = new Date(), m0 = st.month || new Date(now.getFullYear(), now.getMonth(), 1); st.month = m0;
    const first = (m0.getDay() + 6) % 7, days = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate(), today = dayKey(now);
    const cells = []; for (let i = 0; i < first; i++) cells.push(null); for (let d = 1; d <= days; d++) cells.push(new Date(m0.getFullYear(), m0.getMonth(), d)); while (cells.length % 7) cells.push(null);
    const by = {}; rs.forEach((r) => { const k = r.c[dc.id]; if (k) (by[k] = by[k] || []).push(r); });
    const undated = rs.filter((r) => !r.c[dc.id]).length;
    body.innerHTML = `<div class="dbc-h"><b>${m0.toLocaleDateString([], { month: "long", year: "numeric" })}</b><span class="sp"></span><button class="dx-b" data-m="0">Today</button><button class="dx-b icon" data-m="-1" aria-label="Previous month">${I("chevron-left", 17)}</button><button class="dx-b icon" data-m="1" aria-label="Next month">${I("chevron-right", 17)}</button></div>
      <div class="dbcal">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="dbcal-w">${d}</div>`).join("")}${cells.map((d) => { if (!d) return '<div class="dbcal-d off"></div>'; const k = dayKey(d), items = by[k] || []; return `<div class="dbcal-d${k === today ? " today" : ""}" data-day="${k}"><span class="n">${d.getDate()}</span>${owner ? `<button class="dbcal-add" data-new="${k}" aria-label="Add on ${k}">${I("plus", 13)}</button>` : ""}${items.slice(0, 4).map((r) => `<button class="dbcal-it${isDone(S, r) ? " done" : ""}" data-row="${r.id}">${esc(rowTitle(r) || "Untitled")}</button>`).join("")}${items.length > 4 ? `<small>+${items.length - 4} more</small>` : ""}</div>`; }).join("")}</div>
      ${undated ? `<p class="dbv-none">${undated} ${undated === 1 ? "row has" : "rows have"} no ${esc(dc.name.toLowerCase())}.</p>` : ""}`;
    $$("[data-m]", body).forEach((b) => (b.onclick = () => { const d = +b.dataset.m; st.month = d ? new Date(m0.getFullYear(), m0.getMonth() + d, 1) : null; render(); }));
    $$("[data-row]", body).forEach((b) => (b.onclick = () => openPeek(b.dataset.row)));
    $$("[data-new]", body).forEach((b) => (b.onclick = () => addRow({ [dc.id]: b.dataset.new }, false, true)));
  }
  function list(body, rs) {
    body.innerHTML = `<div class="dbl">${rs.map((r) => `<button class="dbl-r" data-row="${r.id}"><span class="dbl-t">${esc(rowTitle(r) || "Untitled")}</span><span class="dbl-p">${cardHTML(r).match(/<div class="dbk-p">([\s\S]*)<\/div><\/div>$/)?.[1] || ""}</span></button>`).join("") || `<p class="dbv-none">${st.q ? "No rows match." : "No rows yet."}</p>`}</div>${owner ? `<button class="dbt-add">${I("plus", 15)}<span>New row</span></button>` : ""}`;
    $$("[data-row]", body).forEach((b) => (b.onclick = () => openPeek(b.dataset.row)));
    $(".dbt-add", body)?.addEventListener("click", () => addRow({}, false, true));
  }

  /* ---------- the row panel ---------- */
  function openPeek(id, fresh) { st.peek = id; drawPeek(fresh); }
  function closePeek() { st.peek = null; $(".dbpk", host.closest(".dx") || host)?.remove(); }
  function drawPeek(fresh) {
    const root = host.closest(".dx") || host, r = S.rows.find((x) => x.id === st.peek); let pk = $(".dbpk", root);
    if (!r) { pk && pk.remove(); st.peek = null; return; }
    if (!pk) { pk = h("aside", { class: "dbpk", role: "dialog", "aria-label": "Row" }); root.append(pk); }
    const tc = titleCol();
    pk.innerHTML = `<div class="dbpk-top"><button class="dx-b icon" data-x aria-label="Close">${I("x", 17)}</button><span class="sp"></span>${owner ? `<button class="dx-b icon" data-more aria-label="More">${I("more", 17)}</button>` : ""}</div>
      <div class="dbpk-in">${owner ? `<textarea class="dbpk-title" rows="1" placeholder="Untitled" maxlength="2000" aria-label="${esc(tc.name)}">${esc(r.c[tc.id] || "")}</textarea>` : `<h2>${esc(r.c[tc.id] || "Untitled")}</h2>`}
      <div class="dbpk-props">${S.cols.filter((c) => c.type !== "title").map((c) => `<div class="dbpk-r"><span class="dbpk-l">${I(TICON[c.type], 14)}<span>${esc(c.name)}</span></span><div class="dbpk-v t-${c.type}">${cellHTML(c, r, "peek")}</div></div>`).join("")}
      ${owner ? `<button class="dbpk-addp">${I("plus", 14)}<span>Add a property</span></button>` : ""}</div>
      <label class="dbpk-nl">Notes</label>${owner ? `<textarea class="dbpk-note" rows="6" placeholder="Write anything about this…" maxlength="20000">${esc(r.note || "")}</textarea>` : `<p class="dbpk-notev">${esc(r.note || "")}</p>`}
      <p class="dbpk-meta">Created ${new Date(r.created).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p></div>`;
    $("[data-x]", pk).onclick = closePeek;
    $("[data-more]", pk)?.addEventListener("click", (e) => rowMenu(e.currentTarget, r));
    const t = $(".dbpk-title", pk); if (t) { const fit = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }; setTimeout(fit, 0); t.oninput = () => { if (t.value) r.c[tc.id] = t.value; else delete r.c[tc.id]; r.updated = Date.now(); fit(); changed(); const cell = $(`tr[data-row="${r.id}"] .dbc-title`, host); if (cell) cell.value = t.value; }; t.onchange = () => render(true); if (fresh) setTimeout(() => t.focus(), 40); }
    wireCells($(".dbpk-props", pk), r, () => { render(); });
    const n = $(".dbpk-note", pk); if (n) n.oninput = () => { r.note = n.value; r.updated = Date.now(); changed(); };
    $(".dbpk-addp", pk)?.addEventListener("click", (e) => menu(e.currentTarget, TYPES.map(([k, tt, ic]) => ({ t: tt, i: ic, run: () => addCol(k) }))));
    pk.onkeydown = (e) => { if (e.key === "Escape" && !$(".dbp")) closePeek(); };
  }

  render();
  return { get: () => S, render, destroy: () => { closePeek(); $$(".dbp").forEach((x) => x.remove()); }, addRow };
}

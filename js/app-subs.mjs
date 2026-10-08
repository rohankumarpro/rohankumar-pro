// Subscriptions and payments: what you pay for, what it costs a month and a year, what renews next, and what was
// found in your email receipts (accept or dismiss each one). Everything lives in the Subscriptions database
// (Workspace), so it can also be opened as a table or a calendar there. Owner only.
import { h, esc, api, toast, isAdmin, confirmBox, mobile } from "/js/lib.mjs";
import { R } from "/js/os-ext.mjs";
import { WS, DB, fmtNum, fmtDate, parseDay, ymd, today, rid } from "/js/ws-core.mjs";
import { WI, popover, closePop, choose } from "/js/ws-db.mjs";

if (!document.querySelector('link[href="/css/planner.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "/css/planner.css" }));
const CYCLE_DAYS = { Weekly: 7, Monthly: 30.4375, Quarterly: 91.3125, "Half-yearly": 182.625, Yearly: 365.25 };
const PER_MONTH = { Weekly: 52 / 12, Monthly: 1, Quarterly: 1 / 3, "Half-yearly": 1 / 6, Yearly: 1 / 12 };
const addCycle = (day, cyc) => { const d = parseDay(day); if (cyc === "Weekly") d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + ({ Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 }[cyc] || 1)); return ymd(d); };
const SYM = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
const money = (n, c) => fmtNum(Math.round(n * 100) / 100, { INR: "inr", USD: "usd", EUR: "eur", GBP: "gbp" }[c] || "plain");

export async function subsApp(body) {
  if (!isAdmin()) { body.innerHTML = '<p class="hint" style="padding:24px">Subscriptions are private. Sign in as the owner.</p>'; return; }
  body.classList.add("sb2-body");
  body.innerHTML = '<div class="sb2"><div class="wd-load"><span class="rb-spin"></span></div></div>';
  const meta = await WS.ensure("subs"); const root = body.firstElementChild;
  if (!meta) { root.innerHTML = '<p class="hint">Could not open Subscriptions. Check your connection.</p>'; return; }
  const id = meta.id, S = { g: null, scanning: false, tab: "active" };
  const doc = () => DB.get(id);
  const P = (name) => doc().props.find((p) => p.name === name);
  const opt = (p, name) => p && (p.opts || []).find((o) => o.name.toLowerCase() === String(name || "").toLowerCase());
  const optName = (p, v) => (p && (p.opts || []).find((o) => o.id === v)?.name) || "";
  const row2sub = (r) => ({ r, name: r.title || "Untitled", amount: +r.v[P("Amount")?.id] || 0, cur: optName(P("Currency"), r.v[P("Currency")?.id]) || "INR", cycle: optName(P("Cycle"), r.v[P("Cycle")?.id]) || "Monthly", next: String(r.v[P("Next charge")?.id] || "").slice(0, 10), status: optName(P("Status"), r.v[P("Status")?.id]) || "Active", cat: optName(P("Category"), r.v[P("Category")?.id]), pay: r.v[P("Paid with")?.id] || "", link: r.v[P("Manage or cancel")?.id] || "", from: r.v[P("Found in")?.id] || "" });

  // a renewal date that has passed moves on by one cycle (and is saved), so "next charge" is always in the future
  function rollForward() {
    const ops = [], td = today();
    for (const r of Object.values(doc().rows)) { const s = row2sub(r); if (!s.next || s.next >= td || s.status === "Cancelled") continue; let n = s.next, k = 0; while (n < td && k++ < 400) n = addCycle(n, s.cycle); ops.push({ op: "row", row: { id: r.id, v: { [P("Next charge").id]: n } } }); }
    if (ops.length) DB.ops(id, ops);
    return ops.length > 0;
  }
  const list = () => Object.values(doc().rows).map(row2sub);

  function draw() {
    if (!doc()) return;
    if (rollForward()) return; // the dates moved on: drawn again when the change lands
    const all = list(), live = all.filter((s) => s.status !== "Cancelled"), td = today();
    const totals = {}; for (const s of live) { if (!s.amount) continue; const t = (totals[s.cur] ||= { m: 0, y: 0 }); t.m += s.amount * (PER_MONTH[s.cycle] || 1); t.y += s.amount * (PER_MONTH[s.cycle] || 1) * 12; }
    const soon = live.filter((s) => s.next).sort((a, b) => a.next.localeCompare(b.next));
    const in7 = soon.filter((s) => s.next <= ymd(new Date(Date.now() + 7 * 864e5)));
    const sug = (S.g && S.g.subs || []).filter((x) => !all.some((s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, "") === x.key));
    const shown = S.tab === "active" ? live : all.filter((s) => s.status === "Cancelled");
    root.innerHTML = `
      <header class="sb2-h"><div><h2>Subscriptions</h2><p>${live.length} active${in7.length ? ` · <b>${in7.length} renew${in7.length === 1 ? "s" : ""} this week</b>` : ""}</p></div>
        <div class="sb2-act"><button class="pl-btn" data-a="open" title="Open as a database">${WI("db", 16)}<span>Table</span></button><button class="pl-btn pri" data-a="add">${WI("plus", 16)}<span>Add</span></button></div></header>
      <div class="sb2-tot">${Object.keys(totals).length ? Object.entries(totals).map(([c, t]) => `<div class="sb2-tile"><small>Every month${Object.keys(totals).length > 1 ? " · " + c : ""}</small><b>${esc(money(t.m, c))}</b><span>${esc(money(t.y, c))} a year</span></div>`).join("") : `<div class="sb2-tile"><small>Every month</small><b>${SYM.INR}0</b><span>Add what you pay for, or scan your email.</span></div>`}
        <div class="sb2-tile"><small>Next to renew</small>${soon[0] ? `<b class="sm">${esc(soon[0].name)}</b><span>${esc(fmtDate(soon[0].next, { rel: true }))} · ${esc(money(soon[0].amount, soon[0].cur))}</span>` : `<b class="sm">Nothing yet</b>`}</div></div>
      ${in7.length ? `<section class="sb2-warn">${WI("bell", 18)}<div><b>Renewing soon</b>${in7.map((s) => `<p><span>${esc(s.name)}</span> ${esc(fmtDate(s.next, { rel: true }))} · ${esc(money(s.amount, s.cur))}${s.link ? ` · <a href="${esc(s.link)}" target="_blank" rel="noopener">Manage</a>` : ""}</p>`).join("")}</div></section>` : ""}
      <section class="sb2-sug"><header><h3>${WI("mail", 17)}Found in your email</h3><button class="pl-btn" data-a="scan"${S.scanning ? " disabled" : ""}>${WI("refresh", 15)}<span>${S.scanning ? "Reading receipts…" : "Scan email"}</span></button></header>
        ${sug.length ? `<div class="sb2-sl">${sug.map((x) => `<div class="sb2-s" data-key="${esc(x.key)}"><div><b>${esc(x.name)}</b><small>${esc(money(x.amount, x.cur))} ${esc(x.cycle)} · last paid ${esc(fmtDate(x.last))}${x.count > 1 ? ` · ${x.count} payments seen` : ""}</small><em class="sb2-sure ${x.sure}">${x.sure === "high" ? "Very likely" : x.sure === "medium" ? "Likely" : "Maybe"}</em></div><button class="pl-btn pri" data-take="${esc(x.key)}">Add</button><button class="pl-btn" data-no="${esc(x.key)}" aria-label="Not a subscription" title="Not a subscription">${WI("x", 15)}</button></div>`).join("")}</div>` : S.g && S.g.preview ? `<p class="pl-note">Email is only read on the live site.</p>` : !S.g || !(S.g.accounts || []).some((a) => a.mail) ? `<p class="pl-note">Connect a Google account in Settings → Sync to find subscriptions in your receipts.</p>` : `<p class="pl-note">${scanNote()}</p>`}</section>
      <div class="pl-seg sb2-tabs"><button data-tab="active" class="${S.tab === "active" ? "on" : ""}">Active</button><button data-tab="cancelled" class="${S.tab === "cancelled" ? "on" : ""}">Cancelled</button></div>
      <div class="sb2-list">${shown.sort((a, b) => (a.next || "9").localeCompare(b.next || "9")).map((s) => `<button class="sb2-row" data-row="${s.r.id}"><span class="sb2-ic">${esc((s.name[0] || "?").toUpperCase())}</span><span class="sb2-n"><b>${esc(s.name)}</b><small>${[s.cat, s.pay, s.from ? "found in " + s.from : ""].filter(Boolean).map(esc).join(" · ")}</small></span><span class="sb2-a"><b>${esc(money(s.amount, s.cur))}</b><small>${esc(s.cycle.toLowerCase())}</small></span><span class="sb2-d${s.next && s.next <= ymd(new Date(Date.now() + 3 * 864e5)) ? " soon" : ""}">${s.status === "Cancelled" ? "Cancelled" : s.status === "Trial" ? `Trial ends ${esc(fmtDate(s.next))}` : s.next ? esc(fmtDate(s.next, { rel: true })) : "–"}</span></button>`).join("") || `<p class="pl-note">${S.tab === "active" ? "Nothing yet. Add what you pay for." : "Nothing cancelled."}</p>`}</div>`;
    root.querySelector('[data-a="add"]').onclick = (e) => form(e.currentTarget);
    root.querySelector('[data-a="open"]').onclick = () => { window.openApp("boards"); setTimeout(() => R.apply("/boards/db/" + id), 60); };
    root.querySelector('[data-a="scan"]').onclick = () => scan();
    root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; draw(); }));
    root.querySelectorAll("[data-row]").forEach((b) => (b.onclick = () => form(b, doc().rows[b.dataset.row])));
    root.querySelectorAll("[data-take]").forEach((b) => (b.onclick = () => { const x = sug.find((y) => y.key === b.dataset.take); if (x) form(b, null, x); }));
    root.querySelectorAll("[data-no]").forEach((b) => (b.onclick = async () => { const k = b.dataset.no; S.g.subs = S.g.subs.filter((x) => x.key !== k); draw(); await api("/api/gdata?a=nosub", { method: "POST", body: { key: k } }); }));
  }
  function scanNote() { const p = S.g && S.g.scan ? Object.values(S.g.scan) : []; const n = p.reduce((a, b) => a + (b.n || 0), 0); return n ? `Read ${n.toLocaleString()} receipts so far${p.every((x) => x.done) ? "" : " (more are read every half hour)"}. Nothing new to suggest.` : "Press Scan email to look through your receipts from the last year."; }
  async function scan() {
    if (S.scanning) return; S.scanning = true; draw();
    let more = true, n = 0;
    while (more && n++ < 12 && body.isConnected) {
      const r = await api("/api/gdata?a=scan", { method: "POST", body: {} });
      if (!r.ok) { toast(r.data.error || "Could not read your email"); break; }
      S.g.subs = r.data.subs; S.g.scan = r.data.progress; more = r.data.more;
      const errs = Object.values(r.data.errors || {}); if (errs.length) { toast(errs[0], 6000); break; }
      draw();
    }
    S.scanning = false; draw();
  }
  // add or change one subscription
  function form(anchor, row, sug) {
    const s = row ? row2sub(row) : { name: sug ? sug.name : "", amount: sug ? sug.amount : "", cur: sug ? sug.cur : "INR", cycle: sug ? ({ monthly: "Monthly", yearly: "Yearly", quarterly: "Quarterly", "half-yearly": "Half-yearly", weekly: "Weekly" }[sug.cycle] || "Monthly") : "Monthly", next: sug ? sug.next : "", status: "Active", cat: "", pay: "", link: "", from: sug ? sug.from || "email" : "" };
    const box = h("form", { class: "wd-menu pl-form" });
    const sel = (name, cur, opts) => `<select class="wd-in sm" name="${name}">${opts.map((o) => `<option${o === cur ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    box.innerHTML = `<div class="wd-mh">${row ? "Subscription" : sug ? "Add from your email" : "Add a subscription"}</div>
      <input class="wd-in" name="name" placeholder="Name (Netflix, Figma…)" value="${esc(s.name)}" required maxlength="80">
      <div class="pl-fr"><input class="wd-in" name="amount" type="number" step="0.01" min="0" placeholder="Amount" value="${esc(s.amount)}">${sel("cur", s.cur, ["INR", "USD", "EUR", "GBP"])}</div>
      <div class="pl-fr">${sel("cycle", s.cycle, Object.keys(CYCLE_DAYS))}${sel("status", s.status, ["Active", "Trial", "Cancelled"])}</div>
      <label class="pl-lab">Next charge<input class="wd-in" name="next" type="date" value="${esc(s.next)}"></label>
      <input class="wd-in" name="cat" placeholder="Category (optional)" value="${esc(s.cat)}" list="sb2-cats"><datalist id="sb2-cats">${(P("Category")?.opts || []).map((o) => `<option value="${esc(o.name)}">`).join("")}</datalist>
      <input class="wd-in" name="pay" placeholder="Paid with (card, UPI…)" value="${esc(s.pay)}" maxlength="60">
      <input class="wd-in" name="link" placeholder="Link to manage or cancel" value="${esc(s.link)}" maxlength="400">
      <div class="pl-fb">${row ? `<button type="button" class="pl-btn danger" data-del>${WI("trash", 15)}</button>` : ""}<span class="wd-sp"></span><button type="button" class="pl-btn" data-x>Cancel</button><button class="pl-btn pri">${row ? "Save" : "Add"}</button></div>`;
    box.querySelector("[data-x]").onclick = () => closePop();
    box.querySelector("[data-del]")?.addEventListener("click", async () => { if (await confirmBox(`Delete ${s.name}?`, "Delete")) { DB.ops(id, [{ op: "delrow", id: row.id }]); closePop(); } });
    box.onsubmit = (e) => {
      e.preventDefault(); const f = new FormData(box), name = String(f.get("name")).trim(); if (!name) return;
      const ops = [], v = {};
      const need = (pname, val) => { const p = P(pname); if (!p) return null; let o = opt(p, val); if (!o && val) { o = { id: rid(), name: val, color: ["blue", "purple", "green", "orange", "pink", "brown"][(p.opts || []).length % 6] }; ops.push({ op: "prop", prop: { ...p, opts: [...(p.opts || []), o] } }); p.opts = [...(p.opts || []), o]; } return o ? o.id : null; };
      v[P("Amount").id] = f.get("amount") === "" ? null : +f.get("amount");
      v[P("Currency").id] = need("Currency", f.get("cur")); v[P("Cycle").id] = need("Cycle", f.get("cycle")); v[P("Status").id] = need("Status", f.get("status"));
      v[P("Next charge").id] = f.get("next") || null; v[P("Category").id] = need("Category", String(f.get("cat")).trim()) || null;
      v[P("Paid with").id] = String(f.get("pay")).trim() || null; v[P("Manage or cancel").id] = String(f.get("link")).trim() || null;
      if (!row) v[P("Found in").id] = sug ? "email" : null;
      ops.push({ op: "row", row: { id: row ? row.id : rid(), title: name, v, ...(row ? {} : { created: Date.now(), order: Date.now() }) } });
      DB.ops(id, ops); closePop(); toast(row ? "Saved" : `${name} added`);
    };
    popover(anchor, box, { w: 320 }); setTimeout(() => box.querySelector('[name="name"]').focus(), 30);
  }

  const off = DB.on(id, () => { if (body.isConnected) draw(); });
  body.__flush = async () => { off(); DB.flush(id); };
  draw();
  const g = await api("/api/gdata"); if (g.ok) { S.g = g.data; if (body.isConnected) draw(); }
  R.handlers.subs = () => {};
}

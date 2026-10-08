// Planner: My Day, My Week and My Month. One place for everything with a date: Google Calendar events (every connected
// account), tasks, content you're publishing, subscriptions that renew, and the email that matters. Owner only.
// Events made here go to Google Calendar; tasks go to the Tasks database in the Workspace.
import { h, esc, api, toast, isAdmin, mobile, confirmBox } from "/js/lib.mjs";
import { R } from "/js/os-ext.mjs";
import { WS, DB, fmtNum, fmtDate, parseDay, ymd, today, rid } from "/js/ws-core.mjs";
import { WI, popover, closePop, choose } from "/js/ws-db.mjs";

if (!document.querySelector('link[href="/css/planner.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "/css/planner.css" }));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const HOUR0 = 6, HOUR1 = 24, PX = 52; // the day's timeline: 6:00 to midnight, 52px an hour
const tm = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const addDays = (d, n) => { const x = parseDay(d); x.setDate(x.getDate() + n); return ymd(x); };
const mondayOf = (d) => { const x = parseDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x); };
const dayOfIso = (iso) => (iso.length <= 10 ? iso : ymd(new Date(iso)));

export async function plannerApp(body) {
  if (!isAdmin()) { body.innerHTML = '<p class="hint" style="padding:24px">The Planner is private. Sign in as the owner.</p>'; return; }
  body.classList.add("pl-body");
  const S = { view: ls.get("plView", mobile() ? "day" : "day"), day: today(), g: ls.get("plG", null), loading: true, dbs: {} };
  body.innerHTML = '<div class="pl"></div>'; const root = body.firstElementChild;

  /* ---------- reading everything with a date ---------- */
  async function loadDbs() {
    if (!WS.loaded) await WS.load();
    for (const role of ["tasks", "content", "subs"]) { const d = WS.dbByRole(role); if (d) { await DB.open(d.id); S.dbs[role] = d.id; } }
  }
  async function loadGoogle(fresh) {
    const r = await api("/api/gdata" + (fresh ? "?fresh=1" : ""));
    if (r.ok) { S.g = r.data; try { ls.set("plG", { ...r.data, subs: [] }); } catch {} }
    S.loading = false;
  }
  const P = (role, test) => { const d = DB.get(S.dbs[role]); return d ? d.props.find(test) : null; };
  const opt = (p, v) => p && (p.opts || []).find((o) => o.id === v);
  function events() {
    const out = [], accts = new Map(((S.g && S.g.accounts) || []).map((a) => [a.id, a]));
    for (const [aid, a] of Object.entries((S.g && S.g.cal && S.g.cal.accounts) || {})) for (const e of a.events || []) out.push({ ...e, acctEmail: a.email, color: e.color || accts.get(aid)?.color || "#1A73E8" });
    return out;
  }
  function tasks() {
    const d = DB.get(S.dbs.tasks); if (!d) return [];
    const st = d.props.find((p) => p.type === "status"), due = d.props.find((p) => p.type === "date"), pri = d.props.find((p) => p.name === "Priority");
    return Object.values(d.rows).map((r) => { const o = st && opt(st, r.v[st.id]); return { r, t: r.title || "Untitled", due: due ? String(r.v[due.id] || "").slice(0, 10) : "", time: due ? String(r.v[due.id] || "").slice(11, 16) : "", done: !!(o && o.group === "done"), pri: pri && opt(pri, r.v[pri.id]) }; });
  }
  function content() {
    const d = DB.get(S.dbs.content); if (!d) return [];
    const st = d.props.find((p) => p.type === "status"), date = d.props.find((p) => p.type === "date");
    return Object.values(d.rows).filter((r) => date && r.v[date.id]).map((r) => { const o = st && opt(st, r.v[st.id]); return { r, t: r.title || "Untitled", day: String(r.v[date.id]).slice(0, 10), stage: o ? o.name : "", done: !!(o && o.group === "done"), c: o && o.color }; });
  }
  function bills() {
    const d = DB.get(S.dbs.subs); if (!d) return [];
    const next = d.props.find((p) => p.name === "Next charge"), amt = d.props.find((p) => p.name === "Amount"), cur = d.props.find((p) => p.name === "Currency"), st = d.props.find((p) => p.type === "status");
    return Object.values(d.rows).filter((r) => next && r.v[next.id] && !(st && opt(st, r.v[st.id])?.name === "Cancelled")).map((r) => ({ r, t: r.title || "Untitled", day: String(r.v[next.id]).slice(0, 10), amount: amt ? r.v[amt.id] : null, cur: cur ? opt(cur, r.v[cur.id])?.name || "INR" : "INR" }));
  }
  function mails() {
    const out = []; for (const [aid, a] of Object.entries((S.g && S.g.mail && S.g.mail.accounts) || {})) for (const m of a.msgs || []) out.push({ ...m, acctEmail: a.email });
    return out.sort((a, b) => (b.vip - a.vip) || (b.ts - a.ts));
  }
  const evOn = (day) => events().filter((e) => { const s = dayOfIso(e.s), en = e.allDay ? addDays(dayOfIso(e.e || e.s), -1) : dayOfIso(e.e || e.s); return s <= day && en >= day; });
  const money = (n, c) => fmtNum(n, { INR: "inr", USD: "usd", EUR: "eur", GBP: "gbp" }[c] || "plain");

  /* ---------- drawing ---------- */
  function draw() {
    const keep = root.querySelector(".pl-tlw")?.scrollTop, keepDay = S.drawnDay; S.drawnDay = S.day;
    requestAnimationFrame(() => { const w = root.querySelector(".pl-tlw"); if (w && keep != null && keepDay === S.day) w.scrollTop = keep; else scrollNow(); });
    const td = today(), d = S.day;
    const title = S.view === "day" ? (d === td ? "My Day" : parseDay(d).toLocaleDateString([], { weekday: "long" })) : S.view === "week" ? "My Week" : "My Month";
    const sub = S.view === "day" ? parseDay(d).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : S.view === "week" ? `${parseDay(mondayOf(d)).toLocaleDateString([], { day: "numeric", month: "short" })} – ${parseDay(addDays(mondayOf(d), 6)).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}` : parseDay(d).toLocaleDateString([], { month: "long", year: "numeric" });
    const noGoogle = S.g && !(S.g.accounts || []).length;
    root.innerHTML = `
      <header class="pl-h"><div class="pl-ht"><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>
        <div class="pl-hc"><div class="pl-seg" role="tablist">${[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([k, t]) => `<button role="tab" data-v="${k}" class="${S.view === k ? "on" : ""}">${t}</button>`).join("")}</div>
          <button class="pl-ib" data-nav="-1" aria-label="Before">${WI("chevron-left", 18)}</button><button class="pl-btn" data-nav="0">Today</button><button class="pl-ib" data-nav="1" aria-label="After">${WI("chevron-right", 18)}</button>
          <button class="pl-ib" data-a="sync" title="Refresh from Google" aria-label="Refresh from Google">${WI("refresh", 17)}</button>
          <button class="pl-btn pri" data-a="add">${WI("plus", 16)}<span>Add</span></button></div></header>
      ${noGoogle ? `<p class="pl-banner">${WI("calendar", 17)}<span>Connect Google Calendar and Gmail in <a href="/settings" data-set>Settings → Sync</a> to see your events and important email here.</span></p>` : ""}
      ${S.g && S.g.preview ? `<p class="pl-banner">${WI("info", 17)}<span>Preview address: Google isn't read here, only on the live site.</span></p>` : ""}
      ${googleErrors()}
      <div class="pl-main">${S.view === "day" ? dayView(d) : S.view === "week" ? weekView(d) : monthView(d)}</div>`;
    wire();
  }
  function googleErrors() {
    const errs = []; for (const k of ["cal", "mail"]) for (const a of Object.values((S.g && S.g[k] && S.g[k].accounts) || {})) if (a.error) errs.push(`<b>${esc(a.email)}</b> (${k === "cal" ? "Calendar" : "Gmail"}): ${esc(a.error)}`);
    return errs.length ? `<details class="pl-err"><summary>${WI("warning", 16)}${errs.length === 1 ? "Something needs attention with Google" : errs.length + " things need attention with Google"}</summary>${errs.map((e) => `<p>${e}</p>`).join("")}<p><a href="/settings" data-set>Open Settings → Sync</a> to test and fix.</p></details>` : "";
  }
  function summary(d) {
    const ev = evOn(d), tk = tasks().filter((t) => !t.done && t.due && t.due <= d), ct = content().filter((c) => c.day === d && !c.done), bl = bills().filter((b) => b.day === d), ml = d === today() ? mails().length : 0;
    const parts = [ev.length && `${ev.length} event${ev.length === 1 ? "" : "s"}`, tk.length && `${tk.length} task${tk.length === 1 ? "" : "s"}${tk.some((t) => t.due < d) ? ` (${tk.filter((t) => t.due < d).length} overdue)` : ""}`, ct.length && `${ct.length} to publish`, bl.length && `${bl.length} renewal${bl.length === 1 ? "" : "s"}`, ml && `${ml} important email${ml === 1 ? "" : "s"}`].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Nothing planned. A good day to make something.";
  }

  /* ----- My Day ----- */
  function dayView(d) {
    const ev = evOn(d), allDay = ev.filter((e) => e.allDay), timed = ev.filter((e) => !e.allDay).sort((a, b) => new Date(a.s) - new Date(b.s) || new Date(b.e) - new Date(a.e));
    const tk = tasks().filter((t) => !t.done && t.due && (t.due === d || (d === today() && t.due < d))).sort((a, b) => a.due.localeCompare(b.due) || (a.time || "99").localeCompare(b.time || "99"));
    const doneToday = tasks().filter((t) => t.done && t.due === d);
    const ct = content().filter((c) => c.day === d), bl = bills().filter((b) => b.day >= d && b.day <= addDays(d, 7)), ml = d === today() ? mails() : [];
    // the day's timeline: events side by side when they overlap
    const lanes = []; const placed = timed.map((e) => { const s = new Date(e.s), en = new Date(e.e || e.s); const top = Math.max(0, ((dayOfIso(e.s) < d ? HOUR0 : s.getHours() + s.getMinutes() / 60) - HOUR0) * PX), bot = Math.min((HOUR1 - HOUR0) * PX, ((dayOfIso(e.e || e.s) > d ? HOUR1 : en.getHours() + en.getMinutes() / 60) - HOUR0) * PX); let lane = lanes.findIndex((l) => l <= top + 1); if (lane < 0) { lane = lanes.length; lanes.push(0); } lanes[lane] = bot; return { e, top, h: Math.max(22, bot - top), lane }; });
    const n = Math.max(1, lanes.length), now = new Date(), nowY = (now.getHours() + now.getMinutes() / 60 - HOUR0) * PX;
    return `<p class="pl-sum">${esc(summary(d))}</p>
      <div class="pl-day">
        <section class="pl-card pl-sched"><header><h3>${WI("calendar", 17)}Schedule</h3></header>
          ${allDay.length ? `<div class="pl-allday">${allDay.map((e) => `<button class="pl-ev ad" data-ev="${esc(e.acct)}|${esc(e.cal)}|${esc(e.id)}" style="--ec:${esc(e.color)}">${esc(e.t)}</button>`).join("")}</div>` : ""}
          ${ct.length ? `<div class="pl-allday">${ct.map((c) => `<button class="pl-chip" data-row="content|${c.r.id}"${c.c ? ` data-c="${c.c}"` : ""}>${WI("video", 14)}${esc(c.t)}<em>${esc(c.stage)}</em></button>`).join("")}</div>` : ""}
          <div class="pl-tlw"><div class="pl-tl" style="height:${(HOUR1 - HOUR0) * PX}px" data-day="${d}">${Array.from({ length: HOUR1 - HOUR0 }, (_, i) => `<div class="pl-hr" style="top:${i * PX}px"><span>${new Date(2000, 0, 1, HOUR0 + i).toLocaleTimeString([], { hour: "numeric" })}</span></div>`).join("")}
            ${placed.map((p) => `<button class="pl-ev" data-ev="${esc(p.e.acct)}|${esc(p.e.cal)}|${esc(p.e.id)}" style="top:${p.top}px;height:${p.h - 2}px;left:calc(56px + (100% - 60px) * ${p.lane / n});width:calc((100% - 60px) / ${n} - 4px);--ec:${esc(p.e.color)}"><b>${esc(p.e.t)}</b><small>${esc(tm(p.e.s))}${p.e.loc ? " · " + esc(p.e.loc) : ""}</small></button>`).join("")}
            ${d === today() && nowY > 0 && nowY < (HOUR1 - HOUR0) * PX ? `<div class="pl-now" style="top:${nowY}px"></div>` : ""}</div></div></section>
        <div class="pl-side">
          <section class="pl-card"><header><h3>${WI("checkbox", 17)}Tasks</h3>${S.dbs.tasks ? `<button class="pl-lk" data-open-db="tasks">All tasks</button>` : ""}</header>
            ${tk.length || doneToday.length ? `<ul class="pl-tasks">${[...tk, ...doneToday].map((t) => `<li class="${t.done ? "done" : ""}"><button class="pl-cb${t.done ? " on" : ""}" data-done="${t.r.id}" aria-label="${t.done ? "Not done" : "Done"}"></button><button class="pl-tt" data-row="tasks|${t.r.id}">${esc(t.t)}</button>${t.due < d ? `<span class="pl-over">${esc(fmtDate(t.due, { rel: true }))}</span>` : t.time ? `<span class="pl-tm">${esc(t.time)}</span>` : ""}${t.pri ? `<span class="wd-opt" data-c="${t.pri.color}">${esc(t.pri.name)}</span>` : ""}</li>`).join("")}</ul>` : `<p class="pl-note">No tasks for this day.</p>`}
            <form class="pl-qa" data-qa="${d}"><input placeholder="Add a task for ${d === today() ? "today" : esc(fmtDate(d))}" aria-label="New task" maxlength="200"></form></section>
          ${d === today() ? `<section class="pl-card"><header><h3>${WI("mail", 17)}Important email</h3><button class="pl-lk" data-a="mailcfg">Who counts</button></header>
            ${ml.length ? `<ul class="pl-mail">${ml.slice(0, 8).map((m) => `<li><a href="https://mail.google.com/mail/u/${encodeURIComponent(m.acctEmail)}/#inbox/${encodeURIComponent(m.thread)}" target="_blank" rel="noopener" class="pl-m${m.unread ? " unread" : ""}"><b>${esc(m.from)}${m.vip ? `<em>VIP</em>` : ""}</b><span>${esc(m.subj)}</span><small>${esc(m.snip)}</small></a><div class="pl-ma"><button class="pl-ib sm" data-mtask="${esc(m.id)}" title="Make it a task" aria-label="Make it a task">${WI("checkbox", 15)}</button><button class="pl-ib sm" data-mseen="${esc(m.id)}" title="Done with it" aria-label="Done with it">${WI("check", 15)}</button></div></li>`).join("")}</ul>${ml.length > 8 ? `<p class="pl-note">${ml.length - 8} more in Gmail.</p>` : ""}` : `<p class="pl-note">${S.g && (S.g.accounts || []).some((a) => a.mail) ? "Nothing important waiting." : "Connect Gmail in Settings → Sync."}</p>`}</section>` : ""}
          ${bl.length ? `<section class="pl-card"><header><h3>${WI("wallet", 17)}Renewing soon</h3><button class="pl-lk" data-app="subs">Subscriptions</button></header><ul class="pl-bills">${bl.map((b) => `<li><span>${esc(b.t)}</span><em>${esc(fmtDate(b.day, { rel: true }))}</em><b>${b.amount != null ? esc(money(b.amount, b.cur)) : ""}</b></li>`).join("")}</ul></section>` : ""}
        </div></div>`;
  }
  /* ----- My Week ----- */
  function weekView(d) {
    const mon = mondayOf(d), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)), td = today();
    const T = tasks(), C = content(), B = bills();
    return `<div class="pl-week">${days.map((x) => { const ev = evOn(x).sort((a, b) => (b.allDay - a.allDay) || String(a.s).localeCompare(String(b.s))), tk = T.filter((t) => t.due === x), ct = C.filter((c) => c.day === x), bl = B.filter((b) => b.day === x);
      return `<section class="pl-wd${x === td ? " now" : ""}${x < td ? " past" : ""}" data-wday="${x}"><button class="pl-wdh" data-goday="${x}"><span>${parseDay(x).toLocaleDateString([], { weekday: "short" })}</span><b>${parseDay(x).getDate()}</b></button>
        <div class="pl-wl">${ev.map((e) => `<button class="pl-wev${e.allDay ? " ad" : ""}" data-ev="${esc(e.acct)}|${esc(e.cal)}|${esc(e.id)}" style="--ec:${esc(e.color)}">${e.allDay ? "" : `<small>${esc(tm(e.s))}</small>`}${esc(e.t)}</button>`).join("")}
        ${ct.map((c) => `<button class="pl-chip" data-row="content|${c.r.id}"${c.c ? ` data-c="${c.c}"` : ""}>${WI("video", 13)}${esc(c.t)}</button>`).join("")}
        ${tk.map((t) => `<div class="pl-wt${t.done ? " done" : ""}"><button class="pl-cb sm${t.done ? " on" : ""}" data-done="${t.r.id}" aria-label="Done"></button><button class="pl-tt" data-row="tasks|${t.r.id}">${esc(t.t)}</button></div>`).join("")}
        ${bl.map((b) => `<div class="pl-wb">${WI("wallet", 13)}${esc(b.t)}${b.amount != null ? ` · ${esc(money(b.amount, b.cur))}` : ""}</div>`).join("")}</div>
        <form class="pl-qa sm" data-qa="${x}"><input placeholder="+ Task" aria-label="New task on ${x}" maxlength="200"></form></section>`; }).join("")}</div>`;
  }
  /* ----- My Month ----- */
  function monthView(d) {
    const base = parseDay(d.slice(0, 8) + "01"), start = mondayOf(ymd(base)), td = today(), T = tasks(), C = content(), B = bills();
    const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    return `<div class="pl-month"><div class="pl-mdow">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => `<span>${x}</span>`).join("")}</div><div class="pl-mg">${days.map((x) => { const ev = evOn(x), tk = T.filter((t) => t.due === x && !t.done), ct = C.filter((c) => c.day === x), bl = B.filter((b) => b.day === x); const items = [...ev.map((e) => `<span class="pl-mi" style="--ec:${esc(e.color)}">${esc(e.t)}</span>`), ...ct.map((c) => `<span class="pl-mi ct">${esc(c.t)}</span>`), ...tk.map((t) => `<span class="pl-mi tk">${esc(t.t)}</span>`), ...bl.map((b) => `<span class="pl-mi bl">${esc(b.t)}</span>`)];
      return `<button class="pl-md${x.slice(0, 7) !== d.slice(0, 7) ? " out" : ""}${x === td ? " now" : ""}" data-goday="${x}"><span class="pl-mn">${parseDay(x).getDate()}</span>${items.slice(0, mobile() ? 2 : 4).join("")}${items.length > (mobile() ? 2 : 4) ? `<span class="pl-mm">+${items.length - (mobile() ? 2 : 4)}</span>` : ""}</button>`; }).join("")}</div></div>`;
  }

  /* ---------- acting ---------- */
  // My Day opens at the current hour (or 8:00), inside the timeline only
  function scrollNow() { const w = root.querySelector(".pl-tlw"); if (!w) return; const hr = S.day === today() ? new Date().getHours() : 8; w.scrollTop = Math.max(0, (Math.max(HOUR0, hr - 1) - HOUR0) * PX); }
  function wire() {
    root.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { S.view = b.dataset.v; ls.set("plView", S.view); draw(); scrollNow(); }));
    root.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = () => { const n = +b.dataset.nav; if (!n) S.day = today(); else if (S.view === "day") S.day = addDays(S.day, n); else if (S.view === "week") S.day = addDays(S.day, 7 * n); else { const x = parseDay(S.day); x.setDate(1); x.setMonth(x.getMonth() + n); S.day = ymd(x); } draw(); }));
    root.querySelector('[data-a="sync"]').onclick = async (e) => { e.currentTarget.classList.add("spin"); await loadGoogle(true); draw(); toast("Up to date"); };
    root.querySelector('[data-a="add"]').onclick = (e) => addMenu(e.currentTarget, S.day);
    root.querySelectorAll("[data-set]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); window.openApp("settings"); }));
    root.querySelectorAll("[data-goday]").forEach((b) => (b.onclick = (e) => { if (e.target.closest("[data-ev],[data-row],[data-done]")) return; S.day = b.dataset.goday; S.view = "day"; ls.set("plView", "day"); draw(); }));
    root.querySelectorAll("[data-ev]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const [acct, cal, id] = b.dataset.ev.split("|"); const ev = events().find((x) => x.acct === acct && x.cal === cal && x.id === id); if (ev) evCard(b, ev); }));
    root.querySelectorAll("[data-row]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const [role, id] = b.dataset.row.split("|"); openRow(role, id); }));
    root.querySelectorAll("[data-done]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleDone(b.dataset.done); }));
    root.querySelectorAll("[data-open-db]").forEach((b) => (b.onclick = () => openDb(S.dbs[b.dataset.openDb])));
    root.querySelectorAll("[data-app]").forEach((b) => (b.onclick = () => window.openApp(b.dataset.app)));
    root.querySelectorAll("form[data-qa]").forEach((f) => (f.onsubmit = async (e) => { e.preventDefault(); const inp = f.querySelector("input"), t = inp.value.trim(); if (!t) return; inp.value = ""; await addTask(t, f.dataset.qa); }));
    root.querySelectorAll("[data-mseen]").forEach((b) => (b.onclick = async () => { const id = b.dataset.mseen; for (const a of Object.values(S.g.mail.accounts)) if (a.msgs) a.msgs = a.msgs.filter((m) => m.id !== id); draw(); await api("/api/gdata?a=seen", { method: "POST", body: { id } }); }));
    root.querySelectorAll("[data-mtask]").forEach((b) => (b.onclick = async () => { const m = mails().find((x) => x.id === b.dataset.mtask); if (!m) return; await addTask(`${m.subj}`, today(), `From ${m.from}: https://mail.google.com/mail/u/${m.acctEmail}/#inbox/${m.thread}`); toast("Task made from the email"); }));
    root.querySelector('[data-a="mailcfg"]')?.addEventListener("click", () => window.openApp("settings"));
    // click an empty spot on the day's timeline: a new event at that time
    root.querySelector(".pl-tl")?.addEventListener("click", (e) => { if (e.target.closest(".pl-ev")) return; const r = e.currentTarget.getBoundingClientRect(), y = e.clientY - r.top, hr = HOUR0 + Math.floor((y / PX) * 2) / 2; const hh = String(Math.floor(hr)).padStart(2, "0"), mm = hr % 1 ? "30" : "00"; eventForm(e.target, { day: e.currentTarget.dataset.day, start: `${hh}:${mm}` }); });
  }
  function openRow(role, id) { const db = S.dbs[role]; if (!db) return; window.openApp("boards"); setTimeout(() => R.apply(`/boards/db/${db}/${id}`), 60); }
  function openDb(db) { if (!db) return; window.openApp("boards"); setTimeout(() => R.apply(`/boards/db/${db}`), 60); }
  function toggleDone(rowId) {
    const d = DB.get(S.dbs.tasks); if (!d) return; const st = d.props.find((p) => p.type === "status"); if (!st) return;
    const r = d.rows[rowId], cur = opt(st, r.v[st.id]), done = cur && cur.group === "done";
    const to = (st.opts || []).find((o) => (o.group || "todo") === (done ? "todo" : "done")); if (!to) return;
    DB.ops(S.dbs.tasks, [{ op: "row", row: { id: rowId, v: { [st.id]: to.id } } }]);
    if (!done) toast("Done. Nice.");
  }
  async function addTask(title, day, note) {
    const d = await WS.ensure("tasks"); if (!d) return; S.dbs.tasks = d.id;
    const doc = DB.get(d.id), due = doc.props.find((p) => p.type === "date"), st = doc.props.find((p) => p.type === "status"), todo = st && (st.opts || []).find((o) => (o.group || "todo") === "todo");
    const r = DB.newRow(d.id, { title, order: Date.now(), v: { ...(due && day ? { [due.id]: day } : {}), ...(todo ? { [st.id]: todo.id } : {}) } });
    if (note) api("/api/boards?page=" + r.id, { method: "PUT", body: { blocks: [{ t: "p", h: esc(note) }], base: 0 } });
  }
  function addMenu(anchor, day) {
    choose(anchor, [{ t: "Event in Google Calendar", i: "calendar", run: () => eventForm(anchor, { day }) }, { t: "Task", i: "checkbox", run: () => taskForm(anchor, day) }, { t: "Subscription", i: "wallet", run: () => window.openApp("subs") }], { w: 250 });
  }
  function taskForm(anchor, day) {
    const box = h("form", { class: "wd-menu pl-form" });
    box.innerHTML = `<div class="wd-mh">New task</div><input class="wd-in" name="t" placeholder="What needs doing?" required maxlength="200"><label class="pl-lab">Due<input class="wd-in" name="d" type="date" value="${esc(day)}"></label><div class="pl-fb"><span class="wd-sp"></span><button type="button" class="pl-btn" data-x>Cancel</button><button class="pl-btn pri">Add task</button></div>`;
    box.querySelector("[data-x]").onclick = () => closePop();
    box.onsubmit = async (e) => { e.preventDefault(); const f = new FormData(box); closePop(); await addTask(String(f.get("t")).trim(), String(f.get("d") || "")); };
    popover(anchor, box, { w: 300 }); setTimeout(() => box.querySelector("input").focus(), 30);
  }
  function writableCals() { const out = []; for (const [aid, a] of Object.entries((S.g && S.g.cal && S.g.cal.accounts) || {})) for (const c of a.cals || []) if (c.write && c.on !== false) out.push({ acct: aid, email: a.email, ...c }); return out.sort((a, b) => b.primary - a.primary); }
  function eventForm(anchor, { day, start, ev }) {
    const cals = writableCals();
    if (!cals.length && !ev) { toast(S.g && S.g.preview ? "Events are made on the live site" : "Connect Google Calendar in Settings → Sync to add events"); return taskForm(anchor, day); }
    const last = ls.get("plCal", ""), s0 = ev ? (ev.allDay ? "" : ev.s.slice(11, 16) || new Date(ev.s).toTimeString().slice(0, 5)) : start || "10:00";
    const e0 = ev ? (ev.allDay ? "" : new Date(ev.e).toTimeString().slice(0, 5)) : (() => { const [hh, mm] = (start || "10:00").split(":").map(Number); const x = new Date(2000, 0, 1, hh, mm + 60); return x.toTimeString().slice(0, 5); })();
    const box = h("form", { class: "wd-menu pl-form" });
    box.innerHTML = `<div class="wd-mh">${ev ? "Change event" : "New event"}</div>
      <input class="wd-in" name="t" placeholder="Title" required maxlength="200" value="${esc(ev ? ev.t : "")}">
      <label class="pl-lab">Date<input class="wd-in" name="d" type="date" value="${esc(ev ? dayOfIso(ev.s) : day)}" required></label>
      <label class="pl-chk"><input type="checkbox" name="ad"${ev && ev.allDay ? " checked" : ""}> All day</label>
      <div class="pl-fr pl-times"><input class="wd-in" name="s" type="time" value="${esc(s0)}" aria-label="Starts"><span>to</span><input class="wd-in" name="e" type="time" value="${esc(e0)}" aria-label="Ends"></div>
      <input class="wd-in" name="loc" placeholder="Where (optional)" maxlength="200" value="${esc(ev ? ev.loc : "")}">
      ${ev ? "" : `<select class="wd-in sm" name="cal" aria-label="Calendar">${cals.map((c) => `<option value="${esc(c.acct + "|" + c.id)}"${c.acct + "|" + c.id === last ? " selected" : ""}>${esc(c.name)} · ${esc(c.email)}</option>`).join("")}</select>`}
      <div class="pl-fb"><span class="wd-sp"></span><button type="button" class="pl-btn" data-x>Cancel</button><button class="pl-btn pri">${ev ? "Save" : "Add to calendar"}</button></div>`;
    const ad = box.querySelector('[name="ad"]'), times = box.querySelector(".pl-times"); const sync = () => (times.hidden = ad.checked); ad.onchange = sync; sync();
    box.querySelector("[data-x]").onclick = () => closePop();
    box.onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(box), dd = String(f.get("d")), all = !!f.get("ad");
      const [acct, cal] = ev ? [ev.acct, ev.cal] : String(f.get("cal")).split("|"); if (!ev) ls.set("plCal", acct + "|" + cal);
      const b = { acct, cal, t: String(f.get("t")).trim(), loc: String(f.get("loc") || ""), allDay: all, s: all ? dd : `${dd}T${f.get("s")}`, e: all ? addDays(dd, 1) : `${dd}T${f.get("e") || f.get("s")}`, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(ev ? { id: ev.id } : {}) };
      if (!all && b.e <= b.s) b.e = b.s;
      closePop(); toast(ev ? "Saving…" : "Adding to Google Calendar…");
      const r = await api("/api/gdata?a=event", { method: ev ? "PUT" : "POST", body: b });
      if (!r.ok) { toast(r.data.error || "Google didn't take that. Try again.", 6000); return; }
      await loadGoogle(); draw(); toast(ev ? "Saved" : "Added to your calendar");
    };
    popover(anchor, box, { w: 320 }); setTimeout(() => box.querySelector("input").focus(), 30);
  }
  function evCard(anchor, ev) {
    const when = ev.allDay ? (dayOfIso(ev.s) === addDays(dayOfIso(ev.e), -1) ? fmtDate(dayOfIso(ev.s)) + " · all day" : `${fmtDate(dayOfIso(ev.s))} – ${fmtDate(addDays(dayOfIso(ev.e), -1))}`) : `${fmtDate(dayOfIso(ev.s))} · ${tm(ev.s)} – ${tm(ev.e)}`;
    const box = h("div", { class: "wd-menu pl-evc" });
    box.innerHTML = `<div class="pl-evh" style="--ec:${esc(ev.color)}"><i></i><b>${esc(ev.t)}</b></div><p>${esc(when)}</p>${ev.loc ? `<p>${WI("map", 14)} ${esc(ev.loc)}</p>` : ""}${ev.desc ? `<p class="pl-desc">${esc(ev.desc).slice(0, 400)}</p>` : ""}<p class="pl-acc">${esc(ev.acctEmail || "")}</p>
      <div class="pl-fb">${ev.meet ? `<a class="pl-btn pri" href="${esc(ev.meet)}" target="_blank" rel="noopener">${WI("video", 15)}Join</a>` : ""}${ev.link ? `<a class="pl-btn" href="${esc(ev.link)}" target="_blank" rel="noopener">Open in Google</a>` : ""}<span class="wd-sp"></span>${ev.write ? `<button class="pl-ib sm" data-edit title="Change" aria-label="Change">${WI("pencil", 15)}</button><button class="pl-ib sm danger" data-del title="Delete" aria-label="Delete">${WI("trash", 15)}</button>` : ""}</div>`;
    box.querySelector("[data-edit]")?.addEventListener("click", () => { closePop(); setTimeout(() => eventForm(anchor, { ev }), 0); });
    box.querySelector("[data-del]")?.addEventListener("click", async () => { closePop(); if (!(await confirmBox(`Delete “${ev.t}” from Google Calendar?`, "Delete"))) return; const r = await api(`/api/gdata?a=event&acct=${encodeURIComponent(ev.acct)}&cal=${encodeURIComponent(ev.cal)}&id=${encodeURIComponent(ev.id)}`, { method: "DELETE" }); if (!r.ok) return toast(r.data.error || "Could not delete"); await loadGoogle(); draw(); toast("Deleted"); });
    popover(anchor, box, { w: 320 });
  }

  /* ---------- go ---------- */
  draw();
  await Promise.all([loadDbs(), loadGoogle()]);
  if (body.isConnected) draw();
  const offs = Object.values(S.dbs).map((id) => DB.on(id, () => { if (body.isConnected && !document.querySelector(".wd-pop")) draw(); }));
  const offWs = WS.on(() => { loadDbs().then(() => body.isConnected && draw()); });
  // the clock moves on: redraw each minute on My Day (the "now" line), refresh Google every 10 minutes
  const tick = setInterval(() => { if (!body.isConnected) return; if (S.view === "day" && !document.querySelector(".wd-pop")) draw(); }, 60000);
  const gt = setInterval(() => { if (body.isConnected && document.visibilityState === "visible") loadGoogle().then(() => { if (!document.querySelector(".wd-pop")) draw(); }); }, 10 * 60000);
  body.__flush = async () => { offs.forEach((f) => f()); offWs(); clearInterval(tick); clearInterval(gt); closePop(); for (const id of Object.values(S.dbs)) DB.flush(id); };
  R.handlers.planner = () => {};
  // scroll My Day to now (or 8:00)
  scrollNow();
}

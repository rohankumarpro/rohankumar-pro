// Analytics: the site's own visitor counts, owner only. The counting is in js/track.mjs and /api/sv.
import { h, $, $$, esc, api, mobile } from "/js/lib.mjs";
import { icon } from "/shared/icons.mjs";

if (!document.querySelector('link[href="/css/analytics.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "/css/analytics.css" }));
const I = (n, s = 16) => icon(n, { size: s });
const RANGES = [["1", "Today"], ["7", "7 days"], ["30", "30 days"], ["90", "90 days"]];
const METRICS = [["visitors", "Visitors"], ["visits", "Visits"], ["views", "Page views"]];
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const ymd = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60e3); return z.toISOString().slice(0, 10); };
const nf = new Intl.NumberFormat();
const fmt = (n) => nf.format(n || 0);
const dur = (s) => (!s ? "0s" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
let regionName = (c) => c; try { const dn = new Intl.DisplayNames(["en"], { type: "region" }); regionName = (c) => { try { return c && c !== "??" ? dn.of(c) || c : "Unknown"; } catch { return c; } }; } catch {}
const appTitle = (id) => (window.APPS || (typeof APPS !== "undefined" ? APPS : [])).find((a) => a.id === id)?.title || id;
const dayLabel = (d, long) => new Date(d + "T12:00:00").toLocaleDateString([], long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });

export function analyticsApp(body) {
  const S = { range: ls.get("anRange", "30"), metric: ls.get("anMetric", "visitors"), data: null, live: null, busy: false, err: "" };
  body.classList.add("an-host");
  const tracked = () => { try { return localStorage.getItem("noTrack") !== "1"; } catch { return true; } };

  async function load() {
    S.busy = true; S.err = ""; draw();
    const to = new Date(), from = new Date(); from.setDate(from.getDate() - (+S.range - 1));
    const [r, l] = await Promise.all([api(`/api/sv?from=${ymd(from)}&to=${ymd(to)}&tz=${new Date().getTimezoneOffset()}`), api("/api/sv?a=live")]);
    S.busy = false;
    if (!r.ok) { S.err = r.status === 401 ? "Sign in as the owner to see analytics." : r.data.error || "Could not load the numbers. Try again."; draw(); return; }
    S.data = r.data; S.live = l.ok ? l.data : null; draw();
  }

  const delta = (now, before, invert) => {
    if (!before && !now) return "";
    if (!before) return `<span class="an-d up">New</span>`;
    const p = Math.round(((now - before) / before) * 100); if (!p) return `<span class="an-d">0%</span>`;
    const good = invert ? p < 0 : p > 0;
    return `<span class="an-d ${good ? "up" : "down"}" title="Compared with the ${S.range === "1" ? "day" : S.range + " days"} before">${I(p > 0 ? "arrow-up" : "arrow-down", 12)}${Math.abs(p)}%</span>`;
  };
  function tiles(t, p) {
    const T = [["Visitors", fmt(t.visitors), delta(t.visitors, p.visitors), "People, counted once a day"], ["Visits", fmt(t.visits), delta(t.visits, p.visits), "A new visit after 30 minutes away"],
      ["Page views", fmt(t.views), delta(t.views, p.views), "Pages loaded"], ["Apps opened", fmt(t.appOpens), delta(t.appOpens, p.appOpens), "Windows visitors opened"],
      ["Time on site", dur(t.engaged), delta(t.engaged, p.engaged), "Average per visitor, only while the page is on screen"], ["Bounce rate", t.visits ? t.bounce + "%" : "–", t.visits ? delta(t.bounce, p.bounce, true) : "", "Visits that looked at one thing for under 10 seconds"]];
    return `<div class="an-tiles">${T.map(([l, v, d, tip]) => `<div class="an-tile" title="${esc(tip)}"><small>${l}</small><b>${v}</b>${d}</div>`).join("")}</div>`;
  }
  function chart(series) {
    const W = Math.max(280, Math.round((body.clientWidth || 800) - (mobile() ? 60 : 82))), H = mobile() ? 180 : 220, PL = 36, PR = 12, PT = 14, PB = 26, key = S.metric;
    const vals = series.map((s) => s[key]), max = Math.max(4, ...vals), step = niceStep(max), top = Math.ceil(max / step) * step;
    const x = (i) => PL + (series.length < 2 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (series.length - 1)), y = (v) => PT + (H - PT - PB) * (1 - v / top);
    const pts = series.map((s, i) => [x(i), y(s[key])]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
    const area = line + `L${x(series.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z`;
    const grid = []; for (let v = 0; v <= top; v += step) grid.push(`<line x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}"/><text x="${PL - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`);
    const every = Math.max(1, Math.ceil(series.length / (mobile() ? 4 : 8)));
    const labels = series.map((s, i) => (i % every === 0 || i === series.length - 1) && !(i !== series.length - 1 && series.length - 1 - i < every / 2) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(dayLabel(s.d))}</text>` : "").join("");
    return `<svg class="an-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(METRICS.find((m) => m[0] === key)[1])} per day">
      <g class="an-grid">${grid.join("")}</g><g class="an-x">${labels}</g>
      <path class="an-area" d="${area}"/><path class="an-line" d="${line}" vector-effect="non-scaling-stroke"/>
      ${series.length <= 31 ? pts.map((p) => `<circle class="an-pt" cx="${p[0]}" cy="${p[1]}" r="3"/>`).join("") : ""}
      <line class="an-cross" y1="${PT}" y2="${H - PB}" x1="0" x2="0" vector-effect="non-scaling-stroke"/><circle class="an-dot" r="4.5" cx="-20" cy="-20"/></svg>
      <div class="an-tip" hidden></div>`;
  }
  function niceStep(max) { const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function list(title, rows, { label = (k) => k, extra, empty = "Nothing yet.", ico } = {}) {
    const max = Math.max(1, ...rows.map((r) => r.n));
    return `<section class="an-card"><h3>${ico ? I(ico, 16) : ""}${esc(title)}</h3>${rows.length ? `<ol class="an-list">${rows.map((r) => `<li><span class="an-bar" style="--w:${((r.n / max) * 100).toFixed(1)}%"></span><span class="an-k">${esc(label(r.k))}</span><span class="an-n">${fmt(r.n)}${extra ? `<small>${extra(r)}</small>` : ""}</span></li>`).join("")}</ol>` : `<p class="an-empty">${empty}</p>`}</section>`;
  }

  function draw() {
    const d = S.data, t = d && d.totals, p = (d && d.prev) || {};
    const live = S.live ? `<span class="an-live" title="Visitors with any activity in the last 5 minutes"><i></i>${fmt(S.live.now)} on the site now</span>` : "";
    body.innerHTML = `<div class="an">
      <header class="an-head"><div><h2>Analytics</h2><p class="an-sub">${d && d.since ? `Counting since ${esc(dayLabel(d.since, true))}.` : "Counting starts with the first visit after this went live."} Only you can see this.</p></div>
        <div class="an-ctl">${live}<div class="seg an-seg" role="group" aria-label="Period">${RANGES.map(([k, l]) => `<button data-r="${k}" class="${S.range === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <button class="an-ib" data-a="reload" title="Refresh" aria-label="Refresh">${I("refresh", 17)}</button></div></header>
      ${S.err ? `<p class="an-err">${esc(S.err)}</p>` : !d ? `<div class="an-load"><span class="rb-spin"></span></div>` : `
      ${tiles(t, p)}
      ${S.range !== "1" ? `<section class="an-card an-chartc"><div class="an-ch"><h3>${I("chart", 16)}Over time</h3><div class="seg an-seg sm" role="group" aria-label="Measure">${METRICS.map(([k, l]) => `<button data-m="${k}" class="${S.metric === k ? "on" : ""}">${l}</button>`).join("")}</div></div><div class="an-chart">${chart(d.series)}</div></section>` : ""}
      <div class="an-grid2">
        ${list("Apps opened", d.apps, { label: appTitle, extra: (r) => `${fmt(r.people)} ${r.people === 1 ? "person" : "people"}`, ico: "grid" })}
        ${list("Where visits come from", d.sources, { ico: "globe" })}
        ${list("Pages", d.pages, { ico: "file" })}
        ${list("Countries", d.countries, { label: regionName, extra: (r) => "", ico: "map" })}
        ${list("Devices", d.devices, { ico: "phone" })}
        ${list("Browsers", d.browsers, { ico: "compass" })}
        ${list("Systems", d.os, { ico: "laptop" })}
        ${list("Links clicked to other sites", d.outs, { ico: "external", empty: "No clicks out yet." })}
      </div>
      <p class="an-note">How this counts: a visitor is counted once per day (no cookies, so the same person on two days counts twice). A visit ends after 30 minutes away. Robots, preview addresses and you are never counted: this browser is ${tracked() ? "counted when signed out" : "<b>never counted</b>"}.
        ${tracked() ? `<button class="an-link" data-a="notrack">Never count this browser</button>` : ""}</p>`}
    </div>`;
    if (S.busy && d) body.querySelector(".an")?.classList.add("busy");
    $$("[data-r]", body).forEach((b) => (b.onclick = () => { S.range = b.dataset.r; ls.set("anRange", S.range); S.data = null; load(); }));
    $$("[data-m]", body).forEach((b) => (b.onclick = () => { S.metric = b.dataset.m; ls.set("anMetric", S.metric); draw(); }));
    $("[data-a=reload]", body)?.addEventListener("click", load);
    $("[data-a=notrack]", body)?.addEventListener("click", () => { try { localStorage.setItem("noTrack", "1"); } catch {} draw(); });
    wireChart();
  }
  function wireChart() {
    const box = $(".an-chart", body); if (!box || !S.data) return;
    const svg = $("svg", box), tip = $(".an-tip", box), cross = $(".an-cross", box), dot = $(".an-dot", box), series = S.data.series, key = S.metric;
    const pts = [...$$(".an-pt", box)];
    const move = (e) => {
      const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, fx = ((e.clientX - r.left) / r.width) * vb.width;
      const PL = 36, PR = 12, n = series.length, i = Math.max(0, Math.min(n - 1, Math.round(((fx - PL) / (vb.width - PL - PR)) * (n - 1))));
      const cx = PL + (n < 2 ? (vb.width - PL - PR) / 2 : (i * (vb.width - PL - PR)) / (n - 1));
      const line = svg.querySelector(".an-line").getAttribute("d").split(/[ML]/).filter(Boolean)[i].split(" ");
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); dot.setAttribute("cx", line[0]); dot.setAttribute("cy", line[1]);
      pts.forEach((p, j) => p.classList.toggle("on", j === i));
      const s = series[i];
      tip.innerHTML = `<b>${esc(dayLabel(s.d, true))}</b>${METRICS.map(([k, l]) => `<span class="${k === key ? "on" : ""}">${l}<em>${fmt(s[k])}</em></span>`).join("")}`;
      tip.hidden = false; box.classList.add("hov");
      const px = (cx / vb.width) * r.width, tw = tip.offsetWidth;
      tip.style.left = Math.max(4, Math.min(r.width - tw - 4, px - tw / 2)) + "px";
    };
    const leave = () => { tip.hidden = true; box.classList.remove("hov"); dot.setAttribute("cx", -20); cross.setAttribute("x1", -20); cross.setAttribute("x2", -20); pts.forEach((p) => p.classList.remove("on")); };
    svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", leave);
  }

  draw(); load();
  const tick = setInterval(() => { if (!body.isConnected) return clearInterval(tick); api("/api/sv?a=live").then((l) => { if (l.ok && body.isConnected) { S.live = l.data; const el = $(".an-live", body); if (el) el.innerHTML = `<i></i>${fmt(l.data.now)} on the site now`; } }); }, 60e3);
}

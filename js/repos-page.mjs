// /repos: a link list unlocked with an email. Shows what is inside, then swaps the locks for links and install guides after sign-up.
import { icon } from "/shared/icons.mjs";

const LIST = "repos", SAVE = "rk-unlocked-" + LIST;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const store = { get() { try { return JSON.parse(localStorage.getItem(SAVE) || "null"); } catch { return null; } }, set(v) { try { localStorage.setItem(SAVE, JSON.stringify(v)); } catch {} } };

$("from").innerHTML = icon("sparkles", { size: 16 }) + "<span>Shared by Sansser</span>";
$("tick").innerHTML = icon("check", { size: 16, sw: 3 });
$("okIco").innerHTML = icon("unlock", { size: 20 });
$("go").innerHTML = icon("lock", { size: 18 }) + "<span>Unlock the links</span>";

const level = (l) => (l ? `<span class="lvl lvl-${esc(l.toLowerCase())}">${esc(l)}</span>` : "");

function guide(g) {
  if (!g) return "";
  let n = 0;
  const steps = g.steps.map((s) => typeof s === "string"
    ? `<li><span class="sn">${++n}</span><span>${esc(s)}</span></li>`
    : `<li class="cmd"><pre><code>${esc(s.code)}</code></pre><button type="button" class="copy" aria-label="Copy command">${icon("copy", { size: 16 })}<span>Copy</span></button></li>`).join("");
  return `<details class="guide"><summary>${icon("list", { size: 16 })}<span>How to install</span>${icon("chevron-down", { size: 16, cls: "chev" })}</summary>
    <div class="gbody"><p class="easy"><b>Easiest way:</b> ${esc(g.easiest)}</p><p class="needs"><b>You need:</b> ${esc(g.needs)}</p>
    <ol class="steps">${steps}</ol>${g.docs ? `<a class="docs" href="${esc(g.docs)}" target="_blank" rel="noopener">Official install guide ${icon("external", { size: 14 })}</a>` : ""}</div></details>`;
}

function row(it, n) {
  const logo = it.logo ? `<img src="${esc(it.logo)}" alt="" loading="lazy">` : icon("gift", { size: 24 });
  const lv = it.level || it.guide?.level;
  const inner = `${n ? `<span class="num">${n}</span>` : ""}<span class="logo">${logo}</span>
    <span class="meta"><div class="name">${esc(it.name)} ${level(lv)}</div><div class="rep">replaces <s>${esc(it.replaces)}</s></div><div class="desc">${esc(it.note)}</div></span>
    <span class="end">${icon(it.href ? "external" : "lock", { size: 18 })}</span>`;
  const head = it.href ? `<a class="row" href="${esc(it.href)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="row">${inner}</div>`;
  return `<div class="item">${head}${guide(it.guide)}</div>`;
}

function draw(d) {
  $("list").innerHTML = d.items.map((it, i) => row(it, i + 1)).join("");
  $("bonus").innerHTML = (d.bonus || []).map((it) => row(it)).join("");
  $("h-bonus").hidden = !(d.bonus || []).length;
}

function unlocked(d, msg) {
  draw(d);
  $("card").classList.add("unlocked");
  $("doneTxt").textContent = msg;
  $("start").hidden = !d.items.some((it) => it.guide);
}

// copy buttons on install commands
document.addEventListener("click", async (e) => {
  const b = e.target.closest(".copy");
  if (!b) return;
  const code = b.parentElement.querySelector("code").textContent;
  try { await navigator.clipboard.writeText(code); } catch {
    const t = document.createElement("textarea"); t.value = code; document.body.append(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove();
  }
  b.lastChild.textContent = "Copied"; b.classList.add("done");
  setTimeout(() => { b.lastChild.textContent = "Copy"; b.classList.remove("done"); }, 1600);
});

const saved = store.get();
if (saved?.items?.length && saved.items.some((it) => it.guide)) unlocked(saved, "Unlocked. Tap a repo to open it, or How to install for the steps.");
else fetch("/api/leads?list=" + LIST).then((r) => (r.ok ? r.json() : null)).then((d) => d && !$("card").classList.contains("unlocked") && draw(d)).catch(() => {});

$("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("em").value.trim();
  $("err").textContent = "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $("err").textContent = "Please enter a valid email address."; $("em").focus(); return; }
  const btn = $("go"); btn.disabled = true; btn.lastChild.textContent = "Unlocking…";
  try {
    const r = await fetch("/api/leads", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ list: LIST, email, news: $("news").checked, website: e.target.website.value, src: new URLSearchParams(location.search).get("src") || "", ref: document.referrer || "", tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "", lang: navigator.language || "" }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || "Something went wrong. Please try again.");
    store.set({ items: d.items, bonus: d.bonus });
    unlocked(d, d.emailed ? `Unlocked. A copy is on its way to ${email}.` : "Unlocked. Tap a repo to open it, or How to install for the steps.");
    $("list").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    $("err").textContent = err.message;
    btn.disabled = false; btn.lastChild.textContent = "Unlock the links";
  }
});

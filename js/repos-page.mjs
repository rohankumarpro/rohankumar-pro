// /repos: a link list unlocked with an email. Shows what is inside, then swaps the locks for links after sign-up.
import { icon } from "/shared/icons.mjs";

const LIST = "repos", SAVE = "rk-unlocked-" + LIST;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const store = { get() { try { return JSON.parse(localStorage.getItem(SAVE) || "null"); } catch { return null; } }, set(v) { try { localStorage.setItem(SAVE, JSON.stringify(v)); } catch {} } };

$("from").innerHTML = icon("sparkles", { size: 16 }) + "<span>Shared by Sansser</span>";
$("tick").innerHTML = icon("check", { size: 16, sw: 3 });
$("okIco").innerHTML = icon("unlock", { size: 20 });
$("go").innerHTML = icon("lock", { size: 18 }) + "<span>Unlock the links</span>";

function row(it, n) {
  const logo = it.logo ? `<img src="${esc(it.logo)}" alt="" loading="lazy">` : icon("gift", { size: 24 });
  const inner = `${n ? `<span class="num">${n}</span>` : ""}<span class="logo">${logo}</span>
    <span class="meta"><div class="name">${esc(it.name)}</div><div class="rep">replaces <s>${esc(it.replaces)}</s></div><div class="desc">${esc(it.note)}</div></span>
    <span class="end">${icon(it.href ? "external" : "lock", { size: 18 })}</span>`;
  return it.href ? `<a class="row" href="${esc(it.href)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="row">${inner}</div>`;
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
}

const saved = store.get();
if (saved?.items?.length) unlocked(saved, "Unlocked. Tap any repo to open it on GitHub.");
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
    unlocked(d, d.emailed ? `Unlocked. A copy is on its way to ${email}.` : "Unlocked. Tap any repo to open it on GitHub.");
    $("list").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    $("err").textContent = err.message;
    btn.disabled = false; btn.lastChild.textContent = "Unlock the links";
  }
});

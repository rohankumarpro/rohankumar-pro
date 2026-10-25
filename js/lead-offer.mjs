// Link pages unlocked with an email (/wow, /sound): a popup over a blurred stand-in page. The list id comes from <main data-list>;
// the links and steps arrive from /api/leads only after sign-up.
import { icon } from "/shared/icons.mjs";

const $ = (id) => document.getElementById(id);
const LIST = $("app").dataset.list, SAVE = "rk-unlocked-" + LIST;
const store = { get() { try { return JSON.parse(localStorage.getItem(SAVE) || "null"); } catch { return null; } }, set(v) { try { localStorage.setItem(SAVE, JSON.stringify(v)); } catch {} } };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function block(it, bonus) {
  const b = el("div", "block");
  if (bonus) b.append(el("p", "label", "Bonus tool"));
  b.append(el("h2", "", it.name), el("p", "host", new URL(it.href).host.replace(/^www\./, "")));
  const a = el("a", "btn"); a.href = it.href; a.target = "_blank"; a.rel = "noopener"; a.innerHTML = "Open " + icon("external", { size: 16 }); b.append(a);
  b.append(el("h3", "", "How to use it"));
  const ol = el("ol");
  for (const s of it.steps || []) {
    if (typeof s === "string") { ol.append(el("li", "", s)); continue; }
    const pre = el("pre"); pre.append(el("code", "", s.code));
    const c = el("button", "copy", "Copy"); c.type = "button";
    c.onclick = async () => { try { await navigator.clipboard.writeText(s.code); c.textContent = "Copied"; setTimeout(() => (c.textContent = "Copy"), 1500); } catch {} };
    const wrap = el("div", "cmd"); wrap.append(pre, c);
    (ol.lastElementChild || ol).append(wrap);
  }
  b.append(ol);
  for (const t of it.tips || []) b.append(el("p", "tip", t));
  return b;
}

function show(d) {
  $("got").replaceChildren(...d.items.map((it) => block(it)), ...(d.bonus || []).map((it) => block(it, true)));
  $("app").classList.add("unlocked");
}

const saved = store.get();
if (saved?.items?.[0]?.href) show(saved);

// The server says whether the newsletter box may start ticked where this visitor is (never in the EU, EEA or UK)
let pre = false, touched = false;
$("news").addEventListener("change", () => { touched = true; });
fetch("/api/leads?list=" + LIST, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
  if (d?.newsDefault && !touched) { pre = true; $("news").checked = true; }
}).catch(() => {});

$("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("em").value.trim();
  $("err").textContent = "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $("err").textContent = "Please enter a valid email address."; $("em").focus(); return; }
  const btn = $("go"); btn.disabled = true; btn.textContent = "Unlocking…";
  try {
    const r = await fetch("/api/leads", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ list: LIST, email, news: $("news").checked, pre: pre && !touched, website: e.target.website.value, src: new URLSearchParams(location.search).get("src") || "", ref: document.referrer || "", tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "", lang: navigator.language || "" }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || "Something went wrong. Please try again.");
    if (!d.items?.length) throw new Error("Something went wrong. Please try again.");
    store.set({ items: d.items, bonus: d.bonus || [] });
    show(d);
    scrollTo(0, 0);
  } catch (err) {
    $("err").textContent = err.message;
    btn.disabled = false; btn.textContent = "Unlock";
  }
});

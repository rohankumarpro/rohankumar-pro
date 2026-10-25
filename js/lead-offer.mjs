// A one-link page unlocked with an email (/wow): a popup over a blurred stand-in page. The list id comes from <main data-list>;
// the link and steps arrive from /api/leads only after sign-up.
import { icon } from "/shared/icons.mjs";

const $ = (id) => document.getElementById(id);
const LIST = $("app").dataset.list, SAVE = "rk-unlocked-" + LIST;
const store = { get() { try { return JSON.parse(localStorage.getItem(SAVE) || "null"); } catch { return null; } }, set(v) { try { localStorage.setItem(SAVE, JSON.stringify(v)); } catch {} } };
const li = (t) => { const e = document.createElement("li"); e.textContent = t; return e; };

$("tick").innerHTML = icon("check", { size: 14, sw: 3 });

function show(d) {
  const it = d.items[0];
  $("name").textContent = it.name;
  $("host").textContent = new URL(it.href).host.replace(/^www\./, "");
  $("open").href = it.href;
  $("open").innerHTML = "Open the website " + icon("external", { size: 16 });
  $("steps").replaceChildren(...(it.steps || []).map(li));
  $("tip").textContent = (it.tips || [])[0] || "";
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
    store.set({ items: d.items });
    show(d);
    scrollTo(0, 0);
  } catch (err) {
    $("err").textContent = err.message;
    btn.disabled = false; btn.textContent = "Unlock";
  }
});

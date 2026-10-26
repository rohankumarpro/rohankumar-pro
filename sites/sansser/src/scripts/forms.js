// Unlock popup and newsletter forms. The server decides consent defaults and returns links only after sign-up.
import { FX } from "./fx.js";
import { ICON } from "./icon.js";
import { toast } from "./kit.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const src = new URLSearchParams(location.search).get("src") || "";
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem("sansser-unlocked-" + k) || "null"); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem("sansser-unlocked-" + k, JSON.stringify(v)); } catch {} },
};

function renderItems(items) {
  const box = $("lp-items"); if (!box) return;
  box.classList.add("unlocked");
  box.innerHTML = items.map((it, i) => `<a class="it" style="--i:${i}" href="${esc(it.url)}" target="_blank" rel="noopener"><span class="mono">${it.bonus ? "+" : String(i + 1).padStart(2, "0")}</span><span class="nm">${esc(it.name)}<span class="ds">${esc(it.desc)}</span></span>${it.tag ? `<span class="tg">${esc(it.tag)}</span>` : "<span></span>"}${ICON("out")}</a>`).join("");
}

// Unlock popup on reel pages
(() => {
  const veil = $("veil"); if (!veil) return;
  const keyword = veil.dataset.keyword, saved = store.get(keyword);
  if (saved?.items) { renderItems(saved.items); return; }
  veil.classList.add("show");
  setTimeout(() => $("pf-email").focus({ preventScroll: true }), 150);

  let pre = false, touched = false;
  $("pf-news").addEventListener("change", () => { touched = true; });
  fetch("/api/consent", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.pre && !touched) { pre = true; $("pf-news").checked = true; } }).catch(() => {});

  $("pf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("pf-email").value.trim(), err = $("pf-err");
    err.textContent = "";
    if (!EMAIL.test(email)) { err.textContent = "Enter an email like you@email.com."; $("pf-email").focus(); return; }
    const go = $("pf-go"), pop = $("pf"), label = go.querySelector(".lbl");
    go.disabled = true; go.classList.add("fx-on"); label.innerHTML = '<span class="spin"></span>';
    try {
      const r = await fetch("/api/unlock", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword, email, newsletter: $("pf-news").checked, pre: pre && !touched, website: pop.website.value, src }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || (r.status === 429 ? "Too many tries. Give it a minute." : "Something went wrong. Please try again."));
      const g = go.getBoundingClientRect(), pr = pop.getBoundingClientRect();
      pop.style.setProperty("--bx", g.left + g.width / 2 - pr.left + "px"); pop.style.setProperty("--by", g.top + g.height / 2 - pr.top + "px");
      label.innerHTML = "Unlocked" + ICON("check"); pop.classList.add("bloom"); FX.kick();
      setTimeout(() => {
        if (d.next) { location.href = d.next; return; }
        store.set(keyword, { items: d.items }); renderItems(d.items);
        veil.classList.remove("show"); toast("Links unlocked");
      }, 750);
    } catch (x) {
      err.textContent = x.message; go.disabled = false; go.classList.remove("fx-on"); label.innerHTML = "Unlock" + ICON("arrow");
    }
  });
})();

// Newsletter forms
document.querySelectorAll("form.news-form").forEach((f) => {
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = f.querySelector("input[type=email]"), note = f.parentElement.querySelector(".note"), email = input.value.trim();
    if (!EMAIL.test(email)) { if (note) note.textContent = "Enter an email like you@email.com"; input.focus(); return; }
    const btn = f.querySelector("button"); btn.disabled = true;
    try {
      const r = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, where: f.dataset.where || "home", website: f.website?.value || "", src }) });
      if (!r.ok) throw new Error();
      f.innerHTML = `<div class="ok">${ICON("check")}You're in. Check your inbox.</div>`; if (note) note.textContent = ""; toast("Subscribed");
    } catch { if (note) note.textContent = "Something went wrong. Please try again."; btn.disabled = false; }
  });
});

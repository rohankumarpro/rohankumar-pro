// Assistant (owner only): Claude, on the owner's own Claude plan.
//  - In the desktop app, Claude itself shows inside this window (the app lays its own Claude window exactly over the
//    window's body and keeps it there; it hides whenever something else is on top).
//  - On the web and on a phone, it opens Claude in a new tab, with the question already typed.
//  - Either way Claude can reach the workspace through the private connector (/api/mcp) once it is added in Claude.
import { h, $, esc, api, toast } from "/js/lib.mjs";
import { faceSvg, lively, asName, setAsName, faceOn, setFaceOn, mountFace } from "/js/assistant-face.mjs";

const T = () => window.__TAURI__;
const CLAUDE = "https://claude.ai/new";
const askUrl = (q) => (q ? CLAUDE + "?q=" + encodeURIComponent(q) : CLAUDE);
const ICO = {
  send: '<path d="M4 12h13M12 5l7 7-7 7"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', reload: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const ic = (n, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
const CHIPS = [
  ["Plan my day", "Use my workspace connector: look at today (calendar, tasks, important email, renewals) and plan my day in time blocks."],
  ["What's due this week", "Use my workspace connector: list my open tasks due in the next 7 days, grouped by day, and flag anything overdue."],
  ["Write a video script", "Use my workspace connector: take my newest Studio video idea, pick a hook, stakes and rehooks from my Studio blocks, and write the timed plan into that video."],
  ["Sum up important email", "Use my workspace connector: sum up my important email and suggest which ones need a task."],
  ["Add a task", "Use my workspace connector to add a task: "],
];

export function assistantApp(body) {
  if (!document.querySelector('link[href="/css/assistant.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "/css/assistant.css" }));
  const desk = !!(T() && T().core);
  body.classList.add("as-body");
  return desk ? desktop(body) : web(body);
}

/* ---------- desktop app: Claude inside this window ---------- */
function desktop(body) {
  const inv = (cmd, args) => T().core.invoke(cmd, args).catch((e) => { console.error("assistant", cmd, e); throw e; });
  body.innerHTML = `<div class="as-d">
    <div class="as-bar">${faceSvg("sm")}<b class="as-nm">${esc(asName())}</b><span class="as-sp"></span>
      <button class="as-ib" data-a="new" title="New chat">${ic("plus")}</button>
      <button class="as-ib" data-a="reload" title="Reload">${ic("reload")}</button>
      <button class="as-ib" data-a="ext" title="Open in your browser">${ic("ext")}</button>
      <button class="as-ib" data-a="more" title="Connector and settings">${ic("gear")}</button></div>
    <div class="as-host"><div class="as-wait">${faceSvg("big")}<p>Opening Claude…</p><small>Sign in once with your Claude account. If Google sign-in is refused here, use “Continue with email”.</small></div></div>
    <div class="as-more" hidden></div></div>`;
  lively($(".as-bar .asf", body)); lively($(".as-wait .asf", body));
  const host = $(".as-host", body), more = $(".as-more", body);
  let shown = false, last = "", dead = false, started = false, raf = 0;

  // where the body is, in the app window's pixels (copes with the page's text-size zoom)
  const rect = () => {
    const r = host.getBoundingClientRect(), w = host.closest(".win"), z = parseFloat(document.body.style.zoom) || 1;
    const left = w && parseFloat(w.style.left), wr = w && w.getBoundingClientRect();
    const f = z !== 1 && left > 0 && wr ? z / (wr.left / left) : 1;
    return { x: r.left * f, y: r.top * f, w: r.width * f, h: r.height * f };
  };
  // Claude can only show while nothing else of the site sits over this window (menus, other windows, search...)
  const clear = () => {
    const w = host.closest(".win"); if (!w || !w.classList.contains("top") || w.matches(".min,.minimizing,.closing,.opening,.popin,.restoring") || document.hidden || !more.hidden) return false;
    const r = host.getBoundingClientRect(); if (r.width < 60 || r.height < 60) return false;
    const pts = [[0.5, 0.5], [0.06, 0.06], [0.94, 0.06], [0.06, 0.94], [0.94, 0.94], [0.5, 0.06], [0.5, 0.94]];
    return pts.every(([a, b]) => { const el = document.elementFromPoint(r.left + r.width * a, r.top + r.height * b); return el && host.contains(el); });
  };
  const tick = () => {
    if (dead) return;
    if (!host.isConnected) { stop(); return; }
    const ok = clear();
    if (ok) {
      const p = rect(), key = [p.x, p.y, p.w, p.h].map(Math.round).join(",");
      if (!shown || key !== last) {
        last = key;
        const first = !started; started = true;
        (shown ? inv("claude_place", p) : inv("claude_show", { ...p, url: null })).then(() => { if (first) $(".as-wait p", body).textContent = "Claude is open in this window."; }).catch(() => { $(".as-wait p", body).textContent = "Claude could not open here. Update the desktop app, or open it in your browser."; });
        shown = true;
      }
    } else if (shown) { shown = false; inv("claude_hide").catch(() => {}); }
    raf = requestAnimationFrame(tick);
  };
  const stop = () => { if (dead) return; dead = true; cancelAnimationFrame(raf); inv("claude_hide").catch(() => {}); };
  const go = (url) => { shown = false; last = ""; inv("claude_show", { ...rect(), url }).then(() => (shown = true)).catch(() => {}); };
  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a;
    if (a === "new") go(CLAUDE);
    if (a === "reload") { inv("claude_close").catch(() => {}); shown = false; last = ""; }
    if (a === "ext") window.open(CLAUDE, "_blank", "noopener");
    if (a === "more") { more.hidden = !more.hidden; b.classList.toggle("on", !more.hidden); if (!more.hidden) { more.replaceChildren(); settings(more, { chips: (q) => { more.hidden = true; go(askUrl(q)); } }); } }
  });
  tick();
  return { destroy: stop };
}

/* ---------- web and phone: Ask Claude ---------- */
function web(body) {
  body.innerHTML = `<div class="as-w">
    <div class="as-hero">${faceSvg("big")}<h2 class="as-nm">${esc(asName())}</h2><p>Ask Claude anything. It opens in a new tab on your own Claude plan, and can work in your workspace once the connector is added.</p>
      <form class="as-ask"><textarea rows="1" placeholder="Ask anything…" aria-label="Ask Claude"></textarea><button class="as-go" type="submit" aria-label="Ask">${ic("send", 20)}</button></form>
      <div class="as-chips"></div></div>
    <div class="as-cards"></div></div>`;
  lively($(".as-hero .asf", body));
  const ta = $("textarea", body);
  const ask = (q) => { const w = window.open(askUrl(q), "_blank", "noopener"); if (!w) location.href = askUrl(q); };
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(200, ta.scrollHeight) + "px"; });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $(".as-ask", body).requestSubmit(); } });
  $(".as-ask", body).onsubmit = (e) => { e.preventDefault(); ask(ta.value.trim()); ta.value = ""; ta.style.height = ""; };
  $(".as-chips", body).append(...CHIPS.map(([t, q]) => h("button", { class: "as-chip", type: "button", onclick: () => { if (q.endsWith(": ")) { ta.value = q; ta.focus(); ta.dispatchEvent(new Event("input")); } else ask(q); } }, t)));
  settings($(".as-cards", body), {});
}

/* ---------- connector, name and face (both) ---------- */
function settings(box, { chips }) {
  if (chips) box.append(h("div", { class: "as-card" }, h("h3", {}, "Quick asks"), h("div", { class: "as-chips" }, ...CHIPS.map(([t, q]) => h("button", { class: "as-chip", type: "button", onclick: () => chips(q) }, t)))));
  const url = location.origin + "/api/mcp";
  const list = h("div", { class: "as-grants" });
  const card = h("div", { class: "as-card" },
    h("h3", { html: ic("plug") + " Connect Claude to your workspace" }),
    h("p", {}, "Once, in Claude: Settings, Connectors, Add custom connector. Paste this address, press Connect, and type your site password on the page that opens. Then turn it on in a chat (the tools button) and ask, for example, “plan my day”."),
    h("div", { class: "as-url" }, h("code", {}, url), h("button", { class: "as-ib", title: "Copy", "aria-label": "Copy address", html: ic("copy"), onclick: () => navigator.clipboard.writeText(url).then(() => toast("Address copied")) })),
    h("p", { class: "as-mut" }, "It can read and change tasks, pages, databases, the planner, Studio, Library and Subscriptions. It never sees the vault. Only you can approve it."),
    list);
  const draw = async () => {
    const r = await api("/api/oauth?a=grants");
    const g = r.ok ? r.data.grants : [];
    list.replaceChildren(g.length ? h("h4", {}, "Connected") : h("p", { class: "as-mut" }, r.ok ? "Not connected yet." : "Could not check the connections."),
      ...g.map((x) => h("div", { class: "as-grant" }, h("span", {}, h("b", {}, x.name), h("small", {}, "Added " + new Date(x.created).toLocaleDateString() + (x.last ? ", last used " + new Date(x.last).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""))),
        h("button", { class: "btn tonal", onclick: async () => { if (!confirm("End this connection? Claude will need to connect again.")) return; await api("/api/oauth?a=grants&id=" + encodeURIComponent(x.id), { method: "DELETE" }); draw(); } }, "End"))));
  };
  draw();
  const name = h("input", { class: "as-in", value: asName(), maxlength: 24, "aria-label": "Name" });
  name.onchange = () => { setAsName(name.value); document.querySelectorAll(".as-nm").forEach((n) => (n.textContent = asName())); const a = typeof APPS !== "undefined" && APPS.find((x) => x.id === "assistant"); if (a) { a.title = asName(); if (typeof renderIcons === "function") renderIcons(); } document.querySelector(".as-buddy")?.remove(); mountFace(); toast("Name saved on this device"); };
  const face = h("input", { type: "checkbox", checked: faceOn() }); face.onchange = () => setFaceOn(face.checked);
  box.append(card, h("div", { class: "as-card" }, h("h3", {}, "Name and face"),
    h("label", { class: "as-row" }, h("span", {}, "Name"), name),
    h("label", { class: "as-row" }, h("span", {}, "Show the face on the desktop"), face),
    h("p", { class: "as-mut" }, T() ? "In this desktop app Claude opens right inside the window." : "In the desktop app Claude opens right inside this window. Here it opens in a new tab.")));
}

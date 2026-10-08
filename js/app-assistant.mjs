// Assistant (owner only): Claude, on the owner's own Claude plan.
//  - In the desktop app, Claude itself shows inside this window (the app lays its own Claude window exactly over the
//    window's body and keeps it there; it hides whenever something else is on top).
//  - On the web and on a phone, it is a chat right here: Google Gemini through /api/assistant, with the same workspace tools
//    as the connector. Reading is free; every change shows an Apply / Cancel card first.
//  - Claude itself can still reach the workspace through the private connector (/api/mcp) once it is added in Claude.
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

/* ---------- web and phone: a chat right here (Gemini, through /api/assistant) ---------- */
const human = (n) => String(n || "").replace(/_/g, " ");
// small, safe markdown: **bold**, `code`, "- " and "1. " lists. Everything is escaped first.
function mdHtml(text) {
  const inline = (t) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of String(text || "").replace(/\r/g, "").split("\n")) {
    let m;
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); }
    else { close(); if (line.trim()) out.push(`<p>${inline(line.replace(/^#{1,3}\s+/, ""))}</p>`); }
  }
  close(); return out.join("");
}
const argText = (v) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

function web(body) {
  body.innerHTML = `<div class="as-w">
    <div class="as-top" hidden>${faceSvg("sm")}<b class="as-nm">${esc(asName())}</b><span class="as-sp"></span>
      <button class="as-ib" data-a="new" title="New chat" aria-label="New chat">${ic("plus")}</button>
      <button class="as-ib" data-a="ext" title="Open Claude in a new tab" aria-label="Open Claude in a new tab">${ic("ext")}</button></div>
    <div class="as-hero">${faceSvg("big")}<h2 class="as-nm">${esc(asName())}</h2><p>Ask anything about your day, tasks, notes, videos or money. I can look things up and, when you press Apply, change them.</p>
      <div class="as-chips"></div></div>
    <div class="as-log" role="log" aria-live="polite" hidden></div>
    <form class="as-ask"><textarea rows="1" placeholder="Ask anything…" aria-label="Message"></textarea><button class="as-go" type="submit" aria-label="Send">${ic("send", 20)}</button></form>
    <label class="as-model"><span>Model</span><select aria-label="Model"></select></label>
    <div class="as-cards"></div></div>`;
  lively($(".as-hero .asf", body)); lively($(".as-top .asf", body));
  const ta = $("textarea", body), log = $(".as-log", body), top = $(".as-top", body), hero = $(".as-hero", body), cards = $(".as-cards", body), form = $(".as-ask", body), go = $(".as-go", body);
  let contents = [], busy = false;
  // which Gemini model answers: the list comes from the key itself, the choice is remembered on this device
  const pick = $(".as-model select", body), saved = (() => { try { return localStorage.getItem("rkAsModel") || ""; } catch { return ""; } })();
  const fill = (list, def) => { const ids = list.map((m) => m.id), want = saved && (ids.includes(saved) || !ids.length) ? saved : def; if (want && !ids.includes(want)) list = [{ id: want, name: want }, ...list]; pick.replaceChildren(...list.map((m) => h("option", { value: m.id }, m.name === m.id ? m.id : `${m.name} (${m.id})`))); if (want) pick.value = want; };
  fill([], "gemini-flash-latest");
  pick.onchange = () => { try { localStorage.setItem("rkAsModel", pick.value); } catch {} toast("Model: " + pick.value); };
  api("/api/assistant?a=models").then((r) => { if (r.ok && r.data.models) fill(r.data.models, r.data.default || "gemini-flash-latest"); });

  const scroll = () => requestAnimationFrame(() => { const w = $(".as-w", body); w.scrollTop = w.scrollHeight; });
  const say = (who, node) => { const m = h("div", { class: "as-msg " + who }, node); log.append(m); scroll(); return m; };
  const started = () => { hero.hidden = true; cards.hidden = true; top.hidden = false; log.hidden = false; };
  const reset = () => { if (busy) return; contents = []; log.replaceChildren(); log.hidden = true; top.hidden = true; hero.hidden = false; cards.hidden = false; ta.focus(); };
  const lock = (on) => { busy = on; go.disabled = on; ta.disabled = on; if (!on) ta.focus(); };
  const typing = () => say("bot", h("span", { class: "as-dots", "aria-label": "Thinking" }, h("i"), h("i"), h("i")));

  // what the assistant looked at since the last answer, as small quiet lines
  const steps = (from, all) => { const names = []; for (const t of all.slice(from)) if (t.role === "model") for (const p of t.parts) if (p.functionCall) names.push(human(p.functionCall.name)); if (names.length) say("step", h("small", {}, "Looked at: " + [...new Set(names)].join(", "))); };

  const problem = (d, retry) => {
    const setup = d && (d.code === "no_key" || d.code === "bad_key" || d.code === "bad_model");
    const node = h("div", { class: "as-card as-err" }, h("p", {}, (d && d.error) || "Something went wrong."),
      setup ? h("p", { class: "as-mut" }, "Get a free key at aistudio.google.com, then in Netlify open Site configuration, Environment variables and add GEMINI_API_KEY with it. Redeploy once and this chat starts working.") : null,
      retry ? h("button", { class: "btn tonal", type: "button", onclick: () => { node.closest(".as-msg")?.remove(); post(); } }, "Try again") : null);
    say("bot", node);
  };

  const pendingCard = (list) => {
    const rows = list.map((c) => h("div", { class: "as-act" }, h("b", {}, c.title), ...Object.entries(c.args || {}).filter(([, v]) => v !== "" && v != null).map(([k, v]) => h("div", { class: "as-kv" }, h("span", {}, human(k)), h("code", {}, argText(v))))));
    const apply = h("button", { class: "btn", type: "button" }, "Apply"), cancel = h("button", { class: "btn tonal", type: "button" }, "Cancel");
    const card = h("div", { class: "as-card as-pend" }, h("h3", {}, list.length > 1 ? "Apply these changes?" : "Apply this change?"), ...rows, h("div", { class: "as-btns" }, cancel, apply));
    const decide = (yes) => { apply.disabled = cancel.disabled = true; card.classList.add(yes ? "yes" : "no"); const note = h("small", {}, yes ? "Applying…" : "Cancelled"); card.querySelector(".as-btns").replaceChildren(note); post({ approve: yes }).then(() => { if (yes) note.textContent = "Approved"; }); };
    apply.onclick = () => decide(true); cancel.onclick = () => decide(false);
    say("bot", card);
  };

  async function post(extra) {
    if (busy) return; lock(true);
    const wait = typing();
    try {
      for (let i = 0; i < 6; i++) {
        const before = contents.length;
        const r = await api("/api/assistant", { method: "POST", body: { contents, model: pick.value, ...(i ? {} : extra) } });
        if (!r.ok) { wait.remove(); lock(false); if (r.status === 401) return say("bot", h("p", {}, "Sign in as the owner to use this.")); return problem(r.data, true); }
        contents = r.data.contents; steps(before, contents); wait.remove();
        if (r.data.pending) { pendingCard(r.data.pending); lock(false); return; }
        if (r.data.text) { say("bot", h("div", { class: "as-md", html: mdHtml(r.data.text) })); lock(false); return; }
        if (!r.data.more) break;
        log.append(wait); scroll();
      }
      wait.remove(); lock(false);
    } catch (e) { console.error("assistant", e); wait.remove(); lock(false); problem({ error: "Something went wrong." }, true); }
  }

  const send = (q) => {
    q = String(q || "").trim(); if (!q || busy) return;
    started(); say("me", h("p", {}, q)); contents.push({ role: "user", parts: [{ text: q }] });
    ta.value = ""; ta.style.height = ""; post();
  };
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(200, ta.scrollHeight) + "px"; });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.onsubmit = (e) => { e.preventDefault(); send(ta.value); };
  top.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (!b) return; if (b.dataset.a === "new") reset(); if (b.dataset.a === "ext") window.open(CLAUDE, "_blank", "noopener"); });
  $(".as-chips", body).append(...CHIPS.map(([t, q]) => h("button", { class: "as-chip", type: "button", onclick: () => { if (q.endsWith(": ")) { ta.value = q.replace("Use my workspace connector to add a task: ", "Add a task: "); ta.focus(); ta.dispatchEvent(new Event("input")); } else send(q.replace("Use my workspace connector: ", "")); } }, t)));
  settings(cards, {});
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
    h("p", { class: "as-mut" }, T() ? "In this desktop app Claude opens right inside the window." : "Here you chat with Gemini. Changes always wait for your Apply. The button at the top opens Claude itself in a new tab.")));
}

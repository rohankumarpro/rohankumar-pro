// Ask Rohan: the visitor bot. A small chat that answers questions about the owner and the site (Gemini, through /api/ask).
// It only talks: it can read the public site and nothing else, and it can change nothing. The conversation stays in this tab.
// The owner also finds the private Claude connector here (setup and the list of connections), which visitors never see.
import { h, $, esc, api, toast, isAdmin } from "/js/lib.mjs";
import { faceSvg, lively, faceOn, setFaceOn, mountFace } from "/js/assistant-face.mjs";

const KEEP = "rkAskChat", MAX_IN = 500;
const ICO = {
  send: '<path d="M4 12h13M12 5l7 7-7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const ic = (n, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
const SUGGEST = ["What does Rohan do?", "Show me his best branding work", "How do I work with him?", "What has he written about AI?", "How can I book a call?"];

// small, safe markdown: links (this site or https), **bold**, `code`, and "- " lists. Everything is escaped first.
function md(text) {
  const inline = (t) => esc(t)
    .replace(/\[([^\]]+)\]\((\/[^\s)]*|https?:\/\/[^\s)]+)\)/g, (m, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of String(text || "").replace(/\r/g, "").split("\n")) {
    let m;
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); }
    else { close(); if (line.trim()) out.push(`<p>${inline(line.replace(/^#{1,3}\s+/, ""))}</p>`); }
  }
  close(); return out.join("");
}

const saved = () => { try { const v = JSON.parse(sessionStorage.getItem(KEEP) || "[]"); return Array.isArray(v) ? v.filter((m) => m && (m.role === "user" || m.role === "bot") && typeof m.text === "string").slice(-40) : []; } catch { return []; } };
const keep = (list) => { try { sessionStorage.setItem(KEEP, JSON.stringify(list.slice(-40))); } catch {} };

export function assistantApp(body) {
  if (!document.querySelector('link[href="/css/assistant.css"]')) document.head.append(h("link", { rel: "stylesheet", href: "/css/assistant.css" }));
  body.classList.add("ak-body");
  body.innerHTML = `<div class="ak">
    <header class="ak-top">${faceSvg("sm")}<div class="ak-id"><span class="ak-ai">AI</span><small>Knows Rohan's work and this site</small></div><span class="ak-sp"></span>
      <button class="ak-ib" type="button" data-a="new" title="Start over" aria-label="Start over">${ic("plus")}</button>
      <button class="ak-ib" type="button" data-a="more" title="Options" aria-label="Options">${ic("gear")}</button></header>
    <div class="ak-scroll"><div class="ak-hero">${faceSvg("big")}<h2>Hi, I'm Rohan's assistant</h2><p>I'm an AI that knows Rohan's work, services and writing. Ask me anything about him or this site.</p><div class="ak-chips"></div></div>
      <div class="ak-log" role="log" aria-live="polite" hidden></div></div>
    <footer class="ak-foot"><form class="ak-form"><textarea rows="1" maxlength="${MAX_IN}" placeholder="Ask about Rohan…" aria-label="Your question"></textarea><button class="ak-send" type="submit" aria-label="Send">${ic("send", 20)}</button></form>
      <p class="ak-note">I'm an AI and can get things wrong. For anything important, <a href="/contact" target="_blank" rel="noopener">message Rohan</a>.</p></footer>
    <div class="ak-more" hidden></div></div>`;
  lively($(".ak-top .asf", body)); lively($(".ak-hero .asf", body));
  const ta = $("textarea", body), form = $(".ak-form", body), send = $(".ak-send", body), log = $(".ak-log", body), hero = $(".ak-hero", body), scroller = $(".ak-scroll", body), more = $(".ak-more", body);
  let msgs = saved(), busy = false;

  const down = () => requestAnimationFrame(() => scroller.scrollTo({ top: scroller.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  const show = (who, node) => { const m = h("div", { class: "ak-msg " + who }, node); log.append(m); down(); return m; };
  const started = () => { hero.hidden = true; log.hidden = false; };
  const lock = (on) => { busy = on; send.disabled = on; ta.disabled = on; if (!on && !matchMedia("(pointer:coarse)").matches) ta.focus(); };
  const dots = () => show("bot", h("span", { class: "ak-dots", "aria-label": "Thinking" }, h("i"), h("i"), h("i")));
  const reset = () => { if (busy) return; msgs = []; keep(msgs); log.replaceChildren(); log.hidden = true; hero.hidden = false; more.hidden = true; ta.value = ""; ta.style.height = ""; };
  const draw = (m) => show(m.role === "user" ? "me" : "bot", m.role === "user" ? h("p", {}, m.text) : h("div", { class: "ak-md", html: md(m.text) }));

  const oops = (text, retry) => {
    const node = h("div", { class: "ak-err" }, h("p", {}, text), retry ? h("button", { class: "ak-retry", type: "button", onclick: () => { node.closest(".ak-msg")?.remove(); ask(); } }, "Try again") : null);
    show("bot", node);
  };

  async function ask() {
    lock(true); const wait = dots();
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: msgs.slice(-10) }) });
      let d = {}; try { d = await r.json(); } catch {}
      wait.remove();
      if (r.ok && d.text) { const m = { role: "bot", text: d.text }; msgs.push(m); keep(msgs); draw(m); }
      else if (d.code === "off") oops("I'm not switched on yet." + (isAdmin() ? " Add GEMINI_API_KEY in Netlify (Site configuration, Environment variables) and redeploy." : " You can message Rohan instead."), false);
      else if (d.code === "busy") oops(d.error || "I'm busy right now. Please try again in a minute.", r.status !== 429);
      else oops("Something went wrong on my side.", true);
    } catch { wait.remove(); oops("I couldn't reach the site. Check your connection and try again.", true); }
    lock(false);
  }

  const say = (q) => {
    q = String(q || "").trim().slice(0, MAX_IN); if (!q || busy) return;
    started(); const m = { role: "user", text: q }; msgs.push(m); keep(msgs); draw(m);
    ta.value = ""; ta.style.height = ""; ask();
  };
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.onsubmit = (e) => { e.preventDefault(); say(ta.value); };
  $(".ak-chips", body).append(...SUGGEST.map((t) => h("button", { class: "ak-chip", type: "button", onclick: () => say(t) }, t)));
  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    if (b.dataset.a === "new") reset();
    if (b.dataset.a === "more") { more.hidden = !more.hidden; b.classList.toggle("on", !more.hidden); if (!more.hidden) options(more); }
  });

  if (msgs.length) { started(); msgs.forEach(draw); }
  if (!matchMedia("(pointer:coarse)").matches) setTimeout(() => ta.isConnected && ta.focus(), 60);
}

/* ---------- options: the desktop face (everyone), the Claude connector (the owner only) ---------- */
function options(box) {
  box.replaceChildren();
  const face = h("input", { type: "checkbox", checked: faceOn() }); face.onchange = () => { setFaceOn(face.checked); mountFace(); };
  box.append(h("div", { class: "ak-card" }, h("h3", {}, "Options"),
    h("label", { class: "ak-row" }, h("span", {}, "Show the little face on the desktop"), face),
    h("p", { class: "ak-mut" }, "The face opens this chat. This chat is kept in this tab only and is never saved on the site.")));
  if (!isAdmin()) return;
  const url = location.origin + "/api/mcp", list = h("div", { class: "ak-grants" });
  box.append(h("div", { class: "ak-card" },
    h("h3", { html: ic("plug") + " Claude connector (only you see this)" }),
    h("p", {}, "To use Claude on your own workspace: in Claude open Settings, Connectors, Add custom connector, paste this address, press Connect and type your site password."),
    h("div", { class: "ak-url" }, h("code", {}, url), h("button", { class: "ak-ib", type: "button", title: "Copy", "aria-label": "Copy address", html: ic("copy"), onclick: () => navigator.clipboard.writeText(url).then(() => toast("Address copied")) })),
    list));
  const draw = async () => {
    const r = await api("/api/oauth?a=grants"), g = r.ok ? r.data.grants : [];
    list.replaceChildren(g.length ? h("h4", {}, "Connected") : h("p", { class: "ak-mut" }, r.ok ? "Not connected yet." : "Could not check the connections."),
      ...g.map((x) => h("div", { class: "ak-grant" }, h("span", {}, h("b", {}, x.name), h("small", {}, "Added " + new Date(x.created).toLocaleDateString() + (x.last ? ", last used " + new Date(x.last).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""))),
        h("button", { class: "ak-retry", type: "button", onclick: async () => { if (!confirm("End this connection? Claude will need to connect again.")) return; await api("/api/oauth?a=grants&id=" + encodeURIComponent(x.id), { method: "DELETE" }); draw(); } }, "End"))));
  };
  draw();
}

// Ask Rohan: the visitor bot. A playful chat that answers questions about the owner and the site (Gemini, through /api/ask).
// It only talks: it can read the public site and nothing else, and it can change nothing. The conversation stays in this tab.
// Fun: the face has moods that follow the answers, replies type out with soft sounds, there are colours and a few secret
// commands (/help lists them). The owner also finds the private Claude connector under Options; visitors never see it.
import { h, $, esc, api, toast, isAdmin } from "/js/lib.mjs";
import { faceSvg, lively, mood, talk, feel, faceOn, setFaceOn, mountFace, prefs, SKINS, applySkin } from "/js/assistant-face.mjs";

const KEEP = "rkAskChat", MAX_IN = 500;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const fx = () => import("/js/ask-fx.mjs");
const snd = (n) => { if (prefs.sound()) fx().then((m) => m.sound(n)).catch(() => {}); };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ICO = {
  send: '<path d="M4 12h13M12 5l7 7-7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>',
  on: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.500 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12"/>', off: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.200" fill="currentColor"/><circle cx="15" cy="15" r="1.200" fill="currentColor"/><circle cx="15" cy="9" r="1.200" fill="currentColor"/><circle cx="9" cy="15" r="1.200" fill="currentColor"/>',
};
const ic = (n, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
const SUGGEST = ["What does Rohan do?", "Show me his best branding work", "How do I work with him?", "What has he written about AI?", "How can I book a call?"];
const SURPRISE = ["Tell me something surprising about Rohan's work.", "Pitch Rohan to me in one sentence. Make it punny.", "What's the most interesting thing Rohan has written?", "If Rohan's work were a colour palette, what would it be?", "Roast Rohan's portfolio. Gently."];
const GREET = ["Hi, I'm Rohan's assistant", "Hey! Ask me anything", "Oh hello there!", "Welcome in. Pixels are fresh."];
const SUB = ["I'm an AI that knows Rohan's work, services and writing. Ask me anything about him or this site.", "I've read the whole site. Go on, quiz me.", "Work, writing, prices, vibes. I know a bit about everything Rohan."];

// small, safe markdown: links (this site or https), **bold**, `code`, and "- " lists. Everything is escaped first.
function md(text) {
  const inline = (t) => esc(t)
    .replace(/\[([^\]]+)\]\((\/[^\s)]*|https?:\/\/[^\s)]+)\)/g, (m, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1<i>$2</i>");
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
  applySkin(); body.classList.add("ak-body");
  body.innerHTML = `<div class="ak">
    <header class="ak-top">${faceSvg("sm head")}<div class="ak-id"><span class="ak-ai">AI</span><small>Knows Rohan's work and this site</small></div><span class="ak-sp"></span>
      <button class="ak-ib" type="button" data-a="snd" title="Sound" aria-label="Sound" aria-pressed="${prefs.sound()}">${ic(prefs.sound() ? "on" : "off")}</button>
      <button class="ak-ib" type="button" data-a="new" title="Start over" aria-label="Start over">${ic("plus")}</button>
      <button class="ak-ib" type="button" data-a="more" title="Options" aria-label="Options">${ic("gear")}</button></header>
    <div class="ak-scroll"><div class="ak-hero"><div class="ak-floaters" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <button class="ak-herof" type="button" aria-label="Say hi to the face">${faceSvg("big")}</button><h2></h2><p></p><div class="ak-chips"></div></div>
      <div class="ak-log" role="log" aria-live="polite" hidden></div></div>
    <footer class="ak-foot"><form class="ak-form"><textarea rows="1" maxlength="${MAX_IN}" placeholder="Ask about Rohan…" aria-label="Your question"></textarea><button class="ak-send" type="submit" aria-label="Send">${ic("send", 20)}</button></form>
      <p class="ak-note">I'm an AI and can get things wrong. For anything important, <a href="/contact" target="_blank" rel="noopener">message Rohan</a>. <span class="ak-hint">Psst: try /party</span></p></footer>
    <div class="ak-more" hidden></div></div>`;
  const headFace = $(".ak-top .asf", body), heroFace = $(".ak-hero .asf", body);
  lively(headFace); lively(heroFace);
  const ta = $("textarea", body), form = $(".ak-form", body), send = $(".ak-send", body), log = $(".ak-log", body), hero = $(".ak-hero", body), scroller = $(".ak-scroll", body), more = $(".ak-more", body), sndBtn = $('[data-a="snd"]', body);
  let msgs = saved(), busy = false;
  $("h2", hero).textContent = pick(GREET); $("p", hero).textContent = pick(SUB);

  // the faces feel what the chat is doing (the one on the desktop too)
  const feelAll = (name, ms = 0) => { mood(headFace, name, ms); mood(heroFace, name, ms); feel(name, ms); };
  const down = () => requestAnimationFrame(() => scroller.scrollTo({ top: scroller.scrollHeight, behavior: calm() ? "auto" : "smooth" }));
  const show = (who, node, face) => {
    const m = h("div", { class: "ak-msg " + who }, node);
    const av = who === "bot" ? h("span", { class: "ak-av", html: faceSvg("xs") }) : null; if (av && face) mood(av.firstChild, face);
    log.append(h("div", { class: "ak-line " + who }, av, m)); down(); return m;
  };
  const gone = (m) => m && m.parentElement && m.parentElement.remove();
  const started = () => { hero.hidden = true; log.hidden = false; };
  const lock = (on) => { busy = on; send.disabled = on; ta.disabled = on; if (!on && !matchMedia("(pointer:coarse)").matches) ta.focus(); };
  const dots = () => { const m = show("bot", h("span", { class: "ak-dots", "aria-label": "Thinking" }, h("i"), h("i"), h("i")), "thinking"); return m; };
  const reset = () => { if (busy) return; msgs = []; keep(msgs); log.replaceChildren(); log.hidden = true; hero.hidden = false; more.hidden = true; ta.value = ""; ta.style.height = ""; $("h2", hero).textContent = pick(GREET); $("p", hero).textContent = pick(SUB); feelAll("happy", 900); snd("boop"); };

  // a reply types itself out, word by word, with soft ticks (click it to skip). Not for people who asked for less motion.
  function reveal(node) {
    const html = node.innerHTML, words = [], walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
    for (const t of texts) {
      if (!t.nodeValue.trim()) continue; const frag = document.createDocumentFragment();
      for (const part of t.nodeValue.split(/(\s+)/)) { if (!part) continue; if (/^\s+$/.test(part)) frag.append(part); else { const s = document.createElement("span"); s.className = "ak-w"; s.textContent = part; frag.append(s); words.push(s); } }
      t.replaceWith(frag);
    }
    if (calm() || !words.length) { node.innerHTML = html; return Promise.resolve(); }
    const per = Math.max(16, Math.min(46, 1800 / words.length)); let skip = false; node.classList.add("typing"); node.addEventListener("click", () => (skip = true), { once: true });
    const finish = (res) => { node.innerHTML = html; node.classList.remove("typing"); res(); };   // back to plain text, so underlines and lists look normal
    return new Promise((res) => { let i = 0; (function step() { if (skip || i >= words.length) { finish(res); return; } words[i].classList.add("on"); if (i % 3 === 0) snd("tick"); i++; down(); setTimeout(step, per); })(); });
  }
  async function draw(m, animate) {
    if (m.role === "user") { show("me", h("p", {}, m.text)); return; }
    const box = h("div", { class: "ak-md", html: md(m.text) }), bubble = show("bot", box, m.mood);
    if (!animate) { return; }
    talk(headFace, true); await reveal(box); talk(headFace, false);
  }

  const oops = (text, retry) => {
    feelAll("sorry", 3000); snd("sad");
    const node = h("div", { class: "ak-err" }, h("p", {}, text), retry ? h("button", { class: "ak-retry", type: "button", onclick: () => { gone(node.closest(".ak-msg")); ask(); } }, "Try again") : null);
    show("bot", node, "sorry");
  };
  // what the page remembers of the chat is only the words (the secret commands stay on this page)
  const toServer = () => msgs.filter((m) => !m.local).slice(-10).map(({ role, text }) => ({ role, text }));

  async function ask() {
    lock(true); feelAll("thinking"); const wait = dots();
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: toServer() }) });
      let d = {}; try { d = await r.json(); } catch {}
      gone(wait);
      if (r.ok && d.text) {
        const mo = ["happy", "excited", "curious", "sorry", "cool", "love", "sleepy"].includes(d.mood) ? d.mood : "happy", m = { role: "bot", text: d.text, mood: mo };
        msgs.push(m); keep(msgs); snd("recv"); feelAll(mo, 4200); await draw(m, true);
      }
      else if (d.code === "off") oops("I'm not switched on yet." + (isAdmin() ? " Add GEMINI_API_KEY in Netlify (Site configuration, Environment variables) and redeploy." : " You can message Rohan instead."), false);
      else if (d.code === "busy") oops(d.error || "I'm busy right now. Please try again in a minute.", r.status !== 429);
      else oops("Something went wrong on my side.", true);
    } catch { gone(wait); oops("I couldn't reach the site. Check your connection and try again.", true); }
    lock(false);
  }

  /* ---------- secret commands, handled right here (nothing is sent) ---------- */
  const local = (text, m) => { const o = { role: "bot", text, mood: m || "happy", local: true }; msgs.push(o); keep(msgs); started(); return draw(o, true); };
  async function party() {
    snd("sparkle"); feelAll("excited", 5000); const was = prefs.skin(); document.documentElement.dataset.askSkin = "rainbow";
    const m = await fx().catch(() => null); if (m) { const r = body.getBoundingClientRect(); [0.3, 0.5, 0.7].forEach((k, i) => setTimeout(() => m.confetti({ x: r.left + r.width * k, y: r.top + r.height * 0.45, n: 50 }), i * 260)); }
    setTimeout(() => applySkin(was), 8000);
  }
  function command(text) {
    const [c, ...rest] = text.trim().toLowerCase().split(/\s+/); if (!c.startsWith("/")) return false;
    started(); const m = { role: "user", text, local: true }; msgs.push(m); keep(msgs); draw(m); ta.value = ""; ta.style.height = "";
    if (c === "/party") { party(); local("Party mode! Hold on to your pixels.", "excited"); }
    else if (c === "/dance") { [headFace, heroFace].forEach((f) => { f.classList.add("dance"); setTimeout(() => f.classList.remove("dance"), 3200); }); feelAll("excited", 3200); snd("sparkle"); local("*wiggles professionally*", "cool"); }
    else if (c === "/sleep") { feelAll("sleepy", 6000); local("Zzz… five more minutes…", "sleepy"); }
    else if (c === "/mute") { prefs.setSound(false); sync(); local("Shh. Sound off.", "cool"); }
    else if (c === "/unmute") { prefs.setSound(true); sync(); snd("recv"); local("Sound on!", "happy"); }
    else if (c === "/skin") { const k = rest[0]; if (SKINS.some((s) => s[0] === k)) { prefs.setSkin(k); snd("pop"); local(`New look: ${k}. Suits me.`, "cool"); } else local(`Try /skin ${SKINS.map((s) => s[0]).join(", ")}`, "curious"); }
    else if (c === "/help") local("Tricks: /party, /dance, /sleep, /skin mint, /mute, /unmute. Also: click the face five times, drag it around, or leave it alone to nap.", "happy");
    else local("Hmm, I don't know that trick. Try /help.", "curious");
    return true;
  }

  const say = (q) => {
    q = String(q || "").trim().slice(0, MAX_IN); if (!q || busy) return;
    if (command(q)) return;
    started(); const m = { role: "user", text: q }; msgs.push(m); keep(msgs); draw(m, false); snd("send");
    ta.value = ""; ta.style.height = ""; ask();
  };
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.onsubmit = (e) => { e.preventDefault(); say(ta.value); };
  $(".ak-chips", body).append(...SUGGEST.map((t) => h("button", { class: "ak-chip", type: "button", onclick: () => say(t) }, t)),
    h("button", { class: "ak-chip surprise", type: "button", onclick: () => say(pick(SURPRISE)), html: `${ic("dice", 16)}<span>Surprise me</span>` }));
  $(".ak-herof", body).onclick = () => { feelAll(pick(["excited", "love", "cool"]), 1600); heroFace.classList.add("jump"); setTimeout(() => heroFace.classList.remove("jump"), 600); snd("pop"); };
  const sync = () => { sndBtn.innerHTML = ic(prefs.sound() ? "on" : "off"); sndBtn.setAttribute("aria-pressed", String(prefs.sound())); };
  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    if (b.dataset.a === "new") reset();
    if (b.dataset.a === "snd") { prefs.setSound(!prefs.sound()); sync(); snd("pop"); }
    if (b.dataset.a === "more") { more.hidden = !more.hidden; b.classList.toggle("on", !more.hidden); if (!more.hidden) options(more, sync); }
  });

  if (msgs.length) { started(); msgs.forEach((m) => draw(m, false)); mood(headFace, msgs[msgs.length - 1].mood || "neutral"); down(); }
  else { setTimeout(() => { feelAll("excited", 1100); heroFace.classList.add("jump"); setTimeout(() => heroFace.classList.remove("jump"), 600); }, 350); }
  if (!matchMedia("(pointer:coarse)").matches) setTimeout(() => ta.isConnected && ta.focus(), 60);
}

/* ---------- options: look, sound and the desktop face (everyone), the Claude connector (the owner only) ---------- */
function options(box, onSound) {
  box.replaceChildren();
  const sw = h("div", { class: "ak-swatches", role: "group", "aria-label": "Colour" }, ...SKINS.map(([id, name, c]) => h("button", { class: "ak-sw", type: "button", title: name, "aria-label": name, "aria-pressed": String(prefs.skin() === id), style: `--c:${c}`, onclick: () => { prefs.setSkin(id); sw.querySelectorAll(".ak-sw").forEach((b) => b.setAttribute("aria-pressed", String(b.title === name))); fx().then((m) => prefs.sound() && m.sound("pop")).catch(() => {}); } })));
  const toggle = (label, on, set) => { const i = h("input", { type: "checkbox", checked: on }); i.onchange = () => set(i.checked); return h("label", { class: "ak-row" }, h("span", {}, label), i); };
  box.append(h("div", { class: "ak-card" }, h("h3", {}, "Make it yours"), h("p", { class: "ak-mut" }, "Pick a colour:"), sw,
    toggle("Sounds", prefs.sound(), (v) => { prefs.setSound(v); onSound && onSound(); }),
    toggle("Show the little face on the desktop", faceOn(), (v) => { setFaceOn(v); mountFace(); }),
    toggle("Let the face chat on its own", !prefs.quiet(), (v) => prefs.setQuiet(!v)),
    h("p", { class: "ak-mut" }, "Secret tricks: type /help in the chat. This chat is kept in this tab only and is never saved on the site.")));
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

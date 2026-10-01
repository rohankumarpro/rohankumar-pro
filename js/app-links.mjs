// Links: a link-in-bio page that goes further than Linktree: scheduling, themes, embeds, countdowns, email sign-up,
// click and visit statistics, a QR code, "save contact", short links, and a live builder for the owner.
import { h, $, $$, esc, api, isAdmin, toast, mobile, Up, share, confirmBox, fmtNum, ago } from "/js/lib.mjs";
import { embedInfo, safeUrl } from "/shared/blocks.mjs";
import { R } from "/js/os-ext.mjs";

const H = { hub: null, saved: false, stats: null };
const ICONS = {
  link: '<path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>', work: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  cam: '<rect x="3" y="6" width="18" height="14" rx="4"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="2.6"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 8h6"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10 9.5v5l4.5-2.5z"/>', music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', pin: '<path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18v3H3zM12 9v11M12 9c-3 0-4-4-1-4s1 4 1 4zM12 9c3 0 4-4 1-4s-1 4-1 4z"/>', download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  brush: '<path d="M18 3 9 12l3 3 9-9z"/><path d="M9 12c-3 0-4 2-4 4s-1 3-2 4c3 1 7 0 8-3 .5-1.5.5-3-2-5z"/>', spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  coffee: '<path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>', ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  news: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2v2M14 18h2M18 18h2v2"/>',
};
const ICON_KEYS = Object.keys(ICONS);
const glyph = (k, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.link}</svg>`;
const SOC = { instagram: ["Instagram", "linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF)", "◎"], youtube: ["YouTube", "#FF0000", "▶"], linkedin: ["LinkedIn", "#0A66C2", "in"], behance: ["Behance", "#1769FF", "Bē"], dribbble: ["Dribbble", "#EA4C89", "Dr"], figma: ["Figma", "#1E1E1E", "F"], x: ["X", "#000", "𝕏"], github: ["GitHub", "#24292F", "Gh"], tiktok: ["TikTok", "#000", "Tk"], facebook: ["Facebook", "#1877F2", "f"], threads: ["Threads", "#000", "@"], pinterest: ["Pinterest", "#E60023", "P"], reddit: ["Reddit", "#FF4500", "R"], spotify: ["Spotify", "#1DB954", "♫"], medium: ["Medium", "#000", "M"], whatsapp: ["WhatsApp", "#25D366", "Wa"], telegram: ["Telegram", "#26A5E4", "Tg"], email: ["Email", "#5F6368", "✉"], website: ["Website", "#2E6B57", "↗"] };
const PRESETS = {
  mint: { name: "Mint", bg: "linear-gradient(160deg,#E6ECE4,#C4E2D1)", fg: "#17201B", mut: "#4B5851", card: "rgba(255,255,255,.72)", accent: "#2E6B57", on: "#fff", line: "rgba(0,0,0,.08)" },
  midnight: { name: "Midnight", bg: "linear-gradient(160deg,#0F1512,#1A3B2E)", fg: "#E3ECE6", mut: "#A5B4AB", card: "rgba(255,255,255,.08)", accent: "#8FD5B8", on: "#062519", line: "rgba(255,255,255,.14)" },
  sunset: { name: "Sunset", bg: "linear-gradient(160deg,#FFE9DB,#F9C9B2 55%,#F4A58E)", fg: "#3a1d12", mut: "#7a4a37", card: "rgba(255,255,255,.68)", accent: "#D9480F", on: "#fff", line: "rgba(0,0,0,.08)" },
  paper: { name: "Paper", bg: "#FAF7F0", fg: "#1c1b19", mut: "#6b6860", card: "#ffffff", accent: "#1c1b19", on: "#fff", line: "rgba(0,0,0,.1)", font: "serif" },
  lilac: { name: "Lilac", bg: "linear-gradient(160deg,#EEEAFF,#D6CFFF)", fg: "#241f4a", mut: "#5c54a3", card: "rgba(255,255,255,.72)", accent: "#5C54A3", on: "#fff", line: "rgba(0,0,0,.07)" },
  mono: { name: "Mono", bg: "#ffffff", fg: "#000000", mut: "#555555", card: "#ffffff", accent: "#000000", on: "#fff", line: "#000000", font: "mono" },
  ocean: { name: "Ocean", bg: "linear-gradient(160deg,#D6EEF8,#9FD3F2)", fg: "#06283D", mut: "#2F5D7C", card: "rgba(255,255,255,.72)", accent: "#0F6CBD", on: "#fff", line: "rgba(0,0,0,.07)" },
  neon: { name: "Neon", bg: "linear-gradient(160deg,#0B0B12,#171726)", fg: "#F4F4FB", mut: "#9A9AB5", card: "rgba(255,255,255,.06)", accent: "#C2FF73", on: "#0B0B12", line: "rgba(194,255,115,.32)" },
};
const FONTS = { sans: 'var(--font)', serif: 'Georgia,"Times New Roman",serif', mono: 'var(--mono)', rounded: 'ui-rounded,"SF Pro Rounded","Nunito",var(--font)', display: '"Figtree",var(--font)' };
const TYPES = [["link", "Link", "link"], ["header", "Heading", "news"], ["text", "Text", "pen"], ["embed", "Video or music", "play"], ["app", "Open an app", "spark"], ["email", "Email", "mail"], ["phone", "Phone", "phone"], ["whatsapp", "WhatsApp", "chat"], ["map", "Location", "pin"], ["copy", "Copy text", "copy"], ["countdown", "Countdown", "clock"], ["subscribe", "Email sign-up", "heart"], ["vcard", "Save contact", "person"], ["image", "Banner image", "cam"], ["divider", "Divider", "star"]];
const rid = () => Math.random().toString(36).slice(2, 10);
const siteName = () => (typeof P !== "undefined" && P.name) || "Rohan Kumar";
const profileOf = (hub) => ({ name: hub.profile.name || siteName(), role: hub.profile.role || (typeof P !== "undefined" && P.role) || "", status: hub.profile.status || (typeof P !== "undefined" && P.status) || "", bio: hub.profile.bio || "", avatar: hub.profile.avatar || "/img/avatar.jpg" });
const hrefOf = (i) => i.type === "email" ? `mailto:${i.url}` : i.type === "phone" ? `tel:${i.url}` : i.type === "whatsapp" ? `https://wa.me/${String(i.url).replace(/\D/g, "")}` : i.type === "map" ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.url)}` : i.type === "countdown" || i.type === "image" ? i.link || "" : i.url || "";
const siteUrl = () => location.origin + "/links";

async function load(force) {
  if (H.hub && !force) return;
  const r = await api("/api/hub");
  H.hub = r.ok ? r.data.hub : { v: 1, profile: {}, theme: { preset: "mint" }, socials: [], items: [], settings: { share: true, qr: true, vcard: true }, vcard: {} };
  H.saved = !!(r.ok && r.data.saved);
}
export async function linksApp(body) {
  R.handlers.links = (b) => linksApp(b);
  await load(true);
  body.onscroll = null; body.classList.remove("jr-editing");
  const box = h("div", { class: "hubwrap" }); body.replaceChildren(box);
  renderHub(box, H.hub, { owner: isAdmin(), onEdit: () => builder(body), track: !isAdmin() });
  R.item(body, "", "", "replace");
}

/* ---------- the public page ---------- */
function themeVars(hub) {
  const t = hub.theme || {}, p = PRESETS[t.preset] || PRESETS.mint;
  const bg = t.bg ? (t.bg2 ? `linear-gradient(160deg,${t.bg},${t.bg2})` : t.bg) : p.bg;
  return { "--hb-bg": t.bgImg ? `center/cover url(${t.bgImg})` : bg, "--hb-fg": t.text || p.fg, "--hb-mut": t.text || p.mut, "--hb-card": p.card, "--hb-ac": t.accent || p.accent, "--hb-on": t.accent ? contrast(t.accent) : p.on, "--hb-line": p.line, "--hb-font": FONTS[t.font && t.font !== "sans" ? t.font : p.font || "sans"] };
}
function contrast(hex) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff"; }
function socialBtn(s) { const [name, bg, ch] = SOC[s.type] || SOC.website; const href = s.type === "email" ? `mailto:${s.url}` : s.url; return `<a class="hb-soc" href="${esc(href)}" target="_blank" rel="me noopener" aria-label="${esc(name)}" title="${esc(name)}" style="background:${bg}"><span>${ch}</span></a>`; }
function itemHtml(i, st, hub) {
  const th = hub.theme || {};
  const cls = ["hb-it", i.style === "featured" ? "hb-feat" : i.style === "outline" ? "hb-out" : "", i.anim && i.anim !== "none" ? "an-" + i.anim : ""].filter(Boolean).join(" ");
  const ico = i.thumb ? `<img class="hb-th" src="${esc(i.thumb)}" alt="" loading="lazy">` : `<span class="hb-ic" style="--ic:var(--${i.color || "c1"})">${glyph(i.icon || { email: "mail", phone: "phone", whatsapp: "chat", map: "pin", copy: "copy", vcard: "person", app: "spark", countdown: "clock", subscribe: "heart" }[i.type] || "link")}</span>`;
  const inner = `${ico}<span class="hb-t"><b>${esc(i.title)}</b>${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</span>${i.badge ? `<em class="hb-badge">${esc(i.badge)}</em>` : ""}<svg class="hb-ar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;
  switch (i.type) {
    case "header": return `<h2 class="hb-h${i.collapsible ? " hb-col" : ""}" data-id="${esc(i.id)}"${i.collapsible ? ` role="button" tabindex="0" aria-expanded="${!i.closed}"` : ""}>${esc(i.title)}${i.collapsible ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>' : ""}</h2>`;
    case "text": return `<p class="hb-p">${i.html || esc(i.title)}</p>`;
    case "divider": return `<hr class="hb-hr">`;
    case "image": return `<figure class="hb-img">${i.link ? `<a href="${esc(i.link)}" target="_blank" rel="noopener" data-id="${esc(i.id)}"><img src="${esc(i.src)}" alt="${esc(i.alt || i.title || "")}" loading="lazy"></a>` : `<img src="${esc(i.src)}" alt="${esc(i.alt || i.title || "")}" loading="lazy">`}</figure>`;
    case "embed": { const e = embedInfo(i.url); if (!e) return `<a class="${cls}" href="${esc(i.url)}" target="_blank" rel="noopener" data-id="${esc(i.id)}">${inner}</a>`; return `<div class="hb-emb" data-id="${esc(i.id)}" data-src="${esc(e.src)}" style="${e.fixedH ? `height:${e.fixedH}px` : `aspect-ratio:${e.ratio}`}">${e.thumb ? `<button class="hb-play" aria-label="Play ${esc(i.title || e.kind)}"><img src="${esc(e.thumb)}" alt="" loading="lazy"><span>▶</span></button>` : `<iframe src="${esc(e.src)}" loading="lazy" allowfullscreen title="${esc(e.kind)}"></iframe>`}</div>${i.title ? `<small class="hb-cap">${esc(i.title)}</small>` : ""}`; }
    case "app": return `<button class="${cls}" data-app="${esc(i.app)}" data-id="${esc(i.id)}">${inner}</button>`;
    case "copy": return `<button class="${cls}" data-copy="${esc(i.text)}" data-id="${esc(i.id)}">${inner}</button>`;
    case "vcard": return `<a class="${cls}" href="/api/hub?a=vcard" download data-id="${esc(i.id)}">${inner}</a>`;
    case "subscribe": return `<form class="hb-sub" data-id="${esc(i.id)}"><b>${esc(i.title)}</b>${i.sub ? `<small>${esc(i.sub)}</small>` : ""}<div><input type="email" required placeholder="you@example.com" aria-label="Your email"><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button>${esc(i.button || "Subscribe")}</button></div><p class="hb-msg" role="status"></p></form>`;
    case "countdown": return `<${i.link ? "a" : "div"} class="${cls} hb-cd" ${i.link ? `href="${esc(i.link)}" target="_blank" rel="noopener"` : ""} data-id="${esc(i.id)}" data-date="${i.date}" data-end="${esc(i.endText || "")}"><span class="hb-ic">${glyph("clock")}</span><span class="hb-t"><b>${esc(i.title)}</b><small class="cdv">…</small></span></${i.link ? "a" : "div"}>`;
    default: { const href = hrefOf(i); return `<a class="${cls}" href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ""} data-id="${esc(i.id)}">${inner}</a>`; }
  }
}
export function renderHub(box, hub, { owner, onEdit, preview, track } = {}) {
  const pr = profileOf(hub), th = hub.theme || {}, vars = themeVars(hub);
  const now = Date.now();
  const items = hub.items.filter((i) => (preview ? !i.hidden : true) && !(!owner && !preview && i.hidden) && (!(i.start && i.start > now) && !(i.end && i.end <= now) || (owner || preview)));
  box.innerHTML = "";
  const root = h("div", { class: "hub", "data-shape": th.shape || "round", "data-fill": th.fill || "soft", "data-layout": th.layout || "list", "data-align": th.align || "center", "data-pattern": th.pattern || "none" });
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  let list = "", closed = false;
  for (const i of items) {
    if (i.type === "header") closed = !!(i.collapsible && i.closed);
    const dim = (i.hidden || (i.start && i.start > now) || (i.end && i.end <= now)) ? ` data-dim="${i.hidden ? "Hidden" : i.start > now ? "Scheduled" : "Expired"}"` : "";
    list += `<div class="hb-row${closed && i.type !== "header" ? " shut" : ""}"${dim} data-for="${esc(i.id)}">${itemHtml(i, null, hub)}</div>`;
  }
  root.innerHTML = `<div class="hb-pat"></div><div class="hb-in">${owner && onEdit ? '<button class="hb-edit">✎ Edit page</button>' : ""}
    <header class="hb-head"><img class="hb-av" src="${esc(pr.avatar)}" alt="${esc(pr.name)}" width="96" height="96"><h1>${esc(pr.name)}</h1>${pr.role ? `<p class="hb-role">${esc(pr.role)}</p>` : ""}${pr.status ? `<span class="hb-status"><i></i>${esc(pr.status)}</span>` : ""}${pr.bio ? `<p class="hb-bio">${esc(pr.bio)}</p>` : ""}</header>
    ${hub.socials.length ? `<div class="hb-socs">${hub.socials.map(socialBtn).join("")}</div>` : ""}
    <div class="hb-list">${list || '<p class="hb-empty">No links yet.</p>'}</div>
    <footer class="hb-foot">${hub.settings.share !== false ? `<button data-act="share">${glyph("share", 18)} Share</button>` : ""}${hub.settings.qr !== false ? `<button data-act="qr">${glyph("qr", 18)} QR code</button>` : ""}${hub.settings.vcard !== false && hub.vcard.name ? `<a href="/api/hub?a=vcard" download>${glyph("person", 18)} Save contact</a>` : ""}</footer></div>`;
  box.append(root);
  // behaviour
  const beacon = (a, data) => { if (!track) return; try { const blob = new Blob([JSON.stringify(data)], { type: "application/json" }); if (!navigator.sendBeacon || !navigator.sendBeacon("/api/hub?a=" + a, blob)) fetch("/api/hub?a=" + a, { method: "POST", body: JSON.stringify(data), headers: { "content-type": "application/json" }, keepalive: true }); } catch {} };
  root.addEventListener("click", (e) => {
    const t = e.target, id = t.closest("[data-id]")?.dataset.id;
    if (t.closest(".hb-edit")) return onEdit && onEdit();
    const app = t.closest("[data-app]"); if (app) { if (id) beacon("click", { id }); if (preview) return; return openApp(app.dataset.app); }
    const cp = t.closest("[data-copy]"); if (cp) { if (id) beacon("click", { id }); navigator.clipboard?.writeText(cp.dataset.copy).then(() => toast("Copied")).catch(() => prompt("Copy this", cp.dataset.copy)); return; }
    const hd = t.closest(".hb-h.hb-col"); if (hd) { const it = hub.items.find((x) => x.id === hd.dataset.id); if (it) { it.closed = !it.closed; renderHub(box, hub, { owner, onEdit, preview, track }); } return; }
    const pl = t.closest(".hb-play"); if (pl) { const w = pl.closest(".hb-emb"); if (id) beacon("click", { id }); w.innerHTML = `<iframe src="${esc(w.dataset.src)}${w.dataset.src.includes("?") ? "&" : "?"}autoplay=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="Video"></iframe>`; return; }
    const a = t.closest("a[data-id]"); if (a && id) { beacon("click", { id }); if (preview) e.preventDefault(); return; }
    const act = t.closest("[data-act]")?.dataset.act;
    if (act === "share") share(siteUrl(), pr.name + " — Links"); if (act === "qr") qrModal();
  });
  root.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".hb-h.hb-col")) { e.preventDefault(); e.target.click(); } });
  $$(".hb-sub", root).forEach((f) => f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (preview) return; const msg = $(".hb-msg", f), email = $("input[type=email]", f).value;
    msg.textContent = "…"; const r = await api("/api/hub?a=subscribe", { method: "POST", body: { email, website: $(".hp", f).value } });
    msg.textContent = r.ok ? "You're in. Thank you!" : r.data.error || "Something went wrong."; if (r.ok) f.reset();
  }));
  const tick = () => $$(".hb-cd", root).forEach((c) => { const d = +c.dataset.date - Date.now(), v = $(".cdv", c); if (d <= 0) { v.textContent = c.dataset.end || "It's time!"; return; } const days = Math.floor(d / 86400000), hh = Math.floor((d % 86400000) / 3600000), mm = Math.floor((d % 3600000) / 60000); v.textContent = days > 0 ? `${days}d ${hh}h ${mm}m left` : `${hh}h ${mm}m ${Math.floor((d % 60000) / 1000)}s left`; });
  if ($(".hb-cd", root)) { tick(); const iv = setInterval(() => { if (!root.isConnected) return clearInterval(iv); tick(); }, 1000); }
  if (track && !preview) { try { if (!sessionStorage.getItem("hubv")) { sessionStorage.setItem("hubv", "1"); beacon("view", { ref: document.referrer, mobile: matchMedia("(pointer:coarse)").matches }); } } catch {} }
}
function qrModal() {
  const url = siteUrl(); const q = typeof qrOf === "function" ? qrOf(url) : null; if (!q) { toast("Could not make a QR code"); return; }
  const png = () => { const c = document.createElement("canvas"), n = q.n + 6, k = 16; c.width = c.height = n * k; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = "#111"; const g = QRGEN(0, "M"); g.addData(url); g.make(); for (let r = 0; r < q.n; r++) for (let cc = 0; cc < q.n; cc++) if (g.isDark(r, cc)) x.fillRect((cc + 3) * k, (r + 3) * k, k, k); const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "links-qr.png"; a.click(); };
  const svg = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([qrSvg(q).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')], { type: "image/svg+xml" })); a.download = "links-qr.svg"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
  const d = h("div", { class: "own-dlg" }, h("div", { class: "own-card hb-qr", role: "dialog", "aria-modal": "true", "aria-label": "QR code" }, h("div", { class: "hb-qrimg", html: qrSvg(q) }), h("small", {}, url.replace(/^https?:\/\//, "")), h("div", { class: "own-row" }, h("button", { onclick: png }, "PNG"), h("button", { onclick: svg }, "SVG"), h("button", { onclick: () => d.remove() }, "Close"))));
  d.addEventListener("click", (e) => { if (e.target === d) d.remove(); }); d.addEventListener("keydown", (e) => { if (e.key === "Escape") d.remove(); }); document.body.append(d);
}

/* ---------- the builder ---------- */
function builder(body) {
  const w = body.closest(".win"), wasMax = w.classList.contains("max");
  if (!mobile()) w.classList.add("max");
  const B = { hub: JSON.parse(JSON.stringify(H.hub)), tab: "links", open: null, status: H.saved ? "Saved" : "Not saved yet", saveT: null, preview: false };
  body.classList.add("jr-editing"); body.onscroll = null;
  const TABS = [["links", "Links"], ["design", "Design"], ["profile", "Profile"], ["stats", "Analytics"], ["subs", "Subscribers"]];
  body.innerHTML = `<div class="jed hbe"><div class="jed-bar"><button class="back" data-a="done">‹ Done</button><span class="jed-st hbe-st">${esc(B.status)}</span><span class="sp"></span><button data-a="prev" class="hbe-pvb">Preview</button></div>
    <div class="hbe-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}">${l}</button>`).join("")}</div>
    <div class="hbe-cols"><div class="hbe-main"></div><div class="hbe-pv"><div class="hbe-phone"><div class="hbe-screen"></div></div></div></div></div>`;
  const main = $(".hbe-main", body), screen = $(".hbe-screen", body), st = $(".hbe-st", body);
  const setSt = (t) => { B.status = t; st.textContent = t; };
  let pvT = null;
  const pv = () => { clearTimeout(pvT); pvT = setTimeout(() => renderHub(screen, B.hub, { preview: true, owner: false }), 120); };
  const touch = (rePreview = true) => { setSt("Unsaved changes"); clearTimeout(B.saveT); B.saveT = setTimeout(save, 1000); if (rePreview) pv(); };
  async function save() {
    clearTimeout(B.saveT); setSt("Saving…");
    const r = await api("/api/hub", { method: "PUT", body: { hub: B.hub } });
    if (r.ok) { H.hub = r.data.hub; H.saved = true; setSt("Saved"); } else setSt(r.status === 401 ? "Signed out. Not saved." : r.data.error || "Could not save (" + r.status + ")");
  }
  const swatch = (k) => { const p = PRESETS[k]; return `<button class="hbe-sw${B.hub.theme.preset === k ? " on" : ""}" data-preset="${k}" style="background:${p.bg};color:${p.fg}" aria-label="${p.name} theme"><span style="background:${p.accent}"></span><b>${p.name}</b></button>`; };
  const sel = (key, label, opts) => `<label class="ow-f">${label}<select data-th="${key}">${opts.map(([v, l]) => `<option value="${v}"${(B.hub.theme[key] || opts[0][0]) === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>`;
  const clr = (key, label) => `<label class="ow-f hbe-clr">${label}<span><input type="color" data-clr="${key}" value="${B.hub.theme[key] || (key === "text" ? "#17201B" : key === "accent" ? (PRESETS[B.hub.theme.preset] || PRESETS.mint).accent : "#E6ECE4")}"><button class="rb-mini" data-clrx="${key}">Reset</button></span></label>`;
  /* --- tab: links --- */
  const fieldsFor = (it) => {
    const F = [], f = (k, label, type = "text", ph = "") => F.push({ k, label, type, ph });
    if (["link", "app", "email", "phone", "whatsapp", "map", "copy", "embed", "vcard", "countdown", "subscribe"].includes(it.type)) f("title", it.type === "subscribe" ? "Heading" : "Title");
    if (it.type === "header") f("title", "Heading");
    if (it.type === "link" || it.type === "embed") f("url", "Web address", "url", "https://…");
    if (it.type === "app") F.push({ k: "app", label: "Opens", type: "app" });
    if (it.type === "email") f("url", "Email address", "email", "name@example.com"); if (it.type === "phone") f("url", "Phone number", "tel", "+91…"); if (it.type === "whatsapp") f("url", "WhatsApp number (with country code)", "tel", "+91…"); if (it.type === "map") f("url", "Address or place", "text", "12 Park Street, Kolkata");
    if (it.type === "copy") f("text", "Text to copy", "text", "UPI id, promo code…");
    if (it.type === "text") F.push({ k: "text", label: "Text", type: "area" });
    if (it.type === "countdown") { F.push({ k: "date", label: "Counts down to", type: "datetime" }); f("link", "Link when it ends (optional)", "url", "https://…"); f("endText", "Message when it ends"); }
    if (it.type === "image") { F.push({ k: "src", label: "Picture", type: "image" }); f("alt", "Describe the picture"); f("link", "Link (optional)", "url", "https://…"); }
    if (it.type === "subscribe") { f("sub", "Small text under it"); f("button", "Button label"); }
    return F;
  };
  const advanced = (it) => ["link", "app", "email", "phone", "whatsapp", "map", "copy", "countdown", "vcard", "subscribe"].includes(it.type);
  const dtVal = (ms) => { if (!ms) return ""; const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  function itemCard(it, i) {
    const open = B.open === it.id, F = fieldsFor(it), tp = TYPES.find((t) => t[0] === it.type) || TYPES[0];
    const clicks = H.stats?.items?.[it.id];
    const inp = (f) => {
      const v = f.k === "text" || f.k === "button" ? it[f.k] || "" : it[f.k] ?? "";
      if (f.type === "app") return `<label class="ow-f">${f.label}<select data-k="${f.k}">${APPS.filter((a) => a.id !== "settings").map((a) => `<option value="${a.id}"${it.app === a.id ? " selected" : ""}>${esc(a.title)}</option>`).join("")}</select></label>`;
      if (f.type === "area") return `<label class="ow-f">${f.label}<textarea data-k="${f.k}" rows="3" maxlength="600">${esc(v)}</textarea></label>`;
      if (f.type === "datetime") return `<label class="ow-f">${f.label}<input type="datetime-local" data-k="${f.k}" data-ms="1" value="${dtVal(it[f.k])}"></label>`;
      if (f.type === "image") return `<div class="ow-f">${f.label}<div class="hbe-imgrow">${it.src ? `<img src="${esc(it.src)}" alt="">` : ""}<button class="rb-mini" data-pick="src">${it.src ? "Replace" : "Upload"}</button></div></div>`;
      return `<label class="ow-f">${f.label}<input type="${f.type === "url" ? "text" : f.type}" data-k="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph)}" maxlength="300" ${f.type === "url" ? 'inputmode="url"' : ""}></label>`;
    };
    return `<div class="hbe-card${it.hidden ? " off" : ""}${open ? " open" : ""}" data-id="${it.id}" data-i="${i}"><div class="hbe-ch"><button class="hbe-grip" aria-label="Drag to reorder" title="Drag to reorder">⋮⋮</button><span class="hbe-ti">${glyph(tp[2], 18)}</span>
      <div class="hbe-sum" data-a="toggle"><b>${esc(it.title || it.url || it.text || tp[1])}</b><small>${esc(tp[1])}${it.type === "link" && it.url ? " · " + esc(it.url.replace(/^https?:\/\//, "").slice(0, 36)) : ""}${clicks ? ` · ${clicks} click${clicks === 1 ? "" : "s"}` : ""}${it.start && it.start > Date.now() ? " · scheduled" : ""}</small></div>
      <button class="hbe-eye" data-a="hide" aria-label="${it.hidden ? "Show" : "Hide"}" title="${it.hidden ? "Hidden. Click to show" : "Visible. Click to hide"}">${it.hidden ? "🙈" : "👁"}</button><button class="hbe-x" data-a="del" aria-label="Delete" title="Delete">✕</button></div>
      ${open ? `<div class="hbe-cb">${F.map(inp).join("")}${it.type === "header" ? `<label class="ow-app"><input type="checkbox" data-k="collapsible" ${it.collapsible ? "checked" : ""}><span>Let visitors collapse this section</span></label>` : ""}
        ${advanced(it) ? `<details class="hbe-adv"><summary>More options</summary>
          ${it.type !== "subscribe" && it.type !== "countdown" ? `<label class="ow-f">Small text<input data-k="sub" value="${esc(it.sub || "")}" maxlength="160"></label>` : ""}
          <div class="pj-two"><label class="ow-f">Badge<input data-k="badge" value="${esc(it.badge || "")}" maxlength="16" placeholder="New"></label><label class="ow-f">Style<select data-k="style">${[["default", "Normal"], ["featured", "Featured"], ["outline", "Outline"]].map(([v, l]) => `<option value="${v}"${(it.style || "default") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>
          <div class="pj-two"><label class="ow-f">Attention<select data-k="anim">${[["none", "None"], ["pulse", "Pulse"], ["shine", "Shine"], ["wiggle", "Wiggle"], ["bounce", "Bounce"]].map(([v, l]) => `<option value="${v}"${(it.anim || "none") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label><label class="ow-f">Colour<select data-k="color">${["c1", "c2", "c3", "c4", "c5", "c6"].map((c) => `<option value="${c}"${(it.color || "c1") === c ? " selected" : ""}>${c.replace("c", "Tone ")}</option>`).join("")}</select></label></div>
          <div class="ow-f">Icon<div class="hbe-icons">${ICON_KEYS.map((k) => `<button class="${(it.icon || "") === k ? "on" : ""}" data-icon="${k}" aria-label="${k}" title="${k}">${glyph(k, 18)}</button>`).join("")}</div></div>
          <div class="ow-f">Picture instead of icon<div class="hbe-imgrow">${it.thumb ? `<img src="${esc(it.thumb)}" alt="">` : ""}<button class="rb-mini" data-pick="thumb">${it.thumb ? "Replace" : "Upload"}</button>${it.thumb ? '<button class="rb-mini" data-clearthumb>Remove</button>' : ""}</div></div>
          <div class="pj-two"><label class="ow-f">Show from<input type="datetime-local" data-k="start" data-ms="1" value="${dtVal(it.start)}"></label><label class="ow-f">Hide after<input type="datetime-local" data-k="end" data-ms="1" value="${dtVal(it.end)}"></label></div>
          ${it.type === "link" ? `<label class="ow-f">Short link <small>${esc(location.host)}/go/<b>${esc(it.slug || it.id)}</b> counts every click</small><input data-k="slug" value="${esc(it.slug || "")}" maxlength="40" placeholder="${esc(it.id)}"></label>` : ""}</details>` : ""}</div>` : ""}</div>`;
  }
  function drawLinks() {
    main.innerHTML = `<div class="hbe-add"><button class="btn" data-a="add">+ Add</button><span class="hint">Drag ⋮⋮ to reorder. Items outside their schedule are hidden from visitors automatically.</span></div><div class="hbe-types" hidden>${TYPES.map(([t, l, ic]) => `<button data-newtype="${t}">${glyph(ic, 22)}<span>${l}</span></button>`).join("")}</div>
      <div class="hbe-list">${B.hub.items.map(itemCard).join("") || '<p class="hint">Nothing here yet. Add your first link.</p>'}</div>`;
    wireCards();
  }
  function wireCards() {
    $("[data-a=add]", main)?.addEventListener("click", () => { const t = $(".hbe-types", main); t.hidden = !t.hidden; });
    $$("[data-newtype]", main).forEach((b) => (b.onclick = () => {
      const t = b.dataset.newtype, it = { id: rid(), type: t, title: { link: "New link", header: "New section", embed: "", app: "", email: "", phone: "", whatsapp: "", map: "My location", copy: "Copy", countdown: "Launch day", subscribe: "Stay in the loop", vcard: "Save my contact", image: "", text: "", divider: "" }[t] ?? "" };
      if (t === "link") it.url = "https://"; if (t === "app") it.app = "journal"; if (t === "countdown") it.date = Date.now() + 7 * 86400000; if (t === "subscribe") it.button = "Subscribe"; if (t === "embed") it.url = "";
      B.hub.items.unshift(it); B.open = it.id; drawLinks(); touch(); $(`.hbe-card[data-id="${it.id}"] input`, main)?.focus();
    }));
    $$(".hbe-card", main).forEach((c) => {
      const it = B.hub.items.find((x) => x.id === c.dataset.id), i = +c.dataset.i;
      c.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a;
        if (a === "toggle") { B.open = B.open === it.id ? null : it.id; drawLinks(); return; }
        if (a === "hide") { it.hidden = !it.hidden; if (!it.hidden) delete it.hidden; drawLinks(); touch(); return; }
        if (a === "del") { if (await confirmBox("Delete this item?")) { B.hub.items.splice(i, 1); drawLinks(); touch(); } return; }
        const ic = e.target.closest("[data-icon]"); if (ic) { it.icon = it.icon === ic.dataset.icon ? undefined : ic.dataset.icon; if (!it.icon) delete it.icon; drawLinks(); touch(); return; }
        const pk = e.target.closest("[data-pick]"); if (pk) { const f = (await Up.pick("image/*"))[0]; if (!f) return; try { const r = await Up.image(f, { max: 1200 }); it[pk.dataset.pick] = r.url; drawLinks(); touch(); } catch (x) { toast(x.message); } return; }
        if (e.target.closest("[data-clearthumb]")) { delete it.thumb; drawLinks(); touch(); }
      });
      $$("[data-k]", c).forEach((el) => {
        const ev = el.tagName === "SELECT" || el.type === "checkbox" || el.type === "datetime-local" ? "change" : "input";
        el.addEventListener(ev, () => {
          const k = el.dataset.k; let v = el.type === "checkbox" ? el.checked : el.value;
          if (el.dataset.ms) v = v ? new Date(v).getTime() : 0;
          if (v === "" || v === 0 || v === false) delete it[k]; else it[k] = v;
          if (k === "title") { const s = $(".hbe-sum b", c); if (s) s.textContent = v || ""; }
          touch();
        });
      });
      // drag to reorder: a line shows where it will land
      const grip = $(".hbe-grip", c);
      grip.addEventListener("pointerdown", (e) => {
        e.preventDefault(); const list = $(".hbe-list", main); let moved = false, drop = null; const y0 = e.clientY;
        const ind = h("div", { class: "hbe-drop" }); document.body.append(ind); grip.setPointerCapture(e.pointerId);
        const mv = (ev) => {
          if (Math.abs(ev.clientY - y0) > 5) { moved = true; c.classList.add("drag"); }
          if (!moved) return;
          const others = $$(".hbe-card", list).filter((x) => x !== c); drop = null;
          for (const o of others) { const r = o.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { drop = { o, before: true }; break; } }
          if (!drop && others.length) drop = { o: others[others.length - 1], before: false };
          if (drop) { const r = drop.o.getBoundingClientRect(); ind.style.cssText = `display:block;left:${r.left}px;width:${r.width}px;top:${(drop.before ? r.top : r.bottom) - 2}px`; }
        };
        const up = () => {
          grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up); ind.remove(); c.classList.remove("drag");
          if (moved && drop) { const items = B.hub.items; const from = items.indexOf(it); items.splice(from, 1); let to = items.findIndex((x) => x.id === drop.o.dataset.id); if (!drop.before) to++; items.splice(to, 0, it); drawLinks(); touch(); }
        };
        grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
      });
      grip.addEventListener("keydown", (e) => { if (e.key === "ArrowUp" && i > 0) { [B.hub.items[i - 1], B.hub.items[i]] = [B.hub.items[i], B.hub.items[i - 1]]; drawLinks(); touch(); $(`.hbe-card[data-id="${it.id}"] .hbe-grip`, main)?.focus(); } if (e.key === "ArrowDown" && i < B.hub.items.length - 1) { [B.hub.items[i + 1], B.hub.items[i]] = [B.hub.items[i], B.hub.items[i + 1]]; drawLinks(); touch(); $(`.hbe-card[data-id="${it.id}"] .hbe-grip`, main)?.focus(); } });
    });
  }
  /* --- tab: design --- */
  function drawDesign() {
    const t = B.hub.theme;
    main.innerHTML = `<h3>Theme</h3><div class="hbe-sws">${Object.keys(PRESETS).map(swatch).join("")}</div>
      <div class="pj-two">${sel("shape", "Buttons", [["round", "Rounded"], ["pill", "Pill"], ["square", "Square"]])}${sel("fill", "Button style", [["soft", "Soft"], ["solid", "Solid"], ["outline", "Outline"], ["glass", "Glass"], ["shadow", "Shadow"]])}</div>
      <div class="pj-two">${sel("layout", "Layout", [["list", "List"], ["grid", "Grid of tiles"]])}${sel("align", "Alignment", [["center", "Centred"], ["left", "Left"]])}</div>
      <div class="pj-two">${sel("font", "Font", [["sans", "Clean"], ["serif", "Serif"], ["mono", "Mono"], ["rounded", "Rounded"], ["display", "Bold"]])}${sel("pattern", "Pattern", [["none", "None"], ["dots", "Dots"], ["grid", "Grid"], ["waves", "Waves"], ["noise", "Grain"]])}</div>
      <h3>Custom colours</h3><div class="pj-two">${clr("accent", "Accent")}${clr("text", "Text")}</div><div class="pj-two">${clr("bg", "Background")}${clr("bg2", "Background 2 (gradient)")}</div>
      <h3>Background picture</h3><div class="hbe-imgrow">${t.bgImg ? `<img src="${esc(t.bgImg)}" alt="">` : ""}<button class="rb-mini" data-pickbg>${t.bgImg ? "Replace" : "Upload"}</button>${t.bgImg ? '<button class="rb-mini" data-rmbg>Remove</button>' : ""}</div>`;
    $$("[data-preset]", main).forEach((b) => (b.onclick = () => { t.preset = b.dataset.preset; for (const k of ["accent", "bg", "bg2", "text"]) delete t[k]; drawDesign(); touch(); }));
    $$("[data-th]", main).forEach((s) => (s.onchange = () => { t[s.dataset.th] = s.value; touch(); }));
    $$("[data-clr]", main).forEach((c) => (c.oninput = () => { t[c.dataset.clr] = c.value; touch(); }));
    $$("[data-clrx]", main).forEach((c) => (c.onclick = () => { delete t[c.dataset.clrx]; drawDesign(); touch(); }));
    $("[data-pickbg]", main).onclick = async () => { const f = (await Up.pick("image/*"))[0]; if (!f) return; try { const r = await Up.image(f, { max: 1600 }); t.bgImg = r.url; drawDesign(); touch(); } catch (e) { toast(e.message); } };
    $("[data-rmbg]", main)?.addEventListener("click", () => { delete t.bgImg; drawDesign(); touch(); });
  }
  /* --- tab: profile --- */
  function drawProfile() {
    const p = B.hub.profile, v = B.hub.vcard, s = B.hub.settings, soc = B.hub.socials;
    main.innerHTML = `<h3>Profile</h3><p class="hint">Leave a field empty to use what you wrote in About me and Settings.</p>
      <div class="hbe-imgrow"><img class="av" src="${esc(p.avatar || "/img/avatar.jpg")}" alt=""><button class="rb-mini" data-pickav>${p.avatar ? "Replace picture" : "Upload a picture"}</button>${p.avatar ? '<button class="rb-mini" data-rmav>Use default</button>' : ""}</div>
      <label class="ow-f">Name<input data-p="name" value="${esc(p.name || "")}" maxlength="60" placeholder="${esc(siteName())}"></label><label class="ow-f">Role<input data-p="role" value="${esc(p.role || "")}" maxlength="80" placeholder="${esc((typeof P !== "undefined" && P.role) || "")}"></label>
      <label class="ow-f">Status line<input data-p="status" value="${esc(p.status || "")}" maxlength="80" placeholder="${esc((typeof P !== "undefined" && P.status) || "Open to new projects")}"></label><label class="ow-f">Bio<textarea data-p="bio" rows="3" maxlength="400">${esc(p.bio || "")}</textarea></label>
      <h3>Social icons</h3><div class="pj-rows" data-socs>${soc.map((x, i) => `<div class="pj-row"><select data-s="type" data-i="${i}">${Object.entries(SOC).map(([k, [n]]) => `<option value="${k}"${x.type === k ? " selected" : ""}>${n}</option>`).join("")}</select><input data-s="url" data-i="${i}" value="${esc(x.url)}" placeholder="https://…" maxlength="300"><button class="rb-mini" data-su="${i}" aria-label="Move up">↑</button><button class="rb-mini rb-x" data-sx="${i}" aria-label="Remove">✕</button></div>`).join("")}</div><button class="rb-mini" data-addsoc>+ Add social icon</button>
      <h3>On the page</h3><label class="ow-app"><input type="checkbox" data-set="share" ${s.share !== false ? "checked" : ""}><span>Share button</span></label><label class="ow-app"><input type="checkbox" data-set="qr" ${s.qr !== false ? "checked" : ""}><span>QR code button</span></label><label class="ow-app"><input type="checkbox" data-set="vcard" ${s.vcard !== false ? "checked" : ""}><span>“Save contact” button (needs the contact card below)</span></label>
      <h3>Contact card <small>(what “Save contact” downloads)</small></h3><div class="pj-two"><label class="ow-f">Full name<input data-v="name" value="${esc(v.name || "")}" maxlength="80"></label><label class="ow-f">Company<input data-v="org" value="${esc(v.org || "")}" maxlength="80"></label></div><div class="pj-two"><label class="ow-f">Job title<input data-v="title" value="${esc(v.title || "")}" maxlength="80"></label><label class="ow-f">Phone<input data-v="phone" value="${esc(v.phone || "")}" maxlength="30" type="tel"></label></div><div class="pj-two"><label class="ow-f">Email<input data-v="email" value="${esc(v.email || "")}" maxlength="120" type="email"></label><label class="ow-f">Website<input data-v="url" value="${esc(v.url || "")}" maxlength="300" inputmode="url"></label></div>`;
    $$("[data-p]", main).forEach((el) => (el.oninput = () => { const k = el.dataset.p; if (el.value.trim()) p[k] = el.value; else delete p[k]; touch(); }));
    $$("[data-v]", main).forEach((el) => (el.oninput = () => { const k = el.dataset.v; if (el.value.trim()) v[k] = el.value; else delete v[k]; touch(false); }));
    $$("[data-set]", main).forEach((el) => (el.onchange = () => { s[el.dataset.set] = el.checked; touch(); }));
    $$("[data-s]", main).forEach((el) => { const f = () => { soc[+el.dataset.i][el.dataset.s] = el.value; touch(); }; el.addEventListener(el.tagName === "SELECT" ? "change" : "input", f); });
    $$("[data-sx]", main).forEach((b) => (b.onclick = () => { soc.splice(+b.dataset.sx, 1); drawProfile(); touch(); }));
    $$("[data-su]", main).forEach((b) => (b.onclick = () => { const i = +b.dataset.su; if (i > 0) { [soc[i - 1], soc[i]] = [soc[i], soc[i - 1]]; drawProfile(); touch(); } }));
    $("[data-addsoc]", main).onclick = () => { soc.push({ type: "instagram", url: "https://" }); drawProfile(); };
    $("[data-pickav]", main).onclick = async () => { const f = (await Up.pick("image/*"))[0]; if (!f) return; try { const r = await Up.image(f, { max: 600 }); p.avatar = r.url; drawProfile(); touch(); } catch (e) { toast(e.message); } };
    $("[data-rmav]", main)?.addEventListener("click", () => { delete p.avatar; drawProfile(); touch(); });
  }
  /* --- tab: statistics --- */
  async function drawStats() {
    main.innerHTML = '<div class="app-loading"><span class="rb-spin"></span></div>';
    const r = await api("/api/hub?a=stats"); const s = (H.stats = r.ok ? r.data.stats : null);
    if (!s) { main.innerHTML = '<p class="hint">Could not load statistics.</p>'; return; }
    const days = []; for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); days.push([d, s.days[d] || { v: 0, c: 0 }]); }
    const max = Math.max(1, ...days.map(([, x]) => Math.max(x.v, x.c))), bw = 100 / 30;
    const top = Object.entries(s.items).sort((a, b) => b[1] - a[1]).slice(0, 8), tm = Math.max(1, top[0]?.[1] || 1);
    const names = Object.fromEntries(B.hub.items.map((i) => [i.id, i.title || i.url || i.type]));
    const refs = Object.entries(s.refs).slice(0, 6);
    main.innerHTML = `<div class="hbe-kpis"><div><b>${fmtNum(s.views)}</b><small>Visits</small></div><div><b>${fmtNum(s.clicks)}</b><small>Clicks</small></div><div><b>${s.views ? Math.round((s.clicks / s.views) * 100) : 0}%</b><small>Click rate</small></div><div><b>${s.dev.m + s.dev.d ? Math.round((s.dev.m / (s.dev.m + s.dev.d)) * 100) : 0}%</b><small>On phones</small></div></div>
      <h3>Last 30 days</h3><svg class="hbe-chart" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Visits and clicks per day">${days.map(([d, x], i) => `<rect x="${i * bw + 0.3}" y="${40 - (x.v / max) * 38}" width="${bw - 0.6}" height="${(x.v / max) * 38}" fill="var(--c1)"><title>${d}: ${x.v} visits, ${x.c} clicks</title></rect><rect x="${i * bw + 0.3}" y="${40 - (x.c / max) * 38}" width="${bw - 0.6}" height="${(x.c / max) * 38}" fill="var(--primary)" opacity=".85"><title>${d}</title></rect>`).join("")}</svg><p class="hint"><span class="dot" style="background:var(--c1)"></span> visits &nbsp; <span class="dot" style="background:var(--primary)"></span> clicks</p>
      <h3>Top links</h3>${top.length ? top.map(([id, n]) => `<div class="hbe-bar"><span>${esc(names[id] || id)}</span><i style="width:${(n / tm) * 100}%"></i><b>${n}</b></div>`).join("") : '<p class="hint">No clicks yet.</p>'}
      <h3>Where visitors come from</h3>${refs.length ? refs.map(([h2, n]) => `<div class="hbe-bar"><span>${esc(h2)}</span><i style="width:${(n / refs[0][1]) * 100}%"></i><b>${n}</b></div>`).join("") : '<p class="hint">Direct visits, or no data yet.</p>'}
      <p><button class="rb-mini rb-x" data-resetstats>Reset statistics</button></p>`;
    $("[data-resetstats]", main).onclick = async () => { if (await confirmBox("Reset all statistics?")) { await api("/api/hub?a=stats", { method: "DELETE" }); drawStats(); } };
  }
  /* --- tab: subscribers --- */
  async function drawSubs() {
    main.innerHTML = '<div class="app-loading"><span class="rb-spin"></span></div>';
    const r = await api("/api/hub?a=subs"); const subs = r.ok ? r.data.subs : [];
    main.innerHTML = `<h3>Subscribers <small>${subs.length}</small></h3><p class="hint">People who typed their email into an “Email sign-up” block. Add one from the Links tab.</p>${subs.length ? `<div class="hbe-subs">${subs.slice().reverse().map((s) => `<div><span>${esc(s.email)}<small>${ago(s.ts)}</small></span><button class="rb-mini rb-x" data-rm="${esc(s.email)}" aria-label="Remove">✕</button></div>`).join("")}</div><p><button class="rb-mini" data-csv>Download CSV</button></p>` : '<p class="hint">No subscribers yet.</p>'}`;
    $$("[data-rm]", main).forEach((b) => (b.onclick = async () => { await api("/api/hub?a=sub&email=" + encodeURIComponent(b.dataset.rm), { method: "DELETE" }); drawSubs(); }));
    $("[data-csv]", main)?.addEventListener("click", () => { const csv = "email,name,date\n" + subs.map((s) => `${s.email},${(s.name || "").replace(/,/g, " ")},${new Date(s.ts).toISOString()}`).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "subscribers.csv"; a.click(); });
  }
  const drawTab = () => { $$(".hbe-tabs [data-tab]", body).forEach((b) => b.classList.toggle("on", b.dataset.tab === B.tab)); main.scrollTop = 0; ({ links: drawLinks, design: drawDesign, profile: drawProfile, stats: drawStats, subs: drawSubs })[B.tab](); };
  $$(".hbe-tabs [data-tab]", body).forEach((b) => (b.onclick = async () => { B.tab = b.dataset.tab; if (B.tab === "links" && !H.stats) { const r = await api("/api/hub?a=stats"); if (r.ok) H.stats = r.data.stats; } drawTab(); }));
  body.onclick = async (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "prev") { B.preview = !B.preview; $(".hbe-cols", body).classList.toggle("showpv", B.preview); $(".hbe-pvb", body).textContent = B.preview ? "Edit" : "Preview"; }
    if (e.target.closest(".back") && a === "done") { clearTimeout(B.saveT); if (B.status !== "Saved") await save(); body.onclick = null; body.classList.remove("jr-editing"); w.classList.toggle("max", wasMax); linksApp(body); }
  };
  api("/api/hub?a=stats").then((r) => { if (r.ok) { H.stats = r.data.stats; if (B.tab === "links") drawLinks(); } });
  drawTab(); renderHub(screen, B.hub, { preview: true });
}

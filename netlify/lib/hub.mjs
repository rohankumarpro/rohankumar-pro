// The Links hub: a link-in-bio page. Cleaning, defaults and the "what should visitors see right now" rules.
import { safeUrl, safeImg, rid, cleanInline, stripTags } from "../../shared/blocks.mjs";
import { BRAND_KEYS } from "../../shared/brands.mjs";

const str = (v, n) => String(v ?? "").trim().slice(0, n);
export const TYPES = ["link", "header", "text", "divider", "app", "embed", "email", "phone", "whatsapp", "copy", "countdown", "vcard", "subscribe", "image", "map"];
export const SOCIALS = [...BRAND_KEYS, "email", "website"];
export const PRESETS = ["mint", "midnight", "sunset", "paper", "lilac", "mono", "ocean", "neon"];
const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"];
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v).toLowerCase() : d);
const pick = (v, list, d) => (list.includes(v) ? v : d);
const ts = (v) => { const n = typeof v === "number" ? v : Date.parse(v); return Number.isFinite(n) && n > 0 ? n : 0; };

export function defaultHub(settings = {}) {
  const lp = Array.isArray(settings.linkpage) && settings.linkpage.length ? settings.linkpage : [
    { group: "Work with me", label: "Book a call", sub: "Free intro call on cal.com", url: "https://cal.com/rohankumarpro", icon: "cal", color: "c1", primary: true },
    { group: "Work with me", label: "Email", sub: "hello@yourname.com", url: "mailto:hello@yourname.com", icon: "mail", color: "c4" },
    { group: "Find me online", label: "LinkedIn", sub: "Articles and updates", url: "https://www.linkedin.com/in/rohankumarpro/", icon: "work", color: "c5" },
    { group: "Find me online", label: "Instagram", sub: "@rohankumarpro", url: "https://www.instagram.com/rohankumarpro/", icon: "cam", color: "c6" },
    { group: "Find me online", label: "Reddit", sub: "Design discussions", url: "https://www.reddit.com/user/rohankumarpro/", icon: "chat", color: "c2" },
    { group: "On this site", label: "Read my journal", sub: "Thoughts on branding, design, and AI", app: "journal", icon: "book", color: "c3" },
    { group: "On this site", label: "Sign the guestbook", sub: "Leave a note", app: "guestbook", icon: "pen", color: "c2" },
  ];
  const items = []; let grp = "";
  for (const l of lp) {
    if (l.group && l.group !== grp) { grp = l.group; items.push({ id: rid(), type: "header", title: grp }); }
    items.push({ id: rid(), type: l.app ? "app" : "link", title: l.label, sub: l.sub || "", url: l.app ? "" : l.url, app: l.app || "", icon: l.icon || "link", color: l.color || "c1", style: l.primary ? "featured" : "default", anim: l.primary ? "shine" : "none" });
  }
  return { v: 1, profile: {}, theme: { preset: "mint", shape: "round", fill: "soft", layout: "list", align: "center", font: "sans" }, socials: [
    { type: "instagram", url: "https://www.instagram.com/rohankumarpro/" }, { type: "youtube", url: "https://www.youtube.com/@rohankumarpro" },
    { type: "linkedin", url: "https://www.linkedin.com/in/rohankumarpro/" }, { type: "behance", url: "https://www.behance.net/rohankumarpro" }, { type: "figma", url: "https://www.figma.com/@rohankumarpro" },
  ], items, settings: { share: true, qr: true, vcard: true }, vcard: {} };
}

function cleanItem(i) {
  if (!i || !TYPES.includes(i.type)) return null;
  const o = { id: /^[\w-]{3,16}$/.test(i.id || "") ? i.id : rid(), type: i.type, title: str(i.title, 100) };
  if (i.sub) o.sub = str(i.sub, 160);
  if (["link", "app", "email", "phone", "whatsapp", "copy", "vcard", "subscribe", "countdown", "map"].includes(i.type)) {
    o.color = pick(i.color, COLORS, "c1"); if (i.icon) o.icon = str(i.icon, 24).replace(/[^\w-]/g, "");
    if (safeImg(i.thumb)) o.thumb = safeImg(i.thumb);
    if (i.badge) o.badge = str(i.badge, 16);
    o.style = pick(i.style, ["default", "featured", "outline"], "default"); o.anim = pick(i.anim, ["none", "pulse", "shine", "wiggle", "bounce"], "none");
    // How one link looks: a button, a card with a full picture, or just an icon in a grid. The icon is a brand logo, one of ours, or the owner's own picture.
    o.look = pick(i.look, ["button", "card", "icon"], "button");
    if (BRAND_KEYS.includes(i.brand)) o.brand = i.brand;
    if (safeImg(i.iconImg)) o.iconImg = safeImg(i.iconImg);
    if (safeImg(i.img)) o.img = safeImg(i.img);
  }
  if (i.type === "link") { o.url = safeUrl(i.url, { relative: false }); if (!o.url) return null; if (i.slug) o.slug = str(i.slug, 40).toLowerCase().replace(/[^a-z0-9-]/g, ""); }
  if (i.type === "app") { o.app = str(i.app, 30).replace(/[^\w-]/g, ""); if (!o.app) return null; }
  if (i.type === "email") { o.url = str(i.url || i.title, 120); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.url)) return null; }
  if (i.type === "phone" || i.type === "whatsapp") { o.url = str(i.url, 24).replace(/[^\d+]/g, ""); if (o.url.length < 6) return null; }
  if (i.type === "copy") { o.text = str(i.text, 300); if (!o.text) return null; }
  if (i.type === "text") { o.html = cleanInline(i.html, 1200); }
  if (i.type === "header") { if (i.collapsible) o.collapsible = true; if (i.collapsible && i.closed) o.closed = true; }
  if (i.type === "embed") { o.url = safeUrl(i.url, { relative: false }); if (!o.url) return null; }
  if (i.type === "map") { o.url = str(i.url, 200); if (!o.url) return null; }
  if (i.type === "countdown") { o.date = ts(i.date); if (!o.date) return null; o.link = safeUrl(i.link, { relative: false }); o.endText = str(i.endText, 60); }
  if (i.type === "image") { o.src = safeImg(i.src); if (!o.src) return null; o.alt = str(i.alt, 200); o.link = safeUrl(i.link, { relative: false }); }
  if (i.type === "subscribe") { o.button = str(i.button, 24) || "Subscribe"; }
  if (i.hidden) o.hidden = true;
  const a = ts(i.start), b = ts(i.end); if (a) o.start = a; if (b) o.end = b;
  return o;
}

export function cleanHub(h) {
  const t = h?.theme || {};
  const out = {
    v: 1,
    profile: { bio: str(h?.profile?.bio, 400), name: str(h?.profile?.name, 60), role: str(h?.profile?.role, 80), avatar: safeImg(h?.profile?.avatar), status: str(h?.profile?.status, 80) },
    theme: {
      preset: pick(t.preset, PRESETS, "mint"), shape: pick(t.shape, ["pill", "round", "square"], "round"), fill: pick(t.fill, ["solid", "soft", "outline", "glass", "shadow"], "soft"),
      layout: pick(t.layout, ["list", "grid"], "list"), align: pick(t.align, ["center", "left"], "center"), font: pick(t.font, ["sans", "serif", "mono", "rounded", "display"], "sans"),
      accent: t.accent ? hex(t.accent, "") : "", bg: t.bg ? hex(t.bg, "") : "", bg2: t.bg2 ? hex(t.bg2, "") : "", text: t.text ? hex(t.text, "") : "", bgImg: safeImg(t.bgImg),
      pattern: pick(t.pattern, ["none", "dots", "grid", "waves", "noise"], "none"),
    },
    socials: (Array.isArray(h?.socials) ? h.socials : []).slice(0, 14).map((s) => { const o = { type: pick(s?.type, SOCIALS, "website"), url: s?.type === "email" ? str(s.url, 120) : safeUrl(s?.url, { relative: false }) }; if (safeImg(s?.img)) o.img = safeImg(s.img); return o; }).filter((s) => s.url),
    items: (Array.isArray(h?.items) ? h.items : []).slice(0, 200).map(cleanItem).filter(Boolean),
    settings: { share: h?.settings?.share !== false, qr: h?.settings?.qr !== false, vcard: h?.settings?.vcard !== false },
    vcard: { name: str(h?.vcard?.name, 80), org: str(h?.vcard?.org, 80), title: str(h?.vcard?.title, 80), email: str(h?.vcard?.email, 120), phone: str(h?.vcard?.phone, 30), url: safeUrl(h?.vcard?.url, { relative: false }), note: str(h?.vcard?.note, 200) },
  };
  const seen = new Set(); out.items = out.items.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));
  return out;
}

// What a visitor sees right now: hidden items and items outside their schedule are left out.
export function visibleItems(hub, now = Date.now()) {
  return (hub.items || []).filter((i) => !i.hidden && (!i.start || i.start <= now) && (!i.end || i.end > now));
}
export function publicHub(hub, now = Date.now()) {
  return { ...hub, items: visibleItems(hub, now), vcard: hub.settings?.vcard ? { name: hub.vcard.name, org: hub.vcard.org, title: hub.vcard.title, url: hub.vcard.url } : {} };
}
export function hrefOf(i) {
  if (i.type === "email") return `mailto:${i.url}`;
  if (i.type === "phone") return `tel:${i.url}`;
  if (i.type === "whatsapp") return `https://wa.me/${i.url.replace(/\D/g, "")}`;
  if (i.type === "map") return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.url)}`;
  if (i.type === "countdown") return i.link || "";
  if (i.type === "image") return i.link || "";
  return i.url || "";
}
export function vcardText(v, siteUrl) {
  const e = (s) => String(s || "").replace(/[\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${e(v.name)}`, `N:${e((v.name || "").split(" ").slice(-1)[0])};${e((v.name || "").split(" ").slice(0, -1).join(" "))};;;`];
  if (v.org) lines.push(`ORG:${e(v.org)}`); if (v.title) lines.push(`TITLE:${e(v.title)}`); if (v.email) lines.push(`EMAIL;TYPE=INTERNET:${e(v.email)}`);
  if (v.phone) lines.push(`TEL;TYPE=CELL:${e(v.phone)}`); lines.push(`URL:${v.url || siteUrl}`); if (v.note) lines.push(`NOTE:${e(v.note)}`);
  lines.push("END:VCARD"); return lines.join("\r\n") + "\r\n";
}
export { stripTags };

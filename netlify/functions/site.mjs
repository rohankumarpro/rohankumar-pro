// /api/site  GET: anyone reads the public site settings.  PUT: only the signed-in owner saves them.
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";
import { saveJSON } from "../lib/safe.mjs";
import { cleanBlocks, cleanInline, safeUrl, safeImg } from "../../shared/blocks.mjs";
import { ICONS as ICON_SET } from "../../shared/icons.mjs";

// Apps that can never be hidden, so the owner can't lock themselves out.
const KEEP = ["settings", "notes"];
const str = (v, n) => String(v ?? "").trim().slice(0, n);

export function cleanSettings(s) {
  const o = {};
  for (const [k, n] of [["name", 60], ["role", 80], ["status", 80], ["now", 300], ["song", 80], ["artist", 80]]) {
    const v = str(s?.[k], n);
    if (v) o[k] = v;
  }
  const url = (v, ok) => { const u = str(v, 300); return ok.test(u) ? u : ""; };
  const WEB = /^https?:\/\//i, ANY = /^(https?:\/\/|mailto:|tel:)/i;
  const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"], ICONS = ["cal", "mail", "work", "cam", "chat", "book", "pen"];
  const bio = str(s?.bio, 1500); if (bio) o.bio = bio;
  const photo = safeImg(s?.photo); if (photo) o.photo = photo;
  const wallpaper = safeImg(s?.wallpaper); if (wallpaper) o.wallpaper = wallpaper;
  const img = (v) => { const x = safeImg(v); return x ? { img: x } : {}; };
  const email = str(s?.email, 120); if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) o.email = email;
  const booking = url(s?.booking, WEB); if (booking) o.booking = booking;
  if (Array.isArray(s?.skills)) o.skills = s.skills.map((x) => str(x, 40)).filter(Boolean).slice(0, 30);
  if (Array.isArray(s?.experience)) o.experience = s.experience.slice(0, 30).map((e) => ({ title: str(e?.title, 120), time: str(e?.time, 40), text: str(e?.text, 600), ...img(e?.img) })).filter((e) => e.title || e.time || e.text);
  if (Array.isArray(s?.links)) o.links = s.links.slice(0, 12).map((l) => ({ label: str(l?.label, 40), url: url(l?.url, ANY) })).filter((l) => l.label && l.url);
  if (Array.isArray(s?.linkpage)) o.linkpage = s.linkpage.slice(0, 40).map((l) => {
    const it = { group: str(l?.group, 40), label: str(l?.label, 60), color: COLORS.includes(l?.color) ? l.color : "c1", icon: ICONS.includes(l?.icon) ? l.icon : "work" };
    const sub = str(l?.sub, 100); if (sub) it.sub = sub;
    const app = str(l?.app, 30); if (/^[a-z0-9_-]+$/.test(app)) it.app = app; else it.url = url(l?.url, ANY);
    if (l?.primary) it.primary = true;
    return it;
  }).filter((it) => it.label && (it.app || it.url));
  if (Array.isArray(s?.projects)) o.projects = s.projects.slice(0, 60).map((p) => {
    const it = { title: str(p?.title, 120), cat: str(p?.cat, 40), year: str(p?.year, 20), color: COLORS.includes(p?.color) ? p.color : "c2", desc: str(p?.desc, 800) };
    const link = str(p?.link, 300); if (link === "#" || ANY.test(link)) it.link = link;
    if (p?.hidden) it.hidden = true;
    return it;
  }).filter((p) => p.title);
  if (Array.isArray(s?.timeline)) o.timeline = s.timeline.slice(0, 60).map((t) => {
    const it = { status: ["now", "next", "done"].includes(t?.status) ? t.status : "now", title: str(t?.title, 120), tag: str(t?.tag, 40), date: str(t?.date, 40) };
    const detail = str(t?.detail, 300); if (detail) it.detail = detail;
    Object.assign(it, img(t?.img));
    const p = Number(t?.progress); if (it.status === "now" && t?.progress !== "" && t?.progress != null && Number.isFinite(p)) it.progress = Math.max(0, Math.min(100, Math.round(p)));
    return it;
  }).filter((t) => t.title);
  const BRANDS = ["instagram", "youtube", "figma", "behance", "linkedin", "link"];
  if (Array.isArray(s?.qrs)) o.qrs = s.qrs.slice(0, 30).map((q) => {
    const it = { brand: BRANDS.includes(q?.brand) ? q.brand : "link", name: str(q?.name, 30), sub: str(q?.sub, 80), url: url(q?.url, WEB) };
    if (q?.hidden) it.hidden = true;
    return it;
  }).filter((q) => q.url);
  if (Array.isArray(s?.story)) o.story = cleanBlocks(s.story);
  if (Array.isArray(s?.services)) o.services = s.services.slice(0, 12).map((v) => ({ title: str(v?.title, 80), text: str(v?.text, 600), price: str(v?.price, 60), icon: ICON_SET[v?.icon] ? v.icon : "sparkles", ...img(v?.img), points: (Array.isArray(v?.points) ? v.points : String(v?.points || "").split(/\n|;/)).map((x) => str(x, 100)).filter(Boolean).slice(0, 8) })).filter((v) => v.title);
  if (Array.isArray(s?.faq)) o.faq = s.faq.slice(0, 20).map((v) => ({ q: str(v?.q, 160), a: str(v?.a, 800) })).filter((v) => v.q && v.a);
  if (Array.isArray(s?.process)) o.process = s.process.slice(0, 8).map((v) => ({ title: str(v?.title, 60), text: str(v?.text, 300), ...img(v?.img) })).filter((v) => v.title);
  if (Array.isArray(s?.testimonials)) o.testimonials = s.testimonials.slice(0, 20).map((v) => ({ name: str(v?.name, 60), role: str(v?.role, 80), text: str(v?.text, 500), avatar: safeImg(v?.avatar) || undefined })).filter((v) => v.name && v.text);
  if (s?.extra && typeof s.extra === "object") { const ex = {}; for (const k of ["services", "resume", "contact", "timeline"]) { const b = cleanBlocks(s.extra[k]); if (b.length) ex[k] = b; } if (Object.keys(ex).length) o.extra = ex; }
  const rf = safeUrl(s?.resumeFile); if (rf && /^\/u\/[a-f0-9]{10}\.pdf$/.test(rf)) o.resumeFile = rf;
  const tz = str(s?.tz, 40); if (/^[A-Za-z_]+\/[A-Za-z_\-+0-9\/]+$/.test(tz)) o.tz = tz;
  if (s?.music && Array.isArray(s.music.tracks)) { // the music corner: a few records the owner picked; anyone can play them
    const THUMB = /^https:\/\/(i\.ytimg\.com|i\.scdn\.co|mosaic\.scdn\.co|image-cdn-[\w-]+\.spotifycdn\.com)\//;
    const tracks = s.music.tracks.slice(0, 16).map((t) => {
      const k = t?.k === "s" ? "s" : "y", id = str(t?.id, 60);
      if (k === "y" && !/^[\w-]{10,60}$/.test(id)) return null; if (k === "s" && !/^[A-Za-z0-9]{22}$/.test(id)) return null;
      const it = { k, id, type: k === "s" ? (["track", "album", "playlist", "episode", "show"].includes(t?.type) ? t.type : "track") : (t?.type === "playlist" ? "playlist" : "video"), title: str(t?.title, 100), artist: str(t?.artist, 80) };
      const th = str(t?.thumb, 300); if (th && THUMB.test(th)) it.thumb = th; return it;
    }).filter(Boolean);
    o.music = { tracks };
  }
  if (Array.isArray(s?.videos)) o.videos = s.videos.slice(0, 120).map((v) => { // the YouTube app: videos the owner picked
    const id = str(v?.id, 11); if (!/^[\w-]{11}$/.test(id)) return null;
    const it = { id, title: str(v?.title, 140), author: str(v?.author, 80) }; const note = str(v?.note, 240); if (note) it.note = note; return it;
  }).filter(Boolean);
  if (Array.isArray(s?.resumeDoc)) o.resumeDoc = cleanBlocks(s.resumeDoc); // the owner's own resume page (a block document); its presence switches the page to it
  if (Array.isArray(s?.resumeDocBackup) && s.resumeDocBackup.length) o.resumeDocBackup = cleanBlocks(s.resumeDocBackup);
  if (s?.gbAuto === true) o.gbAuto = true; // guestbook notes publish without waiting for approval
  if (s?.place && typeof s.place === "object") { // where each app lives: on the desktop, or only in the app drawer
    const pl = {};
    for (const [k, v] of Object.entries(s.place).slice(0, 60)) if (/^[a-z0-9_-]{1,30}$/.test(k) && (v === "desktop" || v === "drawer")) pl[k] = v;
    if (Object.keys(pl).length) o.place = pl;
  }
  o.hiddenApps = (Array.isArray(s?.hiddenApps) ? s.hiddenApps : [])
    .map((x) => str(x, 30)).filter((x) => /^[a-z0-9_-]+$/.test(x) && !KEEP.includes(x)).slice(0, 40);
  return o;
}

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event);
    if (event.httpMethod === "GET") {
      const settings = await store.get("settings", { type: "json" });
      return json({ settings: settings ?? null });
    }
    if (event.httpMethod === "PUT") {
      if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      const settings = cleanSettings(b.settings);
      await saveJSON(store, "settings", settings);
      return json({ ok: true, settings });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};

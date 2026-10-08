// What the visitor bot (/api/ask) knows: the PUBLIC parts of the site and nothing else.
// Profile, services, FAQ, resume, links, the journal and the projects, built from the same loaders the public pages use.
// Never read here: notes, messages, guestbook, calendar, email, tasks, the vault, settings only the owner sees.
import { SITE, loadProfile, loadLivePosts, projectIndex, projectBySlug, loadHubPublic, isoDate } from "./site-data.mjs";
import { defaults } from "./defaults.mjs";
import { blocksOf } from "./posts.mjs";
import { blocksToMd } from "../../shared/blocks.mjs";

const clip = (s, n) => { const t = String(s ?? "").replace(/\s+\n/g, "\n").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const line = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const STOP = new Set("the and for you your are was what who how can does did has have with about from that this his him her its into have any tell show some more much very just like when where which would could should please hello there their they them than then also".split(" "));
const words = (t) => [...new Set(String(t || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];

let cache = { key: "", at: 0, base: "", posts: [], projects: [] };

// everything short enough to always be in front of the bot
async function build(store) {
  const pr = await loadProfile(store), s = pr.settings || {}, D = defaults();
  const posts = await loadLivePosts(store);
  const projects = (await projectIndex(store)).filter((m) => m.status === "published");
  const hub = await loadHubPublic(store).catch(() => null);
  const sv = (Array.isArray(s.services) && s.services.length ? s.services : D.SV_DEF.services) || [];
  const faq = (Array.isArray(s.faq) && s.faq.length ? s.faq : D.SV_DEF.faq) || [];
  const process = (Array.isArray(s.process) && s.process.length ? s.process : D.SV_DEF.process) || [];
  const L = [];
  L.push(`# About ${pr.name}`, `Name: ${pr.name}`, `Role: ${pr.role}`);
  if (pr.status) L.push(`Status: ${pr.status}`);
  if (pr.studio) L.push(`Studio: ${line(pr.studio)}`);
  if (pr.bio) L.push(`Bio: ${line(pr.bio)}`);
  if (pr.now) L.push(`Right now: ${line(pr.now)}`);
  if (pr.email) L.push(`Email: ${pr.email}`);
  L.push(`Book a call: ${pr.booking || "https://cal.com/rohankumarpro"}`, `Send a message: ${SITE}/contact`);
  if (pr.skills?.length) L.push(`Skills: ${pr.skills.join(", ")}`);
  if (pr.story?.length) L.push("", "## His story", clip(blocksToMd(pr.story), 3000));
  if (Array.isArray(s.resumeDoc) && s.resumeDoc.length) L.push("", "## Resume", clip(blocksToMd(s.resumeDoc), 3500));
  else if (pr.experience?.length) L.push("", "## Experience", ...pr.experience.slice(0, 12).map((e) => `- ${line(e.title)}${e.time ? " (" + line(e.time) + ")" : ""}${e.text ? ": " + line(clip(e.text, 300)) : ""}`));
  if (pr.timeline?.length) L.push("", "## Timeline", ...pr.timeline.slice(0, 20).map((t) => `- ${line(t.title)}${t.date ? " (" + line(t.date) + ")" : ""}${t.status ? " [" + t.status + "]" : ""}${t.detail ? ": " + line(clip(t.detail, 200)) : ""}`));
  if (sv.length) L.push("", "## Services", ...sv.slice(0, 12).map((v) => `- ${line(v.title)}${v.price ? " (" + line(v.price) + ")" : ""}: ${line(clip(v.text, 400))}${v.points?.length ? " Includes: " + v.points.map(line).join("; ") : ""}`));
  if (process.length) L.push("", "## How he works", ...process.slice(0, 8).map((p, i) => `${i + 1}. ${line(p.title)}: ${line(clip(p.text, 250))}`));
  if (faq.length) L.push("", "## FAQ", ...faq.slice(0, 20).map((f) => `Q: ${line(f.q)}\nA: ${line(clip(f.a, 500))}`));
  if (Array.isArray(s.testimonials) && s.testimonials.length) L.push("", "## What clients say", ...s.testimonials.slice(0, 8).map((t) => `- ${line(t.name)}${t.role ? ", " + line(t.role) : ""}: "${line(clip(t.text, 280))}"`));
  const links = [...(pr.links || []).map((l) => [l.label, l.url]), ...((hub?.items || []).filter((i) => ["link", "email", "phone", "whatsapp"].includes(i.type) && i.url).map((i) => [i.title, i.type === "email" ? "mailto:" + i.url : i.url]))];
  const seen = new Set(), uniq = links.filter(([a, u]) => a && u && !seen.has(u) && seen.add(u)).slice(0, 25);
  if (uniq.length) L.push("", "## Links", ...uniq.map(([a, u]) => `- ${line(a)}: ${u}`));
  L.push("", "## Pages on this site", `- Journal: ${SITE}/journal`, `- Projects: ${SITE}/projects`, `- About: ${SITE}/about`, `- Resume: ${SITE}/resume`, `- Contact: ${SITE}/contact`, `- Links: ${SITE}/links`);
  L.push("", "## Journal articles (newest first)", ...posts.slice(0, 60).map((p) => `- ${line(p.title)} (${isoDate(p) || p.date || ""}) /journal/${p.slug}: ${line(clip(p.excerpt, 220))}`));
  L.push("", "## Projects", ...projects.slice(0, 60).map((p) => `- ${line(p.title)}${p.year ? " (" + p.year + ")" : ""} /projects/${p.slug}: ${line(clip(p.summary, 220))}${p.client ? " Client: " + line(p.client) + "." : ""}${p.role ? " Role: " + line(p.role) + "." : ""}${p.tools?.length ? " Tools: " + p.tools.join(", ") + "." : ""}`));
  return { base: L.join("\n"), posts, projects, name: pr.name };
}

export async function knowledge(store, key, question) {
  if (cache.key !== key || Date.now() - cache.at > 5 * 60e3 || !cache.base) { const k = await build(store); cache = { key, at: Date.now(), ...k }; }
  // the articles and projects that best match the question, in full, so he can answer from what is really written
  const q = words(question), extra = [];
  if (q.length) {
    const score = (title, small, big) => { const T = words(title), S = words(small), B = String(big || "").toLowerCase(); let n = 0; for (const w of q) { if (T.includes(w)) n += 4; if (S.includes(w)) n += 2; if (B.includes(w)) n += 1; } return n; };
    const ps = cache.posts.map((p) => ({ p, n: score(p.title, `${p.excerpt} ${(p.tags || []).join(" ")} ${p.tag || ""}`, p.body) })).filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, 2);
    for (const { p } of ps) extra.push(`### Article: ${p.title}\nURL: /journal/${p.slug}\nPublished: ${isoDate(p) || p.date || ""}\n\n${clip(blocksToMd(blocksOf(p)), 6000)}`);
    const pj = cache.projects.map((m) => ({ m, n: score(m.title, `${m.summary} ${m.field} ${(m.tags || []).join(" ")} ${(m.tools || []).join(" ")} ${m.client}`, "") })).filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, 2);
    for (const { m } of pj) { const p = await projectBySlug(store, m.slug).catch(() => null); if (p) extra.push(`### Project: ${p.title}\nURL: /projects/${p.slug}\n${p.summary || ""}\n\n${clip(blocksToMd(p.blocks || []), 4000)}`); }
  }
  return { base: cache.base, extra: extra.join("\n\n"), name: cache.name };
}

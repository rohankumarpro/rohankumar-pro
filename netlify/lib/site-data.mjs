import { gbAll } from "./safe.mjs";
// Loads what the public pages are made of: profile text, articles, projects, links, photos, notes, guestbook.
import { defaults } from "./defaults.mjs";
import { loadPosts, isLive, isoDate, blocksOf } from "./posts.mjs";
import { loadIndex, seedProjects, metaOf, publicList, loadProject } from "./projects.mjs";
import { defaultHub, publicHub } from "./hub.mjs";
import { cleanBlocks } from "../../shared/blocks.mjs";

export const SITE = "https://rohankumar.pro";
export const PLACEHOLDER = /This is a short intro|Role title|Degree — University|yourname\.com|Project one|Photo caption/;
const arr = (v, d) => (Array.isArray(v) ? v : d || []);

export async function loadProfile(store) {
  const s = (await store.get("settings", { type: "json" })) ?? {};
  const { P: D, TIMELINE } = defaults();
  const p = {
    name: s.name || D.name, role: s.role || D.role, status: s.status || D.status,
    bio: (s.bio && !PLACEHOLDER.test(s.bio) && s.bio) || D.bio, now: (s.now && !/Tell visitors what you/.test(s.now) && s.now) || D.now, email: s.email || D.email, booking: s.booking || D.booking, studio: D.studio,
    skills: arr(s.skills, D.skills), experience: arr(s.experience, D.experience), links: arr(s.links, D.links),
    timeline: arr(s.timeline, TIMELINE), story: cleanBlocks(s.story), settings: s,
    music: { song: s.song || D.music?.song, artist: s.artist || D.music?.artist },
  };
  p.placeholder = PLACEHOLDER.test([p.bio, ...p.experience.map((e) => e.title)].join(" ")); // a template email alone is just left out, not a reason to hide pages
  p.email = /yourname\.com/.test(p.email || "") ? "" : p.email;
  return p;
}
export async function loadLivePosts(store) {
  const posts = (await loadPosts(store)).filter((p) => isLive(p));
  const key = (p) => isoDate(p) || "0000";
  return posts.slice().sort((a, b) => (key(b) < key(a) ? -1 : key(b) > key(a) ? 1 : 0));
}
export async function projectIndex(store) {
  const idx = await loadIndex(store);
  return idx || seedProjects((await store.get("settings", { type: "json" })) ?? {}).map(metaOf);
}
export async function projectBySlug(store, slug) {
  const idx = await loadIndex(store);
  if (!idx) { const s = seedProjects((await store.get("settings", { type: "json" })) ?? {}); return s.find((p) => p.slug === slug) || null; }
  const meta = idx.find((m) => m.slug === slug); return meta ? loadProject(store, meta.id) : null;
}
export async function loadHubPublic(store) {
  const saved = await store.get("hub", { type: "json" });
  return publicHub(saved || defaultHub((await store.get("settings", { type: "json" })) ?? {}));
}
export const loadPhotos = async (store) => arr(await store.get("photos", { type: "json" }));
export const loadNotes = async (store) => arr(await store.get("notes", { type: "json" })).filter((n) => !n.private && !n.archived && !n.trashed);
export async function loadGuestbook(store) { return arr(await gbAll(store)).filter((e) => e.status === "approved").sort((a, b) => b.ts - a.ts); }
export { blocksOf, isoDate };


// /llms.txt and /llms-full.txt  A plain-text map of the site for AI assistants and answer engines (llmstxt.org).
import { connectLambda } from "@netlify/blobs";
import { contentStore } from "../lib/store.mjs";
import { SITE, loadProfile, loadLivePosts, projectIndex, projectBySlug, isoDate } from "../lib/site-data.mjs";
import { blocksOf } from "../lib/posts.mjs";
import { blocksToMd } from "../../shared/blocks.mjs";

export const handler = async (event) => {
  connectLambda(event);
  const store = contentStore(event), pr = await loadProfile(store);
  const posts = await loadLivePosts(store), projects = (await projectIndex(store)).filter((m) => m.status === "published");
  const full = /llms-full/.test(event.path || event.rawUrl || "");
  const L = [`# ${pr.name}`, "", `> ${pr.name} is a ${pr.role}. ${pr.bio}`, "",
    `This site is an interactive desktop. Every window has its own address, and every page below is also available as Markdown by adding .md to its address.`, "",
    "## Main pages", "", `- [About](${SITE}/about): who ${pr.name} is and what they work with`, `- [Resume](${SITE}/resume): experience, education, skills`, `- [Projects](${SITE}/projects): selected work`, `- [Journal](${SITE}/journal): articles on branding, design and AI`, `- [Links](${SITE}/links): every place to find ${pr.name} online`, `- [Contact](${SITE}/contact): book a call or get in touch`, "",
    "## Journal", "", ...posts.map((p) => `- [${p.title}](${SITE}/journal/${p.slug}.md): ${p.excerpt}${isoDate(p) ? ` (${isoDate(p)})` : ""}`), "",
    "## Projects", "", ...projects.map((p) => `- [${p.title}](${SITE}/projects/${p.slug}.md): ${p.summary}`), "",
    "## Optional", "", `- [RSS feed](${SITE}/feed.xml)`, `- [Sitemap](${SITE}/sitemap.xml)`, ""];
  if (full) {
    L.push("---", "", "# Full text", "");
    for (const p of posts) L.push(`## ${p.title}`, "", `URL: ${SITE}/journal/${p.slug}`, `Published: ${isoDate(p) || p.date || ""}`, "", blocksToMd(blocksOf(p)), "");
    for (const m of projects) { const p = await projectBySlug(store, m.slug); if (p) L.push(`## ${p.title}`, "", `URL: ${SITE}/projects/${p.slug}`, "", p.summary || "", "", blocksToMd(p.blocks), ""); }
  }
  return { statusCode: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate", "netlify-cdn-cache-control": "public, s-maxage=600, stale-while-revalidate=86400" }, body: L.join("\n") };
};

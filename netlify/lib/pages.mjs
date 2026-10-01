// Every public address of the site (/about, /projects/<slug>, /journal/<slug> ...) described as data:
// what the page is called, how it reads in search results, the text a crawler should see, and which window the desktop opens.
import { esc, renderBlocks, blocksText, stripTags, slugify, firstImage, readMinutes, wordCount, blocksToMd } from "../../shared/blocks.mjs";
import { SITE, loadProfile, loadLivePosts, projectIndex, projectBySlug, loadHubPublic, loadPhotos, loadNotes, loadGuestbook, blocksOf, isoDate, docsPublic, docBySlug } from "./site-data.mjs";
import { hrefOf } from "./hub.mjs";
import { CAROUSELS } from "./media.mjs";

export const NAME = "Rohan Kumar";
const OG_DEFAULT = "/img/og.png";
export const abs = (u) => (!u ? "" : /^https?:/i.test(u) ? u : SITE + (u.startsWith("/") ? u : "/" + u));
export const trim = (s, n = 155) => { const t = stripTags(String(s || "")); if (t.length <= n) return t; const c = t.slice(0, n - 1); return c.slice(0, c.lastIndexOf(" ") > 80 ? c.lastIndexOf(" ") : n - 1).replace(/[,.;:\s]+$/, "") + "…"; };

// App id -> its address. Windows that are only tools or private are kept out of search results.
export const APP_PAGES = {
  about: { path: "/about", title: "About", index: true }, projects: { path: "/projects", title: "Projects", index: true }, journal: { path: "/journal", title: "Journal", index: true },
  links: { path: "/links", title: "Links", index: true }, resume: { path: "/resume", title: "Resume", index: true }, contact: { path: "/contact", title: "Contact", index: true },
  timeline: { path: "/timeline", title: "Timeline", index: true }, photos: { path: "/photos", title: "Photos", index: true }, notes: { path: "/notes", title: "Notes", index: true },
  guestbook: { path: "/guestbook", title: "Guestbook", index: true }, content: { path: "/content", title: "Content", index: true },
  services: { path: "/services", title: "Services", index: true }, book: { path: "/book", title: "Book a call", index: true },
  messages: { path: "/messages", title: "Messages", index: false }, documents: { path: "/wallet", title: "Wallet", index: false }, docs: { path: "/docs", title: "Docs", index: true }, settings: { path: "/settings", title: "Settings", index: false },
  calculator: { path: "/calculator", title: "Calculator", index: false }, palette: { path: "/palette", title: "Palette", index: false }, sketch: { path: "/sketch", title: "Sketch", index: false },
  focus: { path: "/focus", title: "Focus timer", index: false }, search: { path: "/search", title: "Search", index: false },
};
const BY_PATH = Object.fromEntries(Object.entries(APP_PAGES).map(([id, v]) => [v.path, id]));
const tagSlug = (t) => slugify(t);
const dateLabel = (p) => p.date || "";
const person = (pr, hub) => ({
  "@type": "Person", "@id": `${SITE}/#person`, name: pr.name, jobTitle: pr.role, url: `${SITE}/`, image: abs("/img/avatar.jpg"),
  ...(pr.skills.length ? { knowsAbout: pr.skills } : {}), ...(pr.email ? { email: pr.email } : {}), ...(pr.studio ? { worksFor: { "@type": "Organization", name: pr.studio } } : {}),
  sameAs: [...new Set([...(hub?.socials || []).map((s) => s.url).filter((u) => /^https?:/.test(u)), ...pr.links.map((l) => l.url).filter((u) => /^https?:/.test(u))])],
});
const crumbs = (list) => ({ "@type": "BreadcrumbList", itemListElement: list.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.path) })) });
const itemList = (items) => ({ "@type": "ItemList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: abs(it.path), name: it.name })) });
const nav = (hidden) => `<nav aria-label="Main"><ul>${["about", "projects", "journal", "links", "resume", "contact"].filter((id) => !hidden.has(id)).map((id) => `<li><a href="${APP_PAGES[id].path}">${APP_PAGES[id].title}</a></li>`).join("")}</ul></nav>`;
const postLi = (p) => `<li><a href="/journal/${esc(p.slug)}">${esc(p.title)}</a> <small>${esc(dateLabel(p))}${p.tag ? ` · ${esc(p.tag)}` : ""}</small><p>${esc(trim(p.excerpt, 200))}</p></li>`;
const projLi = (p) => `<li><a href="/projects/${esc(p.slug)}">${esc(p.title)}</a>${p.field ? ` <small>${esc(p.field)}${p.year ? ` · ${esc(p.year)}` : ""}</small>` : ""}<p>${esc(trim(p.summary, 200))}</p></li>`;

export async function resolve(event, store, rawPath) {
  const path0 = ("/" + String(rawPath || "/").replace(/^\/+/, "")).replace(/\/+$/, "") || "/";
  const wantMd = /\.md$/.test(path0);
  const path = path0 === "/index.md" ? "/" : path0.replace(/\.md$/, "") || "/";
  const pr = await loadProfile(store);
  const hidden = new Set(pr.settings.hiddenApps || []);
  const hub = await loadHubPublic(store);
  const P = { person: person(pr, hub), status: 200, path, md: wantMd, app: "", slug: "", noindex: false, type: "website", ld: [], modified: undefined, image: OG_DEFAULT, imageAlt: "" };
  const finish = (o) => Object.assign(P, o);
  const base = (title, desc) => ({ title, desc: trim(desc) });
  const home = { name: "Home", path: "/" };

  if (path === "/") {
    const posts = (await loadLivePosts(store)).slice(0, 5), projects = (await projectIndex(store)).filter((m) => m.status === "published").slice(0, 6);
    return finish({
      ...base(`${pr.name} — ${pr.role}`, pr.bio), app: "", title: `${pr.name} — ${pr.role}`,
      ld: [{ "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: pr.name, inLanguage: "en", publisher: { "@id": `${SITE}/#person` } }, person(pr, hub)],
      body: `<header><h1>${esc(pr.name)} — ${esc(pr.role)}</h1><p>${esc(pr.bio)}</p>${pr.status ? `<p>${esc(pr.status)}.</p>` : ""}</header>${nav(hidden)}
<section><h2>Latest from the journal</h2><ul>${posts.map(postLi).join("")}</ul><p><a href="/journal">All articles</a></p></section>
<section><h2>Selected projects</h2><ul>${projects.map(projLi).join("")}</ul><p><a href="/projects">All projects</a></p></section>
<section><h2>Work with me</h2><p>${pr.booking ? `<a href="${esc(pr.booking)}">Book a call</a>` : ""}${pr.email ? ` · <a href="mailto:${esc(pr.email)}">${esc(pr.email)}</a>` : ""}</p></section>`,
      mdText: `# ${pr.name} — ${pr.role}\n\n${pr.bio}\n`,
    });
  }

  if (path === "/about" || path === "/resume" || path === "/contact") {
    const id = path.slice(1), ap = APP_PAGES[id];
    const story = pr.story.length ? renderBlocks(pr.story, { hBase: 3 }) : "";
    const exp = pr.experience.map((e) => `<div><h3>${esc(e.title)}</h3><p><small>${esc(e.time)}</small></p><p>${esc(e.text)}</p></div>`).join("");
    const links = pr.links.filter((l) => /^https?:/.test(l.url)).map((l) => `<li><a href="${esc(l.url)}" rel="me noopener">${esc(l.label)}</a></li>`).join("");
    let title, desc, body, mdText;
    if (id === "about") {
      title = `About ${pr.name} — ${pr.role}`; desc = pr.bio;
      body = `<h1>About ${esc(pr.name)}</h1><p>${esc(pr.role)}${pr.status ? ` · ${esc(pr.status)}` : ""}</p><p>${esc(pr.bio)}</p>${story}${pr.now ? `<h2>Right now</h2><p>${esc(pr.now)}</p>` : ""}
${pr.skills.length ? `<h2>What I work with</h2><ul>${pr.skills.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}<h2>Elsewhere</h2><ul>${links}</ul>`;
      mdText = `# About ${pr.name}\n\n${pr.role}\n\n${pr.bio}\n\n${blocksToMd(pr.story)}\n\n## Skills\n\n${pr.skills.map((s) => `- ${s}`).join("\n")}\n`;
    } else if (id === "resume") {
      title = `Resume — ${pr.name}`; desc = `${pr.name}, ${pr.role}. Experience, education and skills.`;
      body = `<h1>Resume — ${esc(pr.name)}</h1><p>${esc(pr.role)}</p><h2>Experience and education</h2>${exp}${pr.skills.length ? `<h2>Skills</h2><ul>${pr.skills.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}`;
      mdText = `# Resume — ${pr.name}\n\n${pr.role}\n\n${pr.experience.map((e) => `## ${e.title}\n\n${e.time}\n\n${e.text}`).join("\n\n")}\n`;
    } else {
      title = `Contact ${pr.name}`; desc = `Get in touch with ${pr.name}: book a call${pr.email ? " or send an email" : ""}.`;
      body = `<h1>Contact ${esc(pr.name)}</h1><p>${pr.booking ? `<a href="${esc(pr.booking)}">Book a call</a>` : ""}${pr.email ? ` · <a href="mailto:${esc(pr.email)}">${esc(pr.email)}</a>` : ""}</p><ul>${links}</ul>`;
      mdText = `# Contact ${pr.name}\n\n${pr.booking ? `Book a call: ${pr.booking}\n` : ""}${pr.email ? `Email: ${pr.email}\n` : ""}`;
    }
    return finish({ title, desc: trim(desc), app: id, noindex: pr.placeholder || hidden.has(id), type: id === "about" ? "profile" : "website", body, mdText,
      ld: [{ "@type": id === "about" ? "ProfilePage" : "WebPage", "@id": `${SITE}${path}#page`, url: `${SITE}${path}`, name: title, description: trim(desc), mainEntity: person(pr, hub), isPartOf: { "@id": `${SITE}/#website` } }, crumbs([home, { name: ap.title, path }])] });
  }

  if (path === "/links") {
    const items = (hub.items || []).filter((i) => !["divider", "text", "subscribe", "vcard", "copy", "countdown"].includes(i.type) || i.type === "header");
    const lis = items.map((i) => {
      if (i.type === "header") return `</ul><h2>${esc(i.title)}</h2><ul>`;
      const h = i.type === "app" ? `/${i.app}` : hrefOf(i);
      return h ? `<li><a href="${esc(h)}"${/^https?:/.test(h) && !h.includes("rohankumar.pro") ? ' rel="noopener"' : ""}>${esc(i.title)}</a>${i.sub ? ` — ${esc(i.sub)}` : ""}</li>` : "";
    }).join("");
    const title = `${pr.name} — Links`, desc = `All the links for ${pr.name}, ${pr.role}: work, socials, writing and ways to get in touch.`;
    return finish({ title, desc, app: "links", noindex: hidden.has("links"), type: "profile",
      body: `<h1>${esc(pr.name)} — Links</h1><p>${esc(hub.profile?.bio || pr.bio)}</p><ul>${(hub.socials || []).map((s) => `<li><a href="${esc(s.url)}" rel="me noopener">${esc(s.type)}</a></li>`).join("")}</ul><ul>${lis}</ul>`.replace("<ul></ul>", ""),
      mdText: `# ${pr.name} — Links\n\n${items.map((i) => (i.type === "header" ? `\n## ${i.title}\n` : `- [${i.title}](${i.type === "app" ? abs("/" + i.app) : hrefOf(i)})`)).join("\n")}\n`,
      ld: [{ "@type": "ProfilePage", url: `${SITE}/links`, name: title, description: desc, mainEntity: person(pr, hub) }, crumbs([home, { name: "Links", path }])] });
  }

  if (path === "/timeline") {
    const t = pr.timeline;
    const sec = (k, h) => { const l = t.filter((x) => x.status === k); return l.length ? `<h2>${h}</h2><ul>${l.map((x) => `<li><b>${esc(x.title)}</b>${x.date ? ` <small>${esc(x.date)}</small>` : ""}${x.detail ? `<p>${esc(x.detail)}</p>` : ""}</li>`).join("")}</ul>` : ""; };
    return finish({ title: `Timeline — ${pr.name}`, desc: `What ${pr.name} is working on now, what is next, and what is done.`, app: "timeline", noindex: pr.placeholder || hidden.has("timeline"),
      body: `<h1>Timeline</h1>${sec("now", "Working on now")}${sec("next", "Up next")}${sec("done", "Done")}`, mdText: `# Timeline\n\n${t.map((x) => `- [${x.status}] ${x.title}`).join("\n")}\n`,
      ld: [crumbs([home, { name: "Timeline", path }])] });
  }

  if (path === "/photos") {
    const ph = await loadPhotos(store);
    return finish({ title: `Photos — ${pr.name}`, desc: `A gallery of photos by ${pr.name}.`, app: "photos", noindex: !ph.length || hidden.has("photos"),
      body: `<h1>Photos</h1><ul>${ph.map((p) => `<li><img src="/api/photo?id=${esc(p.id)}&amp;s=t" alt="${esc(p.caption || "Photo by " + pr.name)}" loading="lazy">${p.caption ? `<p>${esc(p.caption)}</p>` : ""}</li>`).join("")}</ul>`,
      image: ph[0] ? `/api/photo?id=${ph[0].id}&s=f` : OG_DEFAULT, ld: [{ "@type": "ImageGallery", name: `Photos — ${pr.name}`, url: `${SITE}/photos` }, crumbs([home, { name: "Photos", path }])] });
  }

  if (path === "/docs") {
    const ds = await docsPublic(store);
    return finish({ title: `Docs — ${pr.name}`, desc: `Guides, notes and write-ups by ${pr.name}.`, app: "docs", noindex: !ds.length || hidden.has("docs"),
      body: `<h1>Docs</h1><ul>${ds.map((d) => `<li><a href="/docs/${esc(d.slug)}">${d.icon ? esc(d.icon) + " " : ""}${esc(d.title || "Untitled")}</a>${d.desc ? `<p>${esc(d.desc)}</p>` : ""}</li>`).join("")}</ul>`,
      mdText: `# Docs\n\n${ds.map((d) => `- [${d.title || "Untitled"}](${SITE}/docs/${d.slug}.md)`).join("\n")}\n`, ld: [crumbs([home, { name: "Docs", path }])] });
  }
  if (path.startsWith("/docs/")) {
    const d = await docBySlug(store, path.slice(6));
    if (!d || hidden.has("docs")) return finish({ status: 404, title: `Page not found — ${pr.name}`, desc: "This page could not be found.", app: "docs", noindex: true, notFound: true, body: `<h1>Page not found</h1><p><a href="/docs">Back to Docs</a></p>` });
    const plain = trim(d.desc || blocksText(d.blocks), 160), img = d.cover?.src || firstImage(d.blocks) || OG_DEFAULT, iso = new Date(d.created || Date.now()).toISOString().slice(0, 10), mod = new Date(d.updated || Date.now()).toISOString();
    return finish({ title: `${d.title || "Untitled"} — ${pr.name}`, desc: plain, app: "docs", slug: d.slug, type: "article", image: img, noindex: !!d.noindex, published: iso, modified: mod,
      body: `<article><nav aria-label="Breadcrumb"><a href="/docs">Docs</a></nav><h1>${d.icon ? esc(d.icon) + " " : ""}${esc(d.title || "Untitled")}</h1>${renderBlocks(d.blocks, { hBase: 2 })}</article>`,
      mdText: `# ${d.title || "Untitled"}\n\n${blocksToMd(d.blocks)}\n`,
      ld: [{ "@type": "Article", "@id": `${SITE}/docs/${d.slug}#doc`, headline: (d.title || "Untitled").slice(0, 110), description: plain, url: `${SITE}/docs/${d.slug}`, image: [abs(img)], datePublished: iso, dateModified: mod.slice(0, 10), author: { "@id": `${SITE}/#person` }, publisher: { "@id": `${SITE}/#person` }, inLanguage: "en", wordCount: wordCount(d.blocks) }, crumbs([home, { name: "Docs", path: "/docs" }, { name: d.title || "Untitled", path }])] });
  }

  if (path === "/guestbook") {
    const g = await loadGuestbook(store);
    return finish({ title: `Guestbook — ${pr.name}`, desc: `Notes left by visitors on ${pr.name}'s site.`, app: "guestbook", noindex: hidden.has("guestbook") || !g.length,
      body: `<h1>Guestbook</h1><ul>${g.slice(0, 50).map((e) => `<li><b>${esc(e.name)}</b>: ${esc(e.msg)}</li>`).join("")}</ul>`, ld: [crumbs([home, { name: "Guestbook", path }])] });
  }

  if (path === "/notes" || path.startsWith("/notes/")) {
    const all = await loadNotes(store);
    const bodyOf = (x) => (x.blocks?.length ? renderBlocks(x.blocks, { hBase: 3 }) : x.items?.length ? `<ul>${x.items.map((i) => `<li>${i.d ? "<s>" : ""}${esc(i.t)}${i.d ? "</s>" : ""}</li>`).join("")}</ul>` : `<p>${esc(x.text).replace(/\n/g, "<br>")}</p>`) + (x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : "");
    const textOf = (x) => x.blocks?.length ? blocksText(x.blocks) : x.items?.length ? x.items.map((i) => i.t).join(". ") : x.text;
    if (path === "/notes") {
      return finish({ title: `Notes — ${pr.name}`, desc: `Short notes and thoughts from ${pr.name}.`, app: "notes", noindex: hidden.has("notes") || pr.placeholder || !all.length,
        body: `<h1>Notes</h1>${all.map((x) => `<article><h2><a href="/notes/${esc(x.id)}">${esc(x.title || "Untitled")}</a></h2>${bodyOf(x)}</article>`).join("")}`,
        mdText: `# Notes\n\n${all.map((x) => `## ${x.title || "Untitled"}\n\n${textOf(x)}`).join("\n\n")}\n`, ld: [crumbs([home, { name: "Notes", path }])] });
    }
    const x = all.find((n) => n.id === path.slice(7));
    if (!x || hidden.has("notes")) return finish({ status: 404, title: `Page not found — ${pr.name}`, desc: "This page could not be found.", app: "notes", noindex: true, notFound: true, body: `<h1>Page not found</h1><p><a href="/notes">Back to Notes</a></p>` });
    const ttl = x.title || trim(textOf(x), 60) || "Note";
    return finish({ title: `${ttl} — ${pr.name}`, desc: trim(textOf(x), 160), app: "notes", slug: x.id, noindex: pr.placeholder, type: "article", image: x.img || OG_DEFAULT,
      body: `<article><nav aria-label="Breadcrumb"><a href="/notes">Notes</a></nav><h1>${esc(ttl)}</h1>${bodyOf(x)}</article>`, mdText: `# ${ttl}\n\n${textOf(x)}\n`,
      ld: [{ "@type": "Article", headline: ttl.slice(0, 110), description: trim(textOf(x), 160), url: `${SITE}/notes/${x.id}`, author: { "@id": `${SITE}/#person` }, dateModified: new Date(x.ts || Date.now()).toISOString().slice(0, 10) }, crumbs([home, { name: "Notes", path: "/notes" }, { name: ttl, path }])] });
  }

  if (path === "/services") {
    const { SV_DEF } = (await import("./defaults.mjs")).defaults();
    const saved = (pr.settings.services || []).length > 0;
    const sv = saved ? pr.settings.services : SV_DEF.services, proc = (pr.settings.process || []).length ? pr.settings.process : SV_DEF.process, faq = (pr.settings.faq || []).length ? pr.settings.faq : SV_DEF.faq;
    const pts = (v) => (Array.isArray(v.points) ? v.points : String(v.points || "").split(/\n|;/)).map((x) => x.trim()).filter(Boolean);
    return finish({ title: `Services — ${pr.name}, ${pr.role}`, desc: trim(sv.map((s) => s.title).join(", ") + ". " + `Design services by ${pr.name}.`), app: "services", noindex: !saved || hidden.has("services"),
      body: `<h1>Services</h1>${sv.map((s) => `<section><h2>${esc(s.title)}</h2><p>${esc(s.text || "")}</p>${pts(s).length ? `<ul>${pts(s).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${s.price ? `<p>${esc(s.price)}</p>` : ""}</section>`).join("")}<h2>How it works</h2><ol>${proc.map((x) => `<li><b>${esc(x.title)}</b>: ${esc(x.text || "")}</li>`).join("")}</ol><h2>Questions</h2>${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}`,
      mdText: `# Services\n\n${sv.map((s) => `## ${s.title}\n\n${s.text || ""}\n\n${pts(s).map((x) => `- ${x}`).join("\n")}`).join("\n\n")}\n\n## FAQ\n\n${faq.map((f) => `**${f.q}** ${f.a}`).join("\n\n")}\n`,
      ld: [...sv.map((s) => ({ "@type": "Service", name: s.title, description: s.text || "", provider: { "@id": `${SITE}/#person` }, ...(s.price ? { offers: { "@type": "Offer", description: s.price } } : {}) })), faq.length ? { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) } : null, crumbs([home, { name: "Services", path }])].filter(Boolean) });
  }
  if (path === "/book") return finish({ title: `Book a call with ${pr.name}`, desc: `Pick a time for a free intro call with ${pr.name}.`, app: "book", noindex: !pr.booking,
    body: `<h1>Book a call</h1><p>${pr.booking ? `<a href="${esc(pr.booking)}">Choose a time</a>` : ""}</p>`, ld: [crumbs([home, { name: "Book a call", path }])] });
  if (path === "/content") return finish({ title: `Content — ${pr.name}`, desc: `Videos and reels by ${pr.name}.`, app: "content", noindex: true, body: `<h1>Content</h1><p>Videos and reels by ${esc(pr.name)}.</p>` });

  if (path === "/projects" || path.startsWith("/projects/")) {
    const idx = await projectIndex(store), pub = idx.filter((m) => m.status === "published");
    if (path === "/projects") {
      return finish({ title: `Projects — ${pr.name}`, desc: `Selected work by ${pr.name}: ${[...new Set(pub.map((p) => p.field).filter(Boolean))].slice(0, 4).join(", ") || pr.role}.`, app: "projects", noindex: hidden.has("projects") || (pr.placeholder && pub.every((p) => /^Project /.test(p.title))),
        image: pub.find((p) => p.cover)?.cover.src || OG_DEFAULT,
        body: `<h1>Projects</h1><ul>${pub.map((p) => `<li>${p.cover ? `<img src="${esc(p.cover.src)}" alt="${esc(p.cover.alt || p.title)}" loading="lazy" width="320">` : ""}${projLi(p).replace(/^<li>/, "").replace(/<\/li>$/, "")}</li>`).join("")}</ul>`,
        mdText: `# Projects\n\n${pub.map((p) => `- [${p.title}](${abs("/projects/" + p.slug)}) — ${p.summary}`).join("\n")}\n`,
        ld: [{ "@type": "CollectionPage", name: `Projects — ${pr.name}`, url: `${SITE}/projects`, mainEntity: itemList(pub.map((p) => ({ path: `/projects/${p.slug}`, name: p.title }))) }, crumbs([home, { name: "Projects", path }])] });
    }
    const slug = decodeURIComponent(path.slice("/projects/".length));
    const p = await projectBySlug(store, slug);
    if (!p || (p.status === "draft")) return finish({ status: 404, title: "Project not found", desc: "This project could not be found.", app: "projects", noindex: true, body: `<h1>Project not found</h1><p><a href="/projects">See all projects</a></p>` });
    const img = p.cover?.src || firstImage(p.blocks) || OG_DEFAULT, i = pub.findIndex((m) => m.id === p.id);
    const desc = p.seo?.desc || p.summary || trim(blocksText(p.blocks, " "));
    const credit = p.credits?.length ? `<h2>Credits</h2><ul>${p.credits.map((c) => `<li>${esc(c.name)}${c.role ? ` — ${esc(c.role)}` : ""}</li>`).join("")}</ul>` : "";
    const meta = [p.field && `Field: ${p.field}`, p.year && `Year: ${p.year}`, p.client && `Client: ${p.client}`, p.role && `Role: ${p.role}`, p.tools?.length && `Tools: ${p.tools.join(", ")}`].filter(Boolean);
    return finish({
      title: p.seo?.title || `${p.title} — ${p.field || "Project"} by ${pr.name}`, desc: trim(desc), app: "projects", slug: p.slug, type: "article", image: img,
      imageAlt: p.cover?.alt || p.title, noindex: p.status === "unlisted" || hidden.has("projects"), modified: p.updated ? new Date(p.updated).toISOString() : undefined,
      body: `<article><nav aria-label="Breadcrumb"><a href="/projects">Projects</a></nav><h1>${esc(p.title)}</h1><p>${esc(p.summary || "")}</p>${meta.length ? `<ul>${meta.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
${p.cover ? `<img src="${esc(p.cover.src)}" alt="${esc(p.cover.alt || p.title)}">` : ""}${renderBlocks(p.blocks, { hBase: 2 })}${credit}
${p.link ? `<p><a href="${esc(p.link)}" rel="noopener">View the project</a></p>` : ""}${(p.links || []).map((l) => `<p><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a></p>`).join("")}
${p.tags?.length ? `<p>${p.tags.map((t) => esc(t)).join(", ")}</p>` : ""}${pub[i - 1] ? `<p><a href="/projects/${esc(pub[i - 1].slug)}">Previous: ${esc(pub[i - 1].title)}</a></p>` : ""}${pub[i + 1] ? `<p><a href="/projects/${esc(pub[i + 1].slug)}">Next: ${esc(pub[i + 1].title)}</a></p>` : ""}</article>`,
      mdText: `# ${p.title}\n\n${p.summary || ""}\n\n${meta.map((m) => `- ${m}`).join("\n")}\n\n${blocksToMd(p.blocks)}\n\n${p.link ? `Link: ${p.link}\n` : ""}`,
      ld: [{ "@type": "CreativeWork", "@id": `${SITE}/projects/${p.slug}#work`, name: p.title, headline: p.title, description: trim(desc), url: `${SITE}/projects/${p.slug}`, mainEntityOfPage: `${SITE}/projects/${p.slug}`,
        image: abs(img), creator: { "@id": `${SITE}/#person` }, author: { "@id": `${SITE}/#person` }, dateCreated: p.ts ? new Date(p.ts).toISOString().slice(0, 10) : undefined,
        datePublished: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : undefined, dateModified: p.updated ? new Date(p.updated).toISOString().slice(0, 10) : undefined,
        ...(p.field ? { genre: p.field } : {}), ...((p.tags || []).length ? { keywords: p.tags.join(", ") } : {}), ...(p.tools?.length ? { tool: p.tools } : {}),
        ...(p.license?.startsWith("cc") ? { license: `https://creativecommons.org/licenses/${p.license.replace(/^cc-/, "").replace(/^0$/, "zero")}/4.0/` } : {}),
        ...(p.client ? { sponsor: { "@type": "Organization", name: p.client } } : {}), wordCount: wordCount(p.blocks) || undefined,
        ...(p.credits?.length ? { contributor: p.credits.map((c) => ({ "@type": "Person", name: c.name, ...(c.url ? { url: c.url } : {}) })) } : {}) },
        crumbs([home, { name: "Projects", path: "/projects" }, { name: p.title, path }])],
    });
  }

  if (path === "/journal" || path.startsWith("/journal/")) {
    const posts = await loadLivePosts(store);
    if (path === "/journal" || path.startsWith("/journal/tag/")) {
      const tag = path.startsWith("/journal/tag/") ? decodeURIComponent(path.slice("/journal/tag/".length)) : "";
      const all = [...new Map(posts.flatMap((p) => [p.tag, ...(p.tags || [])]).filter(Boolean).map((t) => [tagSlug(t), t])).entries()];
      const list = tag ? posts.filter((p) => [p.tag, ...(p.tags || [])].some((t) => t && tagSlug(t) === tag)) : posts;
      if (tag && !list.length) return finish({ status: 404, title: "Not found", desc: "", app: "journal", noindex: true, body: `<h1>No articles with this tag</h1><p><a href="/journal">All articles</a></p>` });
      const label = tag ? (all.find(([s]) => s === tag)?.[1] || tag) : "";
      const title = tag ? `${label} articles — Journal by ${pr.name}` : `Journal — ${pr.name}`;
      const desc = tag ? `Articles by ${pr.name} about ${label}.` : `Notes on branding, design, and working with AI by ${pr.name}. Written as I learn, and updated when I'm wrong.`;
      return finish({ title, desc, app: "journal", slug: tag ? `tag/${tag}` : "", noindex: hidden.has("journal"), modified: undefined,
        image: posts.find((p) => p.img)?.img || OG_DEFAULT,
        body: `<h1>${tag ? `Journal: ${esc(label)}` : "Journal"}</h1><p>${esc(desc)}</p><nav aria-label="Tags"><ul>${all.map(([s, t]) => `<li><a href="/journal/tag/${esc(s)}">${esc(t)}</a></li>`).join("")}</ul></nav><ul>${list.map(postLi).join("")}</ul>`,
        mdText: `# Journal${tag ? `: ${label}` : ""}\n\n${list.map((p) => `- [${p.title}](${abs("/journal/" + p.slug)}) — ${p.excerpt}`).join("\n")}\n`,
        ld: [{ "@type": tag ? "CollectionPage" : "Blog", name: title, url: `${SITE}${path}`, description: desc, author: { "@id": `${SITE}/#person` }, blogPost: tag ? undefined : list.slice(0, 20).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE}/journal/${p.slug}`, datePublished: isoDate(p) })), mainEntity: itemList(list.map((p) => ({ path: `/journal/${p.slug}`, name: p.title }))) },
          crumbs(tag ? [home, { name: "Journal", path: "/journal" }, { name: label, path }] : [home, { name: "Journal", path }])] });
    }
    const slug = decodeURIComponent(path.slice("/journal/".length));
    const p = posts.find((x) => x.slug === slug);
    if (!p) return finish({ status: 404, title: "Article not found", desc: "This article could not be found.", app: "journal", noindex: true, body: `<h1>Article not found</h1><p><a href="/journal">See all articles</a></p>` });
    const blocks = blocksOf(p), media = { carousels: CAROUSELS };
    const html = renderBlocks(blocks, { hBase: 2, media });
    const img = p.img || firstImage(blocks), desc = p.seoDesc || p.excerpt || trim(blocksText(blocks, " "));
    const rel = posts.filter((x) => x.slug !== p.slug && [x.tag, ...(x.tags || [])].some((t) => t && [p.tag, ...(p.tags || [])].includes(t))).slice(0, 3);
    const i = posts.findIndex((x) => x.slug === p.slug), newer = posts[i - 1], older = posts[i + 1];
    const tags = [p.tag, ...(p.tags || [])].filter(Boolean);
    const iso = isoDate(p), mod = p.modified || iso;
    return finish({
      title: p.seoTitle || `${p.title} — ${pr.name}`, desc: trim(desc), app: "journal", slug: p.slug, type: "article", image: img || OG_DEFAULT, imageAlt: p.imgAlt || p.title, noindex: !!p.noindex || hidden.has("journal"),
      published: iso, modified: mod, section: p.tag, tags,
      body: `<article><nav aria-label="Breadcrumb"><a href="/journal">Journal</a></nav><header><h1>${esc(p.title)}</h1><p>${iso ? `<time datetime="${iso}">${esc(p.date || iso)}</time>` : esc(p.date)} · ${readMinutes(blocks)} min read · <a href="/about">${esc(pr.name)}</a></p>${p.excerpt ? `<p><em>${esc(p.excerpt)}</em></p>` : ""}${img ? `<img src="${esc(img)}" alt="${esc(p.imgAlt || p.title)}">` : ""}</header>${html}
${p.url ? `<p><a href="${esc(p.url)}" rel="noopener">Also on ${esc(p.source || "the original")}</a></p>` : ""}${tags.length ? `<p>${tags.map((t) => `<a href="/journal/tag/${esc(tagSlug(t))}">${esc(t)}</a>`).join(" · ")}</p>` : ""}</article>
${rel.length ? `<aside><h2>More to read</h2><ul>${rel.map(postLi).join("")}</ul></aside>` : ""}${newer ? `<p><a href="/journal/${esc(newer.slug)}">Newer: ${esc(newer.title)}</a></p>` : ""}${older ? `<p><a href="/journal/${esc(older.slug)}">Older: ${esc(older.title)}</a></p>` : ""}`,
      mdText: `# ${p.title}\n\n*${p.date || ""}* · ${pr.name}\n\n${blocksToMd(blocks)}\n`,
      ld: [{ "@type": "BlogPosting", "@id": `${SITE}/journal/${p.slug}#post`, headline: p.title.slice(0, 110), description: trim(desc), url: `${SITE}/journal/${p.slug}`, mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/journal/${p.slug}` },
        ...(img ? { image: [abs(img)] } : { image: [abs(OG_DEFAULT)] }), datePublished: iso, dateModified: (mod || "").slice(0, 10) || iso, author: { "@id": `${SITE}/#person` }, publisher: { "@id": `${SITE}/#person` },
        ...(p.tag ? { articleSection: p.tag } : {}), ...(tags.length ? { keywords: tags.join(", ") } : {}), wordCount: wordCount(blocks), inLanguage: "en", isAccessibleForFree: true, timeRequired: `PT${readMinutes(blocks)}M`,
        ...(p.url ? { sameAs: p.url } : {}) }, crumbs([home, { name: "Journal", path: "/journal" }, { name: p.title, path }])],
    });
  }

  const id = BY_PATH[path];
  if (id) { const ap = APP_PAGES[id]; return finish({ title: `${ap.title} — ${pr.name}`, desc: `${ap.title} on ${pr.name}'s portfolio.`, app: id, noindex: true, body: `<h1>${esc(ap.title)}</h1>`, ld: [] }); }
  return finish({ status: 404, title: `Page not found — ${pr.name}`, desc: "This page could not be found.", app: "", noindex: true, notFound: true, body: `<h1>Page not found</h1>${nav(hidden)}` });
}

// POST /api/unlock {slug, email, newsletter, pre, website, src, ref}
// Saves the unlock, adds newsletter opt-ins to the "Sansser Newsletter" list in Resend (welcome email the first time),
// emails the links, and returns them. slug "home" is the newsletter form on the home page.
import { getStore } from "@netlify/blobs";
import { PAGES } from "../lib/pages.mjs";
import { json, clean, EMAIL, hashOf, subscribe, send, linksEmail, welcomeEmail } from "../lib/core.mjs";

export default async (req, context) => {
  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const slug = clean(b.slug, 40).toLowerCase();
  const page = slug === "home" ? null : PAGES[slug];
  if (slug !== "home" && !page) return json({ error: "This page doesn't exist." }, 404);
  if (b.website) return json({ ok: true, subscribed: false, items: [] }); // hidden field only bots fill in
  const email = clean(b.email, 120).toLowerCase();
  if (!EMAIL.test(email)) return json({ error: "That doesn't look like an email address." }, 400);
  const newsletter = slug === "home" ? true : b.newsletter === true;

  const store = getStore({ name: "sansser-unlocks", consistency: "strong" });
  const key = `u/${slug}/${hashOf(email)}`, now = Date.now();
  const old = await store.get(key, { type: "json" }).catch(() => null);
  const entry = old
    ? { ...old, newsletter: old.newsletter || newsletter, last: now, times: (old.times || 1) + 1 }
    : { slug, email, newsletter, preticked: newsletter && b.pre === true, ts: now, country: clean(context.geo?.country?.code, 4), src: clean(b.src, 60), ref: clean(b.ref, 200) };
  for (const k of Object.keys(entry)) if (entry[k] === "" || entry[k] === undefined) delete entry[k];
  await store.setJSON(key, entry);

  const isNew = newsletter ? await subscribe(email) : false;
  const mails = [];
  if (page) { const m = linksEmail(email, slug, page); mails.push(send(email, m.subject, m.html, m.text)); }
  if (isNew) { const m = welcomeEmail(email, !!page); mails.push(send(email, m.subject, m.html, m.text)); }
  await Promise.allSettled(mails);

  return json({ ok: true, subscribed: newsletter, items: page ? page.items : [] });
};

export const config = { path: "/api/unlock", method: "POST", rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip", "domain"] } };

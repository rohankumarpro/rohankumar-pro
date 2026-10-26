// Unlock a reel page: save the person, their newsletter choice and the unlock, then return the links.
import type { APIRoute } from "astro";
import { page } from "../../lib/data";
import { db } from "../../lib/server/db";
import { subscribe } from "../../lib/server/mail";
import { json, clean, EMAIL, country, newsDefault } from "../../lib/server/http";

export const prerender = false;
const WORDING = "Subscribe to the newsletter";

export const POST: APIRoute = async ({ request, locals, url }) => {
  const b = await request.json().catch(() => ({}));
  if (clean(b.website, 200)) return json({ ok: true, items: [] }); // honeypot: bots get nothing, people never fill it
  const email = clean(b.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return json({ ok: false, error: "Enter an email like you@email.com." }, 400);
  const p = page(clean(b.keyword, 40));
  if (!p) return json({ ok: false, error: "This page doesn't exist anymore." }, 404);
  const newsletter = !!b.newsletter, src = clean(b.src, 80) || undefined, cc = country(locals);

  const store = db(url);
  try {
    if (store.ready) {
      const id = await store.person(email, { country: cc || undefined, source: p.keyword.toUpperCase(), src_tag: src });
      if (newsletter) await store.consent(id, { given: true, where_: `r/${p.slug} popup`, wording: WORDING, pre_ticked: !!b.pre && newsDefault(cc) });
      const pid = await store.pageId(p.slug);
      if (pid) { await store.unlock(id, pid, src); await store.event({ page_id: pid, kind: "unlock", src_tag: src }); }
    } else {
      console.error("unlock: database not configured; sign-up not saved", p.slug);
    }
    if (newsletter) await subscribe(email);
  } catch (e) {
    // Never block the visitor; the error is logged for us to fix.
    console.error("unlock: save failed", p.slug, e);
  }
  if (p.slug === "guide") return json({ ok: true, next: "/learn/natural-ai-writing" });
  return json({ ok: true, items: p.items });
};

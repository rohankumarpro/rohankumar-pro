// Newsletter sign-up from the home page and the newsletter page.
import type { APIRoute } from "astro";
import { db } from "../../lib/server/db";
import { subscribe } from "../../lib/server/mail";
import { json, clean, EMAIL, country } from "../../lib/server/http";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, url }) => {
  const b = await request.json().catch(() => ({}));
  if (clean(b.website, 200)) return json({ ok: true });
  const email = clean(b.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return json({ ok: false, error: "Enter an email like you@email.com." }, 400);
  const store = db(url);
  try {
    if (store.ready) {
      const id = await store.person(email, { country: country(locals) || undefined, source: clean(b.where, 40) || "home", src_tag: clean(b.src, 80) || undefined });
      await store.consent(id, { given: true, where_: clean(b.where, 40) || "home", wording: "Subscribe", pre_ticked: false });
    } else console.error("subscribe: database not configured; sign-up not saved");
    await subscribe(email);
  } catch (e) { console.error("subscribe: save failed", e); }
  return json({ ok: true });
};

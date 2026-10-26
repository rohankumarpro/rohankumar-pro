// GET or POST /unsubscribe?e=<email>&t=<token>  (POST is the one-click unsubscribe mail apps send)
// Marks the Resend contact unsubscribed and keeps a note of it.
import { getStore } from "@netlify/blobs";
import { tokenOk, unsubscribe, hashOf } from "../lib/core.mjs";

const page = (title, text) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<link rel="stylesheet" href="/style.css"></head><body><main class="shell narrow"><img class="logo logo-light" src="/assets/logo_wordmark.png" alt="sansser / insights" width="190"><img class="logo logo-dark" src="/assets/logo_wordmark_white.png" alt="sansser / insights" width="190"><section class="card paper pad"><h1 class="serif-h">${title}</h1><p>${text}</p><p><a href="/">Back to link.sansser.com</a></p></section></main></body></html>`,
  { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

export default async (req) => {
  const u = new URL(req.url);
  const email = String(u.searchParams.get("e") || "").trim().toLowerCase(), t = String(u.searchParams.get("t") || "");
  if (!email || !tokenOk(email, t)) return page("Link not valid", "This unsubscribe link didn't work. Reply to any of my emails and I'll remove you by hand.");
  const r = await unsubscribe(email);
  try { await getStore("sansser-unlocks").setJSON(`unsub/${hashOf(email)}`, { email, ts: Date.now(), ok: !!r.ok }); } catch {}
  if (req.method === "POST") return new Response(null, { status: 200 });
  return r.ok
    ? page("You're unsubscribed", "You won't get the Sansser newsletter any more. Sorry to see you go, and thanks for reading.")
    : page("Something went wrong", "I couldn't unsubscribe you just now. Please try the link again in a minute, or reply to any of my emails and I'll remove you by hand.");
};

export const config = { path: "/unsubscribe", method: ["GET", "POST"] };

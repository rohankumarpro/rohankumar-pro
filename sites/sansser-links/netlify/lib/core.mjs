// Shared by the link.sansser.com functions: responses, unsubscribe tokens, Resend calls and the two emails.
// The unsubscribe token and the email designs match the first version of this site, so links already sent keep working.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SITE = "https://link.sansser.com";
export const FROM = "Rohan from Sansser <hello@sansser.com>";
export const NEWSLETTER_SEGMENT = "e965c335-e6c9-4a8d-8f5c-f8047d0c5e40"; // Resend segment "Sansser Newsletter"
const A = "https://sansser-email-assets.netlify.app";

export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
export const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export const hashOf = (s, n = 20) => createHash("sha256").update("sansser:" + s).digest("hex").slice(0, n);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Unsubscribe token: first 32 hex of HMAC-SHA256(UNSUB_SECRET, email)
export function unsubToken(email) {
  const s = Netlify.env.get("UNSUB_SECRET");
  return s ? createHmac("sha256", s).update(email).digest("hex").slice(0, 32) : "";
}
export function tokenOk(email, t) {
  const want = unsubToken(email);
  if (!want || typeof t !== "string" || t.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(t));
}
export const unsubUrl = (email) => `${SITE}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;

// GDPR (EU, EEA) and UK GDPR: a pre-ticked box is not consent there, so the newsletter box starts unticked.
const CONSENT_FIRST = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB".split(" "));
export const newsDefault = (context) => { const c = String(context?.geo?.country?.code || "").toUpperCase(); return !!c && !CONSENT_FIRST.has(c); };

async function resend(path, method, body) {
  const key = Netlify.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, status: 0 };
  try {
    const r = await fetch("https://api.resend.com" + path, {
      method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(6000),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch { return { ok: false, status: 0 }; }
}

// Adds the person to the newsletter. Returns true only when they are new (so they get the welcome email once).
export async function subscribe(email) {
  const id = encodeURIComponent(email);
  const known = await resend(`/contacts/${id}`, "GET");
  if (!known.ok) {
    const made = await resend("/contacts", "POST", { email, unsubscribed: false, segments: [{ id: NEWSLETTER_SEGMENT }] });
    if (made.ok) return true;
  }
  // already a contact: they just opted in again, so make sure they are subscribed and in the list (no second welcome)
  await resend(`/contacts/${id}`, "PATCH", { unsubscribed: false });
  await resend(`/contacts/${id}/segments/${NEWSLETTER_SEGMENT}`, "POST");
  return false;
}
export const unsubscribe = (email) => resend(`/contacts/${encodeURIComponent(email)}`, "PATCH", { unsubscribed: true });

export async function send(to, subject, html, text) {
  const u = unsubUrl(to);
  const r = await resend("/emails", "POST", {
    from: FROM, to: [to], subject, html, text,
    headers: { "List-Unsubscribe": `<${u}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  return r.ok;
}

const shell = (title, inner, footer) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#EEF2EF;font-family:'Google Sans Flex','Google Sans',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2EF"><tr><td align="center" style="padding:28px 12px 40px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%">
<tr><td style="padding:0 6px 16px"><img src="${A}/logo_wordmark.png" width="180" alt="sansser / insights" style="display:block;width:180px;height:auto;border:0"></td></tr>
<tr><td style="background:#FBF6EA;border-radius:28px;overflow:hidden">${inner}</td></tr>
<tr><td align="center" style="padding:24px 24px 0;font:400 12px/19px 'Google Sans Flex','Google Sans',Roboto,Helvetica,Arial,sans-serif;color:#79747E">${footer}<br><br>&copy; 2026 Sansser</td></tr>
</table></td></tr></table></body></html>`;

const hero = (eyebrow, title) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#00674F;border-radius:28px 28px 0 0"><tr><td style="padding:34px 32px 30px">
<div style="font:700 12px/1 'Google Sans Flex','Google Sans',Roboto,Helvetica,Arial,sans-serif;color:#9FF2D6;letter-spacing:1.6px;text-transform:uppercase">${esc(eyebrow)}</div>
<div style="margin-top:12px;font:800 32px/38px 'Google Sans Flex','Google Sans',Roboto,Helvetica,Arial,sans-serif;color:#FFFFFF;letter-spacing:-0.6px">${esc(title)}</div></td></tr></table>`;
const body = (inner) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:26px 28px 10px;font:400 18px/29px 'Newsreader',Georgia,'Times New Roman',serif;color:#2E2A33;background-color:#FBF6EA;background-image:url('${A}/paper.jpg')">${inner}
<p style="margin:8px 0 6px">Talk soon,</p><img src="${A}/signature_g.png" width="120" alt="Rohan" style="display:block;width:120px;height:auto;margin:0 0 26px -8px;border:0"></td></tr></table>`;

export function linksEmail(email, slug, page) {
  const card = (it) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E4E0D4;border-radius:16px"><tr><td style="padding:16px 18px">
<div style="font:700 17px/23px 'Google Sans Flex','Google Sans',Roboto,Helvetica,Arial,sans-serif;color:#1D1B20">${it.bonus ? "Bonus: " : ""}${esc(it.name)}${it.tag ? ` <span style="font:600 12px/1 'Google Sans Flex','Google Sans',Roboto,Helvetica,Arial,sans-serif;color:#00674F;background:#DDF3EA;border-radius:999px;padding:4px 9px;vertical-align:2px">${esc(it.tag)}</span>` : ""}</div>
${it.desc ? `<div style="margin-top:4px;font:400 15px/22px 'Google Sans Flex','Google Sans',Roboto,Helvetica,Arial,sans-serif;color:#55505C">${esc(it.desc)}</div>` : ""}
<a href="${esc(it.url)}" style="display:inline-block;margin-top:10px;font:600 15px/1 'Google Sans Flex','Google Sans',Roboto,Helvetica,Arial,sans-serif;color:#00674F;text-decoration:underline">Open link &rarr;</a></td></tr></table></td></tr></table>`;
  const page_url = `${SITE}/${slug}`;
  const html = shell(page.title, hero("Your links are here", page.title) + body(
    `<p style="margin:0 0 18px">Here's everything from the reel, saved in your inbox so you can come back to it any time.</p>${page.items.map(card).join("")}
<p style="margin:4px 0 18px">Step-by-step guides for each one are on the page: <a href="${page_url}" style="color:#00674F">${page_url.replace("https://", "")}</a></p>`),
    `You're getting this because you unlocked this page on link.sansser.com.<br><a href="${esc(unsubUrl(email))}" style="color:#00674F;text-decoration:underline">Unsubscribe</a> anytime.`);
  const text = [`Your links: ${page.title}`, "", ...page.items.map((it) => `${it.bonus ? "Bonus: " : ""}${it.name}${it.desc ? " - " + it.desc : ""}\n${it.url}\n`), `Step-by-step guides: ${page_url}`, "", "Talk soon,", "Rohan", "", `Unsubscribe: ${unsubUrl(email)}`].join("\n");
  return { subject: `Your links: ${page.title}`, html, text };
}

export function welcomeEmail(email, fromPage) {
  const lead = fromPage
    ? "Thanks for grabbing the link from my reel and for joining the newsletter. If you need that link again, it's still on the same page where you unlocked it."
    : "Thanks for joining the newsletter.";
  const paras = [
    "Hey there,", lead,
    "I make short videos about AI and how it's changing the way we work and think, and Sansser is where I'll share what doesn't fit into a reel, like tools that replace things you're paying for, automations that save you hours, and honest takes on where all of this is heading. I test things every week and only send what actually works.",
    "The weekly emails will be written by me, not by AI, and I'll only send what I genuinely think is useful to you.",
    "What's one thing you'd like to automate or make easier? Hit reply and tell me, I read every reply.",
  ];
  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#00674F;border-radius:28px 28px 0 0"><tr><td align="center" style="padding:40px 30px 30px">
<div style="font:700 12px/1 'Google Sans Flex','Google Sans',Roboto,Arial,sans-serif;color:#9FF2D6;letter-spacing:1.6px;text-transform:uppercase">A little note from me</div>
<img src="${A}/avatar_photo.png" width="150" height="150" alt="Rohan" style="display:block;width:150px;height:150px;border:0;border-radius:50%;margin:14px auto 0">
<h1 style="margin:22px 0 0;font:800 40px/46px 'Google Sans Flex','Google Sans',Roboto,Arial,sans-serif;color:#FFFFFF;letter-spacing:-1px">Hey, I'm Rohan.</h1>
<p style="margin:12px auto 0;max-width:460px;font:400 17px/26px 'Google Sans Flex','Google Sans',Roboto,Arial,sans-serif;color:#D2EFE5">Welcome to Sansser, here's what you can expect from me.</p></td></tr></table>
<img src="${A}/wave_g.png" width="600" alt="" style="display:block;width:100%;height:auto;border:0">` + body(paras.map((p) => `<p style="margin:0 0 18px">${esc(p)}</p>`).join(""));
  const html = shell("A quick hello from Rohan", inner,
    `You're getting this because you signed up for the newsletter on sansser.com.<br><a href="${esc(unsubUrl(email))}" style="color:#00674F;text-decoration:underline">Unsubscribe</a> anytime, no hard feelings.`);
  const text = ["Hey, I'm Rohan.", "Welcome to Sansser, here's what you can expect from me.", "", ...paras.flatMap((p) => [p, ""]), "Talk soon,", "Rohan", "", "You're getting this because you signed up for the newsletter on sansser.com.", `Unsubscribe: ${unsubUrl(email)}`].join("\n");
  return { subject: "A quick hello from Rohan", html, text };
}

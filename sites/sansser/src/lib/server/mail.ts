// Resend: newsletter list membership and unsubscribe links. Matches link.sansser.com so links already sent keep working.
import { createHmac, timingSafeEqual } from "node:crypto";

export const NEWSLETTER_SEGMENT = "e965c335-e6c9-4a8d-8f5c-f8047d0c5e40"; // Resend segment "Sansser Newsletter"

async function resend(path: string, method: string, body?: unknown) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, status: 0 };
  try {
    const r = await fetch("https://api.resend.com" + path, {
      method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(6000),
    });
    return { ok: r.ok, status: r.status };
  } catch { return { ok: false, status: 0 }; }
}

// Adds the person to the newsletter segment. Returns true only when they are new to Resend.
export async function subscribe(email: string) {
  const id = encodeURIComponent(email);
  const known = await resend(`/contacts/${id}`, "GET");
  if (!known.ok) {
    const made = await resend("/contacts", "POST", { email, unsubscribed: false, segments: [{ id: NEWSLETTER_SEGMENT }] });
    if (made.ok) return true;
  }
  await resend(`/contacts/${id}`, "PATCH", { unsubscribed: false });
  await resend(`/contacts/${id}/segments/${NEWSLETTER_SEGMENT}`, "POST");
  return false;
}
export const unsubscribe = (email: string) => resend(`/contacts/${encodeURIComponent(email)}`, "PATCH", { unsubscribed: true });

// Unsubscribe token: first 32 hex of HMAC-SHA256(UNSUB_SECRET, email)
export function unsubToken(email: string) {
  const s = process.env.UNSUB_SECRET;
  return s ? createHmac("sha256", s).update(email).digest("hex").slice(0, 32) : "";
}
export function tokenOk(email: string, t: unknown) {
  const want = unsubToken(email);
  if (!want || typeof t !== "string" || t.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(t));
}

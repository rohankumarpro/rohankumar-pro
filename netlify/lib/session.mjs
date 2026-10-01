// Session helpers. The only secret is the ADMIN_PASSWORD environment variable,
// set privately in Netlify. Nothing secret lives in this public repo.
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "rk_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function key() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD is not set");
  return createHmac("sha256", "rk-session-v1").update(pw).digest();
}
const sign = (v) => createHmac("sha256", key()).update(v).digest("base64url");

function safeEq(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
}

export function passwordOk(pw) {
  const real = process.env.ADMIN_PASSWORD;
  return !!real && typeof pw === "string" && safeEq(pw, real);
}

export function makeCookie() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}
export const clearCookie = () =>
  `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

export function isAdmin(event) {
  try {
    const h = event.headers || {};
    const raw = h.cookie || h.Cookie || (event.multiValueHeaders?.cookie || []).join("; ") || "";
    const m = raw.match(/(?:^|;\s*)rk_admin=([^;]+)/);
    if (!m) return false;
    const [exp, sig] = m[1].split(".");
    if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
    return safeEq(sig, sign(exp));
  } catch { return false; }
}

export const body = (event) => {
  try {
    const s = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString() : event.body;
    return JSON.parse(s || "{}");
  } catch { return null; }
};

export const json = (data, statusCode = 200, extra = {}) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  body: JSON.stringify(data),
});

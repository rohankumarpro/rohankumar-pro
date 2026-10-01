// /api/auth  GET: am I signed in?  POST {password}: sign in.  DELETE: sign out.
import { passwordOk, makeCookie, clearCookie, isAdmin, body, json } from "../lib/session.mjs";

export const handler = async (event) => {
  const m = event.httpMethod;
  if (m === "GET") return json({ admin: isAdmin(event) });
  if (m === "DELETE") return json({ admin: false }, 200, { "set-cookie": clearCookie() });
  if (m === "POST") {
    const pw = body(event)?.password;
    if (passwordOk(pw)) return json({ admin: true }, 200, { "set-cookie": makeCookie() });
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return json({ admin: false, error: "Wrong password" }, 401);
  }
  return json({ error: "Method not allowed" }, 405);
};

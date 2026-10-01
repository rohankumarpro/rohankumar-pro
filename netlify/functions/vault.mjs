// /api/vault  The owner's encrypted vault. Everything is encrypted in the browser with the owner's passphrase
// before it gets here, so the server only ever holds ciphertext. Owner sign-in is also required to read it.
//   GET  -> {init:false} or {init:true, vault}
//   PUT  {vault, rev, force?}  saves; rev must match the stored one (so two tabs can't overwrite each other)
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const ok = (o, max) => o && typeof o === "object" && B64.test(o.iv || "") && B64.test(o.c || "") && o.iv.length <= 32 && o.c.length <= max;

export const handler = async (event) => {
  try {
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    connectLambda(event);
    const store = contentStore(event);
    const cur = await store.get("vault", { type: "json" });
    if (event.httpMethod === "GET") return json(cur ? { init: true, vault: cur } : { init: false });
    if (event.httpMethod === "PUT") {
      const b = body(event);
      const v = b?.vault;
      const salt = v?.kdf?.salt, iter = v?.kdf?.iter;
      if (!v || v.v !== 1 || !B64.test(salt || "") || salt.length > 64 || !Number.isInteger(iter) || iter < 300000 || iter > 5000000
        || !ok(v.wrap, 200) || !ok(v.index, 1_400_000)) return json({ error: "Bad vault" }, 400);
      const rev = cur?.rev ?? 0;
      if (!b.force && (b.rev ?? 0) !== rev) return json({ error: "The vault changed in another window. Lock and unlock to reload it.", rev }, 409);
      const next = { v: 1, kdf: { salt, iter }, wrap: { iv: v.wrap.iv, c: v.wrap.c }, index: { iv: v.index.iv, c: v.index.c }, rev: rev + 1 };
      await store.setJSON("vault", next);
      return json({ ok: true, vault: next });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};

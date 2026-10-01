// /api/guestbook
//   GET     anyone: approved notes.  Owner: every note, with its status.
//   POST    anyone: sign the guestbook {name, msg, color, vid}. Notes wait for approval unless the owner turned on "Publish notes right away".
//   PUT     owner: {id, action: "approve" | "unapprove"}
//   DELETE  owner: ?id=<id>
import { createHash } from "node:crypto";
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";

const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"];
const DAY = 86_400_000;
const pub = (e) => ({ id: e.id, name: e.name, msg: e.msg, color: e.color, ts: e.ts });
const hash = (s) => createHash("sha256").update("rk-gb:" + s).digest("hex").slice(0, 16);
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event);
    const admin = isAdmin(event);
    const all = (await store.get("guestbook", { type: "json" })) ?? [];
    const m = event.httpMethod;

    if (m === "GET") {
      const mine = all.filter((e) => e.status === "approved").sort((a, b) => b.ts - a.ts);
      if (!admin) return json({ entries: mine.map(pub) });
      const site = (await store.get("settings", { type: "json" })) ?? {};
      return json({
        entries: all.slice().sort((a, b) => b.ts - a.ts).map((e) => ({ ...pub(e), status: e.status })),
        auto: !!site.gbAuto,
      });
    }

    if (m === "POST") {
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      if (b.website) return json({ ok: true, status: "pending" }); // hidden field only bots fill in: pretend it worked
      const name = clean(b.name, 40), msg = clean(b.msg, 280);
      if (!name || !msg) return json({ error: "Add your name and a message" }, 400);
      if (/(https?:\/\/|www\.)\S+.*(https?:\/\/|www\.)\S+/i.test(msg)) return json({ error: "Please keep it to one link at most" }, 400);
      const vid = /^[a-z0-9]{10,32}$/.test(b.vid || "") ? b.vid : "";
      const h = event.headers || {};
      const ip = hash(h["x-nf-client-connection-ip"] || h["x-forwarded-for"] || "");
      const recent = all.filter((e) => Date.now() - e.ts < DAY);
      if (recent.filter((e) => e.ip === ip).length >= 5 || (vid && recent.filter((e) => e.vid === vid).length >= 3))
        return json({ error: "That's a lot of notes for one day. Please try again tomorrow." }, 429);
      if (all.length >= 1000) return json({ error: "The guestbook is full" }, 429);
      const site = (await store.get("settings", { type: "json" })) ?? {};
      const status = site.gbAuto ? "approved" : "pending";
      const entry = {
        id: Math.random().toString(16).slice(2, 14).padEnd(12, "0"), name, msg,
        color: COLORS.includes(b.color) ? b.color : "c4", ts: Date.now(), status, ip, vid,
      };
      await store.setJSON("guestbook", all.concat([entry]));
      return json({ ok: true, status, entry: pub(entry) });
    }

    if (m === "PUT" || m === "DELETE") {
      if (!admin) return json({ error: "Not signed in" }, 401);
      const id = m === "DELETE" ? (event.queryStringParameters || {}).id : body(event)?.id;
      const i = all.findIndex((e) => e.id === id);
      if (i < 0) return json({ error: "Not found" }, 404);
      if (m === "DELETE") all.splice(i, 1);
      else all[i].status = body(event).action === "unapprove" ? "pending" : "approved";
      await store.setJSON("guestbook", all);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};

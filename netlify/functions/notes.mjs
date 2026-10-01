// /api/notes  GET: anyone reads the notes.  PUT: only the signed-in owner saves them.
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { cleanBlocks, blocksText, rid } from "../../shared/blocks.mjs";
import { contentStore } from "../lib/store.mjs";

const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"];
const clean = (list) =>
  (Array.isArray(list) ? list : []).slice(0, 80).map((n) => {
    const blocks = Array.isArray(n?.blocks) ? cleanBlocks(n.blocks) : [];
    const o = {
      id: /^[\w-]{3,16}$/.test(n?.id || "") ? n.id : rid(),
      title: String(n?.title ?? "").slice(0, 120),
      text: blocks.length ? blocksText(blocks).slice(0, 4000) : String(n?.text ?? "").slice(0, 4000),
      color: COLORS.includes(n?.color) ? n.color : "c4",
    };
    if (blocks.length) o.blocks = blocks;
    if (n?.pin) o.pin = true;
    return o;
  });

export const handler = async (event) => {
  try {
    connectLambda(event);
        const store = contentStore(event);
    if (event.httpMethod === "GET") {
      const notes = await store.get("notes", { type: "json" });
      return json({ notes: notes ?? null });
    }
    if (event.httpMethod === "PUT") {
      if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      const notes = clean(b.notes);
      await store.setJSON("notes", notes);
      return json({ ok: true, notes });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};

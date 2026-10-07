// /api/notes  GET: anyone reads the notes.  PUT: only the signed-in owner saves them.
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { cleanBlocks, blocksText, rid, safeImg } from "../../shared/blocks.mjs";
import { contentStore } from "../lib/store.mjs";
import { saveJSON } from "../lib/safe.mjs";

const COLORS = ["c0", "c1", "c2", "c3", "c4", "c5", "c6", "k-coral", "k-peach", "k-sand", "k-mint", "k-sage", "k-fog", "k-storm", "k-dusk", "k-blossom", "k-clay", "k-chalk"];
const str = (v, n) => String(v ?? "").trim().slice(0, n);
export const cleanNotes = (list) => clean(list);
const clean = (list) =>
  (Array.isArray(list) ? list : []).slice(0, 400).map((n) => {
    const blocks = Array.isArray(n?.blocks) ? cleanBlocks(n.blocks) : [];
    const items = (Array.isArray(n?.items) ? n.items : []).slice(0, 300).map((i) => ({ id: /^[\w-]{3,16}$/.test(i?.id || "") ? i.id : rid(), t: str(i?.t, 300), ...(i?.d ? { d: true } : {}), ...(i?.ind ? { ind: 1 } : {}) }));
    const o = {
      id: /^[\w-]{3,16}$/.test(n?.id || "") ? n.id : rid(),
      title: str(n?.title, 120),
      text: blocks.length ? blocksText(blocks).slice(0, 1000000) : String(n?.text ?? "").slice(0, 1000000),
      color: COLORS.includes(n?.color) ? n.color : "c0",
    };
    if (blocks.length) o.blocks = blocks;
    if (items.length || n?.kind === "list") { o.kind = "list"; o.items = items; }
    if (n?.pin) o.pin = true;
    if (n?.archived) o.archived = true;
    if (n?.private) o.private = true;
    if (+n?.trashed > 0) o.trashed = Math.floor(+n.trashed);
    const labels = [...new Set((Array.isArray(n?.labels) ? n.labels : []).map((l) => str(l, 24)).filter(Boolean))].slice(0, 8); if (labels.length) o.labels = labels;
    const img = safeImg(n?.img); if (img) o.img = img;
    o.ts = +n?.ts > 0 ? Math.floor(+n.ts) : Date.now();
    if (+n?.created > 0) o.created = Math.floor(+n.created);
    return o;
  });
// Visitors only get the notes the owner left public (not private, archived or in the bin).
const visible = (list) => list.filter((n) => !n.private && !n.archived && !n.trashed);

export const handler = async (event) => {
  try {
    connectLambda(event);
        const store = contentStore(event);
    if (event.httpMethod === "GET") {
      const notes = await store.get("notes", { type: "json" });
      return json({ notes: notes == null ? null : isAdmin(event) ? notes : visible(notes) });
    }
    if (event.httpMethod === "PUT") {
      if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      const notes = clean(b.notes);
      await saveJSON(store, "notes", notes);
      return json({ ok: true, notes });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};

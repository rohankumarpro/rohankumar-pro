// Safe writing. Redeploying the site never touches stored content (it lives in Netlify Blobs, separate from the code),
// and on top of that every owner save keeps the version it replaces as "bak/<key>", so a bad save can be undone.
export async function saveJSON(store, key, value) {
  try {
    const old = await store.get(key, { type: "json" });
    if (old != null && JSON.stringify(old) !== JSON.stringify(value)) await store.setJSON("bak/" + key, { ts: Date.now(), value: old });
  } catch {}
  await store.setJSON(key, value);
}

// Guestbook notes are one blob each, so two visitors signing at the same moment can never overwrite each other.
// (Older notes saved as one list under "guestbook" are still read and kept.)
const GB = "gb/";
export async function gbAll(store) {
  const legacy = (await store.get("guestbook", { type: "json" })) ?? [];
  const { blobs } = await store.list({ prefix: GB });
  const fresh = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
  const seen = new Set(legacy.map((e) => e.id));
  return legacy.concat(fresh.filter((e) => !seen.has(e.id)));
}
export const gbAdd = (store, e) => store.setJSON(GB + e.id, e);
export async function gbUpdate(store, id, fn) {
  const own = await store.get(GB + id, { type: "json" });
  if (own) { const next = fn(own); if (next === null) await store.delete(GB + id); else await store.setJSON(GB + id, next); return true; }
  const legacy = (await store.get("guestbook", { type: "json" })) ?? [], i = legacy.findIndex((e) => e.id === id);
  if (i < 0) return false;
  const next = fn(legacy[i]); if (next === null) legacy.splice(i, 1); else legacy[i] = next;
  await store.setJSON("guestbook", legacy); return true;
}

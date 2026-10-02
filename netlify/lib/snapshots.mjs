// Safety copies. A snapshot is the same thing the Download backup button gives you, kept on the server.
// The last SNAP_KEEP are kept; older ones are removed from the backup store only (never from the live content).
const BINARY = /^(photo-|up-|vault-file-)/;
export const SNAP_KEEP = 10, SNAP_EVERY = 24 * 3600_000;

export async function collect(store) {
  const { blobs } = await store.list();
  const data = {}, files = [];
  await Promise.all(blobs.map(async ({ key }) => {
    if (BINARY.test(key)) { files.push(key); return; }
    try { const v = await store.get(key, { type: "json" }); if (v != null) data[key] = v; } catch {}
  }));
  return { kind: "rohankumar-pro-backup", v: 1, ts: Date.now(), count: Object.keys(data).length, data, files: files.sort() };
}

export async function listSnaps(bk) {
  const { blobs } = await bk.list({ prefix: "snap-" });
  return blobs.map((b) => b.key).sort().reverse();
}

export async function takeSnapshot(store, bk) {
  const snap = await collect(store);
  if (!snap.count) return null; // never keep an empty copy in place of a real one
  const key = "snap-" + new Date(snap.ts).toISOString().replace(/[:.]/g, "-");
  await bk.setJSON(key, snap);
  await bk.setJSON("snap-latest", { ts: snap.ts, key, count: snap.count });
  const keys = await listSnaps(bk);
  for (const k of keys.slice(SNAP_KEEP)) await bk.delete(k);
  return { key, count: snap.count, ts: snap.ts };
}

// Called after owner saves: takes a copy when the last one is over a day old. Never throws.
export async function maybeSnapshot(store, bk) {
  try {
    const last = await bk.get("snap-latest", { type: "json" });
    if (!last || Date.now() - last.ts > SNAP_EVERY) await takeSnapshot(store, bk);
  } catch {}
}

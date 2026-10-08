// Google sync: the owner's Docs pages <-> Google Docs in one Drive folder, and Notes <-> Google Keep.
// Works with a Google Workspace "service account" allowed (domain-wide delegation) to act as the owner:
//   GOOGLE_SA_EMAIL + GOOGLE_SA_KEY  the service account's address and private key (smaller; Netlify functions share 4 KB of settings)
//   or GOOGLE_SERVICE_ACCOUNT        the whole JSON key file
//   GOOGLE_SYNC_USER        the Workspace address it acts as (falls back to OWNER_EMAIL)
// Nothing here ever deletes anything on the site. If a Google Doc or Keep note goes away, the site copy just stops syncing.
// When both sides changed since the last sync, the newer edit wins; the site page keeps the other version in its history.
import { createSign, createHash } from "node:crypto";
import { loadIndex, pageKey, createPage, updatePage } from "./docs.mjs";
import { saveJSON } from "./safe.mjs";
import { renderBlocks, mdInline, rid, esc } from "../../shared/blocks.mjs";
import { kindOf, upKey, newId } from "./media-store.mjs";
import { cleanNotes } from "../functions/notes.mjs";

export const STATE = "gsync"; // { folderId, docs: {pageId: {f, gm, su, sh}}, keep: {noteId: {k, ku, st}}, files: {hash: url}, docsOn, keepOn, last, log }
const LOCK = "gsync-lock";
const SITE = "https://rohankumar.pro";
const DOC_MIME = "application/vnd.google-apps.document";
const hash = (s) => createHash("sha1").update(String(s)).digest("hex").slice(0, 16);

/* ---------- connecting ---------- */
const env = (k) => String(process.env[k] || "").trim().replace(/^["']|["'],?$/g, "").trim(); // stray spaces, quotes or a comma from copying out of the key file
function creds() {
  let k = null; try { k = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || "null"); } catch {}
  const email = (k && k.client_email) || env("GOOGLE_SA_EMAIL"), key = String((k && k.private_key) || env("GOOGLE_SA_KEY")).replace(/\\n/g, "\n");
  return email && key.includes("PRIVATE KEY") ? { client_email: email, private_key: key } : null;
}
export function configured() { return !!(creds() && user()); }
const user = () => env("GOOGLE_SYNC_USER") || env("OWNER_EMAIL");
const tokens = {};
async function token(scope) {
  if (tokens[scope] && tokens[scope].exp > Date.now() + 60_000) return tokens[scope].v;
  const k = creds(), now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "RS256", typ: "JWT" }), claim = b64({ iss: k.client_email, sub: user(), scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  let sig; try { sig = createSign("RSA-SHA256").update(head + "." + claim).sign(k.private_key, "base64url"); }
  catch { throw new Error("GOOGLE_SA_KEY in Netlify is not a readable private key. Paste the text between the quotes after \"private_key\" in the key file, from -----BEGIN PRIVATE KEY----- to -----END PRIVATE KEY-----."); }
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const why = d.error === "invalid_client" ? `Google has no service account called ${k.client_email}. Check GOOGLE_SA_EMAIL in Netlify against client_email in the key file.`
      : d.error === "invalid_grant" && /signature/i.test(d.error_description || "") ? `The key in GOOGLE_SA_KEY doesn't belong to ${k.client_email}, or it was deleted in Google Cloud. Make a new key and paste its private_key.`
      : d.error === "unauthorized_client" ? `${k.client_email} isn't allowed to act as ${user()}. In Google Admin > Security > API controls > Domain-wide delegation, add its client ID with the Drive and Keep scopes.`
      : d.error === "invalid_grant" ? `Google refused to act as ${user()} (${d.error_description || "invalid_grant"}). Check GOOGLE_SYNC_USER is a user in your Workspace.` : "";
    throw new Error(`Google sign-in failed (${d.error || r.status}${d.error_description ? ": " + d.error_description : ""}). ${why || "Check the service account and its domain-wide delegation."}`);
  }
  tokens[scope] = { v: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return d.access_token;
}
async function g(scope, url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { authorization: "Bearer " + (await token(scope)), ...(opt.headers || {}) } });
  if (!r.ok) {
    const t = await r.text().catch(() => ""); let msg = t.slice(0, 300); try { msg = JSON.parse(t).error?.message || msg; } catch {}
    const hint = /has not been used|is disabled/i.test(msg) ? ` Turn on the ${/keep/i.test(url) ? "Google Keep" : "Google Drive"} API in your Google Cloud project.` : r.status === 403 && /scope|insufficient/i.test(msg) ? ` Add the ${/keep/i.test(url) ? "keep" : "drive"} scope to the domain-wide delegation in Google Admin.` : "";
    const e = new Error(`Google ${r.status}: ${msg}${hint}`); e.status = r.status; throw e;
  }
  return r;
}
const DRIVE = "https://www.googleapis.com/auth/drive", KEEP = "https://www.googleapis.com/auth/keep";

/* ---------- blocks -> HTML for Google (pictures need full addresses) ---------- */
function toHtml(blocks) {
  const html = renderBlocks(blocks || [], { hBase: 1 }).replace(/(src|href)="\/(?!\/)/g, `$1="${SITE}/`);
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
}

/* ---------- Google's markdown -> blocks ---------- */
const unesc = (s) => s.replace(/\\([\\`_{}\[\]()#+\-.!|>~=])/g, "$1");
const inl = (s) => mdInline(unesc(String(s).replace(/^\*\*(.+)\*\*$/, "$1")));
async function mdToBlocksG(md, saveImg) {
  const lines = String(md || "").replace(/\r/g, "").split("\n"), refs = {}, out = [];
  for (const l of lines) { const m = l.match(/^\s*\[([^\]]+)\]:\s*<?(\S+?)>?\s*$/); if (m) refs[m[1].toLowerCase()] = m[2]; }
  const img = async (src, alt) => { src = refs[String(src).toLowerCase()] || src; const u = await saveImg(src); return u ? { id: rid(), t: "image", src: u, alt: alt || "" } : null; };
  let para = [];
  const flush = () => { if (para.length) { out.push({ id: rid(), t: "p", h: inl(para.join(" ")) }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], t = l.trim(); let m;
    if (/^\s*\[[^\]]+\]:\s*\S/.test(l)) continue; // a picture or link reference, already read
    if (!t) { flush(); continue; }
    if (t.startsWith("```")) { flush(); const x = []; while (++i < lines.length && !lines[i].trim().startsWith("```")) x.push(lines[i]); out.push({ id: rid(), t: "code", x: x.join("\n"), lang: t.slice(3).trim() }); continue; }
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) { flush(); out.push({ id: rid(), t: "h" + Math.min(3, m[1].length), h: inl(m[2]) }); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push({ id: rid(), t: "divider" }); continue; }
    if (t.startsWith("|")) { flush(); const rows = []; for (; i < lines.length && lines[i].trim().startsWith("|"); i++) { const c = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((x) => x.trim()); if (!c.every((x) => /^:?-{2,}:?$/.test(x))) rows.push(c.map(inl)); } i--; if (rows.length) out.push({ id: rid(), t: "table", rows, hr: true }); continue; }
    if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/)) || (m = t.match(/^!\[([^\]]*)\]\[([^\]]+)\]$/))) { flush(); const b = await img(m[2], m[1]); if (b) out.push(b); continue; }
    if ((m = l.match(/^(\s*)([*+-]|\d+[.)])\s+(\[([ xX])\]\s+)?(.*)$/))) {
      flush(); const sp = m[1].replace(/\t/g, "    ").length, d = Math.min(3, Math.floor(sp / (sp && sp % 4 === 0 ? 4 : 2)));
      if (m[3]) out.push({ id: rid(), t: "todo", h: inl(m[5]), d, ...(m[4].toLowerCase() === "x" ? { c: true } : {}) });
      else out.push({ id: rid(), t: /\d/.test(m[2]) ? "ol" : "ul", h: inl(m[5]), d });
      continue;
    }
    if (t.startsWith(">")) { flush(); out.push({ id: rid(), t: "quote", h: inl(t.replace(/^>\s?/, "")) }); continue; }
    para.push(t);
  }
  flush();
  return out;
}

/* pictures that come back from Google: kept once in the site's media library, matched by their content */
function imageSaver(store, st) {
  st.files = st.files || {};
  return async (src) => {
    if (/^https?:\/\//.test(src)) return src;
    const m = String(src).match(/^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=]+)$/); if (!m) return "";
    const buf = Buffer.from(m[2], "base64"), k = kindOf(buf); if (!k || !k.image || buf.length > 4_000_000) return "";
    const h = hash(m[2]); if (st.files[h]) return st.files[h];
    const id = newId(); await store.set(upKey(id), buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const idx = (await store.get("uploads", { type: "json" })) ?? [];
    await store.setJSON("uploads", [{ id, ext: k.ext, kind: "image", name: "From Google Docs", bytes: buf.length, w: 0, h: 0, thumb: false, ts: Date.now() }, ...idx]);
    return (st.files[h] = `/api/u?f=${id}.${k.ext}`);
  };
}

/* ---------- Docs <-> Google Docs ---------- */
async function folder(st) {
  if (st.folderId) {
    try { const r = await (await g(DRIVE, `https://www.googleapis.com/drive/v3/files/${st.folderId}?fields=id,trashed`)).json(); if (!r.trashed) return st.folderId; } catch {}
  }
  const r = await (await g(DRIVE, "https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "rohankumar.pro Docs", mimeType: "application/vnd.google-apps.folder" }) })).json();
  return (st.folderId = r.id);
}
async function upload(fileId, name, html, parent) {
  const meta = fileId ? { name } : { name, mimeType: DOC_MIME, parents: [parent] }, bd = "rkpro" + rid();
  const body = `--${bd}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${bd}\r\ncontent-type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${bd}--`;
  const url = `https://www.googleapis.com/upload/drive/v3/files${fileId ? "/" + fileId : ""}?uploadType=multipart&fields=id,modifiedTime`;
  return (await g(DRIVE, url, { method: fileId ? "PATCH" : "POST", headers: { "content-type": `multipart/related; boundary=${bd}` }, body })).json();
}
async function exportMd(id) {
  try { return await (await g(DRIVE, `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text%2Fmarkdown`)).text(); }
  catch (e) { if (e.status !== 400 && e.status !== 403) throw e; return (await (await g(DRIVE, `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text%2Fplain`)).text()).split(/\n/).map((x) => x.trim()).join("\n\n"); }
}

async function syncDocs(store, st, out, until) {
  st.docs = st.docs || {};
  const fid = await folder(st);
  const all = await loadIndex(store), pages = all.filter((m) => !m.trashed && m.kind !== "db");
  const q = encodeURIComponent(`'${fid}' in parents and trashed = false and mimeType = '${DOC_MIME}'`);
  const files = (await (await g(DRIVE, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=1000`)).json()).files || [];
  const byId = new Map(files.map((f) => [f.id, f])), linked = new Set();
  const saveImg = imageSaver(store, st);
  for (const m of pages) {
    if (Date.now() > until) { out.more = true; break; }
    const map = st.docs[m.id];
    if (map) linked.add(map.f);
    const f = map && byId.get(map.f);
    if (map && !f) { delete st.docs[m.id]; st.docsOff = [...new Set([...(st.docsOff || []), m.id])].slice(-2000); out.unlinked++; continue; } // gone from Google (or moved out of the folder): the site page stays, it just stops syncing
    if (!map && (st.docsOff || []).includes(m.id)) continue; // removed on Google once: not sent back
    const siteMaybe = !map || (m.updated || 0) > (map.su || 0), gChanged = f && Date.parse(f.modifiedTime) > (map.gm || 0);
    let page = null, sh = map && map.sh;
    if (siteMaybe) { page = (await store.get(pageKey(m.id), { type: "json" })) || { blocks: [] }; sh = hash((m.title || "") + JSON.stringify(page.blocks || [])); }
    const siteChanged = !map || sh !== map.sh;
    if (!siteChanged && !gChanged) { if (map && siteMaybe) map.su = m.updated; continue; }
    if (gChanged && (!siteChanged || Date.parse(f.modifiedTime) > (m.updated || 0))) {
      const blocks = await mdToBlocksG(await exportMd(f.id), saveImg);
      const r = await updatePage(store, m.id, { blocks, title: f.name, force: true });
      if (r && r.meta) { const nb = r.blocks || blocks; st.docs[m.id] = { f: f.id, gm: Date.parse(f.modifiedTime), su: r.meta.updated, sh: hash((r.meta.title || "") + JSON.stringify(nb)) }; out.pulled++; }
      continue;
    }
    const r = await upload(map && map.f, m.title || "Untitled", toHtml(page.blocks), fid);
    st.docs[m.id] = { f: r.id, gm: Date.parse(r.modifiedTime) || Date.now(), su: m.updated || 0, sh }; linked.add(r.id); out.pushed++;
  }
  // new Google Docs in the folder become new private pages
  for (const f of files) {
    if (out.more || Date.now() > until) { out.more = true; break; }
    if (linked.has(f.id) || Object.values(st.docs).some((x) => x.f === f.id)) continue;
    const blocks = await mdToBlocksG(await exportMd(f.id), saveImg);
    const r = await createPage(store, { title: f.name, blocks });
    st.docs[r.meta.id] = { f: f.id, gm: Date.parse(f.modifiedTime), su: r.meta.updated, sh: hash((r.meta.title || "") + JSON.stringify(r.blocks)) }; out.created++;
  }
}

/* ---------- Notes <-> Google Keep ---------- */
const NOTE_RE = /^[\w-]{3,16}$/;
function keepBody(n) {
  if (n.kind !== "list") return { text: { text: String(n.text || "").slice(0, 19000) } };
  const out = [];
  for (const i of (n.items || []).slice(0, 1000)) {
    const it = { text: { text: String(i.t || "").slice(0, 1000) }, checked: !!i.d };
    if (i.ind && out.length) (out[out.length - 1].childListItems ||= []).push(it); else out.push(it);
  }
  return { list: { listItems: out } };
}
const noteHash = (n) => hash(JSON.stringify([n.title || "", n.kind === "list" ? (n.items || []).map((i) => [i.t, !!i.d, !!i.ind]) : n.text || ""]));
function fromKeep(k, prev) {
  const n = { ...(prev || { id: rid(), color: "c0", private: true, created: Date.now() }) }; // notes that come from Keep start private
  n.title = String(k.title || "").slice(0, 120);
  if (k.body && k.body.list) {
    const flat = []; const walk = (l, ind) => (l || []).forEach((x) => { flat.push({ id: rid(), t: String(x.text?.text || "").slice(0, 300), ...(x.checked ? { d: true } : {}), ...(ind ? { ind: 1 } : {}) }); walk(x.childListItems, 1); });
    walk(k.body.list.listItems, 0); n.kind = "list"; n.items = flat; n.text = flat.map((x) => x.t).join("\n"); delete n.blocks;
  } else {
    const text = String(k.body?.text?.text || ""); n.text = text; delete n.kind; delete n.items;
    n.blocks = text ? text.split("\n").map((x) => ({ id: rid(), t: "p", h: esc(x) })) : [];
  }
  n.ts = Date.parse(k.updateTime) || Date.now();
  return n;
}
async function syncKeep(store, st, out, until) {
  st.keep = st.keep || {};
  const notes = (await store.get("notes", { type: "json" })) ?? [];
  const ids = new Set(notes.map((n) => n.id));
  for (const id of Object.keys(st.keep)) if (!ids.has(id)) delete st.keep[id]; // a note gone from the site comes back from Keep instead of being lost
  let list = [], pt = "";
  do { const r = await (await g(KEEP, `https://keep.googleapis.com/v1/notes?pageSize=100&filter=${encodeURIComponent("trashed=false")}${pt ? "&pageToken=" + pt : ""}`)).json(); list = list.concat(r.notes || []); pt = r.nextPageToken || ""; } while (pt && list.length < 2000);
  const byName = new Map(list.map((k) => [k.name, k])), linked = new Set();
  let changed = false;
  for (let i = 0; i < notes.length; i++) {
    if (Date.now() > until) { out.more = true; break; }
    const n = notes[i], map = st.keep[n.id];
    if (!NOTE_RE.test(n.id || "")) continue;
    if (n.trashed || n.archived) { if (map) linked.add(map.k); continue; } // the bin and the archive stay on the site
    const k = map && byName.get(map.k);
    if (map) linked.add(map.k);
    if (map && !k) { delete st.keep[n.id]; st.keepOff = [...new Set([...(st.keepOff || []), n.id])].slice(-2000); out.unlinked++; continue; } // deleted in Keep: stays on the site, not sent back
    if (!map && (st.keepOff || []).includes(n.id)) continue;
    const sh = noteHash(n), siteChanged = !map || sh !== map.sh, kChanged = k && Date.parse(k.updateTime) > (map.ku || 0);
    if (!siteChanged && !kChanged) continue;
    // a site copy older than what Keep last had (an old window saving over a newer sync) never overwrites Keep: Keep's version comes back
    const stale = map && siteChanged && !kChanged && (n.ts || 0) < (map.ku || 0);
    if ((kChanged || stale) && (stale || !siteChanged || Date.parse(k.updateTime) > (n.ts || 0))) {
      notes[i] = fromKeep(k, n); changed = true;
      st.keep[n.id] = { k: k.name, ku: Date.parse(k.updateTime), sh: noteHash(notes[i]) }; out.pulled++; continue;
    }
    if (!(n.title || n.text || (n.items || []).length)) continue;
    // Keep can't edit a note in place, so a changed note is replaced with a fresh copy
    const made = await (await g(KEEP, "https://keep.googleapis.com/v1/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: String(n.title || "").slice(0, 990), body: keepBody(n) }) })).json();
    if (map) { try { await g(KEEP, `https://keep.googleapis.com/v1/${map.k}`, { method: "DELETE" }); } catch {} }
    st.keep[n.id] = { k: made.name, ku: Date.parse(made.updateTime) || Date.now(), sh }; linked.add(made.name); out.pushed++;
  }
  for (const k of list) {
    if (out.more || Date.now() > until) { out.more = true; break; }
    if (linked.has(k.name) || Object.values(st.keep).some((x) => x.k === k.name)) continue;
    const n = fromKeep(k); notes.unshift(n); changed = true;
    st.keep[n.id] = { k: k.name, ku: Date.parse(k.updateTime), sh: noteHash(n) }; out.created++;
  }
  if (changed) await saveJSON(store, "notes", cleanNotes(notes));
}

/* ---------- one run ---------- */
export async function runSync(store, { budgetMs = 20000 } = {}) {
  if (!configured()) return { ok: false, error: "not-configured" };
  const lock = await store.get(LOCK, { type: "json" }).catch(() => null);
  if (lock && Date.now() - lock.ts < 60_000) return { ok: false, error: "busy" };
  await store.setJSON(LOCK, { ts: Date.now() });
  const st = (await store.get(STATE, { type: "json" })) ?? {};
  const until = Date.now() + budgetMs, res = { ts: Date.now(), docs: null, keep: null };
  try {
    if (st.docsOn === true) { const o = { pushed: 0, pulled: 0, created: 0, unlinked: 0 }; try { await syncDocs(store, st, o, until); } catch (e) { o.error = String(e.message || e).slice(0, 400); } res.docs = o; }
    if (st.keepOn !== false) { const o = { pushed: 0, pulled: 0, created: 0, unlinked: 0 }; try { await syncKeep(store, st, o, until); } catch (e) { o.error = String(e.message || e).slice(0, 400); } res.keep = o; }
    st.last = res; st.log = [res, ...(st.log || [])].slice(0, 20);
    await store.setJSON(STATE, st);
    return { ok: true, ...res };
  } finally { await store.delete(LOCK).catch(() => {}); }
}
export async function status(store) {
  const st = (await store.get(STATE, { type: "json" })) ?? {};
  return { configured: configured(), user: configured() ? user() : "", docsOn: st.docsOn === true, keepOn: st.keepOn !== false, folderId: st.folderId || "", last: st.last || null, linkedDocs: Object.keys(st.docs || {}).length, linkedNotes: Object.keys(st.keep || {}).length };
}
export async function setOptions(store, o) {
  const st = (await store.get(STATE, { type: "json" })) ?? {};
  if (typeof o.docsOn === "boolean") st.docsOn = o.docsOn;
  if (typeof o.keepOn === "boolean") st.keepOn = o.keepOn;
  await store.setJSON(STATE, st);
}

/* ---------- for Calendar and Gmail (netlify/lib/gapi.mjs): the same service account, other scopes ---------- */
export const saUser = () => (configured() ? user() : "");
export const saToken = (scope) => token(scope);

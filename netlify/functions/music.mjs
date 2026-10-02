// /api/music?url=<a YouTube or Spotify link>   Owner only. Turns a pasted link into one record for the music corner:
// what it is (YouTube video or playlist, Spotify track, album, playlist or episode), its title, who made it and a cover.
// It only reads the public oEmbed address of each service. Nothing is stored here: the app saves the result with the site settings.
import { isAdmin, json } from "../lib/session.mjs";

export const parse = (u) => {
  const s = String(u || "").trim();
  let m;
  // Spotify: web links and spotify: URIs
  if ((m = s.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]{22})/i))) return { k: "s", type: m[1].toLowerCase(), id: m[2], url: `https://open.spotify.com/${m[1].toLowerCase()}/${m[2]}` };
  if ((m = s.match(/^spotify:(track|album|playlist|episode|show):([A-Za-z0-9]{22})$/i))) return { k: "s", type: m[1].toLowerCase(), id: m[2], url: `https://open.spotify.com/${m[1].toLowerCase()}/${m[2]}` };
  // YouTube and YouTube Music: a video, or a playlist
  if (/^https?:\/\/(?:www\.|m\.|music\.)?youtube(?:-nocookie)?\.com\//i.test(s) || /^https?:\/\/youtu\.be\//i.test(s)) {
    const list = (s.match(/[?&]list=([\w-]{10,60})/) || [])[1];
    const vid = (s.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/) || [])[1];
    if (vid && !/[?&]list=/.test(s)) return { k: "y", type: "video", id: vid, url: `https://www.youtube.com/watch?v=${vid}` };
    if (list) return { k: "y", type: "playlist", id: list, url: `https://www.youtube.com/playlist?list=${list}`, vid };
    if (vid) return { k: "y", type: "video", id: vid, url: `https://www.youtube.com/watch?v=${vid}` };
  }
  if (/^[\w-]{11}$/.test(s)) return { k: "y", type: "video", id: s, url: `https://www.youtube.com/watch?v=${s}` };
  return null;
};

const oembed = async (endpoint) => {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(endpoint, { signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; rohankumar-pro)" } });
    if (!r.ok) return { status: r.status };
    return { status: 200, data: await r.json() };
  } catch { return { status: 0 }; } finally { clearTimeout(t); }
};

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return json({ error: "Method not allowed" }, 405);
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    const p = parse(event.queryStringParameters?.url);
    if (!p) return json({ error: "Paste a YouTube or Spotify link (a video, playlist, track or album)." }, 400);
    const ep = p.k === "s" ? `https://open.spotify.com/oembed?url=${encodeURIComponent(p.url)}` : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(p.url)}`;
    const r = await oembed(ep);
    if (r.status === 404 || r.status === 401 || r.status === 403) return json({ error: "That one is private, removed or can't be played on other sites." }, 404);
    const d = r.data || {};
    const thumb = p.k === "y" ? (p.type === "video" ? `https://i.ytimg.com/vi/${p.id}/mqdefault.jpg` : String(d.thumbnail_url || "")) : String(d.thumbnail_url || "");
    return json({ k: p.k, type: p.type, id: p.id, title: String(d.title || "").slice(0, 100), artist: String(p.k === "y" ? d.author_name || "" : "").slice(0, 80), thumb, manual: !d.title });
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};

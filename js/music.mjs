// The music corner: a cosy record player on the desktop.
// The owner picks a few records (YouTube videos or playlists, Spotify tracks, albums or playlists). Anyone who visits can pick one and
// press play; the music keeps going while windows open and close, and a small player in the top bar controls it.
// Browsers only allow sound after a tap, so nothing plays until someone presses play.
import { h, $, $$, esc, api, isAdmin, toast, confirmBox } from "/js/lib.mjs";

const host = document.getElementById("musicW");
const COLORS = ["#E4572E", "#F3A712", "#6C9A8B", "#C97B84", "#5B7DB1", "#8E6C8A", "#D98E04", "#4F8A6D"];
const hash = (s) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
const colorOf = (t) => COLORS[hash(t.id) % COLORS.length];
const thumbOf = (t) => t.thumb || (t.k === "y" && t.type === "video" ? `https://i.ytimg.com/vi/${t.id}/mqdefault.jpg` : "");
const M = { tracks: [], i: -1, playing: false, loading: false, vol: 80, yt: null, sp: null, spReady: null, ytReady: null, video: false, editing: false };
const ic = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6.2v11.6a.9.9 0 0 0 1.4.7l8.3-5.8a.9.9 0 0 0 0-1.4L7.4 5.5A.9.9 0 0 0 6 6.2zM17 6v12" /><rect x="16.2" y="5.5" width="2.2" height="13" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 6.2v11.6a.9.9 0 0 1-1.4.7l-8.3-5.8a.9.9 0 0 1 0-1.4l8.3-5.8A.9.9 0 0 1 18 6.2z"/><rect x="5.6" y="5.5" width="2.2" height="13" rx="1"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
const SCENE = `<svg class="mu-svg" viewBox="0 0 240 112" aria-hidden="true">
  <defs><radialGradient id="mu-gl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFC46B" stop-opacity=".95"/><stop offset="1" stop-color="#FFC46B" stop-opacity="0"/></radialGradient></defs>
  <circle class="mu-glow" cx="30" cy="40" r="56" fill="url(#mu-gl)"/>
  <path d="M30 40v40" stroke="#8A6240" stroke-width="3" stroke-linecap="round"/><ellipse cx="30" cy="84" rx="11" ry="3.5" fill="#7C5636"/>
  <path d="M17 38 22 18h16l5 20z" fill="#F2B45E"/><path d="M17 38h26" stroke="#D9923B" stroke-width="2"/>
  <rect x="6" y="90" width="228" height="12" rx="5" fill="#B07A47"/><rect x="6" y="97" width="228" height="6" rx="3" fill="#8D5E34"/>
  <rect x="60" y="34" width="156" height="56" rx="11" fill="#EBD7B7"/><rect x="60" y="34" width="156" height="56" rx="11" fill="none" stroke="#B88A55" stroke-width="2"/>
  <g class="mu-spin" style="transform-origin:112px 62px"><circle cx="112" cy="62" r="25" fill="#231F1E"/><circle cx="112" cy="62" r="21" fill="none" stroke="#3B3534" stroke-width="1"/><circle cx="112" cy="62" r="17" fill="none" stroke="#3B3534" stroke-width="1"/><circle cx="112" cy="62" r="13" fill="none" stroke="#3B3534" stroke-width="1"/>
    <path d="M112 38a24 24 0 0 1 17 7" stroke="#fff" stroke-opacity=".16" stroke-width="3" fill="none" stroke-linecap="round"/><circle class="mu-label" cx="112" cy="62" r="8.5" fill="var(--mu-c,#E4572E)"/><circle cx="112" cy="62" r="1.8" fill="#fff"/></g>
  <g class="mu-arm" style="transform-origin:196px 46px"><path d="M196 46 148 64" stroke="#9AA0A6" stroke-width="3.2" stroke-linecap="round"/><rect x="138" y="62" width="14" height="7" rx="2.5" transform="rotate(-18 145 65.5)" fill="#5B6168"/><circle cx="196" cy="46" r="6" fill="#CDD1D5"/><circle cx="196" cy="46" r="2.4" fill="#8A8F96"/></g>
  <circle cx="198" cy="76" r="3.4" fill="#B88A55"/><rect x="186" y="70" width="6" height="12" rx="3" fill="#C99A62"/>
  <g class="mu-notes" fill="#D9822B"><path class="n1" d="M150 30v-9l7-2v9" stroke="#D9822B" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse class="n1" cx="148.2" cy="30.5" rx="2.6" ry="2" /><ellipse class="n1" cx="155.2" cy="28.5" rx="2.6" ry="2"/>
    <path class="n2" d="M176 26v-8l6-1.6v8" stroke="#D9822B" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse class="n2" cx="174.2" cy="26.4" rx="2.3" ry="1.8"/><ellipse class="n2" cx="180.2" cy="24.8" rx="2.3" ry="1.8"/></g>
</svg>`;

/* ---------------- sources ---------------- */
const loadYT = () => M.ytReady || (M.ytReady = new Promise((res) => {
  if (window.YT && window.YT.Player) return res(true);
  const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { try { prev && prev(); } catch {} res(true); };
  const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true; s.onerror = () => res(false); document.head.appendChild(s); setTimeout(() => res(!!(window.YT && window.YT.Player)), 9000);
}));
const loadSP = () => M.spReady || (M.spReady = new Promise((res) => {
  if (window.__SPAPI) return res(window.__SPAPI);
  window.onSpotifyIframeApiReady = (api) => { window.__SPAPI = api; res(api); };
  const s = document.createElement("script"); s.src = "https://open.spotify.com/embed/iframe-api/v1"; s.async = true; s.onerror = () => res(null); document.head.appendChild(s); setTimeout(() => res(window.__SPAPI || null), 9000);
}));
const cur = () => M.tracks[M.i] || null;

function stopOthers(kind) {
  try { if (kind !== "y" && M.yt && M.yt.pauseVideo) M.yt.pauseVideo(); } catch {}
  try { if (kind !== "s" && M.sp && M.sp.pause) M.sp.pause(); } catch {}
}
async function startYT(t) {
  stopOthers("y");
  const ok = await loadYT(); if (!ok) { fail("YouTube could not load. Check your connection."); return; }
  const el = $(".mu-yt-in", ENG); if (!el) return;
  const vars = { autoplay: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1, iv_load_policy: 3, fs: 0 };
  if (!M.yt) {
    M.yt = new window.YT.Player(el, { width: "100%", height: "100%", videoId: t.type === "video" ? t.id : undefined, playerVars: t.type === "playlist" ? { ...vars, listType: "playlist", list: t.id } : vars,
      events: { onReady: (e) => { try { e.target.setVolume(M.vol); e.target.playVideo(); } catch {} }, onStateChange: onYT, onError: onYTError } });
  } else {
    try { M.yt.setVolume(M.vol); if (t.type === "video") M.yt.loadVideoById(t.id); else M.yt.loadPlaylist({ listType: "playlist", list: t.id }); M.yt.playVideo(); } catch { fail("That record could not start."); }
  }
}
function onYT(e) {
  const S = window.YT && window.YT.PlayerState; if (!S) return;
  if (e.data === S.PLAYING) { M.loading = false; M.playing = true; }
  else if (e.data === S.PAUSED) { M.playing = false; }
  else if (e.data === S.BUFFERING) { M.loading = true; }
  else if (e.data === S.ENDED) { if (cur() && cur().type === "video") return next(true); M.playing = false; }
  paint();
}
function onYTError() { toast("That one can't be played here. Trying the next record."); M.playing = false; M.loading = false; paint(); setTimeout(() => next(true), 900); }
async function startSP(t) {
  stopOthers("s");
  const api = await loadSP(); if (!api) { fail("Spotify could not load. Check your connection."); return; }
  const uri = `spotify:${t.type}:${t.id}`, el = $(".mu-sp-in", ENG); if (!el) return;
  if (!M.sp) {
    api.createController(el, { uri, width: "100%", height: 80 }, (c) => {
      M.sp = c;
      c.addListener("ready", () => { try { c.play(); } catch {} });
      c.addListener("playback_update", (e) => { const d = e.data || {}; M.playing = !d.isPaused && !d.isBuffering ? true : (!d.isPaused); M.loading = !!d.isBuffering; M.pos = (d.position || 0) / 1000; M.dur = (d.duration || 0) / 1000; paint(); });
    });
  } else { try { M.sp.loadUri(uri); M.sp.play(); } catch {} }
  setTimeout(() => { if (!M.playing && cur() === t) toast("Press play inside the Spotify player to start."); }, 2600);
}
function fail(msg) { M.loading = false; M.playing = false; toast(msg); paint(); }

/* ---------------- controls ---------------- */
function play(i) {
  const t = M.tracks[i]; if (!t) return;
  if (i === M.i && (M.playing || M.loading)) return;
  if (i === M.i && !M.playing && ((t.k === "y" && M.yt) || (t.k === "s" && M.sp))) return resume();
  M.i = i; M.loading = true; M.playing = false; M.pos = 0; M.dur = 0; paint();
  if (t.k === "y") startYT(t); else startSP(t);
}
function resume() { const t = cur(); if (!t) return; try { if (t.k === "y") { stopOthers("y"); M.yt.playVideo(); } else { stopOthers("s"); M.sp.resume ? M.sp.resume() : M.sp.play(); } } catch {} }
function pause() { try { if (M.yt && M.yt.pauseVideo) M.yt.pauseVideo(); } catch {} try { if (M.sp && M.sp.pause) M.sp.pause(); } catch {} M.playing = false; paint(); }
function toggle() { if (!M.tracks.length) return; if (M.i < 0) return play(0); if (M.playing || M.loading) pause(); else { const t = cur(); if ((t.k === "y" && M.yt) || (t.k === "s" && M.sp)) resume(); else { const i = M.i; M.i = -1; play(i); } } }
function next(auto) { if (!M.tracks.length) return; const i = M.i < 0 ? 0 : (M.i + 1) % M.tracks.length; if (auto && M.tracks.length === 1) { M.playing = false; return paint(); } const was = M.i; M.i = -1; play(i); if (was === i) paint(); }
function prev() { if (!M.tracks.length) return; const i = M.i <= 0 ? M.tracks.length - 1 : M.i - 1; M.i = -1; play(i); }

/* ---------------- drawing ---------------- */
/* The players themselves (YouTube's hidden one, Spotify's small strip) live in one place of their own, so the corner and the
   Music app can both be controls for the same music without either one owning the sound. */
const ENG = h("div", { id: "muEngine", class: "mu-engine", hidden: true });
ENG.innerHTML = '<div class="mu-yt"><div class="mu-yt-in"></div></div><div class="mu-sp" hidden><div class="mu-sp-in"></div></div>';
(document.getElementById("desk") || document.body).append(ENG);
M.boxes = []; M.pos = 0; M.dur = 0;
const fmt = (n) => { n = Math.max(0, Math.round(n || 0)); const m = Math.floor(n / 60), s = n % 60; return m + ":" + String(s).padStart(2, "0"); };
function makeBox(kind) {
  const box = h("div", { class: "mu mu-" + kind, "data-s": "idle" });
  box.innerHTML = `<div class="mu-mini" role="group" aria-label="Music corner"><span class="mu-disc"></span><span class="mu-mt"><b></b><small></small></span><button class="mu-mp" aria-label="Play or pause"></button></div>
    <div class="mu-full"><div class="mu-head"><b>${kind === "app" ? "Music" : "Music corner"}</b><span class="mu-eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="sp"></span><button class="mu-vid" aria-label="Show the video" title="Show the video" hidden>${ic.video}</button><button class="mu-manage" aria-label="Manage records" title="Manage records" hidden>${ic.gear}</button></div>
      <div class="mu-scene">${SCENE}</div>
      <div class="mu-now"><b class="mu-t"></b><small class="mu-a"></small></div>
      <div class="mu-seek"><span class="mu-tc">0:00</span><input class="mu-sk" type="range" min="0" max="100" step="1" value="0" aria-label="Position in the song" disabled><span class="mu-td">0:00</span></div>
      <div class="mu-ctl"><button class="mu-b" data-a="prev" aria-label="Previous record">${ic.prev}</button><button class="mu-b mu-big" data-a="toggle" aria-label="Play or pause"></button><button class="mu-b" data-a="next" aria-label="Next record">${ic.next}</button><input class="mu-vol" type="range" min="0" max="100" value="${M.vol}" aria-label="Volume"></div>
      <div class="mu-shelf" role="list" aria-label="Records"></div>
      <div class="mu-empty" hidden></div></div>`;
  $(".mu-mp", box).onclick = (e) => { e.stopPropagation(); toggle(); };
  $("[data-a=toggle]", box).onclick = toggle; $("[data-a=next]", box).onclick = () => next(false); $("[data-a=prev]", box).onclick = prev;
  const vol = $(".mu-vol", box); vol.onpointerdown = (e) => e.stopPropagation(); vol.style.setProperty("--p", M.vol + "%");
  vol.oninput = () => { M.vol = +vol.value; $$(".mu-vol").forEach((v) => { v.value = vol.value; v.style.setProperty("--p", vol.value + "%"); }); try { M.yt && M.yt.setVolume(M.vol); } catch {} };
  const sk = $(".mu-sk", box), tc = $(".mu-tc", box);
  sk.onpointerdown = (e) => { e.stopPropagation(); box.__seeking = true; };
  sk.oninput = () => { box.__seeking = true; tc.textContent = fmt(+sk.value); };
  sk.onchange = () => { seekTo(+sk.value); box.__seeking = false; };
  sk.onpointerup = sk.onpointercancel = () => setTimeout(() => (box.__seeking = false), 50);
  $(".mu-vid", box).onclick = () => { M.video = !M.video; paint(); };
  $(".mu-manage", box).onclick = manage;
  M.boxes.push(box); shelf(box); paintBox(box);
  return box;
}
function build() {
  const ctl = $(".mw-ctl", host);
  host.classList.add("mu-host");
  host.innerHTML = ""; if (ctl) host.appendChild(ctl);
  host.appendChild(makeBox("widget"));
}
function seekTo(v) {
  const t = cur(); if (!t) return; M.pos = v;
  try { if (t.k === "y" && M.yt && M.yt.seekTo) M.yt.seekTo(v, true); else if (t.k === "s" && M.sp && M.sp.seek) M.sp.seek(v); } catch {}
}
function seekPaint(box) {
  if (box.__seeking) return; const sk = $(".mu-sk", box); if (!sk) return;
  const on = M.dur > 0 && cur(); sk.disabled = !on; sk.max = on ? Math.floor(M.dur) : 100; sk.value = on ? Math.min(M.pos, M.dur) : 0;
  sk.style.setProperty("--p", on ? Math.min(100, (M.pos / M.dur) * 100) + "%" : "0%");
  $(".mu-tc", box).textContent = fmt(on ? M.pos : 0); $(".mu-td", box).textContent = on ? fmt(M.dur) : "0:00";
}
setInterval(() => {
  if (!M.playing && !M.loading) return;
  const t = cur(); try { if (t && t.k === "y" && M.yt && M.yt.getCurrentTime) { M.pos = M.yt.getCurrentTime() || 0; M.dur = M.yt.getDuration() || 0; } } catch {}
  M.boxes.forEach((b) => b.isConnected && seekPaint(b));
}, 500);
function shelf(only) {
  (only ? [only] : M.boxes).forEach((box) => {
    const sh = $(".mu-shelf", box); if (!sh) return;
    sh.innerHTML = M.tracks.map((t, i) => {
      const th = thumbOf(t), c = colorOf(t);
      return `<button class="mu-rec${i === M.i ? " on" : ""}" role="listitem" data-i="${i}" style="--mu-c:${c}" title="${esc(t.title || "Record")}${t.artist ? " — " + esc(t.artist) : ""}" aria-label="Play ${esc(t.title || "record")}"><span class="mu-vinyl"></span><span class="mu-sleeve">${th ? `<img src="${esc(th)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<b>${esc((t.title || "?").trim().slice(0, 1).toUpperCase())}</b>`}</span></button>`;
    }).join("");
    $$(".mu-rec", sh).forEach((b) => (b.onclick = () => { const i = +b.dataset.i; if (i === M.i && (M.playing || M.loading)) pause(); else play(i); }));
  });
}
function paint(full) { M.boxes = M.boxes.filter((b) => b.isConnected || !b.parentNode); M.boxes.forEach((b) => paintBox(b)); if (full) shelf(); engine(); pill(); session(); }
function engine() {
  const t = cur(), isY = t && t.k === "y", isS = t && t.k === "s";
  ENG.hidden = !(isS || (isY && M.video)); ENG.classList.toggle("showvid", !!(isY && M.video));
  $(".mu-sp", ENG).hidden = !isS;
}
function paintBox(box) {
  const t = cur(), state = M.loading ? "loading" : M.playing ? "playing" : "idle";
  box.dataset.s = state; const hostEl = box.closest(".mu-host"); if (hostEl) hostEl.classList.toggle("mu-on", state === "playing");
  box.style.setProperty("--mu-c", t ? colorOf(t) : COLORS[0]);
  const title = t ? (t.title || "Untitled") : M.tracks.length ? "Pick a record" : "The shelf is empty", artist = t ? (t.artist || (t.k === "s" ? "Spotify" : "YouTube")) : M.tracks.length ? "Tap one below to play" : (isAdmin() ? "Add records with the settings button" : "Nothing to play yet");
  $(".mu-t", box).textContent = title; $(".mu-a", box).textContent = artist; $(".mu-mt b", box).textContent = title; $(".mu-mt small", box).textContent = artist;
  const pp = state === "idle" ? ic.play : ic.pause; $(".mu-mp", box).innerHTML = pp; $("[data-a=toggle]", box).innerHTML = pp;
  $("[data-a=toggle]", box).setAttribute("aria-label", state === "idle" ? "Play" : "Pause");
  $$(".mu-rec", box).forEach((b) => b.classList.toggle("on", +b.dataset.i === M.i));
  const isY = t && t.k === "y";
  $(".mu-vol", box).hidden = !isY; $(".mu-vid", box).hidden = !isY || box.classList.contains("mu-widget"); $(".mu-vid", box).classList.toggle("on", M.video);
  $(".mu-manage", box).hidden = !isAdmin();
  seekPaint(box);
  const em = $(".mu-empty", box);
  if (!M.tracks.length) { em.hidden = false; const P0 = window.P && P.music; em.innerHTML = `<p>${isAdmin() ? "Pick a few records for your visitors." : "The owner hasn't put any records out yet."}</p>${isAdmin() ? '<button class="btn mu-addfirst">Add records</button>' : (P0 ? `<span class="mu-ext"><a href="${esc(P0.youtubeMusic)}" target="_blank" rel="noopener">YouTube Music</a><a href="${esc(P0.spotify)}" target="_blank" rel="noopener">Spotify</a></span>` : "")}`; $(".mu-addfirst", em)?.addEventListener("click", manage); } else em.hidden = true;
}

/* the small player in the top bar, so the music stays in reach while windows cover the corner */
function pill() {
  let p = document.getElementById("musicPill"); const on = M.playing || M.loading;
  if (!p) { const tb = document.querySelector(".topbar"); if (!tb) return; p = h("button", { class: "pill topbtn musicpill", id: "musicPill", onclick: toggle, "aria-label": "Pause or play the music" }); tb.insertBefore(p, tb.lastElementChild); }
  const t = cur(); p.hidden = !(t && (on || M.playing));
  p.innerHTML = `<span class="mu-eq on" aria-hidden="true"><i></i><i></i><i></i></span><span class="mp-t">${esc(t ? t.title || "Music" : "")}</span><span class="mp-i">${on ? ic.pause : ic.play}</span>`;
  p.title = on ? "Pause the music" : "Play the music";
}
function session() {
  const t = cur(); if (!("mediaSession" in navigator) || !t) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title || "Music", artist: t.artist || "", album: "Music corner", artwork: thumbOf(t) ? [{ src: thumbOf(t), sizes: "320x180" }] : [] });
    navigator.mediaSession.playbackState = M.playing ? "playing" : "paused";
    navigator.mediaSession.setActionHandler("play", () => toggle()); navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => next(false)); navigator.mediaSession.setActionHandler("previoustrack", () => prev());
  } catch {}
}

/* ---------------- the owner's shelf ---------------- */
const S = () => (window.SITE.s = window.SITE.s || { hiddenApps: [] });
const saved = () => { const s = S(); s.music = s.music && Array.isArray(s.music.tracks) ? s.music : { tracks: [] }; return s.music.tracks; };
function manage() {
  if (!isAdmin()) return;
  const d = h("div", { class: "own-dlg mu-dlg" }), tracks = saved();
  const draw = () => {
    d.innerHTML = `<div class="own-card mu-man" role="dialog" aria-modal="true" aria-label="Music corner"><div class="mu-man-h"><b>Music corner</b><button class="mu-x" aria-label="Close">${ic.x}</button></div>
      <p class="hint">Pick a few records. Visitors can choose any of them and press play. Paste a YouTube video or playlist, or a Spotify track, album or playlist.</p>
      <form class="mu-add"><input type="text" placeholder="Paste a YouTube or Spotify link" aria-label="Link" inputmode="url" autocomplete="off"><button class="btn" type="submit">Add</button></form><p class="hint mu-st" aria-live="polite"></p>
      <div class="mu-list">${tracks.map((t, i) => `<div class="mu-row" data-i="${i}"><span class="mu-th" style="--mu-c:${colorOf(t)}">${thumbOf(t) ? `<img src="${esc(thumbOf(t))}" alt="" referrerpolicy="no-referrer">` : "<i></i>"}</span><div class="mu-ed"><input data-f="title" value="${esc(t.title)}" maxlength="100" placeholder="Title" aria-label="Title"><input data-f="artist" value="${esc(t.artist || "")}" maxlength="80" placeholder="Artist" aria-label="Artist"></div><small>${t.k === "s" ? "Spotify" : t.type === "playlist" ? "YouTube playlist" : "YouTube"}</small><span class="mu-rb"><button data-a="up" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button data-a="dn" aria-label="Move down" ${i === tracks.length - 1 ? "disabled" : ""}>↓</button><button data-a="rm" class="danger" aria-label="Remove">${ic.x}</button></span></div>`).join("") || '<p class="hint">No records yet.</p>'}</div>
      <div class="own-row"><button class="btn mu-done">Done</button></div></div>`;
    $(".mu-x", d).onclick = $(".mu-done", d).onclick = () => { d.remove(); refresh(); };
    const st = $(".mu-st", d);
    $(".mu-add", d).onsubmit = async (e) => {
      e.preventDefault(); const inp = $("input", e.target), u = inp.value.trim(); if (!u) return; st.textContent = "Looking it up…";
      const r = await api("/api/music?url=" + encodeURIComponent(u));
      if (r.status === 401) { st.textContent = "You are signed out. Sign in again."; return; }
      if (!r.ok) { st.textContent = r.data.error || "Could not read that link."; return; }
      const x = r.data; if (tracks.some((t) => t.id === x.id && t.k === x.k)) { st.textContent = "That one is already on the shelf."; return; }
      tracks.push({ k: x.k, id: x.id, type: x.type, title: x.title, artist: x.artist, ...(x.thumb ? { thumb: x.thumb } : {}) }); persist(); draw();
      $(".mu-st", d).textContent = x.manual ? "Added. It did not share a title, so type one." : "Added to the shelf.";
    };
    $$(".mu-row", d).forEach((row) => {
      const i = +row.dataset.i, t = tracks[i];
      $$("input[data-f]", row).forEach((el) => (el.oninput = () => { t[el.dataset.f] = el.value; persist(true); }));
      $$("[data-a]", row).forEach((b) => (b.onclick = async () => {
        const a = b.dataset.a;
        if (a === "rm") { if (!(await confirmBox("Take this record off the shelf?", "Remove"))) return; tracks.splice(i, 1); }
        else if (a === "up" && i > 0) [tracks[i - 1], tracks[i]] = [tracks[i], tracks[i - 1]];
        else if (a === "dn" && i < tracks.length - 1) [tracks[i + 1], tracks[i]] = [tracks[i], tracks[i + 1]];
        persist(); draw();
      }));
    });
  };
  let t0 = null;
  function persist(soft) { S().music = { tracks }; clearTimeout(t0); t0 = setTimeout(() => window.siteSave && window.siteSave(), soft ? 700 : 0); }
  d.addEventListener("pointerdown", (e) => { if (e.target === d) { d.remove(); refresh(); } }); d.addEventListener("keydown", (e) => { if (e.key === "Escape") { d.remove(); refresh(); } });
  document.body.append(d); draw(); $(".mu-add input", d)?.focus();
}

function refresh() {
  const prevId = cur() && cur().id, list = (window.SITE && SITE.s && SITE.s.music && SITE.s.music.tracks) || [];
  M.tracks = list.map((t) => ({ ...t }));
  const at = prevId ? M.tracks.findIndex((t) => t.id === prevId) : -1;
  if (prevId && at < 0) { try { M.yt && M.yt.stopVideo && M.yt.stopVideo(); M.sp && M.sp.pause && M.sp.pause(); } catch {} M.playing = false; M.loading = false; }
  M.i = at;
  if (M.boxes.length) { shelf(); paint(); }
}
window.__musicRefresh = refresh;
window.musicCtx = () => {
  const t = cur(), o = [];
  if (M.tracks.length) o.push([M.playing || M.loading ? "Pause the music" : t ? "Play the music" : "Play the first record", toggle], ["Next record", () => next(false)]);
  if (isAdmin()) o.push(["Manage the records", manage]);
  o.push(["Hide the music corner", () => { pause(); const d = document.getElementById("desk"); d.dataset.music = "off"; window.save && window.save(); }]);
  return o;
};
function musicApp(body) {
  body.innerHTML = ""; const wrap = h("div", { class: "mu-host mu-appwrap" }); wrap.appendChild(makeBox("app")); body.appendChild(wrap);
  paint(true);
}
if (typeof APPS !== "undefined" && !APPS.some((a) => a.id === "music")) {
  APPS.push({ id: "music", title: "Music", shape: "clover", color: "c2", glyph: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/>', w: 400, h: 680, render: musicApp });
  try { window.renderIcons && renderIcons(); } catch {}
}
window.Music = { toggle, play, pause, next, prev, tracks: () => M.tracks, state: () => ({ playing: M.playing, track: cur() }) };

if (host) {
  build(); refresh();
  new MutationObserver(() => { if (document.getElementById("desk").dataset.music === "off" && !M.boxes.some((b) => b.isConnected && b.closest(".win"))) pause(); }).observe(document.getElementById("desk"), { attributes: true, attributeFilter: ["data-music"] });
}

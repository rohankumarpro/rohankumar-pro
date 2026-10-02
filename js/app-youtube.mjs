// YouTube: the videos the owner picked, as small cards that link to YouTube. Nothing is embedded until someone taps "Play here".
// The owner pastes a link; the server reads the public title and channel (/api/yt) and the thumbnail comes straight from YouTube.
import { h, $, $$, esc, api, isAdmin, toast, confirmBox } from "/js/lib.mjs";
import { icon } from "/shared/icons.mjs";
import { BRANDS } from "/shared/brands.mjs";

const logo = (n = 22) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" aria-hidden="true" focusable="false"><path fill="#FF0000" d="${BRANDS.youtube.d}"/></svg>`;
const watch = (id) => `https://www.youtube.com/watch?v=${id}`;
const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const channel = () => { try { return DOC_QR.youtube.url; } catch { return "https://www.youtube.com/"; } };
const S = () => (window.SITE.s = window.SITE.s || { hiddenApps: [] });
const list = () => (S().videos = Array.isArray(S().videos) ? S().videos : []);
const I = (n, s = 16) => icon(n, { size: s });

export function youtubeApp(body) {
  body.classList.remove("jr-editing");
  let editing = null, busy = false;
  const save = () => { if (window.siteSave) siteSave(); };

  const card = (v, i, own) => {
    const open = editing === v.id;
    return `<article class="yt-card" data-id="${esc(v.id)}">
      <a class="yt-th" href="${watch(v.id)}" target="_blank" rel="noopener" aria-label="Watch ${esc(v.title || "this video")} on YouTube"><img loading="lazy" src="${thumb(v.id)}" alt=""><span class="yt-play">${I("play", 22)}</span></a>
      ${open ? `<form class="yt-ed"><input data-f="title" value="${esc(v.title)}" maxlength="140" placeholder="Title" aria-label="Title"><input data-f="note" value="${esc(v.note || "")}" maxlength="240" placeholder="A note (optional)" aria-label="Note"><div class="yt-row"><button class="btn" type="submit">Save</button><button class="btn tonal" type="button" data-a="cancel">Cancel</button></div></form>`
        : `<div class="yt-m"><b>${esc(v.title || "Untitled video")}</b>${v.author ? `<small>${esc(v.author)}</small>` : ""}${v.note ? `<p>${esc(v.note)}</p>` : ""}</div>`}
      <div class="yt-act"><button data-a="here" aria-label="Play here">${I("play", 15)}<span>Play here</span></button>
        ${own ? `<span class="yt-own"><button data-a="edit" aria-label="Edit" title="Edit">${I("pencil", 15)}</button><button data-a="up" aria-label="Move earlier" title="Move earlier" ${i === 0 ? "disabled" : ""}>${I("arrow-up", 15)}</button><button data-a="dn" aria-label="Move later" title="Move later" ${i === list().length - 1 ? "disabled" : ""}>${I("arrow-down", 15)}</button><button data-a="rm" aria-label="Remove" title="Remove" class="danger">${I("trash", 15)}</button></span>` : ""}</div></article>`;
  };

  const view = () => {
    const own = isAdmin(), vids = list();
    body.innerHTML = `<div class="yt"><header class="yt-head"><span class="yt-logo">${logo(34)}</span><div class="yt-t"><h1>YouTube</h1><p>Videos by ${esc(P.name)}.</p></div><a class="btn tonal yt-ch" href="${esc(channel())}" target="_blank" rel="noopener">${logo(16)}<span>Open channel</span></a></header>
      ${own ? `<form class="yt-add"><input type="text" placeholder="Paste a YouTube link (or several, one per line)" aria-label="YouTube link" inputmode="url" autocomplete="off"><button class="btn" type="submit">${I("plus", 16)}<span>Add</span></button></form><p class="hint yt-st" aria-live="polite"></p>` : ""}
      ${vids.length ? `<div class="yt-grid">${vids.map((v, i) => card(v, i, own)).join("")}</div>`
        : `<div class="yt-empty"><span>${logo(54)}</span><b>${own ? "Add your first video" : "Videos are coming"}</b><p>${own ? "Paste a YouTube link above. The title and thumbnail are filled in for you." : "New videos will show up here. Until then, everything is on the channel."}</p></div>`}</div>`;
    wire(own);
  };

  function wire(own) {
    const st = $(".yt-st", body), say = (t) => { if (st) st.textContent = t; };
    const form = $(".yt-add", body);
    if (form) form.onsubmit = async (e) => {
      e.preventDefault(); if (busy) return;
      const inp = $("input", form), urls = inp.value.split(/[\s,]+/).filter(Boolean);
      if (!urls.length) return;
      busy = true; $("button", form).disabled = true; let added = 0, last = null;
      for (const u of urls) {
        say(`Looking up ${urls.length > 1 ? added + 1 + " of " + urls.length : "your video"}…`);
        const r = await api("/api/yt?url=" + encodeURIComponent(u));
        if (r.status === 401) { say("You are signed out. Sign in again to add videos."); break; }
        if (!r.ok) { say(r.data.error || "Could not read that link."); continue; }
        const d = r.data;
        if (list().some((v) => v.id === d.id)) { say("That video is already here."); continue; }
        list().unshift({ id: d.id, title: d.title, author: d.author }); added++; last = d;
      }
      busy = false;
      if (added) { save(); inp.value = ""; if (last && last.manual && urls.length === 1) editing = last.id; view(); const s2 = $(".yt-st", body); if (s2) s2.textContent = added === 1 ? (last.manual ? "Added. YouTube did not share the title, so type one." : "Added.") : `Added ${added} videos.`; }
      else $("button", form).disabled = false;
    };
    $$(".yt-card", body).forEach((c) => {
      const id = c.dataset.id, v = list().find((x) => x.id === id); if (!v) return;
      $$("[data-a]", c).forEach((b) => (b.onclick = async () => {
        const a = b.dataset.a, i = list().indexOf(v);
        if (a === "here") return player(v);
        if (a === "edit") { editing = id; return view(); }
        if (a === "cancel") { editing = null; return view(); }
        if (a === "up" && i > 0) { [list()[i - 1], list()[i]] = [list()[i], list()[i - 1]]; save(); return view(); }
        if (a === "dn" && i < list().length - 1) { [list()[i + 1], list()[i]] = [list()[i], list()[i + 1]]; save(); return view(); }
        if (a === "rm") { if (await confirmBox("Remove this video from your page?", "Remove")) { list().splice(i, 1); save(); view(); } }
      }));
      const f = $(".yt-ed", c);
      if (f) { f.onsubmit = (e) => { e.preventDefault(); v.title = $("[data-f=title]", f).value.trim(); const n = $("[data-f=note]", f).value.trim(); if (n) v.note = n; else delete v.note; editing = null; save(); view(); }; setTimeout(() => $("[data-f=title]", f)?.focus(), 30); }
    });
  }

  /* a small player, loaded only when asked for. Opening it pauses the music corner. */
  function player(v) {
    $$(".yt-pl", body).forEach((x) => x.remove());
    try { window.Music && window.Music.pause && window.Music.pause(); } catch {}
    const d = h("div", { class: "yt-pl", role: "dialog", "aria-modal": "true", "aria-label": v.title || "Video player" });
    d.innerHTML = `<div class="yt-pl-card"><div class="yt-pl-bar"><b>${esc(v.title || "Video")}</b><a href="${watch(v.id)}" target="_blank" rel="noopener" class="yt-pl-yt">${logo(16)}<span>YouTube</span></a><button class="yt-pl-x" aria-label="Close player">${I("x", 18)}</button></div>
      <div class="yt-pl-fr"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="${esc(v.title || "Video")}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div></div>`;
    const close = () => d.remove();
    $(".yt-pl-x", d).onclick = close; d.addEventListener("pointerdown", (e) => { if (e.target === d) close(); }); d.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    body.append(d); $(".yt-pl-x", d).focus();
  }

  view();
}

// Owner mode, Settings > Website: how the site reads on Google and in share previews (WhatsApp, LinkedIn, X, iMessage...).
// Everything is kept in the site settings under `seo`; the server puts it into every page it sends (netlify/lib/seo.mjs).
// "Check now" fetches a page exactly as a search engine or a share preview receives it, so what is shown is what they see.
import { h, $, $$, esc, toast, shareImage } from "/js/lib.mjs";

const ok = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const warn = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9"/></svg>';
const ext = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const LIVE = "https://rohankumar.pro";

export function websiteSection() {
  const S = (window.SITE.s = window.SITE.s || { hiddenApps: [] });
  const seo = () => (S.seo = S.seo || {});
  const prof = typeof P !== "undefined" ? P : { name: "Rohan Kumar", role: "", bio: "" };
  const defTitle = `${prof.name} — ${prof.role}`, defDesc = String(prof.bio || "").replace(/\s+/g, " ").trim();
  const preview = /--|^localhost|^127\./.test(location.host);
  const sec = h("section", { class: "ws" });
  const v = (k) => (S.seo && S.seo[k]) || "";
  sec.innerHTML = `
    <h3>Website</h3>
    <p class="hint">How your site appears on Google and when someone shares a link to it. Leave a box empty to use the default.</p>
    <div class="ws-prev" aria-label="Previews">
      <div class="ws-g" aria-label="Google result"><small>rohankumar.pro</small><b class="ws-gt"></b><p class="ws-gd"></p></div>
      <div class="ws-card" aria-label="Share preview"><div class="ws-ci"></div><div class="ws-cb"><small>rohankumar.pro</small><b class="ws-ct"></b><p class="ws-cd"></p></div></div>
    </div>
    <label class="ae-l">Site title <span class="ws-n" data-n="title"></span><input data-k="title" maxlength="70" placeholder="${esc(defTitle)}" value="${esc(v("title"))}"></label>
    <label class="ae-l">Description <span class="ws-n" data-n="desc"></span><textarea data-k="desc" rows="3" maxlength="200" placeholder="${esc(defDesc.slice(0, 160))}">${esc(v("desc"))}</textarea></label>
    <p class="hint">Titles read best under 60 characters, descriptions between 120 and 160.</p>
    <div class="ae-l">Share picture<div class="ws-imgrow"><span class="ws-thumb"></span><div class="ws-ib"></div></div></div>
    <p class="hint">Shown when someone shares your home page or any page without a picture of its own. Any picture works: it is cropped to 1200 × 630 and made small enough for WhatsApp and LinkedIn. Articles get their own from their cover.</p>
    <label class="ae-l">Describe the share picture<input data-k="imgAlt" maxlength="200" placeholder="For screen readers and search engines" value="${esc(v("imgAlt"))}"></label>
    <label class="ae-l">X (Twitter) username<input data-k="x" maxlength="16" placeholder="yourname" value="${esc(v("x"))}"></label>
    <details class="ws-own"><summary>Search engine ownership</summary>
      <p class="hint">To see your search traffic, add the site in Google Search Console or Bing Webmaster Tools, choose the HTML tag method, and paste the tag or just its code here.</p>
      <label class="ae-l">Google verification code<input data-k="google" maxlength="200" placeholder="google-site-verification code" value="${esc(v("google"))}"></label>
      <label class="ae-l">Bing verification code<input data-k="bing" maxlength="200" placeholder="msvalidate.01 code" value="${esc(v("bing"))}"></label>
      <p class="hint">Your sitemap for them: <a href="/sitemap.xml" target="_blank" rel="noopener">rohankumar.pro/sitemap.xml</a></p>
    </details>
    <h3>Live check</h3>
    <p class="hint">Reads a page exactly as Google and share previews receive it from the server.${preview ? " This is a preview address, so pages are marked not to be indexed here; on rohankumar.pro they are." : ""}</p>
    <div class="ws-chk"><select class="ws-path" aria-label="Page to check"><option value="/">Home</option><option value="/about">About</option><option value="/projects">Projects</option><option value="/journal">Journal</option><option value="/links">Links</option></select><button class="btn tonal ws-go" type="button">Check now</button></div>
    <div class="ws-res" aria-live="polite"></div>
    <div class="ws-tools"><a target="_blank" rel="noopener" data-t="fb">Facebook debugger ${ext}</a><a target="_blank" rel="noopener" data-t="li">LinkedIn inspector ${ext}</a><a target="_blank" rel="noopener" data-t="g">Google rich results ${ext}</a></div>`;

  // the newest articles can be checked too
  const posts = ((window.LIVE && LIVE.posts) || []).filter((p) => !p.draft).slice(0, 6);
  const sel = $(".ws-path", sec);
  posts.forEach((p) => sel.append(h("option", { value: "/journal/" + p.slug }, "Article: " + String(p.title || p.slug).slice(0, 40))));

  const draw = () => {
    const t = v("title") || defTitle, d = v("desc") || defDesc;
    $(".ws-gt", sec).textContent = t; $(".ws-gd", sec).textContent = d.length > 160 ? d.slice(0, 157) + "…" : d;
    $(".ws-ct", sec).textContent = t; $(".ws-cd", sec).textContent = d;
    const img = v("img") || "/img/og.png";
    $(".ws-ci", sec).innerHTML = `<img src="${esc(img)}" alt="">`;
    $(".ws-thumb", sec).innerHTML = `<img src="${esc(img)}" alt="">`;
    for (const [k, lim] of [["title", 60], ["desc", 160]]) { const n = (v(k) || "").length, el = $(`[data-n="${k}"]`, sec); el.textContent = n ? `${n}` : ""; el.classList.toggle("over", n > lim); }
    const ib = $(".ws-ib", sec); ib.innerHTML = "";
    const up = h("button", { class: "btn tonal", type: "button" }, v("img") ? "Replace" : "Upload picture");
    up.onclick = () => pick(up);
    ib.append(up);
    if (v("img")) ib.append(h("button", { class: "btn tonal", type: "button", onclick: () => { delete S.seo.img; delete S.seo.imgAlt; $('[data-k="imgAlt"]', sec).value = ""; save(); draw(); } }, "Use the default"));
    const url = LIVE + (sel.value === "/" ? "/" : sel.value), e = encodeURIComponent(url);
    $('[data-t="fb"]', sec).href = "https://developers.facebook.com/tools/debug/?q=" + e;
    $('[data-t="li"]', sec).href = "https://www.linkedin.com/post-inspector/inspect/" + e;
    $('[data-t="g"]', sec).href = "https://search.google.com/test/rich-results?url=" + e;
  };
  async function pick(btn) {
    const i = h("input", { type: "file", accept: "image/*", style: "display:none" }); document.body.append(i);
    i.onchange = async () => {
      const f = i.files[0]; i.remove(); if (!f) return;
      btn.disabled = true; btn.textContent = "Preparing…";
      const u = URL.createObjectURL(f);
      try { seo().img = await shareImage(u); save(); toast("Share picture saved"); }
      catch (e) { toast(e.message || "Could not use that picture"); }
      finally { URL.revokeObjectURL(u); draw(); }
    };
    i.click();
  }
  // a pasted verification tag is reduced to its code
  const code = (s) => { const m = String(s).match(/content=["']([^"']+)["']/i); return (m ? m[1] : s).trim(); };
  let t = 0;
  function save() {
    const o = S.seo || {};
    for (const k of Object.keys(o)) if (!o[k]) delete o[k];
    if (!Object.keys(o).length) delete S.seo;
    clearTimeout(t); t = setTimeout(() => window.siteSave && siteSave(), 500);
  }
  $$("[data-k]", sec).forEach((el) => el.addEventListener("input", () => {
    let val = el.value; const k = el.dataset.k;
    if (k === "google" || k === "bing") { const c = code(val); if (c !== val) { el.value = c; val = c; } }
    if (k === "x") val = val.replace(/^@/, "").replace(/[^\w]/g, "");
    seo()[k] = val.trim(); save(); draw();
  }));
  sel.addEventListener("change", draw);
  $(".ws-go", sec).onclick = () => check(sel.value);
  draw();
  return sec;

  async function check(path) {
    const res = $(".ws-res", sec); res.innerHTML = `<p class="hint">Checking…</p>`;
    const go = $(".ws-go", sec); go.disabled = true;
    try {
      const r = await fetch(path, { cache: "no-store", credentials: "omit" });
      const html = await r.text(), d = new DOMParser().parseFromString(html, "text/html");
      const m = (sel2) => d.querySelector(sel2)?.getAttribute("content") || "";
      const rows = [];
      const row = (good, label, val, note) => rows.push(`<div class="ws-row ${good ? "ok" : "bad"}"><span class="ws-ic">${good ? ok : warn}</span><div><b>${esc(label)}</b><span>${esc(val || "Missing")}</span>${note ? `<small>${esc(note)}</small>` : ""}</div></div>`);
      const title = d.querySelector("title")?.textContent || "", desc = m('meta[name="description"]');
      row(r.ok, "Page answers", `${r.status} ${r.ok ? "OK" : ""}`.trim());
      row(!!title && title.length <= 70, "Title", title, title.length > 70 ? "Long titles are cut off in results." : "");
      row(desc.length >= 50 && desc.length <= 200, "Description", desc, desc.length < 50 ? "A bit short. 120 to 160 characters read best." : "");
      const og = m('meta[property="og:image"]');
      let imgNote = "", imgOk = !!og;
      if (og) {
        // load it from this server, so a preview address checks its own picture
        const local = (() => { try { const u = new URL(og, location.href); return u.origin === LIVE && location.origin !== LIVE ? u.pathname + u.search : u.href; } catch { return og; } })();
        const dims = await new Promise((res2) => { const im = new Image(); im.onload = () => res2([im.naturalWidth, im.naturalHeight]); im.onerror = () => res2(null); im.src = local; });
        let bytes = 0; try { const hr = await fetch(local, { method: "HEAD", cache: "no-store" }); bytes = +hr.headers.get("content-length") || 0; } catch {}
        if (!dims) { imgOk = false; imgNote = "The picture could not be loaded."; }
        else {
          imgNote = `${dims[0]} × ${dims[1]}${bytes ? ` · ${Math.round(bytes / 1024)} KB` : ""}`;
          if (dims[0] < 600) { imgOk = false; imgNote += " · small: large previews want at least 1200 wide"; }
          if (bytes > 600 * 1024) { imgOk = false; imgNote += " · over 600 KB: WhatsApp may skip it"; }
        }
        rows.push(`<div class="ws-shot"><img src="${esc(local)}" alt=""></div>`);
      }
      row(imgOk, "Share picture", og, imgNote);
      row(m('meta[name="twitter:card"]') === "summary_large_image", "Large preview card", m('meta[name="twitter:card"]'));
      const canon = d.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
      row(!!canon, "Canonical address", canon);
      const robots = m('meta[name="robots"]');
      row(/^index/.test(robots) || preview, "Indexing", robots, preview && !/^index/.test(robots) ? "Only on this preview address. The live site is indexed." : !/^index/.test(robots) ? "This page asks search engines not to list it." : "");
      const types = [...d.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => { try { const j = JSON.parse(s.textContent); return (j["@graph"] || [j]).map((n) => n["@type"]).filter(Boolean); } catch { return []; } });
      row(types.length > 0, "Structured data", types.join(", "));
      const words = (d.querySelector("#seo")?.textContent || "").trim().split(/\s+/).filter(Boolean).length;
      row(words > 30, "Readable text for search engines", `${words} words`, words <= 30 ? "Very little text is visible to search engines on this page." : "");
      if (v("google")) row(m('meta[name="google-site-verification"]') === v("google"), "Google verification tag", m('meta[name="google-site-verification"]'), "New settings reach pages within about two minutes.");
      res.innerHTML = rows.join("");
    } catch (e) {
      res.innerHTML = `<p class="hint">Could not check: ${esc(e.message || "network error")}</p>`;
    } finally { go.disabled = false; }
  }
}

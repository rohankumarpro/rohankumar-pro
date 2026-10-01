// Extra page content: under the fixed parts of Services, Resume, Contact and Timeline the owner can add anything the
// editor can make (text, pictures, galleries, video, tables, buttons). It is saved with the site settings.
import { h, $, esc, isAdmin, showBlocks, makeEditor, wireBlocks } from "/js/lib.mjs";
import { icon } from "/shared/icons.mjs";

export function richSection(body, key) {
  body.querySelectorAll(":scope > .rich-extra").forEach((e) => e.remove());
  const S = (window.SITE && (SITE.s = SITE.s || { hiddenApps: [] })) || {};
  S.extra = S.extra || {};
  const blocks = () => S.extra[key] || [];
  const sec = h("section", { class: "rich-extra" }); body.append(sec);
  const view = () => {
    sec.innerHTML = "";
    if (blocks().length) { const d = h("div", { class: "story-doc" }); sec.append(d); showBlocks(d, blocks()); wireBlocks(d); }
    if (isAdmin()) {
      const b = h("button", { class: "btn tonal story-edit", html: icon(blocks().length ? "pencil" : "plus", { size: 16 }) + `<span>${blocks().length ? "Edit page content" : "Add text, pictures and more"}</span>` });
      b.onclick = edit; sec.append(b);
    }
  };
  async function edit() {
    sec.innerHTML = `<p class="hint">Saves automatically. Type "/" for headings, pictures, galleries, video, tables and buttons.</p><div class="story-ed"></div><div class="ed-act"><span class="nt-status story-st"></span><button class="btn story-done">Done</button></div>`;
    let t = null; const st = $(".story-st", sec);
    const ed = await makeEditor($(".story-ed", sec), {
      blocks: blocks(), placeholder: "Write anything. Drop in pictures.",
      onChange: (b) => { st.textContent = "Saving…"; clearTimeout(t); t = setTimeout(() => { S.extra[key] = b; window.siteSave && siteSave(); st.textContent = "Saved"; }, 900); },
    });
    $(".story-done", sec).onclick = () => { const b = ed.flush(); S.extra[key] = b; if (!b.length) delete S.extra[key]; window.siteSave && siteSave(); ed.destroy(); view(); };
  }
  view();
}

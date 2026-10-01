// About me: the original card, plus a "story" section the owner writes with the block editor.
import { h, $, esc, isAdmin, showBlocks, makeEditor } from "/js/lib.mjs";

export function aboutApp(body) {
  body.innerHTML = about();
  window.wire && window.wire(body);
  if (isAdmin() && window.edBtn) window.edBtn(body);
  const story = (SITE.s && SITE.s.story) || [];
  const sec = h("section", { class: "about-story" }); body.append(sec);
  const view = () => {
    sec.innerHTML = story.length ? '<h3>My story</h3><div class="story-doc"></div>' : "";
    if (story.length) showBlocks($(".story-doc", sec), story);
    if (isAdmin()) { const b = h("button", { class: "btn tonal story-edit" }, story.length ? "Edit story" : "Write your story"); b.onclick = edit; sec.append(b); }
  };
  async function edit() {
    sec.innerHTML = '<h3>My story</h3><p class="hint">Saves automatically. Type “/” for headings, images, columns and more.</p><div class="story-ed"></div><div class="ed-act"><span class="nt-status story-st"></span><button class="btn story-done">Done</button></div>';
    let t = null; const st = $(".story-st", sec);
    const ed = await makeEditor($(".story-ed", sec), { blocks: story, placeholder: "Tell people about yourself…", onChange: (b) => { st.textContent = "Saving…"; clearTimeout(t); t = setTimeout(() => { SITE.s = SITE.s || { hiddenApps: [] }; SITE.s.story = b; story.length = 0; story.push(...b); siteSave(); setTimeout(() => (st.textContent = SITE.status || "Saved"), 900); }, 900); } });
    $(".story-done", sec).onclick = () => { const b = ed.flush(); SITE.s = SITE.s || { hiddenApps: [] }; SITE.s.story = b; story.length = 0; story.push(...b); siteSave(); ed.destroy(); view(); };
  }
  view();
}

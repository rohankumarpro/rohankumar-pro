// Resume: a page you write like a document. The owner edits it with the same block editor as Docs and the Journal:
// type "/" for headings, lists, pictures, tables, buttons. The first time, it starts from what was already on the page,
// so nothing is lost and nothing is pre-filled for you to overwrite. Visitors can download a PDF (an uploaded one, or the page printed).
import { h, $, esc, isAdmin, toast, Up, showBlocks, makeEditor, confirmBox } from "/js/lib.mjs";
import { icon } from "/shared/icons.mjs";

const blk = (t, html, extra = {}) => ({ t, h: html, ...extra });
/* what the page said before it became a free document, as blocks */
function seed() {
  const out = [blk("h1", esc(P.name || "Resume"))];
  if (P.role) out.push(blk("p", esc(P.role)));
  for (const e of P.experience || []) { out.push(blk("h3", esc(e.title || ""))); if (e.time) out.push(blk("p", `<i>${esc(e.time)}</i>`)); if (e.text) out.push(blk("p", esc(e.text))); }
  if ((P.skills || []).length) { out.push(blk("h3", "Skills")); for (const s of P.skills) out.push(blk("ul", esc(s))); }
  return out;
}
const mine = (S) => Array.isArray(S.resumeDoc);

export function resumeApp(body) {
  const S = (window.SITE && (SITE.s = SITE.s || { hiddenApps: [] })) || {};
  let ed = null, t = null;
  body.classList.remove("jr-editing");

  const view = () => {
    body.classList.remove("jr-editing"); body.innerHTML = "";
    const page = h("div", { class: "rs-page" });
    if (mine(S)) { const d = h("div", { class: "story-doc rs-doc" }); page.append(d); showBlocks(d, S.resumeDoc, { hBase: 1 }); if (!S.resumeDoc.length) d.innerHTML = '<p class="hint">This page is empty.</p>'; }
    else page.innerHTML = window.resume ? window.resume() : "";
    body.append(page);
    const bar = h("div", { class: "links rs-act" });
    if (S.resumeFile) bar.append(h("a", { class: "btn", href: S.resumeFile, download: "resume.pdf" }, "Download PDF"));
    else bar.append(h("button", { class: "btn", onclick: print }, "Print or save as PDF"));
    if (isAdmin()) {
      bar.append(h("button", { class: "btn tonal", html: icon("pencil", { size: 16 }) + "<span>Edit page</span>", onclick: edit }));
      bar.append(h("button", { class: "btn tonal", onclick: upload }, S.resumeFile ? "Replace PDF" : "Upload a PDF"));
      if (S.resumeFile) bar.append(h("button", { class: "btn tonal", onclick: () => { delete SITE.s.resumeFile; siteSave(); view(); } }, "Remove PDF"));
      if (mine(S)) bar.append(h("button", { class: "btn tonal", onclick: async () => { if (await confirmBox("Go back to the original layout? Your written page is kept in case you want it again, but it will stop showing.", "Go back", false)) { S.resumeDocBackup = S.resumeDoc; delete S.resumeDoc; siteSave(); view(); } } }, "Use the original layout"));
    }
    body.append(bar);
  };

  async function edit() {
    if (!mine(S)) S.resumeDoc = S.resumeDocBackup && S.resumeDocBackup.length ? S.resumeDocBackup : seed();
    body.innerHTML = "";
    const top = h("div", { class: "jed-bar rs-bar" }, h("button", { class: "back", html: icon("chevron-left", { size: 16 }) + "Done", onclick: done }), h("span", { class: "jed-st rs-st" }, "Saved"), h("span", { class: "sp" }));
    const host = h("div", { class: "story-ed rs-ed" });
    body.append(top, host);
    const st = $(".rs-st", top);
    const save = (b) => { st.textContent = "Saving…"; clearTimeout(t); t = setTimeout(() => { S.resumeDoc = b; if (window.siteSave) siteSave(); st.textContent = "Saved"; }, 700); };
    ed = await makeEditor(host, { blocks: S.resumeDoc, placeholder: "Write your resume. Type “/” for headings, lists, pictures, tables and buttons.", onChange: save, onStatus: ({ uploading }) => { if (uploading) st.textContent = "Uploading…"; } });
  }
  function done() { clearTimeout(t); if (ed) { S.resumeDoc = ed.flush(); try { ed.destroy(); } catch {} ed = null; } if (window.siteSave) siteSave(); view(); }

  function print() {
    const c = h("div", { id: "print-one" });
    if (mine(S)) { const d = h("div", { class: "bk-doc" }); showBlocks(d, S.resumeDoc, { hBase: 1 }); c.append(d); }
    else c.innerHTML = `<h1>${esc(P.name)}</h1>` + (window.resume ? window.resume() : "");
    document.body.append(c); document.body.classList.add("print-one");
    const fin = () => { c.remove(); document.body.classList.remove("print-one"); window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin); setTimeout(() => window.print(), 50);
  }
  async function upload() {
    const f = (await Up.pick("application/pdf"))[0]; if (!f) return;
    try { const r = await Up.file(f); S.resumeFile = r.url; siteSave(); toast("Uploaded"); view(); } catch (e) { toast(e.message); }
  }
  view();
}

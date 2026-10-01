// Resume: the original page, plus a way to download it as a PDF. The owner can upload a designed PDF; otherwise the page prints cleanly.
import { h, $, esc, isAdmin, toast, Up } from "/js/lib.mjs";

export function resumeApp(body) {
  const S = (typeof SITE !== "undefined" && SITE.s) || {};
  body.innerHTML = resume();
  const bar = h("div", { class: "links rs-act" });
  if (S.resumeFile) bar.append(h("a", { class: "btn", href: S.resumeFile, download: "resume.pdf" }, "Download PDF"));
  else bar.append(h("button", { class: "btn", onclick: print }, "Print or save as PDF"));
  if (isAdmin()) bar.append(h("button", { class: "btn tonal", onclick: upload }, S.resumeFile ? "Replace PDF" : "Upload a PDF"), S.resumeFile ? h("button", { class: "btn tonal", onclick: () => { delete SITE.s.resumeFile; siteSave(); resumeApp(body); } }, "Remove PDF") : null);
  body.append(bar);
  window.wire && window.wire(body); if (isAdmin() && window.edBtn) window.edBtn(body);
  function print() {
    const c = h("div", { id: "print-one" }); c.innerHTML = `<h1>${esc(P.name)}</h1>` + resume(); document.body.append(c); document.body.classList.add("print-one");
    const done = () => { c.remove(); document.body.classList.remove("print-one"); window.removeEventListener("afterprint", done); }; window.addEventListener("afterprint", done); setTimeout(() => window.print(), 50);
  }
  async function upload() {
    const f = (await Up.pick("application/pdf"))[0]; if (!f) return;
    try { const r = await Up.file(f); SITE.s = SITE.s || { hiddenApps: [] }; SITE.s.resumeFile = r.url; siteSave(); toast("Uploaded"); resumeApp(body); } catch (e) { toast(e.message); }
  }
}

// The starter text that ships inside index.html (the P and TIMELINE objects). Pages built on the server read it from there,
// so there is one copy of it, and then lay whatever the owner saved in Settings over the top.
import { readFileSync } from "node:fs";

let cache = null;
function indexHtml() {
  for (const p of [new URL("../../index.html", import.meta.url), `${process.env.LAMBDA_TASK_ROOT || "."}/index.html`, "./index.html"]) {
    try { return readFileSync(p, "utf8"); } catch {}
  }
  return "";
}
export function rawIndex() { return cache?.html ?? (cache = { html: indexHtml() }).html; }
function extract(src, start, endMark, name) {
  const a = src.indexOf(`const ${start}`); if (a < 0) return null;
  const b = src.indexOf(endMark, a + 10); if (b < 0) return null;
  try { return new Function(`${src.slice(a, b)}; return ${name};`)(); } catch { return null; }
}
export function defaults() {
  if (cache?.d) return cache.d;
  const src = rawIndex();
  const P = extract(src, "P = {", "\nconst PROJECTS", "P");
  const TIMELINE = extract(src, "TIMELINE=[", "\nconst TLI", "TIMELINE") || [];
  const SV_DEF = extract(src, "SV_DEF=", "\nconst EDITABLE", "SV_DEF") || { services: [], process: [], faq: [] };
  cache.d = { SV_DEF, P: P || { name: "Rohan Kumar", role: "Brand Designer", bio: "", skills: [], experience: [], links: [], music: {}, linkpage: [] }, TIMELINE };
  return cache.d;
}

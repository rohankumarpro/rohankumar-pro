// A deck shared with a private link (/present/<link>): view and present only. Nothing else of the site is loaded.
import { present } from "/js/design-io.mjs";

const msg = document.getElementById("msg");
const token = (location.pathname.match(/^\/present\/([A-Za-z0-9]{20,40})/) || [])[1];
const fail = (t, s) => { msg.innerHTML = `<div><h1>${t}</h1><p>${s}</p></div>`; msg.hidden = false; };
(async () => {
  if (!token) return fail("This link is not complete", "Check that the whole link was copied.");
  let r; try { r = await fetch("/api/designs?view=" + token, { cache: "no-store" }); } catch { return fail("Could not load the presentation", "Check your connection and try again."); }
  if (!r.ok) return fail("This link is not active", "The owner may have stopped sharing it.");
  const d = await r.json();
  document.title = d.title || "Presentation";
  if (!d.slides || !d.slides.length) return fail(d.title || "Presentation", "There are no slides in this deck yet.");
  msg.hidden = true;
  present(d.nodes, d.slides, { start: 0, title: d.title });
})();

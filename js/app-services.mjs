// Services: what is offered, how the work goes, kind words and answers to common questions.
import { h, $, $$, esc, isAdmin } from "/js/lib.mjs";
import { icon as _ic, ICONS as _ICONS } from "/shared/icons.mjs";
const I = (n, size = 16) => _ic(n, { size });

export function servicesApp(body) {
  const S = (typeof SITE !== "undefined" && SITE.s) || {};
  const sv = S.services && S.services.length ? S.services : SV_DEF.services, pr = S.process && S.process.length ? S.process : SV_DEF.process, faq = S.faq && S.faq.length ? S.faq : SV_DEF.faq, tt = S.testimonials || [];
  const sample = !(S.services && S.services.length);
  const pts = (v) => (Array.isArray(v.points) ? v.points : String(v.points || "").split(/\n|;/)).map((x) => x.trim()).filter(Boolean);
  body.innerHTML = `<div class="sv"><h1>Services</h1><p class="sv-lead">How I can help your brand.</p>${isAdmin() && sample ? '<p class="hint">This is sample text. Press Edit to make it yours.</p>' : ""}
    <div class="sv-grid">${sv.map((v) => `<article class="sv-card">${v.img ? `<img class="sv-img" src="${esc(v.img)}" alt="" loading="lazy">` : ""}<span class="sv-ic">${I(_ICONS[v.icon] ? v.icon : "sparkles", 24)}</span><h2>${esc(v.title)}</h2><p>${esc(v.text || "")}</p>${pts(v).length ? `<ul>${pts(v).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${v.price ? `<b class="sv-price">${esc(v.price)}</b>` : ""}</article>`).join("")}</div>
    <h2 class="sv-h">How it works</h2><ol class="sv-steps">${pr.map((x, i) => `<li><span>${i + 1}</span><div><b>${esc(x.title)}</b><p>${esc(x.text || "")}</p>${x.img ? `<img class="sv-simg" src="${esc(x.img)}" alt="" loading="lazy">` : ""}</div></li>`).join("")}</ol>
    ${tt.length ? `<h2 class="sv-h">Kind words</h2><div class="sv-tt">${tt.map((t) => `<figure><blockquote>“${esc(t.text)}”</blockquote><figcaption>${t.avatar ? `<img class="sv-av" src="${esc(t.avatar)}" alt="">` : ""}<b>${esc(t.name)}</b>${t.role ? `<small>${esc(t.role)}</small>` : ""}</figcaption></figure>`).join("")}</div>` : ""}
    <h2 class="sv-h">Questions</h2><div class="sv-faq">${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
    <div class="callout"><p><b>Have a project in mind?</b> Tell me about it.</p><div class="links"><button class="btn" data-open="book">Book a call</button><button class="btn tonal" data-open="messages">Send a message</button></div></div></div>`;
  window.wire && window.wire(body);
  if (isAdmin() && window.edBtn) window.edBtn(body);
}

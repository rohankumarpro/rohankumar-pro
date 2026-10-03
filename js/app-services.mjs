// Services: what is offered, how the work goes, kind words and answers to common questions.
import { h, $, $$, esc, isAdmin, confirmBox } from "/js/lib.mjs";
import { icon as _ic, ICONS as _ICONS } from "/shared/icons.mjs";
const I = (n, size = 16) => _ic(n, { size });

// The services listed on Behance (behance.net/rohankumarpro/services). The owner can put them on this page with one button.
const BEHANCE = [
  { title: "Brand Identity", icon: "palette", price: "From US$3,500 · within 1 month",
    text: "Ready to take your business to the next level? Let's create a brand identity that truly represents who you are and what you stand for. From a captivating logo that embodies your vision to a cohesive visual identity that tells your story, I craft unique brand identities that leave a lasting impression, unlock the full potential of your brand and attract the right audience.",
    points: ["Logo design", "Brand guidelines", "Colour palette and typography", "Stationery: business cards, letterhead and more", "Social media assets", "A presentation of your brand identity", "3 concepts, 5 revisions", "Delivered in 13 to 15 days"] },
  { title: "Logo Design", icon: "pencil", price: "From US$1,500 · within 1–2 weeks",
    text: "Get a well-crafted logo for your business to get started with.",
    points: ["3 concepts, 3 revisions", "Delivered within 1 to 2 weeks"] },
  { title: "Packaging Design", icon: "gift", price: "From US$2,000 · within 1–2 weeks",
    text: "Custom packaging with striking visual elements, cohesive branding and attention-grabbing graphics, delivered as printable artwork files.",
    points: ["Discovery meeting and brand analysis", "Creative concept development", "Structural design and mock-ups", "Final artwork preparation", "Printable artwork files", "2 concepts, 5 revisions", "Delivered in about 7 days"] },
  { title: "Brand Strategy", icon: "target", price: "From US$1,200 · within 1 month",
    text: "I analyse your market, competition and target audience to find a unique position for your brand, then define why it exists, where it is going and what it stands for. The result is a clear brand essence that guides how your brand looks, speaks and grows.",
    points: ["Brand positioning", "Brand purpose", "Vision and mission", "Brand values", "Brand essence", "Brand naming and tagline", "Delivered within 1 month"] },
];
const isBehance = (list) => Array.isArray(list) && list.length === BEHANCE.length && list.every((v, i) => v.title === BEHANCE[i].title);

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
  if (isAdmin() && !isBehance(S.services)) {
    const bar = h("p", { class: "hint sv-behance" }, "Your Behance services can replace the ones on this page. ",
      h("button", { class: "btn tonal", onclick: async () => {
        if (!(await confirmBox("Replace the services on this page with your 4 Behance services (Brand Identity, Logo Design, Packaging Design, Brand Strategy)? The current cards are removed.", "Replace", false))) return;
        SITE.s = SITE.s || { hiddenApps: [] }; SITE.s.services = BEHANCE.map((v) => ({ ...v, points: [...v.points] }));
        window.siteSave && window.siteSave(); servicesApp(body);
      } }, "Use my Behance services"));
    $(".sv-lead", body).after(bar);
  }
  window.wire && window.wire(body);
  if (isAdmin() && window.edBtn) window.edBtn(body);
}

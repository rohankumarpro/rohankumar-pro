// Book a call: the booking page opens inside the desktop, with a plain link as a fallback.
import { h, $, esc } from "/js/lib.mjs";
import { embedInfo } from "/shared/blocks.mjs";
import { icon as _ic, ICONS as _ICONS } from "/shared/icons.mjs";
const I = (n, size = 16) => _ic(n, { size });

export function bookApp(body) {
  const url = window.__bookUrl || (typeof P !== "undefined" && P.booking) || ""; // a booking link clicked anywhere on the site opens here
  const e = url && embedInfo(url);
  body.style.padding = "0 0 0"; 
  body.innerHTML = `<div class="bk"><div class="bk-top"><h1>Book a call</h1><p>Pick a time that suits you. It is a free intro call.</p></div>
    ${e ? `<div class="bk-frame"><iframe src="${esc(e.src)}" title="Booking calendar" loading="lazy" allow="payment"></iframe></div>` : ""}
    <div class="bk-foot">${url ? `<a class="btn${e ? " tonal" : ""}" href="${esc(url)}" target="_blank" rel="noopener" data-ext>${e ? "Open in a new tab" : "Choose a time"} ${I("external", 14)}</a>` : '<p class="hint">Booking is not set up yet.</p>'}<button class="btn tonal" data-bk-full title="Full screen (F)">Full screen</button><button class="btn tonal" data-open="messages">Send a message instead</button></div></div>`;
  const fb = $("[data-bk-full]", body); if (fb) { if (typeof canFull === "function" && !canFull()) fb.remove(); else fb.onclick = () => window.osFullToggle && osFullToggle(); }
  window.wire && window.wire(body);
}

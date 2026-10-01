// Book a call: the booking page opens inside the desktop, with a plain link as a fallback.
import { h, $, esc } from "/js/lib.mjs";
import { embedInfo } from "/shared/blocks.mjs";

export function bookApp(body) {
  const url = (typeof P !== "undefined" && P.booking) || "";
  const e = url && embedInfo(url);
  body.style.padding = "0 0 0"; 
  body.innerHTML = `<div class="bk"><div class="bk-top"><h1>Book a call</h1><p>Pick a time that suits you. It is a free intro call.</p></div>
    ${e ? `<div class="bk-frame"><iframe src="${esc(e.src)}" title="Booking calendar" loading="lazy" allow="payment"></iframe></div>` : ""}
    <div class="bk-foot">${url ? `<a class="btn${e ? " tonal" : ""}" href="${esc(url)}" target="_blank" rel="noopener">${e ? "Open in a new tab" : "Choose a time"} ↗</a>` : '<p class="hint">Booking is not set up yet.</p>'}<button class="btn tonal" data-open="messages">Send a message instead</button></div></div>`;
  window.wire && window.wire(body);
}

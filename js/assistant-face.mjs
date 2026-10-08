// The face of "Ask Rohan", the visitor bot: a small animated companion on the desktop (it took OGGY's place).
// It blinks, looks at the pointer, and opens the Ask Rohan app when pressed. Everyone sees it (unless the owner hides the app).
// faceSvg() is also used, larger, inside the app. Restyle freely: everything is in css/assistant.css.
const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
export const ASK = "Ask Rohan";
export const faceOn = () => ls.get("rkFace", true) !== false;
export const setFaceOn = (v) => { ls.set("rkFace", !!v); mountFace(); };

export function faceSvg(cls = "") {
  return `<span class="asf ${cls}" aria-hidden="true"><svg viewBox="0 0 100 100">
    <rect class="asf-head" x="8" y="12" width="84" height="78" rx="30"/>
    <rect class="asf-shine" x="20" y="20" width="26" height="9" rx="4.5"/>
    <g class="asf-eyes"><g class="asf-eye"><ellipse class="asf-white" cx="35" cy="50" rx="10" ry="12"/><circle class="asf-pupil" cx="35" cy="51" r="5.5"/></g>
    <g class="asf-eye"><ellipse class="asf-white" cx="65" cy="50" rx="10" ry="12"/><circle class="asf-pupil" cx="65" cy="51" r="5.5"/></g></g>
    <ellipse class="asf-cheek" cx="22" cy="66" rx="6" ry="3.5"/><ellipse class="asf-cheek" cx="78" cy="66" rx="6" ry="3.5"/>
    <path class="asf-mouth" d="M41 70q9 7 18 0"/>
  </svg></span>`;
}

// eyes follow the pointer and blink now and then; stops by itself when the face leaves the page
export function lively(el) {
  if (!el || el.__lively) return; el.__lively = true;
  const pupils = [...el.querySelectorAll(".asf-pupil")];
  const look = (x, y) => {
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
    const tx = (dx / d) * 4.2 * k, ty = (dy / d) * 4.6 * k;
    for (const p of pupils) p.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px)`;
  };
  const onMove = (e) => look(e.clientX, e.clientY);
  addEventListener("pointermove", onMove, { passive: true });
  let t = 0;
  const blink = () => {
    if (!el.isConnected) { removeEventListener("pointermove", onMove); return; }
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) { el.classList.add("blink"); setTimeout(() => el.classList.remove("blink"), 150); if (Math.random() < 0.2) setTimeout(() => { el.classList.add("blink"); setTimeout(() => el.classList.remove("blink"), 140); }, 260); }
    t = setTimeout(blink, 2600 + Math.random() * 3800);
  };
  t = setTimeout(blink, 1200);
}

const css = () => { if (!document.querySelector('link[href="/css/assistant.css"]')) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: "/css/assistant.css" })); };

// the desktop companion: shown to everyone while they want it, and only while the app is not hidden by the owner
export function mountFace() {
  let el = document.querySelector(".as-buddy");
  const hidden = typeof appVisible === "function" && !appVisible("assistant");
  if (hidden || !faceOn()) { el && el.remove(); return; }
  if (el) return;
  css();
  el = document.createElement("button");
  el.className = "as-buddy"; el.type = "button"; el.title = ASK; el.setAttribute("aria-label", "Open " + ASK);
  el.innerHTML = faceSvg("idle") + `<span class="as-buddy-tip">${ASK}</span>`;
  el.onclick = () => { el.classList.add("hop"); setTimeout(() => el.classList.remove("hop"), 500); window.openApp && openApp("assistant"); };
  el.oncontextmenu = (e) => { e.preventDefault(); setFaceOn(false); window.toast && toast(`Face hidden. Bring it back from the ${ASK} app, under Options.`); };
  document.body.append(el);
  lively(el.querySelector(".asf"));
}

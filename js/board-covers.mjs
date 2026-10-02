// Covers and colours for Boards, in the Google / Material family. Covers are drawn in code (small SVGs), so they weigh
// nothing, stay sharp at any size and need no download.

const enc = (s) => `url('data:image/svg+xml,${encodeURIComponent(s).replace(/'/g, "%27")}')`;
const svg = (defs, body, bg) => enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs><rect width="800" height="400" fill="${bg}"/>${body}</svg>`);
const glow = (id, c, o = 1) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const lin = (id, a, b, x2 = 1, y2 = 1) => `<linearGradient id="${id}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

// soft blended colour (a "mesh")
const mesh = (bg, a, b, c, d) => svg(glow("a", a) + glow("b", b) + glow("c", c) + glow("d", d, .9),
  `<circle cx="120" cy="60" r="420" fill="url(#a)"/><circle cx="720" cy="40" r="380" fill="url(#b)"/><circle cx="560" cy="420" r="420" fill="url(#c)"/><circle cx="200" cy="420" r="300" fill="url(#d)"/>`, bg);
// layered waves
const waves = (a, b, c, d) => svg(lin("g", a, b, 0, 1),
  `<path d="M0 230C140 170 260 290 420 240S660 150 800 200V400H0z" fill="${c}" opacity=".55"/><path d="M0 290C160 240 300 340 460 300S690 230 800 270V400H0z" fill="${d}" opacity=".75"/><path d="M0 345C170 310 330 380 500 350S710 310 800 330V400H0z" fill="${d}"/>`, "url(#g)");
// Material shapes: circle, pill, scalloped "cookie" and rounded square
const cookie = (cx, cy, r, f) => { let p = ""; const n = 9; for (let i = 0; i <= n * 8; i++) { const t = (i / (n * 8)) * Math.PI * 2, rr = r * (1 + .09 * Math.cos(n * t)); p += (i ? "L" : "M") + (cx + rr * Math.cos(t)).toFixed(1) + " " + (cy + rr * Math.sin(t)).toFixed(1); } return `<path d="${p}Z" fill="${f}"/>`; };
const shapes = (bg, a, b, c, d) => svg("",
  `${cookie(150, 330, 150, a)}<rect x="300" y="60" width="300" height="120" rx="60" fill="${b}"/><circle cx="700" cy="300" r="120" fill="${c}"/><rect x="420" y="250" width="150" height="150" rx="44" fill="${d}" transform="rotate(14 495 325)"/><circle cx="90" cy="70" r="34" fill="${b}"/>`, bg);
// concentric arcs (orbit)
const arcs = (bg, a, b, c) => svg("",
  [0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="660" cy="360" r="${70 + i * 62}" fill="none" stroke="${[a, b, c][i % 3]}" stroke-width="30" opacity="${1 - i * .1}"/>`).join("") + `<circle cx="660" cy="360" r="40" fill="${a}"/>`, bg);
// dots on a gradient
const dots = (a, b, dot) => { let s = ""; for (let y = 30; y < 400; y += 40) for (let x = 30 + ((y / 40) % 2) * 20; x < 800; x += 40) s += `<circle cx="${x}" cy="${y}" r="${3 + 3 * (x / 800)}" fill="${dot}" opacity="${.25 + .6 * (x / 800)}"/>`; return svg(lin("g", a, b), s, "url(#g)"); };
// diagonal ribbons
const ribbons = (bg, a, b, c, d) => svg("",
  [a, b, c, d].map((f, i) => `<rect x="${-200 + i * 190}" y="-200" width="130" height="900" rx="65" fill="${f}" transform="rotate(32 400 200)"/>`).join(""), bg);

export const COVERS = {
  m1: { name: "Aurora", css: mesh("#E8F0FE", "#8AB4F8", "#C58AF9", "#81E6D9", "#AECBFA") },
  m2: { name: "Sunrise", css: mesh("#FEF7E0", "#FDD663", "#F6AEA9", "#FBBC04", "#FCC2A2") },
  m3: { name: "Mint", css: mesh("#E6F4EA", "#81C995", "#A8DAB5", "#5BB974", "#CEEAD6") },
  m4: { name: "Ocean", css: waves("#D2E3FC", "#AECBFA", "#8AB4F8", "#4285F4") },
  m5: { name: "Shapes", css: shapes("#FCE8E6", "#F28B82", "#FDD663", "#8AB4F8", "#81C995") },
  m6: { name: "Orbit", css: arcs("#F3E8FD", "#C58AF9", "#D7AEFB", "#E9D2FD") },
  m7: { name: "Night", css: dots("#0B1A3A", "#283593", "#8AB4F8") },
  m8: { name: "Four colours", css: ribbons("#F8F9FA", "#4285F4", "#EA4335", "#FBBC04", "#34A853") },
  m9: { name: "Dunes", css: waves("#FEEFC3", "#FAD2CF", "#FCAD70", "#E37400") },
  m10: { name: "Forest", css: waves("#CEEAD6", "#A8DAB5", "#5BB974", "#137333") },
  m11: { name: "Blossom", css: shapes("#FDE7F3", "#FBA9D6", "#F28B82", "#FDCFE8", "#C58AF9") },
  m12: { name: "Sky", css: dots("#E8F0FE", "#D2E3FC", "#4285F4") },
  m13: { name: "Lemon", css: arcs("#FEF7E0", "#FBBC04", "#FDD663", "#FEEFC3") },
  m14: { name: "Graphite", css: mesh("#202124", "#3C4043", "#5F6368", "#1A73E8", "#3C4043") },
  m15: { name: "Berry", css: mesh("#FCE8F3", "#E8458B", "#A142F4", "#F28B82", "#FBA9D6") },
  m16: { name: "Lagoon", css: ribbons("#E4F7FB", "#12B5CB", "#78D9EC", "#A1E4F2", "#34A853") },
};
export const coverCss = (c) => (!c ? "" : c.k && COVERS[c.k] ? `${COVERS[c.k].css} center/cover` : "");

// Sticky and section colours: soft fills (dark ones are Google Keep's dark palette) and a strong accent for lines and labels.
export const COLORS = {
  yellow: { name: "Yellow", fill: "#FFF0A8", dark: "#7C4A03", ink: "#F9AB00" },
  orange: { name: "Orange", fill: "#FFD9B8", dark: "#692B17", ink: "#FA7B17" },
  red: { name: "Red", fill: "#FFCDC9", dark: "#77172E", ink: "#EA4335" },
  pink: { name: "Pink", fill: "#FDD3EA", dark: "#6C394F", ink: "#E8458B" },
  purple: { name: "Purple", fill: "#E6DAFF", dark: "#472E5B", ink: "#A142F4" },
  blue: { name: "Blue", fill: "#D3E3FD", dark: "#284255", ink: "#4285F4" },
  teal: { name: "Teal", fill: "#C4EEE8", dark: "#0C625D", ink: "#12B5CB" },
  green: { name: "Green", fill: "#D5F1D0", dark: "#264D3B", ink: "#34A853" },
  grey: { name: "Grey", fill: "#E8EAED", dark: "#3C3F43", ink: "#80868B" },
  white: { name: "White", fill: "#FFFFFF", dark: "#2D2E31", ink: "#5F6368" },
};
export const STICKY = ["yellow", "orange", "red", "pink", "purple", "blue", "teal", "green", "grey", "white"];
export const LINE = ["grey", "blue", "red", "yellow", "green", "purple", "pink", "orange", "teal"];

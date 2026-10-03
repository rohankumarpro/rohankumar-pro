/* The app icon library: layered, softly lit icons drawn on a 100 x 100 canvas (a light circle sits behind each one).
   Loaded as a classic script before the desktop draws anything. window.APP_ICONS[name] = { t: title, a: artwork }.
   Each icon moves the way the real thing would (a folder opens, a bell rings, a record spins), once, then settles.
   Parts carry small animation classes; css/app-icons.css holds the motions. Icons with no natural motion only lift. */
(function () {
  const B = "url(#ag-b)", BD = "url(#ag-bd)", R = "url(#ag-r)", Y = "url(#ag-y)", YD = "url(#ag-yd)", G = "url(#ag-g)", GD = "url(#ag-gd)",
    K = "url(#ag-k)", GY = "url(#ag-gy)", P = "url(#ag-p)", SK = "url(#ag-sky)", W = "url(#ag-w)", O = "url(#ag-o)";
  const ln = (d, c = "#fff", w = 4.5, cls = "") => `<path${cls ? ` class="${cls}"` : ""} d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  const gear = (cx, cy, R1, r1, n) => { let d = ""; for (let i = 0; i < n * 2; i++) { const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n, rr = i % 2 ? r1 : R1; const p = (a, q) => [(cx + Math.cos(a) * q).toFixed(1), (cy + Math.sin(a) * q).toFixed(1)]; const [x0, y0] = p(a0 + 0.1, rr), [x1, y1] = p(a1 - 0.1, rr); d += (i ? "L" : "M") + x0 + " " + y0 + "L" + x1 + " " + y1; } return d + "Z"; };
  const star = (cx, cy, R1, r1) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + Math.PI * i / 5, q = i % 2 ? r1 : R1; d += (i ? "L" : "M") + (cx + Math.cos(a) * q).toFixed(1) + " " + (cy + Math.sin(a) * q).toFixed(1); } return d + "Z"; };

  const I = {
    /* ---- apps on the desktop ---- */
    folder: ["Folder", `<path d="M24 34a6 6 0 0 1 6-6h12l5 5h23a6 6 0 0 1 6 6v4H24z" fill="${BD}"/>
      <rect class="peek" x="31" y="34" width="38" height="20" rx="2.5" fill="${W}"/>
      <path class="lid" d="M24 44a6 6 0 0 1 6-6h40a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z" fill="${Y}"/>`],
    journal: ["Journal", `<rect x="29" y="22" width="42" height="56" rx="6" fill="${B}"/><rect x="29" y="22" width="9" height="56" rx="4" fill="${BD}"/>
      <path class="ribbon" d="M56 22v19l5.5-4.5L67 41V22z" fill="${R}"/>${ln("M45 54h16M45 62h11", "#fff", 4.5, "write")}`],
    timeline: ["Timeline", `<rect x="31" y="31" width="4" height="38" rx="2" fill="#CFE0FB"/>
      <circle class="dot d1" cx="33" cy="33" r="5.5" fill="${B}"/><circle class="dot d2" cx="33" cy="50" r="5.5" fill="${G}"/><circle class="dot d3" cx="33" cy="67" r="5.5" fill="${Y}"/>
      <rect class="bar b1" x="43" y="28" width="32" height="10" rx="5" fill="${B}"/><rect class="bar b2" x="43" y="45" width="26" height="10" rx="5" fill="#B9D2F7"/><rect class="bar b3" x="43" y="62" width="20" height="10" rx="5" fill="${B}"/>`],
    photos: ["Photos", `<circle class="sun" cx="64" cy="33" r="7.5" fill="${Y}"/>
      <path d="M22 72l18-26a3.5 3.5 0 0 1 5.8 0L64 72z" fill="${B}"/><path d="M48 72l12.5-16a3.5 3.5 0 0 1 5.5 0L78 72z" fill="${BD}"/>`],
    messages: ["Messages", `<path d="M50 25c15.5 0 27 9.6 27 22s-11.5 22-27 22c-3.2 0-6.3-.4-9.2-1.2L30 75l1.8-11.4C26.8 59.6 23 53.6 23 47c0-12.4 11.5-22 27-22z" fill="${B}"/>
      <circle class="tdot t1" cx="39.5" cy="47" r="3.8" fill="#fff"/><circle class="tdot t2" cx="50" cy="47" r="3.8" fill="#fff"/><circle class="tdot t3" cx="60.5" cy="47" r="3.8" fill="#fff"/>`],
    briefcase: ["Briefcase", `<path class="handle" d="M41 37v-5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v5" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
      <g class="bag"><rect x="24" y="36" width="52" height="38" rx="8" fill="${G}"/><rect x="24" y="52" width="52" height="4" fill="#1C8A42" opacity=".55"/><rect class="clasp" x="45" y="50" width="10" height="9" rx="3" fill="#fff"/></g>`],
    link: ["Link", `<g class="lk-a"><rect x="19" y="45" width="36" height="20" rx="10" transform="rotate(-45 37 55)" fill="none" stroke="${B}" stroke-width="8"/></g>
      <g class="lk-b"><rect x="45" y="35" width="36" height="20" rx="10" transform="rotate(-45 63 45)" fill="none" stroke="${G}" stroke-width="8"/></g>`],
    guestbook: ["Sign", `<g class="pen"><path d="M64 22l13 13-31 31-13-13z" fill="${R}"/><path d="M33 53l13 13-9.5 3.4-6.9-6.9z" fill="#FFD8A8"/><path d="M30 62.5l7.5 7.5-9.5 3z" fill="#3A3F47"/><path d="M64 22l3.5-3.5a4.5 4.5 0 0 1 6.4 0l6.6 6.6a4.5 4.5 0 0 1 0 6.4L77 35z" fill="#FF9A92"/></g>
      ${ln("M42 77c5-4.5 9-4.5 10.5-.5s6.5 3.5 10.5-1 8.5-3.5 14 0", "url(#ag-r)", 4, "scrib")}`],
    calendar: ["Calendar", `<rect x="23" y="29" width="54" height="48" rx="9" fill="${W}" stroke="#E4E9F1" stroke-width="1"/>
      <path class="page" d="M23 38a9 9 0 0 1 9-9h36a9 9 0 0 1 9 9v6H23z" fill="${R}"/>
      ${ln("M36 23v12M64 23v12", "#3A3F47", 5)}
      <g fill="${R}"><circle class="cd c1" cx="37" cy="56" r="3.6"/><circle class="cd c2" cx="50" cy="56" r="3.6"/><circle class="cd c3" cx="63" cy="56" r="3.6"/><circle class="cd c4" cx="37" cy="67" r="3.6"/><circle class="cd c5" cx="50" cy="67" r="3.6"/></g>`],
    play: ["Video", `<rect class="screen" x="20" y="29" width="60" height="42" rx="12" fill="${R}"/><path class="tri" d="M44 39.5v21a1.5 1.5 0 0 0 2.3 1.3l16-10.5a1.5 1.5 0 0 0 0-2.6l-16-10.5a1.5 1.5 0 0 0-2.3 1.3z" fill="#fff"/>`],
    record: ["Music", `<g class="vinyl"><circle cx="50" cy="50" r="29" fill="${K}"/><circle cx="50" cy="50" r="22" fill="none" stroke="#5A5F68" stroke-width="1.2"/><circle cx="50" cy="50" r="16" fill="none" stroke="#474C55" stroke-width="1"/>
      <circle cx="50" cy="50" r="9.5" fill="${R}"/><circle cx="50" cy="50" r="2.4" fill="#fff"/><path d="M50 21a29 29 0 0 1 21 9" stroke="#fff" stroke-opacity=".25" stroke-width="3" fill="none" stroke-linecap="round"/></g>`],
    document: ["Document", `<path d="M30 25a5 5 0 0 1 5-5h20l16 16v39a5 5 0 0 1-5 5H35a5 5 0 0 1-5-5z" fill="${B}"/><path class="corner" d="M55 20v11a5 5 0 0 0 5 5h11z" fill="#9CC3FF"/>
      ${ln("M39 49h23M39 58h23M39 67h15", "#fff", 4, "write")}`],
    boards: ["Boards", `<rect class="tile t1" x="22" y="22" width="26" height="26" rx="7" fill="${B}"/><rect class="tile t2" x="52" y="22" width="26" height="26" rx="7" fill="${Y}"/>
      <rect class="tile t3" x="22" y="52" width="26" height="26" rx="7" fill="${G}"/><rect class="tile t4" x="52" y="52" width="26" height="26" rx="7" fill="${R}"/>`],
    picture: ["Picture", `<rect x="21" y="23" width="58" height="54" rx="9" fill="${B}"/><circle class="sun" cx="39" cy="41" r="7" fill="#fff"/>
      <path d="M33 77l16-20a3 3 0 0 1 4.7 0L69 77z" fill="#fff" opacity=".9"/><path class="peak" d="M52 77l12-15a3 3 0 0 1 4.6 0L79 77z" fill="${Y}"/>`],
    mail: ["Mail", `<rect x="22" y="31" width="56" height="40" rx="7" fill="${Y}"/>
      <rect class="letter" x="30" y="34" width="40" height="26" rx="3" fill="${W}"/>
      <path d="M22 40l28 18 28-18v24a7 7 0 0 1-7 7H29a7 7 0 0 1-7-7z" fill="${Y}"/>
      <path class="flap" d="M22 38a7 7 0 0 1 7-7h42a7 7 0 0 1 7 7L50 57z" fill="${R}"/>`],
    wallet: ["Wallet", `<rect class="card" x="27" y="24" width="38" height="24" rx="4" fill="#7FD49A"/>
      <path d="M22 37a8 8 0 0 1 8-8h40a8 8 0 0 1 8 8v31a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8z" fill="${G}"/>
      <rect x="55" y="46" width="27" height="17" rx="8.5" fill="#fff"/><circle cx="65" cy="54.5" r="3.6" fill="${GD}"/>`],
    note: ["Note", `<path class="sheet" d="M28 28a5 5 0 0 1 5-5h34a5 5 0 0 1 5 5v31L59 77H33a5 5 0 0 1-5-5z" fill="${Y}"/><path class="curl" d="M59 77V64a5 5 0 0 1 5-5h8z" fill="${YD}"/>
      ${ln("M37 39h25M37 49h16", "#fff", 4.5, "write")}`],
    palette: ["Palette", `<path d="M50 23c16 0 28 10.5 28 24 0 8.5-6.4 13-13 13h-6c-4.4 0-6.4 3.3-4.3 6.6 2.4 4-.2 10.4-5.6 10.4C33 77 22 65.4 22 50s12-27 28-27z" fill="${K}"/>
      <circle class="pd p1" cx="37" cy="45" r="5" fill="${R}"/><circle class="pd p2" cx="48" cy="35" r="5" fill="${Y}"/><circle class="pd p3" cx="61" cy="38" r="5" fill="${G}"/><circle class="pd p4" cx="37" cy="59" r="5" fill="${B}"/>`],
    pencil: ["Sketch", `<g class="pen"><path d="M62 24l14 14-31 31-14-14z" fill="${B}"/><path d="M62 24l4-4a4.5 4.5 0 0 1 6.4 0l7.6 7.6a4.5 4.5 0 0 1 0 6.4l-4 4z" fill="#1D3E8A"/>
      <path d="M31 55l14 14-12.5 4.5-6-6z" fill="#FFD8A8"/><path d="M26.5 67.5l6 6L24 76z" fill="#3A3F47"/></g>
      ${ln("M48 76c4-3 7-3 9 0s5 3 8 0 6-3 10 0", "#8EB8F8", 3.5, "scrib")}`],
    stopwatch: ["Stopwatch", `<rect x="45" y="17" width="10" height="8" rx="3" fill="${R}"/><path d="M68 28l4 4" stroke="${R}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="50" cy="53" r="26" fill="${R}"/><circle cx="50" cy="53" r="19" fill="#fff"/>
      <g class="hand"><path d="M50 53V41" stroke="#2C3038" stroke-width="4.2" stroke-linecap="round"/></g><path d="M50 53l7 5" stroke="#2C3038" stroke-width="4.2" stroke-linecap="round"/><circle cx="50" cy="53" r="3" fill="#2C3038"/>`],
    calculator: ["Calculator", `<rect x="27" y="21" width="42" height="56" rx="9" fill="${K}"/><rect x="33" y="28" width="30" height="12" rx="3" fill="#fff"/>
      <circle cx="39" cy="51" r="3.6" fill="#fff"/><circle cx="39" cy="64" r="3.6" fill="#fff"/>
      <g class="key"><rect x="49" y="47" width="25" height="30" rx="7" fill="${B}"/>${ln("M61.5 55.5v13M55 62h13", "#fff", 3.6)}</g>`],
    gear: ["Settings", `<g class="cog"><path d="${gear(50, 50, 27, 20, 8)}" fill="${GY}"/><circle cx="50" cy="50" r="9" fill="var(--icbg,#eef2f7)"/></g>`],
    apps: ["Apps", `<g fill="${B}">${[0, 1, 2].map((r) => [0, 1, 2].map((c) => `<circle class="ad a${r + c}" cx="${30 + c * 20}" cy="${30 + r * 20}" r="6.8"/>`).join("")).join("")}</g>`],
    user: ["Profile", `<path class="back" d="M60 64c0-7 4-11 9-11 6 0 10 5 10 12v3H60z" fill="#8EB8F8"/><circle class="back" cx="66" cy="42" r="7.5" fill="#8EB8F8"/>
      <circle class="head" cx="44" cy="38" r="12" fill="${B}"/><path d="M21 74c0-12 10-20 23-20s23 8 23 20v2H21z" fill="${B}"/>`],
    phone: ["Phone", `<g class="ring"><path d="M33.5 22.5c2.5-1.5 5.7-.8 7.2 1.7l5.2 8.8c1.3 2.2.9 5-1 6.8l-4.4 4.1c3 6.3 8 11.4 14.4 14.5l4.2-4.4c1.8-1.9 4.6-2.3 6.8-1l8.8 5.2c2.5 1.5 3.2 4.7 1.7 7.2l-3.2 5.2C71 74 66.6 76 62 75 41.5 70.7 29.3 58.5 25 38c-1-4.6 1-9 4.5-11.7z" fill="${G}"/></g>`],
    video: ["Video call", `<rect class="cam" x="19" y="32" width="44" height="36" rx="9" fill="${B}"/><path class="lens" d="M66 46l12-8a2 2 0 0 1 3 1.7v20.6a2 2 0 0 1-3 1.7l-12-8z" fill="${B}"/><circle class="rec" cx="31" cy="42" r="3" fill="#fff" opacity=".9"/>`],
    camera: ["Camera", `<path d="M38 28h24l4 7h8a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V41a6 6 0 0 1 6-6h8z" fill="${K}"/>
      <circle cx="50" cy="54" r="14" fill="#fff"/><circle class="iris" cx="50" cy="54" r="9.5" fill="#2C3038"/><circle class="flash" cx="70" cy="43" r="3" fill="#FBBC04"/>`],
    tray: ["Inbox", `<path d="M24 50l6-20a6 6 0 0 1 5.8-4.4h28.4A6 6 0 0 1 70 30l6 20z" fill="${B}"/><circle class="badge" cx="50" cy="38" r="5" fill="#fff"/>
      <g class="drawer"><path d="M22 50h56v18a7 7 0 0 1-7 7H29a7 7 0 0 1-7-7z" fill="${W}" stroke="#DCE3EE" stroke-width="1"/><rect x="41" y="59" width="18" height="5" rx="2.5" fill="${B}"/></g>`],
    cloud: ["Cloud", `<path class="cl" d="M33 72c-8 0-14-6-14-13.5 0-7 5.2-12.6 12-13.4C33 36.6 40.5 30 49.5 30c8 0 14.8 5.2 17.3 12.4 7.6.6 13.2 6.8 13.2 14.6 0 8.3-6.7 15-15 15z" fill="${B}"/>`],
    monitor: ["Desktop", `<rect x="19" y="23" width="62" height="42" rx="7" fill="${B}"/><rect class="glow" x="25" y="29" width="50" height="30" rx="3" fill="#fff" opacity="0"/>
      <rect x="45" y="65" width="10" height="9" fill="#3A3F47"/><rect x="36" y="73" width="28" height="5" rx="2.5" fill="#3A3F47"/>`],
    laptop: ["Laptop", `<g class="lid"><rect x="26" y="26" width="48" height="34" rx="5" fill="${GY}"/><rect x="30" y="30" width="40" height="26" rx="2.5" fill="${B}"/></g>
      <path d="M18 64h64l-3 7a4 4 0 0 1-3.7 2.5H24.7A4 4 0 0 1 21 71z" fill="${GY}"/>`],
    globe: ["Globe", `<defs><clipPath id="ai-gl"><circle cx="50" cy="50" r="27"/></clipPath></defs><circle cx="50" cy="50" r="27" fill="${B}"/>
      <g clip-path="url(#ai-gl)"><g class="land" fill="${G}"><path d="M22 36c6-4 12-3 15 1 3 3 1 8-3 9-4 2-3 6 1 8 4 3 2 9-3 9-7 0-12-8-13-15z"/><path d="M52 26c6 0 11 3 12 7s-4 6-8 5-7 3-4 7c3 5 10 3 13 8 2 5-2 11-8 13-4 1-6-3-4-7 2-5-3-8-6-11-4-5-1-11 1-14z"/><path d="M75 52c4 2 6 7 3 12l-3-1c-2-4-3-7 0-11z"/>
      <path transform="translate(-58 0)" d="M22 36c6-4 12-3 15 1 3 3 1 8-3 9-4 2-3 6 1 8 4 3 2 9-3 9-7 0-12-8-13-15z"/></g></g>
      <path d="M33 30a27 27 0 0 1 18-7" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round" fill="none"/>`],
    pin: ["Location", `<ellipse class="shadow" cx="50" cy="79" rx="9" ry="2.6" fill="#0b1a3a" opacity=".18"/>
      <g class="drop"><path d="M50 20c11.6 0 21 9.2 21 20.6C71 56 50 76 50 76S29 56 29 40.6C29 29.2 38.4 20 50 20z" fill="${R}"/><circle cx="50" cy="41" r="8" fill="#fff"/></g>`],
    weather: ["Weather", `<circle class="sun" cx="61" cy="38" r="12" fill="${Y}"/>
      <path class="cl" d="M31 74c-7 0-12-5.2-12-11.6 0-6 4.5-10.8 10.4-11.5C31.6 44 38 39 45.5 39c6.6 0 12.2 4.2 14.4 10.2 6.3.5 11.1 5.8 11.1 12.3 0 6.9-5.6 12.5-12.5 12.5z" fill="${SK}"/>`],
    clock: ["Clock", `<circle cx="50" cy="50" r="27" fill="#fff" stroke="#2C3038" stroke-width="5"/><g class="min"><path d="M50 50V31" stroke="#2C3038" stroke-width="4" stroke-linecap="round"/></g>
      <g class="hr"><path d="M50 50l10 9" stroke="${R}" stroke-width="4.5" stroke-linecap="round"/></g><circle cx="50" cy="50" r="3" fill="#2C3038"/>`],
    trash: ["Delete", `<g class="tlid"><rect x="24" y="27" width="52" height="8" rx="4" fill="${R}"/><path d="M42 27v-3a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" fill="none" stroke="${R}" stroke-width="5"/></g>
      <path d="M28 39h44l-4 34a5 5 0 0 1-5 4.4H37a5 5 0 0 1-5-4.4z" fill="${R}"/>${ln("M42 48v19M50 48v19M58 48v19", "#fff", 3.4)}`],
    shield: ["Protected", `<path class="sh" d="M50 20l25 9v18c0 16-10.6 27.6-25 33-14.4-5.4-25-17-25-33V29z" fill="${G}"/>${ln("M39 50l8 8 15-16", "#fff", 5.5, "chk")}`],
    download: ["Download", `<circle cx="50" cy="50" r="28" fill="${B}"/><g class="arr-d">${ln("M50 36v24M40 51l10 10 10-10", "#fff", 5.5)}</g>`],
    upload: ["Upload", `<circle cx="50" cy="50" r="28" fill="${G}"/><g class="arr-u">${ln("M50 64V40M40 49l10-10 10 10", "#fff", 5.5)}</g>`],
    search: ["Search", `<g class="lens"><circle cx="45" cy="45" r="17" fill="#DCEAFE" stroke="${B}" stroke-width="7"/><path d="M58 58l15 15" stroke="${B}" stroke-width="8" stroke-linecap="round"/></g>`],
    mic: ["Microphone", `<rect x="40" y="20" width="20" height="36" rx="10" fill="${B}"/><path class="lvl" d="M44 46h12" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
      <path d="M30 47a20 20 0 0 0 40 0" fill="none" stroke="${B}" stroke-width="5" stroke-linecap="round"/><path d="M50 67v10M40 78h20" stroke="${B}" stroke-width="5" stroke-linecap="round"/>`],
    headphones: ["Headphones", `<g class="hp"><path d="M25 60V52a25 25 0 0 1 50 0v8" fill="none" stroke="${K}" stroke-width="6" stroke-linecap="round"/>
      <rect x="20" y="52" width="16" height="25" rx="7" fill="${B}"/><rect x="64" y="52" width="16" height="25" rx="7" fill="${B}"/></g>`],
    bell: ["Notifications", `<g class="bell"><path d="M50 22a5 5 0 0 1 5 5v1.6C64 31 70 39 70 48v12l5 7H25l5-7V48c0-9 6-17 15-19.4V27a5 5 0 0 1 5-5z" fill="${Y}"/></g><circle class="clap" cx="50" cy="73" r="6" fill="${YD}"/>`],
    bookmark: ["Bookmark", `<path class="bm" d="M30 25a5 5 0 0 1 5-5h30a5 5 0 0 1 5 5v52l-20-12-20 12z" fill="${R}"/>`],
    star: ["Favourite", `<path class="st" d="${star(50, 52, 29, 13)}" fill="${Y}" stroke="${Y}" stroke-width="4" stroke-linejoin="round"/>`],
    heart: ["Love", `<path class="ht" d="M50 76S22 60 22 40.5C22 31 29 24 37.5 24c5.5 0 10 3 12.5 7.5C52.5 27 57 24 62.5 24 71 24 78 31 78 40.5 78 60 50 76 50 76z" fill="${R}"/>`],
    share: ["Share", `${ln("M36 50l26-13M36 50l26 13", B, 5, "wire")}<circle class="nd n0" cx="34" cy="50" r="9" fill="${B}"/><circle class="nd n1" cx="65" cy="34" r="9" fill="${B}"/><circle class="nd n2" cx="65" cy="66" r="9" fill="${B}"/>`],
    refresh: ["Refresh", `<g class="rf"><path d="M71 44A22 22 0 0 0 31 37" fill="none" stroke="${G}" stroke-width="7" stroke-linecap="round"/><path d="M72 30v15H57" fill="none" stroke="${G}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M29 56a22 22 0 0 0 40 7" fill="none" stroke="${G}" stroke-width="7" stroke-linecap="round"/><path d="M28 70V55h15" fill="none" stroke="${G}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>`],
    sparkles: ["Magic", `<path class="sp s1" d="M60 20c1.6 8.6 5.4 12.4 14 14-8.6 1.6-12.4 5.4-14 14-1.6-8.6-5.4-12.4-14-14 8.6-1.6 12.4-5.4 14-14z" fill="${P}"/>
      <path class="sp s2" d="M36 48c1.2 6.5 4 9.3 10.5 10.5C40 59.7 37.2 62.5 36 69c-1.2-6.5-4-9.3-10.5-10.5C32 57.3 34.8 54.5 36 48z" fill="${P}"/>
      <path class="sp s3" d="M63 62c.8 4.2 2.6 6 6.8 6.8-4.2.8-6 2.6-6.8 6.8-.8-4.2-2.6-6-6.8-6.8 4.2-.8 6-2.6 6.8-6.8z" fill="#B9A9FF"/>`],
    key: ["Key", `<g class="ky"><circle cx="61" cy="39" r="15" fill="${Y}"/><circle cx="61" cy="39" r="5.5" fill="var(--icbg,#eef2f7)"/>
      <path d="M50 50L25 75M33 67l6 6M27 73l5 5" stroke="${Y}" stroke-width="7" stroke-linecap="round"/></g>`],
    lock: ["Lock", `<path class="shk" d="M37 46V36a13 13 0 0 1 26 0v10" fill="none" stroke="${GD}" stroke-width="7" stroke-linecap="round"/>
      <rect x="27" y="44" width="46" height="34" rx="8" fill="${G}"/><circle cx="50" cy="58" r="5" fill="#1C5A33"/><rect x="47.5" y="58" width="5" height="10" rx="2.5" fill="#1C5A33"/>`],
    sun: ["Light", `<g class="rays" stroke="#F8BE14" stroke-width="5" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M50 20v6" transform="rotate(${a} 50 50)"/>`).join("")}</g><circle class="core" cx="50" cy="50" r="15" fill="${Y}"/>`],
    moon: ["Dark", `<path class="mn" d="M59 22a28 28 0 1 0 19 39A22 22 0 0 1 59 22z" fill="${P}"/>`],
    battery: ["Battery", `<rect x="19" y="34" width="56" height="32" rx="8" fill="#DDF3E4" stroke="#BFE7CB" stroke-width="1"/><rect x="76" y="44" width="6" height="12" rx="2.5" fill="#9AA1AB"/>
      <rect class="fill" x="23" y="38" width="48" height="24" rx="5" fill="${G}"/>`],
    signal: ["Signal", `<rect class="sg g1" x="24" y="58" width="9" height="16" rx="3" fill="${B}"/><rect class="sg g2" x="37" y="48" width="9" height="26" rx="3" fill="${B}"/><rect class="sg g3" x="50" y="37" width="9" height="37" rx="3" fill="${B}"/><rect class="sg g4" x="63" y="25" width="9" height="49" rx="3" fill="${B}"/>`],
    wifi: ["Wi-Fi", `<circle class="wf w0" cx="50" cy="70" r="5.5" fill="${B}"/>${ln("M38 58a17 17 0 0 1 24 0", B, 6.5, "wf w1")}${ln("M28 47a31 31 0 0 1 44 0", B, 6.5, "wf w2")}${ln("M18 36a45 45 0 0 1 64 0", B, 6.5, "wf w3")}`],
    bluetooth: ["Bluetooth", `<g class="bt">${ln("M38 36l24 25-12 12V27l12 12-24 25", B, 6.5)}</g>`],
    scan: ["Scan", `<g class="corners">${ln("M24 36v-6a6 6 0 0 1 6-6h6", B, 6, "cn c1")}${ln("M64 24h6a6 6 0 0 1 6 6v6", B, 6, "cn c2")}${ln("M76 64v6a6 6 0 0 1-6 6h-6", B, 6, "cn c3")}${ln("M36 76h-6a6 6 0 0 1-6-6v-6", B, 6, "cn c4")}</g>
      <rect class="tgt" x="37" y="37" width="26" height="26" rx="5" fill="#A9C9FB"/>`],
    sharedfolder: ["Shared folder", `<path d="M22 32a6 6 0 0 1 6-6h12l5 5h27a6 6 0 0 1 6 6v4H22z" fill="${YD}"/>
      <path class="lid" d="M22 42a6 6 0 0 1 6-6h44a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6z" fill="${Y}"/>
      <g class="who"><circle cx="50" cy="51" r="6" fill="${B}"/><path d="M39 72c0-7 5-11 11-11s11 4 11 11z" fill="${B}"/></g>`],
    copy: ["Copy", `<rect x="25" y="21" width="34" height="44" rx="6" fill="${BD}"/><rect class="front" x="41" y="35" width="34" height="44" rx="6" fill="${B}"/>`],
    printer: ["Print", `<rect x="33" y="20" width="34" height="16" rx="3" fill="#9AA1AB"/><path d="M24 40a6 6 0 0 1 6-6h40a6 6 0 0 1 6 6v20a5 5 0 0 1-5 5H29a5 5 0 0 1-5-5z" fill="${GY}"/>
      <g class="paper"><rect x="34" y="53" width="32" height="25" rx="3" fill="#fff" stroke="#DCE3EE" stroke-width="1"/><rect x="40" y="62" width="20" height="4" rx="2" fill="${B}"/></g><circle cx="67" cy="44" r="2.6" fill="#7FD49A"/>`],
    nut: ["Preferences", `<g class="nt"><path d="M50 20l26 15v30L50 80 24 65V35z" fill="${B}" stroke="${B}" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" r="10" fill="#fff"/></g>`],

    /* ---- more icons in the same style ---- */
    home: ["Home", `<path class="roof" d="M20 49l27-23a4.6 4.6 0 0 1 6 0l27 23" fill="none" stroke="${R}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M28 46l22-18 22 18v25a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6z" fill="${B}"/><path class="door" d="M44 77V63a6 6 0 0 1 12 0v14z" fill="${Y}"/>`],
    chart: ["Chart", `<rect x="22" y="74" width="56" height="4" rx="2" fill="#C9D3E1"/><rect class="cb b1" x="25" y="52" width="12" height="22" rx="3.5" fill="${B}"/><rect class="cb b2" x="44" y="38" width="12" height="36" rx="3.5" fill="${G}"/><rect class="cb b3" x="63" y="26" width="12" height="48" rx="3.5" fill="${Y}"/>`],
    rocket: ["Launch", `<g class="rk"><path d="M50 18c11 8 16 22 13 38H37c-3-16 2-30 13-38z" fill="${W}" stroke="#DCE3EE" stroke-width="1"/><circle cx="50" cy="38" r="6" fill="${B}"/>
      <path d="M37 50l-9 10 3 8 8-6zM63 50l9 10-3 8-8-6z" fill="${R}"/><path class="flame" d="M44 58h12l-2 9-4 7-4-7z" fill="${O}"/></g>`],
    gift: ["Gift", `<g class="glid"><rect x="22" y="36" width="56" height="12" rx="4" fill="${R}"/><path d="M50 36c-4-8-14-12-16-6s8 6 16 6zM50 36c4-8 14-12 16-6s-8 6-16 6z" fill="none" stroke="${Y}" stroke-width="4" stroke-linejoin="round"/></g>
      <rect x="26" y="48" width="48" height="28" rx="5" fill="${R}"/><rect x="46" y="36" width="8" height="40" fill="${Y}"/>`],
    coffee: ["Coffee", `<g class="steam" stroke="#B9C3D1" stroke-width="3.5" stroke-linecap="round" fill="none"><path class="sm s1" d="M40 30c-3-3 3-6 0-9"/><path class="sm s2" d="M50 30c-3-3 3-6 0-9"/><path class="sm s3" d="M60 30c-3-3 3-6 0-9"/></g>
      <path d="M26 38h44v20a16 16 0 0 1-16 16H42a16 16 0 0 1-16-16z" fill="${O}"/><path d="M70 43h3a8 8 0 0 1 0 16h-4" fill="none" stroke="${O}" stroke-width="5"/>`],
    trophy: ["Award", `<path d="M33 25h34v14a17 17 0 0 1-34 0z" fill="${Y}"/><path d="M33 30h-6a7 7 0 0 0 8 11M67 30h6a7 7 0 0 1-8 11" fill="none" stroke="${Y}" stroke-width="4.5"/>
      <rect x="46" y="55" width="8" height="10" fill="${YD}"/><rect x="36" y="65" width="28" height="9" rx="3" fill="${K}"/><path class="shine" d="M40 29v10" stroke="#fff" stroke-opacity=".7" stroke-width="4" stroke-linecap="round"/>`],
    cart: ["Shop", `<g class="cart"><path d="M18 26h8l7 34h36l6-24H30" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 40h38l-4 16H37z" fill="${B}"/>
      <circle cx="38" cy="72" r="5" fill="${K}"/><circle cx="64" cy="72" r="5" fill="${K}"/></g>`],
    code: ["Code", `<rect x="19" y="24" width="62" height="52" rx="10" fill="${K}"/>${ln("M38 41l-9 9 9 9", "#8EB8F8", 5, "cl-l")}${ln("M62 41l9 9-9 9", "#8EB8F8", 5, "cl-r")}${ln("M54 37l-8 26", "#7FD49A", 5)}`],
    terminal: ["Terminal", `<rect x="19" y="24" width="62" height="52" rx="10" fill="${K}"/><circle cx="29" cy="33" r="2.6" fill="#FF6B5E"/><circle cx="37" cy="33" r="2.6" fill="#FBBC04"/><circle cx="45" cy="33" r="2.6" fill="#34A853"/>
      ${ln("M30 49l8 7-8 7", "#7FD49A", 4.5)}<rect class="caret" x="44" y="60" width="16" height="4.5" rx="2" fill="#fff"/>`],
    compass: ["Explore", `<circle cx="50" cy="50" r="28" fill="${W}" stroke="#DCE3EE" stroke-width="1"/><circle cx="50" cy="50" r="22" fill="none" stroke="#E4E9F1" stroke-width="2"/>
      <g class="needle"><path d="M50 50l-6-3 6-20 6 20z" fill="${R}"/><path d="M50 50l6 3-6 20-6-20z" fill="#3A3F47"/></g><circle cx="50" cy="50" r="3.2" fill="#fff"/>`],
    plane: ["Travel", `<g class="pl"><path d="M76 24L22 46l20 7 4 21 10-13 14 9z" fill="${B}"/><path d="M42 53l34-29-30 37z" fill="${BD}"/></g>`],
    flag: ["Goal", `<rect x="27" y="20" width="5" height="58" rx="2.5" fill="#3A3F47"/><path class="fl" d="M32 23h36l-7 12 7 12H32z" fill="${R}"/>`],
    bulb: ["Idea", `<g class="glow"><circle cx="50" cy="42" r="26" fill="${Y}" opacity="0"/></g><path d="M50 20a20 20 0 0 1 12 36c-2 1.6-3 3.6-3 6H41c0-2.4-1-4.4-3-6a20 20 0 0 1 12-36z" fill="${Y}"/>
      <rect x="41" y="64" width="18" height="6" rx="2" fill="#9AA1AB"/><rect x="43" y="71" width="14" height="6" rx="3" fill="#7A818B"/>`],
    bookopen: ["Reading", `<path d="M50 30c-7-5-17-6-27-4v44c10-2 20-1 27 4z" fill="${B}"/><path d="M50 30c7-5 17-6 27-4v44c-10-2-20-1-27 4z" fill="${BD}"/>
      <path class="pg" d="M50 31c6-3.6 13.5-4.2 21-3v38c-7.5-1.2-15-.6-21 3z" fill="${W}"/>${ln("M57 41h8M57 49h8", "#B9C9E0", 3)}`],
  };

  // which artwork each built-in app uses (Settings > "Rename or change icon" can swap it for any icon in the library)
  const FOR = { projects: "folder", journal: "journal", timeline: "timeline", photos: "photos", messages: "messages", services: "briefcase", links: "link",
    guestbook: "guestbook", book: "calendar", content: "play", music: "record", resume: "document", boards: "boards", design: "picture", contact: "mail",
    documents: "wallet", notes: "note", palette: "palette", sketch: "pencil", focus: "stopwatch", calculator: "calculator", settings: "gear" };

  const out = {};
  for (const [k, [t, a]] of Object.entries(I)) out[k] = { t, a };
  window.APP_ICONS = out;
  window.APP_ICON_FOR = FOR;

  // the shared gradients and shadow every icon uses (one hidden <svg> on the page)
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    ${[["b", "#5B9BFF", "#1F6BEA"], ["bd", "#3474DC", "#1652B8"], ["r", "#FF7B6F", "#E5372D"], ["y", "#FFDA5C", "#F5B300"], ["yd", "#F2B200", "#D99400"], ["g", "#5BD27D", "#1F9C4A"], ["gd", "#2A9A50", "#17793A"],
      ["k", "#4E545E", "#262A31"], ["gy", "#A0A7B1", "#5F6772"], ["p", "#9A88FF", "#5A3DE6"], ["sky", "#B4D7FF", "#6AA9F6"], ["w", "#FFFFFF", "#E9EEF5"], ["o", "#FFB45C", "#F47B1F"]]
      .map(([n, a, b]) => `<linearGradient id="ag-${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join("")}
    <filter id="ai-sh" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.5" flood-color="#0b1a3a" flood-opacity=".2"/></filter></defs></svg>`;
  const addDefs = () => { if (!document.getElementById("ai-defs")) { const d = document.createElement("div"); d.id = "ai-defs"; d.innerHTML = DEFS; (document.body || document.documentElement).append(d); } };
  if (document.body) addDefs(); else document.addEventListener("DOMContentLoaded", addDefs);

  // the markup for one icon: the light circle, then the artwork
  window.appIconArt = (name, attrs = "") => {
    const ic = out[name]; if (!ic) return "";
    return `<span class="ico lay" data-ic="${name}"${attrs}><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="icbg" cx="50" cy="50" r="48"/><g class="art">${ic.a}</g></svg></span>`;
  };

  // play an icon's motion once, all the way through, when its app tile is pointed at, focused or tapped
  const HOST = ".dicon,.sbtn,.ae-lib button,.ail-cell";
  const play = (host) => {
    const ic = host && host.querySelector(".ico[data-ic]"); if (!ic || ic.classList.contains("go")) return;
    ic.classList.add("go"); setTimeout(() => ic.classList.remove("go"), 1300);
  };
  document.addEventListener("pointerover", (e) => { const h = e.target.closest && e.target.closest(HOST); if (h && !(e.relatedTarget && h.contains(e.relatedTarget))) play(h); });
  document.addEventListener("focusin", (e) => { const h = e.target.closest && e.target.closest(HOST); if (h) play(h); });
})();

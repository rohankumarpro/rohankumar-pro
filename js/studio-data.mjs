// Content Studio's thinking: timings, the checks that catch problems before you film, the shot list, chapters,
// the schedule worked back from a publish date, and the coach (common creator problems and what fixes them).
// Plain rules, no AI needed: everything here runs in the browser and is instant.

export const KIND = {
  hook: { name: "Hook", c: "red", sec: 10, short: 3, ico: "flame", tip: "The first seconds. Show or promise the result." },
  rehook: { name: "Rehook", c: "orange", sec: 8, short: 2, ico: "refresh", tip: "A fresh reason to keep watching, every 60 to 90 seconds." },
  stakes: { name: "Stakes", c: "yellow", sec: 15, short: 4, ico: "target", tip: "Why it matters to them, and what it costs to get wrong." },
  loop: { name: "Open loop", c: "purple", sec: 8, short: 2, ico: "sparkles", tip: "A promise you pay off later." },
  payoff: { name: "Payoff", c: "green", sec: 20, short: 6, ico: "check", tip: "Deliver what you promised." },
  story: { name: "Story", c: "pink", sec: 40, short: 10, ico: "chat", tip: "Setup, conflict, turn, lesson." },
  point: { name: "Point", c: "blue", sec: 60, short: 12, ico: "bulb", tip: "One idea: why, how, example." },
  proof: { name: "Proof", c: "brown", sec: 25, short: 6, ico: "trophy", tip: "Show it works: example, numbers, before/after." },
  transition: { name: "Transition", c: "grey", sec: 6, short: 2, ico: "arrow-right", tip: "Bridge one idea to the next." },
  cta: { name: "Call to action", c: "green", sec: 12, short: 3, ico: "bell", tip: "One clear ask, at the right time." },
  intro: { name: "Intro", c: "grey", sec: 10, short: 2, ico: "user", tip: "Keep it short. Or skip it." },
  outro: { name: "Outro", c: "grey", sec: 10, short: 2, ico: "leaf", tip: "End fast, point to the next video." },
  broll: { name: "B-roll", c: "blue", sec: 0, short: 0, ico: "camera", tip: "Footage ideas." },
};
export const SEG_KINDS = Object.keys(KIND).filter((k) => k !== "broll");
export const STAGES = ["Idea", "Scripting", "Filming", "Editing", "Published"];

/* ---------- words and time ---------- */
export const words = (t) => (String(t || "").match(/[A-Za-z0-9À-ɏऀ-ॿ'’-]+/g) || []).length;
export const readSec = (t, wpm = 150) => { const w = words(t); if (!w) return 0; const pauses = (String(t).match(/[.!?]\s|\n\n/g) || []).length * 0.25; return Math.round((w / wpm) * 60 + pauses); };
// a part's length: fixed if you set one; while its script is still well short of what the formula planned, the plan;
// after that, how long the script takes to say
export const segSec = (s, doc) => { if (s.sec != null) return s.sec; const r = readSec(fill(s.script, doc), doc.wpm || 150); if (s.plan && r < s.plan * 0.5) return s.plan; return r || (doc.fmt === "short" ? KIND[s.kind]?.short : KIND[s.kind]?.sec) || 10; };
export const clock = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, "0")}`; };
export function timeline(doc) { let t = 0; return (doc.segs || []).map((s) => { const d = segSec(s, doc), o = { s, start: t, dur: d, timed: s.sec == null && !!s.script }; t += d; return o; }); }
export const total = (doc) => timeline(doc).reduce((a, x) => a + x.dur, 0);

/* ---------- {placeholders} ---------- */
export const holes = (t) => [...new Set((String(t || "").match(/\{(\w+)\}/g) || []).map((x) => x.slice(1, -1)))];
export const fillMap = (doc) => ({ ...(doc.fill || {}), ...(doc.topic ? { topic: doc.topic } : {}), ...(doc.audience ? { audience: doc.audience } : {}), ...(doc.promise ? { promise: doc.promise, result: doc.fill?.result || doc.promise } : {}) });
export const fill = (t, doc) => { const m = fillMap(doc); return String(t || "").replace(/\{(\w+)\}/g, (all, k) => (m[k] ? m[k] : all)); };
// blanks shared by the whole video come from the reusable lines (hooks, stakes, calls to action…);
// blanks inside points and stories are for writing that part itself
export const CONTENT_KINDS = new Set(["point", "story", "proof"]);
export const allHoles = (doc) => { const m = fillMap(doc); return [...new Set((doc.segs || []).filter((s) => !CONTENT_KINDS.has(s.kind)).flatMap((s) => holes(s.script)).filter((k) => !m[k]))]; };
const partHoles = (doc) => (doc.segs || []).filter((s) => CONTENT_KINDS.has(s.kind) && holes(s.script).some((k) => !fillMap(doc)[k]));

/* ---------- the shot list ---------- */
// every segment you speak is a talking-head (A-roll) shot; b-roll comes from your lists, and from cues in the script
// like "(show the logo)", "on screen" or "close-up of …"
const CUE = /\(([^)]{3,120})\)|\b(?:show|on screen|close[- ]up of|cut to|zoom (?:in|into)|screen ?record(?:ing)?(?: of)?)\b[^.\n]{0,90}/gi;
export function shotList(doc) {
  const out = [], tl = timeline(doc);
  for (const { s, start, dur } of tl) {
    if (s.script && s.script.trim()) out.push({ seg: s.id, kind: "aroll", t: `Talking head: ${KIND[s.kind]?.name || "Part"}${s.title ? " · " + s.title : ""}`, at: start, dur, done: false, key: s.id + ":a" });
    for (const b of s.broll || []) out.push({ seg: s.id, kind: b.kind || "broll", t: b.t, at: start, done: !!b.done, key: s.id + ":" + b.id, id: b.id });
    const seen = new Set((s.broll || []).map((b) => b.t.toLowerCase()));
    for (const m of String(s.script || "").matchAll(CUE)) { const t = (m[1] || m[0]).trim().replace(/^show\s+/i, "Show "); if (words(t.replace(/\b(on screen|show|it|while you say)\b|[:.…]/gi, "")) >= 2 && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push({ seg: s.id, kind: "cue", t, at: start, done: false, key: s.id + ":c:" + t.slice(0, 20) }); } }
  }
  return out;
}

/* ---------- chapters for the description (YouTube needs 0:00 first, at least 3, each 10 s or longer) ---------- */
const CHAPTER_KINDS = new Set(["point", "story", "proof", "payoff", "intro"]);
export function chapters(doc) {
  const tl = timeline(doc), out = [];
  for (const x of tl) { if (!out.length) { out.push({ at: 0, t: x.s.title && x.s.kind !== "hook" ? x.s.title : "Intro" }); continue; } if (CHAPTER_KINDS.has(x.s.kind) && x.s.title) out.push({ at: x.start, t: x.s.title }); }
  const ok = out.filter((c, i) => i === out.length - 1 || out[i + 1].at - c.at >= 10);
  return ok.length >= 3 ? ok : [];
}
export const chaptersText = (doc) => chapters(doc).map((c) => `${clock(c.at)} ${c.t}`).join("\n");

/* ---------- working back from a publish date ---------- */
export function planBack(publish, fmt) {
  if (!publish) return [];
  const d = (n) => { const x = new Date(publish + "T12:00:00"); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  const L = fmt === "short";
  return [
    { k: "idea", t: "Idea and hook locked", d: d(L ? 4 : 10) },
    { k: "script", t: "Script final", d: d(L ? 3 : 7) },
    { k: "shoot", t: "Filmed", d: d(L ? 2 : 5) },
    { k: "edit", t: "Edit done", d: d(L ? 1 : 2) },
    { k: "pack", t: "Title, thumbnail, description ready", d: d(1) },
    { k: "publish", t: "Publish", d: publish },
  ];
}

/* ---------- the checks ---------- */
const FILLER = /\b(basically|actually|literally|really|very|just|kind of|sort of|you know|i mean|honestly|super)\b/gi;
const REHOOK_EVERY = 90;
export function checks(doc, { title = "", stage = "", publish = "" } = {}) {
  const out = [], segs = doc.segs || [], tl = timeline(doc), long = doc.fmt !== "short", tot = total(doc), first = tl[0];
  const add = (lvl, msg, fix, extra = {}) => out.push({ lvl, msg, fix, ...extra });
  if (!segs.length) { add("tip", "Start with a structure.", "Apply a formula, or drag blocks from the library onto the timeline.", { coach: "blank" }); return out; }
  // the opening
  if (first.s.kind !== "hook") add("bad", "The video doesn't open with a hook.", "Move a hook to the very start. The first seconds decide whether anyone stays.", { seg: first.s.id, coach: "hook" });
  const hook = tl.find((x) => x.s.kind === "hook");
  if (hook) {
    const lim = long ? 15 : 3;
    if (hook.dur > lim) add("warn", `The hook runs ${clock(hook.dur)}. Aim for under ${lim} seconds.`, "Cut it to one sentence that shows or promises the result. Move the context after it.", { seg: hook.s.id, coach: "hook" });
    if (hook.s.script && /^(hi|hey|hello|welcome|what'?s up|in this video)/i.test(hook.s.script.trim())) add("warn", "The hook starts with a greeting.", "Lead with the result or the problem. Say hello later, if at all.", { seg: hook.s.id, coach: "hook" });
    if (hook.s.script && words(hook.s.script) > (long ? 40 : 12)) add("tip", "The hook has a lot of words.", "Try saying it in half. Show, don't explain.", { seg: hook.s.id, coach: "hook" });
  }
  if (long && !tl.some((x) => (x.s.kind === "stakes" || x.s.kind === "loop") && x.start < 45)) add("warn", "Nothing in the first 45 seconds says why it matters.", "Add stakes or an open loop right after the hook: what they get, or what it costs to get this wrong.", { coach: "stakes" });
  const ctaEarly = tl.find((x) => x.s.kind === "cta" && x.start < (long ? 60 : 10));
  if (ctaEarly) add("warn", "There's a call to action very early.", "Asking for a subscribe before giving value makes people leave. Move it after a payoff.", { seg: ctaEarly.s.id, coach: "cta" });
  if (!segs.some((s) => s.kind === "cta")) add("tip", "No call to action.", "End with one clear ask: the next video, a comment question, or saving it.", { coach: "cta" });
  if (segs.filter((s) => s.kind === "cta").length > 2) add("tip", "Several calls to action.", "One ask at the end works better than many along the way.", { coach: "cta" });
  // the middle
  if (long) {
    let since = 0, lastAt = 0;
    for (const x of tl) {
      if (["rehook", "loop", "story", "proof", "hook", "payoff", "cta", "outro"].includes(x.s.kind)) { since = 0; lastAt = x.start + x.dur; continue; }
      since = x.start + x.dur - lastAt;
      if (since > REHOOK_EVERY + 30) { add("warn", `About ${clock(since)} without a rehook (from ${clock(lastAt)}).`, "Add a rehook, a quick story or a proof moment around here to reset attention.", { seg: x.s.id, coach: "retention" }); since = 0; lastAt = x.start + x.dur; }
    }
  }
  const loops = segs.filter((s) => s.kind === "loop").length, pays = segs.filter((s) => s.kind === "payoff").length;
  if (loops > pays) add("warn", "An open loop is never paid off.", "Add a payoff later in the video for every promise you make.", { coach: "loop" });
  const lastPoint = [...tl].reverse().find((x) => x.s.kind === "point");
  if (lastPoint && tl.indexOf(lastPoint) === tl.length - 1) add("tip", "The video ends on a point.", "Close with a payoff or a quick recap, then the call to action.", { coach: "ending" });
  // length
  const tgt = doc.target || (long ? 600 : 45);
  if (tot > tgt * 1.15) add("warn", `It runs ${clock(tot)}, over the ${clock(tgt)} you planned.`, `Cut about ${clock(tot - tgt)}. The longest parts are the easiest to tighten.`, { coach: "length" });
  else if (tot < tgt * 0.7 && segs.every((s) => s.script)) add("tip", `It runs ${clock(tot)}, well under the ${clock(tgt)} you planned.`, "That's fine if every second earns its place. Don't pad it.", { coach: "length" });
  if (!long && tot > 60) add("bad", `A short that runs ${clock(tot)}.`, "Shorts should stay under 60 seconds. Keep one idea.", { coach: "shorts" });
  // each part
  for (const x of tl) {
    const s = x.s, txt = s.script || "";
    if (!txt.trim() && s.kind !== "broll") { add("tip", `“${s.title || KIND[s.kind]?.name}” has no script yet.`, "Write it out, or at least bullet points of what to say.", { seg: s.id }); continue; }
    if (x.dur >= 20 && !(s.broll || []).length && !CUE.test(txt)) add("tip", `No b-roll for ${clock(x.dur)} of “${s.title || KIND[s.kind]?.name}”.`, "Plan what's on screen: the work, a screen recording, close-ups. Long talking-head stretches lose people.", { seg: s.id, coach: "broll" });
    CUE.lastIndex = 0;
    const longS = txt.split(/(?<=[.!?])\s+/).filter((p) => words(p) > 28);
    if (longS.length) add("tip", `${longS.length} long sentence${longS.length > 1 ? "s" : ""} in “${s.title || KIND[s.kind]?.name}”.`, "Spoken sentences work best under 20 words. Split them.", { seg: s.id, coach: "script" });
    const filler = (txt.match(FILLER) || []).length;
    if (filler >= 3) add("tip", `${filler} filler words in “${s.title || KIND[s.kind]?.name}” (just, really, actually…).`, "Cut them. It sounds more confident and saves time.", { seg: s.id, coach: "script" });
  }
  const miss = allHoles(doc);
  if (miss.length) add("warn", `Blanks still to fill: ${miss.map((k) => "{" + k + "}").join(", ")}.`, "Fill them in the Fill in box above, or edit the script.", { coach: "blank" });
  const ph = partHoles(doc);
  if (ph.length) add("tip", `${ph.length} part${ph.length > 1 ? "s" : ""} still ${ph.length > 1 ? "have" : "has"} template text to replace.`, "Write your own point where the {blanks} are. The template is only a shape.", { seg: ph[0].id, coach: "blank" });
  // packaging
  if (!title || /^untitled$/i.test(title)) add("tip", "No working title yet.", "Write the title before the script: it keeps the video focused on one promise.", { coach: "title" });
  else if (title.length > 60) add("tip", `The title is ${title.length} characters.`, "Under 60 shows in full on most screens. Front-load the interesting words.", { coach: "title" });
  if (!(doc.thumbs || []).length) add("tip", "No thumbnail idea yet.", "Plan it now: one subject, one emotion, 3 to 4 words that add to the title.", { coach: "thumbnail" });
  else if ((doc.thumbs || []).some((t) => title && t.t && t.t.toLowerCase() === title.toLowerCase())) add("tip", "A thumbnail text repeats the title.", "The thumbnail should add something the title doesn't say.", { coach: "thumbnail" });
  if (!doc.promise) add("tip", "What will they get by the end?", "Write the promise in one sentence. Every part should serve it.", { coach: "promise" });
  // schedule
  if (publish && stage) {
    const daysLeft = Math.round((new Date(publish + "T12:00:00") - new Date()) / 864e5), plan = planBack(publish, doc.fmt);
    const want = { Idea: "idea", Scripting: "script", Filming: "shoot", Editing: "edit" }[stage];
    const late = plan.filter((p) => p.d < new Date().toISOString().slice(0, 10) && ["script", "shoot", "edit"].includes(p.k) && ["Idea", "Scripting", "Filming", "Editing"].indexOf(stage) <= ["idea", "script", "shoot", "edit"].indexOf(p.k));
    if (daysLeft >= 0 && late.length) add("bad", `Behind schedule: ${late[late.length - 1].t.toLowerCase()} was due ${late[late.length - 1].d}, and it's still in ${stage}.`, daysLeft <= 2 ? "Consider moving the publish date, or cutting scope to make it." : "Block time today for the next step.", { coach: "consistency" });
    else if (daysLeft < 0 && stage !== "Published") add("warn", "The publish date has passed.", "Pick a new date, so the plan works back from it again.", { coach: "consistency" });
  }
  if (!out.some((o) => o.lvl === "bad" || o.lvl === "warn")) add("good", "The structure looks solid.", "Read it out loud once, timing yourself. Then film.");
  return out;
}

/* ---------- the coach: problems creators hit, and what fixes them ---------- */
export const COACH = [
  { id: "hook", cat: "Hooks", p: "People leave in the first 30 seconds", signs: "Big drop at the start of the retention graph; low average view duration.", fix: ["Open with the result or the problem, never a greeting or a logo.", "Say the promise in one sentence within 5 seconds.", "Show it: start on the most visual moment, then rewind.", "Match the title and thumbnail exactly; the first seconds should confirm the click.", "Cut every word you can. A hook under 15 seconds (3 for shorts)."] },
  { id: "stakes", cat: "Hooks", p: "Viewers don't see why it matters to them", signs: "They stay for the hook, then drift away by the one-minute mark.", fix: ["Right after the hook: what they gain, and what it costs to get it wrong.", "Name the person it's for: \"If you design logos for small brands…\"", "Use a real consequence: a lost client, a rejected pitch, wasted hours."] },
  { id: "loop", cat: "Retention", p: "Promises that never pay off", signs: "Comments like \"so where's the thing you mentioned?\"; drop near the end.", fix: ["Every open loop needs a payoff. Note where you'll pay it off as you write it.", "Pay off the biggest loop last, right before the call to action."] },
  { id: "retention", cat: "Retention", p: "Retention sags in the middle", signs: "A slow slide between 2 and 6 minutes.", fix: ["Add a rehook every 60 to 90 seconds: a new question, a surprise, \"here's the mistake I made\".", "Change something on screen at least every few seconds: angle, b-roll, text, zoom.", "Cut tangents. If a part doesn't serve the promise, it goes.", "Put your strongest point second-to-last, not first."] },
  { id: "pacing", cat: "Retention", p: "The video feels slow", signs: "You get bored watching your own edit.", fix: ["Cut pauses and breaths between sentences (jump cuts).", "Remove repeated explanations: say it once, show it once.", "Speed up screen recordings 2 to 4 times.", "Read the script out loud with a timer before filming."] },
  { id: "ending", cat: "Retention", p: "People leave before the end screen", signs: "Sharp drop in the last 20 seconds.", fix: ["Don't announce the ending (\"so, to wrap up…\"). End right after the payoff.", "Point to one specific next video while they're still engaged.", "Keep the outro under 10 seconds."] },
  { id: "script", cat: "Script", p: "The script sounds like reading", signs: "Flat delivery, long sentences, stumbling on words.", fix: ["Write how you talk: short sentences, plain words.", "Read it out loud and rewrite anything you trip over.", "Use bullet points for parts you know well, a full script for the hook and transitions.", "Cut filler words: just, really, actually, basically."] },
  { id: "blank", cat: "Script", p: "Staring at a blank page", signs: "Ideas but no structure; the script never gets started.", fix: ["Start from a formula and fill the blanks.", "Write the title and the promise first. Then the hook. Then the rest.", "Talk it through into your phone and transcribe it.", "Write the ending first: what should they be able to do?"] },
  { id: "promise", cat: "Script", p: "The video tries to say too much", signs: "Hard to sum up in one sentence; runs long.", fix: ["One video, one promise. Write it in one sentence.", "Move extra ideas to the next video (it's content, not waste).", "Every part answers: does this help deliver the promise?"] },
  { id: "length", cat: "Script", p: "Not sure how long it should be", signs: "Padding to hit a length, or cramming too much in.", fix: ["As long as it needs to deliver the promise, no longer.", "Tutorials: usually 6 to 12 minutes. Shorts: 20 to 45 seconds.", "Time the script at your speaking pace before filming; edit later is harder."] },
  { id: "broll", cat: "Filming", p: "Too much talking head", signs: "Visual sameness; retention dips during explanations.", fix: ["Plan b-roll while writing: what's on screen for each sentence?", "Film the process: screen recordings, sketches, hands, mockups.", "Collect a reusable b-roll library: desk, tools, city, materials.", "Show the work as you talk about it; design is visual."] },
  { id: "audio", cat: "Filming", p: "The sound isn't good", signs: "Echo, hum, uneven volume; people mention it in comments.", fix: ["A lav or a dynamic mic close to your mouth beats an expensive camera.", "Soft furnishings kill echo: rugs, curtains, a duvet behind the camera.", "Record a few seconds of room tone for the edit.", "Normalise loudness to around -14 LUFS for YouTube."] },
  { id: "light", cat: "Filming", p: "The picture looks flat or dark", signs: "Muddy face, noisy image.", fix: ["Face a window, or one soft light at 45 degrees.", "Add a small light behind you to separate you from the background.", "Lock exposure and white balance so they don't shift mid-take."] },
  { id: "camera", cat: "Filming", p: "Awkward on camera", signs: "Many retakes; stiff delivery.", fix: ["Talk to one person you know, not 'the audience'.", "Film the hook last, when you're warmed up.", "Keep energy a notch above normal; the camera flattens it.", "Use the script as a guide, not a teleprompter, for the middle."] },
  { id: "edit", cat: "Editing", p: "Editing takes forever", signs: "Each video takes days to edit; you put it off.", fix: ["Script and plan b-roll first: less to decide in the edit.", "Make templates: titles, lower thirds, end screen, music.", "Do a rough cut first, then polish. Don't polish while cutting.", "Set a time limit per video and stick to it."] },
  { id: "title", cat: "Packaging", p: "Low click-through rate", signs: "Impressions but few clicks (under about 4%).", fix: ["Make the title a promise or a question they want answered.", "Front-load interesting words; keep under 60 characters.", "Write 10 titles, pick the one you'd click.", "Title and thumbnail should work together, not repeat each other."] },
  { id: "thumbnail", cat: "Packaging", p: "The thumbnail doesn't stand out", signs: "Low CTR on home and search.", fix: ["One subject, big and clear, readable at phone size.", "Emotion: a face reacting, or a striking before/after.", "3 to 4 words maximum, adding to the title.", "Contrast against YouTube's white and dark backgrounds.", "Test two versions (YouTube's Test & Compare)."] },
  { id: "cta", cat: "Growth", p: "Asking for subscribes doesn't work", signs: "Viewers leave at the ask; few subscribes per view.", fix: ["Give value first. Ask after a payoff, not before.", "Make the ask specific: \"a breakdown like this every week\".", "One ask per video. The strongest is the next video, on the end screen."] },
  { id: "ideas", cat: "Ideas", p: "Running out of ideas", signs: "Last-minute topics; inconsistent uploads.", fix: ["Keep an ideas list and add to it daily (the Idea stage here).", "Turn comments and client questions into videos.", "Remake your best video from a new angle.", "Series: one format, many topics."] },
  { id: "niche", cat: "Ideas", p: "Not sure who it's for", signs: "Views come from very different people; little returning audience.", fix: ["Picture one viewer: a young designer, a small-business owner, a founder…", "Write titles in their words, about their problems.", "It's fine to start broad; double down on what returning viewers watch."] },
  { id: "consistency", cat: "Workflow", p: "Hard to stay consistent", signs: "Long gaps between videos; projects stuck in editing.", fix: ["Pick a rhythm you can keep (one a week, or one a fortnight).", "Batch: write two scripts in a day, film two in a day.", "Work back from the publish date (Schedule tab) and put the steps in your tasks.", "Keep two videos ahead in the pipeline as a buffer."] },
  { id: "burnout", cat: "Workflow", p: "Burning out", signs: "Dread before filming; quality dipping.", fix: ["Lower the bar for some videos: shorts, quick tips, behind the scenes.", "Reuse: one long video becomes three shorts and a post.", "Take planned breaks and tell your audience."] },
  { id: "analytics", cat: "Growth", p: "Not sure what's working", signs: "Guessing what to make next.", fix: ["Look at two numbers per video: click-through rate (packaging) and average view duration (content).", "Find where retention drops and note why; fix it in the next script.", "Compare against your own last 10 videos, not other channels."] },
  { id: "shorts", cat: "Shorts", p: "Shorts don't take off", signs: "Low viewed vs swiped away.", fix: ["Start mid-action; no setup.", "One idea, under 45 seconds.", "Loop the ending into the start.", "Big captions; most watch without sound."] },
  { id: "comments", cat: "Growth", p: "Few comments", signs: "Views but little conversation.", fix: ["Ask a specific question, not \"let me know what you think\".", "Reply to early comments in the first hour.", "Pin a comment that starts a discussion."] },
  { id: "seo", cat: "Packaging", p: "Videos aren't found in search", signs: "Little traffic from search.", fix: ["Use the words people search in the title and first lines of the description.", "Add chapters (the Publish tab writes them from your parts).", "Say the key phrase out loud in the first 30 seconds; captions are indexed."] },
];
export const COACH_BY = Object.fromEntries(COACH.map((c) => [c.id, c]));

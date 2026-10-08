// Content Studio, owner only. Each video is a row in the Content calendar database (Workspace); its plan lives here.
// New keys only:
//   studio-lib            {rev, blocks:[{id, kind, name, text, tags, uses, fav, mine}], formulas:[{id, name, desc, fmt, steps:[{kind, sec, block?}], uses, mine}]}
//   studio-v-<rowId>      {rev, topic, promise, audience, fmt, target, wpm, segs, titles, thumbs, desc, tags, shoot, schedule, links}
//   studio-v-hist-<rowId> [{ts, doc}]   earlier copies (every 10 minutes and before big removals)
// The starter blocks and formulas are only written when studio-lib is missing; after that they are yours to change.
const rid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const num = (v, lo, hi, d) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export const LIB = "studio-lib", vKey = (id) => `studio-v-${id}`, vHist = (id) => `studio-v-hist-${id}`;
export const okId = (v) => typeof v === "string" && /^[\w-]{4,32}$/.test(v);
export const KINDS = ["hook", "rehook", "stakes", "loop", "payoff", "story", "point", "proof", "transition", "cta", "intro", "outro", "broll"];

/* ---------- the starter set: written once, then edited by you ---------- */
const B = (kind, name, text, tags = []) => ({ id: rid(), kind, name, text, tags, uses: 0, fav: false });
export function starterBlocks() {
  return [
    // hooks: the first seconds decide everything
    B("hook", "Everyone gets it wrong", "Most people get {topic} wrong. Here's the one thing that actually works.", ["contrarian"]),
    B("hook", "So you don't have to", "I spent {time} on {topic} so you don't have to. Here's everything I learned.", ["effort"]),
    B("hook", "This is for you if", "If you {pain}, this video is for you.", ["audience"]),
    B("hook", "Result first", "This is {result}. By the end of this video, you'll know exactly how to make it.", ["visual", "promise"]),
    B("hook", "Numbered mistakes", "{number} {topic} mistakes that quietly ruin your work. The last one is the one nobody talks about.", ["list", "loop"]),
    B("hook", "Stop doing this", "Stop {mistake}. Do this instead.", ["direct"]),
    B("hook", "Backwards", "What if everything you know about {topic} is backwards?", ["curiosity"]),
    B("hook", "Years in a minute", "Here's a {topic} trick that took me years to learn. You'll have it in under a minute.", ["value"]),
    B("hook", "Before and after", "{before}. Then {after}. Let me show you what changed.", ["visual", "transformation"]),
    B("hook", "Nobody tells you", "Nobody tells you this about {topic}.", ["curiosity"]),
    B("hook", "I tried it", "I tried {topic} for {time}. Here's what actually happened.", ["experiment"]),
    B("hook", "One small change", "You're one small change away from {result}.", ["promise"]),
    B("hook", "Advice is wrong", "The {topic} advice everyone repeats is wrong. Here's why, and what to do instead.", ["contrarian"]),
    B("hook", "Spot the problem", "Can you spot what's wrong with this {thing}? Most designers can't.", ["question", "visual"]),
    B("hook", "Why it looks easy", "Why does {topic} look effortless for some designers and impossible for others?", ["question"]),
    B("hook", "Made in", "I made this {thing} in {time}. Here's the whole process, start to finish.", ["process"]),
    B("hook", "Unpopular opinion", "Unpopular opinion: {opinion}. Let me explain.", ["contrarian"]),
    B("hook", "The client question", "A client asked me: \"{question}\" My answer changed how they saw the whole project.", ["story"]),
    B("hook", "Three seconds", "You have about three seconds to {result}. Here's how to use them.", ["stakes"]),
    B("hook", "The secret is boring", "The secret to {result} isn't talent. It's this boring habit.", ["curiosity"]),
    // rehooks: a new reason to stay, every minute or so
    B("rehook", "Gets interesting", "But here's where it gets interesting."),
    B("rehook", "Why people quit", "Now, this next part is the reason most people give up on {topic}."),
    B("rehook", "Back to the start", "Remember {thing} from the start? This is why it matters."),
    B("rehook", "Nobody shows you", "And this is the part nobody shows you."),
    B("rehook", "Quick question", "Quick question before we go on: {question}?"),
    B("rehook", "Remember one thing", "If you only remember one thing from this video, make it this."),
    B("rehook", "It gets better", "Wait, it gets better."),
    B("rehook", "My first mistake", "Here's the mistake I made the first time I tried this."),
    B("rehook", "Let me prove it", "Don't take my word for it. Let me prove it."),
    B("rehook", "It comes together", "Okay, this is where it all comes together."),
    B("rehook", "Last step", "Stay with me, because the last step changes everything."),
    B("rehook", "Ten times better", "That works. Now let's make it ten times better."),
    // stakes: why it matters to them
    B("stakes", "Skip it and", "If you skip this, {pain} keeps happening, and you won't know why."),
    B("stakes", "Right or wrong", "Get this right and {result}. Get it wrong and {pain}."),
    B("stakes", "The difference", "This is the difference between {before} and {after}."),
    B("stakes", "Seconds to judge", "Clients decide in seconds whether they trust you. This is what they're judging."),
    B("stakes", "Where most lose", "Most {audience} lose {thing} right here, without noticing."),
    B("stakes", "One decision", "This one decision affects everything that comes after it."),
    B("stakes", "I lost a client", "I once lost a client over this. You don't have to."),
    B("stakes", "On your own", "By the end, you'll be able to {result} on your own, every time."),
    // open loops and their payoffs
    B("loop", "Best for last", "I'll show you the one that surprised me most at the very end."),
    B("loop", "The rule that breaks them", "There's one rule that breaks all of these. We'll get to it."),
    B("loop", "Keep an eye on", "Keep an eye on {thing}; it comes back later, and it's the key."),
    B("loop", "The daily one", "The last tip is the one I use every single day."),
    B("payoff", "The promised rule", "Remember the rule I promised? Here it is: {rule}."),
    B("payoff", "How it changes", "And that's how {before} becomes {after}."),
    B("payoff", "Full picture", "So here's the full picture: {summary}."),
    B("payoff", "The daily tip", "That last tip? It's {thing}. Use it on your next project."),
    // story beats
    B("story", "Setup", "A while ago I was working on {thing}, and everything was going well…"),
    B("story", "Conflict", "Until {problem}. And I had {time} to fix it."),
    B("story", "Turn", "That's when I realised {insight}."),
    B("story", "Lesson", "What I learned: {lesson}. And it works far beyond {topic}."),
    // points, proof and transitions
    B("point", "Why, how, example", "{point}.\nWhy it works: …\nHow to do it: …\nExample on screen: …"),
    B("point", "Step on screen", "Step {n}: {step}. (Show it on screen while you say it.)"),
    B("point", "Myth and reality", "Myth: {myth}.\nReality: {reality}.\nWhat to do instead: …"),
    B("point", "Do this, not that", "Do this: {do}.\nNot this: {dont}.\n(Side by side on screen.)"),
    B("point", "Quick tip", "Quick one: {tip}. Takes ten seconds and you'll notice it everywhere."),
    B("proof", "Client example", "Here's a real example from a client project: {example}."),
    B("proof", "Numbers", "The numbers: {stat}."),
    B("proof", "Side by side", "Side by side: before on the left, after on the right."),
    B("transition", "Now that you know", "Now that you know {a}, let's talk about {b}."),
    B("transition", "Why to how", "That's the why. Here's the how."),
    B("transition", "Ties it together", "Next, the part that ties it all together."),
    // calls to action, intros and outros
    B("cta", "Next video", "If this helped, the next video on {topic} goes deeper. It's right here."),
    B("cta", "Save it", "Save this for your next project. You'll need it."),
    B("cta", "Comment question", "Tell me in the comments: {question}?"),
    B("cta", "Subscribe for more", "If you want a {topic} breakdown like this every week, subscribe."),
    B("cta", "Free resource", "The {thing} I used is free, link in the description."),
    B("intro", "Who and what", "I'm Rohan, a brand designer. In this video: {promise}."),
    B("intro", "Straight in", "Let's get straight into it."),
    B("outro", "Go make", "That's it. Go make something great, and I'll see you in the next one."),
    B("outro", "Recap", "Quick recap: {recap}. Now go try it on your own work."),
    // b-roll ideas you reach for again and again
    B("broll", "Screen recording", "Screen recording of the process, sped up 4x with the cursor visible."),
    B("broll", "Hands and tools", "Close-up of hands sketching on paper or using the pen tablet."),
    B("broll", "Before/after wipe", "Before/after wipe transition on the final design."),
    B("broll", "Mockups", "The work on real mockups: packaging, signage, phone screen."),
    B("broll", "Reference board", "Slow pan across the moodboard or reference wall."),
    B("broll", "Desk wide shot", "Wide shot of the desk setup, natural light."),
  ];
}
const F = (name, desc, fmt, steps) => ({ id: rid(), name, desc, fmt, steps: steps.map(([kind, sec]) => ({ kind, sec })), uses: 0 });
export function starterFormulas() {
  return [
    F("Classic tutorial", "Teach one skill in 8 to 10 minutes", "long", [["hook", 10], ["stakes", 15], ["intro", 10], ["point", 80], ["rehook", 8], ["point", 80], ["rehook", 8], ["point", 80], ["rehook", 8], ["point", 80], ["payoff", 25], ["cta", 15], ["outro", 10]]),
    F("List of tips", "Five tips, best one last", "long", [["hook", 10], ["loop", 8], ["stakes", 15], ["point", 55], ["point", 55], ["rehook", 8], ["point", 55], ["point", 55], ["rehook", 8], ["point", 70], ["payoff", 20], ["cta", 15]]),
    F("Story and lesson", "A real project, what went wrong, what you learned", "long", [["hook", 10], ["story", 40], ["story", 45], ["rehook", 8], ["story", 40], ["story", 40], ["point", 60], ["cta", 15], ["outro", 10]]),
    F("Myth busting", "Three things people believe, and what's true", "long", [["hook", 10], ["stakes", 15], ["point", 70], ["rehook", 8], ["point", 70], ["point", 70], ["payoff", 20], ["cta", 15]]),
    F("Case study", "Before and after, and the process between", "long", [["hook", 8], ["stakes", 15], ["point", 55], ["point", 55], ["rehook", 8], ["point", 55], ["point", 55], ["proof", 30], ["payoff", 20], ["cta", 15]]),
    F("Short", "30 to 45 seconds, one idea", "short", [["hook", 3], ["point", 12], ["point", 12], ["payoff", 8], ["cta", 4]]),
    F("Short: before/after", "Show the result, then the one change", "short", [["hook", 3], ["proof", 8], ["point", 15], ["payoff", 6], ["cta", 3]]),
  ];
}

/* ---------- cleaning what comes in ---------- */
export function cleanLib(b) {
  const blocks = (Array.isArray(b.blocks) ? b.blocks : []).slice(0, 1500).map((x) => ({ id: okId(x.id) ? x.id : rid(), kind: KINDS.includes(x.kind) ? x.kind : "point", name: str(x.name, 80), text: str(x.text, 3000), tags: (Array.isArray(x.tags) ? x.tags : []).map((t) => str(t, 30)).filter(Boolean).slice(0, 12), uses: num(x.uses, 0, 1e6, 0), fav: !!x.fav, ...(x.mine ? { mine: true } : {}), ...(x.score != null ? { score: num(x.score, 0, 5, 0) } : {}) })).filter((x) => x.text);
  const formulas = (Array.isArray(b.formulas) ? b.formulas : []).slice(0, 200).map((f) => ({ id: okId(f.id) ? f.id : rid(), name: str(f.name, 80) || "Formula", desc: str(f.desc, 200), fmt: f.fmt === "short" ? "short" : "long", steps: (Array.isArray(f.steps) ? f.steps : []).slice(0, 60).map((s) => ({ kind: KINDS.includes(s.kind) ? s.kind : "point", sec: num(s.sec, 1, 1800, 30), ...(okId(s.block) ? { block: s.block } : {}) })), uses: num(f.uses, 0, 1e6, 0), ...(f.mine ? { mine: true } : {}) }));
  return { blocks, formulas };
}
const cleanItems = (list, n, len) => (Array.isArray(list) ? list : []).slice(0, n).map((x) => ({ id: okId(x.id) ? x.id : rid(), t: str(x.t, len), ...(x.done ? { done: true } : {}), ...(x.pick ? { pick: true } : {}), ...(x.kind ? { kind: str(x.kind, 12) } : {}), ...(x.note ? { note: str(x.note, 300) } : {}) })).filter((x) => x.t);
export function cleanVideo(b) {
  const segs = (Array.isArray(b.segs) ? b.segs : []).slice(0, 120).map((s) => ({ id: okId(s.id) ? s.id : rid(), kind: KINDS.includes(s.kind) ? s.kind : "point", title: str(s.title, 120), script: str(s.script, 12000), sec: s.sec == null || s.sec === "" ? null : num(s.sec, 1, 3600, null), broll: cleanItems(s.broll, 40, 300), notes: str(s.notes, 2000), ...(okId(s.block) ? { block: s.block } : {}), ...(s.shot ? { shot: str(s.shot, 20) } : {}), ...(s.plan ? { plan: num(s.plan, 1, 3600, 30) } : {}) }));
  return {
    topic: str(b.topic, 200), promise: str(b.promise, 400), audience: str(b.audience, 200), fmt: b.fmt === "short" ? "short" : "long",
    target: num(b.target, 10, 7200, b.fmt === "short" ? 45 : 600), wpm: num(b.wpm, 90, 220, 150),
    fill: Object.fromEntries(Object.entries(b.fill && typeof b.fill === "object" ? b.fill : {}).slice(0, 40).map(([k, v]) => [str(k, 30).replace(/[^\w]/g, ""), str(v, 200)]).filter(([k]) => k)),
    segs, titles: cleanItems(b.titles, 30, 140), thumbs: cleanItems(b.thumbs, 30, 120), desc: str(b.desc, 5000), tags: str(b.tags, 600),
    shoot: { gear: cleanItems(b.shoot?.gear, 60, 120), places: cleanItems(b.shoot?.places, 30, 160), todo: cleanItems(b.shoot?.todo, 60, 200), date: /^\d{4}-\d{2}-\d{2}$/.test(b.shoot?.date || "") ? b.shoot.date : "" },
    plan: (Array.isArray(b.plan) ? b.plan : []).slice(0, 20).map((p) => ({ k: str(p.k, 20), d: /^\d{4}-\d{2}-\d{2}$/.test(p.d || "") ? p.d : "", ...(p.task && okId(p.task) ? { task: p.task } : {}) })),
    notes: str(b.notes, 8000),
    done: (Array.isArray(b.done) ? b.done : []).map((x) => str(x, 80)).slice(0, 400),
  };
}
export async function loadLib(store) {
  let lib = await store.get(LIB, { type: "json" });
  if (!lib) { lib = { rev: 1, blocks: starterBlocks(), formulas: starterFormulas(), seeded: Date.now() }; await store.setJSON(LIB, lib); }
  return lib;
}
export async function keepCopy(store, id, doc, force) {
  const hist = (await store.get(vHist(id), { type: "json" })) ?? [];
  if (!force && hist.length && Date.now() - hist[0].ts < 10 * 60e3) return;
  await store.setJSON(vHist(id), [{ ts: Date.now(), doc }, ...hist].slice(0, 30));
}

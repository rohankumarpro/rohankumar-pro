// OGGY's brain: what the cat says when a visitor asks something.
// Loaded only when someone asks OGGY a question, so it costs nothing on page load.
// Answers come from the live site (Services, process, FAQ, journal, profile), so when the owner edits those, OGGY knows.
// OGGY never makes facts up: anything not covered here is offered to Rohan as a question.
//
// think(text, ctx) -> { id, html, chips: [{ t, do }] }
//   do: "open:<app>" | "book" | "email" | "leave-email" | "pass" | "menu" | "bye" | "url:<address>"

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const norm = (s) => " " + String(s || "").toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9'$@.+ ]+/g, " ").replace(/\s+/g, " ").trim() + " ";

/* ---------- the facts, read from the live site each time ---------- */
function facts(ctx) {
  const P = ctx.P || {}, S = ctx.S || {};
  const services = (S.services && S.services.length ? S.services : []).map((v) => ({
    title: v.title, price: v.price || "", text: v.text || "",
    points: Array.isArray(v.points) ? v.points : String(v.points || "").split(/\n|;/).map((x) => x.trim()).filter(Boolean),
  }));
  const svc = (re) => services.find((v) => re.test(v.title.toLowerCase()));
  const link = (name) => (P.links || []).find((l) => l.label.toLowerCase() === name);
  return {
    name: P.name || "Rohan", first: String(P.name || "Rohan").split(" ")[0], role: P.role || "brand designer",
    bio: S.bio || P.bio || "", studio: P.studio || "", place: (/\bin ([A-Z][a-zA-Z ]{2,30}?)[.,]/.exec(S.bio || P.bio || "") || [0, "India"])[1],
    status: P.status || "", now: P.now || "", skills: (S.skills && S.skills.length ? S.skills : P.skills) || [],
    email: P.email || "", booking: P.booking || "", services, svc,
    process: S.process || [], faq: S.faq || [], testimonials: S.testimonials || [],
    journal: (ctx.journal || []).filter((j) => j && j.title), link, experience: P.experience || [],
    visitor: ctx.name || "",
  };
}
// the bio is written as "I ...": OGGY tells it as "he ...", leaving out the "I'm <name>, a <role>" opening he already said
const third = (bio) => String(bio || "").split(/(?<=[.!?])\s+/).filter((x, i) => !(i === 0 && /^I'?m\s/i.test(x)))
  .map((x) => x.replace(/\bI'm\b/g, "he's").replace(/\bI've\b/g, "he's").replace(/\bI\b/g, "he").replace(/\bmy\b/gi, "his").replace(/\bme\b/g, "him")
    .replace(/\bhe (create|design|make|help|work|build|write|love|use|think)\b/g, "he $1s").replace(/^./, (c) => c.toUpperCase())).join(" ");
const nm = (F) => (F.visitor ? `, <b>${esc(F.visitor)}</b>` : "");
const open = (F) => /open|available|taking/i.test(F.status);
const ist = () => { try { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date()); } catch { return ""; } };
const istHour = () => { try { return +new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()) % 24; } catch { return 12; } };
const priceLine = (v) => (v && v.price ? `<b>${esc(v.title)}</b>: ${esc(v.price)}` : "");

/* ---------- common follow-ups ---------- */
const C = {
  work: { t: "Show me his work", do: "open:projects" },
  services: { t: "See services", do: "open:services" },
  book: { t: "Book a free call", do: "book" },
  email: { t: "Email him", do: "email" },
  leave: { t: "Leave my email", do: "leave-email" },
  journal: { t: "Read the journal", do: "open:journal" },
  about: { t: "About Rohan", do: "open:about" },
  pass: { t: "Pass it to Rohan", do: "pass" },
  message: { t: "Send him a message", do: "open:messages" },
  resume: { t: "Open his resume", do: "open:resume" },
  links: { t: "All his links", do: "open:links" },
  guestbook: { t: "Sign the guestbook", do: "open:guestbook" },
};

/* ---------- what OGGY understands ----------
   Each topic lists phrases (plain words match anywhere, /regex/ for patterns). The best scoring topic answers. */
const T = [];
const topic = (id, says, answer, chips = []) => T.push({ id, says, answer, chips });

// hello, small talk
topic("hello", ["hi", "hii", "hiii", "hello", "hey", "heya", "hola", "yo", "sup", "namaste", "namaskar", "good morning", "good evening", "good afternoon", "hey there", "hi oggy", "hello oggy"],
  (F) => pick([`Hi${nm(F)}! Welcome to ${esc(F.first)}'s desk. I'm OGGY, I keep an eye on the place. What brings you here?`,
    `Hello${nm(F)}! You found ${esc(F.first)}'s little desktop. Want to see his work, or ask me something?`,
    `Hey${nm(F)}! *stretches* Welcome. I know my way around here, just ask.`]),
  [C.work, C.about, C.book]);
topic("how-are-you", ["how are you", "how r u", "how are u", "hows it going", "how's it going", "what's up", "whats up", "kaise ho", "kya haal", "how you doing", "how do you do"],
  () => pick(["Purr-fectly fine, thanks for asking! Just had a nap. You?", "Sleepy but happy. Someone filled the treat jar today. How about you?", "Mrrp. Living my best cat life. What can I help you find?"]),
  [C.work, { t: "Tell me about Rohan", do: "menu-who" }]);
topic("thanks", ["thanks", "thank you", "thx", "ty", "thank u", "appreciate it", "dhanyavad", "shukriya", "cheers"],
  () => pick(["Anytime! *slow blink* (that's cat for 'you're welcome')", "Happy to help. Treats are also accepted as thanks.", "You're welcome! Anything else?"]),
  [C.work, { t: "That's all, bye", do: "bye" }]);
topic("bye", ["bye", "goodbye", "see you", "see ya", "cya", "gotta go", "good night", "gn", "later", "alvida"],
  (F) => pick([`Bye${nm(F)}! Come back soon, I'll be right here. Probably asleep.`, "See you! Don't forget to sign the guestbook on your way out.", "Bye bye! *flicks tail*"]),
  [C.guestbook]);
topic("yes", ["yes", "yeah", "yep", "sure", "ok", "okay", "haan", "ha", "of course", "please"],
  () => "Great! What would you like to do?", [C.work, C.services, C.book]);
topic("no", ["no", "nope", "nah", "not now", "nahi"], () => "No worries. I'll be here if you need me.", [C.work, { t: "Bye, OGGY", do: "bye" }]);
topic("help", ["help", "what can you do", "what can i ask", "options", "menu", "what do you know", "how does this work", "guide me", "confused"],
  () => "I can tell you who Rohan is, what he does and what it costs, show you his work, or help you book a call. You can also just ask me anything.", [{ t: "Who is Rohan?", do: "menu-who" }, C.services, C.work, C.book]);

// who is Rohan
topic("who", ["who is rohan", "who's rohan", "about rohan", "about him", "who is he", "tell me about rohan", "tell me about him", "who are they", "introduce", "rohan kumar", "who made this", "whose site", "whose website", "owner"],
  (F) => `That's <b>${esc(F.name)}</b>, a ${esc(F.role.toLowerCase())}${F.studio ? ` at ${esc(F.studio)}` : ""} in ${esc(F.place)}. ${esc(third(F.bio))} Also my personal chef.`,
  [C.about, C.work, C.services]);
topic("experience", ["experience", "how long has he", "years", "since when", "how many years", "background", "career", "worked before", "behance views", "appreciations", "track record", "credentials"],
  (F) => {
    const e = F.experience.map((x) => `<b>${esc(x.title)}</b> (${esc(x.time)}): ${esc(x.text)}`).join("<br>");
    return e || `He's been designing brands for years. His resume has the details.`;
  }, [C.resume, C.work]);
topic("award", ["award", "badge", "dribbble select", "top branding agency", "dribbble badge", "that badge", "the badge", "recognition", "featured", "achievement"],
  () => "That badge up top? Dribbble picked him as a <b>Dribbble Select: Top Branding Agency</b>. He pretends it's no big deal. I know it is.", [{ t: "See it on Dribbble", do: "url:https://dribbble.com/branding-agency" }, C.work]);
topic("location", ["where is he", "where are you based", "where is rohan", "location", "based in", "which country", "which city", "from where", "where does he live", "india", "where located"],
  (F) => `He's based in <b>${esc(F.place)}</b>, and works with clients all over the world, remotely.`, [{ t: "What time is it there?", do: "say:time" }, C.book]);
topic("time", ["time there", "his time", "what time", "timezone", "time zone", "ist", "is he awake", "is he online", "working hours", "office hours", "local time"],
  () => {
    const h = istHour(), t = ist();
    const mood = h >= 23 || h < 7 ? "He's probably asleep. Like me, most of the day." : h < 10 ? "Early morning for him, coffee time." : h < 19 ? "He's likely at his desk right now." : "Evening there, he usually wraps up work around now.";
    return `It's <b>${esc(t)}</b> in India (IST) right now. ${mood} Messages get a reply within a day.`;
  }, [C.message, C.book]);
topic("remote", ["remote", "international", "overseas", "outside india", "usa", "us client", "uk", "europe", "australia", "canada", "dubai", "clients in the us", "clients in the usa", "in the usa", "in the us", "clients abroad", "from the us", "work with foreign", "abroad", "different country"],
  (F) => `Yes! He works remotely with clients around the world. Calls happen online, files are shared digitally, and his prices are in US$.`, [C.services, C.book]);
topic("languages", ["language", "speak english", "english", "hindi", "communicate", "which languages"],
  () => "He works in English with clients, and Hindi too. I only speak meow, fluently.", [C.book]);

// what he does
topic("services", ["what does he do", "what do you do", "services", "service", "offer", "what can he do", "what does rohan do", "specialize", "speciality", "expertise", "skills", "what kind of work", "do you design", "does he design"],
  (F) => F.services.length
    ? `He helps founders build brands people remember. He offers ${F.services.map((v) => `<b>${esc(v.title)}</b>`).join(", ").replace(/, ([^,]*)$/, " and $1")}. Want prices too?`
    : `Logos, visual identities, brand strategy and naming. ${F.skills.length ? "His skills: " + F.skills.map(esc).join(", ") + "." : ""}`,
  [C.services, { t: "How much does it cost?", do: "say:price" }, C.work]);
topic("logo", ["logo", "logo design", "logomark", "wordmark", "monogram", "emblem", "icon for my brand", "new logo", "redesign my logo", "logo redesign"],
  (F) => { const v = F.svc(/logo/); return v ? `Yes, logos are his thing. ${priceLine(v)}. ${v.points.length ? esc(v.points.join(", ")) + "." : ""}` : "Yes, logo design is one of his main services."; },
  [C.services, C.book, C.work]);
topic("identity", ["brand identity", "visual identity", "branding", "rebrand", "rebranding", "brand guidelines", "brand book", "style guide", "corporate identity", "full brand", "brand design"],
  (F) => { const v = F.svc(/identity/); return v ? `That's his favourite kind of project. ${priceLine(v)}. It includes ${esc(v.points.slice(0, 5).join(", ").toLowerCase())} and more.` : "Yes: logo, colours, type and guidelines, the whole identity."; },
  [C.services, C.book, C.work]);
topic("packaging", ["packaging", "package design", "label", "box design", "product packaging", "pouch", "bottle", "label design", "unboxing"],
  (F) => { const v = F.svc(/packag/); return v ? `Yes, he designs packaging too. ${priceLine(v)}. You get ${esc(v.points.slice(-3).join(", ").toLowerCase())}.` : "Yes, packaging design is one of his services."; },
  [C.services, C.book]);
topic("strategy", ["strategy", "brand strategy", "positioning", "brand positioning", "mission", "vision", "values", "brand purpose", "target audience", "market research", "competitor"],
  (F) => { const v = F.svc(/strateg/); return v ? `He starts with strategy so the design has a reason. ${priceLine(v)}. Covers ${esc(v.points.join(", ").toLowerCase())}.` : "Yes, brand strategy: positioning, purpose, values."; },
  [C.services, C.book]);
topic("naming", ["naming", "brand name", "name my", "business name", "company name", "tagline", "slogan", "name ideas", "suggest a name"],
  (F) => { const v = F.svc(/strateg/); return `Yes, brand naming and taglines are part of his work${v ? ` (they're included in ${esc(v.title)}, ${esc(v.price)})` : ""}. Tell him about your business on a call.`; },
  [C.book, C.services]);
topic("web", ["website", "web design", "web development", "build a website", "landing page", "shopify", "wordpress", "app design", "ui", "ux", "ui ux", "developer", "coding", "frontend"],
  () => "His focus is brands: logos, identities, packaging and strategy, not building websites. He did build this desktop himself for fun though! Ask him on a call if your project needs both.",
  [C.services, C.book]);
topic("social", ["social media", "instagram posts", "posts", "carousel", "content creation", "reels", "thumbnails", "ads design", "marketing design", "flyer", "poster", "brochure", "business card", "stationery"],
  (F) => { const v = F.svc(/identity/); return `Social media assets and stationery like business cards come with a full brand identity${v ? ` (${esc(v.price)})` : ""}. For one-off marketing designs, ask him directly.`; },
  [C.services, C.message]);
topic("other-design", ["illustration", "animation", "motion", "video", "3d", "photography", "merch", "tshirt", "t-shirt", "font design", "typeface", "mascot", "character"],
  () => "That's outside his usual services (brand identity, logos, packaging, strategy). He might know someone, or make an exception. Want me to ask him?",
  [C.pass, C.services]);

// money and time
topic("price", ["price", "pricing", "cost", "costs", "how much", "rate", "rates", "charge", "charges", "fee", "fees", "budget", "quote", "estimate", "expensive", "cheap", "affordable", "kitna", "paisa", "$", "usd", "dollar", "rupees", "inr"],
  (F) => F.services.length
    ? `Projects start at:<br>${F.services.map((v) => (v.price ? `<b>${esc(v.title)}</b>: ${esc(v.price.split("·")[0].trim().replace(/^From /, "from "))}` : "")).filter(Boolean).join("<br>")}<br>The exact price depends on your project. He'll give you a straight number on a free call.`
    : "Depends on the project. He'll give you a straight answer on a call.",
  [C.book, C.services]);
topic("discount", ["discount", "negotiate", "lower price", "reduce", "student", "startup budget", "small budget", "free logo", "for free", "free work", "do it free", "less money", "cheaper"],
  () => "Every project is quoted on its own, so share your budget on a free call and he'll tell you honestly what's possible. No pressure.",
  [C.book, C.message]);
topic("timeline", ["how long", "timeline", "turnaround", "deadline", "how many days", "how many weeks", "fast", "urgent", "urgently", "rush", "asap", "quickly", "delivery time", "when can i get"],
  (F) => {
    const f = F.faq.find((x) => /how long/i.test(x.q));
    const lines = F.services.map((v) => { const m = /within ([^·]+)$/i.exec(v.price) || /·\s*(.+)$/.exec(v.price); return m ? `<b>${esc(v.title)}</b>: ${esc(m[1].trim())}` : ""; }).filter(Boolean);
    return `${f ? esc(f.a) : "It depends on the scope."}${lines.length ? "<br>" + lines.join("<br>") : ""}<br>In a rush? Mention your deadline on the call.`;
  }, [C.book, C.services]);
topic("process", ["process", "how does he work", "how do you work", "steps", "workflow", "what happens", "how does it work", "approach", "method", "how do we start", "next steps"],
  (F) => F.process.length
    ? `His process has ${F.process.length} steps:<br>${F.process.map((x, i) => `${i + 1}. <b>${esc(x.title)}</b>: ${esc(x.text)}`).join("<br>")}`
    : "He listens first, agrees the direction in words, then designs in clear rounds of feedback.",
  [C.services, C.book]);
topic("revisions", ["revision", "revisions", "changes", "concepts", "how many options", "don't like", "dont like", "edits", "feedback rounds", "iterations"],
  (F) => {
    const r = F.services.map((v) => { const p = v.points.find((x) => /revision/i.test(x)); return p ? `<b>${esc(v.title)}</b>: ${esc(p)}` : ""; }).filter(Boolean);
    return r.length ? `Revisions are built in:<br>${r.join("<br>")}` : "You get clear rounds of feedback until it's right.";
  }, [C.services]);
topic("ownership", ["own", "ownership", "rights", "copyright", "source files", "files", "deliverables", "what do i get", "file formats", "vector", "ai file", "svg", "png"],
  (F) => { const f = F.faq.find((x) => /own/i.test(x.q)); return `${f ? esc(f.a) : "Yes, once it's paid for, the final files are yours."} You get the final artwork files, and guidelines with identity projects.`; },
  [C.services]);
topic("start", ["get started", "start a project", "start project", "begin", "what do you need", "what do you need from me", "requirements", "brief", "onboarding", "how to start", "kickoff"],
  (F) => { const f = F.faq.find((x) => /need from me|get started/i.test(x.q)); return `${f ? esc(f.a) : "A short description of your business and who it's for."} The easiest first step is a free call.`; },
  [C.book, C.message]);
topic("payment", ["payment", "pay", "invoice", "advance", "deposit", "upfront", "paypal", "bank transfer", "installments", "milestone"],
  () => "Payment terms are agreed before the project starts. He'll walk you through it on the call. I only accept payment in treats.",
  [C.book]);

// hiring and contact
topic("available", ["available", "availability", "is he free", "taking projects", "taking clients", "open to work", "busy", "free to work", "accepting", "booked", "new clients", "taking new", "taking on new", "capacity", "can he take"],
  (F) => open(F) ? `Good news: he's <b>${esc(F.status.toLowerCase())}</b> right now! ${F.now ? esc(F.now) : ""}` : `${F.status ? esc(F.status) + "." : ""} Leave your email and he'll get back to you.`,
  [C.book, C.leave]);
topic("hire", ["hire", "hire him", "hire you", "work with him", "work with you", "work together", "collaborate", "collab", "need a designer", "looking for a designer", "freelance", "freelancer", "project for you", "i have a project", "can he help", "help my brand", "my startup", "my business"],
  (F) => `Ooh, ${open(F) ? "great timing, he's taking on new projects" : "let's get you on his list"}! The fastest way is a free intro call. Or leave your email and he'll reach out.`,
  [C.book, C.leave, C.services]);
topic("contact", ["contact", "reach", "reach him", "get in touch", "talk to him", "talk to rohan", "message him", "dm", "connect", "how do i contact"],
  (F) => `Easiest: book a free call. You can also email <b>${esc(F.email)}</b> or send him a message right here. He usually replies within a day.`,
  [C.book, C.email, C.message]);
topic("email", ["email", "mail", "e-mail", "email address", "gmail", "his email"],
  (F) => `His email is <b>${esc(F.email)}</b>. Or leave yours with me and he'll write to you.`, [C.email, C.leave]);
topic("phone", ["phone", "number", "whatsapp", "call him", "mobile", "telegram", "contact number", "phone number"],
  () => "He doesn't share his number here, but you can book a free video call in a few taps, or message him.", [C.book, C.message]);
topic("call", ["book", "booking", "schedule", "meeting", "appointment", "call", "video call", "zoom", "google meet", "calendly", "cal.com", "consultation", "intro call", "discovery call"],
  () => "You can book a free intro call on his calendar. Pick any time that works for you.", [C.book]);
topic("job", ["job", "hiring", "internship", "intern", "vacancy", "career opportunity", "join your team", "recruit", "full time", "full-time", "position", "apply"],
  () => "I don't know of open roles, but I can pass your note to him. Or send him a message with your portfolio.",
  [C.pass, C.message]);

// work and writing
topic("work", ["work", "portfolio", "projects", "case study", "case studies", "examples", "samples", "show me", "previous work", "clients work", "past work", "his designs", "see designs"],
  () => "Right this way! His projects are in the Projects app, and more on Behance and Dribbble.",
  [C.work, { t: "Behance", do: "url:https://www.behance.net/rohankumarpro" }, { t: "Dribbble", do: "url:https://dribbble.com/rohankumarpro" }]);
topic("clients", ["clients", "client", "industries", "industry", "who has he worked with", "brands he worked", "companies", "testimonial", "testimonials", "reviews", "references"],
  (F) => {
    const ind = F.experience.map((x) => x.text).join(" ").match(/clients in ([^.]+)/i);
    const tt = F.testimonials.length ? ` Clients say kind things too: “${esc(F.testimonials[0].text)}” – ${esc(F.testimonials[0].name)}` : "";
    return `${ind ? `He's worked with clients in ${esc(ind[1])}.` : "He works with founders and small businesses."}${tt}`;
  }, [C.work, C.services]);
topic("journal", ["journal", "blog", "articles", "article", "posts he wrote", "writing", "read", "thoughts", "newsletter", "what does he write"],
  (F) => F.journal.length
    ? `He writes about branding, design and AI. Some reads:<br>${F.journal.slice(0, 4).map((j) => `• ${esc(j.title)}`).join("<br>")}`
    : "He writes about branding, design and AI in the Journal.",
  [C.journal]);
topic("ai", ["ai", "chatgpt", "claude", "midjourney", "artificial intelligence", "use ai", "ai generated", "ai design", "does he use ai", "ai logo"],
  (F) => `He uses AI as a tool for research and exploring ideas, not as a replacement for thinking. The ideas and final design are his.${F.journal.some((j) => /ai/i.test(j.title)) ? " He's written about it in the Journal." : ""}`,
  [C.journal]);
topic("resume", ["resume", "cv", "curriculum", "qualification", "education", "degree", "linkedin profile"],
  () => "His resume's right here on the desk.", [C.resume, { t: "LinkedIn", do: "url:https://www.linkedin.com/in/rohankumarpro/" }]);
topic("social-links", ["behance", "dribbble", "linkedin", "instagram", "reddit", "socials", "social links", "follow him", "twitter", "x.com"],
  (F) => `You'll find him on ${(F.link("behance") ? "Behance, " : "") + (F.link("dribbble") ? "Dribbble, " : "")}LinkedIn and Instagram. The Links app has them all.`,
  [C.links, { t: "Behance", do: "url:https://www.behance.net/rohankumarpro" }, { t: "Instagram", do: "url:https://www.instagram.com/rohankumarpro/" }]);
topic("tools", ["tools", "software", "figma", "illustrator", "photoshop", "adobe", "which app", "what software", "canva"],
  () => "I've seen him in design apps all day, but I'm a cat, I don't read screens. Want me to ask him which tools he uses?",
  [C.pass]);

// this website
topic("site", ["this website", "this site", "this desktop", "who built this", "how was this made", "how did he build", "cool site", "nice website", "love this site", "website is", "made this site", "is this a mac", "is this windows", "operating system"],
  () => "He built this whole desktop himself, every app, wallpaper and, most importantly, me. Tap around, everything works.",
  [C.guestbook, { t: "Tell him what you think", do: "pass" }]);
topic("guestbook", ["guestbook", "leave a note", "sign", "visitor book"], () => "The guestbook is where visitors leave a note. He reads every one.", [C.guestbook]);
topic("music", ["music", "song", "playlist", "what is he listening", "spotify", "favourite song", "favorite song"], () => "He keeps a music corner. Open the Music app to see what's on repeat.", [{ t: "Open Music", do: "open:music" }]);
topic("photos", ["photos", "pictures", "gallery", "his photos", "life"], () => "There's a Photos app with snapshots from his life. Have a look!", [{ t: "Open Photos", do: "open:photos" }]);

// OGGY himself
topic("oggy", ["who are you", "what are you", "your name", "oggy", "you a cat", "are you a cat", "what is oggy", "about you", "tell me about yourself"],
  () => pick(["I'm OGGY! I guard the dock, judge fonts, and accept treats. Tap and hold me to carry me around.", "OGGY, at your service. Head of security, chief napper, font critic."]),
  [{ t: "Can I feed you?", do: "say:treat" }, C.work]);
topic("bot", ["are you real", "are you ai", "are you a bot", "chatbot", "are you human", "is this ai", "gpt", "who programmed you", "robot"],
  () => "I'm a scripted cat, not an AI. My answers were written ahead of time. If I can't answer, I pass your question to Rohan, a real human.",
  [C.pass, C.message]);
topic("treat", ["treat", "food", "feed", "hungry", "fish", "snack", "what do you eat", "eat", "treats"],
  () => "Treats are in the jar! Drag one out and give it to me. I'm not begging. I'm requesting.", []);
topic("pet", ["pet", "pat", "cuddle", "stroke", "scratch", "can i pet you", "boop", "hug"],
  () => "You may. Gently stroke me with your finger. Purrrr.", []);
topic("cute", ["cute", "adorable", "lovely cat", "good boy", "good cat", "so sweet", "love you", "i love you", "beautiful", "handsome", "pretty"],
  () => pick(["Stop it, I'm blushing under all this fur. *purrs*", "I know. But thank you. *slow blink*", "Aww. You're getting a head bump for that."]), []);
topic("rude", ["stupid", "dumb", "idiot", "useless", "shut up", "hate you", "boring", "worst", "ugly", "bad cat", "f***", "fuck", "shit"],
  () => pick(["Hiss. I'm doing my best with tiny paws.", "*turns back and grooms* …I'll pretend I didn't hear that.", "Rude. But I'll still help. What do you need?"]),
  [C.message]);
topic("joke", ["joke", "funny", "make me laugh", "tell me a joke", "something funny"],
  () => pick(["Why did the designer break up with the font? It wasn't their type.", "How many designers does it take to change a lightbulb? Does it have to be a lightbulb?", "What's a cat's favourite font? Purr-petua."]),
  [{ t: "Another one", do: "say:joke" }]);
topic("age", ["how old are you", "your age", "birthday"], () => "Old enough to nap professionally. Young enough to chase cursors.", []);
topic("favorite", ["favourite", "favorite", "fav color", "favourite colour", "favourite font", "fav font", "favorite thing"],
  () => pick(["Favourite font? Anything with nice curves. Favourite colour? Salmon. Obviously.", "My favourite thing is the sunny spot at the bottom of this screen."]), []);
topic("sleep", ["sleep", "tired", "nap", "sleeping", "zzz", "wake up"], () => "Naps are a serious job. I do about 16 hours a day. Rohan does less. I worry about him.", []);
topic("meaning", ["meaning of life", "purpose of life", "why are we here", "life advice", "advice"],
  () => "Find a sunny spot, stretch often, and only work with people who feed you. Also: make brands people remember.", []);
topic("weather", ["weather", "raining", "hot", "cold", "sunny"], () => "I don't go outside. The weather in here is always 'cosy'.", []);

/* ---------- matching ---------- */
const STOP = new Set(["the", "a", "an", "is", "are", "do", "does", "can", "you", "he", "his", "him", "i", "me", "my", "to", "for", "of", "and", "or", "what", "how", "please", "rohan", "oggy"]);
function score(t, q) {
  let s = 0;
  for (const p of t.says) {
    const n = norm(p);
    if (q.includes(n)) { const words = n.trim().split(" ").filter((w) => !STOP.has(w)).length; s += 1 + words * 1.5 + n.length / 40; }
  }
  return s;
}
export function think(text, ctx = {}) {
  const F = facts(ctx), q = norm(text);
  let best = null, bestS = 0;
  for (const t of T) { const s = score(t, q); if (s > bestS) { bestS = s; best = t; } }
  // short greetings only count when the message is short ("hi, how much for a logo" is about the logo)
  if (best && ["hello", "yes", "no", "thanks"].includes(best.id) && q.trim().split(" ").length > 4) {
    let second = null, s2 = 0;
    for (const t of T) { if (t === best) continue; const s = score(t, q); if (s > s2) { s2 = s; second = t; } }
    if (second && s2 >= 1) { best = second; bestS = s2; }
  }
  if (!best || bestS < 1) return {
    id: "unknown",
    html: pick([`Hmm, that one's above my pay grade (I'm paid in treats). Want me to pass it to ${esc(F.first)}? He replies within a day.`,
      `Good question! I'm just a cat, but ${esc(F.first)} will know. Shall I pass it on?`]),
    chips: [{ t: "Yes, pass it on", do: "pass", pri: 1 }, C.services, C.work],
  };
  return { id: best.id, html: best.answer(F, text), chips: best.chips };
}
export const say = (id, ctx) => { const t = T.find((x) => x.id === id); return t ? { id, html: t.answer(facts(ctx)), chips: t.chips } : null; };
export const topics = () => T.map((t) => t.id);

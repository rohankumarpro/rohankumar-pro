// The prompt guide from the GUIDE reel, word for word.
export const prompts: { title: string; text: string; main?: boolean }[] = [
  { title: "The main prompt", main: true, text: `Write this in plain, natural English, the way a real person would explain it to a friend. Use punctuation normally and avoid em dashes unless one is genuinely needed. Don't set up points as contrasts like "it's not X, it's Y". Avoid filler phrases such as "delve into", "unlock the power of", "in today's fast-paced world", "game-changer" and "let's dive in". Don't repeat a point once it's made, and don't add a summary at the end. Only use lists or headings if they make the information easier to follow. If you're unsure of a detail, ask me instead of making it up.
Here's what I want to say: [your topic, your opinion, any examples or experiences]` },
  { title: "Teach it your voice", text: `Here are a few things I've written myself: [paste 2–3 samples]. Look at how I write: sentence length, word choice, how I open and close, how casual I am. Describe my style back to me in a few lines, then write [your task] in that style. Don't copy my sentences, just match the way I write.` },
  { title: "Give it something real to say", text: `Before you write anything, ask me 5 short questions about my experience, opinions and examples on [topic]. Wait for my answers, then write the piece using only what I tell you. Don't add generic advice or claims I didn't make.` },
  { title: "Fix the punctuation", text: `Go through this text and remove em dashes that interrupt the flow. Replace them with a comma, a full stop or a rewrite, whichever reads most naturally. Keep any that genuinely work. Don't change anything else.
[paste text]` },
  { title: "Break the patterns", text: `Find every sentence in this text built as a contrast or a formula, like "it's not X, it's Y" or "not just X, but Y". Rewrite each one to state the point directly. Leave the rest as it is.
[paste text]` },
  { title: "Remove AI vocabulary", text: `Highlight any words or phrases in this text that sound like typical AI writing or add polish without meaning. For each one, replace it with plain wording or delete it if the sentence works without it. Show me the edited version.
[paste text]` },
  { title: "Cut the repetition", text: `Edit this text so every sentence adds something new. Delete anything that repeats, rephrases or summarises a point already made. Don't add anything. Tell me roughly how much shorter it got.
[paste text]` },
  { title: "Loosen the structure", text: `Rewrite this so the structure fits the content instead of a template. Turn lists back into sentences unless the list genuinely helps, drop headings that aren't needed and remove the wrap-up conclusion if it just repeats things.
[paste text]` },
  { title: "The read-aloud check", text: `Read this as if you were saying it out loud. Point out any sentence that sounds stiff, too long or like something a person wouldn't actually say, and suggest a more natural version for each. Keep the meaning the same.
[paste text]` },
];

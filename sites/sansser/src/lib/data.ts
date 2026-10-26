// Page content for the Links wing. Seeded from link.sansser.com; the admin and database take over in Phase 2 step 5.
import raw from "../data/pages.json";

export type Item = { name: string; tag: string; desc: string; url: string; bonus: boolean };
export type Page = { slug: string; title: string; subtitle: string; items: Item[]; cover: string; keyword: string };

const ORDER = ["guide", "sound", "wow", "repos"]; // newest first
const data = raw as Record<string, Omit<Page, "slug" | "cover" | "keyword">>;

export const pages: Page[] = ORDER.filter((s) => data[s]).map((slug) => ({
  slug,
  ...data[slug],
  cover: `/covers/${slug}.jpg`,
  keyword: slug.charAt(0).toUpperCase() + slug.slice(1),
}));

export const page = (slug: string) => pages.find((p) => p.slug === slug.toLowerCase());

// "9 links + bonus", "1 link", "9 prompts" for the guide
export function count(p: Page) {
  if (p.slug === "guide") return "9 prompts";
  const n = p.items.filter((i) => !i.bonus).length;
  return `${n} ${n === 1 ? "link" : "links"}${p.items.some((i) => i.bonus) ? " + bonus" : ""}`;
}

export const totalLinks = pages.reduce((a, p) => a + (p.slug === "guide" ? 1 : p.items.length), 0);

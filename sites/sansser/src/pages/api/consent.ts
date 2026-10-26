// Whether the newsletter box may start ticked for this visitor (never in the EU, EEA or UK).
import type { APIRoute } from "astro";
import { json, country, newsDefault } from "../../lib/server/http";
export const prerender = false;
export const GET: APIRoute = ({ locals }) => json({ pre: newsDefault(country(locals)) });

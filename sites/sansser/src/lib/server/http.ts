export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

// GDPR (EU, EEA) and UK GDPR: a pre-ticked box is not consent there, so the newsletter box starts unticked.
const CONSENT_FIRST = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB".split(" "));
export function country(locals: App.Locals | Record<string, any>): string {
  try { return String((locals as any)?.netlify?.context?.geo?.country?.code || "").toUpperCase(); } catch { return ""; }
}
export const newsDefault = (cc: string) => !!cc && !CONSENT_FIRST.has(cc);

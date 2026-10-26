// Small Postgres access through Supabase's REST API. Writes are additive; nothing here deletes.
import { dbConfig } from "./env";

type Row = Record<string, unknown>;

export function db(url: URL) {
  const { base, key } = dbConfig(url);
  const ready = !!(base && key);
  async function call(path: string, init: RequestInit & { prefer?: string } = {}) {
    if (!ready) throw new Error("database not configured");
    const r = await fetch(`${base}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.prefer ? { prefer: init.prefer } : {}) },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error(`db ${r.status}: ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  }
  return {
    ready,
    // Insert or keep the existing person; returns their id. First-seen details are never overwritten.
    async person(email: string, info: { country?: string; source?: string; src_tag?: string }) {
      const found = (await call(`people?email=eq.${encodeURIComponent(email)}&select=id`)) as Row[];
      if (found.length) return found[0].id as number;
      const made = (await call("people", { method: "POST", prefer: "return=representation", body: JSON.stringify({ email, ...info }) })) as Row[];
      return made[0].id as number;
    },
    async consent(person_id: number, c: { given: boolean; where_: string; wording: string; pre_ticked?: boolean }) {
      await call("consents", { method: "POST", body: JSON.stringify({ person_id, ...c }) });
    },
    async pageId(keyword: string) {
      const rows = (await call(`pages?keyword=eq.${encodeURIComponent(keyword)}&select=id`)) as Row[];
      return (rows[0]?.id as number) ?? null;
    },
    async unlock(person_id: number, page_id: number, src_tag?: string) {
      await call("unlocks", { method: "POST", body: JSON.stringify({ person_id, page_id, src_tag }) });
    },
    async event(e: { page_id?: number | null; kind: "view" | "unlock" | "outbound"; anon_id?: string; src_tag?: string; target?: string }) {
      await call("events", { method: "POST", body: JSON.stringify(e) });
    },
  };
}

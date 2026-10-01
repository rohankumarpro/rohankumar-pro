// /api/vault-file?id=<id>  One encrypted file from the vault. Owner only. The server never sees the file contents or name.
//   GET -> {data}   PUT {data}   DELETE
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";

const MAX = 4_400_000; // base64 characters, about 3.2 MB of encrypted bytes

export const handler = async (event) => {
  try {
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    connectLambda(event);
    const store = contentStore(event);
    const id = (event.queryStringParameters || {}).id || "";
    if (!/^[a-f0-9]{24}$/.test(id)) return json({ error: "Bad id" }, 400);
    const key = `vault-file-${id}`;
    if (event.httpMethod === "GET") {
      const data = await store.get(key);
      return data == null ? json({ error: "Not found" }, 404) : json({ data });
    }
    if (event.httpMethod === "PUT") {
      const b = body(event);
      if (typeof b?.data !== "string" || !b.data || b.data.length > MAX || !/^[A-Za-z0-9+/]+={0,2}$/.test(b.data)) return json({ error: "Bad file" }, 400);
      await store.set(key, b.data);
      return json({ ok: true });
    }
    if (event.httpMethod === "DELETE") {
      await store.delete(key);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};

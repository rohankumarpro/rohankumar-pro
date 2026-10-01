// /api/photo?id=<id>&s=t|f  Serves one stored photo (t = thumbnail, f = full size).
import { connectLambda, getStore } from "@netlify/blobs";

export const handler = async (event) => {
  try {
    connectLambda(event);
    const q = event.queryStringParameters || {};
    if (!/^[a-f0-9]{12}$/.test(q.id || "")) return { statusCode: 404, body: "Not found" };
    const store = getStore("site-content");
    const buf = await store.get(`photo-${q.id}-${q.s === "t" ? "t" : "f"}`, { type: "arrayBuffer" });
    if (!buf) return { statusCode: 404, body: "Not found" };
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
      body: Buffer.from(buf).toString("base64"),
    };
  } catch (e) {
    return { statusCode: 500, body: "Server error" };
  }
};

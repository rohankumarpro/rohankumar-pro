// /api/photo?id=<id>&s=t|f  Serves one stored photo (t = thumbnail, f = full size).
import { connectLambda } from "@netlify/blobs";
import { contentStore } from "../lib/store.mjs";

export const handler = async (event) => {
  try {
    connectLambda(event);
    const q = event.queryStringParameters || {};
    if (!/^[a-f0-9]{12}$/.test(q.id || "")) return { statusCode: 404, body: "Not found" };
    const data = await contentStore(event).get(`photo-${q.id}-${q.s === "t" ? "t" : "f"}`, { type: "arrayBuffer" });
    if (!data) return { statusCode: 404, body: "Not found" };
    return {
      statusCode: 200,
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
      body: Buffer.from(data).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, body: "Server error" };
  }
};

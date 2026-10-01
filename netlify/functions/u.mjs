// /u/<id>.<ext> and /u/<id>-t.<ext>  Serves an uploaded picture or file with long-lived caching.
import { connectLambda } from "@netlify/blobs";
import { contentStore } from "../lib/store.mjs";
import { kindOf, upKey } from "../lib/media-store.mjs";

export const handler = async (event) => {
  try {
    connectLambda(event);
    const f = String((event.queryStringParameters || {}).f || "");
    const m = f.match(/^([a-f0-9]{10})(-t)?\.(jpe?g|png|webp|gif|pdf)$/i);
    if (!m) return { statusCode: 404, body: "Not found" };
    const store = contentStore(event);
    let buf = await store.get(upKey(m[1], !!m[2]), { type: "arrayBuffer" });
    if (!buf && m[2]) buf = await store.get(upKey(m[1]), { type: "arrayBuffer" }); // no thumbnail: use the full picture
    if (!buf) return { statusCode: 404, body: "Not found" };
    const data = Buffer.from(buf), k = kindOf(data);
    if (!k) return { statusCode: 404, body: "Not found" };
    return {
      statusCode: 200, isBase64Encoded: true, body: data.toString("base64"),
      headers: {
        "content-type": k.mime, "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        ...(k.ext === "pdf" ? { "content-disposition": `inline; filename="${m[1]}.pdf"` } : {}),
      },
    };
  } catch (e) {
    return { statusCode: 500, body: "Server error" };
  }
};

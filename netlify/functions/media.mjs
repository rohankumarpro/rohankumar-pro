// /api/media  The list of journal covers and carousels, so the desktop and the article pages show the same pictures.
import { COVERS, CAROUSELS } from "../lib/media.mjs";

export const handler = async () => ({
  statusCode: 200,
  headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
  body: JSON.stringify({ covers: COVERS, carousels: CAROUSELS }),
});

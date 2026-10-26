// Sansser: one hub for AI tools, guides and the newsletter.
// Pages are static by default; API routes opt in to running on the server.
import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";

export default defineConfig({
  site: "https://link.sansser.com",
  adapter: netlify(),
  trailingSlash: "never",
  devToolbar: { enabled: false },
  build: { format: "file" },
});

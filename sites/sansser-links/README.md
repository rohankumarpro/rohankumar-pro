# link.sansser.com

The Sansser link pages (Netlify site `sansser-links`). This folder deploys on its own; it is not part of rohankumar.pro.

- `public/` the pages: `index.html` (home and newsletter), `page.html` (the link page template), `<slug>.html` (generated), styles and images.
- `netlify/lib/pages.mjs` every link page: title, subtitle, items, install guides.
- `netlify/functions/` `pages` (page info), `unlock` (email unlock, newsletter, emails), `unsubscribe`, `signups` (owner list).

Add or change a page: edit `netlify/lib/pages.mjs`, add `public/assets/og/<slug>.png` (1200x630) if you want a share image,
run `node scripts/page-files.mjs`, then deploy.

Deploy: ask the Netlify connector to deploy site `06f47948-6887-4ffb-aba7-94c90f94ce2a` and run the command it gives
from this folder (or `netlify deploy --prod` here). A deploy replaces code only; sign-ups stay in the `sansser-unlocks` store
and newsletter subscribers in Resend's "Sansser Newsletter" segment.

Settings on the Netlify site: `RESEND_API_KEY`, `UNSUB_SECRET` (unsubscribe tokens, keep it the same or old links break),
`ADMIN_KEY` (for `/api/signups?key=…`, add `&format=csv` for a spreadsheet).

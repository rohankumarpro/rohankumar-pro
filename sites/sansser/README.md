# Sansser

One hub for AI tools, guides, resources and the newsletter. Phase 2 starts with the Links wing (every link from our reels).

## Run it

```
npm install
npm run dev        # http://localhost:4321
npm run build
```

Node 22.22 or newer. Without database keys the site still runs; sign-ups are logged as not saved.

## Where things are

| Path | What |
| --- | --- |
| `src/pages/` | Home, reel pages (`/r/[keyword]`), the prompt guide, newsletter, unsubscribe, API routes |
| `src/layouts/Base.astro` | Header with search, footer, fonts, scripts |
| `src/styles/site.css` | Design tokens and every component style |
| `src/scripts/fx.js` | The living gradient: one WebGL shader seen through `.fx` windows, only during interaction |
| `src/scripts/kit.js` | Decode, toasts, HUD brackets, cover scan, command palette, Copy |
| `src/scripts/forms.js` | Unlock popup and newsletter forms |
| `src/lib/server/` | Database (sandbox for previews), Resend, consent defaults |
| `supabase/migrations/` | Database tables (additive only) |
| `src/data/` | Seed content from link.sansser.com until the admin takes over |

Read `CLAUDE.md` before changing anything.

> Temporary home: this code lives in `rohankumar-pro/sites/sansser` until the private `sansser` repo exists, then moves there. `/sites/*` is never served on rohankumar.pro.

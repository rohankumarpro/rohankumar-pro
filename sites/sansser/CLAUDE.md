# Rules for anyone (human or AI) changing this repo

Sansser is becoming one hub for AI tools, guides, resources and the newsletter. This repo is its code home.
The plan and every decision so far live in the "Sansser Build Plan" and "Sansser Phase 2 Spec" docs. Read their
"Decisions so far" before changing direction; do not reopen settled decisions.

## 1. Owner data is sacred. Never reset, move, rename or wipe it.

Sign-ups, consent records, pages and links live in the database (Supabase Postgres), not in git. A deploy changes code only.

- Never delete rows. Archive instead (`archived_at`, `status = 'archived'`). Migrations are additive and backwards compatible.
- Never run, add or suggest code that clears a table or a store.
- Deploy previews, branch deploys and localhost use the SANDBOX database only (`src/lib/server/env.ts`). They must never write to production.
- Before any change that touches storage, tell the owner and remind them to download a backup first.
- Migrations from the old sites (link.sansser.com Blobs, rohankumar.pro, Resend) are copy-only. Old stores stay untouched until the owner decides.

## 2. Design

- ONE design. Bright, minimal, gridded, serious. At rest only black, white and grey; colour comes from content images.
- Colour, motion and depth appear only on interaction: the living gradient (`src/scripts/fx.js`) and the interaction kit (`src/scripts/kit.js`).
- The six brand colours come from the logo slash: Mint #55C4A9, Sansser #40AD92, Lagoon #3B8A7A, Depth #28645B, Deep #153F3D, Abyss #0A2B2C.
- Square corners; the 7px cut corner on buttons, Copy and toasts. Phosphor icons only (`src/components/icons.ts`). Never emoji as icons.
- Fonts come from Adobe Fonts through the owner's Creative Cloud subscription (kit link in `src/layouts/Base.astro`).
- Copy is first person plural ("our reels", "tested by us"), short and plain. No em dashes, no filler.
- Check every UI change in light and dark, on desktop and on a phone. Respect reduced motion.

## 3. Process

- Develop on `dev`, merge to `main` with a normal merge or fast-forward. Never force-push.
- Netlify builds cost credits: batch changes, merge to `main` once per batch.
- Secrets live only in Netlify environment variables (see `.env.example`). Never commit them.

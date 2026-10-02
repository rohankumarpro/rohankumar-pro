# Rules for anyone (human or AI) changing this repo

## 1. Owner content is sacred. Never reset, move, rename or wipe it.

Everything the owner makes on the live site (rohankumar.pro) lives in Netlify Blobs, not in git:
settings, journal, notes, projects, links, docs, guestbook, messages, photos, uploaded pictures and files,
and the personal vault. A deploy replaces code only. It must never change that data.

- Do not rename or change the store names or key formats in `netlify/lib/store.mjs`, `netlify/lib/media-store.mjs`
  or any function that reads or writes them (`site-content`, `site-content-dev`, `photo-*`, `up-*`, `vault-*`,
  `settings`, the post/doc/project keys). Production must keep using `site-content`.
- Do not seed, overwrite or "start fresh" over existing data. Seed defaults only when a key is missing.
- Do not delete data in a migration. If a data shape changes, read the old shape and the new one (additive, backwards compatible).
- Never run, add or suggest code that clears a store, and never change `.gitignore`/build steps so uploads are dropped.
- Preview and branch deploys (any host containing `--`, and localhost) use the sandbox store `site-content-dev`.
  They must never write to `site-content`.
- If photos, vault items or settings look missing after a deploy, STOP and diagnose (check the Netlify site's
  Functions region and Blobs region first: blobs are stored per region) before touching any code or data.
- Before any change that touches storage, tell the owner and remind them they can download a backup
  from Settings (`/api/backup`).

## 2. Process

- Develop on `dev`, merge to `main` with a normal merge or fast-forward. Never force-push.
- Every UI change must be checked on BOTH interfaces (Material and Minimal), light and dark, desktop and phone.
- No emoji icons. Pictures are never filtered or greyscaled.
- Netlify builds cost credits: batch changes, merge to `main` once per batch.

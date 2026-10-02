# Design: Material

The site has one design, Material: fast, soft and round, with a little bounce. There is no second interface and no
interface picker. Everything is token driven, so a change in one place changes the whole system.

## Where things live
- `css/tokens.css`: shape, type, space, motion and the derived colours (`--surface3`, `--ink3`, `--tint`).
- `index.html` (`:root`): the colour palette for light and dark, fonts, and the layout styles of the desktop and apps.
- `css/core.css`: behaviour shared by everything (focus mode, overview, layout helpers).
- `css/material.css`: the Material skin (elevation, rounding, state layers).
- `css/apps.css`, `css/blocks.css`, `css/editor.css`: the apps and the block editor.
- `shared/icon-set-material.js` and `shared/icons.mjs`: the icon sets. No emoji anywhere.

## Rules
1. **Tokens, not numbers.** Use `--r-*` for radius, `--fs-*` for type, `N * var(--u)` for space, `--d-*` and `--ease` for motion, and the colour roles (`--surface`, `--surface2`, `--ink`, `--ink2`, `--primary`, `--c1…c6`).
2. **Pictures are never filtered or greyscaled.**
3. **No emoji as icons.** Use the line icons or the layered app icons.
4. **Both themes.** Every change is checked in light and dark, on desktop and on a phone.
5. **One motion language.** Soft ease-out, short durations, a little spring on icons and windows.
6. **Controls:** pills for buttons, tonal fills instead of outlines for fields, one custom dropdown for every select, and our own right-click menu everywhere.

## Colour notes
`--c1…--c6` are the card colours that notes, the guestbook and thumbnails store by key, so keep the keys stable.

## Characters
Mochi, the treat jar and the plant shelf keep their own colours.

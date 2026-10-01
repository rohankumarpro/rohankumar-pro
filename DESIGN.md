# Index: the design system

The site is a numbered catalogue (01–18) set on one grid, in two inks. Every decision below is
derived from five rules. If a new element breaks one, the element is wrong, not the rule.

## The five rules

1. **Two inks.** No hue in the interface. Black, white and a grey ramp. State is shown by
   **inversion** (black ↔ white), never by colour. Colour exists only inside the *work*
   (journal covers, palette swatches), so the work is the only thing that pops.
2. **One family.** Geist for text, Geist Mono for labels and numerals. Hierarchy is made with size
   and case. Weights are 400 and 500 only (300 for very large numerals).
3. **One grid.** 8px unit. The wallpaper grid is a 104px module and the desktop tiles sit exactly
   on its lines. Hairlines (1px) carry structure; shadow is used only to lift a floating layer.
4. **Square.** `border-radius` is 0 everywhere. Circles are for status dots only.
5. **One motion.** One curve, three durations, no bounce, no overshoot.

## Tokens

All tokens live at the top of `assets/system.css`.

| Token | Light (Paper) | Dark (Ink) | Use |
|---|---|---|---|
| `--bg` | `#E7E7E7` | `#0A0A0A` | the desk |
| `--surface` | `#FFFFFF` | `#121212` | windows, menus, widgets |
| `--surface2` | `#F4F4F4` | `#1A1A1A` | quiet fills, secondary cells |
| `--line` | `#DADADA` | `#2A2A2A` | hairlines |
| `--ink` | `#0A0A0A` | `#F4F4F4` | text, strong rules, inverted fills |
| `--ink2` | `#666666` | `#9A9A9A` | secondary text (5.7:1 on paper) |
| `--ink3` | `#9E9E9E` | `#5C5C5C` | **decoration only**: indices, ticks, disabled |

Grey ramp `--c1`…`--c6` (+ `--on-c1`…`--on-c6` for text on it). Notes, guestbook entries,
thumbnails and link icons persist a colour *key* (`c1`…`c6`), so the keys are kept and now resolve
to tones: c1 lightest → c6 full ink (c6 inverts between themes). Apply with `data-tone="cN"`.

**Space**: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Margins 24px (16px on phones).
**Type scale** (all Geist unless noted):

| Role | Size / line | Notes |
|---|---|---|
| Label | 11 / 16 Mono, caps, +0.06em | every small caption, section heading (`h3`) |
| Small | 13 / 20 | |
| Body | 15 / 24 | `--ink2` for running copy, `--ink` for lead |
| Lead | 17 / 26 | first paragraph after an `h1` |
| H2 | 24 / 28, −0.025em | |
| H1 | `clamp(32px, 9cqi, 52px)`, −0.045em | scales with the *window*, not the viewport |
| Numeral | 56–84, weight 300, −0.065em, tabular | clocks, calculator, dates |
| Poster | `clamp(112px, 26vw, 380px)`, weight 300 | lock screen only |

**Motion**: `--ease: cubic-bezier(.16,1,.3,1)` (expo-out) for everything that arrives; `--ease-io`
for things that leave. `--d1` 120ms (state flips), `--d2` 260ms (reveals), `--d3` 520ms (windows).

**Elevation**: `--lift` (floating layers: top window, menus, dock) and `--lift-dim` (background
windows). Nothing else casts a shadow.

## Interaction grammar

- **Hover on a discrete object** (tile, button, tab, menu row, dock item) = *invert*.
- **Hover on a list row** (journal entries, timeline items) = underline.
- **Active / selected** = inverted fill. **Focus** = 2px ink outline, 2px offset.
- **Index**: every app has a two-digit number. It appears on its tile, in its title bar, and in the
  boot screen ("Index 01 — 18"). New apps take the next number.

## Components

- **Tile** (`.dicon`): 104px square, joined (shared hairlines). Index top-left, 24-unit glyph centre,
  name bottom-left. The portrait tile is the one picture on the desktop.
- **Icon**: 24-unit grid, 1.5 stroke, square caps, mitred joins, drawn from rects, lines and circles.
  Defined in `G` in `index.html`.
- **Window**: hairline border, 40px bar (index, title, joined `– □ ×` controls). Top window gets a
  full-ink rule under the bar and `--lift`.
- **Button** (`.btn`): 40px, solid ink; `.tonal` is outlined. Links and navigation buttons carry `→`.
- **Segmented control** (`.seg`), **tag** (`.chip`), **ruled list** (`.chips.ruled`): bordered, mono.
- **Card grids** (`.pgrid`, `.notes`, `.gbl`, `.pics`, `.ct-grid`): joined cells on shared hairlines.
- **Widgets**: surface block, hairline border, mono label header.

## Wallpapers (`assets/wallpapers.js`)

Generative, black and white, slow. One canvas behind the desktop; every piece reads `--bg` / `--ink`
so both themes work, and each can render a still frame for the Settings picker.

| Piece | Idea |
|---|---|
| **Grid** (default) | 104px module the tiles sit on. Crosses swell near the pointer; one scan line; one orbit. |
| **Halftone** | A sphere in dots. The light orbits, so the terminator moves. |
| **Signal** | Ridgelines, front over back. |
| **Dial** | A Braun-style face showing the real time. |
| **Aura** | Soft grey light, drifting. |
| **Type** | The name, enormous, in outline, sliding in opposite directions. |
| **Paper** | Nothing. |

Honours *Animation: off* in Settings and `prefers-reduced-motion` (draws one still frame), pauses
when the tab is hidden, caps DPR at 1.5 for the heavy pieces.

## Characters

Mochi the cat, the treat jar and the plant shelf live in `assets/characters.css` as an illustration
layer. They are put into the system by treatment, not redrawn: greyscale, square speech, mono caps.
In dark mode Mochi **inverts** (white cat, ink eyes), which is the same rule as every other object.

## Files

```
assets/system.css        tokens, shell, every app
assets/wallpapers.js     the seven wallpapers + engine
assets/characters.css    Mochi, jar, plants + their monochrome treatment
assets/fonts/            Geist, Geist Mono (variable, self-hosted)
netlify/functions/journal-page.mjs   server-rendered journal, same system
```

## Rules for adding things

1. Need a colour? You don't. Use ink, paper, or a tone from the ramp.
2. Need a radius or a shadow? You don't. Use a hairline.
3. Need a new text size? Use a row from the scale. Need bold? Use 500 or change the size.
4. Need an icon? Draw it on the 24 grid with the same stroke, or don't add it.
5. Need to show state? Invert it.

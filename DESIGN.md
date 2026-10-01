# Index: the Minimal UI

"Index" is the **Minimal UI** of the site (the owner picks it in Settings → Interface; **Material stays the default**).
It is black and white, smooth, bold and spacious. Everything below is scoped to `html[data-ui="minimal"]`; Material is untouched.

## How it plugs into the framework
- `css/tokens.css`: the Minimal token block (palette, radii, type scale, weights, motion, layout units).
- `css/minimal.css`: layout and component character (tiles, dock, launcher, lock screen, windows, cards, controls).
- `assets/wallpapers.js`: generative wallpapers, loaded only when Minimal is active.
- `assets/fonts/`: Geist and Geist Mono, self-hosted.
- Small gated hooks in `index.html`: portrait tile, wallpaper engine, `is-locked` state, monochrome platform marks.

## The six rules

1. **Two inks.** Black, white and a grey ramp; state is shown by inversion. **Pictures and characters keep their own colour**: nothing in the UI tints, greys or filters them.
2. **One family.** Geist for text, Geist Mono for small labels. **Big type is bold** (700, tight tracking). Body 400; small UI 500-600.
3. **Planes, not strokes.** Tonal fills, whitespace and soft shadow instead of outlines. The only rings are focus and selection.
4. **Smooth.** One radius scale from the tokens; nothing sharp, nothing glossy.
5. **Room.** Generous padding on an 8px rhythm (`--u` is 1.2px).
6. **One motion.** One curve (expo-out), three durations, no bounce.

## Key tokens (Minimal)
`--bg #E8E8E8 / #0B0B0B` · `--surface #FFF / #161616` · `--surface2 #F3F3F3 / #202020` · `--ink #0A0A0A / #F5F5F5` · `--ink2` (secondary text) · `--ink3` (decoration only).
Grey ramp `--c1…--c6` keeps the persisted colour keys of notes, guestbook and thumbnails; `--on-c6` flips text on the black/white key.
Radii `--r-1…--r-9`, `--r-pill`; elevation `--float` / `--lift-dim` / `--lift`; motion `--ease`, `--d-1…3`.

## Interaction grammar
Tiles lift and invert on hover; chrome buttons and rows get a soft `--tint` fill; selected = inverted fill; focus = 2px ink outline (buttons) or a soft ring (text fields). Every desktop app shows a two-digit index.

## Wallpapers (`assets/wallpapers.js`)

Generative, black and white, slow. One canvas behind the desktop; each piece reads `--bg` / `--ink`
so both themes work, and each can render a still frame for the Settings picker.

| Piece | Idea |
|---|---|
| **Aura** (default) | Soft grey light, drifting. The smoothest of the set. |
| **Grid** | A module the size of a tile plus its gap; the desktop tiles sit exactly on it. Crosses swell near the pointer. |
| **Halftone** | A sphere in dots. The light orbits, so the terminator moves. |
| **Signal** | Ridgelines, front over back. |
| **Dial** | A Braun-style face showing the real time. |
| **Type** | The name, enormous, in outline, sliding in opposite directions. |
| **Paper** | Nothing. |

Honours *Animation: off* in Settings and `prefers-reduced-motion` (draws one still frame), pauses
when the tab is hidden, caps DPR at 1.5 for the heavy pieces.

## Characters
Mochi, the treat jar and the plant shelf are shared by both UIs and keep their colour (rule 1).

## Rules for adding things

1. Need a colour? Not for the interface. Use ink, paper, or a tone from the ramp.
2. Need a border? Use a tonal fill or whitespace instead.
3. Need a new radius or shadow? Use a step from the scale.
4. Need a bigger size? Use a row from the type scale, and make it bold.
5. Need to show state? Invert it.
6. Unsure how much space? More.

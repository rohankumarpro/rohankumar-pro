# Index: the design system

A numbered catalogue (01–18) in black and white. Smooth, quiet, premium. Every decision below is
derived from six rules. If a new element breaks one, the element is wrong, not the rule.

## The six rules

1. **Two inks.** No hue in the interface: black, white and a grey ramp. State is shown by
   **inversion** (black ↔ white). **Pictures and characters keep their own colour**; the
   interface never tints, greys or filters them. Colour belongs to the work.
2. **One family.** Geist for text, Geist Mono for small labels and numerals. **Big type is bold**
   (700, tight tracking). Body is 400; small UI is 500–600.
3. **Planes, not strokes.** Structure comes from tonal fills (white on grey, grey on white),
   whitespace and soft shadow. Outlines are avoided. The only rings in the system are *focus* and
   *selection*.
4. **Smooth.** One radius scale (10 · 16 · 24 · 32 · pill). Nothing sharp, nothing glossy.
5. **Room.** Generous padding and leading on an 8px rhythm. When in doubt, add space.
6. **One motion.** One curve (expo-out), three durations. No bounce, no overshoot.

## Tokens

All tokens live at the top of `assets/system.css`.

| Token | Light (Paper) | Dark (Ink) | Use |
|---|---|---|---|
| `--bg` | `#E8E8E8` | `#0B0B0B` | the desk |
| `--surface` | `#FFFFFF` | `#161616` | windows, widgets, tiles |
| `--surface2` | `#F3F3F3` | `#202020` | cards, inputs, resting controls |
| `--surface3` | `#E8E8E8` | `#2B2B2B` | hover / pressed on a surface2 fill |
| `--ink` | `#0A0A0A` | `#F5F5F5` | text, primary fills, inverted state |
| `--ink2` | `#6A6A6A` | `#A2A2A2` | secondary text (5.4:1 on white) |
| `--ink3` | `#A3A3A3` | `#626262` | **decoration only**: indices, disabled |
| `--tint` | ink at 7% | ink at 7% | soft hover fill on chrome buttons |
| `--ring` | ink at 45% | ink at 45% | focus ring on text fields |

**Grey ramp** `--c1`…`--c6` (+ `--on-c1`…`--on-c6` for text on it). Notes, guestbook entries,
thumbnails and link icons persist a colour *key* (`c1`…`c6`), so existing saved data keeps working;
the keys now resolve to tones (c1 lightest → c6 full ink, which inverts between themes). Apply with
`data-tone="cN"`.

**Radius**: `--r-s` 10 · `--r-m` 16 · `--r-l` 24 (windows, tiles, cards) · `--r-xl` 32 (panels) · `--pill`.
**Space**: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Outer margin 28px (16px on phones). Window body
padding 48px.

**Elevation** has three steps, all soft: `--float` (tiles, widgets), `--lift-dim` (background
windows), `--lift` (top window, menus, dock). Nothing else casts a shadow.

**Type scale** (Geist unless noted):

| Role | Spec |
|---|---|
| Label | Mono 11/16, caps, +0.06em |
| Body | 16/26, `--ink2` for running copy |
| Lead | 19/30, weight 500, `--ink` (first paragraph after an h1) |
| H2 | **700** 28/32, −0.035em |
| H1 | **700** `clamp(34px, 10cqi, 60px)`, −0.05em (scales with the *window*, not the viewport) |
| Numerals | **700** 60–80, −0.065em, tabular: clocks, calculator, dates |
| Poster | **700** `clamp(112px, 25vw, 360px)`, −0.075em: lock screen only |

**Motion**: `--ease: cubic-bezier(.16,1,.3,1)` for everything that arrives, `--ease-io` for things
that leave. `--d1` 160ms (state), `--d2` 320ms (reveal), `--d3` 600ms (windows).

## Interaction grammar

- **Hover on a tile or primary object**: it lifts 4px and inverts (white → ink).
- **Hover on a chrome button or list row**: a soft `--tint` / `--surface2` fill appears. No outline.
- **Selected / active**: inverted fill (`--ink` with `--surface` text).
- **Focus**: 2px ink outline for buttons; the soft `--ring` for text fields.
- **Index**: every app has a two-digit number, shown on its tile, in its title bar, and on the boot
  screen. New apps take the next number.

## Components

- **Tile** (`.dicon`): a soft 112px rounded square (`--r-l`), index inside, name below in 600.
  The portrait tile shows the photograph, uncoloured by the UI.
- **Icon**: 24-unit grid, 1.75 stroke, round caps and joins, from rects, lines and circles. Defined in `G`.
- **Window**: radius 24, no border, `--lift-dim` (background) / `--lift` (top). 60px title bar with
  index + title and three round controls. 48px body padding.
- **Button** (`.btn`): pill, 48px, solid ink; `.tonal` is a `--surface2` fill. Links and navigation carry `→`.
- **Segmented control** (`.seg`), **tabs**, **tags**: pills on a `--surface2` track; active = ink.
- **Cards** (notes, guestbook, projects, timeline, links): `--surface2` or a grey-ramp tone, radius 24, 24–28px padding, 12px gaps.
- **Dock**: a floating translucent pill; running apps get a dot, not a bar.
- **Widgets**: rounded cards, mono label header, bold numerals.

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

Mochi, the treat jar and the plant shelf live in `assets/characters.css` as an untouched
illustration layer. They keep their colour on purpose (rule 1).

## Files

```
assets/system.css        tokens, shell, every app
assets/wallpapers.js     the seven wallpapers + engine
assets/characters.css    Mochi, jar, plants (illustration only)
assets/fonts/            Geist, Geist Mono (variable, self-hosted)
netlify/functions/journal-page.mjs   server-rendered journal, same system
```

## Rules for adding things

1. Need a colour? Not for the interface. Use ink, paper, or a tone from the ramp.
2. Need a border? Use a tonal fill or whitespace instead.
3. Need a new radius or shadow? Use a step from the scale.
4. Need a bigger size? Use a row from the type scale, and make it bold.
5. Need to show state? Invert it.
6. Unsure how much space? More.

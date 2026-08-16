# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## What this project is

A React + Vite single-page app that computes the flexural capacity of reinforced
and prestressed concrete sections using the Devalapura–Tadros / PCI power formula
under ACI 318-19, and exports a PDF calculation report.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Tests | `npm test` (vitest, 54 tests) |
| Lint | `npx eslint src/` |

CI (`.github/workflows/deploy.yml`) runs **only on push to `main`** and only does
`npm ci && npm run build` before deploying to GitHub Pages. **Nothing runs on pull
requests** — an empty checks list on a PR is expected, not a failure. Tests and
lint are not in CI, so run them locally before pushing.

## Architecture

```
src/
  App.jsx                  layout shell, results/error state
  index.css                design tokens (:root) + ambient background layers
  App.css                  all component styling, keyed to class names
  theme.js                 JS color palette for SVG + print mapping
  components/              input form, diagrams, results panels
  utils/
    beamCalculations.js    the analysis engine
    generatePdfReport.js   jsPDF report generator
  data/steelPresets.js     steel grade parameters
```

### Invariants

**The calculation engine is not a styling surface.** `src/utils/beamCalculations.js`,
`src/data/`, and `skills/` must not change for UI work. When a task is described as
visual, the diff for those paths should be empty.

**SVG cannot read CSS custom properties.** SVG presentation attributes (`fill`,
`stroke`) do not resolve `var(--token)`. That is why `src/theme.js` exists and
mirrors the CSS tokens. The two must be kept in sync by hand.

**The PDF report must always print light, regardless of the on-screen theme.**
This is the single most breakable thing in the repo, and it has broken once
already — see below.

### How the PDF gets its colors (read before touching diagrams or themes)

`generatePdfReport.js` does not redraw the diagrams. It takes the **live SVG nodes
out of the DOM**, clones them, walks the tree inlining `getComputedStyle` values
(`inlineStyles`), and rasterizes the result onto a white page (`svgToDataUrl`).

Consequence: **whatever colors are on screen go into the PDF.** When the UI was
restyled dark (#32), cyan outlines and near-white label text were drawn onto white
paper and became illegible. The fix (#33) added `toPrintColor()` in `theme.js`,
which remaps colors as they are inlined.

`toPrintColor()` is currently keyed on the **exact RGB triplets of the one theme
that exists**. Any new theme whose diagram colors differ will miss the lookup, pass
through unmapped, and reintroduce the bug. Fixing this properly is a required part
of the UI Style feature — see Phase 3 below.

When changing anything that affects diagram color, verify the actual PDF, not just
the browser. Generate a report and extract the embedded images back out of it:

```bash
python3 - <<'EOF'
import re, zlib, struct
d = open('report.pdf','rb').read()
# images are /DeviceRGB, unfiltered; slice W*H*3 bytes after each `stream`
EOF
```

(Full extraction script used during #33 is in that PR's history.)

---

# Feature plan: UI Style selector

## Goal

Let the user pick a **UI Style** from a menu. The current holographic look becomes
one named style, **"Star Trek Holo"**, and is the default. Adding a future style
should mean writing one file and adding one registry entry — not editing seven
components and a stylesheet.

## What a "style" actually is

A style is **not just a palette**. `App.css` currently carries 98 declarations of
`letter-spacing` / `text-transform: uppercase`, plus square corners, corner
brackets, clipped-corner buttons, scanlines, a scan sweep, and a rotating ring.
Those are what make it read as a HUD. A color-only theme system would produce
styles that all feel like the same app in different hues.

So a style owns four things:

| Layer | Examples |
| --- | --- |
| **Palette** | surface, line, text, plus semantic accents |
| **Typography** | font stack, letterspacing, casing, weight |
| **Shape** | border radius, border weight, corner brackets on/off |
| **Ambience** | grid overlay, scanlines, sweep, glow, motion |

## Current blockers

1. **96 literal color values in `App.css`** bypass tokens (against 224 `var()`
   uses). Every one is a place a new theme cannot reach.
2. **7 components import `theme.js` as a static module default** (76 `theme.*`
   references). A module-level import cannot change at runtime.
3. **`toPrintColor()` maps RGB → RGB**, hardcoded to the holo palette.

## Design decision: semantic roles are the contract

The most important choice. Diagram components should not ask for *a color*; they
should ask for *a role* — `concreteStroke`, `tensionSteel`, `neutralAxis`,
`stressBlockFill`. `theme.js` already half does this.

Make the role set a fixed contract every style must satisfy. Then:

- The PDF maps **role → print color, once**, shared by all styles. Adding a style
  can no longer break printing, because printing never sees the style's colors.
- A missing role in a new style is caught by a test, not by a reviewer's eye.

This inverts today's fragile RGB lookup and permanently retires that bug class.

## Phases

Each phase should land as its own PR and leave the app working.

### Phase 0 — Tokenize (no visible change)

Replace the 96 literal colors in `App.css` with `var(--token)`. Add tokens to
`index.css` where none exists. Success test: the rendered app is pixel-identical,
and `grep -cE "rgba?\([0-9]" src/App.css` returns 0.

### Phase 1 — Style registry and provider

- `src/styles/registry.js` — `{ id, name, description, tokens, roles, flags }`.
- `src/styles/starTrekHolo.js` — the current look, extracted verbatim.
- Apply via `data-ui-style="star-trek-holo"` on `<html>`; CSS token blocks key
  off that attribute. Structural flags (`brackets`, `scanlines`, `uppercase`)
  gate the ambient rules.
- `StyleProvider` + `useUiStyle()` React context; persist to `localStorage`;
  default to Star Trek Holo; honor `prefers-reduced-motion` over any style's
  motion flags.

### Phase 2 — Make diagram colors reactive

Replace the static `import theme from '../theme'` in the 7 components with
`const roles = useUiStyle().roles`. Mechanical but touches 76 call sites — worth
its own PR so the diff is reviewable.

### Phase 3 — Decouple the PDF from the active style (required, not optional)

Rewrite `toPrintColor()` as a **role → print color** map. The report always prints
in one neutral document palette no matter what is on screen. Add a test asserting
every role in the contract has a print color at ≥4.5:1 on white, so a new style
cannot ship a role the PDF cannot render.

### Phase 4 — Selector UI

A control in the header (it already holds the badge and Export button). Renders
the registry, so new styles appear automatically. Keyboard accessible, labelled.

### Phase 5 — Guardrails

- Every registered style provides every contract role (test).
- Registered style ids are unique and URL-safe (test).
- `docs/adding-a-ui-style.md`: add a file, add a registry entry, run the tests.

## Recommendations

- **The PDF stays neutral and light for every style.** It is a printed engineering
  deliverable, not a themed surface. Confirmed with the user during #33.
- **Ship Phase 0 first and alone.** It is the risky-looking, behavior-free change;
  keeping it separate makes the real feature diff small.
- **Do not add a second style until Phases 0–3 are merged.** Building the second
  style is what proves the abstraction, but only after the PDF is decoupled —
  otherwise the first new style silently breaks report printing.

## Open questions for the user

1. **Light styles?** Some planned styles may be light-on-dark's opposite. The
   token contract supports it, but the diagram role colors need contrast checks
   against a light app background as well as white paper. Worth knowing early.
2. **Per-style fonts?** Star Trek Holo loads JetBrains Mono from Google Fonts in
   `index.html`. If styles bring their own fonts, they should be loaded on demand
   rather than all upfront.
3. **Should the chosen style appear in the PDF header** (e.g. as a label), or is
   the report entirely style-agnostic? Recommendation: entirely agnostic.

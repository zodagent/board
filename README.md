# zod-board

Canvas-style board surface (infinite grid, ruler, drawing layer) built on the zod vendor stack.

- **Stack:** Tailwind v4 + daisyUI v5, vanilla JS, no bundler
- **Vendors:** `zinc`, `zixi`, `ztore`, `zlog`, `ztex`, `zcomponents`, `lucidicons`
- **Layout:** Custom CSS grid (`48px 20px 1fr` rows, `20px 1fr` columns) — top bar, horizontal ruler, vertical ruler, main canvas
- **Entry:** `index.html` → loads vendors → mounts the app

## Quick start

```sh
npm install
npm run dev          # watch Tailwind only
npm run dev:server   # watch Tailwind + serve on :3000
# or
npm run build        # one-shot CSS build
npm run serve        # static serve only (no watch)
```

`npm run dev:server` runs Tailwind in watch mode and the static server concurrently.

## File layout

```
/
  index.html              -- Shell + script load order
  favicon.svg             -- Inline grid icon
  AGENT.md                -- Full architecture & conventions
  src/
    input.css             -- Tailwind v4 + daisyUI v5 source
    output.css            -- Compiled (generated)
    partials/             -- Reusable fragments
    vendors/              -- Vendor library mirrors (see /zinc, /zixi, etc.)
```

## Vendors used

| Lib | Role |
|---|---|
| `zinc.js` | Reactive DOM bindings (`z-text`, `z-bind:*`, `z-on:*`) |
| `zixi.js` | AJAX fragment swaps (`zx-action`, `zx-swap`, `zx-target`) |
| `ztore.js` | Signal-based reactive store |
| `zlog.js` | Leveled console + DOM logger |
| `ztex.js` | Template engine (commands, macros, resolvers) |
| `zcomponents.js` | Web Components on top of zinc |
| `lucidicons.js` | Lucide icon registry (`data-lucide` → `<svg>`) |

## Conventions

- State keys are dotted: `board.scale`, `board.offsetX`, `toolbar.active`
- Components registered via `Zinc.component('z-…', { props, initial, init })` with `skipRewrite` where scoping is unwanted
- Page fragments loaded with `zx-action="…html"` `zx-target="#…"`
- All HTML files are loaded as fragments — no SPA router here (hash routing lives in `zod-web-app`)
- `window.App` is the shared namespace; see `src/app.js` in `zod-web-app` for utility helpers

See `AGENT.md` for the full architecture reference.

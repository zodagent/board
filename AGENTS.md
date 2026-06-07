# Board (zod-board)

Canvas-style board with infinite grid, rulers, and draggable components.

## Stack

- Tailwind CSS v4 + DaisyUI v5, no bundler
- Vanilla JS with custom vendor reactive stack
- Partials loaded as HTML fragments (no SPA router)

## Commands

```sh
npm install
npm run dev:server   # Tailwind watch + static server on :3000
npm run build        # one-shot CSS build
npm run serve        # static serve only (no watch)
```

## Vendor Stack

| Lib | Role |
|---|---|
| `zinc.js` | Reactive DOM bindings: `z-text`, `z-bind:*`, `z-on:*` |
| `zixi.js` | AJAX fragment swaps: `zx-action`, `zx-target`, `zx-swap` |
| `ztore.js` | Signal-based reactive store |
| `zcomponents.js` | Web Components via `Zinc.component('z-…', { props, initial, init })` |
| `ztex.js` | Template engine |
| `zlog.js` | Leveled console + DOM logger |
| `lucidicons.js` | Lucide icons (`data-lucide` → SVG) |

## Key Conventions

- **No bundler** — vendors loaded via `<script>` tags in `index.html`
- **Partials** are HTML fragments in `src/partials/`, fetched by zixi and injected into `#partial-slot`
- **State keys** are dotted: `board.scale`, `board.offsetX`
- **Components** registered with `Zinc.component('z-…', { props, initial, init })`
- **CSS source** is `src/input.css` → compiled to `src/output.css`
- **Themes** configured in `src/input.css` via `@plugin "daisyui"`
- **Grid size** stored in `localStorage` key `board-grid-size`, default 20px

## Layout

Custom CSS grid in `index.html`: `grid-template-rows: 48px 20px 1fr; grid-template-columns: 20px 1fr;`
- Row 1: top toolbar
- Row 2: horizontal ruler
- Col 1: vertical ruler
- Main: scrollable canvas with draggable `z-draggable` components

## Creating Partials (Design Files)

Partials are standalone HTML fragments you design on the board canvas.

### Where to put them

`src/partials/{name}.html` — filename becomes the partial name in the dropdown.

### Rules

- Plain HTML only — no `<html>`, `<head>`, `<body>` wrappers
- Use Tailwind v4 utility classes and DaisyUI v5 component classes directly
- No external CSS or JS imports needed (already loaded by the shell)
- Each partial is self-contained; content is injected into a `#partial-slot` div inside a `z-draggable` wrapper

### What renders

Every partial loads inside a draggable card with:
- **Grab handle** at top (drag to move)
- **Close button** (✕) to remove
- **Resize handle** at bottom-right corner
- **Your HTML** fills the `#partial-slot` area (default 360×240, resizable)

### Example

Create `src/partials/sidebar.html`:

```html
<div class="h-full bg-base-100 border-r border-base-300 p-4">
  <h2 class="text-lg font-bold mb-4">Sidebar</h2>
  <ul class="menu bg-base-200 rounded-box w-full">
    <li><a>Item 1</a></li>
    <li><a>Item 2</a></li>
  </ul>
</div>
```

Then select "sidebar" from the Partial dropdown in the toolbar — it appears as a draggable, resizable card on the canvas.

### Auto-discovery

Partials are discovered by fetching `./src/partials/` and parsing `.html` links. Just drop a file in the folder and it shows up — no registration needed.

### Tips

- Use `h-full` on the root element so content fills the card
- Use DaisyUI `menu`, `card`, `btn`, `badge`, etc. for ready-made components
- Set a fixed `min-width` / `min-height` on inner content if you want a minimum card size
- State is saved to `localStorage` — partials persist across reloads

## Files

- `index.html` — shell, script load order, app logic
- `src/input.css` — Tailwind v4 source
- `src/output.css` — compiled (generated, do not edit)
- `src/partials/` — reusable HTML fragments
- `src/vendors/` — vendor library mirrors

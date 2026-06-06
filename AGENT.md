# Project Architecture & Conventions

## Overview

Zero-bundler SPA. Static HTML/JS/CSS. Pages are HTML fragments loaded dynamically via Zixi AJAX swaps. No router, no framework — just raw DOM + three custom vendor libraries. Only CSS is built (Tailwind v4 + daisyUI v5 via `npx @tailwindcss/cli`).

## Quick Start

```sh
cd web
npx @tailwindcss/cli -i src/input.css -o src/output.css
```

Then serve the `web/` directory with any static server.

## File Organization

```
web/
  favicon.svg             -- App favicon (dark rounded square + white logo)
  index.html              -- Shell entry point
  package.json            -- Tailwind + daisyUI build
  src/
    app.js                -- Shared utilities, DOM setup, global lucide re-init
    router.js             -- Hash-based SPA router (route table, hashchange, page loads)
    directives.js         -- Zinc directives + event-delegated behaviors (zd-*)
    input.css             -- Tailwind v4 + daisyUI v5 + custom CSS
    output.css            -- Compiled CSS (run `npx @tailwindcss/cli -i src/input.css -o src/output.css`)
    vendors/
      lucidicons.js       -- Lucide icons (data-lucide attr, call lucide.createIcons())
      zinc.js             -- Reactive DOM directives (z-* attrs)
      zixi.js             -- AJAX fragment loader (zx-* attrs)
      ztore.js            -- Reactive signal stores
      zlog.js             -- Structured logger
      ztex.js             -- Template engine (unused in pages)
      zcomponents.js      -- Custom HTML element components (Zinc.component)
    layouts/
      main.html           -- Sidebar + navbar + content layout
      full-page.html      -- Full-screen layout (settings)
    components/
      z-navbar.html       -- Top navbar (skipRewrite singleton)
    partials/
      sidebar.html        -- Sidebar nav (loaded via Zixi)
      footer.html         -- Page footer
      logo.html           -- Logo SVG (unused — embedded in sidebar + new.html)
    pages/
      sidebar-pages/      -- Loaded into #main-content from sidebar
      navbar-pages/       -- Loaded into #main-content from navbar tabs
      customization/      -- Sub-pages for sidebar "Customize"
      settings-pages/     -- Settings sub-pages (full-page layout)
        account/          -- Account, preferences, personalization, notifications
        api/, llm/, theme-editor/, computer/, enterprise/, install/
```

## How the Loading Flow Works

1. `index.html` loads vendors → `directives.js` → `app.js` → data files
2. Component `.html` files are loaded via Zixi into hidden `#component-registry` on `zx:inited` (defines `<template>` + calls `Zinc.component()`)
3. `#layout-container` loads `main.html` — this creates the sidebar, navbar, and default page
4. `main.html`:
   - Loads `sidebar.html` (from `partials/`) into `#sidebar-container` via Zixi
   - Places `<z-navbar>` directly in `#navbar-container` (component already registered in step 2)
   - Loads `new.html` into `#main-content` as default page via Zixi
5. Sidebar links / navbar tabs use `zx-target="#main-content"` to swap page fragments
6. `src/router.js` syncs `location.hash` to the current page name on every Zixi swap. Hash paste triggers page load.

## Hash Router (src/router.js)

Minimal flat router loaded after `app.js`. No nested/sub-url patterns.

### How it works
- **Route table `R`**: maps page names → `{ a: action, s: sidebar?, n: navbar?, t: target? }`
- **Hash change**: `hashchange` → `go(name)` → lookup in `R` → load via Zixi
- **ZX swap**: `zx:swapped` extracts `(\w+)\.html$` from action → sets `location.hash` to that name (every page, including settings sub-pages)
- **Active states**: only updated from `R` entries (main pages). Settings sub-pages don't have sidebar/navbar so no state change.
- **Layout switch**: if `#main-content` doesn't exist (settings layout), loads `main.html` first and waits for `new.html` swap before loading target

### Route table

| Name | Zixi Action | Sidebar | Navbar |
|------|-------------|---------|--------|
| `new` | `sidebar-pages/new.html` | new | — |
| `spaces` | `sidebar-pages/spaces.html` | spaces | — |
| `artifacts` | `sidebar-pages/artifacts.html` | artifacts | — |
| `history` | `sidebar-pages/history.html` | history | — |
| `prompt-studio` | `sidebar-pages/prompt-studio.html` | prompt-studio | — |
| `customize` | `sidebar-pages/customize.html` | customize | — |
| `academic` | `navbar-pages/academic.html` | — | academic |
| `discover` | `navbar-pages/discover.html` | — | discover |
| `finance` | `navbar-pages/finance.html` | — | finance |
| `health` | `navbar-pages/health.html` | — | health |
| `patents` | `navbar-pages/patents.html` | — | patents |
| `settings` | `layouts/full-page.html` (target: `#layout-container`) | — | — |

Every other page (settings sub-pages, customization sub-pages, etc.) updates the hash to its filename on click (`#/preferences`, `#/connectors`, `#/api`) but doesn't require a route entry. Only pages in the table support paste navigation.

### Programmatic navigation
```js
window.navigate('spaces');   // updates hash + loads page
// or:
location.hash = 'discover';  // triggers router via hashchange
```

### History support
Browser back/forward work via `location.hash`. Each page change adds a history entry.

### Key files
- `src/router.js` — router definition (route table, hashchange listener, zx:swapped observer)
- `src/app.js:153-178` — existing `zx:swapped` handler still manages sidebar/navbar active states as fallback; router syncs the hash on top.

## Vendor Libraries

### Zinc.js — Reactive DOM Bindings (`z-*` attributes)

State is namespaced with dots: `main.sidebarHidden`, `navbar.activeTab`, etc.
Accessed via `Zinc.get(key)` / `Zinc.set(key, val)`.

| Directive | Purpose |
|-----------|---------|
| `z-text` | Sets `textContent` |
| `z-html` | Sets `innerHTML` |
| `z-show` | Toggles `display: none` |
| `z-bind:attr` | Binds any attribute (class, style, value, etc.) |
| `z-each` | Loops over array (clones first child as template, completely replaces innerHTML on update) |
| `z-on:event` | Event listener (calls `window[handler]` or `window[handler](stateKey1, ...)`) |

### Zixi.js — AJAX Fragment Loader (`zx-*` attributes)

| Attribute | Purpose |
|-----------|---------|
| `zx-action` | URL to fetch |
| `zx-target` | CSS selector for swap target |
| `zx-swap` | Swap strategy (innerHTML, outerHTML, beforeend, etc.) |
| `zx-method` | HTTP method (default GET) |
| `zx-trigger` | Event to trigger fetch (default click, `zx:inited` for auto-load) |

On swap, `<script>` tags in response are extracted and executed. `zx:swapped` fires after DOM insertion.

### ztore.js — Reactive Stores

```js
var store = ztore({ key: value });
store.get(key)                  // get value or full state object
store.set(key, val)             // set single key
store.set({ k1: v1, k2: v2 })  // set multiple
store.subscribe(fn)             // watch all changes
store.watch(key, fn)            // watch single key
store.batch(fn)                 // batch multiple sets into one update
store.destroy()                 // clean up
```

### zcomponents.js — Custom HTML Element Components

Components are custom elements defined via `Zinc.component()`. Each component gets:
- A `<template z-component="name">` for its HTML
- An internal ztore store bridged to a scoped Zinc namespace (`zc_N.key`)
- Directive values rewritten to the scoped namespace (`z-text="count"` → `z-text="zc_0.count"`)
- Observed attributes via `props` array that flow into the store
- Methods bound to the element for `zd-*` resolution

**Config options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `props` | `string[]` | `[]` | Observed attributes, synced to internal store |
| `initial` | `object` | `{}` | Default store values |
| `slot` | `boolean` | `false` | Preserve child elements, insert into `[data-z-slot]` in template |
| `skipRewrite` | `boolean` | `false` | Skip directive rewriting (use for global-state components like navbar) |
| `init` | `function` | — | Lifecycle hook, runs once on mount. `this` = the element |

**API reference:**
```js
Zinc.component('z-my-widget', {
  props: ['count'],              // attribute → store sync
  initial: { count: 0 },         // defaults
  slot: true,                    // preserve children (default false)
  skipRewrite: false,            // skip directive scoping (default false)
  inc: function() {              // methods → element.z_inc for zd-click
    this._store.set('count', this._store.get('count') + 1);
  },
  init: function() {             // lifecycle
    console.log('mounted', this);
  }
});
```

**How method resolution works (`resolveCompMethod` in directives.js):**
1. Walk up DOM to nearest `[data-z-component]` ancestor
2. Check `comp.z_methodName` (set by component system)
3. Fall back to `Zinc.getComponent(name)` definition object
4. Fall back to `window[methodName]`

This chain means `zd-click="inc"` inside a component resolves to `comp.z_inc` first, then `def.inc`, then `window.inc`.

**Available components:**

| Component | Slot | skipRewrite | Purpose |
|-----------|------|-------------|---------|
| `<z-navbar>` | yes | yes | Top navbar with search verticals + theme toggle. Creates `navbar` store. |

## How to Add a Page

1. Create `src/pages/{section}/{name}.html`
2. Write HTML content (no `<html>/<head>/<body>` — just the fragment)
3. End with a `<script>` block:
   ```html
   <script>page('pageName', function() { /* init */ });</script>
   ```
4. Link it from sidebar (`sidebar.html`) or navbar (`z-navbar` template) with:
   ```html
   <a zx-action="./src/pages/{section}/{name}.html" zx-target="#main-content" zx-swap="innerHTML">Label</a>
   ```

**Page conventions:**
- One `<script>` block at the end using `page('name', fn)` for one-time init
- No `lucide.createIcons()` — the global `zx:swapped` listener handles this
- No `onclick` — use `zd-*` attributes for click behaviors
- Textareas that auto-resize: add `z-autogrow` (optionally `z-autogrow-max="200"`)
- Primer buttons: add `z-primer` to fill nearest textarea on click

## How to Add a Component

1. Create `src/components/z-name.html`
2. Write the template + script:
   ```html
   <template z-component="z-name">
     <div class="...">
       <span z-text="propName"></span>
     </div>
   </template>
   <script>
   Zinc.component('z-name', {
     props: ['propName'],
     initial: { propName: '' },
     doThing: function() { /* this._store.set(...) */ }
   });
   </script>
   ```
3. Add loader to `index.html`:
   ```html
   <div style="display:none" zx-action="./src/components/z-name.html" zx-target="#component-registry" zx-swap="beforeend" zx-trigger="zx:inited"></div>
   ```
4. Use it: `<z-name prop-name="value" z-bind:prop-name="store.key"></z-name>`

## How to Build Settings Pages

Settings pages live under `src/pages/settings-pages/` and are loaded into the `#layout-container` (which swaps in `layouts/full-page.html`). Build them with raw HTML + daisyUI utility classes — no wrapper components. For modals, use the native `<dialog>` element with the `modal` class.

## Store Pattern

Each major page creates a namespaced ztore store via `App.createStore(name, initial)`. This bridges ztore to Zinc: every state change auto-sets `Zinc.set(namespace.key, value)`.

| Store | Created In | Keys |
|-------|-----------|------|
| `main` | index.html | theme, sidebarHidden, sidebarCollapsed, currentPage, currentRoute, mobileSidebarOpen, profileMenuOpen, notifications, profileInitials, profileName |
| `sidebar` | sidebar.html | activeItem, isNewActive, isSpacesActive, isArtifactsActive, isHistoryActive, isPromptStudioActive, isCustomizeActive |
| `navbar` | z-navbar component init | activeTab, isAcademic, isDiscover, isFinance, isHealth, isPatents |
| `newChat` | new.html | mode, model, inputText, sendDisabled |
| `chat` | chat.html | selectedModel, fileTreeOpen, artifactsOpen, inputText |
| `settings` | full-page.html | currentTab, currentAction |
| `spaces` | spaces.html | spaces, modalIcon, modalIconBg, modalIconColor, modalName, modalDescription, modalAgents, modalTools, modalUpdated, modalPinned |
| `artifacts` | artifacts.html | artifacts, modalIcon, modalIconBg, modalIconColor, modalTitle, modalLang, modalDesc, modalSize, modalCreated, modalThread, modalContent |
| `history` | history.html | threads, filterType, showTemp, sortBy |
| `promptStudio` | prompt-studio.html | promptText, wordCount, charCount, wordLabel, charLabel, isRunning, messages |

```js
// Creating a store:
App.myStore = App.createStore('my', {
  key1: 'value',
  key2: 0,
});
// Now Zinc.set('my.key1', 'new') updates the store AND the DOM
// Also: App.myStore.get('key1') / App.myStore.set('key1', 'val')
```

## Directives Reference

### Zinc Custom Directives (state-driven, reactive)

| Attribute | Purpose |
|-----------|---------|
| `z-modal="stateKey"` | Opens/closes a `<dialog>` when state is truthy/falsy |
| `zd-counter="stateKey"` | Sets textContent to state value |

### Event-Delegated Behaviors (click-driven via `zd-*`)

| Attribute | Purpose |
|-----------|---------|
| `zd-card="handler"` | Card click — calls comp method or `window[handler](el)` |
| `zd-click="handler"` | Click — calls comp method or `window[handler](el)` |
| `zd-close` | Closes parent `<dialog>` |
| `zd-open="id"` | Opens `document.getElementById(id).showModal()` |
| `zd-theme` | Theme switcher (light/dark) |
| `zd-font` | Font selector (serif/sans-serif) |
| `zd-dropdown` | Dropdown item selection |
| `zd-suggestion` | Fills `[contenteditable]` with `.text-sm` text |
| `zd-ctx="handler"` | Context menu — calls `handler(e, data-id)` |
| `zd-ctx-item` | Context menu action — reads `data-action`, calls `handleContextAction()` |
| `zd-copy` | Copies next sibling's `textContent` |
| `zd-collapse` | Toggles `.collapse-open`/`.collapse-close` on nearest `.collapse` ancestor (daisyUI collapse only). For custom expand/collapse, use `zd-click="toggleSiblingChildren"` which toggles `aria-expanded`, rotates a `[data-chevron] i`, and sets `scrollHeight` on sibling `[data-children]` |
| `zd-count="label"` | Updates counter text in parent |
| `zd-geo` | Geolocation request |
| `zd-install` | PWA install prompt |
| `zd-select="handler"` | `<select>` change — calls `handler(el)` |

### Global Helpers (in directives.js + index.html)

`toggleSiblingChildren(btn)` is defined in index.html (not directives.js). Used by sidebar dropdowns via `zd-click="toggleSiblingChildren"`. Toggles `aria-expanded`, rotates a `[data-chevron] i` icon 90°, and sets sibling `[data-children]` height to `scrollHeight` or `0px`.

### Global Helpers (in directives.js)

| Function | Purpose |
|----------|---------|
| `showSpaceDetail(card)` | Populates space modal from store |
| `showArtifactDetail(card)` | Populates artifact modal from store |
| `navigateToThread(card)` | Navigates to thread from history |
| `openContextMenu(e, id)` | Positions context menu at cursor |
| `handleContextAction(action, id)` | Rename/delete/export thread |
| `confirmRename()` | Confirms thread rename from dialog input |
| `enrichHistoryThread(t)` | Transforms raw thread for store |
| `continueFromArtifact()` | Fills chat input with artifact content |
| `downloadArtifact()` | Downloads artifact as file |
| `startSpaceSession()` | Fills chat input with space session prompt |

### App Utilities (in app.js)

| Function | Purpose |
|----------|---------|
| `page(name, fn)` | One-time init guard (runs fn only once per lifecycle) |
| `fmtTime(ts)` | Relative time: "now", "5m ago", "2d ago", "1w ago" |
| `fmtSize(bytes)` | "X B", "X.X KB", "X.X MB" |
| `escHtml(text)` | Escape HTML entities |
| `download(filename, content, ext)` | Trigger file download |
| `toggleCollapse()` | Toggle sidebar collapsed state |
| `titleCase(str)` | Hyphens to spaces, capitalize words |
| `hideSidebar()` | Set sidebarHidden = true |
| `showSidebar()` | Set sidebarHidden = false |
| `cycleTheme()` | Toggle light/dark |
| `toggleProfileMenu()` | Toggle profile dropdown |

## CSS

- **Tailwind v4** + **daisyUI v5** (all 35 built-in themes — see `src/input.css` for full list)
- Build: `npx @tailwindcss/cli -i src/input.css -o src/output.css`
- Custom properties: `--header-height: 56px`, `--sidebar-width: 240px`, `--sidebar-collapsed-width: 56px`
- Sidebar states via `data-sidebar-collapsed` / `data-sidebar-hidden` on `<html>`
- Utilities: `.scrollbar-subtle`, `.glow-effect`, `.code-block-wrapper`, `.thinking-block`

## Critical: `z-bind` Cannot Evaluate JS Expressions

Zinc's `z-bind:attr="expr"` does a literal `Zinc.get(expr)` lookup — it **cannot evaluate JavaScript expressions**. This means `z-bind:data-active="sidebar.activeItem === 'new'"` sets `data-active="undefined"` because Zinc looks up the entire string as a single state key.

**Fix pattern**: Never put expressions (comparisons, ternaries) in `z-bind` values. Instead:
1. Add computed boolean keys to the store (e.g., `isNewActive`)
2. Watch the source key (`activeItem`) and update booleans in a watcher
3. Bind directly: `z-bind:data-active="sidebar.isNewActive"`
4. Style active states via attribute selectors in CSS: `[aria-selected="true"]`, `[data-active="true"]`

This pattern is already applied for `sidebar`, `navbar`. Preferences page applies `data-theme` to preview swatches via JS in `page('preferences')`.

## Key Rules

- **Never modify vendor files** (zinc.js, zixi.js, ztore.js, lucidicons.js, zlog.js, ztex.js, zcomponents.js)
- **Never add `lucide.createIcons()`** — the global `zx:swapped` listener handles it
- **Never use `onclick` in HTML** — use `zd-*` attributes
- **Never use IIFE** in pages — use `page('name', function() { ... })`
- **Never write textarea resize JS** — use `z-autogrow`
- **Never write `document.getElementById` for interaction logic** — use `zd-*` + global handlers
- **Never construct HTML strings in JS** — use structured data + `z-each` / `z-text` / `z-html`
- **Never use `innerHTML +=`** — push data to store arrays and let `z-each` render
- All shared utilities go in `src/app.js`, interactions in `src/directives.js`, CSS in `src/input.css`
- Component files go in `src/components/z-name.html` with a `<template z-component="z-name">` + `Zinc.component()` call
- Partial files go in `src/partials/` — loaded via Zixi, no component registration
- Sidebar is a partial, navbar is a component (registered via `Zinc.component('z-navbar', {skipRewrite: true, ...})`)
- Always add new component loaders to `index.html`'s component registry section

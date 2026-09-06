# apps/docs AGENTS.md

Custom Storybook for the monorepo — one page per component, hook, or util in `packages/ui`. Built with Next.js App Router and MDX. Rules here are more specific than root `AGENTS.md` — both apply.

---

## Purpose

The canonical interactive reference for the design system.

- **Components**: every component in `packages/ui/src/components/` must have a matching page here.
- **Hooks and utils**: a page is required only when the hook/util is part of the public composition API — i.e. an app author building a feature would reach for it directly. Internal plumbing used only by other DS components (e.g. `composeRefs`, `useComposedRefs`) is covered by its JSDoc + colocated tests and does not need a page. Promote to a docs page when the first real cross-app usage shows up — that's when you'll have a concrete example to write against.

## Routing

The docs site is organized into top-level **sections** (UI, Tests, …). Each section has its own sidebar tree; the header at the top of every page lets users switch between sections.

`src/app/[...slug]/page.tsx` is a single catch-all that resolves any slug array to an MDX file under `src/content/`. The catch-all has zero per-section logic — sections exist only as **path prefixes** in the URL and **subdirectories** under `src/content/`.

- `/ui/components/button` → `src/content/ui/components/button.mdx`
- `/ui/hooks/use-click-outside` → `src/content/ui/hooks/use-click-outside.mdx`
- `/tests/unit` → `src/content/tests/unit.mdx`
- `/tests/e2e` → `src/content/tests/e2e.mdx`
- `/ui` → `src/content/ui.mdx` (section overview)
- `/tests` → `src/content/tests.mdx` (section overview)

`generateStaticParams` discovers all MDX files at build time — no manual route registration needed.

## Content structure

```
src/content/
  ui.mdx                — UI section overview (renders at /ui)
  ui/
    components/         — one .mdx per ui component, renders at /ui/components/<slug>
    hooks/              — one .mdx per ui hook, renders at /ui/hooks/<slug>
    utils/              — one .mdx per ui util, renders at /ui/utils/<slug>
  tests.mdx             — Tests section overview (renders at /tests)
  tests/
    unit.mdx            — Unit testing guidance (renders at /tests/unit)
    e2e.mdx             — End-to-end testing guidance (renders at /tests/e2e)
```

## Navigation

Two layers:

- **Header** (`src/components/Header/Header.tsx`) — the section tabs (UI, Tests, …). Always visible. Highlights the current section by URL prefix.
- **Sidebar** (`src/components/Navigation/Navigation.tsx`) — the current section's tree of pages, grouped by category. The sidebar component reads `usePathname()` and picks the right `NavTree` (e.g. `UI_NAV` vs `TESTS_NAV`). Adding a new page = adding an entry to the relevant tree's `items` array.

When adding a new section, follow this checklist:
1. Add the section entry to `Header.tsx`'s `SECTIONS` array.
2. Create a `<NEW>_NAV: NavTree` constant in `Navigation.tsx` with the section's groups.
3. Wire it into `getNavTreeForPath` so the right tree renders for that prefix.
4. Add `src/content/<section>.mdx` for the section overview page.
5. Add at least one page under `src/content/<section>/` before exposing the tab — don't ship orphan section tabs.

## MDX file conventions

Minimum required sections in every `.mdx`:

1. **Description** — one paragraph, what it does and when to use it.
2. **Live example** — import and render the real component from `ui`.
3. **Props table** — every prop with type, default, and description.

```mdx
import { Button } from 'ui/components/Button';
import { PropsTable } from 'components/PropsTable';

# Button

Short description of what it does.

## Example

<Button variant="primary">Click me</Button>

## Props

<PropsTable
  data={[
    { prop: 'variant', type: "'primary' | 'secondary'", default: "'primary'", description: 'Visual style' },
    { prop: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Height preset' }
  ]}
/>
```

- Import the component with a named import: `import { Button } from 'ui/components/Button'`.
- Never copy/paste component source into MDX. Always import the live component.
- Always use `<PropsTable data={[...]} />` for **props tables** — the structured `data` array keeps prop names / types / defaults consistent across pages.
- For other tables (comparisons, key-value docs, etc.), normal markdown table syntax (`| col | col |`) works — `remark-gfm` is wired into `next.config.js` via the string-form plugin spec (`remarkPlugins: [['remark-gfm']]`) so Turbopack can serialize the loader options. Markdown tables are auto-styled by the `<Table>` override in `mdx-components.tsx`.
- Filename must match the `href` slug in the relevant `NavTree` in `src/components/Navigation/Navigation.tsx`.
- **Any element that renders to `<p>` must have its children on one line in MDX.** That includes the raw `<p>` tag itself AND components like `<Text>` whose default tag is `<p>`. MDX treats multi-line content inside a JSX block as a markdown paragraph and wraps it in `<p>` — nesting that inside another `<p>` produces `<p><p>...</p></p>`, which is invalid HTML and triggers a React hydration error. Keep the content on one line. If it gets uncomfortably long, wrap it in a JSX expression to bypass MDX's paragraph handling: `<Text>{<>multi-line content goes here</>}</Text>`. (Inside `code={...}` template literals on `<Preview>`, multi-line is fine — those are just displayed source, not real JSX.)

## Adding a new component doc page

1. Create the `.mdx` file under `src/content/ui/components/<slug>.mdx`.
2. Add the entry to the appropriate group in `UI_NAV` in `src/components/Navigation/Navigation.tsx`.
3. Render at `/ui/components/<slug>`.

## Styles

This app imports tokens in this order (defined in `src/app/layout.tsx`):

1. `ui/styles/colors` — palette primitives
2. `ui/styles/variables` — semantic tokens
3. `ui/styles/base` — shared CSS reset (do not duplicate its rules in `globals.css`)
4. `ui/styles/classnames` — shared utility classes
5. `styles/globals.css` — app-specific global styles only
6. `styles/variables.css` — app-level token overrides (must be last)

App-specific token overrides live in `src/styles/variables.css`. Never reference palette tokens (`--color-gray-*`) directly from this app.

## Absolute imports

Absolute imports use `tsconfig.json` `paths` (no `baseUrl`, no `@` prefix):

- `components/*` → `./src/components/*`
- `lib/*` → `./src/lib/*`
- `styles/*` → `./src/styles/*` (used for `import 'styles/globals.css'` / `import 'styles/variables.css'` in `layout.tsx`)

## Local components

`src/components/` contains docs-only components (Header, Navigation, etc.). These are not part of `packages/ui`.

Component placement follows a strict promotion ladder:

1. **Private to one parent** — lives in `ParentComponent/components/ChildName/` alongside its parent. Not imported anywhere else.
2. **Reused within this app** — lives in `src/components/ComponentName/` (top-level). Imported by multiple components in the same app.
3. **Reused across apps** — move to `packages/ui`. Follow `packages/ui/AGENTS.md` conventions.

When a component outgrows its current level, move it up — never import a private sub-component from outside its parent folder.

## Server vs. Client Components

See the canonical rule in [root AGENTS.md](../../AGENTS.md#server-vs-client-components--the-most-important-nextjs-app-router-rule). Not duplicated here to avoid drift.

Docs-specific notes:

- MDX pages render as Server Components by default. Importing a `'use client'` DS component (e.g. `<Spotlight>`, `<Carousel>`) is fine — Next.js draws the boundary at the leaf import.
- Docs-only components in `src/components/` (Header, Navigation, etc.) follow the same rule: keep them server-side unless the component itself uses state or browser APIs. A `CopyButton` inside a code block is the textbook case — extract it as a `'use client'` leaf rather than marking the page.

## Tech notes

- `@next/mdx` is configured in `next.config.js` with `pageExtensions: ['ts', 'tsx', 'mdx']`.
- `mdx-components.tsx` at the app root is required by Next.js App Router for MDX.

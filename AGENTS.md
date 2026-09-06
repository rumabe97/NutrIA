# Mini Template AGENTS.md

Agent-focused guidance for this monorepo. The closest `AGENTS.md` to the file you edit wins.

---

## Setup

- Install deps: `pnpm install`
- Use `pnpm` only (no npm or yarn).

## Common commands

| Command                | What it does                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`             | Start all apps in dev mode                                                                                    |
| `pnpm build`           | Build all apps                                                                                                |
| `pnpm ts:check`        | Type-check all packages                                                                                       |
| `pnpm lint`            | Lint all packages                                                                                             |
| `pnpm lint:fix`        | Lint with `--fix`                                                                                             |
| `pnpm test`            | Run all package test suites (Vitest, orchestrated by Turbo)                                                   |
| `pnpm test:watch`      | Watch mode — re-runs affected tests on save                                                                   |
| `pnpm test:coverage`   | Run tests with coverage (Istanbul) — gates against `vitest.config.ts` thresholds                              |
| `pnpm deadcode`        | Find unused exports (knip)                                                                                    |
| `pnpm format`          | Format-check with Prettier (via Turbo)                                                                        |
| `pnpm format:fix`      | Format with Prettier (`--write`, via Turbo)                                                                   |
| `pnpm up:latest`       | Update all deps to latest stable                                                                              |

## Dependencies

- Use workspace deps (`workspace:*`) for internal packages.
- To add an external dep: edit `package.json` in the relevant app/package, then run `pnpm install`.
- After adding a dep, run `pnpm dedupe` to clean up duplicate hoisting.
- **Keeping deps current:** Run `pnpm up:latest` from the repo root regularly. This updates every package to its latest stable version. The eslint version in `configurations/eslint` is pinned separately in that script — do not override it manually.

## Repo layout

```
apps/
  web/    — main web app (Next.js, port 3000)
  docs/   — design system docs / custom Storybook (Next.js, port 3001)
  cli/    — developer CLI (Commander.js + tsx)
packages/
  core/     — business logic: entities, repositories, controllers
  database/ — Drizzle ORM client, schemas, migrations
  auth/     — Supabase auth helpers (client, server, middleware)
  ui/       — shared React component library
configurations/
  eslint/       — shared ESLint configs
  typescript/   — shared tsconfig presets
  prettier/     — shared Prettier config
```

## Dependency chain

```
apps/*  →  core  →  database  →  [drizzle-orm, postgres, auth]
apps/*  →  ui
apps/*  →  auth
```

Apps never import from `database` directly — all data access goes through `packages/core`.

## Absolute imports

Two patterns coexist in this repo, depending on whether you're inside an app or the shared `ui` package.

### Apps — `tsconfig.json` `paths` aliases

Apps define their own internal aliases via `tsconfig.json` `paths`. There is no `baseUrl`, no `@` prefix.

- `apps/web`: `components/*`, `hooks/*`, `lib/*`, `styles/*`
- `apps/docs`: `components/*`, `lib/*`, `styles/*`
- `apps/cli`: `commands/*`

Each app's `tsconfig.json` `paths` block is the source of truth — these examples may lag behind reality. When in doubt, read the app's tsconfig.

```ts
import { Header } from 'components/Header'; // ✅ correct (inside apps/web)
import { Header } from '@/components/Header'; // ❌ wrong — no @ prefix
import { Header } from '../components/Header'; // ❌ wrong — use absolute
```

### `packages/ui` — package self-reference (`ui/...`)

The `ui` package does **not** define `paths` aliases. Instead, it consumes itself through its own `package.json` `exports` field — the same mechanism apps use to import from it:

```ts
import { Button } from 'ui/components/Button';        // ✅ from any app, AND from inside packages/ui
import { useComposedRefs } from 'ui/hooks/useComposedRefs';
import type { Size } from 'ui/types/Sizes.types';
```

One consistent rule for all consumers — including the package itself. See [`packages/ui/AGENTS.md`](./packages/ui/AGENTS.md#imports-within-packagesui) for the full mechanic and why same-directory imports still use relative paths.

---

## packages/core conventions

See [`packages/core/AGENTS.md`](./packages/core/AGENTS.md) for the full rules. Short version:

- **entities/** — Zod schemas + derived types. Data shapes only, no logic.
- **repositories/** — static objects. Call `database()` per method. Wrap I/O in try/catch.
- **controllers/** — static objects. Business rules + presenters. No try/catch, no DB access.
- Apps import only from `core/controllers/*`. Never from `core/repositories/*` except for types.

---

## packages/ui conventions

See [`packages/ui/AGENTS.md`](./packages/ui/AGENTS.md) for the full rules. Short version:

Every component follows this structure:

```
src/components/ComponentName/
  ComponentName.tsx
  ComponentName.module.css
  index.ts
```

Named exports only. No default exports. No inline styles. Always use CSS tokens.

---

## CSS conventions

Four-file token system. **Never hardcode colors, sizes, or shadows — always use a token.**

**`packages/ui/src/styles/colors.css`** — raw palette (primitives). Never reference directly in components or apps.

- Single `:root` block with `color-scheme: light dark` at the top.
- Every color uses `light-dark(light-value, dark-value)` — no `@media` queries in this file.
- Neutral scale: `--color-gray-01` … `--color-gray-12` + alpha variants.
- Color scales: `--color-blue-*`, `--color-green-*`, `--color-red-*`, `--color-amber-*`
- Constants: `--color-black`, `--color-white`

**`packages/ui/src/styles/variables.css`** — semantic tokens. The only variables components and apps should reference.

| Category    | Tokens                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Spacing     | `--space-01` … `--space-12` (4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px)                                  |
| Font size   | `--font-size-01` … `--font-size-12` (11px → 60px scale)                                                                 |
| Line height | `--line-height-01` … `--line-height-06` (1 → 2)                                                                         |
| Font weight | `--font-weight-regular` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600), `--font-weight-bold` (700) |
| Radius      | `--radius-01` (4px) … `--radius-05` (16px), `--radius-full` (9999px)                                                    |
| Sizing      | `--height-xs` (20px), `--height-s` (24px), `--height-m` (32px), `--height-l` (40px), `--height-xl` (48px)               |
| Surfaces    | `--background-01`, `--background-02`, `--background-highlight`                                                          |
| Text        | `--foreground-01`, `--foreground-02`, `--foreground-03`, `--foreground-disabled`                                        |
| Borders     | `--border-01`                                                                                                           |
| Interactive | `--color-hover`, `--color-highlighted`, `--color-selected`, `--color-glass`, `--color-overlay`, `--color-switch`        |
| States      | `--color-success`, `--color-error`, `--color-warning`                                                                   |
| Shadows     | `--shadow-s`, `--shadow-m`, `--shadow-l`, `--shadow-focus`                                                              |
| Motion      | `--duration-fast` (0.15s), `--duration-normal` (0.2s), `--duration-slow` (0.35s), `--ease-default`, `--ease-spring`     |
| Z-index     | `--z-base`, `--z-dropdown`, `--z-overlay`, `--z-modal`, `--z-toast`, `--z-tooltip`                                      |
| Brand       | `--color-brand-01` … `--color-brand-12` (defaults to blue — see branding below)                                         |

**`packages/ui/src/styles/base.css`** — shared CSS reset (box-sizing, body defaults, font-smoothing, heading/paragraph defaults). Imported by every app; do not duplicate this content in `globals.css`.

**`apps/*/src/styles/variables.css`** — app-level overrides. Override any semantic token here. Never reference palette tokens (`--color-gray-*`) directly from an app.

**Import order in app layouts (must follow this order):**

1. `ui/styles/colors` — palette primitives
2. `ui/styles/variables` — semantic tokens
3. `ui/styles/base` — shared CSS reset
4. `ui/styles/classnames` — shared utility classes
5. `styles/globals.css` — app-specific global styles
6. `styles/variables.css` — app-level token overrides (must come last)

No utility class frameworks (no Tailwind). Module CSS only.

### Branding a new project

To remap the visual language for a new project, override tokens in `apps/your-app/src/styles/variables.css`:

```css
/* Change brand accent from blue to green */
:root {
  --color-brand-01: var(--color-green-01);
  /* … through --color-brand-12 */
  --color-brand-12: var(--color-green-12);
}

/* Change spacing density */
:root {
  --space-04: 0.75rem; /* tighten the base unit */
}

/* Change radius style — e.g. sharp corners everywhere */
:root {
  --radius-full: 4px;
  --radius-01: 0;
}
```

You can also override `--background-01`, `--foreground-01`, `--border-01` etc. to change the surface/text palette. **Never reference `--color-gray-*` or any palette token directly** — always go through the semantic layer so dark mode keeps working automatically.

### Per-instance style overrides

Every component accepts `className`. Compose additional styles via a CSS Module:

```tsx
import styles from './MyPage.module.css';

<Button className={styles.heroButton} variant="primary">
  Get started
</Button>;
```

For a component that needs a fundamentally different look, create a new component in the app — don't fight specificity.

---

## Code conventions

### TypeScript

- **NEVER use `any`.** Use `unknown` and narrow it, or model the type properly.
- Prefer `interface` over `type` for object shapes.
- Prefer type annotations over type assertions. `as const` is the only acceptable assertion shorthand.
- Avoid enums — use `as const` objects with a derived union type:
  ```ts
  const Direction = { Up: 'up', Down: 'down' } as const;
  type Direction = (typeof Direction)[keyof typeof Direction];
  ```
- Never cast with `as SomeType` to silence a type error. Fix the type instead.
- External data (API responses, form inputs, `JSON.parse`) must be typed via `unknown` + runtime validation — never cast blindly.

### React

- No `React.FC`. Use plain functions with explicit return types where useful.
- `PascalCase` for components and file names; `${ComponentName}Props` interface.
- `handle*` prefix for event handlers.
- Always check `packages/ui` for an existing component before building one in an app.
- Shared logic (hooks, utils) used in more than one app belongs in `packages/ui/src/hooks/` or `packages/ui/src/utils/`.

### Server vs. Client Components — the most important Next.js App Router rule

**`'use client'` marks a boundary. Every component below that boundary in the tree becomes a Client Component, even if it has no client-side code.** Push the boundary as deep as possible — to the smallest leaf that actually needs browser APIs, event handlers, or React state.

**Wrong — the whole page becomes client-side just because one button needs `onClick`:**

```tsx
'use client'; // ❌ forces ServerRenderedList and HeavyChart to re-render on the client

export default function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ServerRenderedList /> {/* now a client component — loses SSR benefits */}
      <HeavyChart /> {/* same */}
      <button onClick={() => setOpen(true)}>Open</button>
    </>
  );
}
```

**Right — extract the interactive leaf, keep the page as a Server Component:**

```tsx
// Page.tsx — no 'use client', runs on the server
export default function Page() {
  return (
    <>
      <ServerRenderedList />
      <HeavyChart />
      <OpenButton /> {/* only this leaf is a client component */}
    </>
  );
}

// OpenButton.tsx
('use client');
export function OpenButton() {
  const [open, setOpen] = useState(false);
  return <button onClick={() => setOpen(true)}>Open</button>;
}
```

**Rules to follow every time:**

1. Default to Server Components. Only add `'use client'` when the component itself needs `useState`, `useEffect`, `useRef`, event handlers, or browser-only APIs.
2. If a large component needs a small interactive piece, extract that piece into its own file and put `'use client'` there — not on the parent.
3. Never put `'use client'` on a page, layout, or any component that renders other components that don't need it.
4. Server Components can import and render Client Components — that is the correct pattern. Client Components cannot render Server Components as children (they can only receive them as `children` props).

---

## Official documentation

**Always fetch the relevant doc page before writing code that touches these packages.** Training data has a cutoff — these packages move fast and APIs change between major versions. When in doubt, fetch first.

### Next.js (currently v16)

| What                            | URL                                                                      |
| ------------------------------- | ------------------------------------------------------------------------ |
| Entry point                     | https://nextjs.org/docs/app/getting-started                              |
| Server & Client Components      | https://nextjs.org/docs/app/getting-started/server-and-client-components |
| Fetching data                   | https://nextjs.org/docs/app/getting-started/fetching-data                |
| Server Actions & mutations      | https://nextjs.org/docs/app/getting-started/mutating-data                |
| Caching (`use cache` directive) | https://nextjs.org/docs/app/getting-started/caching                      |
| Routing & layouts               | https://nextjs.org/docs/app/getting-started/layouts-and-pages            |
| Route handlers                  | https://nextjs.org/docs/app/getting-started/route-handlers               |
| Proxy (was: Middleware)         | https://nextjs.org/docs/app/building-your-application/routing/proxy      |

**Breaking changes in v16 most likely to trip you up:**

- `middleware.ts` is renamed to `proxy.ts`. The exported function is `proxy(request)`, not `middleware`. There is a codemod: `npx @next/codemod@canary middleware-to-proxy .`
- Caching model changed: use the `use cache` directive + `cacheLife()` + `cacheTag()`. Old patterns (`unstable_cache`, ISR via `revalidate`) still work but are legacy.

### React (currently v19)

| What                      | URL                                                       |
| ------------------------- | --------------------------------------------------------- |
| All hooks reference       | https://react.dev/reference/react                         |
| `useActionState`          | https://react.dev/reference/react/useActionState          |
| `useOptimistic`           | https://react.dev/reference/react/useOptimistic           |
| `use` (Promise / Context) | https://react.dev/reference/react/use                     |
| `useTransition`           | https://react.dev/reference/react/useTransition           |
| `useFormStatus`           | https://react.dev/reference/react-dom/hooks/useFormStatus |

**New in React 19 most likely to trip you up:**

- `useActionState` replaces the old `useFormState` pattern — use it for server action state and pending indicators.
- `useOptimistic` for instant UI feedback before server confirms — must be called inside `startTransition`.
- `use(promise)` can read a promise or Context anywhere in a component, including inside loops and conditionals.

### Drizzle ORM

| What                     | URL                                                  |
| ------------------------ | ---------------------------------------------------- |
| Overview                 | https://orm.drizzle.team/docs/overview               |
| Schema declaration       | https://orm.drizzle.team/docs/sql-schema-declaration |
| Queries                  | https://orm.drizzle.team/docs/select                 |
| Insert / Update / Delete | https://orm.drizzle.team/docs/insert                 |
| Row-Level Security       | https://orm.drizzle.team/docs/rls                    |
| Migrations               | https://orm.drizzle.team/docs/migrations             |

### Supabase

| What                       | URL                                                                   |
| -------------------------- | --------------------------------------------------------------------- |
| Auth overview              | https://supabase.com/docs/guides/auth                                 |
| SSR auth (`@supabase/ssr`) | https://supabase.com/docs/guides/auth/server-side-rendering           |
| Row Level Security         | https://supabase.com/docs/guides/database/postgres/row-level-security |
| Next.js quickstart         | https://supabase.com/docs/guides/getting-started/quickstarts/nextjs   |

### TypeScript

| What               | URL                                                                      |
| ------------------ | ------------------------------------------------------------------------ |
| tsconfig reference | https://www.typescriptlang.org/tsconfig/                                 |
| Release notes      | https://www.typescriptlang.org/docs/handbook/release-notes/overview.html |

### MDN — JavaScript & Web APIs

| What                 | URL                                                               |
| -------------------- | ----------------------------------------------------------------- |
| JavaScript reference | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference |
| Web APIs             | https://developer.mozilla.org/en-US/docs/Web/API                  |

---

## Documentation

`AGENTS.md` says HOW to work in this workspace. `docs/` says WHAT it exists to build. Never mix the two.

### Vocabulary

Fixed terms — use them consistently in docs, prompts, and conversation:

- **workspace** — this whole repo, created from the template. Matches pnpm's own usage (the monorepo *is* the workspace; `pnpm-workspace.yaml` defines it) and Linear's hierarchy (Workspace → Projects). Disambiguation: npm/yarn/knip config keys named `workspaces` refer to member packages — in prose, "workspace" always means the repo; members are always "apps/packages".
- **product** — the ongoing thing the workspace exists to build (vision, users, roadmap; no end date). Defined in `docs/PRODUCT.md`; the word appears only in that context.
- **project** — one bounded unit of work with its own PRD/PLAN/LOG (`docs/projects/NNN-slug/`). Temporary by definition: born from a roadmap item, done when delivered. Same meaning as a Linear Project. Disambiguation: Supabase/Vercel "projects" are infrastructure, not `docs/projects/`.
- **milestone** — one roadmap item (`docs/ROADMAP.md`). Roadmap eras are milestones, **never "phases"** — phase is reserved for the plan unit.
- **phase** — the review/commit unit within a project's plan. One phase = one owner commit.
- **plan** — a project's phased technical execution plan (`PLAN.md`). Deliberately called "plan", not TEP/spec/RFC.
- **task** — work too small for a project (a fix batch, a config sync, a polish round). No folder, no PRD, no plan — but its record still lands somewhere committed: a `LOG.md` entry in the project it serves, or `docs/projects/000-workspace/LOG.md`, the standing log for project-less work.
- **app / package** — members of `apps/` and `packages/` within the workspace (turborepo standard).

Product-domain homonyms: if the product itself defines a first-class entity named `project`, `task`, `workspace`, or `phase` (common in SaaS/data apps), the doc-model term still wins in docs and prompts — and the kickoff/adoption MUST record the collision plus the disambiguating convention here (e.g. write "doc-project" or `docs/projects/NNN` when the product's `project` could be meant).

### Map — where to read, where to write

| Path | What it is | Committed | Written by |
| --- | --- | --- | --- |
| `README.md` | What this is, how to run it | yes | owner; agents update |
| `AGENTS.md` (root + per-package) | Working conventions for agents | yes | owner + agents |
| `docs/PRODUCT.md` | Product definition: problem, users, scope | yes | owner decides, agents draft |
| `docs/ARCHITECTURE.md` | System design + invariants | yes | agents draft, owner approves |
| `docs/ROADMAP.md` | Milestone-level direction | yes | owner + agents |
| `docs/decisions/NNNN-*.md` | Decision records (the WHY) — for decisions that constrain future work | yes | agents, right after each decision |
| `docs/decisions/LOG.md` | Dated one-liner decisions below the ADR bar | yes | agents, as decisions land |
| `docs/reference/*.md` | Evergreen reference — the test: *would an agent need this while working on any project, indefinitely?* Domain knowledge, living design contracts, subsystem/functional specs (numbered requirements, data models, API surfaces — PRDs cite their stable IDs instead of restating), verification playbooks, runbooks (incl. owner-only ops steps). Label evidential facts confirmed/hypothesis | yes | agents draft, owner approves |
| `docs/reference/audits/NNNN-<topic>-YYYY-MM-DD.md` | Dated point-in-time audit/review reports (see § Projects, research type) | yes | agents |
| `docs/upstream/*.md` | The outbox: writeups destined for OTHER repos (template bug reports, dependency issues) — a loading dock, not a library, empty almost always. Only if nothing private beyond the destination's name; delete or mark shipped once it lands | yes | agents |
| `docs/projects/NNN-slug/` | One project: `PRD.md` + `PLAN.md` + `LOG.md` (types: see § Projects) | yes | see `docs/projects/TEMPLATE/` |
| `docs/projects/000-workspace/` | Standing `LOG.md` for tasks that serve no project | yes | agents append |
| `docs/local/` | **The only uncommitted docs location** (gitignored) | **never** | anyone, freely |

### Rules

- **Read before working**: `docs/PRODUCT.md` and `docs/ARCHITECTURE.md` before any feature work; the project's `PRD.md` + `PLAN.md` before executing a phase. Check `docs/local/` and read anything relevant there — it may hold session context.
- **Context discipline**: the map above is a lookup table, not a reading list. Read only what the task needs — never bulk-read `docs/` "for context" (project records and logs are history: read them when researching history, not before every task). The docs exist to make context *cheaper* than re-exploring the code; keep it that way.
- **Write scratch ONLY to `docs/local/`** (create it if missing). Session kickoff prompts, machine-specific notes, half-formed plans, strategy (`docs/local/STRATEGY.md`) — any *prose doc* not meant for the repo record. Never create uncommitted `.md` files anywhere else; anything outside `docs/local/` is meant to be committed.
- **Private data is not docs**: gitignored *evidence/data* directories (photos, captures, datasets) are allowed outside `docs/local/` — each must be declared in this file with a committed README describing its schema. Conclusions derived from the data may be published in committed docs; raw contents may not. Warning: gitignored means no backup — the owner arranges private-but-durable storage for anything hard to recreate.
- **Confidentiality — `docs/local/`**: its content is private context, absolutely. Never quote it, reference its paths, or copy from it into committed files, code comments, commit messages, or PR text. Read it for context; write committed outputs fresh.
- **Confidentiality — declared data dirs**: their *existence, paths, and schema* are public by design (the committed README documents them, and committed docs may cite them as evidence); their *contents* are never quoted — conclusions derived from them are committable per the data rule above.
- **Committed docs are repo-relative**: no absolute paths (`/Users/…`), no real names or paths of other private repos. Two sanctioned exceptions: (1) `docs/upstream/` files may name their destination repo — that is their function; the leak gate skips that folder, and shipped content is re-checked by the destination's own rules. (2) A workspace legitimately *derived from* a private upstream (a port, a recreation, an extraction) refers to it in committed docs by a **stable alias**; the alias→real-identity mapping lives once in `docs/local/`, and the real name goes into `leak-patterns.txt`.
- **Workspaces are independent**: this workspace was kicked off from a template and then stands alone. Committed docs must be fully understandable from this repo only — collaborators and agents may not have access to the template or any sibling repo. The origin template may be *named as historical fact* (e.g. in the migration project's record), but never *depended on*: no URLs to it, no "see the template for X" — every convention this workspace follows is copied into this repo. Cross-repo flows happen through `docs/upstream/` (transient, deleted on shipping) or owner-provided prompts, never through standing references.
- **`pnpm check:leaks` is the gate**: it greps tracked files for `/Users/` paths and every pattern in `docs/local/leak-patterns.txt` (one extended regex per line), and warns on stray uncommitted `.md` files outside `docs/local/` ("commit it or move it" — freshly authored docs awaiting the owner's commit are fine; lingering ones are not). Seeding guidance: write patterns that survive case-insensitive grep against code — word-boundary and context forms (`\bacme\.com`, `acme (repo|stack)`), never bare names that collide with code tokens (an employer named "join" must not match `innerJoin`). For extracted/ported workspaces, include the source repo's name and internal path prefixes; for data-ingesting products (crawlers, OSINT), include real-target identities/PII classes seen during dev. Coverage caveat: the pattern list is local-only, so CI and unseeded clones degrade to the built-in checks — a green `check:leaks` is only full coverage on a seeded machine.
- **Committed third-party content** (test fixtures scraped from external sites, sample data) must carry a provenance note adjacent to it — source URL, capture date, capture method — plus a one-line license/fair-use rationale.
- **Memory is not a docs tier**: durable workspace truth (state, blockers, decisions) belongs in `docs/`, never only in an agent's harness memory — memory is for agent-personal continuity.
- **Every doc opens with a purpose header** stating purpose, audience, committed-or-not, and maintainer — copy the pattern from any file in `docs/`.
- **Docs stay true in the same change**: if a project alters the design, `ARCHITECTURE.md` updates in that project; if implementation diverges from a `PLAN.md`, amend the plan and log the deviation in `LOG.md` — never let a contract rot.
- **Co-located reference docs are allowed**: a reference doc that documents a specific code/data location (a package-scoped playbook like `apps/web/SEO.md`, fixture provenance next to the fixtures) may live beside that location instead of in `docs/reference/`, provided it follows the reference rules (purpose header, confirmed/hypothesis labels) and is linked from `docs/reference/` or the nearest `AGENTS.md`. Locality beats centralization when the doc rots the moment the adjacent code moves.
- **Plans live in the repo**: the workspace's master plan is `docs/ROADMAP.md` + project folders (committed) or `docs/local/` (private) — never only in a file outside the repo tree, where agents can't discover it and the leak gate can't see it.
- The docs app renders `docs/**` at `/workspace` **in dev only** (see `apps/docs`), with a sidebar grouping projects; production builds exclude it. Author docs as plain markdown — the app is a read-only viewer; the `docs/` tree is fully functional without it (if `apps/docs` was pruned from this workspace, skip the viewer). Phase checkboxes in plans render there as visual progress.
- `CLAUDE.md` files are navigation hubs only: link to the adjacent `AGENTS.md`, never add implementation details.

### Projects — PRD → plan → execute

Feature-sized work runs as a **project**: a numbered folder `docs/projects/NNN-slug/` holding the product contract (`PRD.md`), the phased technical plan (`PLAN.md`), and the execution record (`LOG.md`). Templates with the exact format live in `docs/projects/TEMPLATE/`. Use the `/plan-project` skill to create one and the `/execute-project` skill to run it. Phase status lives in the plan and nowhere else. The owner reviews and commits at every phase boundary — agents never commit.

Project types (declared in the plan header):

- **standard** — full PRD + PLAN + LOG.
- **chore** — maintenance work (syncs, upgrades, conformance passes): PLAN + LOG only; a one-line justification in the plan header replaces the PRD.
- **research** — open-ended investigation: PLAN + LOG only; phases are *questions*, not deliverables; acceptance criteria are "question answered with evidence". Point-in-time **audits/reviews** run as research too: phases are finding-groups, and the deliverable is a dated report at `docs/reference/audits/NNNN-<topic>-YYYY-MM-DD.md`. Unfixed vulnerability detail and repro steps stay in `docs/local/` until remediated — only the posture summary commits.
- **recreation** — faithfully porting/recreating an existing external artifact (a live product, a design file): the PRD is replaced by a one-line pointer to the external reference; acceptance criteria are *parity statements* against it, verified per the `human-verify` gate where commands can't judge parity.
- A project may also be **parked**: `PRD.md` at `Status: draft` with no plan yet — a legitimate proposal awaiting its moment.

Standing, demand-driven efforts with no end state (an ongoing design-system adaptation, a rolling conformance effort) run as a **continuing project** whose `LOG.md` accretes an entry per touch — or as recurring tasks in `000-workspace/LOG.md`. Don't force them into a phased plan that can never be done.

Below projects sit **tasks** (see Vocabulary): committed record, zero ceremony. An exploratory round where design emerges during execution runs as a task and may be **promoted to a project retroactively** — the PRD/plan written afterward as record, not contract. Post-ship work on a **delivered** project is a task: it goes to `000-workspace/LOG.md` with a link back to the project — closed project LOGs never reopen. If it's big enough to plan, it's a new project.

### Model routing

**Routing profile: TBD — set at workspace kickoff.** <!-- kickoff agent: replace this line with the chosen profile and delete this comment -->

Every workspace's kickoff MUST pick a routing profile and record it here before the first project is planned. `/plan-project` assigns each plan phase a model within the active profile; deviations need a one-line justification in the plan.

| Profile | Planning / design / review | Implementation | Mechanical phases | Tooling & formatting |
| --- | --- | --- | --- | --- |
| `quality-max` | fable | fable | fable | haiku |
| `tiered` | fable | opus | sonnet | haiku |

Guidance: small or high-stakes workspaces tend toward `quality-max`; larger ones with many well-specified mechanical phases tend toward `tiered`. The built-in rows are conventions, not laws — some workspaces invert them (plan on opus, implement on fable); custom profiles are fine, define them as rows in this table. Tasks and exploratory rounds get a single routing decision (one model for the session), not per-phase routing.

### Kickoff checklist (new workspace)

The agent bootstrapping a new workspace from this template must, in order:

1. Draft `docs/PRODUCT.md` with the owner (definition only — strategy goes to `docs/local/STRATEGY.md`).
2. Draft `docs/ARCHITECTURE.md` for what this workspace adds on top of the template.
3. Seed `docs/ROADMAP.md`.
4. **Set the model routing profile above** — an explicit, recorded decision.
5. Seed `docs/local/leak-patterns.txt` with the owner (see the seeding guidance in § Rules) and run `pnpm check:leaks` once.
6. Record two conventions with the owner: env-var documentation mode (committed `.env.example` files — the template default — or var lists in the owning `AGENTS.md` with no example files; prefer the latter for workspaces handling employer/third-party-sensitive config), and any product-domain homonyms (see Vocabulary).
7. Create project `001` via `/plan-project`.
8. **Delete this checklist and the adoption checklist below from this file** — they are template machinery; once executed, a workspace stands alone (see the independence rule) and carries no kickoff scaffolding.

### Adoption checklist (existing workspace)

Retrofitting this model into a workspace that predates it — **order matters; the leak guard comes before any doc content moves**:

1. Scan pre-existing docs for the reserved terms (`phase`, `milestone`, `workspace`, `project`, `plan`, `task`) and rename conflicts first — roadmap-era "Phases" become **milestones**; a former "Phase" typically becomes a whole *project* whose build sessions become its phases. Record product-domain homonyms in Vocabulary.
2. Create `docs/local/`, sweep stray uncommitted `.md` files into it (or into projects), and seed `leak-patterns.txt` with the owner.
3. Install `scripts/check-leaks.sh` + the `check:leaks` script and **run it against the existing tree** — triage and scrub violations before anything else is committed (adopting repos usually have pre-existing leaks).
4. Map every existing doc onto the tiers (evergreen / reference / upstream / projects / decisions / local) and retrofit the closest proto-project as `001` — hybrid docs split (roadmap direction → ROADMAP, execution narrative → LOG, decisions → decisions/, kickoff prompts → local).
5. Add purpose headers to every doc that survives.
6. Port the `/workspace` viewer if `apps/docs` exists (optional — the tree is fully usable without it).
7. **Delete both checklists from this file when done** — same independence rule as kickoff: executed scaffolding doesn't ride along in the workspace.

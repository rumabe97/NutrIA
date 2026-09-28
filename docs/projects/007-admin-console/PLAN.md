# Plan — Project 007: The admin console

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.

- **Status**: approved — by the owner, 2026-09-28
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md). Every acceptance criterion is mapped at the end of this file.
- **Routing profile**: `tiered`. No phase touches allergy validation, authentication or AI
  output validation, so there is no `quality-max` deviation. The admin guard is reused, not
  changed. Every API phase is still read by `invariant-reviewer` (who may read what), and
  the one migration by `migration-reviewer` (its own floor: opus @ high).

## Design summary

Recorded in [`0068`](../../decisions/0068-the-admin-is-a-console-of-pages-that-still-reads-nobody.md)
(console, shell, periods, tables, removals) and
[`0069`](../../decisions/0069-admin-charts-are-server-rendered-svg.md) (charts).

- **Shell.** The console moves out of `app/(app)` into a new route group
  `apps/web/src/app/(admin)/admin/…`, in two layouts:
  - `(admin)/layout.tsx` is a thin root layout: `RootShell` with the locale, and nothing
    else. It has no `AppNav`, `OfflineProvider`, `OfflineCopy` or `ArrivalSync`, and does
    not call `redirectUnlessReady`.
  - `(admin)/admin/layout.tsx` is the gate and the frame: the console navigation and a
    `<main id={MAIN_ID}>`. It reads `/users/me` and calls `notFound()` unless the user's
    `role` is `admin`. If `UserView` does not carry `role`, it reads `GET /admin/settings`
    instead, which already answers 404 (so `null`) to a non-admin.
  - `(admin)/not-found.tsx` sits one segment above the gate, so the 404 renders inside the
    root shell. A segment's `not-found` wraps that segment's pages but not its own layout,
    so a file beside the gate would be skipped by the gate's own `notFound()` (amended in
    phase 1, see LOG). There is no global `app/not-found.tsx`.
  - The service worker (`public/sw.js`) stores only the pages it names, and none of them
    is in the console. Keep it that way.
  The navigation is `components/AdminNav`: a persistent sidebar at ≥ 60rem and, below
  that, a top bar whose menu button opens the `ui/components/Sidebar` drawer. It marks the
  current page with `aria-current="page"` from `usePathname`, so it is a client component.
  Its entries are one typed array in `components/AdminNav/sections.ts`.
- **The transition page.** So nothing is lost at any phase boundary, phase 1 moves today's
  page unchanged to `/admin/anterior`, listed last in the nav as "Anterior". Each later
  phase deletes from it the sections it has rebuilt, and phase 8 deletes the page. Until
  phase 4 builds Resumen, `/admin` redirects to `/admin/anterior`, keeping the query
  string, because the mailed activation link lands on `/admin?abierta=…`. `GET
  /admin/activate` keeps redirecting to `/admin?abierta=…` for the whole project. The web
  decides where that lands: the transition page until phase 4, Resumen in phases 4–5, and
  from phase 6 a `redirect()` from Resumen to `/admin/cuentas?abierta=…`.
- **Charts and tables.** `packages/ui` gains the chart set of `0069` and a presentational
  `DataTable`. URL state is console-specific, so it lives in `apps/web`:
  - `components/AdminTable` wraps `DataTable` in a GET `<form>` toolbar (search input and
    filter selects that submit as query parameters), sortable header links and a pager
    with a page-size choice.
  - A small client enhancement submits the form on change, with a 300 ms debounce on the
    search.
  - `components/PeriodSelector` is three links (7 / 30 / 90) that keep every other
    parameter.
  - Pages are Server Components that read `searchParams` and pass them through to
    `serverApi`.
- **API.** Everything stays in the existing `admin` module and `AdminController` /
  `AdminRepository` in core, split into new files once a file grows past one concern
  (`AdminSeriesRepository`, `AdminCatalogueRepository` and so on).
  - A pure `core/domain/Period` owns the period grammar: `7 | 30 | 90`, default 30, the
    window and the previous window, `Europe/Madrid` day keys and zero-filled day arrays.
  - The SQL groups by `date_trunc('day', created_at at time zone 'Europe/Madrid')`.
    Every query parameter is validated by a Zod DTO. Sort columns come from an allow-list,
    and anything else is `400 INVALID_INPUT`.
  - Existing response fields stay until phase 9, so the transition page keeps working.
    Phases 3, 5 and 7 only **add** fields and routes.
- **Series shape** (in `core/controllers/Admin`, shared by every chart):
  `type DaySeries = { readonly days: readonly string[]; readonly values: readonly number[] }`,
  with days as `YYYY-MM-DD` in Madrid. A figure compared across periods is
  `{ readonly current: number; readonly previous: number }`.

## Phases

### Phase 1 — The console shell, its navigation and Ajustes

- [x] done — commit `f4f9015` ("The admin has its own shell and menu, and the switches live on Ajustes")
- **Dispatch**: opus @ medium — `/execute-project 007 phase 1`. Reviews: `accessibility`
  (navigation, drawer, focus), `invariant-reviewer` (the 404 gate).
- **Goal**: `/admin` has its own shell and menu, with no `AppNav`. The switches and the
  push test live on their own Ajustes page, and everything else sits unchanged on the
  transition page.
- **Scope**: `apps/web/src/app/(admin)/**` (new), `apps/web/src/app/(app)/admin/**`
  (moved away), `apps/web/src/components/AdminNav/**` (new), `apps/web/src/i18n/dictionaries/*`,
  `apps/web/src/proxy.ts` and `apps/web/src/app/_shared/pages.ts` only if the move needs
  them, `.claude/skills/local-probe/scripts/account.mjs` (the admin option).
- **Steps**:
  1. Create `app/(admin)/layout.tsx`, `app/(admin)/admin/layout.tsx` and
     `app/(admin)/not-found.tsx` as the Design summary describes. Give the gate
     layout its own `layout.module.css`: a two-column grid at ≥ 60rem (nav, then content)
     and a single column below.
  2. Move `app/(app)/admin/page.tsx` and its CSS to `app/(admin)/admin/anterior/`,
     unchanged apart from import paths. Remove its own `notFound()`-on-null only if the
     layout now guarantees the same thing, and keep it otherwise.
  3. Add `app/(admin)/admin/page.tsx`, which redirects to `/admin/anterior` with the
     incoming query string. Phase 4 replaces it.
  4. Build `components/AdminNav` with `sections.ts`. The sidebar has the six groups as
     headed lists; only pages that exist appear, and phases add entries as they land. On
     the phone, the top bar shows the console name and a menu button (44 pt target) that
     opens `Sidebar`. The nav also has a link back to `/inicio`.
  5. Add `app/(admin)/admin/ajustes/page.tsx`. It shows the five `FlagSwitch`es
     (automatic activation, premium, reminders, dish pictures, professional) and
     `PushTestButton`, grouped as Acceso, Producto and Notificaciones, and keeps each
     switch's current on/off hints. Delete those sections from the transition page.
  6. Dictionary: add an `adminNav` block and the Ajustes page strings to `es-ES` and
     `en-GB`.
  7. Confirm `PROTECTED` in `proxy.ts` (prefix match on `/admin`) and `PRIVATE_PATHS`
     already cover every sub-route. Change nothing if they do.
  8. The probe has no admin account. Give `.claude/skills/local-probe/scripts/account.mjs`
     an `--admin` option that sets `role = 'admin'` on the account it just made. It must
     be guarded like its other writes: only an `@probe.invalid` address, local database
     only. Document the option in the skill's `SKILL.md`.
- **Acceptance criteria**: PRD 2, 3 (for the pages that exist), 8 (switches and push test
  unchanged), 10.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=web`.
  - `rg -n "AppNav" apps/web/src/app/\(admin\)` finds nothing.
  - `/local-probe` with an `--admin` account: `/admin`, `/admin/anterior` and
    `/admin/ajustes` at 320, 390 and 1280 px, light and dark. With an ordinary account,
    each renders the console's 404 inside the shell.

### Phase 2 — Charts, stat tile and data table in packages/ui

- [x] done
- **Dispatch**: opus @ medium — `/execute-project 007 phase 2`. Reviews: `accessibility`.
  Load the `dataviz` and `apple-web-design` skills before any code.
- **Goal**: the generic building blocks exist, tested and documented, before any page
  uses them.
- **Scope**: `packages/ui/src/components/{LineChart,ColumnChart,BarChart,DonutChart,Sparkline,Gauge,StatTile,DataTable}/**`,
  shared chart helpers under `packages/ui/src/utils/`, `packages/ui/src/styles/colors.css`
  (chart tokens only), `apps/docs/src/content/ui/components/*.mdx` (path corrected in
  phase 2) and the docs app's navigation list for them. Added from phase 1's review:
  `packages/ui/src/components/Sidebar/**` and `apps/web/src/components/AdminNav/**`
  (step 7 only).
  Also touched in phase 2 (see LOG): `packages/ui/src/components/ChartFrame/**`,
  `packages/ui/src/types/Chart.types.ts`, `apps/docs/src/components/{FullWidth,examples}/**`,
  `apps/docs/mdx-components.tsx`, and `packages/ui/AGENTS.md` / `apps/docs/AGENTS.md`.
- **Steps**:
  1. Add chart colour tokens to `colors.css`: a categorical set of 6 and a success /
     failure / neutral trio, for light, dark and high contrast. Validate them with the
     `dataviz` skill's validator and record the result in LOG.
  2. Shared helpers (pure, tested): nice-number scale ticks, a linear scale, and compact
     number and date label formatting that takes `locale` as an argument.
  3. Each chart is a Server-Component-safe function component (no `'use client'`, no
     hooks beyond `useId`). Its props are plain data (`labels`, `series: { name, values,
     tone? }[]`), `title` (required, the accessible name), `dataLabel` (the "show data"
     text) and `formatValue`. It renders:
     - an `<svg role="img" aria-labelledby>` with a `<title>` on every mark;
     - a legend whenever there is more than one series;
     - a `<details>` holding a `<table>` of the same figures;
     - an empty state when every value is zero or there are no labels.
     The charts:
     - `LineChart`: multi-series, real time spacing.
     - `ColumnChart`: `stacked?: boolean`, zero baseline.
     - `BarChart`: horizontal, optional `share` label per bar, used for the funnel and
       top-N lists.
     - `DonutChart`: legend with counts always.
     - `Sparkline`: decorative, `aria-hidden`, always next to a figure.
     - `Gauge`: value against a cap, with an over-cap state.
  4. `StatTile`: label, value, optional `change` ({ current, previous }) drawn as
     ▲ / ▼ and a percentage with a text alternative ("+12 % frente al periodo anterior"
     comes from a `changeLabel` prop), optional note and optional sparkline.
  5. `DataTable`: presentational only. Props: `caption`, `columns` ({ key, header,
     align?, sortHref?, sorted?: 'asc' | 'desc' }), `rows` and `empty`.
     - It renders a real `<table>` inside a focusable `role="region"` scroll container
       with `aria-labelledby` pointing at the caption, and the first column is sticky.
     - A sortable header is a link carrying `aria-sort`.
     - It has no state and no fetching.
  6. For each component: a colocated `*.test.tsx` (render and its accessible names; the
     empty state; the scale starts at zero for columns and bars; the stacked totals) and
     an `apps/docs` page with examples in both themes.
  7. (Added from phase 1's accessibility review.) `Sidebar` gains an optional
     `onCloseAutoFocus` pass-through, and `AdminNav` prevents the drawer's focus return
     when it closed because a link was followed, so the route announcer's move to the new
     page's `h1` wins. The Close button, Escape and the overlay still return focus to
     "Menú". Test it in `Sidebar.test.tsx`.
- **Acceptance criteria**: PRD 6 (for the components), 11 (for the components), 12.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=ui --filter=docs`.
  - `pnpm --filter docs build`.
  - `git diff --stat -- '*package.json'` shows no new dependency.
  - `pnpm -w run deadcode` is green with the components not yet used by any page. If knip
    flags them, add their folders as `packages/ui` production entries in
    `knip.config.ts` in this phase.

### Phase 3 — API: periods, series, Resumen and Producto

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 007 phase 3`. Reviews: `migration-reviewer`
  (the index migration), `invariant-reviewer`. The `tests` agent writes the end-to-end
  cases. After merge — owner-gated: run `pnpm --filter database migrate` against the dev
  branch, as for every migration (the production API applies it on deploy).
- **Goal**: every figure Resumen, Embudo and Planes need comes from the API, per period,
  with day series.
- **Scope**: `packages/core/src/domain/Period/**` (new), `packages/core/src/controllers/Admin/**`,
  `packages/core/src/repositories/Admin/**`, `packages/core/src/repositories/Analytics/**`,
  `packages/database/src/schemas/{platform,plan}.schema.ts` plus one new migration,
  `apps/api/src/modules/admin/**`, `apps/api/test/admin.e2e-spec.ts`.
- **Steps**:
  1. `domain/Period`: `parsePeriod`, `windowFor(period, now)` returning `{ from, to,
     previousFrom }`, `madridDayKeys(from, to)`, and `fillDays(keys, rows)`. Unit tests
     cover DST changeover days (late March and late October), the default, and rejected
     values.
  2. Migration: index `analytics_events (event, created_at)` and index
     `plan_generation_jobs (created_at)`, built with `CREATE INDEX CONCURRENTLY … IF NOT
     EXISTS` if the migration runner allows it outside a transaction, and a plain create
     otherwise, justified in LOG from the tables' dev row counts.
  3. Repository series (each one a single grouped query):
     - sign-ups per day (`user.created_at`);
     - generations per day by status;
     - active people per day (distinct `user_id` on `session_started`);
     - events per day by event, excluding `ai_call`;
     - plans created per day.
     Previous-period totals for new accounts, active people, plans generated, generation
     success rate and picture spend.
  4. `GET /admin/summary?period=`: tiles (total accounts, new accounts ± previous,
     waiting, active people ± previous, plans generated ± previous, success rate ±
     previous, unread messages, picture spend and cap), the two Resumen series, a
     sparkline series per tile where one exists, and "needs you" counts (waiting
     accounts, unread messages, failed generations in the last 24 h).
  5. `GET /admin/product?period=`: the funnel as today, active people per day, events
     per day. `GET /admin/plans?period=`: plans by state, and plans created per day.
  6. DTOs in `dto/out`, and query DTOs with Zod (`period` optional, `7 | 30 | 90`).
     Unit specs for the controller and service.
  7. End-to-end (`tests` agent): each new route answers 404 to an ordinary account and to
     a caller with no session (the API's existing rule, `access.e2e-spec.ts`); `summary` counts an account created in the test; a bad `period` is
     `400 INVALID_INPUT`; no response body contains a meal, plan day, profile field or
     allergen key (the pattern the existing admin suite uses for "nothing about
     anybody").
- **Acceptance criteria**: PRD 1 (for these routes), 7 (API side), 9, 12.
- **Verification**:
  - `pnpm --filter database generate` produces exactly the one new migration.
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api`.
  - `pnpm --filter api test:e2e` (run by the `tests` agent).

### Phase 4 — Web: Resumen, Embudo y actividad, Planes

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 007 phase 4`. Reviews: `accessibility`,
  plus `/local-probe`.
- **Goal**: the first three pages exist with tiles, charts and the period selector, and
  their figures leave the transition page.
- **Scope**: `apps/web/src/app/(admin)/admin/{page.tsx,producto/**}`,
  `apps/web/src/components/{PeriodSelector,AdminNav}/**`, the transition page, the
  dictionaries.
- **Steps**:
  1. `components/PeriodSelector`: three links with `aria-current` on the active period.
     They keep every other query parameter.
  2. `/admin` (Resumen) replaces the redirect.
     - It shows a `StatTile` grid with change arrows and sparklines, a `LineChart` of
       sign-ups per day, and a stacked `ColumnChart` of generations per day by outcome.
     - The "Necesita tu atención" panel links to `/admin/cuentas?activated=no`,
       `/admin/buzon?state=waiting` and `/admin/generacion?status=failed&since=24h`. The
       transition page's anchors stand in until those pages exist, and phases 6 and 8
       repoint the links.
     - The `?abierta=` banner renders here until Cuentas exists (phase 6 moves it).
  3. `/admin/producto`: the funnel as a `BarChart` with the share of the previous step,
     a `LineChart` of active people per day, and a multi-series `LineChart` of events per
     day using the existing `t.events` labels.
  4. `/admin/producto/planes`: a `DonutChart` of plans by state (localised state names,
     not raw enum values) and a `ColumnChart` of plans created per day.
  5. Add the nav entries. Delete from the transition page: the tiles, funnel, activity
     and plans sections.
  6. Each page shows a one-line description under its title. Long hints move into a
     `<details>` titled "Cómo se cuenta" / "How it's counted" where they carry a real
     caveat (the funnel's "counted on rows, not events").
- **Acceptance criteria**: PRD 3, 4 (these rows), 6, 7, 10, 11 (these pages).
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=web`.
  - `/local-probe` on the three pages at 320, 390 and 1280 px, light and dark, with
    periods 7 and 90.

### Phase 5 — API: accounts, professionals and inbox as queryable tables

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 007 phase 5`. Reviews: `invariant-reviewer`
  (the milestone columns must stay milestones). The `tests` agent writes the end-to-end
  cases.
- **Goal**: the three people tables search, filter, sort and page in SQL, and account
  rows carry their milestones.
- **Scope**: `packages/core/src/{controllers,repositories}/{User,Feedback,Professional,Admin}/**`,
  `apps/api/src/modules/admin/**`, `apps/api/test/admin.e2e-spec.ts`,
  `apps/api/test/professionals.e2e-spec.ts`.
- **Steps**:
  1. `GET /admin/accounts` accepts the following, and today's call with only `offset`
     keeps working:
     - `q` (email contains, case-insensitive);
     - `confirmed`, `activated`, `professional` and `onboarded`, each `yes | no`;
     - `tier` (`free | premium`) and `role` (`user | admin`);
     - `sort` (`createdAt | email | lastActiveAt | plans`) and `dir`;
     - `offset` and `size` (25 / 50 / 100).
  2. Each row gains `onboardedAt` (from `onboarding_state.completed_at`), `plans` (count
     of `meal_plans`), `lastActiveAt` (latest `analytics_events.created_at` for the
     user, or null) and `professional` (boolean). These come from correlated
     sub-selects or a lateral join, in one query plus one count.
  3. `GET /admin/people?period=`: sign-ups per week and messages per week (ISO weeks,
     Madrid).
  4. `GET /admin/feedback` accepts `q` (message or sender email), `state`
     (`all | waiting | seen`), `sort` (`createdAt`), `dir`, `offset` and `size`. The
     response keeps `waiting`.
  5. `GET /admin/professionals` accepts `q` and `sort` (`grantedAt | email | links`). It
     is unpaged as today.
  6. Unit specs for each new filter. End-to-end tests: each filter narrows (create two
     accounts that differ in one attribute), sort order holds, an unknown `sort` is
     `400`, an ordinary account gets 404, and the row keys are exactly the allowed set
     (a snapshot of `Object.keys` so a future content column fails the suite).
- **Acceptance criteria**: PRD 1, 5 (API side), 9, 12.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api`.
  - `pnpm --filter api test:e2e` (run by the `tests` agent).

### Phase 6 — Web: Cuentas, Profesionales, Buzón

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 007 phase 6`. Reviews: `accessibility`
  (table, toolbar, row actions), plus `/local-probe`.
- **Goal**: the people pages are tables that search, filter and sort, with today's row
  actions, and the cards are gone.
- **Scope**: `apps/web/src/app/(admin)/admin/{cuentas,profesionales,buzon}/**`,
  `apps/web/src/components/{AdminTable,AccountList,ProfessionalList,FeedbackInbox,AdminNav}/**`,
  the transition page, Resumen's links, the dictionaries.
- **Steps**:
  1. `components/AdminTable` is the table from the Design summary. It works as a plain
     GET form without JavaScript, and the client enhancement is progressive.
  2. `/admin/cuentas` has a `ColumnChart` of sign-ups per week, then the table.
     - Columns: email, created, confirmed, activated, tier, role, onboarding, plans,
       last activity, professional, actions.
     - The row actions reuse today's controls extracted from `AccountList` (activate,
       tier, professional grant or revoke) with their confirmations and error messages
       unchanged.
     - The `?abierta=` banner moves here. Resumen `redirect()`s a request carrying
       `abierta` to `/admin/cuentas?abierta=…`. The API is not touched: `GET
       /admin/activate` keeps its redirect to `/admin?abierta=…`.
  3. `/admin/profesionales`: a table (email, granted, links, actions) plus today's hint.
  4. `/admin/buzon`: a `ColumnChart` of messages per week, then the table (date, sender,
     kind, message wrapped not truncated, state, action), reusing the seen / reopen
     control from `FeedbackInbox`.
  5. Delete `AccountList`, `ProfessionalList` and `FeedbackInbox` once nothing renders
     them (knip will say). Repoint Resumen's links. Delete the three sections from the
     transition page. Add the nav entries.
- **Acceptance criteria**: PRD 4, 5, 8 (account and feedback actions), 10, 11.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=web`.
  - `pnpm -w run deadcode`.
  - `/local-probe` on the three pages, including a search, a filter and a sort, with
    JavaScript both on and off (Playwright `javaScriptEnabled: false`).

### Phase 7 — API: generations, AI, catalogue and pictures

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 007 phase 7`. Reviews: `invariant-reviewer`.
  The `tests` agent writes the end-to-end cases.
- **Goal**: the generation log is complete and queryable, AI and pictures have period
  series, and the catalogue is browsable.
- **Scope**: `packages/core/src/{controllers,repositories}/{Admin,Analytics,Recipe}/**`,
  `apps/api/src/modules/admin/**`, `apps/api/test/admin.e2e-spec.ts`,
  `apps/api/test/dish-pictures.e2e-spec.ts`.
- **Steps**:
  1. `GET /admin/generations` becomes paged.
     - It accepts `status`, `code`, `q` (email), `since` (`24h` or a period), `from`,
       `to`, `offset` and `size`.
     - Today's row shape is kept exactly, calls included, and `total` is added. The web
       reads `rows`; the old array response stays behind `?legacy=1` until phase 9
       deletes it.
     - `GET /admin/generations/stats?period=` returns outcome per day, duration p50 and
       p95 per day in seconds (`percentile_cont` over `finished_at - started_at` of
       finished jobs), and failures by code.
  2. `GET /admin/ai?period=` adds, alongside today's fields (removed in phase 9):
     - period totals (calls, failed, input and output tokens, average latency);
     - calls per day and tokens per day (in and out);
     - `byModel` for the period (model · provider: calls, failed, tokens, average
       latency).
     All of it comes from `ai_call` events. Read `StructuredAiClient` for the exact
     property names, and write down in LOG which ones exist.
  3. `GET /admin/catalogue/recipes` returns name, slug, locale, meal slots, kcal /
     protein / carbs / fat per serving, allergens, picture state (`ready | drawing |
     failed | none`) and source.
     - Macros and allergens are computed with the same helpers the app already uses for a
       recipe. Never a second formula; find them in `RecipeRepository` and
       `core/domain`.
     - It accepts `q` (name), `slot`, `allergen`, `picture`, `source`, `locale`, `sort`
       (`name | kcal | protein | createdAt`), `dir`, `offset` and `size`.
     - It returns counts by slot and by source, and `withoutImage`.
  4. `GET /admin/catalogue/ingredients` returns name, category, kcal and the three macros
     per 100 g, allergens, countries and meal slots. It accepts `q`, `category`,
     `allergen`, `sort`, `dir`, `offset` and `size`.
  5. `GET /admin/pictures?period=` adds spend per day from `recipe_image_calls`.
  6. Unit specs, and end-to-end tests: filters narrow, paging totals hold, 404 for an
     ordinary account, and the catalogue rows carry no user id or `created_by`.
- **Acceptance criteria**: PRD 1, 5 (API side), 7, 9, 12.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api`.
  - `pnpm --filter api test:e2e` (run by the `tests` agent).

### Phase 8 — Web: Registro, IA y modelos, Catálogo, Imágenes; the transition page goes

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 007 phase 8`. Reviews: `accessibility`,
  plus `/local-probe`.
- **Goal**: the remaining pages exist and the transition page is deleted, so every row of
  the PRD inventory is on its new page.
- **Scope**: `apps/web/src/app/(admin)/admin/{generacion,catalogo}/**`,
  `apps/web/src/app/(admin)/admin/anterior/**` (deleted), `apps/web/src/components/{AdminTable,AdminNav,GenerationCalls}/**`,
  Resumen's links, the dictionaries.
- **Steps**:
  1. `/admin/generacion` shows three charts: a stacked `ColumnChart` of outcome per day,
     a `LineChart` of p50 and p95 duration, and a `BarChart` of failures by code. Then
     the table: status, account, started, seconds, attempts, plan (version · model ·
     prompt · reused), code, detail.
     - Each row has a disclosure that opens `components/GenerationCalls`: every call
       field the current page shows, in a nested table, with the same labels
       (`t.logCall*`, `t.rejection`).
     - Filters: outcome, code, email, since and date range.
  2. `/admin/generacion/ia`: `StatTile`s, a `LineChart` of calls per day, a stacked
     `ColumnChart` of tokens per day, and a per-model `DataTable` with a `BarChart` of
     calls per model.
  3. `/admin/catalogo` (Recetas): tiles, a `BarChart` of recipes by slot, and the recipe
     table with its filters. `/admin/catalogo/ingredientes`: the ingredient table.
  4. `/admin/catalogo/imagenes`: a `Gauge` of the month's spend against the cap, a
     `LineChart` of spend per day, and a `DonutChart` of picture states, released
     included. There is also a link to the dish-pictures switch on Ajustes.
  5. Delete `/admin/anterior`, its CSS and its nav entry. Repoint Resumen's failed
     generations link. Remove dictionary keys that only the deleted page used.
- **Acceptance criteria**: PRD 3, 4 (all rows), 5, 6, 7, 10, 11.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=web`.
  - `pnpm -w run deadcode`.
  - `rg -n "admin/anterior" apps` finds nothing.
  - `/local-probe` on every console page, 320 / 390 / 1280 px, light and dark.

### Phase 9 — Removals, documentation and the owner's check

- [ ] pending
- **Dispatch**: sonnet @ medium — `/execute-project 007 phase 9` (mechanical deletion
  against a written list). Reviews: `invariant-reviewer` on the final diff, and an
  `accessibility` pass over the whole console. — human-verify: the owner walks the console
  on their iPhone and on desktop and confirms nothing they use is missing.
- **Goal**: what `0068` removes is gone everywhere, and the docs describe the console.
- **Scope**: `apps/api/src/{config,modules/admin}/**`, `packages/core/src/{controllers,repositories}/{Admin,Analytics}/**`,
  `apps/api/test/admin.e2e-spec.ts`, `apps/web/src/i18n/dictionaries/*`, `apps/web/AGENTS.md`,
  `apps/api/AGENTS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` (only if it names the admin
  screen), this project's PRD and PLAN status lines.
- **Steps**:
  1. Remove the following:
     - from `/admin/ai`: `limits`, `resetsAt`, `lastRefusal`, `refused` and the
       Pacific-midnight window (`nextPacificMidnight` if unused);
     - `AI_REQUESTS_PER_DAY` and `AI_TOKENS_PER_MINUTE` from `Env.validation.ts` and any
       `.env.example`;
     - `GET /admin/failures`, `AdminController.failures` and `recentJobs` if nothing else
       calls it;
     - `overview.jobs`, and `GET /admin/overview` itself if nothing reads it any more;
     - the `?legacy=1` generations shape.
     Update or delete the end-to-end cases that asserted them, including "counts what the
     provider was asked for today".
  2. Remove dictionary keys no page reads (`aiResets`, `aiLastRefusal*`, `aiRefused`,
     `jobsTitle`, `noJobs`, `failureNote`, the pager keys if unused). Check both
     dictionaries for parity.
  3. Docs: in `apps/web/AGENTS.md`, replace the single `/admin` route with the console's
     routes, the `(admin)` group and its "no offline copy" rule. In `apps/api/AGENTS.md`,
     cover the admin module's query conventions (periods, Madrid days, allow-listed
     sorts). In `docs/ROADMAP.md`, update the Admin line. Set PRD status to delivered and
     PLAN status to done.
  4. Tell the owner the two environment variables may be deleted from the API project.
     That is their action, and no agent changes Vercel.
- **Acceptance criteria**: PRD 4 (removal half), 10, 11, 12, and all of PRD 1–12 re-checked.
- **Verification**:
  - `rg -n "AI_REQUESTS_PER_DAY|AI_TOKENS_PER_MINUTE|resetsAt|lastRefusal|admin/failures|nextPacificMidnight" apps packages`
    finds nothing.
  - `.claude/skills/ship/scripts/gate.sh` is green.
  - `pnpm --filter api test:e2e` (run by the `tests` agent).
  - Record "confirmed by owner on <date>" in LOG.

## Hand-off

- **0028 is the floor.** No console page, table or endpoint carries a plan, a meal, a
  profile field, a health value or an allergy of a person. When in doubt, it is out, and
  the executor asks the owner.
- **Every console route is 404 for a signed-in non-admin** on both sides: the
  `(admin)/admin` layout on the web, and `@Roles('admin')` on the API, which is the real
  check. With no session, the API answers 404 as it does everywhere, and the web's proxy
  redirects to sign-in before any page renders.
- **Nothing lost between phases.** A section leaves the transition page in the same phase
  its new page lands. Existing response fields are only removed in phase 9.
- **UI rules.**
  - Load `apple-web-design` before any UI change, and `dataviz` before any chart code.
  - Module CSS and tokens only, and one component per file.
  - `<Fragment>`, never `<>`.
  - Both dictionaries in the same change.
  - Every chart has its "show data" table.
  - No sideways page scroll at 320 px.
- **Pairs that can run as a `/team`.** Phases 3 + 4, 5 + 6 and 7 + 8 are backend then
  web. Run each pair as one `/team` run when convenient. The backend agent lands the core
  view types first, and the frontend agent builds against them.
- **Worktrees**, never a stash (`.claude/skills/team/scripts/worktree.sh`). Only the
  `tests` agent runs the end-to-end suite. `pnpm check:leaks` runs locally before every
  push.
- **Migration.** Phase 3's migration is reviewed by `migration-reviewer`. The owner runs
  it on the dev branch after merge, and the production API applies it on deploy.

## Out of scope

- Plan or profile viewers, catalogue editing, safety-flag triage, OmniRoute gateway
  health, billing figures, CSV export, alerts and live updates (PRD § Out). Each is a new
  decision or project.
- Reusing the chart set on the person's progress screen or in the dietitian workspace.
  That is possible after `0069`, but it is not this project.

## PRD acceptance criteria → phases

| PRD | Phase |
| --- | --- |
| 1 Signed-in non-admin: 404 on page and API; no session: API 404, web to sign-in | 1, 3, 5, 7 |
| 2 No `AppNav` in the console, no link to it from the app | 1 |
| 3 Navigation: groups, `aria-current`, keyboard, 320 px | 1, 4, 6, 8 |
| 4 Inventory rows on their pages; removals gone | 4, 6, 8, 9 |
| 5 Server-side tables with URL state; no card stacks | 5, 6, 7, 8 |
| 6 Charts: server SVG, both themes, data alternative, no library | 2, 4, 6, 8 |
| 7 Period selector and previous-period change | 3, 4, 7, 8 |
| 8 Actions, switches and push test unchanged | 1, 6 |
| 9 No content in any response; milestones only | 3, 5, 7, 9 |
| 10 Dictionary parity, `check:leaks` | 1, 4, 6, 8, 9 |
| 11 Accessibility pass and probe without sideways scroll | 2, 4, 6, 8, 9 |
| 12 Workspace gate green at every boundary | all |

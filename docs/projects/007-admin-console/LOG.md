# LOG — Project 007: The admin console

> **Purpose**: append-only execution record. One entry per phase (plus one per
> deviation): what happened, evidence it works, what changed against the plan. This is
> the file future agents read to learn "what was decided in phase X and why".
> **Audience**: humans and agents. **Committed**: yes — one commit per phase, made by
> the owner at the phase boundary. **Written by**: the executing agent, appending only.
> Write repo-relative: no absolute paths, no references to other private repos.

<!-- Entry format — copy per phase:

## Phase N — Title (YYYY-MM-DD)

- **Executor**: model + effort actually used.
- **Result**: done | partial | blocked.
- **Evidence**: verification commands run and their outcomes (test counts, build
  results). Claims without evidence don't belong here.
- **Deviations from plan**: none, or what changed and why — with the plan amended in the
  same change.
- **Decisions**: links to any docs/decisions/ records created.
- **Notes for the next phase**: anything the next executor must know.
-->

## Phase 1 — The console shell, its navigation and Ajustes (2026-09-28)

- **Executor**: lead on opus (this session) for step 8 and the review fixes; steps 1–7 by
  the `frontend` agent (medium effort) on opus, in its own worktree, brought into the main
  checkout and the worktree removed. Reviews: `accessibility` (with `/local-probe`) and
  `invariant-reviewer`, both on opus.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web`: 14/14 tasks, 0 lint warnings; web 13
    files / 104 tests (4 new), ui 383, core 974, database 43.
  - `pnpm --filter web build`: green; `/admin`, `/admin/ajustes` and `/admin/anterior` are
    dynamic (`ƒ`), every public page still static.
  - `rg -n "AppNav" apps/web/src/app/(admin)`: no match.
  - `pnpm check:leaks`: no leak hit (it only warns about this project's uncommitted docs).
  - `/local-probe` (accessibility agent) with an `--admin` account, the option's first real
    run: `/admin`, `/admin?abierta=…`, `/admin/anterior` and `/admin/ajustes` at 320, 390
    and 1280 px, light and dark — 0 px sideways scroll on all 24. `/admin?abierta=a&abierta=b`
    answers 307 to `/admin/anterior?abierta=…&abierta=…` and the banner shows. With an
    ordinary account every one of those addresses answers 404 with the console's 404
    (`lang="es-ES"`, skip link, no console menu). Both probe accounts deleted, servers
    stopped.
  - `invariant-reviewer`: gate sound, no P0/P1. `accessibility`: no P0/P1.
- **Deviations from plan**:
  1. The 404 is `app/(admin)/not-found.tsx`, not `app/(admin)/admin/not-found.tsx`: a
     segment's `not-found` wraps that segment's pages but not its own layout, so the gate's
     `notFound()` would have skipped a file beside it and fallen to Next's bare page. Plan's
     Design summary and step 1 amended.
  2. `admin/page.tsx` repeats the role check before its `redirect()`: a layout and its page
     render concurrently, so without it a signed-in non-admin could get a 307 that confirms
     the address. Pinned by `app/(admin)/admin/page.test.ts` (added on the
     invariant-reviewer's P2; not in the plan's file list).
  3. `/admin/ajustes` also 404s when `/admin/settings` is null (same guarantee, page side).
  4. Only the switches left the transition page. The picture figures and the professionals
     list stay there until Imágenes and Profesionales exist (phases 6 and 8), so nothing is
     lost.
  5. The reminders switch is labelled with `remindersTitle`, since its old section heading
     is gone; the on/off hints are unchanged.
  6. Ajustes groups: Acceso = automatic activation + the dietitians' practice; Producto =
     premium + dish pictures (row `id="imagenes"` for phase 8's link); Notificaciones =
     check-in reminder + push test.
  7. No "Resumen" nav entry yet: `/admin` is only a redirect, and "only pages that exist
     appear". Phase 4 adds it. `sections.ts` already holds the six groups; empty ones draw
     nothing. Anterior is last, with no group heading.
  8. Outside the listed scope, comments only: `app/_shared/RootShell.tsx` now says four
     root layouts.
  9. `proxy.ts` and `_shared/pages.ts` unchanged (step 7): `PROTECTED` and `PRIVATE_PATHS`
     prefix-match `/admin`, confirmed by the invariant-reviewer.
- **Decisions**: none new. The 404 difference below is recorded in
  `app/(admin)/not-found.tsx`'s comment as accepted.
- **Notes for the next phase**:
  - **Phase 2 (packages/ui) should take the drawer focus race** (accessibility P2, read in
    code, not measured): following a link from the `Sidebar` drawer closes it, and vaul
    returns focus to "Menú" after its ~0.5 s animation, possibly after the route announcer
    has moved focus to the new `h1`. Fix: an `onCloseAutoFocus` prop on `Sidebar`, which
    `AdminNav` prevents when the close came from following a link.
  - Accepted, for the owner to overrule: a signed-in non-admin sees the console's Spanish
    404 at a real console address and Next's bare English 404 at a made-up one, so the two
    can be told apart. The addresses are public (repo, robots.txt) and the API guard
    protects the data. A root `app/not-found.tsx` (or `global-not-found`) would fix it
    site-wide, and give `/nada` a Spanish page with `lang` too. That is a separate change.
  - Open P3s: the transition page has three names (tab "Panel", h1 "Servicio", menu
    "Anterior") — left as the plan says "unchanged", and it goes in phase 8. The sidebar
    says "AJUSTES" then "Ajustes" while the group has one page. At 200% text on 320 px the
    sticky bar may wrap to two rows, and its scroll padding assumes one row. The drawer is
    vaul's `max-width: 280px; width: 80vw`; a `min(22rem, 100vw - 3rem)` would grow with
    the text.
  - Not measured in a browser, because the reviewer could not script it: the keyboard walk,
    the drawer open at 320/390, 200% text. The owner's iPhone check with VoiceOver covers
    the drawer.
  - No `proxy.ts` unit test exists. Consider one for `/admin/*` and `/en/admin/*` without
    a session when a phase touches the proxy.
  - Probe: `node $S/account.mjs create "$PROBE_DIR/admin.txt" --admin` works; see the
    local-probe skill's "An admin" section.

## Phase 2 — Charts, stat tile and data table in packages/ui (2026-09-28)

- **Executor**: the `frontend` agent (medium effort) on opus, in its own worktree, brought
  into the main checkout and the worktree removed; the review fixes by the lead on opus
  (this session). Review: `accessibility` on opus (code, the built docs on a spare port,
  scripted stress cases).
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=ui --filter=docs --filter=web`: 16/16 tasks, 0
    lint warnings; ui 483 tests (was 383), web 104, core 974, database 43.
  - `pnpm --filter ui test:coverage` (builder): statements 93.08, branches 84.4, functions
    95.7, lines 92.82, above the 90 / 80 / 93 / 90 floors.
  - `pnpm --filter docs build`: green, 56 static pages (was 48).
  - `git diff --stat -- '*package.json'`: empty — no chart library, no dependency.
  - `pnpm -w run deadcode`: green without touching `knip.config.ts`. `pnpm check:leaks`:
    green.
  - Docs, 9 new pages, at 320 and 1280 px in light and dark: 0 px sideways scroll (builder
    offline render, 36 shots; accessibility with `probe.mjs` on the built docs).
  - **Colour validator** (`dataviz` skill, `validate_palette.js`, against
    `--background-01`: #fcfcfc light, #161616 dark):
    - Categorical light `#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4,#008300`: band, chroma,
      CVD (worst #eda100↔#1baf7a ΔE 9.1 protan, tritan 5.8) and normal vision (worst
      ΔE 19.6) PASS; contrast WARN, slots 3–5 at 2.74, 2.11, 2.62:1. ALL CHECKS PASS.
    - Categorical dark `#3987e5,#d95926,#199e70,#c98500,#d55181,#008300`: all PASS (worst
      CVD ΔE 8.4 protan), all ≥ 3:1.
    - High contrast light `#2573d1,#ca4908,#01855a,#835803,#b8507a,#008300` and dark
      `#3e8cea,#e46331,#199e70,#c98500,#e05b8a,#309e2c`: all PASS, every slot ≥ 4.5:1 on
      its page (dark, lowest 4.27:1 on #1c1c1c).
    - Status trio, re-chosen after the review (below), all pairs:
      - Light `#0ca30c,#ae111e,#c7c7c7`: CVD PASS (worst ΔE 13.2 deutan, tritan 23.3), normal
        vision PASS (ΔE 29.4).
      - Dark `#008300,#ff958d,#8a8a8a`: CVD PASS (worst ΔE 9.5 protan; before, a WARN at 7.0),
        normal vision PASS.
      - Both FAIL chroma (the neutral is grey by definition) and lightness band (#c7c7c7 at
        0.83, #ff958d at 0.779): these are the price of spacing the three apart in
        lightness.
      - The light neutral is 1.65:1 against the page. Its relief is the same as for slots
        3–5: every chart has a legend and a table, and stacked segments have a 2 px gap.
      - The high-contrast trio is unchanged from the builder's run: CVD and normal vision
        PASS, band FAIL as the price of ≥ 4.5:1.
  - `accessibility`: pass with changes; no P0. Its two P1s are fixed (below).
- **Deviations from plan**:
  1. **`ChartFrame`** (a new public component, with `ChartLegend` and `ChartAxes`) holds
     the figure, caption, legend, "show data" table and empty state once, instead of in
     five copies. It has its own docs page and tests, and `Chart.types.ts` holds the shared
     types.
  2. **Props beyond the contract.** Every string arrives as a prop, since `packages/ui` has
     no dictionary.
     - Every chart requires `emptyLabel`, `labelsHeader` and `locale`.
     - `formatValue` is optional and defaults to the locale's number format; Line and
       Column also take `formatLabel`.
     - `ColumnChart.totalLabel`, `BarChart.shares`, `DonutChart.tones` and
       `DonutChart.shareHeader`.
     - `Gauge` takes `valueLabel`, `capLabel` and `overLabel`, and is drawn as a bar, not
       an arc.
     - `DataTable.hideCaption` and `DataTableColumn.sortHint`.
     - `StatTile` takes `goodDirection`, `sparklineTone` and `locale`. Its `changeLabel`
       is a template with `{change}`, so it is plain data a client component can take.
  3. `aria-sort` sits on the `<th>` with the link inside it, because `aria-sort` is only
     valid on a header.
  4. **BarChart's plot is a `<div role="img">`, not an `<svg role="img">`** (a deviation
     from `0069`'s wording, from the review's P1). Names, figures and shares are HTML text,
     because SVG text cannot wrap: a long dish name at 320 px ran over its figure. The bars
     are an `aria-hidden` SVG per row, and each bar keeps its `<title>`.
  5. **"Examples in both themes" follow the system scheme** rather than showing a light and
     a dark panel side by side. Chrome resolves the `light-dark()` tokens on `:root`, so a
     per-panel `color-scheme` did nothing. Every page was checked in both schemes instead.
     - The docs gained `components/FullWidth` (in `mdx-components.tsx`) so a chart gets
       the preview's full width, plus an example component for ChartFrame.
     - This is recorded in `apps/docs/AGENTS.md`. `packages/ui/AGENTS.md` now describes
       DataTable and the charts.
  6. **`@media (prefers-contrast: more)`** is new in this codebase, and chart components
     read `--color-chart-*` directly. `colors.css` says why this is the exception to
     "primitives only".
  7. **Step 7 (the drawer focus fix, added from phase 1).** `Sidebar` passes
     `onCloseAutoFocus` through. `AdminNavList.onNavigate` receives the `href`, and
     `AdminNav` skips the focus return only when a link to another page was followed with
     a plain click. A modified click (a new tab) no longer counts, from the review's P3.
     `Sidebar.test.tsx` covers the pass-through.
  8. **Review fixes by the lead.**
     - StatTile's figure no longer breaks inside a number: `break-word` and
       `min-content`, and the sparkline gives way (`flex: 0 1 6rem`). This was a P1.
     - The status trio is stepped apart in lightness, as the `colors.css` comment already
       claimed. Before, success and neutral were 1.04:1 in light and 1.00:1 in dark.
     - The DataTable sort link reads a hidden `sortHint` after the header, because a
       changed `aria-sort` is not announced.
     - DonutChart takes an optional share column.
     - BarChart's share is separated by " · ".
     The plan's Scope line is amended with the extra files.
- **Decisions**: none new. The BarChart structure is a deviation from `0069`'s letter
  (SVG text) that keeps its intent (a named image, server-rendered, a table behind it).
- **Notes for the next phase** (4, 6 and 8 use these components):
  - **Never render the same chart element object twice in a Server Component.** The server
    sends it once and references it, so its `useId` ids repeat (see `chart-frame.mdx`).
  - **StatTile:** pass `changeLabel` as the raw dictionary string with `{change}` in it.
    With `previous === 0` no change is drawn. Without `changeLabel`, good or bad shows by
    colour only (the sign still gives the direction), so always pass it.
  - **Tones:** series that mean an outcome take `tone: 'success' | 'failure' | 'neutral'`,
    stacked in that order. Pin `tone: 1..6` when a filter can remove a series, so a colour
    stays with its entity. A seventh untoned series is grey, so fold extras into "other".
  - **Labels:** `YYYY-MM-DD` labels are UTC days, and LineChart spaces them by real time.
    No labels, or no value above 0, gives the empty state. A missing value draws and reads
    as 0; show "—" in a page's own table where the difference matters (review P3).
  - **On a card,** set `--chart-surface` (charts) or `--table-surface` (DataTable).
  - **DataTable:** `rows` is `{ id, cells }[]`, and the first column is the row header.
    Give every sortable column a `sortHint` in both dictionaries ("orden ascendente;
    ordenar de forma descendente"). Phase 6 should add a polite live region that says
    the new order after a sort.
  - **Funnel:** pass `shares`. Planes' donut should pass `shareHeader`.
  - **Open P3s:**
    - Marks are hover-only; the keyboard path is the table.
    - Forced colours keep the SVG fills, but the table and legend still carry the data.
    - The DataTable region is a tab stop even when it does not scroll.
    - SVG heights are fixed in px, so at 200 % text on 320 px the date labels crowd.
    - The figure and its `svg role="img"` both take the title as their name.
    - Phase 4's probe should look at 200 % text.
  - **AdminNav:** there is still no test of the "another page" rule itself, and whether
    VoiceOver reads the new `h1` while the drawer closes needs the owner's iPhone.

## Phase 3 — API: periods, series, Resumen and Producto (2026-09-28)

- **Executor**: the `backend` agent (medium effort) on opus for steps 1–6; the `tests`
  agent (medium effort) on opus for step 7. Both worked in their own worktrees; their
  commits were brought into the main checkout and the worktrees removed. The migration
  comment fix was done by the lead. Reviews: `migration-reviewer` (opus @ high, its floor)
  and `invariant-reviewer` on opus.
- **Result**: done. The whole end-to-end suite is left to CI's throwaway Postgres (see
  Evidence).
- **Evidence**:
  - `pnpm --filter database generate` produced exactly one migration,
    `0046_the_console_reads_events_and_jobs_by_day`. A second run reports "No schema
    changes". `node scripts/check-migrations.mjs`: "47 in all, journal and snapshot in
    order".
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api`: 11/11
    tasks; core 1010 tests, api 926. `domain/Period` has 100 % coverage. Format is clean.
  - The builder ran the three controller methods for periods 7, 30 and 90 against the dev
    branch, with SELECT statements only. Every query ran and the day axes were right.
  - End-to-end (`tests` agent), run locally against Nutria-E2E:
    - `admin.e2e-spec` and `access.e2e-spec` together: 2 suites, 30/30 passed.
    - The full run was stopped at about 40 min. `care-review`'s `beforeAll` went over its
      120 s hook timeout against Neon, unrelated to these routes.
    - CI's `end-to-end` check on the pull request, against a throwaway Postgres, is the
      full-suite evidence.
    - The suite's leftover-account check fails locally regardless, on 139 old `.invalid`
      accounts from earlier runs. Deleting them is a bulk write to Nutria-E2E, so it needs
      the owner's yes.
  - **Migration 0046: plain `CREATE INDEX`, not `CONCURRENTLY`.**
    - drizzle's migrator runs every pending migration inside one transaction
      (`drizzle-orm/pg-core/dialect.js` `migrate` → `session.transaction`, as migration
      0040 notes), and Postgres refuses `CONCURRENTLY` inside one.
    - Dev row counts, read on 2026-09-28 inside a READ ONLY transaction: `analytics_events`
      1,143, `plan_generation_jobs` 86, `user` 147, `meal_plans` 72. The build takes
      milliseconds under a SHARE lock.
  - `migration-reviewer`: **ship**. It found no data loss, the old API is unaffected, and
    a rollback is safe. Its three findings were all about the wording of the hand-added
    comment, and they are fixed:
    - the comment no longer tells anyone to build the index by hand, which would make this
      file fail with 42P07;
    - "writes wait until both builds commit";
    - "decision 0068".
  - `invariant-reviewer`: **sound**, no P0/P1.
    - Guards run before pipes, so a non-admin gets 404 before `period` is read.
    - `period` is allow-listed and is the only input.
    - There is no injection: the one `sql.raw` is the `'Europe/Madrid'` constant.
    - Every read is a count or a sum.
    - Its P2 (no end-to-end coverage) is closed by step 7.
- **Deviations from plan**:
  1. **A bad `period` is `422 INVALID_INPUT`, not 400.** 422 is the API's one status for
     invalid input (`InputParseError`); a 400 would have meant changing `shared/filters`.
     The Design summary, step 7 and phase 5's step 6 are amended.
  2. **The Zod schema lives in a new `core/entities/Period`,** because a DTO's schema must
     come from `core/entities` and entities cannot import domain.
     `domain/Period.parsePeriod` delegates to that schema, so the grammar is written once.
     The Scope line is amended.
  3. **The event series is in `AdminSeriesRepository`, not `AnalyticsRepository`,** so
     every per-day series and its day helper live in one file. `AnalyticsRepository` is
     unchanged.
  4. **The query is bound by a local `PeriodQuery()` helper** in `Admin.controller.ts`: a
     `@Query(new ZodValidationPipe(schema))` on the one parameter, plus `@ApiQuery`. There
     is no shared decorator yet; phases 5 and 7 may want one.
  5. **Not provided:** a sparkline for the success rate (no natural daily series) and a
     per-day picture spend series (phase 7's step 5).
- **Decisions**: none new.
- **Notes for the next phase** (4 builds against these):
  - **Types** are in `core/controllers/Admin`:
    - `AdminSummaryView`, `AdminProductView`, `AdminPlansView`;
    - `DaySeries` (`days` as Madrid `YYYY-MM-DD`, oldest first, today last, a quiet day
      is 0) and `DaySeriesGroup` (`{ days, series: { key, values }[] }`, every key present);
    - `PeriodComparison`, `RateComparison` (`null` when no job finished; show "—", never
      0 %), `TrendTile` (`{ current, previous, sparkline }`) and `PeriodWindowView`.
  - **`summary.charts.generations` keys:** `queued`, `running`, `succeeded`, `failed`.
    Map them to tones success, failure and neutral, stacking success, failure, then
    neutral.
  - **`product.events` keys:** `session_started`, `swap_requested`. Use the existing
    `t.events` labels.
  - **`plans.byState`** lists all seven states in schema order, zeros included, counted
    over all plans rather than the period. Show localised state names.
  - **The funnel** is the same all-time object `/admin/analytics` returns.
  - **`activePeople.sparkline`** counts distinct people per day, so its sum can exceed the
    period total. Say so in "Cómo se cuenta".
  - **Picture spend:** `pictures.spentUsd` is the period's spend; `monthSpentUsd`,
    `monthStart` and `capUsd` are the month against the cap (UTC month, as
    `/admin/pictures`).
  - **`waitingAccounts`** is `activated_at IS NULL`, which includes unconfirmed addresses:
    the existing definition.
  - **`PeriodSelector`** can use `parsePeriod` from `core/domain/Period`.
  - **After merge, owner-gated:** run `pnpm --filter database migrate` against the dev
    branch. The production API applies 0046 on deploy.
  - **Follow-ups, not in scope:**
    - `analytics_events_event_idx` is now redundant with the composite index; drop it in a
      later migration.
    - `meal_plans`, `user` and `recipe_image_calls` have no `created_at` index; that is
      fine at today's sizes.
    - Past about 10^6 `analytics_events` rows, an index build blocks inserts for seconds,
      and past 10^7 it needs its own path.

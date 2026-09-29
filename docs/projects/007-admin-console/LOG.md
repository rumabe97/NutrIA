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

## Phase 4 — Web: Resumen, Embudo y actividad, Planes (2026-09-28)

- **Executor**: the `frontend` agent (medium effort) on opus, in its own worktree, brought
  into the main checkout and the worktree removed; the review fixes by the lead on opus
  (this session). Review: `accessibility` on opus, with `/local-probe`.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web --filter=ui --filter=docs`: 16/16 tasks, 0
    warnings; web 103 tests (the 4 redirect tests went with the redirect, and 3 new ones
    were added for `periodHref`), ui 483.
  - `pnpm --filter web build`: green, with `/admin`, `/admin/producto` and
    `/admin/producto/planes` dynamic (`ƒ`). `pnpm --filter docs build`: 56/56.
  - `/local-probe` (accessibility agent) with an `--admin` account:
    - Pages: `/admin` with no period, 7, 90 and `?abierta=`; `/admin/producto` and
      `/admin/producto/planes` at 7 and 90; `/admin/anterior`.
    - At 320, 390 and 1280 px, light and dark: 54 of 54 `ok`, 0 px sideways scroll, one
      `h1` each, no hints.
    - An ordinary account gets a 404 at the same address on every page, never a redirect.
    - The keyboard order is right, focus is always visible, and targets are ≥ 44 px on
      touch.
    - Both probe accounts were deleted and the servers stopped.
    - The dev data is thin: previous periods are all 0, so no change arrow was drawn, and
      no queued or running job existed. The change wording was checked in code only.
  - `accessibility`: pass with fixes, no P0/P1. Its P2s were fixed by the lead after the
    probe (see Deviations 5); these fixes were not re-measured in a browser.
- **Deviations from plan**:
  1. Three shared components, `AdminPageHeader`, `AdminSection` and `HowCounted`, were
     added outside the listed scope; the Scope line is amended.
  2. New `pages` titles in both dictionaries: `/admin` is "Resumen", plus
     `/admin/anterior`, `/admin/producto` and `/admin/producto/planes`.
  3. Generations: `queued` and `running` share one neutral series, "En cola o en curso",
     because two neutral series would look identical. The stack is success, failure,
     neutral, with a total column in the table.
  4. The success-rate tile has no arrow, because a rate moves in points, not in per cent
     of itself. Its note states the previous rate, and it shows "—" when no job finished.
  5. Review fixes (the Scope line is amended for the `packages/ui` ones):
     - The unselected period segment was 4.42:1 in light; its text is now
       `--foreground-01`.
     - At 200 % text on 320 px, Resumen did not reflow. Each page's grid is now
       `minmax(0, 1fr)`.
     - The x-axis dates collided at 200 % text. Under 17rem of chart width only the first
       and last are kept (`ChartAxes`, a `centre` class).
     - The light chart neutral was 1.69:1 against a card. It is now `#6f6f6f`: success
       lightest, neutral between, failure darkest. Validator, all pairs: band, CVD (worst
       ΔE 10.5 deutan) and contrast PASS; chroma FAIL, as grey must.
     - BarChart's names and figures sat inside `role="img"`, so VoiceOver skipped the
       funnel. The wrapper role is gone and the bars stay `aria-hidden`; the figure keeps
       its caption as its name.
     - LineChart's inner drawing SVG is `aria-hidden`.
     - The console bar is two rows tall at 200 % text on a phone. Its scroll padding now
       follows under `(width < 20rem)`.
- **What left the transition page, and what stayed**:
  - Left:
    - the accounts tile (total and waiting) and the failures tile, now on Resumen;
    - the `?abierta=` banner, now on Resumen;
    - the funnel, activity and plans by state;
    - the `/admin/analytics` fetch and ten dictionary keys only those sections used, in
      both languages.
  - Stayed (no new home yet): the recipe (with without-picture) and ingredient tiles
    until phase 8; pictures, accounts, professionals, inbox, AI, the recent jobs list and
    the generation log.
- **Decisions**: none new.
- **Notes for the next phase**:
  - **Links to repoint.** The "needs you" links are `NEEDS_YOU_HREF` in
    `app/(admin)/admin/page.tsx` and point at `/admin/anterior#cuentas`, `#buzon` and
    `#registro`.
    - Phase 6 repoints the first two to `/admin/cuentas?activated=no` and
      `/admin/buzon?state=waiting`. It also moves `?abierta=` to Cuentas with a
      `redirect()` from Resumen, which must repeat the role check before it and needs a
      test like phase 1's `page.test.ts`.
    - Phase 8 repoints `#registro` to `/admin/generacion?status=failed&since=24h` and
      moves the catalogue counts.
  - **`PeriodSelector`** takes `pathname` and the page's query. `PageQuery` is exported
    from `components/PeriodSelector`.
  - **Open P3s:**
    - Every chart's disclosure is "Ver datos"; add the chart's title as hidden text.
    - A chart's name is announced by both the figure and its SVG.
    - The `?abierta` banner is not announced on load; move it right after the intro.
    - A tile whose previous period is 0 shows no comparison, so it looks like "no
      change".
    - The one-page groups show "RESUMEN" over "Resumen".
    - The transition page still has three names.
  - **iPhone only:** how VoiceOver reads the tiles, figures and funnel; whether the banner
    is announced; the safe areas under the sticky bar.

## Phase 5 — API: accounts, professionals and inbox as queryable tables (2026-09-28)

- **Executor**: the `backend` agent (medium effort) on opus for steps 1–6's API and unit
  specs; the `tests` agent (medium effort) on opus for the end-to-end half. Both worked in
  their own worktrees, which were brought into the main checkout and removed. The review
  fixes were done by the lead on opus (this session). Review: `invariant-reviewer` on opus.
- **Result**: done. The NUL-search cases are proven by CI's end-to-end run (see Evidence).
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`: 17/17 tasks;
    core 1053 tests, api 954, web 103. API format is clean. `deadcode` is green.
  - The builder ran the list methods and `people` against the dev branch, SELECT only
    inside a READ ONLY transaction, for every filter and sort and the escaped search.
    - This caught a real bug: drizzle drops the table name on single-table columns, so a
      bare `"id"` inside a sub-select bound to the inner table.
    - The fix names the outer row as `"user"."id"`, and a unit test renders the real
      select list. The builder confirmed the test fails when the bug comes back.
    - `EXPLAIN`: a seq scan on `user`, with the sub-selects on `meal_plans_user_id_idx` and
      `analytics_events_user_idx`, so no index is needed.
  - End-to-end (`tests` agent), local against Nutria-E2E with the `VAPID_*` keys blanked:
    - `admin` 36/37, `access` 8/8, `professionals` 21/22.
    - The two failures were the NUL search (`q=%00`, a 500), which was not yet fixed in
      the tests agent's base. The lead's fix is in the shared `search` schema, which all
      three routes use.
    - The PR's `end-to-end` check is the run that proves it.
    - Leftover `.invalid` accounts were 2 before and 2 after: the two billing accounts
      below.
  - `invariant-reviewer`: no P0.
    - Milestones stay milestones: `presentAccount` copies exactly 11 fields.
    - `lastActiveAt` cannot reveal anything: `ai_call` is recorded without a user, and a
      professional's swap records no event.
    - `professional` is the grant row, true whatever the switch says.
    - `q` is escaped and bound as a parameter, and sort columns come from maps.
    - Its P1 and P3s are fixed (Deviations 6).
- **Deviations from plan**:
  1. **`size` accepts any integer from 1 to 100, not only 25/50/100,** because an existing
     test pages with 2. The web offers 25/50/100 (`PAGE_SIZES`). Step 1 is amended.
  2. **`offset` and `size` are strict:** a bad value is 422 where it used to be clamped.
     The transition page's `?cuentas=` / `?buzon=` pager now clamps its own offsets.
  3. **The inbox's default page size is 25** (was 20), to match the table's choices.
  4. **`/admin/professionals` also takes `dir`,** so a sortable header can say which way.
  5. **Files outside the listed scope** (the Scope line is amended):
     - `core/entities/AdminQuery`: a DTO's schema lives in entities;
     - `core/repositories/Search`: literal LIKE escaping and sort helpers;
     - `weekKey`, `madridWeekKeys` and `fillWeeks` in `core/domain/Period`;
     - `apps/api/src/modules/admin/controllers/ZodQuery.ts`, a whole-query DTO bound to
       one parameter, now used by `PeriodQuery()` too;
     - `access.e2e-spec.ts`.
     The unused `Page` type is gone from `core/controllers/User`.
  6. **Review fixes by the lead:**
     - **P1, the request log recorded the owner's search text.** `?q=` can hold an address
       or words copied from somebody's message. `pino.ts` now replaces any `q` value with
       `[redacted]`, in the URL and in the `referer`, including inside a percent-encoded
       `next=`. `pino.spec.ts` covers it.
     - **P3, a NUL in `q` was a 500.** The shared `search` schema now refuses it with a
       422, pinned by `AdminQuery.test.ts` and the end-to-end cases.
     - **P3, the transition page's pager could send an out-of-range offset.** It now
       clamps it.
  7. **The end-to-end suite deletes `analytics_events` by hand.** Every account made
     through the API signs in and so has a `lastActiveAt`. To test "nulls last", a helper
     in `admin.e2e-spec.ts` deletes the events of two of the suite's own `@e2e.invalid`
     accounts. It refuses any other address.
- **Decisions**: none new. Vercel's own request log also records the path with its query;
  0068 keeps table state in the URL, so a search there is visible to the Vercel project's
  owner, who is the same person reading the console.
- **Notes for the next phase** (6 builds the tables against these):
  - **Types:**
    - accounts: `Paged<AccountView>` (`core/controllers/User`);
    - feedback: `Paged<FeedbackView> & { waiting }` (`core/controllers/Feedback`);
    - professionals: `readonly ProfessionalAccountView[]` (`core/controllers/Professional`);
    - people: `AdminPeopleView` (`core/controllers/Admin`), whose weeks are named by their
      Monday `YYYY-MM-DD` in Madrid, and whose first and last weeks may be partial.
    - `PAGE_SIZES` is exported.
  - **Account row keys:** `id, activated, createdAt, email, emailVerified, role, tier,
    lastActiveAt (ISO|null), onboardedAt (YYYY-MM-DD|null), plans, professional`.
  - **Parameters:**
    - accounts: `q`; `confirmed`, `activated`, `professional` and `onboarded` (`yes|no`);
      `tier`; `role`; `sort` (`createdAt|email|lastActiveAt|plans`); `dir`; `offset`;
      `size`;
    - feedback: `q`, `state` (`all|waiting|seen`), `sort`, `dir`, `offset`, `size`;
    - professionals: `q`, `sort` (`grantedAt|email|links`), `dir`.
    - Nulls sort last in both directions.
  - **Row actions from `/admin/cuentas?q=…` will send that URL as the `referer`,** and the
    log redacts `q`. Name any new free-text parameter `q`, or extend `SEARCH_PARAMETER` in
    `pino.ts`.
  - **Two billing test accounts cannot be deleted locally** (`billing-…@e2e.invalid`).
    They carry a fake Stripe customer `cus_e2e_…`, and deleting the account fails with a
    500 when Stripe answers "No such customer". That is a small product gap: deleting an
    account should tolerate a customer Stripe no longer has. It is for the payments round;
    the owner decides.
  - **Tests-agent instructions:** blank `VAPID_*` when running the suites locally. The
    local `apps/api/.env` has them set, which makes the existing push-test case fail
    here; CI is unaffected.
  - Minor, not fixed: in `AdminSeriesController.test.ts`, the `NOW` comment calls
    2026-09-28 a Sunday; it is a Monday.

## Phase 6 — Web: Cuentas, Profesionales, Buzón (2026-09-28)

- **Executor**: the `frontend` agent (medium effort) on opus, twice. First it built the phase.
  Second, from the build's commit, it fixed the accessibility findings and the owner's
  three requests. Both worktrees were brought into the main checkout and removed. The
  lead (opus, this session) made the last fixes. Reviews: `accessibility` on opus with
  `/local-probe`, twice.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web --filter=ui`: 14/14 tasks, 0 warnings; web
    121 tests, ui 486. `pnpm -w run deadcode`: green. `pnpm --filter web build`: green,
    every console page dynamic. `pnpm --filter docs build`: green.
  - **First review** (`/local-probe`, 9 paths × 320/390/1280 × light/dark, JS on and off):
    - The GET form, sorting, paging, the 404s and contrast all passed.
    - It found one P1: at 320 px the pinned first column covered the grant form and the
      revoke confirmation.
    - It found five P2s: focus fell to `<body>`, row actions failed label-in-name, row
      names broke into pieces, an invalid collegiate number was not announced, and the
      toolbar was 1045 px tall at 200 % text.
    - It found the 0028 issue below.
  - **Second review, every earlier finding re-measured and fixed:**
    - The grant form and the revoke confirmation are dialogs: 288 px wide at 320, focus
      trapped and returned.
    - After each action focus lands on the button or on the table's status line, never on
      `<body>`.
    - Every row action's name starts with its visible text.
    - An invalid collegiate number is announced through an always-mounted alert.
    - The toolbar is 369 px at 200 % text, with its filters folded into "Filtros (n
      activos)".
    - A non-admin gets "Página no encontrada · NutrIA" on all 8 pages and on `/admin/zzz`.
    - Across 8 paths × 3 widths × 2 themes: 0 px sideways scroll, and no dark strip while
      scrolling a real viewport.
  - **Lead's check after the last fixes** (viewport shots, real scroll, with an admin probe
    account, deleted after):
    - `/admin/cuentas` at 1280 and 390, dark: dates on one line and 0 px sideways scroll.
    - The empty state at 320 px sits inside the screen (x 57–287).
    - `/admin/profesionales` at 320 px, 200 % text: the title hyphenates ("Profe-sionales")
      and nothing is cut.
- **The owner's requests (2026-09-28), all done**:
  1. **"The background gets cut and a black part shows."** It was the DataTable's pinned
     first column, whose flat fill could never match the page's ambient gradient.
     Scrolling a real viewport showed the gradient itself is continuous. Every console
     table now sits on a `Card`, like the charts, and the pinned column takes the card's
     colour (`--table-surface: var(--surface-card)`).
  2. **Menu: no heading followed by a page of the same name.** A group with exactly one
     page draws as just that link: Resumen, PERSONAS…, PRODUCTO…, Ajustes, Anterior,
     "Volver a NutrIA". Groups of two or more keep their heading. `ADMIN_SECTIONS` is
     unchanged, so Generación and Catálogo get their headings as their pages land.
  3. **Emails on one line.** Addresses never wrap. Below a 36rem table width, the first
     column stops being sticky, so a long address never covers the other columns. The
     lead extended this to every console table cell (dates, numbers, words); only Buzón's
     message wraps, on purpose.
- **Deviations from plan**:
  1. The row actions live in their own islands (`AccountActions`, `ProfessionalRevoke`,
     `FeedbackToggle`). `components/Pager` was deleted, since nothing else used it.
     `AdminFilters`, `AdminTableStatus` and `useKeepFocus` are new. The Scope line is
     amended.
  2. **Resumen's `?abierta=` redirect is `forwardOpened.ts`,** which the page awaits
     first. It is tested there, because vitest here cannot transform a page with JSX. It
     repeats the role check before `redirect()`, so a non-admin and no session get 404,
     never a redirect.
  3. **Profesionales has an extra column, the collegiate number,** because the old list
     showed it and nothing may be lost.
  4. **The page size sits in the toolbar form,** because the pager cannot hold a nested
     form.
  5. **Cuentas and Buzón have a `PeriodSelector`,** because `/admin/people` takes a period.
     Weeks are labelled by their Madrid Monday.
  6. **Every console page carries `consoleMetadata(path)`,** and `admin/[...rest]` makes
     every console 404 identical: a fix for `0028` that reached back to phases 1 and 4.
     `readConsoleUser` is wrapped in React `cache`, so the gate and the metadata share
     one read of `/users/me`.
  7. **`packages/ui`:**
     - `Dialog`: optional `closeButton`, an `onCloseAutoFocus` pass-through, a scrolling
       sheet, and a title that breaks long addresses (3 tests, docs updated);
     - `DataTable`: the region is measured (`container-type`), and the empty state is
       pinned at the region's left edge and no wider than what is visible.
  8. **The lead's last fixes:**
     - the empty state, which was off screen at 320 px;
     - `AdminPageHeader`, whose title is allowed to break at 200 % text;
     - the revoke dialog, which now opens on Cancelar, so two presses of Enter never
       revoke;
     - one-line cells in every console table.
- **What left the transition page, and what stayed**:
  - Left: the accounts list and its `?cuentas=` pager, the professionals list and its
    hint, and the inbox with its waiting count and `?buzon=` pager. With them went their
    four reads and 41 `admin` dictionary keys; the ones still needed moved to
    `adminAccounts`, `adminProfessionals` and `adminInbox`.
  - Stayed: the recipe and ingredient tiles, pictures, AI, the recent jobs and the
    generation log.
- **Decisions**: none new.
- **Notes for the next phase** (8 builds on `AdminTable`):
  - **`AdminTable`:** pass a schema from `core/entities` to `readTableQuery`. Filters are
    `AdminTableFilter[]`, a column sorts with `sort: { value, first }`, and more than one
    filter folds into `AdminFilters`.
  - **Free text:** any free-text parameter must be `q` (the API log redacts only `q`).
    Cells are one line by default; a prose cell sets its own wrapping.
  - **Repoint:** `NEEDS_YOU_HREF.failed` in `app/(admin)/admin/page.tsx` goes to Registro.
    Remove `activationTitle`, `premiumTitle` and `remindersLabel` with the transition
    page; they were already unused.
  - **Open, not fixed:**
    - With JS off, a non-admin's 404 HTML is blank. There is no `h1`, but nothing leaks
      either. The cause is Next 16 metadata streaming; the only fix is blocking metadata
      site-wide (`htmlLimitedBots`), which is the owner's call. P3.
    - Any failed read of `/users/me`, a 429 included, shows an admin the 404. That is by
      design, but an admin on a flaky connection is told the page doesn't exist.
    - P3s:
      - the invalid-number sentence can be spoken up to three times;
      - with filters on at 320 / 200 %, the filters open to 1105 px;
      - at 390 px nothing hints that more columns scroll sideways.
  - **iPhone only:** how VoiceOver reads the dialogs and the focused status line, and the
    drawer against the safe areas.

## Phase 7 — API: generations, AI, catalogue and pictures (2026-09-29)

- **Executor**: the `backend` agent (medium effort) on opus for the API and unit specs, and
  the `tests` agent (medium effort) on opus for the end-to-end half. Both worked in their
  own worktrees, which were brought into the main checkout and removed. The lead (opus,
  this session) made the review fixes. Review: `invariant-reviewer` on opus.
- **Result**: done. The P1 end-to-end case is proven by CI on the pull request (see
  Evidence).
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`: 17/17 tasks;
    core 1116 tests, api 964, web 121. Format is clean and `deadcode` is green.
  - Dev-branch probe by the builder, read-only (`default_transaction_read_only=on`):
    - 38 generations; `status=failed` gives 13, `code=GENERATION_AI_UNAVAILABLE` 7. Over 30
      days, p95 reaches 1215.3 s.
    - AI: 840 `ai_call` events. The SQL-grouped `models` equals `summariseAiCalls` over the
      same raw events for all 27 model·provider pairs.
    - Recipes: 1,672 (517 breakfast; 500 seed, 1,172 ai); `allergen=gluten` gives 504.
    - Ingredients: 930; `allergen=milk` gives 127.
    - Timings: a kcal sort over Neon takes about 1.2 s, a name page 0.3–0.75 s.
  - End-to-end, local, `VAPID_*` blank: `admin`, `access`, `dish-pictures` and
    `allergy-safety` gave 76/77. `allergy-safety` passes with `loadCatalogue`'s new
    parameter.
    - The one failure was the P1 case below, written against a base without the lead's
      fix. It expects exactly the shape the fix gives: the same `rejected` without the two
      keys. The PR's `end-to-end` check is the run that proves it.
    - Leftover `.invalid` accounts were 2 before and 2 after: the two billing accounts.
  - `invariant-reviewer`: no P0. Injection, routes, `q` and the catalogue naming nobody are
    all sound. Its P1 and P2s are fixed (Deviations 6).
- **`ai_call` properties** (from `StructuredAiClient`):
  - a success records `answeredModel, costUsd, inputTokens, model, ms, ok: true,
    outputTokens, provider, reasoningTokens`;
  - a failure records `costUsd, model, ms, ok: false, provider, quotaExhausted, quotaLimit,
    retryAfterSeconds, status, timedOut`, with no tokens;
  - the dev branch holds exactly these 14 keys;
  - the events are recorded with a null user;
  - a call counts against the model that answered, else the model asked for, else
    `unknown`, in one function (`aiModelOf`).
- **Catalogue macros and sorting** (approved by the lead, 2026-09-28):
  - Macros per serving come only from `core/domain/Composition`
    (`composeMacros` + `scaleMacros(1/servings)`, equal to `composePerServing`, pinned by a
    spec) over the non-optional ingredients. There is no second formula.
  - Filters run in SQL.
    - `sort=name` is ordered and paged in SQL, and only the page is costed.
    - `sort=kcal|protein` costs every match in the controller and sorts there, uncosted
      recipes last.
  - Worst case (no filter plus a kcal sort) is about 1,672 recipes, 9,900 served-ingredient
    rows and 930 ingredients, roughly 0.7 MB per request. That is acceptable for an
    owner-only console read now and then.
- **Picture state**:
  - `ready` is a `ready` status with a file;
  - `drawing` is a `drawing` status;
  - `failed` is a `failed` status that has not been released;
  - `none` is no row, a released row, or `ready` without a file.
  - `withoutImage` counts every recipe that is not `ready`.
- **Deviations from plan**:
  1. **`createdAt` is not a recipe sort,** because `recipes` has no creation date. It is a
     422, and step 3 is amended.
  2. **Names for the new `/admin/ai` fields.** The per-model list is `models`, because
     `byModel` holds today's list until phase 9. The series are `callsPerDay` and
     `tokensPerDay`. `totals` carry `{ current, previous }` so the tiles can show a change.
  3. **`durations` is null on a day with no finished job,** not 0.
  4. **Files outside the listed scope** (the Scope line is amended):
     - `core/entities/AdminQuery`;
     - `shiftDay` exported from `core/domain/Period`;
     - `repositories/Admin/AdminSql.ts` (`madridDay`, `within`, `qualified`);
     - the controllers `AdminLogController`, `AdminUsageController` and
       `AdminCatalogueController`;
     - `RecipeRepository.loadCatalogue`'s optional `slugs`;
     - the transition page now calls `/admin/generations?legacy=1`.
  5. **The end-to-end suite writes four failed jobs straight into `plan_generation_jobs`.**
     A failure cannot be provoked on demand. The jobs are restricted to `.invalid` accounts
     and deleted with them; the README says so.
  6. **Review fixes by the lead:**
     - **P1, `0028` / `0068`.** The addressed generation row, in the paged log and in
       `?legacy=1`, no longer carries `rejected.allergen` or `rejected.unwanted` in any
       call. Those reasons come from the person's allergies and way of eating, and next to
       their address they said "this person has an allergy" or "keeps a religious rule".
       The paged, searchable log would have made that reachable for any job. The other
       reasons stay. This is pinned by `AdminLogController.test` and by the end-to-end
       case. It predates this phase: it held for the latest 20 jobs since #27.
     - `AdminAiRepository`'s `sql.raw` key is a closed union of the `ai_call` names.
     - A spec pins that `loadCatalogue` without `slugs`, the allergy layer's path, sends
       its SQL with no filter.
     - The request log redacts `q[]=` and `q[x]=` too.
     - A literal NUL in `AdminController.ts` had made git treat the file as binary; it is
       now the `\u0000` escape.
- **Decisions**: none new. The P1 fix trims what the PRD's Registro lists ("rejections by
  reason") under `0028`'s floor. If the owner wants per-reason totals, they can go on the
  stats, which name nobody, in phase 8.
- **Notes for the next phase** (8 draws these):
  - **Types** in `core/controllers/Admin`:
    - `AdminGenerationsView` (paged) and `AdminGenerationStatsView`, with `durations`
      `{ days, p50, p95 }` and `failuresByCode`;
    - `AdminAiView` (`totals`, `callsPerDay`, `tokensPerDay`, `models`);
    - `AdminPicturesPeriodView` (`spendPerDay`);
    - `AdminRecipesView` (with `counts`) and `AdminIngredientsView`.
  - **Parameters:**
    - generations: `status`, `code`, `q`, `since` (`24h|7|30|90`), `from`/`to` (Madrid
      days), `offset`, `size`;
    - recipes: `q`, `slot`, `allergen`, `picture`, `source`, `locale`, `sort`
      (`name|kcal|protein`), `dir`;
    - ingredients: `q`, `category`, `allergen`, `sort`
      (`name|category|kcal|protein|carbs|fat`), `dir`.
  - **On screen:**
    - A recipe's macros can be `null` when it cannot be costed; show "—".
    - Recipe and ingredient `allergens` / `mayContain` are the dish's label, not anyone's
      allergy; say so in "Cómo se cuenta".
  - **Open, for the owner:**
    - The paged log reaches `errorDetail` on every old job. `withoutEcho`, which strips
      what a provider's refusal echoes of the request, only arrived on 2026-09-26 (#117),
      so production rows from before may hold request text. Check them, or scrub them
      once, before Registro shows the full table.
    - Data, not code: some generated lunches cost about 2,600–2,700 kcal per serving
      (e.g. "Arroz basmati de carga…"). That comes from the recipes' own grams and
      servings.

## Phase 8 — Web: Registro, IA y modelos, Catálogo, Imágenes; the transition page goes (2026-09-29)

- **Executor**: the lead on opus (this session) for the API additions and the review
  fixes; the `frontend` agent (medium effort) on opus for the pages, in its own worktree,
  fast-forwarded onto the local phase branch and removed. Review: `accessibility` on opus
  with `/local-probe`.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web --filter=ui --filter=core --filter=api`:
    17/17 tasks; web 125 tests, ui 486, core 1129, api 974. `deadcode` is green,
    `rg -n "admin/anterior" apps` finds nothing, and the web build lists every console
    page as dynamic.
  - `accessibility` with `/local-probe`: 11 pages × 320/390/1280 × light/dark, all 200
    with 0 px sideways scroll. The first run's 404s were the API's rate limit at the
    probe's speed and all passed on a slower re-run. `/admin/anterior` now 404s, and an
    ordinary account gets the console's 404 on every new page. Verdict: pass with
    conditions, no P0 or P1.
  - The lead's own checks (Playwright, CDP `Page.setFontSizes`, an admin probe account,
    deleted after):
    - every console page at 200 % text on 320 px gives 0 px past the viewport, measured
      without the `html` clip;
    - a Registro calls disclosure opens at 320 px;
    - the empty state sits inside the screen;
    - Recetas, Ingredientes and Cuentas at 1280 gave 0 px (the sort hints no longer
      escape).
    - Note: a first run with `servers.sh start --no-build` served a stale API build that
      lacked phase 7's routes, and the pages crashed. Always rebuild after an API change.
- **The owner's asks folded into this phase (2026-09-29)**:
  1. **"¿Por qué no se ve el dinero gastado en generar planes?"** Each `ai_call` already
     carried `costUsd` and no view summed it.
     - `/admin/ai` adds `totals.costUsd`, with the period before, and `spendPerDay`.
     - `/admin/summary` adds `tiles.textAi`, the period spend with its sparkline.
     - On screen: a Resumen tile, "Gasto en IA de texto", and on IA y modelos a spend tile,
       a spend-per-day line and a cost column per model.
     - The spend covers the dishes generated for plans and the nightly step rewrites,
       which the events do not tell apart. "Cómo se cuenta" says so, and adds that
       pictures are billed apart.
  2. **Sortable table headers sat higher than plain ones on a phone.** The sort link is a
     44 px touch target and the headers were bottom-aligned. `DataTable`'s header cells
     now centre vertically, on every table.
- **Deviations from plan**:
  1. **Dictionaries.**
     - New sections: `adminLog`, `adminAi`, `adminRecipes`, `adminIngredients`,
       `adminPictures`.
     - `t.rejection` and the `logCall*` keys moved into `adminLog`, and some strings
       changed (the call's model and request id have their own columns).
     - Every key only the transition page read is gone, including those phase 9 step 2
       listed (`aiResets`, `aiLastRefusal*`, `aiRefused`, `jobsTitle`, `noJobs`,
       `failureNote`, `activationTitle`, `premiumTitle`, `remindersLabel`).
  2. **`AdminTable`:**
     - a `kind: 'date'` filter (native date fields in Filtros);
     - `sort` is optional;
     - `readTableQuery` drops the parameters a cross-field rule refuses (`from` after
       `to`) rather than crashing the page.
  3. **Other page choices:**
     - `formatUsd` (narrow symbol, up to four decimals under a dollar) for both spend tiles.
     - The durations line skips days with no finished job rather than drawing 0.
     - The code filter's options are the period's codes plus the one in the address.
     - The IA bar chart shows the top 10 models plus "Los demás (n)".
  4. **Registro's first column is the start time, not the status.** `DataTable` names each
     row by its first column, and "Fallida" / "Terminada" named 25 rows two ways. This is
     the review's P2, fixed by the lead.
  5. **Review fixes by the lead:**
     - The empty "no match" cell wraps: phase 6's one-line rule had clipped it at 320 px,
       with the clear link off screen. `.card td[colspan]` is `white-space: normal`.
     - The catalogue's allergen names are Spanish only (`labelEs`). They are marked
       `lang="es"` in cells and filter options (`AdminFilterOption.lang`), for WCAG
       3.1.2.
     - `DataTable`'s region is `position: relative`, so the visually hidden sort hints
       stay inside it.
     - `StatTile`'s figure is `min(font-size-08, 14cqi)`, so it fits its tile at 200 %.
     - `AdminSection`'s grid is `minmax(0, 1fr)` and a long title breaks.
     - `DonutChart` is `min(9rem, 100%)`, square.
     - The builder's own P1 fix, the nested calls table escaping `DataTable`'s sticky
       column, was confirmed in the code.
- **Decisions**: none new.
- **Notes for the next phase** (9):
  - **Already done here:** the phase 9 dictionary removals. `?legacy=1` and
    `/admin/overview` have no web reader any more.
  - **Still for phase 9:** the API removals (`limits`, `resetsAt`, `lastRefusal`,
    `refused`, `AI_REQUESTS_PER_DAY`, `AI_TOKENS_PER_MINUTE`, `/admin/failures`,
    `overview.jobs`, `?legacy=1`) and `apps/web/AGENTS.md`, which still describes a single
    `/admin` route.
  - **Open P3s:**
    - Resumen has 9 tiles (4 + 4 + 1 at 1280).
    - Registro rows grow tall with a disclosure open.
    - The donut's "released" slice is on categorical slot 4 (2.11:1 in light, relieved by
      the legend and the table).
    - The calls disclosure's name ("n llamadas") does not name its row.
    - VoiceOver may read "—" oddly.
  - **The allergen names** need a real English label (a dictionary map by key) to drop
    `lang="es"`.
  - **The probe** could gain `--font-scale` and an option to open disclosures, so these
    checks stop needing a custom script.
  - **Stale error text:** already checked on 2026-09-29. No production or dev row holds a
    provider's echo of the request, so Registro's detail column is safe.

## Phase 9 — Removals, documentation and the owner's check (2026-09-29)

- **Executor**: the `backend` agent (medium effort) on sonnet for the API and core
  removals, and the `tests` agent (medium effort) on sonnet for the end-to-end updates.
  Both worked in their own worktrees, which were brought into the main checkout and
  removed. The lead (opus, this session) wrote the docs and made the review and owner
  fixes. Reviews: `invariant-reviewer` on the final diff, and a final `accessibility` pass
  over the whole console, both on opus.
- **Result**: removals and docs are done. **Waiting for the owner's check (human-verify):**
  a walk through the console on the iPhone and on desktop. The phase stays in progress, and
  PRD and PLAN stay "approved", until the owner confirms.
- **Evidence**:
  - `rg -n "AI_REQUESTS_PER_DAY|AI_TOKENS_PER_MINUTE|resetsAt|lastRefusal|admin/failures|nextPacificMidnight" apps packages`
    finds only `apps/api/test`'s deliberate "is gone" assertions and the `AGENTS.md` prose
    that explains the removal.
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web --filter=ui`:
    17/17 tasks; core 1124 tests, api 972, web 125, ui 487. `deadcode` is green.
  - End-to-end, local, `VAPID_*` blank: `admin` 54/54 and `access` 8/8.
    - `admin.e2e-spec.ts:1924` ("never name who made a dish") failed once and passed on
      the rerun. It is intermittent on the shared dev DB, not a phase 9 regression, since
      this diff touches no recipe storage. Watch it.
    - CI's full run on the pull request is the proof.
  - `invariant-reviewer`: **sound, no P0 or P1.**
    - The redactions (`allergen`/`unwanted`, an invalid plan's figures) hold on the one
      generations path left.
    - Every admin class is `@Roles('admin')` with 404 before validation.
    - No response gained a field, and the env variables have no reader left.
    - PRD criterion 9 was re-checked across phases 3–9 and holds.
    - Its P2 and P3s are fixed: `scripts/smoke.mjs` now checks `/admin/summary` (the
      removed `/admin/overview` would 404 whatever the guard did); wording in
      `apps/api/AGENTS.md`, `AdminRepository`, `Admin.controller` and `AdminController`;
      `docs/reference/ai-gateway.md`; `0035`'s status line.
  - `accessibility`, final pass: 12 pages × 320/390/1280 × light/dark (72 loads), all 200.
    - 0 px sideways scroll, also at 200 % text at 320.
    - Table header baselines level (0 px spread).
    - Contrast ≥ 4.90 everywhere.
    - An ordinary account gets "Página no encontrada" on every page and on `/admin/zzz`.
    - The phone menu **scrolls under a touch drag** to "Volver a NutrIA" (the owner's
      report).
    - One P1, fixed by the lead: the drawer never took focus on open (vaul's `autoFocus`
      defaults to false and cancels Radix's move). `Sidebar` now sets `autoFocus`, and a
      test proves it: it fails without the prop and passes with it. The lead's browser
      check afterwards: focus lands inside the dialog, and the touch scroll still works.
- **Deviations from plan**:
  1. **Step 2 (dictionary keys) was already done in phase 8.** Parity is enforced by the
     types.
  2. **More came out than the list named, because it became dead:**
     - `AdminController.aiUsage` and `summariseAiCalls`, `AiUsageView`, `AiRefusal`;
     - `byModel`, `AnalyticsRepository.aiCallsSince`;
     - `AdminRepository.counts`, `recentJobs` and `recentGenerations`;
     - the legacy `generations()` path and its DTOs.
     `AdminAiView` now carries exactly what IA y modelos reads: `callsPerDay`, `models`,
     `period`, `spendPerDay`, `tokensPerDay`, `totals`, `window`.
  3. **`?legacy=1` is now an unknown key and is dropped,** so it answers the paged shape.
     An end-to-end case proves it, and another proves `/admin/overview` and
     `/admin/failures` 404 for everyone.
  4. **The owner's phone menu could not scroll.** vaul sets `touch-action: none` on every
     drawer. `.sidebar[data-vaul-drawer]` is now `touch-action: pan-y;
     overscroll-behavior: contain`, measured with a CDP touch drag.
  5. **Files outside the listed scope:** the Scope line is amended.
- **Decisions**: none new. `0035` is marked with what `0068` removed from it.
- **For the owner**:
  - `AI_REQUESTS_PER_DAY` and `AI_TOKENS_PER_MINUTE` may be deleted from the API project
    on Vercel. Nothing reads them and a deployment that still sets them boots. That is the
    owner's action; no agent changes Vercel.
  - **The owner's call (accessibility P2):** under 36rem the first column scrolls with the
    rest (the owner asked for whole addresses on one line), so mid-table on a phone a row
    has no visible name. The alternative: pin the first column capped at about 45 % of the
    table, wrapping its text.
- **Notes**: every open P3 across the project is listed in phases 4–8.

## Closing (2026-09-29)

- **Closed by the owner** on 2026-09-29 ("Cierra el proyecto 007"), after phase 9 reached
  production (#154, `dcf10bc`). The human-verify step is recorded as the owner's closing
  word, not as an itemised walk-through. What the owner had seen on the iPhone during the
  project: the dark band under Safari's bar (fixed in #150 and #151), the sortable header
  alignment (#153), and the menu scroll (#154). Anything found later is a new change, not
  a reopening.
- **Shipped:** #144 (shell, Ajustes) · #145 (charts, StatTile, DataTable) · #146 (period
  API, migration 0046) · #147 (Resumen, Producto, Planes) · #148 (people tables API) ·
  #149 (Cuentas, Profesionales, Buzón) · #150 (ambient light behind Safari's bar) · #151
  (log, AI, catalogue and pictures API) · #152 (serving ceiling `0070`, migration 0047,
  the log names nobody's figures) · #153 (Registro, IA y modelos, Catálogo, Imágenes;
  text-AI spend; the transition page goes) · #154 (removals, docs, the phone menu).
- **Left open, all owner's choices or P3s** (listed in phases 4–9):
  - deleting `AI_REQUESTS_PER_DAY` and `AI_TOKENS_PER_MINUTE` on Vercel;
  - pinning the first table column on a phone (addresses on one line vs a visible row
    name);
  - a real English name for the allergens;
  - the two billing test accounts on the dev database;
  - the intermittent `admin.e2e-spec.ts:1924` case.
- **What follows:** project 008, where the console watches quality and spend. The owner
  approved all nine items on 2026-09-29, plus the architect's additions.

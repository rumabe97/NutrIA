# Plan — Project 020: The shopping list you are shopping now

> **Purpose**: the phased technical execution plan — the engineering half of the contract.
> `/execute-project` follows this literally; executors implement phases, they do not
> redesign them. If implementation must diverge, the plan is amended in the same change and
> the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: the
> lead via `/plan-project`; the PRD was approved by the owner on 2026-10-09.

- **Status**: approved — queued behind the projects still open on 2026-10-09 (the owner:
  "primero acabamos todos los proyectos que tenemos pendientes")
- **Type**: standard
- **PRD**: ./PRD.md
- **Routing profile**: tiered

## Design summary

Decision [`0091`](../../decisions/0091-the-shopping-list-is-read-by-range-and-bought-by-amount.md)
is the shape. In one paragraph: the list keeps one row per ingredient per plan, the read
endpoint sends each row's grams **per day**, a range's quantity is computed from those
numbers by one domain function (sum the days, *then* convert to dry and round up to the 5 g
step, then to the display unit), and what is bought is an amount in grams on the row rather
than a boolean. The reader filters without a round trip, which is what keeps `/compra`
working in a supermarket with no signal ([`0053`](../../decisions/0053-the-shopping-list-survives-the-supermarket.md)).

Why this shape and not the two obvious alternatives — a row per ingredient per day, or
re-aggregating on the server per request — is argued in `0091`. The one rule worth repeating
here because every phase can break it: **the dry-weight round-up of
[`0078`](../../decisions/0078-a-plate-has-a-gram-ceiling-and-cooked-grains-read-dry.md) is
applied after the range is summed, never per day.** Rounding fourteen days up to 5 g each
and adding them over-buys by up to 70 g an ingredient, and would make an unfiltered list
differ from today's.

Phases are ordered so that the workspace ships green at every boundary and the user-visible
change arrives last:

1. the domain learns the days and gains the range function — nothing else changes;
2. the column, the migration and the endpoints — the old web build still works;
3. the filter on the web, reading only — marks still send booleans;
4. the marks become amounts, and the offline queue with them;
5. the end-to-end case, the docs and the close.

## Phases

### Phase 1 — The domain knows which day each gram is for

- [x] done — commit `5faead3f` ("A shopping list row knows which day each gram is for")
- **Dispatch**: opus @ medium — `/execute-project 020 phase 1`
- **Goal**: `packages/core` can say what a chosen set of days needs of each ingredient, by
  the same rules the whole-plan list already follows.
- **Scope**: `packages/core/src/domain/ShoppingList/` only. No schema, no API, no web.
- **Steps**:
  1. Give `ShoppingSource`'s days a date (and keep `dayIndex` if the callers have it), and
     make `buildShoppingList` return, per row, the grams each day contributes — a
     `perDay` map keyed by the day's date — alongside today's totals. The existing return
     shape stays, so every current caller compiles unchanged.
  2. Add `rangeQuantity(row, days)`: sum the chosen days' grams, then apply the
     cooked-to-dry conversion and the `DRY_STEP_G` round-up, then the countable/ml/gram
     display conversion — in that order, reusing the existing helpers rather than copying
     them.
  3. Add `rangeList(list, days)`: the rows a range shows, in the existing aisle order, with
     rows whose range quantity is zero dropped.
  4. Keep both pure and free of dates' timezones: a day is the plan's own `date` string, not
     a `Date` in the reader's zone.
- **Acceptance criteria**: PRD 2. `rangeQuantity` over **all** the plan's days equals the
  stored total for every row of every fixture, including the cooked-grain and countable
  rows. The owner's case (PRD 4) is a unit test on the numbers alone: 500 g for week 1 and
  1.2 kg for the fortnight from the same fixture.
- **Verification**: `pnpm --filter core test`, `pnpm --filter core ts:check`,
  `pnpm --filter core lint`.

### Phase 2 — An amount bought, and the days on the wire

- [x] done — commit `4df600d4` ("A shopping row is bought by amount, and each day's share is on the wire")
- **Dispatch**: opus @ medium — `/execute-project 020 phase 2`. Reviews: `migration-reviewer`
  (opus @ high, the floor for any migration), `invariant-reviewer`.
- **Goal**: the API stores an amount, serves the per-day breakdown, and the build that is
  live during the deploy keeps working.
- **Scope**: `packages/database/src/schemas/shopping.schema.ts` and a new migration;
  `packages/core/src/{entities,repositories,controllers}/Plan/`;
  `apps/api/src/modules/shopping-lists/` and the shopping route of
  `apps/api/src/modules/meal-plans/`; and **the three places that build a list** —
  `meal-plans/services/{PlanGeneration,MealSwap}.service.ts` and
  `events/services/PlanLoadRebuild.service.ts` — which must give their days dates and carry
  the new fields through, or a swap and an event rebuild write a list no range can filter.
- **Steps**:
  1. Migration: add `boughtGrams numeric(9,2) NOT NULL DEFAULT 0` to
     `shopping_list_items`, and backfill `boughtGrams = totalGrams` where `checked`. Keep
     `checked`. Additive only, no lock beyond the add, reversible by dropping the column.
  2. Store the per-day breakdown the list is built from, so a read does not re-walk the
     plan: a `perDay jsonb` column on the row, written by the same code that writes
     `totalGrams`. Justify the shape in the LOG if a table is chosen instead. Every writer
     must give its days their own dates — `MealCompositionView` already carries `date`,
     generation maps `dayIndex` → `date` — or phase 1 files the day under a placeholder key
     no range can choose, and the fortnight reads short.
  3. `replaceGeneratedItems` carries `boughtGrams` across a rebuild where it carries
     `checked` today, keyed on `ingredientId`, capped at the new `totalGrams`.
  4. Write path: the entity's write schema accepts `{ boughtGrams }` **or** `{ checked }`.
     Writing one derives the other, by `0091`: `checked = boughtGrams >= totalGrams`;
     `checked: true` sets `boughtGrams = totalGrams`, `false` sets it to 0. Cap at
     `totalGrams`, floor at 0, server-side, whatever the client sends.
  5. Read path: `ShoppingListView`'s rows gain `boughtGrams`, `perDay`, `dryRounded` and
     `gramsPerUnit`. The last two are what `rangeQuantity` cannot recover from a stored row
     — see phase 1's LOG entry — and may be folded into the `perDay` payload instead. The
     DTO casts the numerics as the existing fields do.
  6. Ownership is untouched: the write still joins item → list → plan filtered by
     `userId` and `visible()`.
- **Acceptance criteria**: PRD 3, 7, 10. A spec proves a `checked` write from an old client
  still works and leaves a coherent `boughtGrams`. A spec proves the cap and the floor. A
  spec proves a rebuild keeps the amount and caps it.
- **Verification**: `pnpm --filter database ts:check`, `pnpm db:check`,
  `pnpm --filter api test`, `pnpm --filter core test`, `pnpm gate --full` once at the end.

### Phase 3 — Pick your days

- [x] done
- **Dispatch**: opus @ medium — `/execute-project 020 phase 3`. Reviews: `accessibility`.
  Use the `apple-web-design` skill, as every UI change does.
- **Goal**: the reader chooses the fortnight, a week or any days, and the list, the
  quantities and the progress follow — with no network and no write-path change.
- **Scope**: `apps/web/src/app/(app)/compra/`, `apps/web/src/components/Shopping*`,
  `apps/web/src/lib/{format,shoppingShare,offline}.ts`, both i18n dictionaries, and a new
  `apps/web/src/lib/shoppingRange.ts` — the range's own pure logic and its per-device
  memory, which belongs beside `pendingTicks.ts` rather than inside any of the three files
  the scope first named.
- **Steps**:
  1. A client component holds the range: `fortnight | week1 | week2 | days`, and for `days`
     the set of chosen plan dates. It reads the rows and their `perDay` from the server
     render, so a filter change touches no network.
  2. The control: a segmented control for the three presets and, for chosen days, one
     checkbox per plan day labelled by weekday and date. It collapses to the preset row at
     320 px. Follow `apple-web-design` tokens; 44 px targets.
  3. Quantities come from phase 1's `rangeQuantity`, imported from core, so the client and
     the server cannot disagree. `ShoppingList`, `ShoppingProgress`, `ShoppingActions` and
     `shoppingListText` all take the range.
  4. The empty states separate: "nothing left in these days" from "nothing in the list".
  5. Remember the range per device in `localStorage`, and clear it with the other
     per-device state on a session change, beside `forgetPendingTicks`.
  6. `subtitle` stops hardcoding "los catorce días" / "the fortnight" and says what the
     range covers. Delete the stale, unreferenced `shopping.notice` key while there.
  7. `/compra/proxima` gets the same control through the same component.
  8. Offline: `/compra` is already in both allow-lists (`lib/offline.ts` and `public/sw.js`),
     and the filter must stay on that same path — no query string, no new segment — so the
     cached copy keeps working. Say so in the LOG.
- **Acceptance criteria**: PRD 1, 2, 5, 8, 9. The unfiltered list is identical to today's,
  row for row. The accessibility review passes.
- **Verification**: `pnpm --filter web test`, `pnpm --filter web ts:check`,
  `pnpm --filter web lint`, `pnpm gate --full`, and `/local-probe` on `/compra` at 320, 390
  and 1280 px, light and dark.

### Phase 4 — A mark is an amount, in the aisle with no signal

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 020 phase 4`. Reviews: `invariant-reviewer`
  (the offline write path), `accessibility` (the partly-bought row's announcement).
- **Goal**: marking and unmarking move an amount, offline included, and a half-bought row
  says what is left.
- **Scope**: `apps/web/src/components/ShoppingItem/`, `apps/web/src/lib/pendingTicks.ts`,
  the dictionaries, and `docs/decisions/0055-*.md` (amendment).
- **Steps**:
  1. Marking sends `max(bought, needed(range))`; unmarking sends
     `max(0, bought - needed(range))`. The row's three states are untouched, partly bought
     (showing `needed(range) - bought`) and done.
     **It sends `{ boughtGrams, checked }` — both — for one release.** While this build
     deploys, its writes reach the API still live, whose body schema predates phase 2 and
     answers `{ boughtGrams }` alone with a 400; by `0055` a 4xx drops the entry from the
     offline queue, so the mark would vanish with no trace. `boughtAsk` already prefers the
     amount when both arrive, so sending both is correct against either API. Found by
     `migration-reviewer` on phase 2.
  2. The queue holds an amount per row. Move the key to `nutria-pending-ticks-v2`, read the
     v1 key once so a tick made offline before the deploy is not lost, then drop it.
  3. `0055`'s rules are unchanged and must be re-proved by spec: the newest entry for a row
     wins, a 4xx drops it, a 5xx keeps it, the flush stops at the first kept entry, a
     session change clears the queue.
  4. The screen reader hears the amount left, not only "checked" — the row's accessible name
     carries it. **Confirmed as a live defect by `accessibility` on phase 3**
     (`ShoppingItem.tsx:57-61`): the quantity `<span>` sits outside the `<label>`, so the
     checkbox is named "Aguacate" and nothing more — and since phase 3 the quantity it
     omits changes with the range, so the same row announces the same name for a week's
     amount and a fortnight's. Left to this phase on purpose: it is the phase that makes
     the amount the thing being announced.
  5. Amend `0055` in the same change: one line in its text and an `Amended 2026-…` note,
     pointing at `0091`.
- **Acceptance criteria**: PRD 3, 4, 6. A spec reproduces the owner's case through the
  component's own arithmetic, and another proves the v1 → v2 migration of the queue.
- **Verification**: `pnpm --filter web test`, `pnpm gate --full`, and `/local-probe` with
  the network throttled to offline on `/compra`.

### Phase 5 — The case through HTTP, and the close

- [ ] pending
- **Dispatch**: sonnet @ high — `/execute-project 020 phase 5`. The end-to-end suite belongs
  to the `tests` agent, which is the only one that runs `apps/api/test`.
- **Goal**: the owner's case is proved end to end, and the project closes.
- **Scope**: `apps/api/test/shopping-range.e2e-spec.ts` (new) and its README row;
  `docs/projects/020-*/LOG.md`; `docs/ROADMAP.md`; `docs/PRODUCT.md`;
  `docs/ARCHITECTURE.md` where it describes the list.
- **Steps**:
  1. The suite, on the local Postgres (`pnpm db:local`, `NUTRIA_LOCAL_PG=1`), never Neon:
     generate a plan, read the list, mark a row with a week's amount, read again and assert
     the fortnight's remainder; unmark it in the week and assert the fortnight's figure;
     mark it in the fortnight and assert the week reads done; then swap a meal and assert
     the amount survived, capped at the new need.
  2. One case for the old client: a `{ checked: true }` write still works.
  3. One case for another account's item: 404.
  3b. **The four cases phase 2 could not cover, found by `invariant-reviewer`**: today's
     suites only ever send a tick (`fortnight.e2e-spec.ts`, `care-review.e2e-spec.ts`), so
     an **amount** has no HTTP coverage at all. (a) An amount from a stranger → 404 **and
     the row unchanged**. (b) An amount against a plan under review → 404 with
     `boughtGrams` untouched (`0060`) — `care-review.e2e-spec.ts`'s helper should send an
     amount beside the tick. (c) The cap: `{ boughtGrams: 999999 }` on a 1,200 g row stores
     1,200. (d) The derived `checked` over HTTP: an amount equal to the need reads back
     `checked: true`, zero reads back `false` — the boolean the live build depends on
     mid-deploy. (e) The rounding the same reviewer found: `{ boughtGrams: 99.999 }` on a
     100 g row reads back `boughtGrams: 100` **and** `checked: true`, never the one state
     `0091` forbids. Until these land, the bound is proved only by a hand-run rehearsal
     against the local Postgres, recorded in phase 2's LOG entry.
  4. Update `ROADMAP.md` § Next item 2, `PRODUCT.md` and `ARCHITECTURE.md` to describe the
     list as it now is.
  5. Close: PRD and PLAN status to done, the LOG's closing entry with each criterion and any
     accepted waiver, and the workspace LOG line.
- **Acceptance criteria**: PRD 4, 6, 7, 10 proved over HTTP. Every PRD criterion is answered
  in the closing entry.
- **Verification**: `pnpm --filter api test:e2e -- shopping-range`, then the brake and swap
  suites it sits beside, then `pnpm gate --full`.

## Hand-off

Standing constraints for every executor of this project:

- **One heavy job at a time.** The owner's machine has 15 GB and has died repeatedly with
  two gates running at once. Run `gate --full` once, at the end of a phase.
- **Tests run on the local Postgres** (`pnpm db:local`, `NUTRIA_LOCAL_PG=1`), never on Neon,
  never against production. Production data changes only through a reviewed migration.
- **The repo is public.** No personal data, no absolute home paths; run `pnpm check:leaks`.
- **No `git stash`** — use a worktree or a WIP commit. Never `--no-verify`.
- The dry round-up after the range sum, never per day (see the design summary).
- A filter never becomes a URL on `/compra`: the offline cache is keyed by path
  (`0053`).

## Out of scope

- Typing a bought amount by hand — the column will exist after phase 2, so it is a small
  follow-up project if the owner wants it.
- A price per ingredient, which `ROADMAP.md` § Next item 1 already parks ("Cheaper waits for
  a price per ingredient").
- Offline caching of `/compra/proxima`, deliberately left out by `0053`.
- A shopping list spanning two plans.

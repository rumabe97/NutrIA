# LOG — Project 020: The shopping list you are shopping now

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

## Phase 1 — The domain knows which day each gram is for (2026-10-09)

- **Executor**: opus @ medium, run directly — the phase's **Dispatch** line is this
  session's own model and effort, so no agent was spawned and no worktree was used.
- **Result**: done.
- **Evidence**:
  - `pnpm --filter core test` — 134 files, 3,911 tests, all passing.
    `src/domain/ShoppingList/ShoppingList.test.ts` alone: 37 tests (20 before), all passing.
  - `pnpm --filter core ts:check`, `pnpm --filter core lint` — clean.
  - `pnpm --filter api ts:check` — clean, which is the plan's "every current caller compiles
    unchanged": `PlanGeneration`, `MealSwap` and `PlanLoadRebuild` were not touched.
  - Coverage of the changed file: statements 98.36%, branches 97.77%, **functions 100%** —
    above the `src/domain/**` floor (90/100/95/95). The one uncovered line is the
    pre-existing `continue` for a slug the catalogue cannot resolve, uncovered before this
    change too.
  - `sh .claude/skills/ship/scripts/gate.sh --full` — migrations, checks, web-build and
    static ok; `format` failed on the new file, fixed with `prettier --write` (a chained
    call collapsed onto one line, whitespace only), then `pnpm format`, `pnpm deadcode` and
    `pnpm check:leaks` re-run green, and core's lint and suite re-run green after it. Run
    once, nothing else running (the machine dies with two gates at once).
  - PRD 2, on the numbers: `rangeQuantity(row, every day of the row)` equals the row's
    stored `displayQuantity`, `displayUnit` and `totalGrams` for every row of two fixtures
    covering all the kinds — grams, countable, slice, ml, over a kilogram, a merged
    cooked+dry grain, and a cooked pasta with no dry counterpart.
  - PRD 4, on the numbers: a 14-day fixture with 100 g on days 1–5 and 8–14 reads 500 g for
    week 1, 700 g for week 2 and 1,200 g for the fortnight, from the one stored row.
  - The round-up is after the sum, proved by a case where it matters: 50 g of cooked pasta a
    day for three days is 70 g dry, not the 75 g that rounding each day to 25 g first would
    buy.
- **Deviations from plan**: three, all recorded here, with the plan amended in this same
  change where a later phase is affected.
  1. **A built row carries two fields the plan did not name: `dryRounded` and
     `gramsPerUnit`.** Neither can be recovered from the rest of the row, and
     `rangeQuantity` needs both. A plan with cooked *and* dry couscous merges into one row
     named and slugged after the **dry** food, so nothing left in that row says its weight
     came off a cooked grain and must be rounded up to 5 g — and inferring it from the slug
     would start rounding a row of plain dry couscous that today is bought to the gram.
     `gramsPerUnit` is the same problem for countables: 3 eggs for 150 g does not say that
     an egg is 58 g, so the range's own `ceil(grams / 58)` is uncomputable without it.
     Phase 2's step 5 is amended to persist and serve both.
  2. **`rangeQuantity` defines two edges the plan left open**, because the server and the
     screen both call it and must not disagree: **no day chosen is nothing to buy**, for
     every row; and **a row with no breakdown shows its stored quantity under every range**.
     The second is what keeps a hand-added row (it belongs to no day — PRD 7) and a row
     stored before the migration visible to somebody walking a supermarket. The opposite
     default would empty the list for every existing plan until it was regenerated.
  3. **A source day's `date` is optional**, and a day without one is filed under a
     `day-<n>` placeholder. Phase 1's scope is `packages/core/src/domain/ShoppingList/`
     alone and every current caller must compile unchanged, so the three callers cannot be
     given dates until phase 2. An undated day is still counted into the row's total — the
     list is never short — and no range can select it. Phase 2's step 2 is amended to say
     that every writer must supply real dates.

  One implementation note that is not a deviation but matters: **`totalGrams` is now the
  breakdown summed by the very function a range uses.** `buildShoppingList` no longer keeps
  a separate running total. Floating-point addition is not associative, so a total summed
  item-by-item and a range summed day-by-day could have differed in their last bits and, on
  an unlucky value, by a whole 5 g step after the round-up. Summing once, in one order,
  makes PRD 2's identity true by construction rather than by luck.
- **Decisions**: none created.
  [`0091`](../../decisions/0091-the-shopping-list-is-read-by-range-and-bought-by-amount.md)
  is the record this phase implements; [`0078`](../../decisions/0078-a-plate-has-a-gram-ceiling-and-cooked-grains-read-dry.md)
  and [`0053`](../../decisions/0053-the-shopping-list-survives-the-supermarket.md) are
  unchanged.
- **Notes for the next phase**:
  - **What phase 2 must persist and serve**, beyond `boughtGrams`: `perDay` (date →
    unrounded grams, already dry where `0078` applies), `dryRounded` and `gramsPerUnit`. The
    last two may live inside the `perDay` jsonb payload rather than as their own columns —
    phase 2's "justify the shape" clause covers either.
  - **Every writer must give its days their dates.** `MealCompositionView` already carries
    `date`, so `groupByDay` in `MealSwap.service.ts` and `PlanLoadRebuild.service.ts` can
    pass it straight through. `PlanAssignment`'s `PlanDayAssignment` has only `dayIndex`, so
    `PlanGeneration.service.ts` must map `dayIndex` → `date` from the plan's start date.
    Without that, the breakdown is placeholder-keyed and the fortnight reads short.
  - **Rows stored before the migration ride the empty-breakdown fallback** and read as the
    whole plan's need under every range. Nothing has to be backfilled for the screen to be
    correct, only for it to be filterable.
  - **Phase 3's fortnight preset can read the row's stored `displayQuantity` and
    `totalGrams` directly**, which is exactly equal to today's list by construction — the
    cheapest way to satisfy PRD 2's "an unfiltered list equals today's list".
  - **`rangeList` keeps the order it is given and must not re-sort.** A freshly built list
    is in `CATEGORY_ORDER`; a stored list comes back ordered by the database's
    `ingredient_category` enum, whose order differs (`pantry` and `bakery` are swapped).
    That mismatch predates this project and is left alone; re-sorting inside `rangeList`
    would silently change one of the two screens.
  - The exported surface phases 2–4 build on, all from `core/domain/ShoppingList`:
    `rangeQuantity(row, days)`, `rangeList({ items }, days)`, and the types
    `ShoppingRangeRow`, `RangeQuantity`, `RangeRow`, `ShoppingPerDay`, `ShoppingRow`,
    `ShoppingList`, `ShoppingSourceDay`.

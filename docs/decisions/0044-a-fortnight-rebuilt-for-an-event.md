# 0044 — A fortnight rebuilt for an event

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

[`0043`](./0043-a-day-that-eats-for-something.md) shipped events applied at the
next generation and deliberately left out *rescheduling a live plan in place* —
"the feature's best property and its riskiest part". The owner has now asked
for it, for the paid tier, together with a cap on how many events a fortnight
may hold at all. Two things had to be true for both to be cheap: every tier
number already lives in one place (`core/domain/Allowance`, per
[`0042`](./0042-what-a-paid-account-may-spend.md)), and scheduling over a pool
is deterministic and free — the model call is the pool, never the schedule.

## Decision

### Events are counted per fortnight, and the number is a tier's

Free: **three** a plan. Premium: **ten** — generous on purpose, because the
overlap rule already bounds how many one-to-three-day loads fit in fourteen
days. "Per plan" means *events whose loaded days fall inside the plan's window*:
the active plan's own dates, or with no plan the fourteen days from today, which
is what the next generation will lay out. Counted by loaded days rather than by
the event's date, because the load is what touches the plan.

An event beyond the current fortnight is held to the fortnight it will land in,
found by tiling fourteen-day windows forward from the current one. Without that
the cap would only bind people who declare things late.

Exceeding it is `429 QUOTA_EXCEEDED` with `kind: event` — an allowance spent,
the same answer a fifth swap gets. Not a 409: nothing conflicts. Not a 422: the
input is fine.

### Premium may add an event mid-plan, and the loaded days are rebuilt

A second allowance, `midPlanEventsPerPlan`: free **0**, premium **3**. A free
account's event is read at the next generation, exactly as `0043` shipped it;
nothing about that path changed. A premium account's event, when its load
touches the active plan, has those days rebuilt on the spot.

The rebuild is `PlanLoadRebuildService` in the API's events module, and these
are its rules, each of which is a line of code rather than an intention:

- **No model call, by construction.** The pool is
  `RecipeController.reusablePool(slots, context)` — the whole safe library, the
  shape generation already falls back to when the provider is gone — and the
  service imports nothing from the AI module. A day the library cannot fill is
  a day not rebuilt, never a day the model is asked for. Gemini's free tier is
  this product's binding constraint; a rebuild that spent a generation would be
  a bug.
- **Only days strictly after today.** A loaded day that is today may already
  have meals marked eaten, and the past is read-only (`0021`). If that leaves
  part of the load unapplied, what can be applied is, and the response says
  which dates (`rebuiltDates`).
- **The allergy gate runs again** over the rebuilt days, before writing,
  exactly as `assertPlanIsSafe` runs it over an assembled plan. The library was
  filtered on the way in; a rebuilt day is new food.
- **Variety holds across the seam.** The scheduler is handed every placement
  of the days it must not touch, and `canPlace` judges the new picks against
  them. `schedulePlan` gained `dayIndexes` and `placed` for this; with neither
  it produces exactly the fortnight it always did.
- **The shopping list is rebuilt** from the whole plan, the way a swap does it
  (`0015`), because quantities add across meals. Ticks survive; hand-added
  items are never touched.
- **Atomic.** Days, meals, list and the counter commit in one transaction or
  not at all — `PlanRepository.rebuildLoadedDays`.
- **Stored like generation stores it**: `loadedFor` and `targets` on the
  rebuilt `plan_days`, so the plan explains itself once the event is gone.

The load moves what *this plan* eats — its `strategy` — not the profile's
current targets, which may have moved since; a loaded Saturday built to
different base numbers from its Friday would not be a load, it would be a
different plan. The bounds are the profile's, as in `0043`.

### The counter is a column on the plan

`meal_plans.mid_plan_loads`, incremented inside the rebuild's transaction by a
guarded `UPDATE … WHERE mid_plan_loads < limit`. Under READ COMMITTED the second
of two racing transactions re-evaluates that predicate against the row the
first one wrote, so they cannot both spend the last one. Its own counter: it
touches neither the swap allowance nor the redo allowance.

Meal rows are **updated in place**, never deleted and re-inserted. Not style:
`meal_swaps.meal_id` cascades on delete, so throwing a meal away would throw
away the record that a swap happened and quietly refund it.

### Removing the event afterwards leaves the rebuilt days as they are

`DELETE /events/:id` does not un-rebuild. The previous meals are gone — the
rows were updated in place, and the shopping list has been rebuilt over them,
possibly already bought against. Restoring them would be a second rebuild
that could only put *something* there, not what was there, and it would have
to decide whether to charge for it. The plan day keeps saying what it ate for
(`loadedFor`), which is the rule `0043` set for a deleted event anyway: the
event may go; the plan is history. Somebody who wants those days ordinary
again spends a redo, the honest price for a change of mind.

### Every "no" is the same "no"

The event is written first and stands whatever the rebuild decides. A free
tier, a load outside the active plan, a load whose days are all today or
earlier, a load the bounds refuse, a library too thin, a plan whose meal shape
no longer matches the profile's, a paused plan — each answers an empty
`rebuiltDates`, logs why, spends nothing, and the event applies at the next
generation. That is the state everybody was in before this existed, and it is
always true. Faults (a database error, an unresolved ingredient) go up as
faults.

## Alternatives considered

- **Deriving the counter from `plan_days.loaded_for`.** Avoids a column, but a
  day loaded at generation and a day loaded mid-plan look identical there, and
  counting both charges somebody for an event they declared before they had a
  plan. Comparing against the event's `created_at` fixes that until the event
  is deleted — at which point the count drops and the allowance is refunded by
  deleting a row.
- **A record table, like `meal_swaps`.** More auditable, more than was asked;
  the counter is enough until somebody needs to know *which* event spent what.
- **Delete-and-insert the meals.** Simpler SQL, and it cascades into
  `meal_swaps`. See above.
- **Rebuilding today too.** Meals may be eaten; the past is read-only. Also
  the only day where "rebuild" and "what did I already eat" collide.
- **Asking the model when the library is thin.** The one thing this feature
  must never do.

## Consequences

`PlanController.allowances` now also answers `events`:
`{ limit, remaining, midPlan: { limit, remaining } | null }`, with `midPlan`
null on a tier that has none, so the screen shows the control or nothing. The
scheduler takes an optional subset of days and a set of placements to respect;
with neither it is unchanged — checked by a test that compares the two. One
column, one migration, one service that imports nothing from `ai/`.

Still deliberately later: the days *after* an event, recurring events, and any
rebuild that would touch a day already lived.

# 0036 — Which meals somebody eats, and how big each one is

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

Two requests arrived together: let somebody say they do not eat breakfast, and
let somebody say they eat lightly at one meal so the rest of the day carries it.
They are the same change, and the code says why.

`slotsFor(mealsPerDay, includesSnacks)` took the **first N** of breakfast, lunch
and dinner. So "two meals a day" always meant dropping dinner — a person who
skips breakfast had no way to describe themselves, and answering "2" gave them
the opposite of their own day. The product could count meals; it could not name
them.

And `slotBudgets` split the day by a single global `SLOT_WEIGHT` per slot, so
"my breakfast is small" had nowhere to live at all.

## Decision

**A profile stores a size for every slot: `off`, `light`, `normal` or `large`.**

- `user_preferences.meal_shape` replaces `meals_per_day` and `includes_snacks`.
  Six answers instead of a count and a checkbox.
- `slotsIn(shape)` is which meals they eat; `weightsFor(shape)` is each one's
  share, the base weight times a factor — zero, a half, one, one and a half.
- **The scheduler did not change.** `slotBudgets` already normalised over
  whatever weights it was handed; it now receives them instead of deriving them.
  A light breakfast hands its share to the meals that are left, which is exactly
  what somebody means by eating little in the morning.

## The question, and why it is four buttons

"How much of your day is breakfast" is a question about arithmetic, and nobody
can answer it honestly. "Do you eat breakfast, and is it small" is a question
about breakfast. Four buttons a row, no percentages on screen, and the weights
live underneath where the scheduler already knew how to divide by them.

Asking somebody to split a hundred points across five meals is a spreadsheet
wearing a form.

## Migration

The backfill reproduces the old derivation exactly — the three core meals in
order, then the extras, snacks first for those who wanted snacks and supper for
those who did not — so every existing profile keeps the day its old answer
implied and nobody is asked again.

Both old columns are **dropped in the same migration**. A column nothing reads is
a column that lies the first time somebody trusts it, and two ways to say how
many meals a day is exactly the disagreement this codebase keeps removing.

`drizzle-kit` refuses to generate a destructive migration without a terminal, so
this one is written by hand — which it had to be regardless: no generator can
invent a backfill.

## Consequences

- A day can now be one meal or six, in any combination. The scheduler's pool
  requirements are per slot, so fewer slots is strictly easier to fill.
- `shapeFor(mealsPerDay, includesSnacks)` survives as a test and fixture helper:
  "three meals, no snacks" is still how a test wants to describe a day, and
  keeping the derivation in one place means a test and a migrated row agree by
  construction.
- What is not built: a per-day shape. Somebody who skips breakfast on weekdays
  and not at weekends is describing a calendar, and that is a different feature
  with a different question.

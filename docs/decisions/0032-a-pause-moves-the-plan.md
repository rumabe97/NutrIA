# 0032 — A pause moves the plan, it does not skip it

**Status**: accepted · **Date**: 2026-09-09 · **Deciders**: owner, agent

## Context

People go away. A fortnight plan assumes fourteen consecutive days in one
kitchen, and a week in a hotel breaks that assumption in a way the product had
no answer for: every day of the trip showed meals nobody was going to cook, each
one aging into a skipped meal, the adherence figures filling with absences that
were not lapses, and the check-in mail arriving to ask how a fortnight went that
had not happened.

The roadmap called this "a temporary lifestyle override that does not destroy the
normal plan", which admits two readings. One generates a second, different plan
for the trip — no cooking, eating out — and restores the normal one afterwards.
The other pauses: the plan stops, waits, and resumes.

The owner chose the pause. The generated holiday plan costs a model call per
trip, on the same free-tier cap plan generation runs on, and it answers a
question ("what should I eat on holiday?") the product has no good data for.
Pausing answers the question people actually have, which is "please stop counting
this week against me".

## Decision

**A trip is a stretch of days, both ends included, and declaring one moves every
plan day at or after it forward by its length.**

- `vacations` holds `starts_on` and `ends_on` per user. The row is the record of
  the pause, not its mechanism.
- Creating one shifts, in a single transaction, every `plan_days.date` at or
  after the start, plus the plan's own `start_date` and `end_date`, for plans
  that are still `active`, `draft` or `generating`. A finished plan is history
  and history does not move (`0021`).
- The shift is `date + n` in Postgres, on `date` columns. No `Date` object is
  involved: a plan day is a day in somebody's life, not an instant, and a plan
  that slipped a day because a server ran in UTC would be a bug nobody could
  reproduce before eleven at night.

Everything else follows from there rather than being taught about holidays:

- Those dates simply have no plan day, so there is nothing to cook, nothing to
  mark, nothing to skip and nothing to count.
- The check-in mail fires on the day a plan reaches its last day (`0027`). That
  day moved, so the mail moves with it. No condition was added anywhere.
- The dashboard finds no day for today and says why, instead of showing an empty
  state that looks like a fault.

**Cancelling gives back only the days not yet spent.** A trip cancelled before it
starts is deleted and the plan pulled back in full. Cancelled from the beach on
the fourth morning, it is truncated to yesterday and four days come back — the
three already gone were days the plan genuinely did not happen, and pulling them
back would put plan days in the past.

**A trip declared before the plan exists is applied when the plan is created.**
Generation lays a fortnight out from today because that is what a fortnight is;
`PlanController.persist` then applies every trip in date order.

## Refusals

Three, and each is about something that cannot be undone rather than about
tidiness:

- **Starting in the past** — the shift only moves days that have not happened,
  and a day somebody already ate cannot make room for a holiday already taken.
- **Overlapping another trip** — two shifts for one absence would push the plan
  further than the person is away.
- **Longer than ninety days** — long enough for a sabbatical, short enough that a
  typo in a year does not move somebody's plan into the next decade.

## Consequences

- A paused plan's `end_date` moves, so the fortnight's allowances (`0015`) move
  with it. Somebody away for a week gets their swaps for the fortnight they
  actually live, which is the intended reading.
- The plan's dates are rewritten rather than derived. The alternative — keeping
  original dates and adding the pause at read time — would put a translation
  between the database and every query that asks what day it is, and the first
  one that forgot would be wrong in a way no test would catch.
- What is not built: a plan for the trip itself. If billing ever removes the
  quota problem, that is a separate feature and a separate decision — it does
  not change this one, because a person who wants no plan while away still wants
  their fortnight back when they return.

## Amendment — 2026-09-10 — a paused plan is read-only, and the API is what says so

Reported from a phone: while away, the plan screen still offered to mark a meal
eaten, swap a dish, and like or dislike a recipe. The pause moved the days; it
did not stop the buttons.

Marking a meal you are not eating records something that did not happen, and
adherence is built from those marks. A swap spends one of five allowances on a
fortnight nobody is living. Both are worse than a stale screen: they put wrong
data in a place the next plan reads from.

So a paused plan is read-only, and **the refusal lives in the controller**. The
screen hides the three controls and says when the plan picks up again, but that
is courtesy — a disabled button is a suggestion, and the request behind it is
one `curl` away. `setMealStatus`, `swapMeal` and `setVerdict` answer 409
`PLAN_PAUSED`, which is a state a screen explains rather than a denial it hides.

The verdict is included even though it is harmless on its own. It is the third
control on the same screen, and the rule a person can hold is "while I am away,
my plan does not change". One exception to that is a rule nobody remembers.

Reading is untouched. The plan is paused, not hidden.

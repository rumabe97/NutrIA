# 0015 — One redo a fortnight, five swaps a plan, library first

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

The owner asked for two allowances: regenerate the whole plan once every fifteen
days, and regenerate a single meal a few times — three or five — with a premium
tier raising both later.

Until now `POST /meal-plans/generate` had only a technical limit, three an hour
in memory: any user could regenerate a plan seventy-two times a day, each one a
model call against a free-tier quota that has already run dry once. And there
was no way at all to change one meal: a dish the person did not want was theirs
for the day, and "no me gusta" ([`0014`](./0014-a-verdict-shapes-the-next-plan.md))
only helped the *next* plan.

## Decision

**A fortnight's plan may be redone once. A plan's meals may be swapped five
times. Both are two numbers in `core/domain/Allowance`.**

- **Redo, not rate.** Generating the next fortnight is always allowed — that is
  the product. What is rationed is *redoing the fortnight in progress*. The count
  comes from the plan chain, not a calendar: `createPlanAtomically` stamps the
  plan it replaces with `completedAt`, and a predecessor completed before its own
  end date was cut short — a redo. `redosInFortnight` walks back from the active
  plan and stops at the first plan that ran its course. No extra column, no
  window arithmetic at the edges. The check lives in `PlanJobController.start`,
  the one place a generation begins.
- **Swap, library first.** `POST /meal-plans/meals/:id/swap` replaces one meal
  of the active plan with the dish that lands closest to that meal's own
  calories and protein — judged exactly as the scheduler judges, scaled and then
  by fit (`pickReplacement`). Candidates come from the library: safe for this
  person, not already in the plan, not among their dislikes, favourites first
  when they fit. The model is asked only when the library has nothing for the
  slot, and then for three dishes for that slot alone. A swap from the library
  costs nothing and returns at once; five a plan is cheap.
- **The plan stays whole.** The meal row is updated in place — one meal per
  slot per day is a database constraint — and the shopping list is rebuilt from
  the whole plan in the same transaction, keeping what was already ticked when
  the ingredient is still on it and never touching items added by hand. The
  variety rules hold after the swap as before it. `meal_swaps` records each one:
  it is what the allowance is counted from, inside the transaction, so two swaps
  racing for the last one cannot both land.
- **Said before the press.** `GET /meal-plans/allowances` tells the screen what
  is left; the plan shows "rehacer" or the date the next fortnight opens, the
  meal shows how many swaps remain. A spent allowance answers 429
  `QUOTA_EXCEEDED` with `retryAt` when it renews on a date.

## Consequences

- The free tier's model spend is bounded: at most two plan generations a
  fortnight plus the fresh third of each ([`0013`](./0013-a-third-of-every-plan-is-fresh.md)),
  and swaps only reach the model when the library is short for a slot — which
  gets rarer as the library grows.
- A premium tier is a change to two constants and whatever reads them; nothing
  in the routes knows the numbers.
- A swap on a meal already eaten is refused by the screen (only `planned` meals
  offer it); the API refuses swaps on any plan but the active one.
- "Nothing fits right now" is a 409 the screen turns into a sentence, not a
  failure — it means the library has no dish for that slot and the model
  returned nothing usable, both of which are rare and both of which pass.

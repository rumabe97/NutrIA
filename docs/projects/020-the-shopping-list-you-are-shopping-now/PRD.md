# PRD — Project 020: The shopping list you are shopping now

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: the lead via
> `/plan-project`, from the owner's request of 2026-10-09.

- **Status**: approved — the owner approved it on 2026-10-09; execution is queued behind the projects still open that day
- **Roadmap item**: [`ROADMAP.md` § Next, item 2 — "A user can shop from it"](../../ROADMAP.md)

## Problem

The list is always the whole fortnight. One screen, every ingredient of fourteen days,
quantities for two weeks: 1.2 kg of chicken, 2 kg of potatoes. Nobody shops that way.
People buy for a week, or for the next three days, and the list cannot say what those days
need.

Worse, the list cannot hold a partial shop. "Bought" is one boolean per ingredient
(`packages/database/src/schemas/shopping.schema.ts`, `checked`), fixed in that shape at
every layer — the schema, the write entity, the DTO, the checkbox, and the offline queue of
decision [`0055`](../../decisions/0055-a-tick-in-the-aisle-waits-for-the-signal.md). So
there is no way to record "I bought this week's 500 g of the fortnight's 1.2 kg": the
ingredient is either done or not.

The quantities themselves have no dates to filter by. `buildShoppingList`
(`packages/core/src/domain/ShoppingList/ShoppingList.ts`) sums day → meal → ingredient into
a flat total before anything is stored, and no stored row references a day or a meal. The
dates exist, on `plan_days`, but the list never sees them.

The owner, 2026-10-09: "Que el usuario pueda elegir si quiere ver la de 2 semanas, o solo 1
semana, o la de determinados días. Y decidir qué comprar. […] si filtro por una semana, y
marco que ya he comprado algún producto, si luego filtro por dos semanas, me tiene que
marcar que quedan X cantidad de comprar."

## Outcome

- You choose what the list covers: the fortnight, either week, or any set of its days. The
  rows and the quantities are those of the days you chose.
- What you have bought is kept as an **amount**, so one shop reads correctly under every
  filter. Buy the week's 500 g, switch to the fortnight, and the row says 700 g left.
- A row half bought says so, with what is left, rather than hiding it or showing it as
  untouched.
- All of it — the filter, the quantities and the marks — works in the supermarket with no
  signal, and the marks reach the server when it comes back.
- The list is still a projection of the plan: a swap, an event rebuild or a regeneration
  keeps what you had bought.

## Scope

**In:**

- A range control on `/compra`: the fortnight, week 1, week 2, or chosen days (one box per
  day of the plan).
- Quantities, aisles and progress recomputed for the chosen range.
- Bought as an amount per ingredient. Marking a row buys the range's amount; unmarking
  subtracts it.
- The partly-bought row: what is left, in the same unit the row already uses.
- The share text and the "nothing left" state follow the range.
- The filter you left is the one you find, on that device.
- The same control on `/compra/proxima` for a scheduled plan, with that screen's existing
  behaviour otherwise (it is not available offline today and that does not change).
- Offline: the page carries the whole plan's per-day breakdown, so filtering needs no
  network.

**Out:**

- Typing an amount by hand ("I bought 400 g of 700"). The owner chose marking only,
  2026-10-09. It may return as its own project.
- Changing how a quantity is computed: the dry-weight rule and the 5 g round-up of
  [`0078`](../../decisions/0078-a-plate-has-a-gram-ceiling-and-cooked-grains-read-dry.md)
  stay exactly as they are, only applied after the range is summed.
- A list across plans, a price per ingredient, a supermarket integration, a route through
  the shop.
- The `/inicio` snapshot keeps counting what is left of the whole plan.
- Offline caching of `/compra/proxima`, which [`0053`](../../decisions/0053-the-shopping-list-survives-the-supermarket.md)
  deliberately leaves out.

## Acceptance criteria

1. On `/compra` the reader can choose the fortnight, week 1, week 2, or any set of days,
   and the rows and quantities shown are those of exactly those days.
2. A range's quantity for an ingredient is what the domain computes for those days, with
   the cooked-to-dry conversion and the 5 g round-up applied **after** the range is summed,
   never per day. An unfiltered list equals today's list, row for row and quantity for
   quantity.
3. Bought is an amount per ingredient. Marking a row buys the range's amount; unmarking
   subtracts it; the amount never falls below zero nor rises above the whole plan's need.
4. The owner's case holds: week 1 needs 500 g and the fortnight 1.2 kg. Marked in week 1
   and read in the fortnight, the row says 700 g left and reads as partly bought. Marked in
   the fortnight and read in week 1, it reads as done.
5. Progress and the share text count the chosen range, not the fortnight.
6. With no signal on `/compra`, the filter, the quantities and the marks all work, and the
   marks reach the server when it returns under the rules of `0055`: the newest mark for a
   row wins, a 4xx drops it, a 5xx keeps it.
7. A swap, an event rebuild or a regeneration keeps the amount bought per ingredient,
   capped at the new need. A manually added row keeps its own mark.
8. The filter the reader left is the one they find on that device, and a session change
   clears it with the other per-device state.
9. No regression: `pnpm gate --full` green, the end-to-end suites green, and the
   accessibility review passes on the new control — reachable by keyboard, announced by a
   screen reader, 44 px targets, and legible at 320 px.
10. Ownership is unchanged: nobody reads or writes another account's list, and a plan under
    dietitian review stays invisible
    ([`0060`](../../decisions/0060-a-reviewed-plan-waits-in-its-own-state.md)).

## Open questions

None. The four product choices were made by the owner on 2026-10-09: marking only (no typed
amounts); unmarking subtracts the range's share; chosen days as individual boxes; and the
filter is remembered per device.

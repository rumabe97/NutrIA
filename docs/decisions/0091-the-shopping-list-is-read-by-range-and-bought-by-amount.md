# 0091 — The shopping list is read by range and bought by amount

- **Date**: 2026-10-09
- **Status**: accepted
- **Project**: [020 — The shopping list you are shopping now](../projects/020-the-shopping-list-you-are-shopping-now/)
- **Amends**: [`0055`](./0055-a-tick-in-the-aisle-waits-for-the-signal.md) (a tick becomes an
  amount), and leaves [`0053`](./0053-the-shopping-list-survives-the-supermarket.md) and
  [`0078`](./0078-a-plate-has-a-gram-ceiling-and-cooked-grains-read-dry.md) in force.
- **Amended 2026-10-09**, building project 020 phase 2, on two points of fact that agents
  `invariant-reviewer` and `migration-reviewer` both checked in the code. The reason for
  keeping `checked` said "and the admin console reads it": it does not. `shopping_lists` and
  `shopping_list_items` have exactly one reader and writer, `PlanRepository`, and the only
  screen that reads the flag is the web shopping list — so the deploy window is the whole
  reason, and the release that stops the old build reaching production is the release the
  column can go. A sentence like that one, left standing, is how a column outlives its
  reason. The second point: this record said a row is done when `bought >= needed` **and**
  untouched at zero, which both hold at a zero need; the rule below now says which wins.

## Context

The list is a flat projection of a whole plan: `buildShoppingList` sums day → meal →
ingredient into a `Map<slug, grams>` before anything is stored, and no stored row names a
day. "Bought" is a boolean on the row. The owner asked for a list that can be read for one
week, or for chosen days, and for a mark that survives a change of filter: buy the week's
500 g, read the fortnight, and 700 g are still to buy.

Three shapes were available.

1. **Store a row per ingredient per day.** The list becomes dated, and a range is a `WHERE`.
   It multiplies the rows by fourteen, breaks the one-row-per-ingredient identity that the
   offline queue and the manual rows depend on, and needs the dry-weight round-up to be
   recomputed per range anyway — because rounding each day up to 5 g and then summing
   over-buys by up to 70 g an ingredient.
2. **Re-aggregate on the server for each requested range.** Correct, and it reuses
   `findDaysWithMeals`, but every change of filter is a round trip. On `/compra`, the one
   screen the product promises in a supermarket with no signal, that is the wrong trade.
3. **Keep one row per ingredient, carry the per-day breakdown to the client, and store what
   is bought as an amount.** Chosen.

## Decision

- **Identity stays one row per ingredient per plan.** `shopping_list_items` keeps its
  primary key, its name, its category, its display unit and its manual rows. A range never
  adds or removes a row's identity; it changes the quantity a row shows, and a row whose
  range quantity is zero is not displayed.
- **The breakdown travels with the list.** The read endpoint returns, per row, the grams
  each day of the plan needs. Fourteen numbers a row is a few kilobytes for a whole list,
  it is cached with the page by `0053`, and it lets the reader change filter with no
  network.
- **A range's quantity is computed, not stored.** The domain owns it: sum the chosen days'
  grams, *then* convert cooked grains to dry and round up to the 5 g step, then convert to
  the display unit. Never per day, or the round-up compounds. One function, used by the
  server and by the client, so the two can never disagree.
- **Bought is an amount in grams**, `boughtGrams`, on the row. Marking a row sets it to
  `max(bought, needed(range))`; unmarking sets it to `max(0, bought - needed(range))`. It is
  capped at the whole plan's need. A row reads as done when `bought >= needed(range)`,
  untouched at zero, and partly bought in between, where what it shows is
  `needed(range) - bought`.
- **`checked` stays, derived**, for one release: the old web build runs against the new API
  while a deploy is in flight. A write of `boughtGrams` sets `checked` to whether the whole
  plan's need is covered; a write of `checked` sets `boughtGrams` to the whole need or to
  zero. A row that needs nothing reads **untouched**, not done — of the two sentences above
  that both apply at a zero need, "untouched at zero" is the honest one.
- **The offline queue carries amounts.** Its key moves to `nutria-pending-ticks-v2`, one
  entry per row holding the amount last chosen on this device, and `0055`'s rules are
  otherwise unchanged: the newest entry for a row wins, a 4xx drops it, a 5xx keeps it, and
  a session change clears it. The old key is read once and dropped, so a tick made offline
  before the deploy is not lost.
- **Regeneration carries the amount**, capped at the new need, where it carries the tick
  today — keyed on `ingredientId`, in the same transaction.

## Consequences

- A partial shop is representable for the first time, which is the point.
- The client computes quantities, so a bug there shows a wrong number to one reader rather
  than writing a wrong number for everybody. The server still computes the same quantity
  when it caps a write, and the end-to-end suite asserts the owner's case through HTTP.
- Two devices still end with the last write, not a sum. Buying the same thing twice on two
  phones is not distinguishable from marking it twice, and inventing a sum would double a
  double-tap.
- Unmarking in a narrow range leaves an amount bought, which is deliberate and what the
  owner chose: unmarking says "not this range's share", not "nothing at all".
- Typing an amount by hand is now a small step — the column exists — but stays out of 020.

# 0103 — A day's arithmetic is a warning somebody may accept, not a refusal

- **Date**: 2026-10-16
- **Status**: accepted (the owner, 2026-10-16, in his own words below)
- **Builds on**: [`0011`](./0011-nutrition-targets-are-advisory.md) (targets are advisory;
  the energy floor is the only bound that blocks),
  [`0045`](./0045-a-day-is-built-to-all-four-of-its-numbers.md) (every day to all four
  macros), [`0098`](./0098-a-meal-somebody-fixed-is-not-the-schedulers-to-change.md) (a
  fixed meal is not the scheduler's to change),
  [`0101`](./0101-a-day-can-hold-two-fixed-meals-and-the-second-is-offered-from-what-fits.md)
  (the second rule of a day is offered from what fits beside the first).

## Context

Two reports from the owner on 2026-10-16, which turned out to be one problem.

**The first was speed.** *"Las peticiones de fijar alimentos tardan muchísimo, por lo menos
cuando ya hay una fijada ese mismo día."* Measured while project 021 phase 5b was being
built: `pinnable` with a non-empty `held` is **2.7 s** on an 851-dish pool. The cost is one
line — `FixedMeals.service.ts`'s `offerFor` ends in `pinnable(input, dayIndex, slot, held)`,
and with a rule already on the day that runs `dayHolds` **per candidate**, about 14 ms each,
building and validating a whole day for every dish in the library to decide whether to offer
it. Three routes go through that line: the picker (`GET /fixed-meals/fixable`), the
explanation (`POST /fixed-meals/not-offered`) and asking us to write a dish (`POST
/fixed-meals/request`).

**The second was the refusal itself.** *"Si no cuadra macros, no me deja elegir ese plato. En
vez de [no dejar] elegir, deberías poner un aviso indicando eso al usuario, y que es su
responsabilidad o algo así, pero que permita elegirlo."*

They are the same change, and that is the whole point of this record. **What the expensive
filter computes is exactly the refusal he wants replaced by a warning.** A filter must ask
the question of every dish in the library, because it decides what to show. A warning asks
it of the one dish somebody chose. `dayHoldsPin` — added in 021 phase 5b, the same last
filter asked of one dish — answers in **6 ms**, with a test asserting it agrees with the
whole-pool answer dish by dish.

**The filter was never a promise, and said so.** `dayHolds`'s own comment calls it
optimistic in one direction and deliberately so: a day built alone sees no variety pressure
from the other thirteen and has the whole library to balance with, so *"a pair it refuses can
never work; a pair it accepts can still cost a day inside a real fortnight — measured at 8
days in 1960"*. So the product was already paying 2.7 s for a heuristic that is wrong 8 times
in 1960 in the permissive direction, in order to be strict in the other.

## Decision

**The two refusals that are arithmetic become warnings somebody may accept.** They are
`clashes_with_fixed` (the day cannot reach its four macros with this dish beside the rule it
already holds) and `too_big_or_small` (the dish cannot be sized into that meal's plate).
Both are statements about numbers, both are the person's own trade-off to make, and neither
is a thing they are unable to do.

**Everything else stays a refusal**, and the line is not taste:

- `allergen` — safety, and the one bound that is never the person's to overrule (`0004`).
- `excluded`, `disliked` — their own standing instructions; overruling them here would be
  the product arguing with something they already said.
- `missing_equipment` (`0102`) — they cannot cook it. Accepting a consequence does not
  conjure an oven.
- `no_method` — the recipe does not say how, which is ours and not theirs.
- `wrong_slot` — it is not a dish for that meal, for them (`0062` § 5).

The test is whether accepting the consequence leaves somebody able to eat the thing. For the
two arithmetic reasons it does: the day comes out of band and the food is real. For the rest
it does not.

**So the offer stops filtering the pool by the day's arithmetic.** `offerFor` returns the
plate-fit list, which is what `pinnable` with no `held` has always been and costs about 25
ms. The day's arithmetic is asked **of the dish somebody picked**, through `dayHoldsPin`, at
add time — and it answers a warning rather than a 422.

**`honouredPin` remains the backstop and nothing about that changes** (`0097`: the pool is a
bound, and safety outranks a rule). A rule somebody accepted against the arithmetic may
still be dropped by a generation that cannot honour it, and when that happens **they are
told**, because 021 phase 5b made exactly that audible: the rule is listed as not being
honoured, with `clashes_with_fixed` as its reason. That is the coherent end of this
decision rather than a gap in it — somebody accepts a risk, and when the risk lands the
product says so instead of quietly serving something else.

## Consequences

- **A day built around an accepted rule can come out of band**, by the person's own choice.
  `0011` already allows it — targets are advisory and the energy floor is the only bound
  that blocks — but `0045` is a promise this product makes loudly, so the promise now has a
  stated edge: **every day to all four macros, unless somebody overruled it for a meal they
  wanted.**
- **The evaluator's headline figure changes meaning, not value.** "Fourteen of fourteen days
  inside 5%" stays true of the fourteen fixed profiles, none of which overrules anything;
  it stops being a statement about every account. Any future measurement that wants the
  unqualified claim must say it measured accounts that did not accept a warning.
- **Speed, which is the reason this is being done now**: the picker goes from **2.7 s to
  about 25 ms** on a day that already holds a rule, and the explanation and the dish request
  go with it. The per-dish question is paid once, on the dish chosen.
- **The warning has to be read, not just shown.** It is a sentence somebody acts on, so it
  says what will happen — this day may not reach its numbers — and that it is their call. It
  is not a dialog that trains people to tap through: the dish stays in the list with the
  warning on it, the way `0102`'s appliances are shown on a dish rather than only used to
  filter.
- **What this does not do**: it does not let anybody overrule safety, it does not change
  what a generation does with a pin it cannot honour, it does not touch the energy floor,
  and it does not relax validation — a day out of band is still reported out of band, to the
  person and in the admin console's numbers.
- **One thing left measured rather than guessed**: how often an accepted rule actually costs
  a day. `dayHolds`'s own figure is 8 days in 1960 for pairs it *accepts*; the rate for
  pairs it would have refused is unknown and is worth a run of the evaluator with accepted
  warnings once this ships.

(who decided: the owner, 2026-10-16 — both that the arithmetic should warn rather than
refuse and that the slowness was unacceptable; the lead, that they are one change, with the
measurement that says so.)

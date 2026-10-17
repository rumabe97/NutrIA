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

**One refusal becomes a warning somebody may accept**: `clashes_with_fixed` — the day
cannot reach its four macros with this dish beside the rule it already holds.

**Amended 2026-10-16, before any of it was built.** This record first said *two*, pairing it
with `too_big_or_small`, and the owner's own requirement is what rules the second one out:
*«aunque no se cumplan las macros, el plan se tiene que generar con esas comidas»* — if he
accepts, the meal must actually be served. Checked against `honouredPin`, which yields to
exactly three hard bounds:

- **`clashes_with_fixed` is already served.** The day's macro bands are **not** one of those
  bounds, so a pin whose day cannot reach them is honoured anyway and the day is simply
  built out of band. Nothing has to be forced; the offer only has to stop hiding the dish.
- **`too_big_or_small` is `fitsPlate` failing**, which *is* one of the three, and
  `honouredPin` drops the pin — its own words: *"forcing it would serve a plate the product
  refuses to serve"*, the gram ceiling and `PLATE_LIMIT` of `0076`, `0078` and `0070`.
  Warning and accepting there would take somebody's acceptance and **still not serve the
  meal**, with 021 phase 5b then reporting the rule as not honoured. That is worse than
  refusing, so it keeps its refusal and its existing sentence, which already says to try the
  dish in another meal.

**And a day may hold at most two fixed meals** (the owner, 2026-10-16: *«máximo dos por día
ehh, no se pueden fijar más de dos»*). This is new, and it exists **because of** the change
above. [`0101`](./0101-a-day-can-hold-two-fixed-meals-and-the-second-is-offered-from-what-fits.md)
deliberately set no per-day cap, reasoning that *"the filter is the cap"* — a third rule's
offer collapses on its own to 2 of 37 dishes on the tightest profile, so a number would be
arbitrary where the measurement is not. **Removing the filter removes that cap**, and
nothing would then stop somebody fixing every meal of a day; the owner saw it and this
record had not. So the cap stops being emergent and becomes a number, enforced in the
repository's lock the way the per-tier allowance already is — never a read followed by a
write. It is a **refusal**, not a warning: a product bound like `MAX_PREFERRED_APPLIANCES`
and not an arithmetic one. The per-tier allowance (`0099`: free 1, premium 3) is a different
count and is unchanged, so a premium account may still hold three rules and now at most two
of them on any one weekday.

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
add time — and it answers a warning rather than a 422. **The plate fit does not leave with
it**: `too_big_or_small` is still computed, because it is still a refusal.

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
- **The meal is served, which is the owner's actual requirement and not a side effect.** A
  pin outranks variety, the repeat rules and the kind caps, and yields only to the pool, the
  slot and the plate fit — so an accepted rule is honoured and its day comes out of band,
  rather than being quietly dropped. The backstop still exists for the three bounds it
  always had.
- **What this does not do**: it does not let anybody overrule safety, it does not change
  what a generation does with a pin it cannot honour, it does not touch the energy floor,
  and it does not relax validation — a day out of band is still reported out of band, to the
  person and in the admin console's numbers.
- **The two bounds are ordered in the lock and nowhere else.** The cap and the tier
  allowance can both refuse the same write, and this record says the allowance is asked
  first because *"you have used all three"* is the truer sentence. That is true **only**
  because no service path pre-empts `createWithinQuota`: a pre-check reads its count outside
  the lock and picks the sentence before the authoritative count exists, so for somebody who
  has both spent their allowance and filled the day it picks the wrong one. One was written
  here, found by an end-to-end test on 2026-10-16, and **deleted rather than reordered** —
  the repository refuses with the same domain error, so nothing was lost but the bug. The
  rule is in `packages/core/AGENTS.md`, because the next person to add a pre-check "for a
  nicer error" will not read this record.
- **A clash is not an unhonoured rule, and saying so was a defect this change had to fix
  first.** Project 021 phase 5b reported `clashes_with_fixed` in the list of rules the plan
  cannot honour, with a sentence telling somebody to remove one of the two. Both halves are
  false: `honouredPin` yields to the pool, the declared slot and `fitsPlate` and **not** to
  the day's bands, so the pair is served and the day simply comes out of band — proved on
  rows, both dishes on the plate with the day 5.8% under on energy. Worse, both rules of the
  pair were listed, so it named a rule nobody had made any trade about. The field carried two
  different facts, and the fix is to stop it doing so: `unhonoured` keeps the five reasons
  that really drop a pin and its `why` is now typed to exclude the acceptable one, while a
  separate `outOfBand` names the days that are served and miss their numbers. **`0103` is
  what makes this reachable** — before it the offer filtered clashing dishes out, so the
  state was nearly unbuildable — which is why the fix lands here and not in phase 5b.
- **One thing left measured rather than guessed**: how often an accepted rule actually costs
  a day. `dayHolds`'s own figure is 8 days in 1960 for pairs it *accepts*; the rate for
  pairs it would have refused is unknown and is worth a run of the evaluator with accepted
  warnings once this ships.

(who decided: the owner, 2026-10-16 — both that the arithmetic should warn rather than
refuse and that the slowness was unacceptable; the lead, that they are one change, with the
measurement that says so.)

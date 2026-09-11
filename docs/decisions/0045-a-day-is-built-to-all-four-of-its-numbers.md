# 0045 — A day is built to all four of its numbers

**Status**: accepted · **Date**: 2026-09-11 · **Deciders**: owner, agent

## Context

The owner looked at the days before a race on their own plan and saw the macros
were wrong. Read from the database, every day of that fortnight — loaded or
not — hit its calories and its protein almost to the gram and missed
carbohydrate by up to 46% and fat by up to 75%, always in the same direction.
Nothing had reported it.

The cause was one function. `fitCost`, the number the scheduler uses to choose
a dish for a slot, to swap one dish for another, and to size the portions of a
day, compared energy and protein and nothing else. Two dishes that tied on
those were indistinguishable to it however differently they spent their
energy, and a library of Spanish home cooking — meat, fish, cheese, lean on
starch — spent it as fat. Validation had no band for carbohydrate or fat
either, so the plan passed.

The owner's instruction: every day must hit its macros to within 5%, a day
that eats for an event must move the way it was told, and "the macros have to
be perfect or none of this is any use". The lever is not an AI prompt. Most of
a mature plan's dishes come from the library (`0006`), untouched by any prompt,
and this product's rule since `0004` is that nutrition is decided in code. The
code just was not deciding this.

## Decision

Measured throughout on the owner's real profile against the real library —
168 usable dishes, four slots — with no provider call.

**1. `fitCost` fits all four macros.** Carbohydrate and fat join energy and
protein as relative-error terms, weighted 0.75 each by the same 1/tolerance
rule that already gave energy 1.5 and protein 1. Carbs and fat went from zero
days of fourteen inside 10% to fourteen inside 5%. Energy and protein stayed
inside 3%.

**2. Portions are sized by exhaustive search, not a greedy walk.** The old
`balanceDay` took one quarter-serving step per pass and stopped at the first
local minimum, of which a four-macro surface has many. Every combination inside
a window of a serving either side is now priced — four dishes at nine sizes is
6,561 days, which costs nothing — and the best is taken. Fat, which arrives in
small grams inside a plate and cannot be steered by scaling one dish, is what
this reaches.

**3. A swap is judged by the day it becomes once re-sized.** `improveDay` used
to price a candidate at the size it was first scaled to. Now the whole pool is
ranked cheaply, the top twenty-four are priced with the exhaustive portion
search, and the best wins. Eight left one day at 7% on fat; twenty-four brought
every day inside 5% on all four macros. The fortnight prices in four seconds.
The same budget shape reaches the meal-swap path: a replacement is matched to
the plate it replaces on all four macros, not two.

**4. Validation holds every macro to 5%, as guidance.** `PLAN_TOLERANCE` gains
symmetric bands for carbohydrate and fat and tightens energy and the protein
floor from 10%/15% to 5%. A day outside a band is recorded on the plan as an
advisory and delivered, per `isBlocking`'s standing rule: the targets are an
estimate, and a person handed no plan eats worse than one handed a day at 7%.
The safety bounds — the calorie floor, the protein ceiling — are untouched and
still block.

**4b. The portions keep the shape of the day, as an order, not a size.** The
exhaustive search found this out for itself: with lunch "normal" and dinner
"light" (`0036`), it fed the day's four totals by making dinner the bigger
meal, because that combination priced the totals a little lower and nothing
in the cost said which meal was which. A soft penalty on every meal's drift
from its share was tried first and rejected — at a weight that kept the light
dinner smaller, it also pulled protein and fat back outside 5% on the real
library. The promise is not "each meal within a few per cent of its share";
it is that a light dinner is lighter than a normal lunch. So the cost is a
hinge: nothing while the order holds, steep once it breaks, and only between
meals whose shares differ by more than a fifth — light against normal is a
factor of two and the person chose it; lunch 0.33 against dinner 0.30 is the
app's own default and is left free. Measured: the normal shape stays at
fourteen of fourteen inside 5% on all four macros, and the light-dinner shape
lands the same with lunch above dinner on every day.

**5. Loaded days are held to their own numbers.** Unchanged in mechanism from
`0043`; now actually met. The two event days in the measurement landed within
1.3% of their raised targets on every macro.

## What this does not do

It does not change what a dish is. Every plate is still a recipe scaled in
quarter servings, so a recipe's ingredient ratios are the recipe's. If a future
library cannot reach 5% on some day by choice of dish and portion alone, the
next lever is trimming one ingredient of one dish — a bounded, per-ingredient
adjustment — and that is a product decision about what a recipe means, not a
tuning change. It was not needed here.

The synthetic scheduler fixtures had to be made nutritionally honest to test
this. Rice and chicken breast are both genuinely low in fat, and a three-food
catalogue with no oil in the pan could never have reached a fat target, so the
tests taught nothing about the fit; a tablespoon of oil in the cooked dishes,
which is what a kitchen does, is what let them fail for the right reason. And
a hand-built pool of four foods is held to a stated 10% band, not the product's
5%: it proves the mechanism, and the 5% is proven where it is claimed — on the
real library.

## Consequences

Every generated plan, and every mid-plan rebuild (`0044`), now lands each day
inside 5% of all four macros where the library allows, and says so on the plan
when it could not. Generation is roughly four seconds slower per fortnight.
Plans built before this carry the old drift and keep it — history is history
(`0021`); the next generation is the fix.

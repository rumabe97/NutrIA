# 0046 — A plan that misses its macros is scheduled again, from a wider rotation

**Status**: accepted · **Date**: 2026-09-11 · **Deciders**: owner, agent

## Context

[`0045`](./0045-a-day-is-built-to-all-four-of-its-numbers.md) made the scheduler
fit all four macros and measured fourteen of fourteen days inside 5% — against
the whole library. The owner regenerated their plan the same afternoon, and the
real generation did not match the measurement: days one to nine inside 5%, the
two event days inside 5% of their raised targets, and days ten to fourteen
sliding steadily out — carbohydrate from −10% to −18%, fat from +17% to +37%.

The difference was the pool. Generation does not hand the scheduler the whole
library; `rotatePool` hands it about a dozen dishes per slot, in an order
shuffled for this user, without last fortnight's dishes or the ones they
dislike. The dozen is short on purpose: the pool builder asks the model only
for the shortfall, so this number is the mechanism behind "a third of every
plan is fresh" (`0013`). And the scheduler builds days in order, while the swap
step that repairs a day does not look at how often a dish has been used — so
the dishes that carry the carbohydrate reach their two uses a plan in the
first week, and the last days are built from what is left.

Reproduced with the exact rotation of that generation — same seed, the same
forty-nine excluded dishes — on the real library:

| Pool | Days inside ±5% (kcal / protein / carbs / fat) | Worst miss | Days 10–14, worst |
|---|---|---|---|
| Rotation, a dozen per slot | 14 / 13 / 6 / 4 | fat 50% | 22, 34, 50, 24, 29 % |
| The same rotation, uncapped | 14 / 14 / 14 / 14 | 3.4% | 1, 2, 1, 1, 3 % |

## Decision

**Generation stays as it is, and a plan that misses a band gets a second
schedule.** When validation reports any day outside its energy, protein,
carbohydrate or fat band, the plan is scheduled once more from the pool it
already had — the rotated dishes and the fresh ones the model wrote, first —
plus the rest of this user's rotation with no cap. Whichever plan misses by
less is kept, and the plan records `fallback: 'wider_rotation'`.

"Misses by less" is the summed excess beyond tolerance across every band on
every day, not a count: one day at 30% is worse than two at 6%, which is how a
person reading their Tuesday would judge it.

What the rotation protects is kept. The wider pool is `rotatePool` with the
cap lifted, so it is still this user's shuffled order, still without last
fortnight's dishes, still without the ones they dislike. The fresh third is
kept: the model's dishes are in the pool before the library's. And there is no
second model call — reading the library costs nothing.

## Alternatives considered

- **Raise the per-slot number.** Fixes the macros and breaks `0013`: the pool
  builder asks the model only for the shortfall, so a full library pick means
  no fresh dishes and a shelf that stops growing.
- **Always schedule from the uncapped rotation.** Two similar people would get
  more alike plans, which is what `0009` fixed; the second pass costs a few
  seconds only when the first one missed.
- **Teach the swap step about usage.** The root cause is real, but a usage
  penalty inside a greedy day-by-day build trades one kind of exhaustion for
  another and is hard to measure. The wider pool fixes the outcome and is
  measured.

## Consequences

A plan that the rotated pool could not bring inside 5% now gets one more try
from the user's own rotation, at no model cost, and keeps whichever is better.
When even that misses — a thin library, a narrow taste — the plan is delivered
and says so, as `0045` already arranged.

The older `full_library` rescue, which exists so a person never ends up with
no plan, read the library with no rotation and so could serve a dish they had
marked as disliked (`0014`). Put to the owner, who first asked whether the
model could write a replacement instead. It mostly cannot help: that rescue
runs when the model has just failed — quota, key, outage — and the first pass
had already asked it for exactly the shortfall. **Decided (owner): dislikes
are excluded from the rescue too, with no extra model call.** Last
fortnight's dishes may still return in a rescue; a refused one may not. When
the library without dislikes cannot fill a fortnight, the person gets the
honest error (`GENERATION_AI_UNAVAILABLE` or `GENERATION_POOL_TOO_SMALL`), not
a plate they turned down.

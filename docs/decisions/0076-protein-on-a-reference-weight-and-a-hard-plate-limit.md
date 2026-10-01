# 0076 — Compute protein on a reference weight, and hold every plate inside a hard limit around its share

- **Status**: accepted. Amends [`0051`](./0051-a-day-keeps-its-shape-and-its-proteins-apart.md): the share band stays a preference, and a wider limit outside it is now a bound. Complements [`0070`](./0070-a-serving-has-a-ceiling.md): that caps a serving, this caps a plate.
- **Date**: 2026-10-01
- **Deciders**: owner ("planifícalo como proyecto con A, B y el perfil nuevo… lo necesito rápido para regenerar el plan"); agent: the reference weight and the limits
- **Project**: docs/projects/012-a-plate-a-person-can-eat

## Context

The owner read a real meal plan on 2026-10-01. The person was about 175 cm and 100 kg (BMI over 30)
and wanted to lose weight. They ate a light snack, a lunch and a dinner. The day's protein target
was 1.8 g/kg on actual weight, so about 180 g.

The scheduler is allowed to trade a meal's share of the day for macro fit (`0051`). It may also
serve up to 4 servings of a dish whose single serving `0070` keeps under 900 kcal. So it met the
protein by building lunches of 1,500–1,700 kcal with up to 500 g of meat, beside dinners of
250–400 kcal. One "light" snack passed 500 kcal. Most days had a meal outside the share band,
and fewer than half were within ±5% on all four macros.

## Decision

1. **Protein on a reference weight.** Protein grams are the goal's g/kg times the reference
   weight. The reference weight is `min(actual weight, the weight at BMI 25 for the person's
   height)`, with `REFERENCE_BMI = 25`, for the goals `weight_loss`, `healthy_eating` and
   `maintenance`. `muscle_gain` and `performance` keep actual weight: their excess over BMI 25 is
   likely muscle (owner's choice, option (c)).
   - Energy, the protein floor, and the 3 g/kg plausibility ceiling stay on actual weight.
   - Protein need tracks lean mass, and body weight above BMI 25 is mostly not lean mass.
2. **A hard plate limit.** Every plate's energy is held within 0.5–1.5 × its slot's share of that
   day (`PLATE_LIMIT`), on every path that sizes or places a plate.
   - A dish that cannot be sized into that range is not eligible for the slot.
   - The soft `SHARE_BAND` (0.7–1.4) is unchanged inside it.
   - When the macros cannot be met within the limit, the day is delivered out of band with its
     advisory. A plate is never inflated to meet them.
   - **The daily energy floor outranks the limit.** It stays the only bound that blocks, as
     `docs/ARCHITECTURE.md` already promises. A plate may pass 1.5× only as far as the floor
     needs: in a swap, through the existing scale-up loop; in the day's sizing, by a second search
     over the full serving bounds when nothing inside the limit reaches it.

## Alternatives considered

- **The same cap for every goal.** Rejected by the owner: it would cut an athlete at 98 kg and
  190 cm from 186 to about 171 g, for weight that is likely muscle.
- **A switch at BMI 30**, which is what the owner's brief said. Rejected for a discontinuity: at
  175 cm, 91 kg (BMI 29.7) would get 164 g and 93 kg (BMI 30.4) would get 138 g. The continuous
  cap gives everyone between BMI 25 and 30 a smaller version of the same correction.
- **Adjusted body weight** (ideal + 0.25–0.4 × the excess). It gives 148–155 g for this case,
  which is still 75 g or more on each of two plates. Rejected: it needs a second constant to
  argue about, for a small difference.
- **A higher `SHARE_BAND_WEIGHT`.** Rejected: a heavier preference is still a preference. A
  library short of the right dish would still buy macro fit with a 1.7× plate.
- **An absolute gram or kcal ceiling per plate.** Rejected for now: `0070` already relies on big
  eaters getting 2–4 servings. A ceiling relative to the person's own share keeps that and still
  stops a plate from swallowing the next one. It can be added later if the evaluator shows a need.

## Consequences

- People above BMI 25 get less protein and more carbohydrate at the same energy. For the
  evaluator's stand-in (176 cm, 102 kg) this is 184 → 139 g of protein.
- Athletes are not cut: `muscle_gain` and `performance` stay on actual weight, so a 98 kg, 190 cm
  muscle-gain profile keeps its 186 g. A person who switches goal from training to weight loss
  will see their protein drop at the next generation.
- A thin pool now shows up as a day out of band rather than as an absurd plate. Macro misses may
  rise slightly, and the evaluator guards that: at most one day per profile against `main`.
- Existing meal plans are untouched until they are regenerated. No data migration, no prompt version.

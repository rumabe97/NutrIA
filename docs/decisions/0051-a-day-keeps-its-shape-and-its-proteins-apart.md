# 0051 — A day keeps its shape, and its proteins apart

**Status**: accepted · **Date**: 2026-09-12 · **Deciders**: owner, agent

## Context

The first plan generated in production through the gateway (`0050`) landed every
one of its fourteen days inside 5% on all four macros (`0045`, `0048`), and it
still read wrong to the person eating it:

- **Meals the size of nothing in particular.** A 388-kcal lunch beside a
  1,247-kcal dinner; the next day the other way round, 1,145 beside 348; a 78-kcal
  snack. `0036`'s hinge keeps a light meal lighter than a normal one, and only
  where two shares differ by a fifth. Lunch and dinner at their default weights do
  not, so the portion search traded them freely for a point of fit.
- **Tuna in nine meals, egg whites three times on day 10.** Variety was per dish
  (`VARIETY_RULES`), and forty-seven different dishes shared a handful of
  proteins.
- **The same tuna salad, dinner on day 3 and lunch on day 4.** The four-day gap
  was per slot; a dish that suits both meals could come back the next day.
- **Lunch at breakfast.** Asked for forty grams of protein at breakfast, the model
  wrote pasta with turkey and a warm potato salad with tuna; a snack came back as
  a bowl of turkey with strawberries; and the library served prawn skewers with
  rice as an afternoon snack, because seven plated dishes were filed under both
  supper and afternoon snack.

## Decision

- **Each meal near its share** (`SHARE_BAND`, 0.7–1.4 of the energy its share
  gives it). Outside the band the distance costs, in fit (`SHARE_BAND_WEIGHT` 1):
  far more than the points of fit a free search trades a day's shape for, less
  than a day several points off its macros. In the spread pass every macro band
  outranks it. The macros stay the promise; the shape is how the day should feel.
- **Level is out of order.** Between two meals the person sized differently,
  equal energy now counts as an inversion: a light dinner the size of the normal
  breakfast is not lighter.
- **A main protein once a day, and in about one meal in ten** (`PROTEIN_RULES`:
  six a fortnight at four meals a day). A dish's main protein is the ingredient
  from the protein aisle — meat, fish, seafood, eggs, pulses — that carries most
  of its protein, named by kind from its slug (`mainProtein`): `pechuga-de-pavo`
  and `pavo-picado` are turkey, `clara-de-huevo` is egg. Dairy and bread are left
  out; yoghurt at breakfast is the shape of that meal, not a repetition. A repeat
  is **priced, not refused**: 0.05 of fit wherever a dish is chosen or swapped,
  half a macro in the spread pass. Another dish wins whenever it fits nearly as
  well; a repeat is served when nothing does.
- **Never the same dish on the same day or the next**, whatever the meal
  (`VARIETY_RULES.minDaysBetween` 2). A hard rule like the other two, with its own
  violation kind, `repeated_too_soon`.
- **Each meal is told what kind of food it is** (prompt 3.3.0): breakfast is
  morning food, a snack something eaten between meals and not a plated main. The
  person's own words about breakfast still come first.
- **Seven seed dishes stop being snacks** (migration `0026`): the quinoa and rice
  bowls, the prawn skewers with rice, the roast sweet potato with tuna, the
  chickpea and tuna salad. They stay suppers.

## Alternatives considered

- **A band that is a wall** — a step plus the distance, at weight 2. Perfect on
  the real library; on the end-to-end suite's pool of a few plain dishes it held a
  day 10% off its energy rather than let a plate past its share.
- **Refusing a repeated protein.** The same failure on the same pool: three
  proteins a meal cannot fill fourteen days at one each.
- **Grouping by ingredient slug.** `atun-al-natural` and `atun-fresco`, `huevo`
  and `clara-de-huevo`, would count as different foods; they are the plate the
  person sees.
- **A deterministic filter for breakfast and snacks** (no rice at breakfast, no
  pasta in a snack). Rice pudding and onigiri are snacks; a cook's judgement is
  the model's half of `0004`, so the model is told, and the library's own tags
  are corrected as data.

## Consequences

Measured read-only on seven development profiles with the library rotation the
generation falls back to (every dish, last fortnight held back), before and after:

| | before | after |
| --- | --- | --- |
| Days inside 5%, energy / protein / carbs / fat | 98 / 98 / 98 / 98 of 98 | 98 / 98 / 98 / 98 of 98 |
| Meals outside 60–160% of their share | 70 of 406 | 0 (all within 0.70–1.40) |
| Days serving one main protein twice | 30 | 0 |
| The same dish on consecutive days | 7 | 0 |
| Days out of the size order | 0 | 0 |

On the capped library pool, the stand-in for the first schedule of a generation,
days inside 5% went from 93 / 65 / 94 / 79 to 93 / 62 / 94 / 89; four repeats
remain where the pool had no alternative.

- Scheduling costs more: up to a third longer on a five-meal profile, about 45
  seconds for both schedules together, inside the function's time.
- The spread pass may still let a meal past its band, or bring a protein back,
  to bring a macro inside: macros first, by construction.
- Plans already generated are not re-validated; a stored plan with a dish on two
  consecutive days stays as it was served.

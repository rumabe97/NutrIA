# PRD — Project 012: A plate a person can eat

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's brief of 2026-10-01; approved by the owner.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: approved
- **Roadmap item**: none — a defect found on a real meal plan; fixed as one quick project at the owner's request

## Problem

On 2026-10-01 the owner looked at a real production meal plan and found portions nobody would eat.
The person is a man in his sixties, about 175 cm and 100 kg (BMI over 30). He wants to lose
weight quickly and eats three times a day: a light morning snack, a normal lunch and a normal
dinner. His targets are about 2,100 kcal and 180 g of protein.

What the read-only analysis of that meal plan found:

- **Some lunches are huge and the dinners beside them tiny.** Several lunches are 1,500–1,700 kcal
  and weigh 1.1–1.25 kg, with 455–500 g of meat on one plate. The dinners next to them are
  250–400 kcal.
- **The snack swings as well.** The "light" snack goes from under 100 to over 500 kcal.
- **Most days are off their shape.** Each meal has a share of the day and a soft band around it
  (0.7–1.4 × the share). Most days have a meal outside that band, and some meals are about
  a quarter or 1.7× their share.
- **The meal plan still misses its numbers.** Fewer than half the days are within ±5% on all
  four macros: some are short of protein, others over on fat.

There are three causes, all in the code:

1. **The protein target is too high for two meals.** Protein is 1.8 g/kg on the *current* weight,
   so 100 kg gives 180 g. With two main meals, that needs 80–90 g of protein on each plate.
   For a BMI over 30 this is not what anyone would prescribe.
2. **A meal's share of the day is only a preference.** The scheduler gives up a meal's shape
   whenever that buys macro fit (`0051`). So it puts the day's protein on one plate and almost
   nothing on the next.
3. **`0070` caps one serving, not the plate.** The scheduler may serve up to 4 servings,
   so two servings of about 860 kcal become one lunch of about 1,700 kcal.

The evaluator (`apps/api/scripts/evaluate-plans.mjs`) has no profile like this one, so nothing caught it.

## Outcome

- Protein is computed on a reference weight that does not grow with excess body fat. For this
  person the target drops from about 180 g to about 140 g.
- No meal is served outside a hard limit around its share of the day, whatever the macros ask.
  A "light" snack stays light.
- The evaluator measures a profile like this one and reports each plate's share. A regression is
  visible before it ships.
- The owner can ask the person to regenerate their meal plan as soon as the fix is in production.

## Scope

**In:**

- The protein rule in `core/domain/Nutrition`.
- A hard per-plate limit in `core/domain/Scheduler`, on every path that sizes or places a plate.
- One new evaluator profile, and per-plate share reporting in the evaluator.
- Their decision record, tests and docs.

**Out:**

- Any change to the prompt, the stored dishes or the data.
- Any change to the 14-day structure or the macro bands.
- Any change to the energy formula (Mifflin-St Jeor, the floor, the deficit cap).
- Any change to protein bounds in validation (the floor and the 3 g/kg ceiling stay on actual weight).
- A user-facing explanation of the protein figure.
- Regenerating anyone's meal plan from code.

## Acceptance criteria

1. **Reference weight.** Protein grams = goal g/kg × reference weight. The reference weight is the
   lower of the actual weight and the weight at BMI 25 for the person's height, for the goals
   `weight_loss`, `healthy_eating` and `maintenance`; `muscle_gain` and `performance` keep actual
   weight, and never below 0.8 g/kg of actual weight (amended during execution). For the evaluator's
   stand-in (male, 60, 176 cm, 102 kg, moderate, weight_loss at 1 kg/week), the targets are
   2,122 kcal and 139 g of protein (184 g today), with fat at 66 g and carbohydrate at 243 g,
   re-derived as today. A profile at BMI ≤ 25, or with a `muscle_gain` or `performance` goal, gets exactly what it gets today.
2. **Hard plate limit.** No meal in a scheduled meal plan has energy outside
   0.5–1.5 × its slot's share of that day's energy. This holds for the first build, the balance,
   the swaps, the spread pass, distinct days, and a person's swap of one meal (`pickReplacement`).
   A dish that cannot be sized into that range is never placed in that slot, unless no dish in the pool
   fits the slot. In that case the first placement uses the eligible dishes, and the limit holds for
   every later pass (amended during execution). Another exception: the
   daily energy floor still outranks the limit. A swap may take its plate past 1.5× only as far
   as needed to keep the day above the floor, as the existing swap loop does today.
3. **Macros not made worse.** The macro promise does not get worse for the profiles the evaluator
   already measures: days within ±5% on all four macros may drop by at most one day per profile
   compared with `main`. A larger drop stops the phase for the owner.
4. **The new profile.** `imc-alto-2-comidas` is a synthetic stand-in with the same shape as the
   real case, not a copy of it: male, 60, 176 cm, 102 kg, moderate, weight_loss at 1 kg/week;
   light morning snack, normal lunch, normal dinner. It is measured. It shows 0 plates
   outside the limit, and its per-plate shares are recorded in LOG.md.
5. **Per-plate reporting.** For every profile, the evaluator prints the smallest and largest plate
   share and the number of plates outside the limit.
6. **Docs stay true.** `docs/ARCHITECTURE.md` describes the protein basis and the plate limit,
   decision `0076` records both, and `decisions/LOG.md` has its line.

## Open questions

- None. **Resolved 2026-10-01 — option (c).** The brief said "BMI > 30". The owner chose a
  continuous cap at BMI 25 that applies only to `weight_loss`, `healthy_eating` and `maintenance`;
  `muscle_gain` and `performance` stay on actual weight. Rejected: (a) the same cap for every goal,
  which cuts athletes whose excess weight is likely muscle; (b) a switch at BMI 30, which jumps
  26 g between 91 and 93 kg at 175 cm.

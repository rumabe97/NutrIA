# 0010 — Balanced plans by goal: a frequency table, minimums that are met, and what changes with each goal

> **Purpose**: the `architect` agent's report on the owner's request of 2026-10-03: that the
> 14-day plans be "super balanced" and genuinely serve each person's goal, with a minimum of
> legumes, a minimum and a maximum of fish (the minimum only if the person has not said they
> dislike it), variety, and new dishes from the generator when the library does not have them. It
> contains the frequency table by food group, how each group is recognised in the catalogue, the
> rules per goal, how they are enforced in the scheduler, today's measurement over the reference
> library and a phased plan ready for a PRD.
> **Audience**: the owner, the lead and the agents who execute the project. **Committed**: yes.
> **Maintained by**: the `architect` agent. Once merged it is not edited; a later review is a new
> report.
>
> **Base**: `origin/main` at `4b59d2c9` (#210: `0082` and 011's phase 5).
>
> **Numbers**: each carries its label: **measured** (where), **estimated** (with the hypothesis)
> or **unknown**.
>
> **Measurement**: local Postgres (`pnpm db:local reset --reference`, `NUTRIA_LOCAL_PG=1`),
> `0080`'s reference library: 871 recipes (500 seed, 371 production `ai`, exported 2026-10-02). One
> `READ ONLY` transaction per run, behind `guard.mjs`. No model call, no Neon read. The scripts are
> a working copy of `apps/api/scripts/evaluate-plans.mjs` (the same profiles, the same
> `contextFor`, the same `schedulePlan` and `validatePlan`) plus the group recognition this report
> proposes (§ 1.2); they are not in the repository. Public sources read on 2026-10-03, linked at
> the end.

## Verdict

**Yes, on conditions.** Every plan can be asked for a frequency table by food group (legumes,
fish, meat, processed, starches, vegetables, fruit, wholegrain, fibre) and it can be enforced in
code, with the same mechanism that already holds up `0081` and `0082`. But three premises of the
request are not accurate, and they change where the work is:

1. **The problem is not the library, it is the draw.** Over the whole reference library the
   scheduler already serves between 5 and 20 legume dishes out of 28 main meals (measured), and
   there are 112 legume lunches for an omnivore. What reaches production is a **random rotation of
   19 dishes per meal** plus 7 from the model (`core/domain/Variety/Rotation.ts:193`): across 10
   rotations measured the way production does them, a `traditional_spanish` plan came out with
   between 2 and 8 legumes depending on the seed (median 5), and an unrestricted three-meal one
   with between 4 and 9. A minimum needs first that the rotation **guarantees** dishes from each
   group, and then that the scheduler **serves** them. Neither exists today.
2. **AESAN asks for more legumes than the request says.** The AESAN 2022 report says "at least 4
   servings/week of legumes, working towards daily consumption"; 2–4 was the 2020 figure and 3 the
   MEDAS index's. And AESAN also sets a **maximum for meat** (3 servings/week) and for eggs
   (4/week) that no plan respects today.
3. **Polenta *is* a grain as far as the code is concerned.** `polenta` and `polenta-cocida` are in
   the `grains` group (`core/domain/MealFit/Cuisine.ts:93-94`), and the only polenta dish in the
   reference library is recognised as one (measured). Most likely v17's dish used `harina-de-maiz`,
   which is in no group; I cannot check without reading that dish in production.

The conditions:

- **The usual order: safety, bands, held rules, prices, fit.** Allergies, the way of eating and
  "I don't like it" filter the pool before anything, and a minimum is computed over what is left:
  if no fish is left, the fish minimum is zero without reading any preference. The macro bands
  (±5%, `0045`) still outrank any frequency, as the owner decided in 017 ("the macros win").
- **The minimums are new and do not fit in `kindExcess`.** An excess rule is judged meal by meal;
  a minimum is only known at the end of the fortnight. It needs a reservation at build time (which
  days carry a legume) and a final pass that repairs it, not one more price.
- **The generator is the last lever, not the first.** What the library really lacks is light
  Spanish legume dinners (3 for an omnivore), more legume types (only 4 of the 7 `LEGUME_RULES`
  distinguishes) and wholegrain dishes. They are asked for **inside the requests already being
  made** (zero extra calls), not with a new call.
- **Fruit and wholegrains are the biggest gap, and the scheduler does not fix them.** Today no
  profile reaches 2 servings of fruit a day (0.1–1.1 measured) and almost none reaches half of its
  grain as wholegrain (9–56% at lunch and dinner). That is accompaniments and data.

## Premises checked

| # | Premise | Status | Evidence |
|---|---|---|---|
| 1 | v17 (2026-10-03) had a legume in 2 of 28 main dishes | **hypothesis** (the owner's figure) | I do not read production. It is compatible with what was measured: in production-like rotations (without the fresh third), `traditional_spanish` comes out with 2 on the worst seed and a median of 5; `objetivo-bajo-3-comidas`, with 4 and 5. |
| 2 | AESAN advises 3–4 legumes a week | **wrong** | AESAN 2022 (Summary and § 2.4.1.1): "at least 4 servings/week of legumes… working towards daily consumption". 2–4 was AESAN 2020; ≥ 3 is MEDAS. The minimum is **8 a fortnight**. |
| 3 | Fish in 13 of 28 | **hypothesis** (the owner's figure) | Measured over the reference: between 0 and 20 of 28 depending on the profile (the whole library); up to 19 in rotations. Nothing limits it today except `PROTEIN_RULES` (one protein, e.g. `merluza`, ≤ 3 a week), and "fish" is a dozen different proteins. |
| 4 | Pasta 5 and rice 5 passed the cap of 4 through `0081`'s "the bands needed it" | **confirmed as a mechanism; a hypothesis for v17** | Measured: in production-like rotations rice passes 4 in 58 of 280 plans (up to 9), and the pasta, rice and grain cap holds in 78% (100% over the whole library): with 19 dishes per meal, sometimes only the rice keeps the day in band. With accompaniments, 93 mains also carried a side of rice. A second route the code does not count: the **plain rice side** beside an Asian dish (`0079` Table 3) does not enter `STARCH_RULES`, which reads only the plate (`core/domain/Variety/Starch.ts:141`). |
| 5 | Polenta is not recognised as a grain | **wrong as stated** | `polenta` and `polenta-cocida` are in `FOOD_GROUP_SLUGS.grains` (`Cuisine.ts:93-94`, yield 4 in `Yield.ts:32`). "Polenta cremosa con ragú de ternera" (seed) reads as `grains`, 117 g dry per serving (measured). What is **not** in any group is `harina-de-maiz` (cornmeal, which is what polenta is). How to check it: read v17's dish's ingredients. |
| 6 | If the library does not have the dishes, they have to be asked of the generator | **partly** | The whole library has plenty for almost everything (§ 4.3). Specific cells are missing: light Spanish legume dinners (3), legume types (4 of 7), wholegrains at dinner (15 of 62 grain dishes). |
| 7 | The fish minimum only when the person does not say they dislike it | **confirmed, and it holds by construction** | The owner decided it in 017 (LOG, amendment of 2026-10-02). `dislikedLabels: ['pescado']` leaves the pool with no row of class `fish` (measured on `tres-comidas-proteina-alta`). But **it leaves the shellfish**: that profile ate "Gambas salteadas…" twice and "Alubias blancas con almejas". That is why the minimum counts only `fish`, and the maximum counts fish and shellfish together. |
| 8 | ≥ 0.3–0.4 g/kg of protein per main meal on muscle gain | **confirmed, and already met at lunch and dinner today** | Measured (`objetivo-alto-5-comidas`, 98 kg, 5 meals): lunch 0.64 g/kg on average (min. 0.49), dinner 0.54 (0.47), breakfast 0.41 (0.26), snacks 0.15–0.17. The gap is breakfast and snacks, not the mains. |

## What is there today

**How a dish is picked for a day.**

- A person's pool is the library filtered by safety, way of eating and "I don't like it"
  (`RecipeController.reusablePool`), trimmed by `rotatePool` to 19 dishes per meal with a
  `user:version` seed (`Rotation.ts:193-230`; `PlanGeneration.service.ts:162-175`), plus at least
  7 new dishes per meal from the model (`FRESH_DISHES_PER_SLOT`, `Rotation.ts:58`;
  `PlanGeneration.service.ts:193`). The rotation shuffles: **it does not look at groups**.
- `schedulePlan` (`core/domain/Scheduler/Scheduler.ts:641`) builds day by day. At each meal it
  filters by season, plate size and held rules (`underCap`, `Scheduler.ts:683-686`) and picks the
  one that best fits the four macros (`fitCost`, `Scheduler.ts:1144`), with a price for repeating a
  protein or a kind.
- Then: `improveDay` (`Scheduler.ts:2122`), `spreadAcrossDays` (`:2438`), `repairOutOfBand`
  (`:2669`) and `enforceDistinctDays` (`:2836`). The bands are judged first and the held rules
  afterwards, at `HELD_KIND_WEIGHT = 100` (`:499`).
- If a plan fails a band, `PlanGeneration` reschedules with the whole rotation and keeps the best
  (`wider_rotation`, `PlanGeneration.service.ts:369-403`, `0046`).

**Which group rules exist** (all of them count excesses, none counts minimums):

| Rule | Where | How |
|---|---|---|
| Pasta, rice and other grains ≤ 4 each, never on consecutive days | `STARCH_RULES`, `Starch.ts:108`; `0081`, `0082` | held |
| The same legume ≤ 3 | `LEGUME_RULES`, `Legume.ts:76`; `0082` | held (cap), with a price (consecutive days) |
| One protein ≤ 3 per week of mains, ≤ 1 a day | `PROTEIN_RULES`, `Protein.ts:78` | priced |
| The same snack ≤ 3 | `SNACK_RULES`, `Snack.ts:58` | priced |
| A dish ≤ 2 a fortnight | `VARIETY_RULES`, `Variety.ts:27` | forbidden (`canPlace`) |
| Rice, pasta, grains, potato and stewed legumes by meal and cuisine | `FAMILY_FIT`, `Cuisine.ts:242`; `0079` Table 2 | a filter |

**What does not exist:** no minimum of any group; no rule about fish as a group (there is one per
fish), meat, processed foods, eggs, vegetables, fruit, wholegrains; fibre is in the targets
(`FIBER_G_PER_1000_KCAL = 14`, `Nutrition.ts:26`) and in the prompt's brief, but `fitCost` does not
look at it (`Scheduler.ts:1144-1168`) and `PlanValidation` does not validate it. There is no sugars
column in `ingredients` (`packages/database/src/schemas/food.schema.ts:32-79`).

**What is in the prompt** (`apps/api/src/modules/ai/prompts/PoolPrompt.ts`, 4.6.0):
`GOAL_GUIDANCE` (`:511-522`) asks for "legumes, fish, whole grains over refined, little processed
food" **only** for `healthy_eating`; `spreadRules` (`:483-500`) limits every protein, legumes
included, to a quarter of the batch; dinner is "lighter… Not a stew" (`:566-567`). Nothing asks for
a specific group in a specific number.

**The evaluator measures something different from production.** `evaluate-plans.mjs` schedules over
`reusablePool(slots, context)` with no rotation (`evaluate-plans.mjs:449`): the whole library. With
that, a legume appears in plenty. Production sees 19 + 7 dishes per meal. For frequencies, the
evaluator needs a mode with rotation (phase 1).

## 1. The table

### 1.1 Frequencies per fortnight

For two main meals a day (28 in the fortnight). With another way of eating it scales like `kindCap`
(`Kinds.ts:21`): `ceil(figure × mains ÷ 28)`, at least 1 for the minimums that apply. "Serving"
per AESAN 2022 (general considerations, pp. 52-54).

| Group | Minimum | Maximum | Not on consecutive days | Source | Kind of rule |
|---|---|---|---|---|---|
| **Legumes** (≥ 25 g dry per dish, half a serving) | **8** (4/week) | — (each type ≤ 3, already `0082`) | the same type (already, priced) | AESAN 2022: "at least 4 servings/week… working towards daily consumption"; a serving is 50–60 g dry | **a new minimum**, held |
| **Fish** (class `fish`, ≥ 60 g) | **6** (3/week) | — | — | AESAN 2022: "3 or more servings/week of fish, prioritising oily fish"; a serving is 125–150 g | **a new minimum**, held |
| — of which, **oily** | **2** (1/week) | — | — | AESAN: "prioritising oily fish" (it gives no figure; 1 in 3 is this report's choice) | **a new minimum**, held |
| **Fish and shellfish** together | — | **8** (4/week) | — | no official source: a product choice to leave room for legumes and meat (the owner's request) | **a new maximum**, held |
| **Unprocessed meat** (≥ 50 g) | — | **6** (3/week) | — | AESAN 2022: "a maximum of 3 servings/week of meat, prioritising… poultry and rabbit"; a serving is 100–125 g | a new maximum, priced in phase 3, held afterwards if the measurement allows |
| — of which, **red** (beef, veal, pork, lamb, goat, game) | — | **4** (2/week) | **yes** | AESAN cites the sustainable pyramid (Serra-Majem 2020): "red meat… at most 2 servings/week"; WHO/IARC: group 2A | a new maximum, held |
| **Processed meat** (≥ 10 g, in **any** meal) | — | **2** (1/week) | **yes** | WHO/IARC: group 1, +18% of colorectal cancer per 50 g daily, with no known safe level; Serra-Majem: ≤ 1/week; AESAN: "minimising" | a new maximum, held — **a figure for the owner** (§ What I do not know) |
| **Eggs** | — | (8 eggs, 4/week) | — | AESAN 2022: "up to 4 eggs/week" | **measured only** (reason below) |
| **Pasta** / **rice** / **other grains** | — | **4** each | **yes** | `0081`, `0082` | already exists, held |
| **Potato** | — | — | — | AESAN: "moderate consumption" with no figure | measured only |
| **Vegetables** (plate + side) | **150 g in every main** (1 serving) | — | — | AESAN: "at least 3 servings/day of vegetables", 150–200 g | priced, through accompaniments |
| **Fruit** | **2 servings/day** | — | — | AESAN: "2-3 servings/day of fruit", 120–200 g | priced, through accompaniments |
| **Dairy** | — | 3 servings/day | — | AESAN: "a maximum consumption of 3 servings/day of dairy" | measured only |
| **Wholegrain cereal** | **half** the cereal (dry) | — | — | AESAN: "prioritising in every case whole grains and wholemeal products" | priced + data + prompt |
| **Fibre** | **25 g/day** (and never less than the current target) | — | — | EFSA 2010: "25 g/day… adequate for normal bowel function in adults" | priced (a day term) |

Three notes that make the table coherent:

- **AESAN's figures fit into 14 mains a week**: 4 of legume, 3 of fish, 3 of meat and 4 of egg add
  up to 14. That is not a coincidence and it is the reason for the maximums: with no maximum on
  fish and meat, the legume minimum has to evict something, and it does so against the macro fit.
- **A dish can count in two groups.** "Alubias con almejas" is legume and shellfish; "lentejas con
  chorizo" is legume and processed. Servings are counted, not exclusive dishes, the way AESAN
  counts.
- **Eggs: measure, do not impose yet.** AESAN's cap comes from replacing meat and from
  environmental impact, not from a safety limit (the report raises the earlier "2 to 4 times" to
  "up to 4 eggs"). Today 4–22 eggs a fortnight are served over the whole library and up to 31 in
  rotations (measured); `huevo` is in 111 recipes. For a vegetarian the egg is the protein that
  replaces meat and fish. Imposing 8 would cost breakfasts and days in band with no clear health
  reason. I recommend measuring it in phase 1 and letting the owner decide with the figure.

### 1.2 How each group is recognised

Everything is read from the catalogue, never from the dish's name or from what the model says
(`0004`). Grams **as served** (the recipe scaled to the day's servings, plus accompaniments),
because the frequency is of what the person eats. The thresholds are half an AESAN serving, so a
side does not count.

| Group | Rows | Threshold | Reuses |
|---|---|---|---|
| Legume | the 23 of `FOOD_GROUP_SLUGS.pulses` (`Cuisine.ts:130`) **plus** the light forms: `hummus`, `hummus-de-remolacha`, `garbanzos-tostados`, `edamame-*`, `soja-texturizada`, `tofu-*`, `tempeh`, `altramuces`, `frijoles-refritos`, `pasta-de-lentejas`, `pasta-de-garbanzos` | ≥ 25 g dry: cooked ÷ 2.5, tinned stews ÷ 4, hummus and tofu ÷ 4, tempeh ÷ 2 | `legumeKind` (`Legume.ts:50`) for the type. The light forms are how a legume reaches a Spanish dinner (`0062` § 2, `0079` Table 2) |
| Fish | class `fish` | ≥ 60 g (fish + shellfish) | `FoodClass` (`food.schema.ts:29`) |
| Oily fish | a new slug list: `salmon*`, `atun-*`, `bonito`, `caballa*`, `sardina*`, `boquerones`, `anchoas-*`, `jurel`, `melva-*`, `ventresca-de-atun`, `trucha*`, `palometa`, `pez-espada`, `salmonete`, `mojama` | oily weighs more than white and than shellfish on the plate | a new constant beside `KIND_BY_CLASS` (`Protein.ts:49`) |
| Shellfish | class `shellfish` | counts in the maximum, not in the minimum | `FoodClass` |
| White meat | class `meat`, without `pork`, slug of `pollo`, `pavo`, `conejo`, `codorniz`, `perdiz`, `pato` | ≥ 50 g | AESAN: "white meat is poultry and rabbit" |
| Red meat | the rest of `meat` (with `pork`) | ≥ 50 g | AESAN/WHO: "beef, veal, pork, lamb, horse and goat" |
| Processed meat | a new list: `bacon`, `butifarra`, `chorizo`, `fiambre-de-*`, `fuet`, `jamon-*`, `lacon`, `lomo-embuchado`, `morcilla`, `mortadela`, `panceta`, `salchich*`, `sobrasada`, the tins `cocido-madrileno-`, `fabada-` and `lentejas-con-chorizo-en-lata`, `croquetas-de-jamon-congeladas`, `nuggets-de-pollo-congelados` | ≥ 10 g, in any meal | WHO: "transformed through salting, curing, fermentation, smoking" |
| Egg | `huevo`, `huevo-de-codorniz` (not `clara-de-huevo`) | 55 g = 1 egg (AESAN: 53–63 g) | `KIND_BY_CLASS` reads `egg` |
| Pasta, rice, grains, potato | `dishGroups` and `starchBase` as they are (`Cuisine.ts:203`, `Starch.ts:74`) | 20 g dry / 100 g | **plus `harina-de-maiz` in `grains`** if phase 1 confirms it was v17's polenta — carefully: today it is in two breakfasts (arepas, pancakes), and `FAMILY_FIT` would take breakfast away from them |
| Wholegrain | a new list: `arroz-integral-*`, `arroz-salvaje-*`, `pasta-integral-*`, `quinoa-*`, `bulgur-*`, `trigo-sarraceno*`, `mijo*`, `espelta-en-grano`, `espelta-cocida`, `freekeh`, `amaranto`, `copos-de-avena`, `harina-de-avena`, `pan-integral`, `pan-de-molde-integral`, `wrap-integral` | the share of dry grams (`toDry`) over all the cereal | `Yield.ts` |
| Vegetables | category `produce` or `frozen` minus fresh fruit (`FRESH_FRUIT_SLUGS`), potato and frozen fruit; plus tinned tomato, pisto, roasted peppers | grams per main | `FRESH_FRUIT_SLUGS` (`MealFit.ts:162`) |
| Fruit | `FRESH_FRUIT_SLUGS` + `frutos-rojos-congelados` | 150 g = 1 serving | the same |
| Dairy | category `dairy` without butter, cream or ghee | milk 225 g, yoghurt 125 g, fresh cheese 100 g, cured 50 g | — |
| Added sugar (approximate) | `azucar-*`, `miel`, `sirope-*`, `mermelada-*`, `dulce-de-membrillo` | grams a day | there is no sugars column: it is an indicator, not the figure |

Measured over the reference's 436 lunch or dinner recipes: of 145 with a legume, 139 have ≥ 25 g
dry per serving and 119 have ≥ 40 g. The threshold changes almost nothing: the library's legume is
a real serving. What is missing is frequency.

## 2. By goal

### 2.1 How they are modelled today

Five goals (`GOAL_TYPES`, `core/entities/Profile/Profile.ts:49`): `weight_loss`, `maintenance`,
`muscle_gain`, `performance`, `healthy_eating`. Plus event days (`0043`, `dayTargets`). The goal
changes **three** things in code:

- the energy (a bounded deficit or surplus, `Nutrition.ts:296-330`);
- the protein per kg (1.4–1.9 g/kg, over reference weight except for the training goals,
  `Nutrition.ts:23`, `0076`);
- one line of the prompt (`GOAL_GUIDANCE`).

The split between meals is the same for everybody: each meal receives its share of **energy and of
protein in the same proportion** (`slotBudgets`, `Scheduler.ts:1002`). Nothing else depends on the
goal: not the vegetables, not the fibre, not the dinner's density, not the processed food.

### 2.2 Measured today (whole library, accompaniments on)

| Profile (goal) | Protein g/kg: breakfast · lunch · dinner · snacks (min.) | kcal/g lunch · dinner | Fibre g/day (current target) |
|---|---|---|---|
| objetivo-bajo-3-comidas (loss) | 0.42 (0.26) · 0.77 (0.66) · 0.64 (0.47) · — | 1.10 · 0.97 | 20 (17) |
| objetivo-alto-5-comidas (muscle) | 0.41 (0.26) · 0.64 (0.49) · 0.54 (0.47) · 0.15–0.17 (0.09) | 1.56 · 1.40 | 73 (58) |
| imc-alto-2-comidas (loss) | — · 0.65 (0.53) · 0.60 (0.51) · 0.11 | 1.37 · 1.33 | 41 (30) |
| tres-comidas-proteina-alta (loss) | — · 0.72 (0.55) · 0.62 (0.45) · 0.17 | 1.34 · 1.19 | 37 (32) |
| patron-sin-gluten (loss) | 0.42 (0.19) · 0.58 (0.41) · 0.64 (0.40) · 0.16 | 1.25 · 0.93 | 29 (22) |
| quincena-con-evento (performance) | 0.43 (0.29) · 0.69 (0.55) · 0.49 (0.33) · 0.18 | 1.35 · 1.19 | 39 (30) |
| the other 8 (maintenance, healthy eating, patterns) | 0.27–0.36 · 0.46–0.58 · 0.41–0.50 · 0.12–0.18 | 1.27–1.46 · 1.10–1.34 | 35–52 |

Readings:

- **Protein at lunch and dinner already passes 0.4 g/kg in every profile**, on average; the
  minimum, from 0.28 to 0.66. It is a consequence of the proportional split. The gap is breakfast
  (minimums of 0.17–0.29) and snacks (0.07–0.18).
- **Dinner is already less dense than lunch** in every profile (0.04–0.33 kcal/g less), and every
  main sits between 0.9 and 1.6 kcal/g, which is low density. It is not a gap.
- **Fibre exceeds the current target in every profile**, but the current target (14 g per 1,000
  kcal) leaves somebody eating 1,200 kcal at 17 g. The weight-loss person with the least energy
  eats 20 g a day (measured), below EFSA's 25 g.

### 2.3 What changes with each goal

Besides energy and macros, and besides § 1.1's table, which applies to everybody:

| | Fat loss | Muscle gain | Performance | Maintenance / healthy eating |
|---|---|---|---|---|
| **Protein per sitting** | ≥ 0.3 g/kg at lunch and dinner (already met; held so it is not lost) | ≥ 0.4 g/kg in at least 3 sittings; ≥ 0.25 g/kg in each sitting if they eat 4 or more (ISSN: 0.25 g/kg or 20–40 g per sitting, every 3–4 h; Schoenfeld and Aragon: 0.4 g/kg in ≥ 4 sittings) | ≥ 0.3 g/kg at lunch and dinner; after training, carbohydrate and protein together (ACSM: 0.3 g/kg every 3–5 h) | ≥ 0.25 g/kg at breakfast, lunch and dinner |
| **The day's protein floor** | 1.8 g/kg of reference weight (already; ISSN position 3 goes up to 2.3–3.1 in a deficit with resistance training: I do not propose it without knowing whether they train) | 1.9 g/kg (already; ISSN 1.4–2.0) | 1.8 g/kg (already) | 1.4–1.6 (already; EFSA PRI 0.83) |
| **Fibre** | ≥ 25 g even when energy is low | ≥ 25 g | ≥ 25 g, **except** the event day and the one before (digestion) | ≥ 25 g |
| **Volume** | ≥ 150 g of vegetables in **every** main | ≥ 150 g in 80% | the same | ≥ 150 g in 80% |
| **Dinner density** | measured; not imposed (it is already low) | — | — | — |
| **Legumes** | 8 | 8 | 8, not counting the event day or the one before | 8 |
| **Processed and sugar** | the same for everybody (the table); sugar, prompt only | the same | the same | the same |

**What the scheduler can enforce and what only the prompt can:**

- **The scheduler (code, checkable):** every frequency in the table; protein per sitting (with
  per-meal protein weights different from the energy ones in `slotBudgets`, and the same proportion
  in the prompt's `briefFor`); fibre as a day term; vegetables and fruit by choosing an
  accompaniment; the preference for wholegrain; excluding legumes on event days.
- **Prompt only (not measurable from the catalogue):** frying versus roasting, cream sauces
  (`0079` already measured that they are not recognised by name), free sugar beyond the sugar and
  honey rows, salt, digestibility near training, "a light dinner" as a way of cooking.

## 3. How it is enforced

### 3.1 Maximums: the same mechanism as `0081`/`0082`

Fish and shellfish ≤ 8, red meat ≤ 4 and never on consecutive days, processed ≤ 2 and never on
consecutive days: each is one more `KindCheck` in `KindRules.held` (`Scheduler.ts:1219-1226`), with
a per-dish index like `legumeIndex`. They are held in the same four places (first choice,
`improveDay`, `repairOutOfBand`, `pickReplacement`) and only the bands outrank them. No new
mechanism is needed. Two details:

- **Processed foods count in every meal**, not only the mains: ham is in breakfasts and snacks
  (today 0–9 a fortnight over the whole library, measured). The `KindCheck` with no `slots`.
- **Total meat ≤ 6, priced first.** It is the rule furthest from today (it holds in 25–38% of
  plans, measured) and the one that clashes most with high-protein goals. First priced
  (`PROTEIN_SWAP_WEIGHT`) and measured; held only if the measurement loses no days.

### 3.2 Minimums: new, and in two places

A minimum cannot be judged meal by meal: day 3 does not know whether the fortnight will end short.
`kindExcess` and `kindCrowded` (`Kinds.ts:31`, `:80`) are no use. I propose:

1. **A guarantee in the pool** (`rotatePool`). Before shuffling the rest, the rotation reserves per
   group the dishes the table needs, if the person has them in their filtered library: legumes at
   lunch (≥ 6 dishes of ≥ 3 types), a light legume at dinner (≥ 2 if they exist), fish (≥ 6, ≥ 2
   oily) and wholegrain. Zero calls, deterministic with the same seed. Without this, a minimum is a
   lottery (§ 4.2).
2. **A reservation at build time.** Before the day loop (`Scheduler.ts:659`), a calendar marks
   which meals must carry each group: the 8 legumes spread out (no consecutive types, at lunch if
   the cuisine does not allow dinner, `FAMILY_FIT`), the 6 fish. In a marked meal, `underCap`
   narrows to the group's dishes that fit (`fitsPlate`) and do not break a held rule; if there is
   none, the mark is ignored. `improveDay` charges `HELD_KIND_WEIGHT` for swapping a marked group's
   dish for one that is not.
3. **A final pass, `meetFloors`**, after `repairOutOfBand` and before `enforceDistinctDays`: if a
   group ends below its effective minimum, it tries swapping a main that is not of the group for
   one that is, only if the day stays the same or better on bands and breaks no held rule.
   Deterministic, bounded (at most 8 × 28 attempts per group with its short list). It is the
   guarantee; the calendar means it almost never works.
4. **`pickReplacement`** (the swap the person asks for): if removing the current dish leaves the
   fortnight below a minimum, order the candidates of the same group first, **after** `pastCap` and
   **before** the fit. What the person asked for (`axisFilter`) still rules.
5. **The event rebuild** (`dayIndexes`, `0044`) counts the meals already placed (`placed`), as it
   already does with held rules.

**A group's effective minimum** is

`min(the table's figure × mains ÷ 28, what this person's pool can give)`

where "what it can give" adds, per dish of the group that fits in some main, up to 2 appearances
(`VARIETY_RULES`), and per legume type up to 3 (`LEGUME_RULES`). That way minimums and caps never
contradict each other: with 2 legume types the minimum is 6, not 8.

### 3.3 Conflicts, and who wins

| Conflict | Winner | How |
|---|---|---|
| Allergy, intolerance, way of eating | **always the restriction** | they filter the pool first; the effective minimum is 0 if nothing of the group is left. Without reading the allergy in the rule |
| "I don't like fish" | **the person** (owner, 017) | the same: the pool has no class `fish` → minimum 0. An "I don't like salmon" leaves the minimum with the other fish |
| Vegetarian, vegan | the way of eating | fish and meat do not apply; legumes 8 (today already 14–22, measured) |
| Pescatarian | the way of eating | meat does not apply; the fish maximum rises to 12 (it takes the meat's place) |
| No fish (for whatever reason) | — | the meat maximum rises from 6 to 12 (white first; red stays ≤ 4), or the high protein is not reached (`tres-comidas-proteina-alta`: 7 red + 9 white today) |
| `traditional_spanish` | the way of eating | Spanish legumes are not eaten at dinner (`0079`); the 8 go into 14 lunches. It is a real Spanish week (4 of 7 lunches). It does not clash with pasta or rice, which are maximums: 6 lunches are left for everything else. The cost is variety at lunch, and the real gap is dinners (0 legumes, § 4.3) |
| The bands (±5%) | **the bands** (owner, 017) | as in `0081`: if a day only enters band by breaking a minimum or a maximum, it breaks it. The evaluator counts it |
| A minimum against a cap of the same group | neither: they cannot clash | the effective minimum is computed with the caps |
| The legume minimum against the starch cap | — | a legume is its own base (`StarchBase 'legume'`), it does not consume the pasta or rice cap |
| Event days | the event | the loaded day and the one before do not count towards the legume minimum, and legumes are priced on those days |

## 4. Measurement

### 4.1 The balance score

For the evaluator (`evaluate-plans.mjs`), per profile and per goal: every rule in the table that
**applies** to that person is met or not; the score is the fraction met. It is not weighted: an
easy rule does not hide a hard one. The twelve rules I measured: legumes ≥ 8; fish ≥ 6; oily ≥ 2;
fish and shellfish ≤ 8; meat ≤ 6 (12 with no fish); red ≤ 4 and no consecutive days; processed ≤ 2
and no consecutive days; pasta, rice and grains ≤ 4; ≥ 150 g of vegetables in 80% of the mains;
fruit ≥ 2 servings a day; wholegrain ≥ 50%; fibre ≥ 25 g. Eggs, potato, dairy, approximate sugar,
protein per sitting and density are reported without being scored.

The recognition and the thresholds are exactly § 1.2's, so that phase 1 reproduces these numbers.

### 4.2 Today, over the reference library

**The whole library** (what the evaluator measures today), 14 profiles, 196/196 days in band in
both runs (measured):

| Rule | Off | On (accompaniments) |
|---|---|---|
| Legumes ≥ 8 | 12/14 | 12/14 |
| Fish ≥ 6 (12 apply) | 10/12 | 10/12 |
| Oily ≥ 2 | 11/12 | 11/12 |
| Fish and shellfish ≤ 8 | 7/14 | 9/14 |
| Meat ≤ 6 (13 apply) | 5/13 | 4/13 |
| Red ≤ 4, no consecutive | 5/13 | 5/13 |
| Processed ≤ 2, no consecutive | 4/13 | 1/13 |
| Pasta, rice, grains ≤ 4 | 14/14 | 14/14 |
| Vegetables ≥ 150 g in 80% | 0/14 | 2/14 |
| Fruit ≥ 2/day | 0/14 | 0/14 |
| Wholegrain ≥ 50% | 1/14 | 1/14 |
| Fibre ≥ 25 g | 13/14 | 13/14 |

Ranges per profile (off; on is very similar): legumes 6–20 of 28, fish 0–18, oily 0–5, red 0–6,
white 0–10, processed 0–9 across the fortnight, eggs 4.6–21.7, potato 0–14, vegetables 129–250 g
per main on average, fruit 0.1–0.7 servings a day (0.2–1.1 with accompaniments), wholegrain 9–56%
in mains, fibre 21–75 g.

**A production-like rotation** (measured): `rotatePool` to 19 dishes per meal with 10 seeds per
profile, and the `wider_rotation` retry of `PlanGeneration.service.ts:369-403` when a band fails;
without the model's fresh third, which cannot be measured without calling it. 14 profiles × 10
seeds × off/on = 280 plans.

- **Days in band:** 1,959/1,960 off and 1,960/1,960 on. But the retry was needed in 111 of 140
  plans off and 42 of 140 on: with no new dishes, a rotation of 19 alone fails a band most of the
  time. Every rule added pushes more plans into that retry.
- **Rules met, of the 280:**

| Rule | Met | | Rule | Met |
|---|---|---|---|---|
| Legumes ≥ 8 | 206/280 (74%) | | Processed ≤ 2 | 72/260 (28%) |
| Fish ≥ 6 | 200/240 (83%) | | Pasta, rice, grains ≤ 4 | 217/280 (78%) |
| Oily ≥ 2 | 202/240 (84%) | | Vegetables ≥ 150 g in 80% | 52/280 (19%) |
| Fish and shellfish ≤ 8 | 151/280 (54%) | | Fruit ≥ 2/day | 1/280 (0%) |
| Meat ≤ 6 | 66/260 (25%) | | Wholegrain ≥ 50% | 20/280 (7%) |
| Red ≤ 4, no consecutive | 109/260 (42%) | | Fibre ≥ 25 g | 260/280 (93%) |

- **Per profile, accompaniments on** (minimum / median / maximum of the 10 seeds):

| Profile (goal) | Legumes | Fish | Processed | Score (median) |
|---|---|---|---|---|
| objetivo-bajo-3-comidas (loss) | 4 / 5 / 9 | 14 / 17 / 19 | 2 / 4 / 7 | 42% |
| objetivo-alto-5-comidas (muscle) | 12 / 13 / 14 | 4 / 5 / 5 | 5 / 7 / 8 | 50% |
| alergia-lacteos (maintenance) | 6 / 8 / 13 | 7 / 9 / 19 | 4 / 5 / 11 | 42% |
| patron-vegetariano (healthy eating) | 14 / 16 / 22 | — | — | 57% |
| quincena-con-evento (performance) | 4 / 8 / 11 | 3 / 8 / 13 | 1 / 4 / 7 | 42% |
| alergia-personalizada (maintenance) | 3 / 7 / 15 | 7 / 9 / 14 | 0 / 2 / 4 | 50% |
| alergia-personalizada-no-resuelta | 4 / 9 / 12 | 6 / 10 / 14 | 3 / 4 / 6 | 50% |
| patron-halal (healthy eating) | 7 / 8 / 14 | 3 / 7 / 11 | 0 / 2 / 5 | 58% |
| patron-kosher (healthy eating) | 8 / 11 / 12 | 4 / 5 / 11 | 0 / 2 / 3 | 58% |
| patron-sin-gluten (loss) | 5 / 7 / 14 | 6 / 19 / 21 | 1 / 3 / 5 | 50% |
| patron-sin-lactosa (maintenance) | 6 / 7 / 11 | 2 / 9 / 12 | 2 / 4 / 7 | 42% |
| imc-alto-2-comidas (loss) | 6 / 8 / 11 | 4 / 10 / 18 | 0 / 2 / 5 | 50% |
| patron-tradicional-espanola (maintenance) | **2 / 5 / 8** | 5 / 9 / 16 | 2 / 5 / 10 | 42% |
| tres-comidas-proteina-alta (loss, no fish) | 8 / 10 / 16 | 0 / 2 / 3 (shellfish) | 0 / 3 / 7 | 40% |

- **By goal** (the mean of the medians, on): loss 45%, muscle 50%, maintenance 45%, healthy eating
  58%, performance 42%. Off, the same except muscle (58%, a single profile). No goal is different
  from the rest today: the plan does not know what the person is eating for beyond their numbers.
- **The rotation's supply** (lunches with a legume in the pool of 19, off): between 3 and 16 dishes
  depending on profile and seed, of **1 to 4 types**. In 35 of the 140 rotations there were only 2
  types or fewer, and with the cap of 3 per type that gives 6 legumes at most: the minimum of 8 is
  impossible before the scheduler picks anything. That is the reason for phase 2.

Readings:

- **Fish is in surplus, not short**, in the weight-loss profiles: 17 and 19 of 28 as a median
  (`objetivo-bajo-3-comidas`, `patron-sin-gluten`). White fish is the lean protein that best fits a
  low-fat target. The maximum of 8 will cost them fit: it is where phase 3 can lose days.
- **What is met least is not the legumes**: fruit (0%), wholegrain (7%), vegetables (19%), meat
  (25%) and processed (28%).
- **Eggs:** from 0.2 to 31 eggs a fortnight depending on profile and seed; medians from 3.6 to 24
  (the vegetarian, 24). The median passes AESAN's cap (8) in 6 of 14 profiles.

### 4.3 Where the library is thin

Supply per person, whole library, dishes meeting the threshold (measured):

| | Omnivore | `traditional_spanish` | Vegetarian | Gluten-free | Dislikes fish |
|---|---|---|---|---|---|
| Lunches with a legume (types) | 112 (4) | 56 (4) | 52 (4) | 87 (4) | 84 (4) |
| Dinners with a legume | 37: Spanish **3**, Asian 19, Latin 15 | **0** | 47 | 27: Spanish 3 | 35: Spanish 3 |
| Lunches / dinners with fish | 107 / 64 | 85 / 49 | — | 93 / 57 | 16 / 10 (shellfish) |
| — oily | 37 / 24 | 28 / 17 | — | 30 / 21 | 0 |
| Wholegrain cereal dishes, lunch / dinner | 79 of 173 / 15 of 62 | 34 of 81 / **1 of 10** | 15 of 35 / 9 of 23 | 41 of 93 / 9 of 36 | 63 of 134 / 15 of 55 |

The thin cells, in order of importance:

1. **Light Spanish legume dinners: 3 dishes.** Without them the 8 legumes all fall at lunch, and
   the legume dinner is provided by Asian or Latin dishes somebody who eats Spanish food does not
   expect. For `traditional_spanish` there are none (and `0077` takes away its hummus).
2. **Legume types: 4 of 7.** Chickpeas, lentils, white beans and other beans. There are no broad
   beans, dried peas or whole soya in any lunch dish. With the cap of 3 per type, 4 types give 12 at
   most: enough for 8, tight if the rotation only pulls out 2 or 3.
3. **Wholegrain cereal at dinner:** 15 of 62 for an omnivore, 1 of 10 for `traditional_spanish`.
4. **Fruit:** it is not a dish problem. Fruit comes in as a dessert (an accompaniment) or in
   breakfasts and snacks; with accompaniments on it rises from 0.1–0.7 to 0.2–1.1 servings a day and
   is still far from 2. It belongs to `0079` Table 3 and to the accompaniment scheduler.

### 4.4 Do dishes have to be asked of the generator?

**Yes, but few and inside what is already asked.** The generator already receives requests for 3, 3
and 1 dishes per meal in parallel (`DISHES_PER_REQUEST`, `PoolBuilder.service.ts:45`; `0064`), and
`PoolBuilder` knows the rotated pool (`reusable`) before it asks. It can count each group's supply
and add to that meal's request a line like:

> "Of these 3 dishes, 1 has a legume as its base, at half a serving or more (25 g dry or 60 g
> cooked per serving), of a type other than: chickpeas, lentils."

For the Spanish dinner: "1 light legume dinner: a warm salad, a soup or a purée, never a stew" (the
same shape already asked of vegetarians, `PLANT_BASED_DINNER`, `PoolPrompt.ts:569`). For
wholegrain: "the cereal, wholegrain".

- **Cost in calls: zero.** They are the same 3 + 3 + 1 requests. **Estimated**: at ~$0.012 a
  request (`0064`, measured 2026-09-26) a separate "fill the gaps" call would be +$0.012 a plan, a
  +10% on $0.10–0.15; it is not needed.
- **Cost in prompt:** one or two lines per meal, some 40–80 tokens (**estimated**, 6 per row like
  `catalogue-by-meal.mjs`), against PRD 005's 55% budget. It has to be measured with
  `catalogue-by-meal.mjs` in the phase; today I do not know the exact margin (**unknown**).
- **Risk:** the line clashes with `spreadRules`, which limits every protein to a quarter of the
  batch (`PoolPrompt.ts:488`): with 7 dishes, 2 of legume. It is compatible.
- **Cumulative effect:** every new dish enters the library (`0013`). Asking for 1–2 legume or light
  dinner dishes a plan grows exactly the thin cells.

What is **not** asked of the generator: fruit (accompaniments), vegetables (accompaniments and
`COMPOSITION_RULES`), minimums (the scheduler decides those, never the model, `0004`).

## 5. The plan

Each phase ships on its own, with its metric and its signal to stop. All of them: 196/196 days in
band off and on over the reference library, 0 allergens, `schedulePlan` time within +10% of 017's
phase 4.

**Phase 1 — Measure (changing no plan).**
- The evaluator gains: § 1.2's recognition in `core` (pure functions with their tests:
  `isProcessedMeat`, `isOilyFish`, `legumeDryGrams`, `isWholeGrain`…), § 4.1's score per profile and
  per goal, protein per sitting, density per meal, and a `--rotate <seeds>` mode that schedules like
  production (a rotation of 19 and the `wider_rotation` retry).
- The lead reads v17's polenta dish (a read-only query against production, with the owner's yes) to
  decide on `harina-de-maiz`.
- Metric: § 4.2's numbers reproduced with the repository's script. Stop: if the repository's score
  differs from this report's by more than one rule per profile, the recognition is reviewed before
  going on.

**Phase 2 — The rotation guarantees the groups (zero calls).**
- `rotatePool` reserves dishes per group (§ 3.2, point 1) when the filtered library has them. The
  rest, shuffled as today.
- Metric: with `--rotate 10`, a minimum supply of lunches with a legume ≥ 6 of ≥ 3 types and of
  fish ≥ 6 in every profile that has it in its library. Stop: if any day in band is lost in
  `--rotate` against phase 1.

**Phase 3 — The maximums (the same mechanism as `0081`/`0082`).**
- Fish and shellfish ≤ 8, red ≤ 4 with no consecutive days, processed ≤ 2 with no consecutive days:
  held. Total meat ≤ 6 (12 with no fish): priced.
- Metric: profiles above each maximum in `--rotate 10`, at zero except where the bands ask for it.
  Stop: one day lost over the whole library.

**Phase 4 — The minimums.**
- The effective minimum, the reservation calendar, `meetFloors`, `pickReplacement` (§ 3.2). Legumes
  8, fish 6, oily 2.
- Metric: legumes ≥ the effective minimum in 100% of the `--rotate 10` runs, the same for fish.
  Stop: time > +10%, or one day lost.
- Decision: a new record (`0084`) extending `0082` with the minimums.

**Phase 5 — Vegetables, fruit, fibre and wholegrain (accompaniments).**
- With accompaniments on: a price per main with < 150 g of vegetables and no vegetable side; a
  fruit dessert preferred up to 2 servings a day; fibre ≥ 25 g as a day term; wholemeal bread
  preferred over white in the side. The fibre target = max(14 g per 1,000 kcal, 25 g).
- Metric: § 4.1's vegetable, fruit and fibre rules. Stop: one day lost; or if the fruit only rises
  by breaking the carbohydrate, it is left at whatever it gives and that is said.

**Phase 6 — Protein per sitting according to the goal.**
- Per-meal protein weights, different from the energy ones, for `muscle_gain` (and the 0.25 g/kg
  per sitting minimum for the rest); `briefFor` uses them too, in the same prompt version.
- Metric: sittings ≥ 0.4 g/kg in `objetivo-alto-5-comidas`. Stop: if snacks stop existing in the
  library at that protein (they are asked of the generator in phase 7).

**Phase 7 — The generator fills the gaps (zero extra calls).**
- Per-group lines in the existing requests, only when that person's supply is below what the
  calendar needs (§ 4.4). `GOAL_GUIDANCE`: legumes, oily fish and wholegrain for every goal, not
  only `healthy_eating`. `PROMPT_VERSION` 4.7.0.
- Metric: `catalogue-by-meal.mjs` ≤ 55%; in a paid sample (the number and cost set by the lead and
  approved by the owner), ≥ 1 dish of the requested group per plan. Stop: if the prompt passes 55%.

## Requirements

- **Code:** `core/domain/Variety` (recognition, new held rules, minimums), `core/domain/Scheduler`
  (the calendar, `meetFloors`, protein weights), `Rotation`, the evaluator, `PoolBuilder` and
  `PoolPrompt` (phase 7).
- **Data:** no migration. Two new lists in code (processed, oily fish, wholegrain). If phase 1
  confirms it, `harina-de-maiz` in `grains`.
- **Infrastructure and money:** zero, except phase 7's paid sample (**estimated**: 10–20 requests
  at ~$0.012 = $0.12–0.24), which the owner decides.
- **The owner's time:** the three decisions below, and reviewing phase 4's record.
- **The owner's decisions:**
  1. Processed: ≤ 2 a fortnight (WHO and the pyramid AESAN cites) or ≤ 4 (more tolerant of the
     breakfast ham).
  2. Meat ≤ 6 a fortnight (AESAN): held or priced only? It is the rule furthest from today.
  3. Eggs: measure only, or a cap of 8 a fortnight except for vegetarians?

## Risks

1. **Fewer days in band (nutritional safety, everybody).** Every held rule takes options away from
   the fit. Likely with small pools: in rotations without the fresh third, days in band already
   fall (§ 4.2). It shows in the evaluator; it is undone by lowering the rule from held to priced.
   Mitigation: the bands rule, as in `0081`.
2. **Minimums that force somebody to eat what they do not want (trust).** If the minimum read the
   preference instead of the pool, a mistake would serve fish to somebody who does not want it.
   That is why it is computed over the filtered pool: impossible by construction. A test: a profile
   with no fish never has a fish minimum.
3. **Shellfish is not removed by "I don't like fish" (expectation).** Measured: it does serve
   prawns. It is linguistically correct ("pescado" is not "marisco"), but the person may expect
   otherwise. It shows in feedback; the owner decides (it could be a suggestion in the preferences
   form).
4. **Generation time.** `meetFloors` adds a pass. Likely +3–10% (**estimated**, by analogy with
   `repairOutOfBand`). It shows in the evaluator's `ms`; the short list is bounded.
5. **Legumes on event days (performance).** Mitigated by § 3.3's exclusion.
6. **Neon quota: none.** Everything is measured locally; the only production read is v17's dish, one
   query.

## Cost and effort

- Phase 1: 1–2 agent-days (**estimated**; the evaluator already has nearly everything).
- Phases 2–4: 3–6 days (the calendar and `meetFloors` are the big ones; it depends on how many
  passes have to be touched not to undo a minimum).
- Phases 5–6: 2–4 days.
- Phase 7: 1–2 days and the paid sample.
- Money: €0 in phases 1–6; ~$0.1–0.3 in phase 7 (**estimated**).

## What I do not know

- **How many legumes and fish the model's fresh third brings.** It cannot be measured without
  calling the model. My rotations do not include it, and so they underestimate the real supply
  (**unknown**).
- **v17's polenta dish**: whether it is `harina-de-maiz` or `polenta-cocida` below 80 g.
- **Whether accompaniments are on in production** (`SettingsController.accompaniments`). It changes
  the fruit and vegetables measured.
- **The prompt's exact margin against 55%** with the new lines: `catalogue-by-meal.mjs`.
- **Whether the person does resistance training**: the ISSN asks for 2.3–3.1 g/kg in a deficit with
  resistance training; NutrIA does not ask. I do not propose it without that answer.
- **The owner's three figures** (processed, meat, eggs).

## Sources

Read on 2026-10-03.

- **AESAN**, Scientific Committee (2022). *Report… on sustainable dietary recommendations and
  physical activity recommendations for the Spanish population*. Summary: vegetables ≥ 3/day, fruit
  2–3/day, potato "moderate consumption", cereals 3–6/day "prioritising in every case whole
  grains", legumes "at least 4 servings/week… working towards daily consumption", fish "3 or more
  servings/week… prioritising oily fish", "up to 4 eggs/week", dairy "a maximum consumption of 3
  servings/day", meat "a maximum of 3 servings/week… prioritising… poultry and rabbit and
  minimising… processed meat". Definitions of red, white and processed meat (§ 2.4.2.4). Servings
  (general considerations): vegetables 150–200 g, fruit 120–200 g, potato 150–200 g, bread 40–60 g,
  pasta or rice 60–80 g dry, legumes 50–60 g dry, fish 125–150 g, egg 53–63 g, meat 100–125 g, milk
  200–250 ml, yoghurt 125 g, fresh cheese 85–125 g, cured 40–60 g. It cites the sustainable
  Mediterranean diet pyramid (Serra-Majem et al., 2020): red meat ≤ 2/week, processed ≤ 1/week.
  https://riojasalud.es/files/content/ciudadanos/escuela-salud/cuida-tu-salud/alimentacion/profesionales/2022_AESAN_INFORME_recomend_dieteticas_sostenibles_AF.pdf
- **EFSA**, NDA Panel (2010), DRVs for carbohydrates and fibre: "A daily intake of 25 grams of
  dietary fibre is adequate for normal bowel function in adults"; carbohydrates 45–60% of energy.
  https://www.efsa.europa.eu/en/press/news/nda100326
- **ISSN**, Jäger R. et al. (2017), *Position stand: protein and exercise*, JISSN 14:20. Position 2:
  1.4–2.0 g/kg/day; position 3: 2.3–3.1 g/kg/day when hypocaloric with resistance training;
  position 5: 0.25 g/kg or 20–40 g per sitting; position 7: "every 3–4 h".
  https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/
- **Schoenfeld B. J., Aragon A. A.** (2018), *How much protein can the body use in a single meal for
  muscle-building?*, JISSN 15:10: 0.4 g/kg per sitting across ≥ 4 sittings for 1.6 g/kg/day; up to
  0.55 g/kg for 2.2. https://pmc.ncbi.nlm.nih.gov/articles/PMC5828430/
- **ACSM, Academy of Nutrition and Dietetics, Dietitians of Canada** (2016), *Nutrition and Athletic
  Performance*: protein 1.2–2.0 g/kg/day; "0.3 g/kg BW after key exercise sessions and every 3 to 5
  hours over multiple meals".
  https://www.dietitians.ca/DietitiansOfCanada/media/Documents/Resources/noap-position-paper.pdf
- **WHO / IARC** (26 October 2015), press release 240: processed meat group 1, red meat group 2A;
  "each 50 gram portion of processed meat eaten daily increases the risk of colorectal cancer by
  18%". https://www.iarc.who.int/wp-content/uploads/2018/07/pr240_E.pdf ·
  WHO's Q&A: the definitions, and "the data available for evaluation did not permit a conclusion…
  about whether a safe level exists".
  https://www.who.int/news-room/questions-and-answers/item/cancer-carcinogenicity-of-the-consumption-of-red-meat-and-processed-meat

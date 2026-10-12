# 0009 — More accompaniments: the first batch of 42

> **Purpose**: the `architect` agent's draft for phase 1 of project 018 (more accompaniments).
> It holds 42 new accompaniments, each ready to paste into `core/domain/Accompaniment` and into
> the web dictionary, with their macros computed from the catalogue. It also holds the PRD
> premises the code does not support and what the catalogue is missing. The lead accepts or
> rejects each entry and notes it in the project's LOG.
> **Audience**: the owner, the lead and the agents of phases 2 and 3. **Committed**: yes.
> **Maintained by**: the `architect` agent. Once merged it is not edited; a later review is a
> new report.
>
> **Base**: branch `agent/plan-018/lead-018` at `d99b4e82`, which is `main` with 017's phase 2
> (#202) and 018's plan.
>
> **Numbers**: each carries its label: **measured** (where), **estimated** (with the
> hypothesis) or **unknown**. The entries' macros were computed with a script that reads the
> seed's rows (`packages/database/src/seed/ingredients/*.ts`). It sums like `composeMacros`
> (`core/domain/Composition/Composition.ts:18`) and rounds to a tenth like `round`. They are
> the figures the code will give, not an estimate.
>
> **Measurement**: there was no model call and no Neon read. The only external service was
> USDA FoodData Central's public API: three searches (breadsticks, melba toast and green
> pepper), of which one is used (`picos-de-pan`). "In the catalogue" means in the seed
> (`packages/database/src/seed/ingredients/`), not in a database.

## Verdict

**Yes, on conditions.** There are 42 entries ready:
- 21 of the Spanish family;
- 4 Asian, 6 Latin American and 5 Arab;
- 6 desserts for every family.

All of them use rows that are already in the catalogue, and all those rows are USDA except
one: `picos-de-pan` is BEDCA and is conditional. **No slug is missing.** No Spanish entry
carries a row `traditional_spanish` excludes. Every preparation line names the exact oil in its
portion.

**The lead's decision (2026-10-03, delegated by the owner):** accompaniments stay at lunch and
dinner, by design (`0079`: they fill the large main meals). The "at least 5 for breakfast"
goal leaves the PRD. This report already applies that:
- there is no breakfast-only entry. I withdrew `tostada-con-aceite` and `avellanas` from the
  first draft;
- those two slots go to the shortest family: the Latin vegetables gain `curtido` and
  `ensalada-de-aguacate`;
- an entry carries breakfast among its meals only if it is also realistic at lunch and dinner,
  like today's bread and fruit. There are 9.

**A finding on the side:** the scheduler never serves accompaniments at breakfast
(`Scheduler.ts:272` and `:774`, `MAIN_SLOTS` in `Variety.ts:35`). That is why today's four
breakfast-only entries (`nueces`, `almendras`, `queso-de-burgos`, `requeson`) reach no plan.
Whether they are removed or kept is the lead's; 018 does not touch them.

The conditions:

1. **`schedulePlan`'s time is at risk.** The number of sets the scheduler prices per dish, meal
   and day in the Spanish family goes from 410 to 2,666 on average, ×6.5 (measured by
   combinatorics, without each person's filters; see § Risks). The PRD asks for no more than
   +10%. It has to be measured at the start of phase 3, with a signal to stop and a remedy
   already thought through.
2. **More entries do not guarantee more variety.** The scheduler picks the set that best closes
   the macros and breaks ties by the table's order. There is no cost at all for repeating an
   accompaniment (`rankedSets`, `Scheduler.ts:298`). That distinct accompaniments per fortnight
   rise is a **hypothesis** phase 3 measures. If they do not, a repetition rule is missing, and
   that is a scheduler change.
3. **`picos-de-pan` depends on re-sourcing its row** from BEDCA to USDA (FDC 174929). That is
   an `UPDATE` of a row that already exists, not phase 2's `INSERT … ON CONFLICT DO NOTHING`.
   My recommendation: the entry goes in only when the pending task of re-sourcing the 14 BEDCA
   rows does. Otherwise it stays out of this batch.
4. **`espinacas-a-la-catalana` carries 5 g of pine nuts at lunch and dinner.** The owner's
   answer 7 in `0079` says nuts as an accompaniment are breakfast-only. I read that as being
   about a nut served *as* an accompaniment, not about a vegetable's garnish. I recommend
   accepting it: it is the tree-nut case phase 3 needs at lunch and dinner. But it clashes with
   the letter of that answer, so I flag it.
5. **The two broths do not go in until their rows declare celery.** `caldo-de-pollo` and
   `caldo-de-verduras` have no allergen at all in the seed (`starter.ts:1060`, `:1071`).
   `pastilla-de-caldo-de-verduras` and `sopa-de-verduras-envasada`, by contrast, do carry "may
   contain celery". A Spanish carton broth nearly always carries celery. As a separate dish, the
   broth would reach somebody allergic to celery with nothing stopping it. The fix: add the
   `celery` link to both rows in phase 2's reviewed migration. That protects the dishes that
   already use them too. Until then, I recommend rejecting both entries. It is a safety finding:
   it goes first in § Risks.

## Premises checked

| Premise (PRD 018) | Status | Evidence |
|---|---|---|
| Spanish sides are missing: vegetable soups, broth, roasted peppers, menestra, mushrooms, wholemeal bread, breadsticks | **confirmed, except wholemeal bread**, which is **wrong** | `pan-integral` is in `ACCOMPANIMENTS` (`Accompaniment.ts:86`) and in `0079`'s table 3a. The rest is not there |
| Asian, Latin and Arab have 2–3 options each | **half confirmed** | Each family's own: Asian 4 (`arroz-blanco`, `sopa-de-miso`, `ensalada-de-pepino`, `pak-choi-salteado`), Latin 4 (`tortilla-de-maiz`, `arroz-rojo`, `pico-de-gallo`, `frijoles`), Arab 5 (`pan-de-pita`, `hummus`, `ensalada-marroqui`, `tabule`, `naranja-con-canela`). All three also share `ensalada-verde`, the fruit and the yoghurt. By role they are 1–3, and that is what the PRD means |
| Breakfast gains at least 5 | **wrong as variety served**; the lead withdrew the goal | Breakfast receives no accompaniments (`Scheduler.ts:272`, `:774`; `MAIN_SLOTS` = lunch and dinner, `Variety.ts:35`). 016's plan says the same, line 21: "at K = 6 per main slot". The lead confirmed it as design on 2026-10-03 |
| The same accompaniments come back within the fortnight, and more entries fix it | **hypothesis** | The choice is by macro fit, with ties broken by position in the table, and there is no repetition cost (`Scheduler.ts:291–310`). It is tested with the count of distinct ones per profile and fortnight that phase 3 adds to the evaluator |
| The current accompaniments are "USDA except `queso-de-burgos`" (the comment at `Accompaniment.ts:74–82`) | **wrong** | In the seed, five rows already in use are `manual`, not USDA: `requeson`, `pan-sin-gluten`, `alga-wakame`, `salsa-de-soja-baja-en-sal` and `vinagre-de-arroz`. It is not BEDCA, but it is not a public source either. My rule for the batch: USDA rows only; no `manual`; BEDCA never, except `picos-de-pan`, and that one is conditional |
| The larder filters (`larderFor`) cover any new entry | **confirmed for allergies, intolerances, ways of eating and tastes** | `larderFor` passes every row through `dishSafety` and `excludedIngredientIds` (`Accompaniment.ts:368–396`), and the set is judged again with the plate for kosher (`setsBeside`, `:530`) |
| "Traditional Spanish never receives a foreign one" is guaranteed by the larder | **wrong for 5 entries** | `ensalada-de-zanahoria-marroqui`, `ensalada-de-remolacha`, `cuscus`, `datiles` and `elote` carry no row from `0077`'s list (`Preference.ts:98`). What keeps them away is that they are only offered beside a dish of their own family (`portionsBeside`, `:483`), and that `traditional_spanish` rejects foreign-cuisine dishes (`FOREIGN_CUISINES`, `Preference.ts:761–821`). Phase 3's test must go through `setsBeside` with a dish of that family, not only through `larderFor` |
| `schedulePlan` stays within +10% | **a hypothesis at risk** | The sets per cache key grow ×6.5 in the Spanish family (§ Risks) |
| `0079`'s group rules (rice, pasta, grains, potato, legume) apply to an accompaniment as they do to a plate | **wrong in one detail** | `itemGroups` (`Accompaniment.ts:446`) has no grams threshold; `dishGroups` does (`FOOD_GROUP_GRAMS`, `Cuisine.ts:184`). An accompaniment with 10 g of noodles is already "pasta": on a Spanish table it would be left to lunch only. That is why I do not propose "broth with noodles". No entry in the batch depends on a small amount of a group |

## What is there today

- **The list**: 46 entries in `ACCOMPANIMENTS` (`Accompaniment.ts:83–317`). They are 10
  starches, 15 vegetables and 21 desserts; 18 composed, with a name in `COMPOSED_NAMES`
  (`:566`) and a preparation in `COMPOSED_PREPARATIONS` (`:594`). Each has its web phrase in
  `meal.accompanimentNames` (`apps/web/src/i18n/dictionaries/es-ES.ts:1706`, and the same block
  in `en-GB.ts`). If a key has no phrase, the screen shows the name the API sends
  (`apps/web/src/lib/accompaniments.ts:18`).
- **How it is filtered**:
  - `larderFor` applies the person's safety and exclusions.
  - `portionsBeside` applies the dish's family, the meal, `0079`'s table 2 for the
    accompaniment's own group, the season (a hard filter) and "do not repeat what the plate
    already carries": bread with bread, the same group, fruit with fruit.
  - `setsBeside` judges the set again with the plate.
- **How it is chosen**:
  - Only at lunch and dinner, and only when that meal passes 700 kcal
    (`ACCOMPANIED_FROM_KCAL`, `Scheduler.ts:213`).
  - `setsOf` forms every possible set: nothing, or at most one starch, one vegetable and one
    dessert. It is the product of the three roles (`:501`).
  - `rankedSets` prices them all and keeps the 6 that best close the macro gap (`:298`).
  - The accompaniments may not pass 35% of the meal's energy (`ACCOMPANIMENT_MAX_SHARE`,
    `:224`).
  - The set cache is keyed by dish, meal, month and the day's budget (`:276`).
- **Names**: an entry is composed if it has more than one row or if its row is not named like
  its key (`isComposed`, `:684`). Composed ones need a name and a preparation in both
  languages. Simple ones take the catalogue's name.

## How the batch is made

- **Ingredients**: only catalogue rows with source `usda`, except `picos-de-pan`. The script
  checks it, entry by entry (§ Checks).
- **Portions**: AESAN's, the ones `0079` already uses:
  - vegetables, 150–200 g of raw produce; the soups carry more because they are mostly cooking
    water, which does not count;
  - fruit, 120–200 g;
  - bread, 30–60 g;
  - potato, 150 g.
- **Oil**: only if the portion carries it, and then the phrase says exactly how much. 5 g is "a
  teaspoon" and 10 g "two teaspoons". No phrase names another fat.
- **Months**: on a composed entry they come from intersecting its fresh rows' months, with two
  declared exceptions, as the gazpacho did in `0079`:
  - **The broths** (10–4): it is what is drunk in the cold months. Their rows have no season.
  - **`pan-con-tomate`** (all year): it uses jarred crushed tomato, like `arroz-rojo`.
- **Families**:
  - The Spanish ones use `SPANISH` (Spanish and "other"). Three of them are also Italian:
    `tomate-alinado`, `alcachofas-a-la-plancha` and `esparragos-trigueros-a-la-plancha`.
  - The foreign ones, their family only.
  - The fruit, the yoghurt with honey and the fruit salad, every family, like today's simple
    ones.
- **Shape**: every entry comes as a TypeScript literal using the file's own helpers
  (`composed`, `fruit`, `BLD`, `LD`, `SPANISH`, `SUMMER`), plus its name, its preparation and
  its web phrases. Phase 3 only has to paste and sort the keys. I checked that the literals
  evaluate and that they give exactly the entries in the tables.
- **The tables' legend**: meals B breakfast, L lunch, D dinner. The macros are per portion:
  kcal, protein, carbohydrate, fat and fibre in grams. "Classes" are the catalogue classes no
  allergen reveals (`meat`, `animal`), the ones vegetarians, vegans and kosher read.

## Proposal

### 1. The Spanish family (21)

They are home sides, the kind that go on a Spanish table:
- **three soups**: courgette in summer, pumpkin in autumn and winter, leeks all year;
- **two broths**;
- **seasonal vegetables** for each time of year:
  - roasted peppers and escalivada at the end of summer;
  - chard, cauliflower and spinach in winter;
  - artichokes and green asparagus in spring;
- **menestra, mushrooms and dressed carrots** all year;
- **two potatoes**: boiled and mashed;
- **salmorejo** in summer;
- **pan con tomate** and **breadsticks**.

With them, the vegetable options beside a Spanish dish go from 2–5 to 11–18 depending on the
month. Today, from October to May, they are 2 or 3, because only `ensalada-verde` is
all-year (measured by combinatorics over the list, with no per-person filters).

Notes per entry:
- **`crema-de-puerros`, `patata-cocida`, `pure-de-patata`** are of the potato group (`0079`,
  table 2). On a Spanish table they fit at lunch and dinner, but they are not offered beside a
  dish that already carries 100 g or more of potato per serving (`Accompaniment.ts:485`). That
  is what is wanted.
- **`caldo-de-pollo`** has the `meat` class: vegetarians and vegans do not receive it and have
  `caldo-de-verduras`. For kosher, `setsBeside` stops it being served with a yoghurt
  (`Accompaniment.ts:542`). Both broths contribute 15 kcal: they are there for variety, not to
  close macros (§ Risks, point 4). **They must not go in until their rows declare celery**
  (the verdict's condition 5).
- **`salmorejo`** carries 30 g of bread and is the gluten case at lunch and dinner. Since its
  role is vegetable, the "bread beside bread" filter does not look at it: it can come out with
  bread in the starch role. That is 60–90 g of bread between the two, within AESAN's serving.
- **`espinacas-a-la-catalana`**: see the verdict's condition 4 (tree nuts at lunch and
  dinner).
- **`pan-con-tomate`** uses jarred crushed tomato, so it is all-year, like `arroz-rojo`. It
  goes at breakfast, lunch and dinner, like bread: pa amb tomàquet is also a Catalan dinner.
  It carries gluten.
- **`menestra-de-verduras`** uses the USDA frozen rows (green beans, peas, cauliflower), so it
  is all-year. A seasonal menestra (artichoke, broad beans and fresh peas) would only line up
  in May. The `menestra-congelada` and `alcachofas-congeladas` rows are `manual` and I do not
  use them.
- **`picos-de-pan`** is conditional: see condition 3 and § Rows that are missing. I give it two
  portions, 20 and 30 g, instead of `bread()`'s 30 and 60 g. 60 g of breadsticks is some
  250 kcal.
- **What I left out**:
  - **pimientos de Padrón**: its row is `manual`; with the USDA green pepper row they would be
    another entry to re-source;
  - **pisto and pipirrana**: more a dish than a side, or nearly identical to what summer
    already has;
  - **broth with noodles**: because of the `itemGroups` detail;
  - **mixed mushrooms**: the button mushrooms already cover "mushrooms" and every all-year
    vegetable makes the scheduler more expensive (§ Risks).

| Key | Role | Families | Meals | Months | Portion | kcal | P | C | F | Fibre | Allergens | Classes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `crema-de-calabacin` | vegetable | spanish, other | L D | 5, 6, 7, 8, 9 | 295.5 g | 102.7 | 3.4 | 11.5 | 5.8 | 3.2 | — | — |
| `crema-de-calabaza` | vegetable | spanish, other | L D | 9, 10, 11, 12, 1, 2, 3 | 325.5 g | 137.6 | 3.2 | 22.9 | 5.4 | 2.9 | — | — |
| `crema-de-puerros` | vegetable | spanish, other | L D | all year | 225.5 g | 187 | 3.6 | 32.9 | 5.5 | 4.2 | — | — |
| `caldo-de-pollo` | vegetable | spanish, other | L D | 10, 11, 12, 1, 2, 3, 4 | 250 g | 15 | 1.5 | 1 | 0.5 | 0 | — | meat |
| `caldo-de-verduras` | vegetable | spanish, other | L D | 10, 11, 12, 1, 2, 3, 4 | 250 g | 15 | 0.5 | 2.5 | 0.3 | 0 | — | — |
| `pimientos-asados` | vegetable | spanish, other | L D | 7, 8, 9, 10 | 157.5 g | 86.2 | 1.6 | 9.7 | 5.5 | 3.2 | — | — |
| `menestra-de-verduras` | vegetable | spanish, other | L D | all year | 177.5 g | 116.7 | 3.9 | 15.1 | 5.4 | 4.8 | — | — |
| `champinones-al-ajillo` | vegetable | spanish, other | L D | all year | 162.5 g | 84.2 | 5 | 6.5 | 5.5 | 1.7 | — | — |
| `tomate-alinado` | vegetable | spanish, other, italian | L D | 6, 7, 8, 9 | 189.5 g | 79.2 | 1.8 | 7.5 | 5.4 | 2.3 | — | — |
| `escalivada` | vegetable | spanish, other | L D | 7, 8, 9, 10 | 225.5 g | 106 | 2.2 | 14.4 | 5.5 | 5.4 | — | — |
| `espinacas-a-la-catalana` | vegetable | spanish, other | L D | 10, 11, 12, 1, 2, 3, 4, 5, 6 | 172.5 g | 145.4 | 5.5 | 14.7 | 9.1 | 3.9 | tree_nuts | — |
| `acelgas-rehogadas` | vegetable | spanish, other | L D | 8, 9, 10, 11, 12, 1, 2, 3, 4, 5 | 209 g | 88.1 | 3.9 | 8.7 | 5.5 | 3.4 | — | — |
| `coliflor-al-ajoarriero` | vegetable | spanish, other | L D | 9, 10, 11, 12, 1, 2, 3, 4 | 162.5 g | 89.6 | 3.2 | 9 | 5.6 | 3.4 | — | — |
| `alcachofas-a-la-plancha` | vegetable | spanish, other, italian | L D | 12, 1, 2, 3, 4, 5 | 160.5 g | 116.2 | 5 | 16.2 | 5.2 | 8.2 | — | — |
| `esparragos-trigueros-a-la-plancha` | vegetable | spanish, other, italian | L D | 3, 4, 5, 6, 9 | 155.5 g | 74.2 | 3.3 | 5.9 | 5.2 | 3.2 | — | — |
| `zanahorias-alinadas` | vegetable | spanish, other | L D | all year | 133.5 g | 100.5 | 1.3 | 12.8 | 5.4 | 3.7 | — | — |
| `patata-cocida` | starch | spanish, other | L D | all year | 157.5 g | 160.4 | 3.1 | 26.4 | 5.2 | 3.2 | — | — |
| `pure-de-patata` | starch | spanish, other | L D | all year | 195.5 g | 179.7 | 4.3 | 28.2 | 6 | 3.2 | lactose, milk | — |
| `salmorejo` | vegetable | spanish, other | L D | 6, 7, 8, 9 | 243 g | 214.4 | 4.6 | 24.8 | 11.6 | 3.3 | gluten | — |
| `picos-de-pan` | starch | spanish, other | B L D | all year | 20 g | 79.8 | 2.2 | 14.6 | 1.4 | 0.7 | gluten | — |
|  | | | | | 30 g | 119.7 | 3.3 | 21.9 | 2.1 | 1.1 |  |  |
| `pan-con-tomate` | starch | spanish, other | B L D | all year | 95.5 g | 204.4 | 5.1 | 30.9 | 7.1 | 2.2 | gluten | — |

`ACCOMPANIMENTS`:

```ts
  composed(
    'crema-de-calabacin',
    'vegetable',
    SPANISH,
    [5, 6, 7, 8, 9],
    [
      { grams: 250, slug: 'calabacin' },
      { grams: 40, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'crema-de-calabaza',
    'vegetable',
    SPANISH,
    [9, 10, 11, 12, 1, 2, 3],
    [
      { grams: 250, slug: 'calabaza' },
      { grams: 40, slug: 'zanahoria' },
      { grams: 30, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'crema-de-puerros',
    'vegetable',
    SPANISH,
    'all',
    [
      { grams: 120, slug: 'puerro' },
      { grams: 80, slug: 'patata' },
      { grams: 20, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  {
    families: SPANISH,
    key: 'caldo-de-pollo',
    months: [10, 11, 12, 1, 2, 3, 4],
    portions: [[{ grams: 250, slug: 'caldo-de-pollo' }]],
    role: 'vegetable',
    slots: LD
  },
  {
    families: SPANISH,
    key: 'caldo-de-verduras',
    months: [10, 11, 12, 1, 2, 3, 4],
    portions: [[{ grams: 250, slug: 'caldo-de-verduras' }]],
    role: 'vegetable',
    slots: LD
  },
  composed(
    'pimientos-asados',
    'vegetable',
    SPANISH,
    [7, 8, 9, 10],
    [
      { grams: 150, slug: 'pimiento-rojo' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'menestra-de-verduras',
    'vegetable',
    SPANISH,
    'all',
    [
      { grams: 50, slug: 'judia-verde-congelada' },
      { grams: 30, slug: 'guisantes-congelados' },
      { grams: 40, slug: 'coliflor-congelada' },
      { grams: 30, slug: 'zanahoria' },
      { grams: 20, slug: 'cebolla' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'champinones-al-ajillo',
    'vegetable',
    SPANISH,
    'all',
    [
      { grams: 150, slug: 'champinon' },
      { grams: 4, slug: 'ajo' },
      { grams: 3, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'tomate-alinado',
    'vegetable',
    [...SPANISH, 'italian'],
    SUMMER,
    [
      { grams: 180, slug: 'tomate' },
      { grams: 1, slug: 'ajo' },
      { grams: 3, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'escalivada',
    'vegetable',
    SPANISH,
    [7, 8, 9, 10],
    [
      { grams: 100, slug: 'berenjena' },
      { grams: 80, slug: 'pimiento-rojo' },
      { grams: 40, slug: 'cebolla' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'espinacas-a-la-catalana',
    'vegetable',
    SPANISH,
    [10, 11, 12, 1, 2, 3, 4, 5, 6],
    [
      { grams: 150, slug: 'espinaca' },
      { grams: 10, slug: 'pasas' },
      { grams: 5, slug: 'pinones' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'acelgas-rehogadas',
    'vegetable',
    SPANISH,
    [8, 9, 10, 11, 12, 1, 2, 3, 4, 5],
    [
      { grams: 200, slug: 'acelga' },
      { grams: 3, slug: 'ajo' },
      { grams: 0.5, slug: 'pimenton-dulce' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'coliflor-al-ajoarriero',
    'vegetable',
    SPANISH,
    [9, 10, 11, 12, 1, 2, 3, 4],
    [
      { grams: 150, slug: 'coliflor' },
      { grams: 3, slug: 'ajo' },
      { grams: 1, slug: 'pimenton-dulce' },
      { grams: 3, slug: 'vinagre-de-vino-tinto' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'alcachofas-a-la-plancha',
    'vegetable',
    [...SPANISH, 'italian'],
    [12, 1, 2, 3, 4, 5],
    [
      { grams: 150, slug: 'alcachofa' },
      { grams: 5, slug: 'limon' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'esparragos-trigueros-a-la-plancha',
    'vegetable',
    [...SPANISH, 'italian'],
    [3, 4, 5, 6, 9],
    [
      { grams: 150, slug: 'esparrago-verde' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'zanahorias-alinadas',
    'vegetable',
    SPANISH,
    'all',
    [
      { grams: 120, slug: 'zanahoria' },
      { grams: 2, slug: 'ajo' },
      { grams: 0.5, slug: 'comino-molido' },
      { grams: 0.5, slug: 'oregano-seco' },
      { grams: 5, slug: 'vinagre-de-vino-tinto' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'patata-cocida',
    'starch',
    SPANISH,
    'all',
    [
      { grams: 150, slug: 'patata' },
      { grams: 2, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'pure-de-patata',
    'starch',
    SPANISH,
    'all',
    [
      { grams: 150, slug: 'patata' },
      { grams: 40, slug: 'leche-semidesnatada' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'salmorejo',
    'vegetable',
    SPANISH,
    SUMMER,
    [
      { grams: 200, slug: 'tomate' },
      { grams: 30, slug: 'pan-blanco' },
      { grams: 2, slug: 'ajo' },
      { grams: 10, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 1, slug: 'sal' }
    ]
  ),
  {
    families: SPANISH,
    key: 'picos-de-pan',
    months: 'all',
    portions: [[{ grams: 20, slug: 'picos-de-pan' }], [{ grams: 30, slug: 'picos-de-pan' }]],
    role: 'starch',
    slots: BLD
  },
  composed(
    'pan-con-tomate',
    'starch',
    SPANISH,
    'all',
    [
      { grams: 50, slug: 'pan-blanco' },
      { grams: 40, slug: 'tomate-triturado' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ],
    BLD
  ),
```

`COMPOSED_NAMES`:

```ts
  'crema-de-calabacin': { 'en-GB': 'Courgette soup', 'es-ES': 'Crema de calabacín' },
  'crema-de-calabaza': { 'en-GB': 'Pumpkin soup', 'es-ES': 'Crema de calabaza' },
  'crema-de-puerros': { 'en-GB': 'Leek and potato soup', 'es-ES': 'Crema de puerros' },
  'pimientos-asados': { 'en-GB': 'Roasted red peppers', 'es-ES': 'Pimientos asados' },
  'menestra-de-verduras': { 'en-GB': 'Mixed vegetable menestra', 'es-ES': 'Menestra de verduras' },
  'champinones-al-ajillo': { 'en-GB': 'Garlic mushrooms', 'es-ES': 'Champiñones al ajillo' },
  'tomate-alinado': { 'en-GB': 'Dressed tomatoes', 'es-ES': 'Tomate aliñado' },
  escalivada: { 'en-GB': 'Catalan roasted vegetables', 'es-ES': 'Escalivada' },
  'espinacas-a-la-catalana': { 'en-GB': 'Catalan spinach with raisins and pine nuts', 'es-ES': 'Espinacas a la catalana' },
  'acelgas-rehogadas': { 'en-GB': 'Sautéed Swiss chard', 'es-ES': 'Acelgas rehogadas' },
  'coliflor-al-ajoarriero': { 'en-GB': 'Cauliflower with garlic and paprika', 'es-ES': 'Coliflor al ajoarriero' },
  'alcachofas-a-la-plancha': { 'en-GB': 'Griddled artichokes', 'es-ES': 'Alcachofas a la plancha' },
  'esparragos-trigueros-a-la-plancha': { 'en-GB': 'Griddled green asparagus', 'es-ES': 'Espárragos trigueros a la plancha' },
  'zanahorias-alinadas': { 'en-GB': 'Marinated carrots', 'es-ES': 'Zanahorias aliñadas' },
  'patata-cocida': { 'en-GB': 'Boiled potatoes', 'es-ES': 'Patata cocida' },
  'pure-de-patata': { 'en-GB': 'Mashed potato', 'es-ES': 'Puré de patata' },
  salmorejo: { 'en-GB': 'Salmorejo', 'es-ES': 'Salmorejo' },
  'pan-con-tomate': { 'en-GB': 'Bread with tomato', 'es-ES': 'Pan con tomate' },
```

`COMPOSED_PREPARATIONS`:

```ts
  'crema-de-calabacin': {
    'en-GB': 'Soften the chopped onion in a teaspoon of oil, add the chopped courgette and just enough water to cover, simmer for about 15 minutes, salt and blend until smooth.',
    'es-ES': 'Rehoga la cebolla picada con una cucharadita de aceite, añade el calabacín troceado y agua justo hasta cubrir, cuécelo unos 15 minutos, sala y tritúralo fino.'
  },
  'crema-de-calabaza': {
    'en-GB': 'Soften the chopped onion in a teaspoon of oil, add the pumpkin and carrot in chunks and just enough water to cover, simmer for about 20 minutes, salt and blend until smooth.',
    'es-ES': 'Rehoga la cebolla picada con una cucharadita de aceite, añade la calabaza y la zanahoria en trozos y agua justo hasta cubrir, cuécelo unos 20 minutos, sala y tritúralo fino.'
  },
  'crema-de-puerros': {
    'en-GB': 'Soften the sliced leek and onion in a teaspoon of oil, add the potato in chunks and just enough water to cover, simmer for about 20 minutes, salt and blend until smooth.',
    'es-ES': 'Rehoga el puerro y la cebolla en rodajas con una cucharadita de aceite, añade la patata en trozos y agua justo hasta cubrir, cuécelo unos 20 minutos, sala y tritúralo fino.'
  },
  'pimientos-asados': {
    'en-GB': 'Roast the whole peppers at 200 °C for about 40 minutes, leave them to rest covered, peel them, cut them into strips and dress with the chopped garlic, a teaspoon of oil and the salt.',
    'es-ES': 'Asa los pimientos enteros en el horno a 200 °C unos 40 minutos, déjalos reposar tapados, pélalos, córtalos en tiras y alíñalos con el ajo picado, una cucharadita de aceite y la sal.'
  },
  'menestra-de-verduras': {
    'en-GB': 'Boil the frozen vegetables and the sliced carrot in water with the salt for about 8 minutes, drain and toss them for a couple of minutes with the chopped onion and garlic and a teaspoon of oil.',
    'es-ES': 'Cuece las verduras congeladas y la zanahoria en rodajas en agua con la sal unos 8 minutos, escúrrelas y rehógalas un par de minutos con la cebolla y el ajo picados y una cucharadita de aceite.'
  },
  'champinones-al-ajillo': {
    'en-GB': 'Sauté the sliced mushrooms over high heat in a teaspoon of oil until golden, add the sliced garlic for one more minute and finish with the chopped parsley and the salt.',
    'es-ES': 'Saltea los champiñones laminados a fuego vivo con una cucharadita de aceite hasta que se doren, añade el ajo laminado un minuto más y termina con el perejil picado y la sal.'
  },
  'tomate-alinado': {
    'en-GB': 'Slice the tomatoes and dress them with the finely chopped garlic and parsley, a teaspoon of oil and the salt.',
    'es-ES': 'Corta el tomate en rodajas y alíñalo con el ajo y el perejil muy picados, una cucharadita de aceite y la sal.'
  },
  escalivada: {
    'en-GB': 'Roast the whole aubergine, pepper and onion at 200 °C for about 45 minutes, peel them, cut them into strips and dress with a teaspoon of oil and the salt.',
    'es-ES': 'Asa la berenjena, el pimiento y la cebolla enteros en el horno a 200 °C unos 45 minutos, pélalos, córtalos en tiras y alíñalos con una cucharadita de aceite y la sal.'
  },
  'espinacas-a-la-catalana': {
    'en-GB': 'Toast the pine nuts and sliced garlic in a teaspoon of oil, add the raisins and the spinach and stir until it wilts; salt at the end.',
    'es-ES': 'Dora los piñones y el ajo laminado con una cucharadita de aceite, añade las pasas y las espinacas y saltéalas hasta que pierdan volumen; sala al final.'
  },
  'acelgas-rehogadas': {
    'en-GB': 'Boil the chopped chard in water with the salt for about 6 minutes, drain and sauté with the sliced garlic and a teaspoon of oil; take off the heat and dust with the paprika.',
    'es-ES': 'Cuece las acelgas troceadas en agua con la sal unos 6 minutos, escúrrelas y rehógalas con el ajo laminado y una cucharadita de aceite; aparta del fuego y espolvorea el pimentón.'
  },
  'coliflor-al-ajoarriero': {
    'en-GB': 'Boil the cauliflower florets in water with the salt for about 8 minutes and drain; brown the sliced garlic in a teaspoon of oil, take off the heat, stir in the paprika and vinegar and pour over the cauliflower.',
    'es-ES': 'Cuece la coliflor en ramilletes en agua con la sal unos 8 minutos y escúrrela; dora el ajo laminado con una cucharadita de aceite, aparta del fuego, añade el pimentón y el vinagre y riega la coliflor.'
  },
  'alcachofas-a-la-plancha': {
    'en-GB': 'Trim the artichokes down to their hearts, halve them, rub them with the lemon and griddle them with a teaspoon of oil for about 8 minutes a side; salt at the end.',
    'es-ES': 'Limpia las alcachofas hasta dejar los corazones, pártelos por la mitad, frótalos con el limón y hazlos a la plancha con una cucharadita de aceite unos 8 minutos por lado; sala al final.'
  },
  'esparragos-trigueros-a-la-plancha': {
    'en-GB': 'Snap off the woody ends, brush the asparagus with a teaspoon of oil and cook on a very hot griddle for about 5 minutes, turning them; salt at the end.',
    'es-ES': 'Quita la parte dura de los espárragos, úntalos con una cucharadita de aceite y hazlos a la plancha bien caliente unos 5 minutos, dándoles la vuelta; sala al final.'
  },
  'zanahorias-alinadas': {
    'en-GB': 'Boil the sliced carrots in water with the salt for about 8 minutes, drain and dress with the chopped garlic, cumin, oregano, vinegar and a teaspoon of oil; serve cold.',
    'es-ES': 'Cuece la zanahoria en rodajas en agua con la sal unos 8 minutos, escúrrela y alíñala con el ajo picado, el comino, el orégano, el vinagre y una cucharadita de aceite; sírvela fría.'
  },
  'patata-cocida': {
    'en-GB': 'Boil the potato in chunks in water with the salt for about 20 minutes, drain and dress with a teaspoon of oil and the chopped parsley.',
    'es-ES': 'Cuece la patata en trozos en agua con la sal unos 20 minutos, escúrrela y alíñala con una cucharadita de aceite y el perejil picado.'
  },
  'pure-de-patata': {
    'en-GB': 'Boil the potato in chunks in water with the salt for about 20 minutes, drain and mash with the warm milk and a teaspoon of oil until smooth.',
    'es-ES': 'Cuece la patata en trozos en agua con la sal unos 20 minutos, escúrrela y cháfala con la leche caliente y una cucharadita de aceite hasta que quede fina.'
  },
  salmorejo: {
    'en-GB': 'Blend the tomatoes with the garlic, add the torn bread, let it soak for a few minutes and blend again with two teaspoons of oil and the salt until thick; serve well chilled.',
    'es-ES': 'Tritura el tomate con el ajo, añade el pan troceado, deja que se empape unos minutos y vuelve a triturar con dos cucharaditas de aceite y la sal hasta que quede espeso; sírvelo bien frío.'
  },
  'pan-con-tomate': {
    'en-GB': 'Toast the bread, spread the crushed tomato over it and finish with a teaspoon of oil and the salt.',
    'es-ES': 'Tuesta el pan, extiende encima el tomate triturado y termina con una cucharadita de aceite y la sal.'
  },
```

`meal.accompanimentNames` (web, `es-ES` and `en-GB`):

```ts
// es-ES
      'crema-de-calabacin': 'crema de calabacín',
      'crema-de-calabaza': 'crema de calabaza',
      'crema-de-puerros': 'crema de puerros',
      'caldo-de-pollo': 'un tazón de caldo de pollo',
      'caldo-de-verduras': 'un tazón de caldo de verduras',
      'pimientos-asados': 'pimientos asados',
      'menestra-de-verduras': 'menestra de verduras',
      'champinones-al-ajillo': 'champiñones al ajillo',
      'tomate-alinado': 'tomate aliñado',
      escalivada: 'escalivada',
      'espinacas-a-la-catalana': 'espinacas a la catalana',
      'acelgas-rehogadas': 'acelgas rehogadas',
      'coliflor-al-ajoarriero': 'coliflor al ajoarriero',
      'alcachofas-a-la-plancha': 'alcachofas a la plancha',
      'esparragos-trigueros-a-la-plancha': 'espárragos trigueros a la plancha',
      'zanahorias-alinadas': 'zanahorias aliñadas',
      'patata-cocida': 'patata cocida',
      'pure-de-patata': 'puré de patata',
      salmorejo: 'salmorejo',
      'picos-de-pan': 'picos de pan ({grams})',
      'pan-con-tomate': 'pan con tomate',
// en-GB
      'crema-de-calabacin': 'courgette soup',
      'crema-de-calabaza': 'pumpkin soup',
      'crema-de-puerros': 'leek and potato soup',
      'caldo-de-pollo': 'a bowl of chicken broth',
      'caldo-de-verduras': 'a bowl of vegetable broth',
      'pimientos-asados': 'roasted red peppers',
      'menestra-de-verduras': 'mixed vegetable menestra',
      'champinones-al-ajillo': 'garlic mushrooms',
      'tomate-alinado': 'dressed tomatoes',
      escalivada: 'Catalan roasted vegetables',
      'espinacas-a-la-catalana': 'Catalan spinach with raisins and pine nuts',
      'acelgas-rehogadas': 'sautéed Swiss chard',
      'coliflor-al-ajoarriero': 'cauliflower with garlic and paprika',
      'alcachofas-a-la-plancha': 'griddled artichokes',
      'esparragos-trigueros-a-la-plancha': 'griddled green asparagus',
      'zanahorias-alinadas': 'marinated carrots',
      'patata-cocida': 'boiled potatoes',
      'pure-de-patata': 'mashed potato',
      salmorejo: 'salmorejo',
      'picos-de-pan': 'breadsticks ({grams})',
      'pan-con-tomate': 'bread with tomato',
```
### 2. Asian (4)

- **What goes in**:
  - a second rice: jasmine, for Thai and Vietnamese cooking;
  - three sides that really do go beside the plate: edamame, sesame spinach (the Japanese
    *gomae*) and kimchi.
- **Vegetables**: from 2–3 options to 5–6.
- **`arroz-jazmin`**: it is of the rice group. The Asian table allows it at lunch and dinner,
  but not beside a rice dish (`Accompaniment.ts:485`).
- **`espinacas-con-sesamo`**: it uses `salsa-de-soja` (USDA; soy and gluten) and not
  `salsa-de-soja-baja-en-sal`, which is `manual`. It is the batch's second gluten case.
- **`kimchi`**: its row carries traces of fish and crustaceans. Anybody who declared those
  traces does not receive it. It contributes 9 kcal (§ Risks, point 4).
- **`edamame`**: it carries soy and 11 g of protein. It goes in the vegetable role, like the
  miso soup.

| Key | Rows from `0077` it carries (`traditional_spanish`) |
|---|---|
| `arroz-jazmin` | `arroz-jazmin-crudo` |
| `edamame` | `edamame-congelado` |
| `espinacas-con-sesamo` | `sesamo`, `salsa-de-soja` |
| `kimchi` | `kimchi` |


| Key | Role | Families | Meals | Months | Portion | kcal | P | C | F | Fibre | Allergens | Classes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `arroz-jazmin` | starch | asian | L D | all year | 50 g | 182.5 | 3.6 | 40 | 0.4 | 0.7 | — | — |
| `edamame` | vegetable | asian | L D | all year | 101 g | 109 | 11.2 | 7.6 | 4.7 | 4.8 | soy | — |
| `espinacas-con-sesamo` | vegetable | asian | L D | 10, 11, 12, 1, 2, 3, 4, 5, 6 | 160 g | 65.8 | 5.6 | 6.8 | 3.1 | 3.9 | gluten, sesame, soy | — |
| `kimchi` | vegetable | asian | L D | all year | 60 g | 9 | 0.7 | 1.4 | 0.3 | 1 | crustaceans (trazas), fish (trazas) | — |

`ACCOMPANIMENTS`:

```ts
  composed(
    'arroz-jazmin',
    'starch',
    ['asian'],
    'all',
    [
      { grams: 50, slug: 'arroz-jazmin-crudo' }
    ]
  ),
  composed(
    'edamame',
    'vegetable',
    ['asian'],
    'all',
    [
      { grams: 100, slug: 'edamame-congelado' },
      { grams: 1, slug: 'sal' }
    ]
  ),
  composed(
    'espinacas-con-sesamo',
    'vegetable',
    ['asian'],
    [10, 11, 12, 1, 2, 3, 4, 5, 6],
    [
      { grams: 150, slug: 'espinaca' },
      { grams: 5, slug: 'sesamo' },
      { grams: 5, slug: 'salsa-de-soja' }
    ]
  ),
  {
    families: ['asian'],
    key: 'kimchi',
    months: 'all',
    portions: [[{ grams: 60, slug: 'kimchi' }]],
    role: 'vegetable',
    slots: LD
  },
```

`COMPOSED_NAMES`:

```ts
  'arroz-jazmin': { 'en-GB': 'Jasmine rice', 'es-ES': 'Arroz jazmín' },
  edamame: { 'en-GB': 'Edamame', 'es-ES': 'Edamame' },
  'espinacas-con-sesamo': { 'en-GB': 'Sesame spinach', 'es-ES': 'Espinacas con sésamo' },
```

`COMPOSED_PREPARATIONS`:

```ts
  'arroz-jazmin': {
    'en-GB': 'Rinse the rice, cook it covered in one and a half times its volume of water over the lowest heat for about 12 minutes and let it rest for 10.',
    'es-ES': 'Lava el arroz, cuécelo tapado con vez y media su volumen de agua a fuego mínimo unos 12 minutos y déjalo reposar 10.'
  },
  edamame: {
    'en-GB': 'Boil the edamame for about 5 minutes, drain it and sprinkle with the salt.',
    'es-ES': 'Cuece el edamame en agua hirviendo unos 5 minutos, escúrrelo y espolvorea la sal.'
  },
  'espinacas-con-sesamo': {
    'en-GB': 'Blanch the spinach for a minute, cool it in cold water, squeeze it dry and dress it with the soy sauce and the toasted sesame.',
    'es-ES': 'Escalda las espinacas un minuto, enfríalas en agua fría, escúrrelas apretando bien y alíñalas con la salsa de soja y el sésamo tostado.'
  },
```

`meal.accompanimentNames` (web, `es-ES` and `en-GB`):

```ts
// es-ES
      'arroz-jazmin': 'arroz jazmín',
      edamame: 'edamame',
      'espinacas-con-sesamo': 'espinacas con sésamo',
      kimchi: 'kimchi ({grams})',
// en-GB
      'arroz-jazmin': 'jasmine rice',
      edamame: 'edamame',
      'espinacas-con-sesamo': 'sesame spinach',
      kimchi: 'kimchi ({grams})',
```
### 3. Mexican and Latin American (6)

- **What goes in**:
  - three starches of the Latin table that are neither a tortilla nor rice: cassava with mojo
    (Cuba, Colombia), baked plantain and elote (Mexico, in summer);
  - three vegetables: guacamole all year, curtido (the Salvadoran pickled cabbage) from
    September to March, and avocado salad from November to April.
- **The Latin vegetables were the shortest**, with 2–3 options depending on the month. That is
  why they get the two slots breakfast left. They go to 3–5 options. Winter was the weakest:
  only `frijoles` and `ensalada-verde`, and that is where the curtido and the avocado salad go.
  The catalogue has no USDA rows for nopal or chayote.
- **`ensalada-de-aguacate` and `guacamole`** share the avocado. Since only one vegetable goes
  per set, they never coincide in the same meal. But the lead may prefer just one.
- **`curtido`** carries no oil, and its phrase does not name any. It is the lightest vegetable
  in the batch that is not a broth: 47 kcal.
- **`yuca-con-mojo`**: `yuca` is of the potato group. The Latin table allows it at lunch and
  dinner (`Cuisine.ts:236`).
- **`elote`**: `mazorca-de-maiz` has no group. 150 g of kernels is a large cob
  (`gramsPerUnit` 150).
- **What keeps them away from traditional Spanish**: `yuca`, `platano-macho` and `guacamole`
  are on `0077`'s list. `elote`, `curtido` and `ensalada-de-aguacate` carry no row from that
  list (the avocado stays, by the owner's decision); what keeps them away is the family (see
  § Premises checked).


| Key | Role | Families | Meals | Months | Portion | kcal | P | C | F | Fibre | Allergens | Classes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `yuca-con-mojo` | starch | latin | L D | all year | 132.5 g | 240.7 | 1.8 | 46.9 | 5.4 | 2.3 | — | — |
| `platano-macho-al-horno` | starch | latin | L D | all year | 125.5 g | 226.6 | 1.4 | 44 | 5.1 | 2.6 | — | — |
| `elote` | starch | latin | L D | 7, 8, 9 | 156 g | 132.1 | 5 | 28.9 | 2.2 | 3.3 | — | — |
| `guacamole` | vegetable | latin | L D | all year | 60 g | 94.2 | 1.1 | 3.6 | 8.4 | 3 | — | — |
| `curtido` | vegetable | latin | L D | 9, 10, 11, 12, 1, 2, 3 | 156 g | 46.7 | 1.8 | 10.5 | 0.2 | 3.8 | — | — |
| `ensalada-de-aguacate` | vegetable | latin | L D | 11, 12, 1, 2, 3, 4 | 88.5 g | 118.2 | 1.6 | 7.5 | 10.3 | 5.1 | — | — |

`ACCOMPANIMENTS`:

```ts
  composed(
    'yuca-con-mojo',
    'starch',
    ['latin'],
    'all',
    [
      { grams: 120, slug: 'yuca' },
      { grams: 2, slug: 'ajo' },
      { grams: 5, slug: 'lima' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'platano-macho-al-horno',
    'starch',
    ['latin'],
    'all',
    [
      { grams: 120, slug: 'platano-macho' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'elote',
    'starch',
    ['latin'],
    [7, 8, 9],
    [
      { grams: 150, slug: 'mazorca-de-maiz' },
      { grams: 5, slug: 'lima' },
      { grams: 0.5, slug: 'cayena-molida' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  {
    families: ['latin'],
    key: 'guacamole',
    months: 'all',
    portions: [[{ grams: 60, slug: 'guacamole' }]],
    role: 'vegetable',
    slots: LD
  },
  composed(
    'curtido',
    'vegetable',
    ['latin'],
    [9, 10, 11, 12, 1, 2, 3],
    [
      { grams: 100, slug: 'col-blanca' },
      { grams: 30, slug: 'zanahoria' },
      { grams: 15, slug: 'cebolla' },
      { grams: 10, slug: 'vinagre-de-manzana' },
      { grams: 0.5, slug: 'oregano-seco' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'ensalada-de-aguacate',
    'vegetable',
    ['latin'],
    [11, 12, 1, 2, 3, 4],
    [
      { grams: 70, slug: 'aguacate' },
      { grams: 10, slug: 'cebolla-morada' },
      { grams: 3, slug: 'cilantro' },
      { grams: 5, slug: 'lima' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
```

`COMPOSED_NAMES`:

```ts
  'yuca-con-mojo': { 'en-GB': 'Cassava with garlic and lime', 'es-ES': 'Yuca con mojo' },
  'platano-macho-al-horno': { 'en-GB': 'Baked plantain', 'es-ES': 'Plátano macho al horno' },
  elote: { 'en-GB': 'Corn on the cob with lime and chilli', 'es-ES': 'Elote' },
  curtido: { 'en-GB': 'Curtido (pickled cabbage slaw)', 'es-ES': 'Curtido' },
  'ensalada-de-aguacate': { 'en-GB': 'Avocado salad', 'es-ES': 'Ensalada de aguacate' },
```

`COMPOSED_PREPARATIONS`:

```ts
  'yuca-con-mojo': {
    'en-GB': 'Boil the peeled cassava in chunks in water with the salt for about 25 minutes, until tender, drain and pour over the chopped garlic, the lime juice and a teaspoon of oil.',
    'es-ES': 'Cuece la yuca pelada y en trozos en agua con la sal unos 25 minutos, hasta que esté tierna, escúrrela y riégala con el ajo picado, el zumo de lima y una cucharadita de aceite.'
  },
  'platano-macho-al-horno': {
    'en-GB': 'Peel the plantain, cut it into thick slices, brush them with a teaspoon of oil and bake at 200 °C for about 20 minutes, turning them halfway; salt at the end.',
    'es-ES': 'Pela el plátano macho, córtalo en rodajas gruesas, úntalas con una cucharadita de aceite y hornéalas a 200 °C unos 20 minutos, dándoles la vuelta a mitad; sala al final.'
  },
  elote: {
    'en-GB': 'Boil the corn cob for about 10 minutes, or grill it, and serve it with the lime juice, the cayenne and the salt.',
    'es-ES': 'Cuece la mazorca en agua hirviendo unos 10 minutos, o ásala a la plancha, y sírvela con el zumo de lima, la cayena y la sal.'
  },
  curtido: {
    'en-GB': 'Finely shred the cabbage, grate the carrot, chop the onion and mix them with the vinegar, the oregano and the salt; leave it in the fridge for at least an hour.',
    'es-ES': 'Corta la col en juliana fina, ralla la zanahoria, pica la cebolla y mézclalas con el vinagre, el orégano y la sal; déjalo reposar al menos una hora en la nevera.'
  },
  'ensalada-de-aguacate': {
    'en-GB': 'Dice the avocado and mix it with the thinly sliced red onion, the chopped coriander, the lime juice and the salt.',
    'es-ES': 'Corta el aguacate en dados y mézclalo con la cebolla morada en juliana fina, el cilantro picado, el zumo de lima y la sal.'
  },
```

`meal.accompanimentNames` (web, `es-ES` and `en-GB`):

```ts
// es-ES
      'yuca-con-mojo': 'yuca con mojo',
      'platano-macho-al-horno': 'plátano macho al horno',
      elote: 'elote',
      guacamole: 'guacamole ({grams})',
      curtido: 'curtido',
      'ensalada-de-aguacate': 'ensalada de aguacate',
// en-GB
      'yuca-con-mojo': 'cassava with garlic and lime',
      'platano-macho-al-horno': 'baked plantain',
      elote: 'corn on the cob with lime and chilli',
      guacamole: 'guacamole ({grams})',
      curtido: 'curtido slaw',
      'ensalada-de-aguacate': 'avocado salad',
```
### 4. Arab and Maghrebi (5)

- **What goes in**:
  - couscous, which in Morocco is eaten at midday;
  - mutabal (roasted aubergine with tahini) in summer;
  - two all-year salads, carrot and beetroot, so the Arab table is not left with `hummus` and
    `ensalada-verde` from October to May;
  - dates as a dessert.
- **`cuscus`**: it is of the grains group. The Arab table allows it at lunch only
  (`Cuisine.ts:233`), and the entry declares `['lunch']`, like `tabule`.
- **`mutabal`**: it carries sesame (tahini). It carries no oil, and its phrase does not name
  any.
- **`datiles`**: an Arab-family dessert at breakfast, lunch and dinner. A 30 g portion is 3–4
  dates (`gramsPerUnit` 8) and 85 kcal.
- **Traditional Spanish**: `ensalada-de-zanahoria-marroqui`, `ensalada-de-remolacha`, `cuscus`
  and `datiles` carry no row from `0077`. What keeps them away is the dish's family.

| Key | Role | Families | Meals | Months | Portion | kcal | P | C | F | Fibre | Allergens | Classes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `cuscus` | starch | arab | C | all year | 50.5 g | 188 | 6.4 | 38.7 | 0.3 | 2.5 | gluten | — |
| `mutabal` | vegetable | arab | L D | 6, 7, 8, 9, 10 | 167.5 g | 101.4 | 3.4 | 12.1 | 5.7 | 5.6 | sesame | — |
| `ensalada-de-zanahoria-marroqui` | vegetable | arab | L D | all year | 141 g | 100 | 1.4 | 13 | 5.4 | 3.9 | — | — |
| `ensalada-de-remolacha` | vegetable | arab | L D | all year | 136 g | 102.1 | 2.3 | 13 | 5.4 | 2.8 | — | — |
| `datiles` | dessert | arab | B L D | all year | 30 g | 84.6 | 0.8 | 22.5 | 0.1 | 2.4 | — | — |

`ACCOMPANIMENTS`:

```ts
  composed(
    'cuscus',
    'starch',
    ['arab'],
    'all',
    [
      { grams: 50, slug: 'cuscus-crudo' },
      { grams: 0.5, slug: 'sal' }
    ],
    ['lunch']
  ),
  composed(
    'mutabal',
    'vegetable',
    ['arab'],
    [6, 7, 8, 9, 10],
    [
      { grams: 150, slug: 'berenjena' },
      { grams: 10, slug: 'tahini' },
      { grams: 5, slug: 'limon' },
      { grams: 2, slug: 'ajo' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'ensalada-de-zanahoria-marroqui',
    'vegetable',
    ['arab'],
    'all',
    [
      { grams: 120, slug: 'zanahoria' },
      { grams: 10, slug: 'limon' },
      { grams: 0.5, slug: 'comino-molido' },
      { grams: 5, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  composed(
    'ensalada-de-remolacha',
    'vegetable',
    ['arab'],
    'all',
    [
      { grams: 120, slug: 'remolacha-cocida' },
      { grams: 5, slug: 'limon' },
      { grams: 0.5, slug: 'comino-molido' },
      { grams: 5, slug: 'perejil' },
      { grams: 5, slug: 'aceite-de-oliva-virgen-extra' },
      { grams: 0.5, slug: 'sal' }
    ]
  ),
  {
    families: ['arab'],
    key: 'datiles',
    months: 'all',
    portions: [[{ grams: 30, slug: 'datiles' }]],
    role: 'dessert',
    slots: BLD
  },
```

`COMPOSED_NAMES`:

```ts
  cuscus: { 'en-GB': 'Couscous', 'es-ES': 'Cuscús' },
  mutabal: { 'en-GB': 'Moutabal', 'es-ES': 'Mutabal' },
  'ensalada-de-zanahoria-marroqui': { 'en-GB': 'Moroccan carrot salad', 'es-ES': 'Ensalada de zanahoria a la marroquí' },
  'ensalada-de-remolacha': { 'en-GB': 'Beetroot salad', 'es-ES': 'Ensalada de remolacha' },
```

`COMPOSED_PREPARATIONS`:

```ts
  cuscus: {
    'en-GB': 'Put the couscous in a bowl with the salt, pour over the same volume of boiling water, cover for 5 minutes and fluff it with a fork.',
    'es-ES': 'Pon el cuscús en un bol con la sal, cúbrelo con el mismo volumen de agua hirviendo, tápalo 5 minutos y suéltalo con un tenedor.'
  },
  mutabal: {
    'en-GB': 'Roast the whole aubergine at 200 °C for about 40 minutes, scoop out the flesh, drain it and mash it with the tahini, the lemon juice, the chopped garlic and the salt.',
    'es-ES': 'Asa la berenjena entera en el horno a 200 °C unos 40 minutos, saca la pulpa, escúrrela y cháfala con el tahini, el zumo de limón, el ajo picado y la sal.'
  },
  'ensalada-de-zanahoria-marroqui': {
    'en-GB': 'Grate the carrot and dress it with the lemon juice, the cumin, the chopped parsley, a teaspoon of oil and the salt.',
    'es-ES': 'Ralla la zanahoria y alíñala con el zumo de limón, el comino, el perejil picado, una cucharadita de aceite y la sal.'
  },
  'ensalada-de-remolacha': {
    'en-GB': 'Dice the cooked beetroot and dress it with the lemon juice, the cumin, the chopped parsley, a teaspoon of oil and the salt.',
    'es-ES': 'Corta la remolacha cocida en dados y alíñala con el zumo de limón, el comino, el perejil picado, una cucharadita de aceite y la sal.'
  },
```

`meal.accompanimentNames` (web, `es-ES` and `en-GB`):

```ts
// es-ES
      cuscus: 'cuscús',
      mutabal: 'mutabal',
      'ensalada-de-zanahoria-marroqui': 'ensalada de zanahoria a la marroquí',
      'ensalada-de-remolacha': 'ensalada de remolacha',
      datiles: 'dátiles ({grams})',
// en-GB
      cuscus: 'couscous',
      mutabal: 'moutabal',
      'ensalada-de-zanahoria-marroqui': 'Moroccan carrot salad',
      'ensalada-de-remolacha': 'beetroot salad',
      datiles: 'dates ({grams})',
```
### 5. Desserts for every family (6)

By the lead's decision, no entry is breakfast-only. These six carry breakfast among their
meals because they are realistic at lunch and dinner too, like today's fruit and yoghurt. But
the ones that will be seen are the lunch and dinner ones.

- **The four fruits** fill the thinnest months:
  - the loquat (4–5), the cherry (5–7) and the apricot (5–8) come in in spring. In April there
    are only 7 desserts on the Spanish table today.
  - the pomegranate (10–11) comes in in autumn.
  - All four are already in the `FRUIT` set of `Accompaniment.ts:399`, so the "fruit beside
    fruit" filter already knows them.
- **`yogur-con-miel`** carries milk. Honey has the `animal` class, so a vegan does not receive
  it. Kosher does not put it beside meat (`setsBeside`).
- **`macedonia`** carries orange, apple and banana. Its months are the intersection of the
  orange's and the apple's.


| Key | Role | Families | Meals | Months | Portion | kcal | P | C | F | Fibre | Allergens | Classes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `yogur-con-miel` | dessert | every family | B L D | all year | 135 g | 100.4 | 7.2 | 17.9 | 0.3 | 0 | lactose, milk | animal |
| `macedonia` | dessert | every family | B L D | 11, 12, 1, 2, 3 | 180 g | 107.4 | 1.3 | 26.7 | 0.3 | 4.4 | — | — |
| `nispero` | dessert | every family | B L D | catálogo | 150 g | 70.5 | 0.6 | 18.2 | 0.3 | 2.6 | — | — |
| `cereza` | dessert | every family | B L D | catálogo | 150 g | 94.5 | 1.7 | 24 | 0.3 | 3.2 | — | — |
| `albaricoque` | dessert | every family | B L D | catálogo | 140 g | 67.2 | 2 | 15.5 | 0.6 | 2.8 | — | — |
| `granada` | dessert | every family | B L D | catálogo | 150 g | 124.5 | 2.6 | 28.1 | 1.8 | 6 | — | — |

`ACCOMPANIMENTS`:

```ts
  {
    families: 'all',
    key: 'yogur-con-miel',
    months: 'all',
    portions: [[{ grams: 125, slug: 'yogur-natural-desnatado' }, { grams: 10, slug: 'miel' }]],
    role: 'dessert',
    slots: BLD
  },
  {
    families: 'all',
    key: 'macedonia',
    months: [11, 12, 1, 2, 3],
    portions: [[{ grams: 80, slug: 'naranja' }, { grams: 60, slug: 'manzana' }, { grams: 40, slug: 'platano' }]],
    role: 'dessert',
    slots: BLD
  },
  fruit('nispero', 150),
  fruit('cereza', 150),
  fruit('albaricoque', 140),
  fruit('granada', 150),
```

`COMPOSED_NAMES`:

```ts
  'yogur-con-miel': { 'en-GB': 'Yoghurt with honey', 'es-ES': 'Yogur con miel' },
  macedonia: { 'en-GB': 'Fruit salad', 'es-ES': 'Macedonia de fruta' },
```

`COMPOSED_PREPARATIONS`:

```ts
  'yogur-con-miel': {
    'en-GB': 'Serve the yoghurt with the honey drizzled over it.',
    'es-ES': 'Sirve el yogur con la miel por encima.'
  },
  macedonia: {
    'en-GB': 'Chop the peeled orange, the apple and the banana and toss them in a bowl in their own juice.',
    'es-ES': 'Trocea la naranja pelada, la manzana y el plátano y mézclalos en un bol con su propio zumo.'
  },
```

`meal.accompanimentNames` (web, `es-ES` and `en-GB`):

```ts
// es-ES
      'yogur-con-miel': 'yogur con miel',
      macedonia: 'macedonia de fruta',
      nispero: 'nísperos ({grams})',
      cereza: 'cerezas ({grams})',
      albaricoque: 'albaricoques ({grams})',
      granada: 'granada ({grams})',
// en-GB
      'yogur-con-miel': 'yoghurt with honey',
      macedonia: 'fruit salad',
      nispero: 'loquats ({grams})',
      cereza: 'cherries ({grams})',
      albaricoque: 'apricots ({grams})',
      granada: 'pomegranate seeds ({grams})',
```
### 6. The whole batch

| | Starch | Vegetable | Dessert | Total |
|---|---|---|---|---|
| Spanish (with "other"; 3 also Italian) | 4 | 17 | 0 | 21 |
| Asian | 1 | 3 | 0 | 4 |
| Mexican and Latin American | 3 | 3 | 0 | 6 |
| Arab and Maghrebi | 1 | 3 | 1 | 5 |
| Every family | 0 | 0 | 6 | 6 |
| **Total** | **9** | **26** | **7** | **42** |

By meal:
- 32 are lunch and dinner;
- 9 are breakfast, lunch and dinner (bread, fruit, yoghurt, dates), served at lunch and dinner;
- 1 is lunch only (`cuscus`);
- none is breakfast-only.

By kind: 32 composed, 6 simple and 4 fruit.

The list to accept or reject. The number in brackets refers to the verdict's condition.


| # | Key | Family | Role | Meals | Months | kcal | Allergens | Recommendation |
|---|---|---|---|---|---|---|---|---|
| 1 | `crema-de-calabacin` | Spanish | vegetable | L D | 5, 6, 7, 8, 9 | 102.7 | — | accept |
| 2 | `crema-de-calabaza` | Spanish | vegetable | L D | 9, 10, 11, 12, 1, 2, 3 | 137.6 | — | accept |
| 3 | `crema-de-puerros` | Spanish | vegetable | L D | all year | 187 | — | accept |
| 4 | `caldo-de-pollo` | Spanish | vegetable | L D | 10, 11, 12, 1, 2, 3, 4 | 15 | — | conditional: celery (5) |
| 5 | `caldo-de-verduras` | Spanish | vegetable | L D | 10, 11, 12, 1, 2, 3, 4 | 15 | — | conditional: celery (5) |
| 6 | `pimientos-asados` | Spanish | vegetable | L D | 7, 8, 9, 10 | 86.2 | — | accept |
| 7 | `menestra-de-verduras` | Spanish | vegetable | L D | all year | 116.7 | — | accept |
| 8 | `champinones-al-ajillo` | Spanish | vegetable | L D | all year | 84.2 | — | accept |
| 9 | `tomate-alinado` | española + italiana | vegetable | L D | 6, 7, 8, 9 | 79.2 | — | accept |
| 10 | `escalivada` | Spanish | vegetable | L D | 7, 8, 9, 10 | 106 | — | accept |
| 11 | `espinacas-a-la-catalana` | Spanish | vegetable | L D | 10, 11, 12, 1, 2, 3, 4, 5, 6 | 145.4 | tree_nuts | accept; it clashes with answer 7 (4) |
| 12 | `acelgas-rehogadas` | Spanish | vegetable | L D | 8, 9, 10, 11, 12, 1, 2, 3, 4, 5 | 88.1 | — | accept |
| 13 | `coliflor-al-ajoarriero` | Spanish | vegetable | L D | 9, 10, 11, 12, 1, 2, 3, 4 | 89.6 | — | accept |
| 14 | `alcachofas-a-la-plancha` | española + italiana | vegetable | L D | 12, 1, 2, 3, 4, 5 | 116.2 | — | accept |
| 15 | `esparragos-trigueros-a-la-plancha` | española + italiana | vegetable | L D | 3, 4, 5, 6, 9 | 74.2 | — | accept |
| 16 | `zanahorias-alinadas` | Spanish | vegetable | L D | all year | 100.5 | — | accept |
| 17 | `patata-cocida` | Spanish | starch | L D | all year | 160.4 | — | accept |
| 18 | `pure-de-patata` | Spanish | starch | L D | all year | 179.7 | lactose, milk | accept |
| 19 | `salmorejo` | Spanish | vegetable | L D | 6, 7, 8, 9 | 214.4 | gluten | accept |
| 20 | `picos-de-pan` | Spanish | starch | B L D | all year | 79.8 / 119.7 | gluten | conditional: the BEDCA row (3) |
| 21 | `pan-con-tomate` | Spanish | starch | B L D | all year | 204.4 | gluten | accept |
| 22 | `arroz-jazmin` | asian | starch | L D | all year | 182.5 | — | accept |
| 23 | `edamame` | asian | vegetable | L D | all year | 109 | soy | accept |
| 24 | `espinacas-con-sesamo` | asian | vegetable | L D | 10, 11, 12, 1, 2, 3, 4, 5, 6 | 65.8 | gluten, sesame, soy | accept |
| 25 | `kimchi` | asian | vegetable | L D | all year | 9 | crustaceans (trazas), fish (trazas) | accept |
| 26 | `yuca-con-mojo` | latin | starch | L D | all year | 240.7 | — | accept |
| 27 | `platano-macho-al-horno` | latin | starch | L D | all year | 226.6 | — | accept |
| 28 | `elote` | latin | starch | L D | 7, 8, 9 | 132.1 | — | accept |
| 29 | `guacamole` | latin | vegetable | L D | all year | 94.2 | — | accept |
| 30 | `curtido` | latin | vegetable | L D | 9, 10, 11, 12, 1, 2, 3 | 46.7 | — | accept |
| 31 | `ensalada-de-aguacate` | latin | vegetable | L D | 11, 12, 1, 2, 3, 4 | 118.2 | — | accept |
| 32 | `cuscus` | arab | starch | C | all year | 188 | gluten | accept |
| 33 | `mutabal` | arab | vegetable | L D | 6, 7, 8, 9, 10 | 101.4 | sesame | accept |
| 34 | `ensalada-de-zanahoria-marroqui` | arab | vegetable | L D | all year | 100 | — | accept |
| 35 | `ensalada-de-remolacha` | arab | vegetable | L D | all year | 102.1 | — | accept |
| 36 | `datiles` | arab | dessert | B L D | all year | 84.6 | — | accept |
| 37 | `yogur-con-miel` | every family | dessert | B L D | all year | 100.4 | lactose, milk | accept |
| 38 | `macedonia` | every family | dessert | B L D | 11, 12, 1, 2, 3 | 107.4 | — | accept |
| 39 | `nispero` | every family | dessert | B L D | 4, 5 (catálogo) | 70.5 | — | accept |
| 40 | `cereza` | every family | dessert | B L D | 5, 6, 7 (catálogo) | 94.5 | — | accept |
| 41 | `albaricoque` | every family | dessert | B L D | 5, 6, 7, 8 (catálogo) | 67.2 | — | accept |
| 42 | `granada` | every family | dessert | B L D | 10, 11 (catálogo) | 124.5 | — | accept |

## Rows that are missing

**No slug is missing from the catalogue.** The 42 entries use 64 distinct rows, all of them in
the seed. There are two data changes that are not insertions, and so do not fit the
`INSERT … ON CONFLICT (slug) DO NOTHING` phase 2 describes:

1. **Re-source `picos-de-pan`** (today BEDCA: 399 kcal, 11 g of protein, 73 g of carbohydrate,
   7 g of fat and 3.5 g of fibre per 100 g). The proposal:

   | Field | Value |
   |---|---|
   | FDC id | **174929** (SR Legacy) |
   | Description | Bread, sticks, plain |
   | Per 100 g | 412 kcal · 12.0 g protein · 68.4 g carbohydrate · 9.5 g fat · 3.0 g fibre (measured: the FoodData Central API, 2026-10-03) |
   | Allergens | `gluten` (contains). I also propose `sesame` as traces: it is a **hypothesis**, because many Spanish breadsticks warn "may contain sesame". It has to be checked on two or three labels before the migration |
   | Effect | The 30 g portion goes from 119.7 to 123.6 kcal. The dishes that already use the row change too |

   It is an `UPDATE` of a production row, and it is one of the 14 BEDCA rows whose re-sourcing
   is queued (`000-workspace` LOG). I recommend doing it inside that task, not here, and
   leaving `picos-de-pan` out of this batch until then.
2. **Declare the celery in the broths** (condition 5): add the `celery` link to
   `caldo-de-pollo` and `caldo-de-verduras`. I recommend `contains` rather than `may_contain`.
   The row is generic, and celery is usually in a carton broth's ingredient list, not only in
   the traces. That it always is, is a **hypothesis**: three supermarket labels have to be
   read. It is an insertion into the allergen link table and it can go in phase 2's reviewed
   migration, with its `ON CONFLICT DO NOTHING`.

If the lead accepts the broths, **phase 2 is not skipped**, even though no slug is missing.

## Checks

I ran them with a script over the seed. There was no database and no model.

| Check | Result |
|---|---|
| Every slug is in the catalogue | 42 of 42 entries; 64 of 64 rows |
| Each row's source | all `usda`, except `picos-de-pan` (`bedca`). None `manual` |
| The Spanish entries carry no `traditional_spanish` row (`Preference.ts:98`) | 0 of 21 |
| The oil in the phrase matches the one in the portion, in both languages | 32 of 32 composed |
| The literals give exactly the entries in the tables | 42 of 42; the 32 composed by `isComposed` have a name and a preparation |
| No group from table 2 leaves a dead cell (a family × declared meal the code would never offer) | none |
| The declared months come from the fresh rows | yes, except the broths and `pan-con-tomate` (declared, see § How the batch is made) |

## Requirements

- **Code (phase 3)**:
  - paste the accepted entries into `ACCOMPANIMENTS`, `COMPOSED_NAMES` and
    `COMPOSED_PREPARATIONS`, ordering the keys as the linter asks;
  - paste their phrases into `meal.accompanimentNames`, in `es-ES` and `en-GB`;
  - fix the comment at `Accompaniment.ts:74–82` ("USDA rows only"), which is already untrue
    today;
  - the PRD's tests, criterion 5:
    - milk: `pure-de-patata` and `yogur-con-miel`;
    - gluten: `salmorejo`, `pan-con-tomate` and `cuscus`;
    - tree nuts at lunch and dinner: `espinacas-a-la-catalana`;
    - "traditional Spanish never receives a foreign one": through `setsBeside`, with a dish of
      that family, and at least with `ensalada-de-zanahoria-marroqui` or `elote`, which carry
      no `0077` row;
  - the count of distinct accompaniments per profile and fortnight in the evaluator.
- **Data (phase 2)**: the two celery links, if the broths are accepted. `picos-de-pan` waits
  for the BEDCA task.
- **Infrastructure and money**: none. €0. No model call. The measurement runs on
  `pnpm db:local` with `NUTRIA_LOCAL_PG=1`, never on Neon.
- **The lead's decisions** (the owner delegated them on 2026-10-03):
  - accept or reject each entry;
  - `picos-de-pan` (3);
  - `espinacas-a-la-catalana` (4);
  - the broths (5);
  - what to do if the time passes +10% (§ Risks, point 3).
- **The owner's time**: none.

## Risks

1. **Safety: undeclared celery in the broths.**
   - **Likelihood**: high. Carton broth usually carries celery (**hypothesis**, to be checked
     on labels).
   - **Who it affects**: somebody allergic to celery, who would receive a bowl of broth with
     nothing stopping it.
   - **How it would show**: it does not show in the code. Only on the label.
   - **How to undo it**: do not accept the broths, or add the link in phase 2. The link also
     protects the dishes that already use those rows.
2. **Safety: new allergens on the table.**
   - **What comes in**:
     - tree nuts at lunch and dinner (`espinacas-a-la-catalana`);
     - sesame (`mutabal`, `espinacas-con-sesamo`);
     - soy (`edamame`, `espinacas-con-sesamo`);
     - gluten (`salmorejo`, `pan-con-tomate`, `cuscus`, `espinacas-con-sesamo`,
       `picos-de-pan`);
     - milk (`pure-de-patata`, `yogur-con-miel`);
     - traces of fish and crustaceans (`kimchi`).
   - **Who stops it**: everything goes through the same `dishSafety` that judges the plates.
     The only real risk is a catalogue row with a wrong link.
   - **I reviewed the rows used**: I only found the celery case. Pine nuts are marked as tree
     nuts, even though annex II of Regulation 1169/2011 does not name them. It is the cautious
     option and I leave it that way.
3. **`schedulePlan`'s time.**
   - **How much the sets grow**: `setsOf` forms the product of the three roles, and
     `rankedSets` prices every set per cache key (dish, meal, month and the day's budget). The
     table below is measured by combinatorics over the list, counting portions (a bread has
     two) and without each person's or the dish's filters. So it is a ceiling.
   - **What I do not know**: what share of `schedulePlan`'s time goes on pricing sets
     (**unknown**).
   - **Signal to stop**: more than +10% against 017's closing figure on phase 3's first
     measurement.
   - **Remedy**:
     - prune each role before the product, for instance keeping the 4 portions of each role
       that best close the gap on their own. It is a scheduler change and the lead decides it;
     - or bring the batch in in two rounds: the seasonal ones first and the all-year ones
       after.
   - **How to undo it**: remove entries.
4. **Accompaniments with almost no energy.**
   - **Which**: the broths (15 kcal) and `kimchi` (9 kcal).
   - **The problem**: they barely move a set's cost, so "X + broth" nearly ties with "X".
   - **What could happen** (**hypothesis**): that they take top-6 places as near duplicates,
     or that they are added nearly always because they come free.
   - **How it would show**: in the evaluator, each key's frequency.
   - **How to undo it**: remove them, or give them a larger portion.
5. **Variety does not rise.** It is condition 2's hypothesis.
   - **How it would show**: the evaluator's new count of distinct ones.
   - **Remedy**: a cost for repeating an accompaniment. The PRD rules out "new rules", so the
     lead decides.
6. **The table's order decides the ties.** An entry added at the end loses every tie against
   today's. Where the entries are pasted changes the plans. Phase 3 must place them
   deliberately, beside the ones of their role and family as the file does, and measure.

| Family | Meal | Sets today (the mean of 12 months) | With the batch (mean) | Factor | Maximum with the batch (month: starch/vegetable/dessert, against today) |
|---|---|---|---|---|---|
| Spanish | lunch and dinner | 410 | 2,666 | ×6.5 | 2,940 (November: 13/13/14; today 8/3/11) |
| Italian | lunch and dinner | 245 | 437 | ×1.8 | 648 (June: 8/5/11; today 8/3/8) |
| Asian | lunch and dinner | 343 | 847 | ×2.5 | 990 (November: 10/5/14; today 9/2/11) |
| Latin American | lunch and dinner | 411 | 980 | ×2.4 | 1,260 (November: 13/5/14; today 11/2/11) |
| Arab | lunch | 485 | 1,083 | ×2.2 | 1,344 (July: 11/7/13; today 10/4/9) |
| Arab | dinner | 469 | 953 | ×2.0 | 1,120 (July: 9/7/13; today 9/4/9) |

77% of the library is Spanish (947 of 1,229 dishes, `0079`), so the figure that matters is the
first row.

## Cost and effort

Everything is **estimated**, with an opus agent at medium effort, as the plan says.

| Work | Effort | What it depends on |
|---|---|---|
| Phase 2: two celery links and their review | 1–2 agent-hours | whether the broths are accepted |
| Phase 3: pasting, names, web phrases, the comment | 1–2 h | the number of entries accepted |
| Phase 3: tests and the distinct count in the evaluator | 2–3 h | — |
| Phase 3: measuring with and without the flag over the reference library | 1–3 h | `schedulePlan`'s time, which I do not know |
| If roles have to be pruned | +2–4 h, and a decision from the lead | the first measurement |
| Money | €0 | — |

## Plan

It goes in small phases for 018's `PLAN`, as an amendment to its phases 2 and 3.

1. **Phase 2, only if the broths are accepted.**
   - **What**: the migration with the two `celery` links and the seed to match.
   - **Success**: `pnpm db:local reset --reference`, `check-migrations`, and
     `migration-reviewer`'s approval.
   - **Stop**: the reviewer rejects it.
   - `picos-de-pan` does not go here.
2. **Phase 3a: measure the time before anything else.**
   - **What**: paste the accepted entries and run the evaluator with and without the flag,
     with `ms` per profile.
   - **Success**: within +10% of 017's closing figure.
   - **Stop**: if it passes +10%, do not go on. Take the per-role pruning or the two-round
     entry to the lead.
3. **Phase 3b: the rest of phase 3.**
   - **What**: the tests, the names, the web phrases and the distinct count.
   - **Success**: the PRD's criterion 4 (196/196 days in band, 0 allergens, 0 snacks in a main
     meal, and the distinct count rising).
   - **Stop**: a day lost, an allergen, or the distinct count not rising. In that case it goes
     to the lead as a repetition rule.
4. **Outside 018, to be decided.**
   - Re-source `picos-de-pan` with the BEDCA task.

## What I do not know

- **What share of `schedulePlan` is pricing sets.** Only phase 3a says.
- **Whether the 64 rows are also in the database.** I checked them against the seed. If a seed
  row had not yet reached production, `larderFor` would discard the entry silently
  (`Accompaniment.ts:374`): it is safe, but invisible. Phase 3a, over the reference library,
  confirms it with real data.
- **Whether distinct accompaniments per fortnight rise.** It is a hypothesis. The evaluator's
  new count says.
- **Whether Spanish carton broths always carry celery, and whether breadsticks carry traces of
  sesame.** It is settled by reading three labels of each.
- **How many meals pass 700 kcal in each profile.** Only those receive accompaniments, so that
  sets the ceiling on the variety that can be seen. The evaluator already gives the spread of
  0–3 accompaniments per meal.
- **Whether "Bread, sticks, plain" (FDC 174929) is a good substitute for breadsticks.** The
  figures are close to BEDCA's (412 against 399 kcal). The Andalusian breadstick recipe carries
  oil and may have a little more fat. Whoever re-sources the 14 rows decides.


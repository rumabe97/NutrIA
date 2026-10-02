# 0079 — A dish fits a meal by its cuisine, and its accompaniments come from that cuisine

- **Status**: accepted (owner, 2026-10-02, with the nine answers under "Owner's answers")
- **Date**: 2026-10-02
- **Deciders**: owner ("en la mediterránea el arroz no encajaría en cena, pero en la asiática sí… acompañantes que no fuera solamente pan: ensaladas, en Asia ponen arroz… quiero que sea súper profesional"); agent `architect`: the tables, the sources, the measurement. The owner answered the nine open questions and decided that no BEDCA data is used anywhere
- **Project**: docs/projects/016-a-spanish-meal (phase 2)
- **Relates to**: [`0062`](./0062-each-meal-sees-its-own-foods-and-the-season.md) (meal lists — amended for five food groups, see Consequences), [`0063`](./0063-lunch-and-dinner-see-what-the-library-cooks-plus-a-rotating-sample.md), [`0077`](./0077-traditional-spanish-is-a-way-of-eating-enforced-in-code.md) (cuisine normalisation, `traditional_spanish`), [`0078`](./0078-a-plate-has-a-gram-ceiling-and-cooked-grains-read-dry.md) (yields), architect report [`0008`](../reference/architecture/0008-una-comida-a-la-espanola-2026-10-02.md) (accompaniments, design A). It replaces step 1 of plan phase 7 ("pasta, rice and couscous lunch-only by data migration").

## In one minute

- **Six cuisine families**, read from the recipe's `cuisine` text. A dish with no cuisine, or one nobody mapped, is judged as Spanish. That is the strictest table, so a mistake can only take a meal away from a dish, never add one.
- **Five food groups decide where a dish fits**: rice, pasta, couscous and other grains, potato, and stewed pulses. Each is recognised from catalogue slugs and grams.
  - Bread, salads, vegetables and soups fit every main meal everywhere, so they need no rule.
  - "Fried" and "heavy sauce" cannot be recognised from the data, so they are left out (measured below).
- **Spanish dinner loses rice, pasta and grains.** Asian keeps rice at dinner. Italian keeps pasta at dinner. Italian, Asian and Mexican/Latin also keep pulses at dinner (option B, chosen by the owner).
- **Accompaniments come from the dish's family.**
  - Spanish: bread, salad, gazpacho, vegetables, fruit, yoghurt.
  - Asian: plain rice, miso soup, cucumber salad, pak choi.
  - Mexican: corn tortillas, pico de gallo, beans, red rice.
  - Arab/Maghreb: pita, Moroccan salad, hummus, tabulé, orange with cinnamon.
  - Every accompaniment ingredient exists in the catalogue, and its macros are computed from it.
- **Measured on the dev library** (read-only), no slot drops under the 19 dishes a fortnight needs, for any of the five people measured (a vegan keeps 57 dinners).
  - Spanish/Mediterranean dinners fall from 236 to 133 (omnivore) and from 181 to 112 (`traditional_spanish`).
  - The hardest case, `traditional_spanish` with coeliac disease and no milk, keeps 81 dinners.
- **The owner answered the nine open questions on 2026-10-02.** The answers are listed at the end, and the tables below already apply them.

## Context

`0062` says which meals a food belongs to, one ingredient at a time, for everybody. It cannot say "rice is a dinner in Asia and a lunch in Spain". It also has no notion of a dish's tradition. Today `arroz-*`, pasta and the grains belong to lunch and dinner for every dish, and the stewed pulses to lunch only. The owner's own production plan served pasta and rice at dinner (plan phase 7).

`0008` designed accompaniments as a fixed list of bread, fruit, yoghurt, nuts and cheese. The owner asked for more: salads, and what each tradition actually puts beside the plate.

**The family signal is weak, and that shapes everything below.** On the dev library (es-ES, test leftovers removed), 947 of 1,229 dishes say `mediterránea`, `española` or a Spanish region. Every other family has fewer than 90 dishes:

| Family | Dishes |
|---|---|
| Spanish/Mediterranean | 947 |
| Other (no family) | 103 |
| Asian | 84 |
| Mexican/Latin | 45 |
| Italian | 34 |
| Arab/Maghreb | 16 |

So the families are about getting the few foreign dishes right. They are not about coverage. The only cell this record can starve is Spanish × dinner.

## Decision

### Table 1 — Cuisine families

A recipe's `cuisine` is normalised exactly as `0077` does (`normaliseForMatching`: lower case, accents removed, punctuation turned into a space). It is then looked up here.

| Family | Normalised values (all seen in the dev library, or obvious siblings) | Dev dishes | `0077` says foreign? |
|---|---|---|---|
| **Española y mediterránea** | `mediterranea`, `mediterranean`, `espanola`, `spanish`, `espana`, `mediterranea espana`, `mediterranea espana italia`, `griega`, `greek`, `tapa`, and the regions: `vasca`, `riojana`, `gallega`, `madrilena`, `valenciana`, `catalana`, `asturiana`, `aragonesa`, `manchega`, `andaluza`, `castellana`, `extremena`, `canaria`, `murciana`, `navarra`, `cantabra`, `leonesa` | 947 | no |
| **Italiana** | `italiana`, `italian` | 34 | no |
| **Asiática** (East, South-East and South Asia) | `asiatica`, `asian`, `oriental`, `china`, `japonesa`, `coreana`, `tailandesa`, `vietnamita`, `india`, `indio`, `indian`, `hawaiana` (poke) | 84 | yes, all |
| **Mexicana y latina** | `mexicana`, `mexican`, `latina`, `peruana`, `venezolana`, `colombiana`, `argentina`, `cubana`, `caribena` | 45 | yes, all |
| **Árabe y magrebí** | `marroqui`, `moroccan`, `magrebi`, `arabe`, `libanesa`, `oriente medio`, `levantina`, `turca` | 16 | yes, all |
| **Otras** (judged with the Spanish table) | null, empty, `internacional`, `fusion`, `moderna`, `sana`, `continental`, `europea`, `centroeuropea`, `francesa`, `americana`, `estadounidense`, `nordica`, `escandinava`, `tropical`, and any value not listed above | 103 | some (`0077`'s list) |

**The rule for null and unknown values.** They take the Spanish table. NutrIA's users eat in Spain, so a dish that does not say where it is from is judged by their table. The Spanish table is also the strictest: a foreign dish mislabelled `mediterránea` (`0077` found skyr bowls and tacos under that word) can only lose a meal, never gain one.

**It is consistent with `0077` both ways.** Every value in `FOREIGN_CUISINES` lands in Asian, Mexican/Latin, Arab/Maghreb or Other. Everything `0077` lets through lands in Spanish, Italian or Other:
- `mediterránea`, `española` and the regions;
- `italiana`, `francesa`, `griega`;
- null.

**Kept out on purpose:**
- **India is not a family of its own.** A thali puts rice and dal at lunch and at dinner, as the Asian row says. Its 21 dishes do not justify a seventh table.
- **French, Nordic and American are not families either.** Their 30 dishes are almost all breakfasts and snacks, where no group rule applies.

### Table 2 — What fits each meal, by family

**How each group is recognised.** Grams are per serving (recipe grams ÷ `servings`). A cooked grain reads in dry weight through the `0078` yields, so 150 g of `arroz-blanco-cocido` counts as 50 g of rice.

| Group | Catalogue rows | A dish belongs to it when |
|---|---|---|
| **Arroz** | the `arroz-*` cooking rows: `arroz-blanco-cocido`, `-integral-`, `-basmati-`, `-salvaje-` (cooked and raw), `arroz-largo-crudo`, `arroz-jazmin-crudo`, `arroz-bomba-crudo`, `arroz-negro-crudo`, `arroz-para-sushi`, `arroz-vaporizado`, `arroz-tres-delicias-congelado`, `paella-congelada`. Not rice: `tortitas-de-arroz`, `arroz-con-leche`, `arroz-hinchado`, `harina-`, `bebida-`, `vinagre-` and `papel-de-arroz` | ≥ 40 g dry |
| **Pasta y fideos** | `espaguetis-secos`, `macarrones-secos`, `pasta-integral-seca`, `pasta-cocida`, `pasta-integral-cocida`, `fideos-finos`, `fideos-de-arroz-*`, `fideos-soba`, `fideos-de-cristal`, `noodles-*`, `pasta-sin-gluten`, `pasta-de-lentejas`, `pasta-de-garbanzos`, `tortellini`, `raviolis-frescos`, `pasta-fresca-al-huevo`, `placas-de-lasana`, `ramen-instantaneo`, `lasana-preparada`, `canelones-preparados`, `sopa-de-fideos-envasada` | ≥ 40 g dry |
| **Cuscús y otros granos** | the other `0078` grains: `cuscus-*`, `bulgur-*`, `quinoa-cocida`, `quinoa-cruda`, `mijo*`, `trigo-sarraceno*`, `cebada-*`, `espelta-*`, `polenta*`, `freekeh`, `amaranto`. Oats are a breakfast food and are not here | ≥ 40 g dry |
| **Patata y boniato** | `patata`, `patata-nueva`, `boniato`, `yuca`, `patatas-gajo-congeladas`, `patatas-fritas-congeladas`, `pure-de-patatas-en-copos` | ≥ 100 g |
| **Legumbre guisada** | the 23 rows of `seed/ingredients/meals.ts` rule 1 (lentils, chickpeas, beans, dry broad beans, tinned pulse stews) | any amount, as `0062` does today |

The 40 g threshold is two thirds of a plate of rice or pasta. The AESAN sets a plate at 60–80 g dry. Below the threshold the group is an ingredient, not the dish: the spoonful of rice in a soup. Its sensitivity is measured below.

**Not a group, on purpose:**
- **Bread, salads, vegetables, soups and creams** fit every main meal in every family. The sources below put vegetables and bread at every main meal. They follow the `0062` lists as today.
- **Fried, battered, and cream or cheese sauces.** The official advice is clear: dinner should be "más ligera… con preparaciones suaves" (Rioja Salud). But nothing in the data recognises them. No fried catalogue row is used by any dev recipe, and `nata-para-cocinar` appears once. A name pattern (`frito|rebozado|crujiente|…`, `nata|cremoso|gratinado|…`) matched 32 and 25 dishes, most of them wrong: "Yogur proteico con nueces crujientes", "Requesón cremoso con fresas". A cell no code can enforce does not go in the table. To have it, new dishes would have to state their cooking technique, which is a prompt change out of this record.

**The grid.** "sí" means the group may be in a dish served at that meal. "no" takes that meal away from a dish carrying the group. A group a family's row does not name is unrestricted. Abbreviations: B breakfast, MS morning snack, L lunch, AS afternoon snack, D dinner, Su supper.

**Española y mediterránea** (also "Otras")

| Group | B | MS | L | AS | D | Su | Reason |
|---|---|---|---|---|---|---|---|
| Arroz | no | no | sí | no | no | no | Arroces (paella, caldoso, meloso) are the midday meal in Spain (owner). The AESAN notes rice "forma parte de recetas culinarias ampliamente consumidas", and those are lunches |
| Pasta y fideos | no | no | sí | no | no | no | Pasta is a Spanish primer plato at lunch (owner, plan phase 7). Dinner is "más ligera y moderada que la comida" (Rioja Salud) |
| Cuscús y otros granos | no | no | sí | no | no | no | Treated like rice (owner, answer 3). Quinoa beside fish at dinner would have kept 41 more dinners |
| Patata y boniato | no | sí | sí | no | sí | no | Tortilla and patatas con huevo are Spanish dinners ("tortilla con ensalada, pescado al horno con patata cocida", Rioja Salud). An individual tortilla is fine as an almuerzo (morning snack). Not at breakfast (owner, answer 4) |
| Legumbre guisada | no | no | sí | no | no | no | Unchanged from `0062`. Light pulse forms (hummus, salads) keep dinner through `0062` rule 2, which is how the AESAN's "legumes in one of the two main meals" is met at night |

**Italiana**

| Group | B | MS | L | AS | D | Su | Reason |
|---|---|---|---|---|---|---|---|
| Arroz | no | no | sí | no | sí | no | Risotto is a primo at pranzo or cena |
| Pasta y fideos | no | no | sí | no | sí | no | The Italian guidance counts cereals at "1–2 porzioni a pasto", every meal (Smartfood/IEO portions table); pasta at cena is ordinary |
| Cuscús y otros granos | no | no | sí | no | sí | no | Farro, orzo and polenta stand in for pasta at either meal |
| Patata y boniato | no | no | sí | no | sí | no | A contorno at either meal |
| Legumbre guisada | no | no | sí | no | sí | no | Pasta e fagioli and minestrone are classic cene. Applied through option B (owner, answer 5) |

**Asiática**

| Group | B | MS | L | AS | D | Su | Reason |
|---|---|---|---|---|---|---|---|
| Arroz | no | sí | sí | sí | sí | no | The staple of every meal ("eat well-balanced meals with staple food, as well as main and side dishes", Japan's guidelines; cereals at every meal on China's plate). Onigiri is a snack. Not at breakfast: congee is a dish of its own the library lacks, and the one dish that would enter is a poke bowl at 8 a.m. |
| Pasta y fideos | no | no | sí | no | sí | no | Noodles are lunch or dinner |
| Cuscús y otros granos | no | no | sí | no | sí | no | Rare. Same as rice at main meals |
| Patata y boniato | no | no | sí | no | sí | no | In curries, at either meal |
| Legumbre guisada | no | no | sí | no | sí | no | Dal with rice or roti makes the thali, "served for lunch or dinner" (Indian home cookery). Applied through option B |

**Mexicana y latina**

| Group | B | MS | L | AS | D | Su | Reason |
|---|---|---|---|---|---|---|---|
| Arroz | no | no | sí | no | sí | no | Arroz rojo goes with the comida. Across Latin America rice and beans are lunch and dinner (Peruvian lomo saltado, Caribbean) |
| Pasta y fideos | no | no | sí | no | no | no | Sopa de fideo is the comida's first course, not a cena |
| Cuscús y otros granos | no | no | sí | no | sí | no | Quinoa (Peru) at either main meal |
| Patata y boniato | no | no | sí | no | sí | no | At either main meal |
| Legumbre guisada | sí | no | sí | no | sí | no | The Mexican guidelines ask for "frijoles, lentejas o habas" daily, and molletes and enfrijoladas are breakfasts and dinners. Applied through option B |

**Árabe y magrebí**

| Group | B | MS | L | AS | D | Su | Reason |
|---|---|---|---|---|---|---|---|
| Arroz | no | no | sí | no | no | no | The main meal is midday. Dinner is lighter: soup, tagine with bread |
| Pasta y fideos | no | no | sí | no | no | no | As rice |
| Cuscús y otros granos | no | no | sí | no | no | no | Couscous is the Friday family lunch ("Moroccans go home for lunch to eat couscous", Yale Globalist) |
| Patata y boniato | no | no | sí | no | sí | no | In a tagine, eaten with bread, at either meal |
| Legumbre guisada | no | no | sí | no | no | no | Unchanged from `0062`. Harira at dinner is a Ramadan custom, too narrow for a rule |

### Table 3 — Accompaniments by family

These are a fixed list in code (`core/domain/Accompaniment`, shaped like `Yield`, as `0008` decided), never recipes. Macros are computed from the catalogue's per-100 g values, so the record gives no figure the code would not compute itself. **No BEDCA data is used anywhere** (owner, 2026-10-02). The product uses public-domain USDA FoodData Central values. Every accompaniment row below is USDA-sourced today except `queso-de-burgos`. That is one of the 14 rows still marked `source: 'bedca'` in `seed/ingredients/starter.ts`, and a separate task re-sources them to USDA. Its 3a figures will change then. `vinagre-de-jerez`, another of the 14, was replaced by `vinagre-de-vino-tinto` (USDA) in every composed recipe. Grains are in dry weight (`0078`).

**3a — Simple accompaniments** (an ingredient and discrete portions)

| Accompaniment | Slugs | Portions | kcal per portion (catalogue) | Main meals | Season | Contains |
|---|---|---|---|---|---|---|
| Pan | `pan-blanco`, `pan-integral`, `pan-de-centeno`, `pan-de-masa-madre`; `pan-sin-gluten` when the person's exclusions call for it | 30 g, 60 g (AESAN: 40–60 g per ration) | 87 / 174 (blanco), 76 / 151 (integral) | B, L, D | all year | gluten (except `pan-sin-gluten`). `pan-de-semillas` is **not** in the list: it may contain sesame and tree nuts |
| Fruta de temporada | `naranja` 130 g, `mandarina` 2 × 80 g, `manzana` 180 g, `pera` 170 g, `kiwi` 2 × 75 g, `platano` 120 g, `melocoton` 150 g, `nectarina` 140 g, `caqui` 170 g, `uva` 150 g, `fresa` 150 g, `melon` 200 g, `sandia` 200 g, `pina` 150 g | one piece (`grams_per_unit`), or the grams shown (AESAN: 120–200 g) | 48–107 | B, L, D | each fruit's `season_months`; `platano` and `pina` all year | — |
| Yogur | `yogur-natural-desnatado`, `yogur-griego-natural` | 125 g | 70 / 121 | B, L, D | all year | milk |
| Frutos secos | `nueces`, `almendras` | 20 g, 30 g (AESAN: 20–30 g, "un puñado") | 131 / 196 (nueces) | B (owner, answer 7) | all year | tree nuts |
| Queso fresco | `queso-de-burgos`, `requeson` | 60 g | 79 / 59 | B (owner, answer 7) | all year | milk. `queso-de-burgos` is BEDCA-sourced until it is re-sourced to USDA |
| Tortillas de maíz (Mexican) | `tortilla-de-maiz` | 2 or 3 (60 g / 90 g) | 131 / 196 | B, L, D | all year | — |
| Pan de pita (Arab) | `pan-de-pita` | 1 (60 g) | 165 | B, L, D | all year | gluten |
| Hummus (Arab) | `hummus` | 30 g, 60 g | 71 / 142 | L, D | all year | sesame |

**3b — Composed accompaniments** (small fixed recipes; every slug exists in the dev catalogue, checked 2026-10-02)

| Accompaniment | Ingredients, g per person | Total | kcal · P · C · F (catalogue) | Main meals | Months | Contains |
|---|---|---|---|---|---|---|
| Ensalada verde | `lechuga` 80, `cebolla` 15, `aceite-de-oliva-virgen-extra` 5, `vinagre-de-vino-tinto` 5, `sal` 0.5 | 106 g | 63 · 1.3 · 3.7 · 5.1 | L, D | all year | — |
| Ensalada mixta | `lechuga` 60, `tomate` 100, `cebolla` 15, AOVE 5, `vinagre-de-vino-tinto` 5, `sal` 0.5 | 186 g | 78 · 1.9 · 7.0 · 5.3 | L, D | 6–9 (tomato) | — |
| Ensalada de invierno | `canonigos` 40, `naranja` 80, `zanahoria` 40, AOVE 5, `vinagre-de-vino-tinto` 5, `sal` 0.5 | 171 g | 108 · 1.9 · 14.7 · 5.3 | L, D | 11–3 | — |
| Gazpacho | `tomate` 180, `pepino` 30, `pimiento-verde` 20, `ajo` 2, AOVE 10, `vinagre-de-vino-tinto` 5, `sal` 1 | 248 g | 133 · 2.1 · 9.7 · 10.4 | L, D | 6–9 (stated, not derived: the green pepper's own months would drop June) | — |
| Verduras a la plancha | `calabacin` 100, `pimiento-rojo` 50, `berenjena` 50, AOVE 5, `sal` 0.5 | 206 g | 87 · 2.2 · 9.1 · 5.5 | L, D | 6–9 | — |
| Brócoli salteado | `brocoli` 150, `ajo` 3, AOVE 5, `sal` 0.5 | 159 g | 100 · 4.4 · 10.9 · 5.6 | L, D | 10–6 | — |
| Judías verdes rehogadas | `judia-verde` 150, `ajo` 3, AOVE 5, `sal` 0.5 | 159 g | 95 · 2.9 · 11.5 · 5.3 | L, D | 8–10 | — |
| Insalata mista (Italian) | `lechuga` 60, `tomate-cherry` 60, `zanahoria` 30, AOVE 5, `vinagre-balsamico` 5, `sal` 0.5 | 161 g | 81 · 1.7 · 7.8 · 5.2 | L, D | 6–9 | sulphites (may contain) |
| Arroz blanco (Asian) | `arroz-largo-crudo` 50 (≈150 g cooked), `sal` 0.5 | 51 g dry | 183 · 3.5 · 40.0 · 0.3 | L, D (Asian table) | all year | — |
| Sopa de miso (Asian) | `miso` 15, `tofu-sedoso` 40, `alga-wakame` 2, `cebolleta` 5 (and water) | 62 g + water | 62 · 5.3 · 5.7 · 2.4 | L, D | all year | soy, gluten (may contain) |
| Ensalada de pepino (Asian) | `pepino` 120, `vinagre-de-arroz` 10, `sesamo` 3 | 133 g | 37 · 1.4 · 5.5 · 1.6 | L, D | 6–9 | sesame |
| Pak choi salteado (Asian) | `pak-choi` 150, `ajo` 3, `jengibre-fresco` 3, AOVE 5, `salsa-de-soja-baja-en-sal` 5 | 166 g | 73 · 2.8 · 5.1 · 5.3 | L, D | all year | soy, gluten |
| Arroz rojo (Mexican) | `arroz-largo-crudo` 40, `tomate-triturado` 40, `cebolla` 15, `ajo` 2, AOVE 5, `sal` 0.5 | 103 g | 214 · 3.8 · 37.7 · 5.4 | L, D (Mexican table) | all year (crushed tomato from a jar) | — |
| Pico de gallo (Mexican) | `tomate` 80, `cebolla` 20, `cilantro` 5, `lima` 10, `jalapeno` 5, `sal` 0.5 | 121 g | 28 · 1.2 · 6.5 · 0.2 | L, D | 6–9 | — |
| Frijoles (Mexican) | `alubias-negras-cocidas` 100, `cebolla` 15, `ajo` 2, `sal` 0.5 | 118 g | 141 · 9.2 · 25.8 · 0.5 | B, L, D (option B) | all year | — |
| Ensalada marroquí (Arab) | `tomate` 80, `pepino` 60, `cebolla` 15, `perejil` 5, AOVE 5, `limon` 5, `sal` 0.5 | 171 g | 77 · 1.5 · 7.5 · 5.3 | L, D | 6–9 | — |
| Tabulé (Arab) | `bulgur-crudo` 30, `tomate` 50, `pepino` 30, `perejil` 15, `hierbabuena` 5, `limon` 10, AOVE 5, `sal` 0.5 | 146 g | 171 · 5.1 · 28.1 · 5.7 | L (grains, Arab table) | 6–9 | gluten |
| Naranja con canela (Arab) | `naranja` 130, `canela-molida` 1 | 131 g | 64 · 1.2 · 16.1 · 0.1 | L, D | 11–5 | — |

Oil appears only inside a composed recipe, the way the AESAN advises dressing vegetables ("aliñadas con aceite de oliva y vinagreta"). It is never served on its own (`0008`, plan out of scope).

**3c — What each family puts beside the plate.** A set is at most three things:
- one bread or starch side;
- one vegetable side;
- one dessert (fruit, yoghurt, or the Arab orange).

"None" is always a set. The scheduler picks among the K = 6 best-fitting sets per main meal (`0008`). This table says only what may enter.

| Family | Bread or starch | Vegetable side | Dessert | Typical lunch | Typical dinner |
|---|---|---|---|---|---|
| Española y mediterránea (and Otras) | pan | ensalada verde / mixta / de invierno, gazpacho, verduras a la plancha, brócoli, judías verdes | fruta de temporada, yogur | pan + ensalada mixta + fruta | ensalada verde + yogur, or pan + fruta |
| Italiana | pan | insalata mista, ensalada verde, verduras a la plancha | fruta de temporada | pan + insalata mista + fruta | insalata + fruta |
| Asiática | arroz blanco | sopa de miso, ensalada de pepino, pak choi salteado | fruta de temporada | arroz + sopa de miso | arroz + pak choi |
| Mexicana y latina | tortillas de maíz, arroz rojo (rice cell of the table) | pico de gallo, frijoles, ensalada verde | fruta de temporada | tortillas + frijoles + fruta | tortillas + pico de gallo |
| Árabe y magrebí | pan de pita, tabulé (lunch) | ensalada marroquí, hummus, ensalada verde | naranja con canela, yogur, fruta | pita + ensalada marroquí + naranja con canela | pita + hummus |

Every simple accompaniment, except the family breads and hummus, is open to every family as a dessert or a bread. Nuts and cheese fit breakfast only (owner, answer 7).

**3d — What filters an accompaniment for one person.** Every filter is the same code that already filters dishes. Nothing is asked of the model.

| Filter | How |
|---|---|
| **Allergies and intolerances** | The accompaniments' grams enter `meal.ingredients` (`0008`), so `dishSafety` and `assertPlanIsSafe` judge the whole meal. That covers `contains`, and `may_contain` for whoever set it. Tests (phase 3): gluten in bread and pita; milk in yoghurt and cheese; tree nuts; sesame in hummus and in the cucumber salad; soy and gluten in miso and soy sauce |
| **Ways of eating** | `excludedIngredientIds`, as for dishes. For vegans that means no yoghurt or cheese. For **`traditional_spanish`** the `0077` list already removes all of these, with no new rule: `tortilla-de-maiz`, `pan-de-pita`, `pan-naan`, `hummus`, `tzatziki`, `miso`, `tofu-sedoso`, `alga-wakame`, `vinagre-de-arroz`, `sesamo`, `pak-choi`, `jengibre-fresco`, `salsa-de-soja-baja-en-sal`, `jalapeno`, `alubias-negras-cocidas`, `bulgur-crudo`. A composed accompaniment with any one of them is out whole. Those families' dishes are already out for that person, so nothing is lost |
| **Kosher** | `breaksDishRule` runs on the dish and its accompaniments together: no yoghurt or cheese beside meat (`0008`, risk 2) |
| **Dislikes** | `excludedIngredientIds`. A disliked ingredient removes every accompaniment containing it |
| **Season** | **A hard filter for accompaniments**, unlike dishes (`0062` § 6 only orders those). An accompaniment is a choice among equivalents, so there is no reason to serve a December tomato salad when a winter one exists. Fruit uses its catalogue `season_months`. A composed accompaniment uses the months stated in 3b, on the month of the day it is served (owner, answer 8) |
| **Meal** | The "Main meals" column above, and Table 2 for the accompaniment's own group (Asian rice beside a dinner is allowed; Spanish rice never) |
| **Not twice the same group** | No bread beside a dish already carrying ≥ 30 g of bread, no rice side beside a rice dish, no fruit dessert beside a dish with ≥ 100 g of fruit (`0008`) |

**Whose family?** The set follows the **dish's** family, as the owner's example reads ("en Asia ponen arroz"). The person's preferred cuisine stays a lean on which dishes are picked (`Rotation.isPreferredDish`). Owner, answer 6.

## Measurement

**Method.**
- **Data.** A read-only dump of the dev database on 2026-10-02, behind `.claude/skills/local-probe/scripts/guard.mjs`: it compares hosts with production and refused nothing. It ran in one `READ ONLY` transaction, with no model call and nothing written. 2,136 recipes and 930 ingredients.
- **Test leftovers removed.** **906 of the 2,136 recipes are end-to-end test leftovers**, named with a code suffix ("Patata con huevo jsbl.10.1": 252 of them, "Yogur con avena" 211…). They are left out. Counted in, they would inflate every number: breakfast 694 instead of 183.
- **The population.** The es-ES library without them: 1,229 dishes.
- **The narrowing.** The `0062` § 5 narrowing (stored `meal_slots` ∩ every ingredient's list) is re-implemented in a scratch script, not imported from `core`. Phase 3 must re-measure with `fitSlots` itself.
- **Table 2, two ways.**
  - **A, narrow only**: the table can only take meals away. It runs after `0062`.
  - **B, the table rules its five groups**: for the slugs of those groups, the ingredient lists are ignored and the table decides.
- **Five people:**
  - an omnivore with nothing declared;
  - a vegan: dishes with no animal class, with the `0062` § 4 plant-protein exception applied over Table 2's pulse cell;
  - `traditional_spanish`, by its three `0077` rules;
  - `traditional_spanish` + coeliac (gluten) + no milk or lactose (`contains`);
  - `traditional_spanish` + no fish or shellfish.

**Dishes servable per slot.** The library each person draws from, against `DISHES_NEEDED_PER_SLOT` = 19.

| Person | | B | MS | L | AS | D | Su |
|---|---|---|---|---|---|---|---|
| Omnivore (1,229) | today (`0062`) | 183 | 149 | 456 | 244 | 310 | 42 |
| | Table 2, A | 178 | 149 | 456 | 244 | **198** | 42 |
| | Table 2, B | 180 | 151 | 456 | 244 | 223 | 42 |
| Vegan (264) | today | 43 | 49 | 84 | 68 | 74 | **8** |
| | Table 2, A | 43 | 49 | 84 | 68 | 57 | **8** |
| | Table 2, B | 44 | 50 | 84 | 68 | 57 | **8** |
| `traditional_spanish` (641) | today | 64 | 74 | 268 | 112 | 199 | 20 |
| | Table 2, A | 60 | 74 | 268 | 112 | **129** | 20 |
| | Table 2, B | 61 | 75 | 268 | 112 | 132 | 20 |
| `traditional_spanish` + coeliac + no milk (260) | today | **3** | **9** | 169 | **10** | 125 | **4** |
| | Table 2, A | **1** | **9** | 169 | **10** | 81 | **4** |
| `traditional_spanish` + no fish or shellfish (426) | today | 62 | 69 | 148 | 101 | 82 | **16** |
| | Table 2, A | 58 | 69 | 148 | 101 | 63 | **16** |

**No slot crosses below 19 because of this table.** Every bold cell under 19 was already under 19 today. Those are a fact about the library's size for that person, not a cost of the table. The coeliac, milk-free breakfast (3 → 1) is the one cell the table makes worse. It loses two tortilla breakfasts (owner, answer 4). Lunch never changes, because every group fits lunch everywhere.

**Per family, omnivore** (today → A → B). The pool is per slot across families, so these cells do not starve anybody on their own. They show where the families have dishes at all.

| Family | B | L | D |
|---|---|---|---|
| Española y mediterránea | 154 → 150 → 152 | 344 | **236 → 133 → 133** |
| Italiana | 1 → 0 → 0 | 23 | 15 → 15 → 18 |
| Asiática | 0 | 48 | 33 → 33 → 44 |
| Mexicana y latina | 3 | 22 | 8 → 8 → 19 |
| Árabe y magrebí | 1 | 12 | 9 → 4 → 4 |
| Otras | 24 | 7 | 9 → 5 → 5 |

Below 19 at dinner before the table: Italian, Mexican/Latin, Arab/Maghreb and Other. The table moves Arab (9 → 4) and Other (9 → 5) further down. That is library size, and the model's fresh third fills it (`0013`).

**What thins dinner.** These are the dinners the table removes, by group (A, omnivore):

| Group | Dinners removed (omnivore) | Dinners removed (`traditional_spanish`) |
|---|---|---|
| Rice | 58 | 49 |
| Couscous and other grains (mostly quinoa beside fish) | 46 | 14 |
| Pasta | 8 | 7 |

Examples: "Paella de verduras y pollo", "Arroz caldoso de marisco", "Fideuá de merluza", "Dorada a la plancha con quinoa salteada y verduras", "Merluza a la plancha con arroz basmati y guisantes".

**Sensitivity** (dinners after A):

| Change | Omnivore | `traditional_spanish` |
|---|---|---|
| Rice, pasta and grain threshold 25 g dry | 191 | 125 |
| 40 g dry (chosen, answer 2) | 198 | 129 |
| 60 g dry ("only a full plate", AESAN 60–80 g) | 215 | 134 |
| Couscous and quinoa allowed at Spanish dinner | 239 | 143 |
| Potato threshold 150 g instead of 100 g | 198 | 129 (no change) |

## Alternatives considered

- **The family from the ingredients rather than from the stated cuisine.** It would be more accurate: a "mediterránea" taco would be Mexican. It is not needed now: the Spanish default is the strictest table, so a mislabel only costs a meal. And `0077` already judges foreign ingredients for the person who cares.
- **The dietitian's complement rule instead of a fixed table.** Rioja Salud says it in so many words: "si en la comida hubo cereales, féculas o legumbres → en la cena verduras; si hubo verduras → en la cena cereales, féculas o legumbres". This is the more professional rule. Under it, rice at a Spanish dinner is fine after a vegetable lunch. It is a rule about the day, not the dish, so it belongs in the scheduler next to plan phase 7's starch-base variety, as a soft cost: "not two starch-based main dishes the same day". It is recommended there. This record keeps the owner's fixed rule for rice and pasta at Spanish dinner, which is simpler and measured safe.
- **Extending the `0062` per-ingredient lists.** They cannot say "lunch in Spain, dinner in Asia". A per-family list on every ingredient would multiply the owner's review by six.
- **Phase 7's data migration (rice, pasta and couscous lunch-only in the catalogue).** It would make Asian rice a lunch too, against the owner's own example. It is replaced by the table in code. No catalogue change is needed.
- **Fried and heavy-sauce rows recognised by name.** Rejected on the measurement above: most matches are wrong.
- **Accompaniments as recipes in the library.** Rejected in `0008`: they would enter reuse, pictures and the image judge.
- **Pan de semillas as a bread option.** It may contain sesame and tree nuts. Plain breads suffice.

## Consequences

- **The owner chose option B (answer 1). That decides how `0062` changes.**
  - **A (narrow only; rejected)** would have changed nothing in `0062`. But the cells for pulses at an Asian, Italian or Mexican dinner, rice at an Asian snack, and frijoles at a Mexican breakfast would have been dead: written, but overruled by the ingredient lists.
  - **B (the table rules its five groups; chosen)** gives one source of truth, the table the owner approved. It adds 25 omnivore dinners. Under B, `0062` § 5 is amended: for those five groups, a dish's meals are decided by Table 2 rather than by the ingredient lists. The lists still decide every other food. They also still decide what the pool prompt shows for each meal (`mealCatalogue`), so the model is never shown lentils at an omnivore's dinner.
  - **The `0062` § 4 exception stands over Table 2, in every family and under A or B.** For a vegan or vegetarian, a plant protein belongs to every meal whatever the pulse cell says, so their lentil dinner stays. The vegan row above is measured that way.
  - **The risk of B**: a dish mislabelled `asiática` that is really a Spanish lentil stew becomes a dinner. That is a matter of taste, not safety.
- **Plan phase 7, step 1, is superseded.**
  - The catalogue lists for grains and pasta are not changed, and there is no data migration.
  - Its step 2 (starch-base variety) stands. The complement rule above should join it as a soft cost.
  - Its owner question about couscous is answered here: couscous is lunch-only at a Spanish meal (answer 3).
- **Phase 3 builds:**
  - the cuisine-family map and Table 2 as code next to `MealFit`, applied wherever `fitSlots` is (reuse, swaps, the gate on generated dishes);
  - the accompaniment list from Table 3, with families, meals, months and portions;
  - the set composition (bread or starch, vegetable, dessert, or none) and the filters of 3d.
  - The evaluator then reports dinners per family, and the share of meals with 0–3 accompaniments.
- **A new cuisine value is judged as Spanish until it is mapped.** A unit test lists the values in Table 1. A new regional value (`murciana`) costs one line.
- **The dev database carries 906 end-to-end test recipes.** Any library count that does not filter them (`catalogue-by-meal.mjs`, the `0077` figures) overstates breakfasts and lunches. That is a finding for whoever owns the dev data, not for this record.
- **No BEDCA data** (owner, 2026-10-02). Composition comes from public-domain USDA FoodData Central rows. `queso-de-burgos` is the one accompaniment row still waiting to be re-sourced (see Table 3).

## Owner's answers (2026-10-02)

1. **Widen: option B.** For its five groups, the table decides a dish's meals, not the ingredient lists. The `0062` § 4 plant-protein exception still stands.
2. **Rice at a Spanish dinner: the 40 g dry threshold.** Any real amount of rice makes the dish a lunch. 198 dinners for the omnivore.
3. **No couscous or quinoa at a Spanish dinner.**
4. **No potato at a Spanish breakfast.** An individual tortilla stays allowed at the morning snack, a cell the Spanish table already had.
5. **Pasta and stewed pulses at an Italian dinner: yes, both.**
6. **The dish's family sets the accompaniments.**
7. **Cheese and nuts as accompaniments: breakfast only.**
8. **Season is a hard filter for accompaniments.** Dishes keep season as a preference.
9. **No rice at an Asian breakfast.**

## Sources

Each was read for this record on 2026-10-02.

- **AESAN**, Comité Científico (2022): *Informe sobre recomendaciones dietéticas sostenibles y recomendaciones de actividad física para la población española*. Used for:
  - portions: bread 40–60 g, pasta or rice 60–80 g dry, vegetables 150–200 g ("1 plato de ensalada variada"), fruit 120–200 g, potato 150–200 g, nuts 20–30 g, pulses 50–60 g dry;
  - "el consumo de pan acompañando las comidas principales es una costumbre fuertemente arraigada";
  - legumes in one of the two main meals;
  - vegetables "aliñadas con aceite de oliva y vinagreta";
  - seasonal fruit and vegetables.

  PDF: https://riojasalud.es/files/content/ciudadanos/escuela-salud/cuida-tu-salud/alimentacion/profesionales/2022_AESAN_INFORME_recomend_dieteticas_sostenibles_AF.pdf. News page: https://www.aesan.gob.es/en/actualidad/actualidad-noticias/recomendaciones_dieteticas
- **SENC**, *Guía de la alimentación saludable para atención primaria y colectivos ciudadanos*, summary leaflet: five meals a day; cereals, potatoes, vegetables, fruit, dairy and olive oil "en cada comida principal". https://www.fesnad.org/resources/files/dipticoSENC.pdf
- **Rioja Salud**, *Comer bien desde la infancia*. Used for:
  - dinner "más ligera y moderada que la comida del mediodía, con preparaciones suaves";
  - the complement table for dinner after lunch;
  - examples: "tortilla con ensalada, pescado al horno con patata cocida";
  - the plate: ½ vegetables and fruit, ¼ cereals or tubers, ¼ protein;
  - a piece of seasonal fruit daily.

  https://www.riojasalud.es/files/content/ciudadanos/escuela-salud/cuida-tu-salud/alimentacion/Comer%20bien%20desde%20la%20infancia.PDF
- **Smartfood, Istituto Europeo di Oncologia**, portions and frequencies table, built on the Italian guidance:
  - cereals (pasta, couscous, rice, farro, orzo) 80 g, "1–2 porzioni a pasto";
  - bread 50 g;
  - leaf salad 80 g and vegetables 200 g, "1–2 porzioni a pasto";
  - fruit 150 g;
  - nuts 30 g.

  The CREA guidelines themselves were not read. https://www.smartfood.ieo.it/media/dlvn1qvf/smartfood-tab-porzioni-e-frequenze-semplificata.pdf
- **Japan** (FAO summary of the national guidelines and the Spinning Top): "Eat well-balanced meals with staple food, as well as main and side dishes"; grain dishes (rice, bread, noodles) at the top. https://www.fao.org/nutrition/education/food-dietary-guidelines/regions/japan/en/
- **China CDC**, Chinese Food Guide Pagoda and Plate (2022): the plate's four parts, cereals and tubers first; 200–300 g cereals a day. https://en.chinacdc.cn/health_topics/nutrition_health/202206/t20220622_259773.html
- **Secretaría de Salud (México)**, *Guías Alimentarias 2023 para la población mexicana*:
  - "Consumamos diariamente frijoles, lentejas o habas";
  - half the plate vegetables and fruit "en cada comida";
  - "un taco de frijol con salsa pico de gallo";
  - portions: 1 tortilla de maíz, ⅓ taza de arroz.

  https://movendi.ngo/wp-content/uploads/2023/05/Gui_as_Alimentarias_2023_para_la_poblacio_n_mexicana.pdf
- **Morocco**, home cookery. Yale Globalist, *Inside the Moroccan Kitchen*: "On Friday… Moroccans go home for lunch to eat couscous". There is no official Moroccan guidance; this is a home-cookery source, labelled as such. https://globalist.yale.edu/?p=7258
- **India**, home cookery. Easy Indian Cookbook, *Indian vegetarian thali*: dal, vegetables, rice, roti, salad and raita, "serving lunch or dinner… in the form of a thali". A home-cookery source. https://easyindiancookbook.com/indian-vegetarian-thali-collection/

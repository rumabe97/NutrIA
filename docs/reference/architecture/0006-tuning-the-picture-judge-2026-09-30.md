# 0006 — Tuning the picture judge: stop it rejecting faithful photos, across every kind of dish

> **Purpose**: the `architect` agent's answer to the owner's request of 2026-09-30 ("Refine the
> judge", and "it has to be tuned for every kind of dish, not just the one I found"), the day
> project 009 first showed a faithful image being rejected. It says by which mechanisms the rule
> rejects faithful photos, how many library dishes are exposed to each, what the options are, what
> each lets through that it should not, which one I recommend and in what order to do it. It is the
> basis of project 010's PRD.
> **Audience**: the owner and the agents. **Committed**: yes. **Maintained by**: the `architect`
> agent; once merged it is not edited — a later review is a new report.
>
> Base: `main` at `efba83b6` (#174). Every number carries its label: **measured** (where),
> **estimated** (with the hypothesis) or **unknown**. For this report the code was read and the
> measurements were made **offline**: the judge's stored answers from the pilot
> (`docs/local/image-pilot-2026-09-27/`), the seed catalogue (930 ingredients,
> `packages/database/src/seed/`) and the 500 dishes of `docs/local/nutria-seed-500.sql`, run
> through `judgePicture` exactly as it stands today and through a prototype of each option.
> **No model call was made, neither production nor the development database was read, nothing was
> written to any database and nothing was spent.** The production figures that appear are the ones
> the lead measured on 2026-09-30 and passed to me (the notes of the 18 rows with an image); I have
> not checked them. **Production cannot be replayed through another rule**: each attempt stores the
> verdict's notes, not the two calls' responses. Only the pilot can be replayed.
> Of the (private) library there are only counts and the odd example dish.

---

## 1. Verdict

**Yes, on conditions.** The rule can be tuned for every kind of dish **in code alone**, without
touching what the two models are asked and without spending anything, and the tuning does not open
the door to the images the judge exists to stop.

The cause is not one dish: it is an idea the rule does not have. Today, when the judge names a
**form** ("pancakes", "meatballs", "bread", "milk", "yogurt"), the code gives it the allergens of
**the most usual recipe** for that form, and compares them with the dish. But a photo shows the
form, not what it is made of. If the dish **carries its own version** of that form — corn-flour
pancakes, gluten-free bread, soya yoghurt, heura — the form that is seen is the dish's, and its
allergens are the dish's.

What I recommend (option **R**, § 7): **the dish's own version**. A closed table of form families;
when the dish has an ingredient that *is* that form, or its title names it, the form's word
contributes no allergens. Everything else in the name still counts ("wheat noodles", "egg
noodles", "cheese pancakes", "feta cheese" are still rejected). Plus three small vocabulary fixes.

Measured offline:

| | Today | Option R |
| --- | --- | --- |
| Pilot: 65 faithful images accepted | 65 of 65 | 65 of 65 |
| Pilot: 3 wrong-recipe controls rejected | 3 of 3 | 3 of 3 |
| The three production cases (6 reconstructions) accepted | 0 of 6 | 6 of 6 |
| Library dishes exposed to a false rejection (of 500) | 128 | 47 |
| … of the three classes already seen in production | 43 | 0 (except "nuggets", on purpose) |
| Extra foods that would pass and are rejected today (31,500 dish × food pairs) | — | 229 (0.87% of what is rejected today) |

**The conditions**:

1. It is built by `backend-high` and reviewed by `invariant-reviewer`, both on opus at `high`: it
   is model-output validation and it touches allergens (§ 13).
2. Before the rule changes, the acceptance set is written as tests (§ 12): without it, every word
   added to a list is a bet.
3. 006's P2 rule is kept: a short name seen **alongside** the full one is a second food ("milk"
   beside "soy milk" is still rejected).
4. Two tests that pin the wrong behaviour today are deliberately rewritten, with the reviewer
   watching (§ 5.5).
5. A new decision amends `0066` (§ 13).
6. Not in this batch: lactose, "may contain", tofu read as cheese and scrambled tofu read as egg.
   They cost more than they fix or have never been seen (§ 7.4); they are decided with production
   data.

**What it must not cost** (§ 8): today's rule also has holes in the other direction — 19 of 166
allergen-bearing food names map to nothing ("omelet", "pizza", "crepes", "tortilla", "fusilli",
"paneer"…). Closing those holes is the second half of the same work, and it is only possible
**after** R: today, every new synonym would reject more faithful dishes.

---

## 2. Premises checked

| # | Premise | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The three production rejections were false for the allergen they named | **Confirmed** by the mechanism; a **hypothesis** visually | I reproduce them offline (§ 5.2); case 2's note comes out letter for letter. Case 1 has no notes left (manual acceptance erased them); what remains is the owner's screenshot: gluten only, and a single recognised ingredient, "Tortitas americanas" — exactly what "pancakes" gives in my measurement, and not what "corn pancakes" would give (five rows). I have not seen the images: that the pancake one "showed the dish as it is" the owner saw; of the other two I do not know |
| 2 | "Every rejection came from the name of a prepared food mapped to a catalogue product with its usual recipe's allergens" | **Confirmed** for two; **wrong** for the third | "pancakes" → `tortitas-americanas` and "meatballs" → `albondigas-envasadas`, yes. "grain base" is not a product: the word "base" fell into the loose-word step (`judge.ts:354-367`) and the only catalogue row with that word is "Fresh pizza base". It is a vocabulary accident, another class (§ 4, M4) |
| 3 | The judge rejects for one reason only | **Confirmed** | `judge.ts:497` and `:512` |
| 4 | The matching call (b) decides nothing | **Partly wrong** | It cannot approve an allergen on its own (`judge.ts:491-494`), but it **does decide** whether the dish's own form passes: the `shortened` exemption only applies if (b) matched the name (`judge.ts:480-489`); if it left it as an "extra", it is rejected. Two tests pin it that way (`judge.test.ts:402` against `:414`; `:418-435`). Production's case 3 is exactly that: on attempt 1, (b) left "meatballs" as an extra |
| 5 | "A wrong rejection costs a redraw" (`judge.ts:22-24`) | **Wrong** as a cost model | It holds if the error is random. These are **deterministic per dish**: the corn pancakes, 3 of 3. It costs all three attempts (≈ $0.10, estimated), leaves the dish with no picture for 7 days and gives the owner work |
| 6 | The pilot would have caught this problem | **Wrong** | Of the pilot's 20 dishes, none has a prepared form without its usual allergen except the rice noodles (dish 17) and the tofu (12 and 19), which the judge named correctly (measured: "tofu" in 8 of 8 images). The class was not in the sample |
| 7 | The pilot still gives 57 of 57 and the 3 controls rejected | **Confirmed** | Replayed today with `main`'s code (§ 5.1) |
| 8 | The catalogue has five `sin-gluten` / `sin-lactosa` rows | **Confirmed** | `pan-sin-gluten`, `pan-rallado-sin-gluten`, `pasta-sin-gluten`, `galletas-sin-gluten`, `leche-sin-lactosa` |
| 9 | 18 dishes with a picture, 3 with some rejection, all 3 false | **Not checked** (the lead's figure) | I do not read production. I use it as given: 3 of 18 dishes (17%; with 18 dishes the 95% interval runs from 6% to 39%, estimated), and 5 rejected attempts of 22 judged (15 dishes first time, 2 on the second, the pancakes after 3) |
| 11 | What happened in production can be studied afterwards | **Wrong** | (a)'s and (b)'s responses are stored nowhere; only the notes. And manual acceptance rewrites `provenance` and erases the attempts' notes and the candidate's `extras`: the dish that prompted this report no longer has its evidence (§ 9) |
| 10 | Production's catalogue is the seed's | **Hypothesis** | I measure with the seed's 930 rows, the same ones 006's calibration used. It is checked with a read-only count |

---

## 3. What is there today

Per attempt, three steps (`DishPicture.service.ts:307-326`):

1. **Call (a), blind** (`OpenRouterVisionJudgeClient.ts:17-25`): the vision model receives only the
   image and returns the foods it sees, each with a short English name, whether it names it
   confidently (`specific`) and how much there is (`amount`). It does not know which dish it should
   be.
2. **Call (b), text only** (`:28-37`): it receives those names and **all** the recipe's ingredients
   (name and slug; the flour too, which the drawing prompt treats as invisible) and says which it
   sees, under what names, and which are "extra".
3. **`judgePicture`** (`packages/core/src/domain/DishPicture/judge.ts`) decides:
   - "Extras" are those (b) listed as such and those (b) did not mention (`:376-380`, `:431`).
   - Those (b) matched with an ingredient are also reviewed (`:491-494`), unless the name is the
     ingredient's shortened form (`shortened`, `:480-489`).
   - Each name is mapped to the catalogue (`mapName`, `:325-370`) in four steps: (1) the whole
     name, exactly, or through `SEEN_SYNONYMS` (`:209-251`); (2) every row whose name is made only
     of words from the food; (3) the remaining words, through `SEEN_SYNONYMS`; (4) for each word
     still loose, every row carrying it, counting only the allergens they all share.
   - An allergen is "foreign" if the food **contains** it and no ingredient of the dish contains
     it, or if it **may contain** it and no ingredient contains or may (`:443-448`).
   - It is rejected if there is a named, non-generic extra, in more than a trace, with some foreign
     allergen (`:497`). Everything else is notes.

What this takes for granted: that the name a vision model gives, read with "the most usual
recipe", says which allergens **can be seen**. That is true of a prawn, a peanut or a fried egg.
It is not true of a pancake, a meatball, a glass of something white or a slice of bread.

`0004` does not come into play and does not move: what a person may eat is decided in code against
the recipe. The judge protects something else, `dish-pictures.md` § 5's IMG-2: that somebody
allergic to X does not see in the photo something that reads as X on a dish that does not carry
it, and mistrust a safe dish.

---

## 4. The classes of false rejection, by mechanism

Reading `mapName`, `SEEN_SYNONYMS`, the word step, `shortened` and `mismatched`, and checking every
name against the real catalogue (measured, 930 rows).

| # | Mechanism | Where | Example | Pinned by a test? |
| --- | --- | --- | --- | --- |
| **M1** | **A prepared form → a product row with its usual recipe.** "pancakes" → `tortitas-americanas` (gluten, milk, egg); "waffles" → `gofre`; "cake" → `bizcocho`; "muffins" → `magdalena`; "cookies", "biscuits" → `galletas-de-mantequilla`; "bread", "toast", "croutons", "breaded", "batter", "dumplings", "pastry", "pie", "noodles", "penne", "spaghetti" through the synonym table | `:209-251`, `:328`, `:346-348` | Corn-flour pancakes (production, 3 of 3). Gluten-free bread seen as "toast". Gluten-free spaghetti seen as "spaghetti" | `judge.test.ts:364-380` pins the safe reading over a rice dish (correct there). `:414` and `:418-435` pin that the dish's own form, if (b) leaves it as an extra, is rejected: **the wrong behaviour, pinned** |
| **M2** | **A meat form → a product row.** "meatballs" → `albondigas-envasadas` (gluten, egg; may contain milk); "burger", "burger patty" → gluten (through the bun rows); "nuggets" → gluten, soy | `:354-367` | A stew with heura (production). Any dish with heura, seitan, tempeh or textured soy. "chicken", "meat chunks", "meat patties" carry no allergen and pass | No |
| **M3** | **A plant lookalike of a dairy food, and a compound name read as two foods.** "yogurt" → dairy yoghurt. "soy yogurt", "coconut yogurt" → milk, because step 3 reads "yogurt" on its own. "coconut milk" → milk, because step 2 pulls in every row whose name is just "milk" ("Whole milk" without the descriptor). "plant milk" → milk | `:339-351` | **The dish's own ingredient, named in American English, is rejected even when (b) matches it**: the catalogue says "Soya yoghurt" and the judge says "soy yogurt" (16 library dishes). A coconut-milk curry | No. `:478` pins "soy milk" + "milk" seen together, which is another case and is kept |
| **M4** | **A word that is not a food, in the loose-word step.** "base" → "Fresh pizza base" (gluten). "glass of milk" drags in icing sugar and glass noodles. "crab sticks" drags in cinnamon sticks. "sandwich" → filled biscuits. "taco" → taco seasoning (gluten) | `:354-367` | Rice cakes seen as "grain base" (production) | No |
| **M5** | **(b)'s coin toss.** The same photo and the same name pass if (b) matches and are rejected if (b) lists it as an extra or does not mention it | `:376-380`, `:480-492` | Case 3, attempt 1. In the pilot (b) listed 11 extras and left 10 foods unmentioned, of 323 seen (measured) | `:402` / `:414` and `:418-435` pin it |
| **M6** | **Spelling.** The catalogue is in British English ("yoghurt", "soya", "pitta"); the judge writes American. `shortened` and step 2 require the same word (`sameWord`, `:279`) | `:279`, `:480-489` | "yogurt" matched with "Soya yoghurt" does not count as the shortened ingredient | No |
| **M7** | **A fair variant with an allergen that cannot be seen.** "mozzarella" or "parmesan" (milk + lactose) over a dish with cured cheese (milk, no lactose) → lactose. "king prawns" (may carry sulphites) over a prawn dish → sulphites. The "may contain" of a product row (the meatballs' milk) | `:443-448` | 22 library dishes carry milk and not lactose. 15 carry prawns | `:314-328` pins that the variant passes "because it carries its ingredient's allergens"; that is only true when they match |
| **M8** | **An egg lookalike.** "scrambled eggs", "omelette" over scrambled tofu | `:325-370` | 4 library dishes | No |
| **M9** | **Tofu read as cheese** ("feta cheese", "cheese cubes") | — | 26 dishes carry tofu. **Not observed**: 0 of the pilot's 8 tofu images | No |

What is **not** a separate class but an amplifier: an extra (b) names and (a) does not is taken as
main and named (`:435-437`); a food with no `specific` is taken as specific if the catalogue knows
it (`:450`). Both are correct in the other direction and I leave them alone.

---

## 5. Measurements

The method, so it can be repeated: `main`'s `judge.ts` bundled with the seed catalogue (930 rows,
es-ES and en-GB names, `contains` and `may_contain` as `seed/index.ts` writes them), and a copy
with switches for each option. The prototype's tables are in the annex. The harness lives in the
session's temporary directory and disappears with it: whoever builds this rebuilds it as tests
(§ 12, phase 0).

### 5.1 The pilot, replayed

The 57 pilot responses re-judged (`mini/rejudge.json`), the mini-pilot's 8 (`mini/results.json`)
and the 3 wrong-recipe controls (`mini/positive-control.json`).

| Rule | The pilot's 57 | The mini's 8 | The 3 controls |
| --- | --- | --- | --- |
| Today | 57 accepted | 8 accepted | 3 rejected (prawns; octopus and feta; a burger bun) |
| Option (ii) | the same | the same | the same |
| Option R | the same | the same | the same |
| R with lactose, R with "may contain" | the same | the same | the same |

**Measured.** No option changes a single verdict or a single note of the pilot. A caveat: of the
controls only the verdict was stored, not (b)'s response; I reconstructed it from the extras the
verdict kept.

That is good news only halfway: the pilot does not tell the options apart because it does not
contain the class (premise 6).

### 5.2 The three production cases, reconstructed

I do not have the judge's responses, only the notes. I reconstruct each case in both ways (b) could
have answered.

| Case | Today | (ii) | R | R without the title |
| --- | --- | --- | --- | --- |
| 1a Corn pancakes: "pancakes" as an extra | rejects | rejects | **accepts** | rejects |
| 1b Corn pancakes: "pancakes" matched with the corn flour | rejects | accepts | **accepts** | rejects |
| 2a Rice cakes: "grain base" matched (as in production) | rejects | accepts | **accepts** | accepts |
| 2b Rice cakes: "grain base" as an extra | rejects | accepts | **accepts** | accepts |
| 3a Heura stew: "meatballs" as an extra (as in production) | rejects | rejects | **accepts** | accepts |
| 3b Heura stew: "meatballs" matched with the heura | rejects | accepts | **accepts** | accepts |

**Measured** over the reconstruction. Case 2a's gives production's note letter for letter
(`extra_allergen:grain base=gluten extra_food:shredded chicken/diced potatoes/grain base
matched_foreign:grain base`), so that is the mechanism. **It is not known, and can no longer be
known**, whether in case 1 (b) matched or not: the notes were erased when the image was accepted by
hand. Whether option (ii) would have fixed the dish the owner found depends on that; R fixes it
either way.

### 5.3 The library: how many dishes are exposed

Over the seed's 500 dishes. A dish is **exposed** to a class if it carries what the class needs and
the rule rejects a **faithful** image when the judge uses a plausible name for it. The names are a
table of mine (annex): **what is measured is the rule, what is assumed is the name**. It is not a
rejection rate: it is the size of the surface.

Each cell: dishes rejected if (b) matches the name / if it leaves it as an extra.

| Class (the name the judge gives) | Dishes carrying it | Today | (ii) | R |
| --- | --- | --- | --- | --- |
| Batter in the title: flour pancakes, crêpes, galettes ("pancakes", "waffles") | 7 | 7 / 7 | 0 / 7 | 0 / 0 |
| Gluten-free bread, arepas ("toast", "bread") | 7 | 7 / 7 | 0 / 7 | 0 / 0 |
| Corn tortilla: tacos, enchiladas ("wrap", "flatbread", "taco") | 7 | 7 / 7 | 0 / 7 | 0 / 0 |
| Gluten-free pasta, rice noodles ("spaghetti", "pasta", "noodles") | 7 | 5 / 5 | 0 / 5 | 0 / 0 |
| Rice or corn cakes ("crackers", "grain base") | 13 | 13 / 13 | 0 / 13 | 0 / 0 |
| Plant protein: heura, seitan, tempeh, textured soy ("meatballs", "burger patty") | 24 | 24 / 24 | 0 / 24 | 0 / 0 |
| … the same, seen as "nuggets" | 24 | 22 / 22 | 22 / 22 | 22 / 22 (on purpose) |
| A plant drink ("milk") | 17 | 0 / 17 | 0 / 17 | 0 / 0 |
| A shake with a plant drink ("milkshake") | 8 | 8 / 8 | 0 / 8 | 0 / 0 |
| Coconut milk or cream ("coconut milk", "cream") | 14 | 14 / 14 | 0 / 14 | 0 / 0 |
| Soya or coconut yoghurt ("yogurt", "soy yogurt") | 16 | 16 / 16 | 0 / 16 | 0 / 0 |
| Vegan cheese ("cheese") | 1 | 0 / 1 | 0 / 1 | 0 / 0 |
| Prawns seen as "king prawns" (sulphites) | 15 | 14 / 14 | 0 / 0 | 0 / 0 |
| Cured cheese seen as "mozzarella", "parmesan" (lactose) | 28 | 21 / 21 | 21 / 21 | 21 / 21 (out of this batch) |
| Scrambled tofu ("scrambled eggs", "omelette") | 4 | 4 / 4 | 4 / 4 | 4 / 4 (out) |
| Tofu seen as "cheese", "feta cheese" | 26 | 24 / 24 | 24 / 24 | 24 / 24 (out; never observed) |
| **Any of them, not counting tofu-as-cheese** | | **127 / 128** | 47 / 117 | **47 / 47** |
| **The three classes already seen in production** (batter in the title, plant protein, rice cakes) | | **43 / 43** | 22 / 43 | 22 / 22, all "nuggets" |

**Measured** (the rule) over **assumed** names. How to read it:

- One in four library dishes (128 of 500, 26%) carries something whose most natural English name
  makes a faithful image be rejected. For the three classes already seen in production it is 43
  dishes (9%).
- Option (ii) only fixes it when (b) matches: between 47 and 117 dishes stay exposed, on a coin
  toss we do not control.
- What R leaves exposed is what I deliberately leave out (§ 7.4).

To place those numbers: 375 of the 500 dishes carry no gluten, 354 no milk, 425 no egg, 416 no soy
(measured).

### 5.4 What each option lets through

The test in reverse: to each of the 500 dishes, each of 63 allergen-bearing foods (bread, toast,
pancakes, pasta, cheese, milk, yoghurt, prawns, peanuts, meatballs…) is added as an **extra** food
that (b) lists as such. That is 31,500 pairs; today 26,394 are rejected (the rest are foods whose
allergen the dish already carries).

| Rule | Pairs that become accepted | Dishes | Which |
| --- | --- | --- | --- |
| The vocabulary fixes alone | 14 | 14 | "king prawns" on dishes that already carry crustaceans (sulphites) |
| Option (ii) + vocabulary | 14 | 14 | the same. By construction: an extra is never matched |
| **Option R** | **229** (0.87%) | 130 | "meatballs" 51, "burger patty" 26, "milk" 26, "yogurt" 16, "king prawns" 14, "crackers" 13, "cream" 10, "wrap" 9, "flatbread" 9, "bread", "toast", "bun", "croutons", "pancakes", "waffles" 7 each, "pasta" 5, "spaghetti" 5, "noodles" 2, "cake" 1 |
| R + lactose not foreign when there is milk | 386 | 146 | the above plus "yogurt", "milk", "cream", "mozzarella", "feta"… on dishes with cured cheese |
| R + "may contain" for gluten only | 2,002 | 498 | the above plus chocolate chips (496), seeds (403 + 403), dark chocolate (122), savoury crackers, puff pastry… |

**Measured.** R's 229 pairs are all of the same species: an extra food **of the same family** as a
form the dish already has — another bread on a dish with gluten-free bread, a glass of milk on a
dish with soya drink, meatballs on a dish with heura. In all of them, what is seen in the photo is
indistinguishable from the dish's version. The last two rows are why I do not touch lactose or "may
contain" now.

### 5.5 Today's tests that change with R

Checked against the real catalogue (measured):

| Test | Today | R | What to do |
| --- | --- | --- | --- |
| `judge.test.ts:414` "noodles" as an extra on a rice-noodle dish | rejects | accepts | Rewrite: it is production's case 3 with another food |
| `:418-435` "cake" as an extra on a rice-cake dish | rejects | accepts | Rewrite: it is case 2 |
| `:476-485` "soy milk" + "milk", "vegan cheese" + "cheese", "peanut butter" + "butter" seen together | rejects | rejects | Kept (condition 3) |
| `:398` bread over an oat dish; `:382` oats over rice; `:301` prawns matched with broccoli | rejects | rejects | Kept |
| `:402`, `:487` | accepts | accepts | Kept |

And new cases R settles as it should: "wheat noodles" and "egg noodles" over rice noodles, "cheese
pancakes" over cheeseless corn pancakes, "toast" over corn pancakes, "bun" over the heura stew,
"feta cheese" over a tofu bowl, "shrimp" over the pancakes, "pancakes" over a dish that does not
name them: **all rejected**. "soy yogurt" over soya yoghurt and "coconut milk" over a coconut
curry: accepted (today they are rejected).

### 5.6 Today's holes, in the other direction

Of 166 food names anybody would expect to carry an allergen (my list; what is measured is the
mapping), **19 do not give that allergen** under today's rule (11%):

`tortilla`, `pizza`, `pizza crust`, `pizza slice`, `tart`, `crepe`, `crepes`, `cupcake`, `fusilli`,
`burrito`, `fritters`, `crumble` (gluten); `paneer`, `latte` (milk); `omelet`, `frittata`,
`meringue`, `hollandaise` (egg); `crayfish` (crustaceans).

"pizza" and "tortilla" do not give gluten because step 4 only counts what every row with that word
shares, and among them are a pizza tomato sauce and a corn tortilla. "omelet" (the American
spelling) does not exist; "omelette" does. A pizza or a French omelette drawn over a dish with no
gluten or no egg **passes today**.

---

## 6. The options

| | What it fixes | What it lets through that it should not | Cost | `0004` and "(b) decides nothing" |
| --- | --- | --- | --- | --- |
| **(i) A closed table of forms with a substitutable base — my option R** | Classes M1 to M6. 6 of 6 reconstructions. 128 → 47 exposed dishes | 229 pairs of 26,394: another food of the same family as the dish's, indistinguishable in the photo | One batch of `backend-high` and its review. No migration, no contract, no web | It keeps them. It uses only recipe and catalogue data. It **reduces** what depends on (b) |
| **(ii) Use what (b) already says** (the form matched with its ingredient, with a check in code) | The same, **only when (b) matches**. 3 of 6 reconstructions plus the 2 of "grain base", which the vocabulary fixes. 47 to 117 exposed dishes | Almost nothing of its own (14 pairs, the sulphites). But if (b) wrongly matches an extra with a base ingredient, it passes | A little less code | It keeps `0004`. It **increases** what (b) decides: its matching becomes a condition for acceptance, and production's case 3 proves (b) is not stable |
| **(iii) Change what is asked** (tell (a) the dish's name; ask for "the visible food, not the kind of dish") | Unknown: it cannot be measured without calls | Telling (a) the dish breaks the blind design: a model that knows what it should see, sees it. The 3 wrong-recipe controls depend on it not knowing | It invalidates the calibration: the 65 stored responses are useless and everything has to be re-judged (≈ $0.05, estimated, the owner's decision). And it raises the prompt version | It keeps `0004` only if the code still decides. The problem is not in what the model says ("pancakes" is true) but in how the code reads it |
| **(iv) Leave the rule alone and accept by hand** | Nothing | Nothing new | $0.10 and a manual review per blocked dish (estimated). With the 43 dishes of the classes already seen: up to $4.4 of a $10 monthly cap and 43 reviews, if all of them blocked (an upper bound) | It keeps them. But every manual acceptance is a recorded override of the judge (`0072`): making it routine takes away its meaning |

**I recommend (i)**, in § 7's R form, with the vocabulary fixes.

**Why not (ii)**: it fixes half, and which half it fixes is chosen by a text model. The owner asked
that it not depend on the dish he found; (ii) depends on the toss as well.

**Why not (iii)**: the model is not wrong to say "pancakes". What is wrong is the reading. And it
is the only option I can neither measure for free nor undo without recalibrating.

**Why not (iv)** on its own: the manual door is for the rare case. Measured, the surface is one
dish in four.

**What I would not do in any case**:

- Make a form never reject ("pancakes" is never gluten). The burger-bun control over a skyr bowl
  would stop being rejected.
- Let (b) decide more, or ask the model for the allergens. `0004`.
- Touch lactose and "may contain" in the same batch (§ 5.4: 386 and 2,002 pairs).
- Put tofu in the cheese family. Grated cheese does not look like a tofu cube, and the judge has
  never confused them (0 of 8).

---

## 7. Proposal: the dish's own version

### 7.1 The rule, in one sentence

> A word that names a **form** contributes no allergens when the dish has its own version of that
> form. The rest of the name is still mapped as it is today.

### 7.2 How "the dish has its own version" is decided

Two keys, both recipe data, neither from the vision model:

1. **An ingredient of the dish *is* that form**: a closed table of catalogue slugs per family.
   `pan-sin-gluten` is a bread; `pasta-sin-gluten` and `fideos-de-arroz-*` are pasta;
   `tortilla-de-maiz` is a tortilla; `tortitas-de-arroz` is a cracker; `yogur-de-soja` is a
   yoghurt; `leche-de-soja`, `leche-de-avena`, `leche-sin-lactosa` are a milk; `heura`, `seitan`,
   `tempeh`, `soja-texturizada` and mince are what a meatball is made of.
2. **The dish's title names the form**: a closed table of Spanish words per family. "Tortitas
   caseras de maíz…" names pancakes; "Arepas…" names a bread. Without this key, case 1 is not
   fixed (§ 5.2, last column): corn flour is not *a* pancake.

Why the title is a legitimate key: the risk the judge covers is that the photo says something the
dish does not. If the title says "tortitas", a photo of pancakes adds nothing; what they are made
of is said by the ingredient list, which is the one that rules.

The other ways of deciding it, and why they lost:

- **By catalogue category** (`bakery`, `pantry`…): too coarse — breadcrumbs and rice cakes are in
  the same one.
- **By the ingredient's weight**: 5 g of cornflour thickens a stew and 60 g makes pancakes, but the
  threshold is a number with no owner and it does not tell pancakes from a batter coating.
- **By ingredient only, without the title**: it does not fix the owner's dish.
- **Title plus an ingredient "it can be made from"** (flour, flakes): the cautious variant.
  Measured with an earlier version of the prototype, it leaves 2 or 3 more dishes of 500 exposed
  (some potato pancakes, some egg muffins: forms with no flour). It is question 2 of § 14.

### 7.3 What bounds the rule

- **Narrow families.** A family is a set of forms a photo cannot tell apart: {bread, toast, bun,
  crouton}; {pancake, crêpe, waffle}; {cake, muffin}; {biscuit}; {tortilla, wrap, taco, flatbread};
  {pasta, noodles, spaghetti}; {meatball, burger, sausage}; {milk, shake}; {yoghurt}; {cheese};
  {cream}. Having gluten-free bread does not excuse pancakes, and naming pancakes does not excuse
  toast (measured, § 5.5).
- **The form's word only.** "wheat noodles" keeps "wheat"; "egg noodles", "egg"; "cheese pancakes",
  "cheese"; "feta cheese", "feta". They are rejected as today.
- **The second food.** If the image shows both a fuller name of that form and the short one ("soy
  milk" and "milk"), the short one is another food and is judged as today. It is 006's P2, kept,
  and now without depending on (b).
- **Coating is visible.** "nuggets" and "croquettes" are excused only by the title ("Croquetas
  de…"), never by carrying heura: the coating can be seen.
- **"Tortitas" is ambiguous in Spanish.** If the dish carries `tortitas-de-arroz` or
  `tortitas-de-maiz`, its title does not excuse "pancakes".
- **It is written down.** When the exemption acts, the verdict carries a note (`own_form:<name>`),
  which is already stored with an accepted image (`DishPicture.service.ts:338-343`). It is the only
  way to know, afterwards, which images went through the new rule.

### 7.4 The vocabulary fixes that go with it

| Fix | What it does | Measured cost |
| --- | --- | --- |
| Words that are not a food (`base`, `glass`, `bowl`, `cup`, `stick`, `bed`, `layer`, `stack`, `mix`) are not mapped in the loose-word step | Fixes "grain base" (case 2), "glass of milk", "crab sticks". "pizza base" is still gluten: it is a whole catalogue name | 0 pairs |
| A plant qualifier (`soy`, `soya`, `oat`, `almond`, `coconut`, `rice`, `plant`, `vegan`…) before `milk`, `yogurt`, `cheese`, `cream`, `butter`: the dairy word is not mapped; the qualifier is (soy, nuts) | Fixes "soy yogurt", "coconut milk", "plant milk" as an extra too | 0 pairs |
| Sulphites never reject an image | Fixes "king prawns" over prawns. Nobody sees a sulphite | 14 pairs, all on dishes that already carry crustaceans |

### 7.5 What stays out of this batch, and why

| Class | Dishes | Why it waits |
| --- | --- | --- |
| Lactose (M7) | 21 | Treating it as not foreign when there is milk lets 157 more pairs through: an extra yoghurt on a dish with cured cheese, which somebody intolerant would read. It has not been seen in production or in the pilot (the judge says "cheese", "grated cheese") |
| "May contain" (M7) | — | 1,773 more pairs, nearly all seeds and chocolate. It is a decision about what the judge promises, not a tuning |
| Scrambled tofu (M8) | 4 | A faithful photo of that dish **looks like** egg. It is exactly what manual acceptance is for |
| Tofu as cheese (M9) | 24 | Never observed |

---

## 8. The other direction

**Does today's rule accept images it should reject?** Yes, through vocabulary: § 5.6's 19 names. It
is a failure of today's, not of any option.

**And production's accepted notes?** None is an allergen error in fact:

- Chicken for turkey, potato for apple (rice cakes, attempt 2): neither chicken nor potato carries
  an allergen. It is an **unfaithful** photo, not a photo with an allergen.
- "meat patties" with the seitan unseen: griddled seitan looks like meat. Meat carries no allergen
  in the catalogue. A vegetarian may be surprised; it is not IMG-2.
- "tortilla chips" for crisp pitta: the dish already carries gluten; nachos do not.
- "oatmeal/butter" with the cottage cheese unseen: the dish carries gluten (the toast) and milk
  (the cottage).

**Should `missing_main` matter?** As a rejection, no. In the pilot it appears in 5 of 65
**faithful** images (measured) and in the 3 controls: it discriminates badly. In production it is
in 5 of the 17 images the judge accepted (the lead's figure): rejecting on it would have left
nearly a third with no image. And the "unseen" seitan was in the photo, under another name. What it
mostly measures is how the judge names things, not what is missing. As a **signal** of fidelity it
does work: a count in `/admin` of accepted images with an unseen main would tell the owner which to
look at. That is another question (number 6 of § 14), and it is not about allergens.

**What the tuning must not cost**, as criteria:

1. The 3 controls stay rejected.
2. No qualified name is excused (wheat, egg, cheese, feta, peanut).
3. A form from another family is still rejected.
4. 006's P2 is kept.
5. The holes do not grow: today's 19 cannot become 20.
6. What R lets through is known in advance: the 229 pairs, by family. If the number rises while it
   is built, it is explained or it is not merged.

**A risk R enlarges and that has to be said**: an image the judge **accepts** cannot be withdrawn
(IMG-16; "Withdraw" only applies to those accepted by hand). R makes the judge accept more. If one
of those acceptances turns out badly, today only a data migration removes it. That is question 4.

---

## 9. Requirements

- **Code**: `packages/core/src/domain/DishPicture/judge.ts` and, better, a file beside it for the
  tables (families, slugs, title words, words that are not a food). `judge.test.ts`. Nothing in
  `apps/api` unless the rule's version is to be stored with the image (one more key in
  `provenance`, no migration).
- **Data**: none. No migration. The catalogue does not change.
- **Infrastructure and money**: none. €0.
- **Keeping the evidence** (not part of the rule, but without it the next tuning is again done
  blind):
  - that manual acceptance **keeps** the attempts' notes and the candidate's `extras` instead of
    rewriting `provenance` (today they are lost; it happened to this report's dish);
  - that every judged attempt stores (a)'s and (b)'s responses — food names, amounts, the matching
    — beside its notes. That is a few hundred bytes in the `jsonb` that already exists, no
    migration, and nothing about a person. With that, production could be replayed through a new
    rule, which is what cannot be done today. `0072` forbids **showing** the model's words in the
    console, not storing them; the notes already carry them (`extra_food:meatballs`). `legal` and
    `invariant-reviewer` should look at it.
- **Titles in other languages**: the title words are Spanish. If there are recipes with an English
  `locale`, the table needs their words (the same ones the judge already uses). **Unknown** how
  many there are.
- **The owner's time**: read this report and answer § 14; after it ships, look in `/admin` at the
  images with an `own_form` note during the first week and retry the blocked dishes (≈ $0.04 each).
- **Decisions**: those of § 14.

---

## 10. Risks

| Risk | To whom | Likelihood | How it would show | How to undo it |
| --- | --- | --- | --- | --- |
| R accepts an image with an extra food of the same family (a wheat bread beside the gluten-free one) | Somebody allergic who mistrusts a safe dish (IMG-2, P2). The dish is still safe | Low: it needs the model to draw an extra **and** for it to be of the same family. Bounded to 229 of 26,394 pairs | An `own_form` note plus `extra_food` on the accepted image | Today, only a migration (IMG-16). Hence question 4 |
| A badly written table excuses too much (a family too wide, a wrong slug) | The same | Medium without the acceptance set; low with it | § 5.4's pair count rises | Revert the commit. The images already accepted stay |
| The title was written by a model and names a form the dish does not have | The same | Low. The photo matches what the person reads in the title | — | § 7.2's cautious variant |
| The rule is touched and the calibration breaks | The owner (new rejections) | Low with the pilot as a test | The pilot stops giving 65 of 65 | Revert |
| Closing holes (phase 3) creates new false rejections | The owner | Medium: "tortilla" is both a wheat tortilla and a Spanish omelette | The library's exposure rises | Every synonym is one line |
| Privacy, quota | Nobody | None: it changes neither what is sent to any model nor how many calls are made. Fewer rejections are fewer redraws | — | — |

---

## 11. Cost and effort

| Item | Value | Label |
| --- | --- | --- |
| Money to build R | €0 | measured: no calls |
| One false rejection | ≈ $0.034 (the image $0.0337 + the judge's two calls ≈ $0.0007) | measured in the pilot |
| A blocked dish (3 attempts) | ≈ $0.10, 7 days with no picture, one manual review | estimated from the measured prices |
| What production's 5 rejected attempts cost | ≈ $0.17 | estimated |
| R's code | 150 to 250 lines in `core`, 40 to 60 test cases | estimated, from the prototype (≈ 90 lines without tests) |
| Review rounds | 1 to 2 (006's phase 2 took 2) | estimated |
| The holes phase | 20 to 40 lines of synonyms, and measuring again | estimated |

What moves the effort: how many families go in the first batch and whether the title stands alone
or with an ingredient. What does not move it: the library's size.

---

## 12. The plan, and how it is measured

Each phase ships on its own. All of them in `quality-max`.

**Phase 0 — The acceptance set, as tests, before the rule is touched.**
- The pilot as a test: the 65 responses and the 3 controls. Today they live in `docs/local`, which
  is not published; how they get in has to be decided (question 5).
- The 6 production reconstructions, in red.
- One case per class of § 4, in both directions (those of § 5.5).
- The reverse test's count (§ 5.4) over a fixed set of example dishes, as a number a test compares.
- *Success*: with today's rule exactly the cases that must fail do fail. *Signal to stop*: a case
  that cannot be written without inventing the judge's response.

**Phase 1 — Rule R, the three vocabulary fixes and keeping the evidence** (§ 9: the judge's
responses with each attempt; the notes kept on manual acceptance).
- *Success* (the numbers the PRD carries):
  - the pilot 65 of 65 accepted, with no change to any note; 3 of 3 controls rejected;
  - 6 of 6 production reconstructions accepted;
  - every class M1 to M6: its faithful case accepted and its opposite case rejected;
  - 006's three P2 tests (`:476-485`) untouched and green;
  - the pairs that become accepted: the predicted ones (229 with these tables), explained by
    family;
  - `judge.ts` coverage not below the domain floor (90% of branches).
- *Signal to stop*: a control changes; or the reviewer returns the same P0 or P1 twice.

**Phase 2 — The record.** The decision amending `0066`, `apps/api/AGENTS.md`, `judge.ts`'s comments,
and `legal` on its documents (§ 13). It can go in the same PR as phase 1.

**Phase 3 — Close the holes** (`omelet`, `frittata`, `crepe`, `pizza`, `cupcake`, `fusilli`,
`paneer`, `crayfish`, `meringue`…).
- *Success*: from 19 holes down to whichever are deliberately left, named (my candidate to stay:
  `tortilla`, for being ambiguous); the pilot unchanged; the library's exposure does not rise.
- *Signal to stop*: a synonym that rejects a faithful pilot dish.

**Phase 4 — Look at production, at 2 to 4 weeks.** Decide with data on lactose, "may contain",
scrambled tofu, and whether `missing_main` deserves a count.

**What can only be known after shipping**, and where it is read:

| What | Where | The starting point |
| --- | --- | --- |
| Dishes that end up failed by the judge | `/admin/pictures`, `failedByReason.judge_allergen` | 1 of 18 (the lead's figure) |
| Rejected attempts | `recipe_images.provenance.notes` (`N:rejected:…`, also on those the judge accepted; **not** on those accepted by hand, which lose them) | 5 of 22 judged attempts (the lead's figure) |
| Dishes with some rejection | the same | 3 of 18 |
| Acceptances through the new rule | `provenance.judge` with `own_form:` | 0 |
| Accepted by hand | the "accepted by hand" count under Images | 1 |
| Spend | `recipe_image_calls` | — |

With 18 dishes the starting point has an interval from 6% to 39%: until there are some 60 dishes
drawn under the new rule, a fall in the rate proves nothing. What does prove something from day
one: that the three production dishes, retried, are accepted.

---

## 13. Floors and process

- **Who builds it and who reviews it.** `docs/reference/agent-team.md` § Models: whoever implements
  allergy validation or **model-output validation** is opus at `high`, and `invariant-reviewer`
  too; `AGENTS.md` calls it `quality-max`. "A one-line change there is not a small change." This is
  both. `backend-high` and `invariant-reviewer`; `tests` if a case is added to the pictures e2e.
- **Decision.** A new record is needed (`0073`) that **amends `0066`**. `0066`'s sentence ("it is
  rejected only for a clearly visible extra food that the judge names and that carries an allergen
  the dish does not have") stays true word for word; what changes is what "extra" means, and two
  tests that pinned it the other way. `0072` and `0004` are untouched. The lead writes it with
  whatever the owner decides.
- **`legal`.**
  - *The privacy policy* ("If that model clearly sees in the image a food with an allergen the
    recipe does not carry, the image is rejected"): with R it stays true, and in my judgement more
    so than today — today a food the recipe **does** carry, named differently, is also rejected.
    With (iv) nothing changes. With (iii) "from the recipe alone" would need reviewing if the
    dish's name is passed to the judge (it is recipe data, not the person's). `legal` should
    confirm.
  - *The terms*, § 3.3: unchanged under every option.
  - *`dish-pictures.md` § 5, IMG-2*: a third route has to be added — "the judge accepts a form
    of the same family as the dish's" — with its mitigation (the `own_form` note, the closed
    table). IMG-1 does not change. IMG-16 weighs more (§ 8).
  - The line references to `judge.ts` in § 4.2 go stale.
  `legal` is told when the owner decides; until then there is no text to change.
- **The advisor.** I did not consult it: the team's rule reserves it for being stuck, and I was
  not.

---

## 14. Questions only the owner can answer

| # | Question | My recommendation |
| --- | --- | --- |
| 1 | Is the principle accepted: the form the dish has or names does not count as an extra food? | **Yes.** It is what fixes the three cases and 81 of the 128 exposed dishes, in exchange for 229 pairs of 26,394 |
| 2 | Is the title enough as a key, or is an ingredient the form can be made from also needed? | **The title is enough.** The cautious variant leaves 2 or 3 more dishes unfixed and adds a table. If `invariant-reviewer` prefers it, the difference is small |
| 3 | The meat-forms family: does it apply to heura, seitan, tempeh, textured soy, firm tofu and mince, or only to the plant substitutes? | **To all of those.** What is at stake are the binders of shop-bought meatballs (gluten, egg), which cannot be seen in any of them |
| 4 | Should "Withdraw" apply to any published image, not only those accepted by hand (IMG-16)? | **Yes, now.** It was left out in 009; R makes the judge accept more, and today a bad acceptance is only removed with a migration |
| 5 | Can the pilot's judge responses go into the (public) repository, as a test? | **Yes, reduced**: the foods seen, the matching and the slugs with their grams, without the names of the private library's dishes. Without that, the main criterion is not a test |
| 6 | Should `missing_main` be visible in `/admin` as a warning of an unfaithful photo? | **Later** (phase 4). Today it mostly measures how the judge names things |
| 7 | Are § 5.6's holes closed in this project? | **Yes, as phase 3.** It is the half of the work that makes the judge stricter |
| 8 | Lactose and "may contain": reviewed now? | **No.** With production data, in phase 4 |
| 9 | After shipping, retry the blocked dishes? | **Yes**, by hand from `/admin`: ≈ $0.04 each |
| 10 | Are the two judge calls' responses stored with each attempt, and are the notes kept on manual acceptance? | **Yes, in phase 1.** It is what makes it possible to measure the next tuning against production rather than against guesses. With nobody's data and no migration |

---

## 15. What I do not know

- **How often the judge uses each name.** All of § 5.3's exposure assumes names. Only production's
  notes (over time) or paid calls can say.
- **Whether (b) matched or not in the pancake case.** It can no longer be known: the manual
  acceptance erased the notes.
- **What the judge answered in production.** Only the verdict's notes are left; the 17 accepted
  images cannot be re-judged under another rule without paying for the calls.
- **What the three images showed.** Only the owner saw one.
- **Whether production's catalogue is the seed's** (930 rows). One extra row with a common word
  changes the loose-word step.
- **How many recipes have an English title.**
- **The real effect on the rejection rate.** With 18 dishes nothing can be claimed; see § 12.
- **Whether the title-plus-ingredient variant changes the 229 pairs.** I measured it with an
  earlier version of the tables; it has to be repeated with the final ones.

---

## Annex — The prototype's tables

They are the PRD's starting point, not the final design: every row is a test and a line the
reviewer reads.

**Families** (the judge's word → the dish has its own version if…):

| Words | An ingredient that *is* the form | The title names |
| --- | --- | --- |
| bread, toast, bun, roll, baguette, sandwich, crouton | `pan-sin-gluten` | pan, panecillo, tostada, tosta, tostaditas, rebanada, bocadillo, sándwich, bikini, montadito, arepas, migas |
| breadcrumb, crumb, breaded, batter, battered, tempura | `pan-rallado-sin-gluten`, `copos-de-maiz` | rebozado, empanado, tempura |
| pancake, crepe, waffle, fritter | — | tortitas (if the dish does not carry rice or corn cakes), crepes, galette, gofres, blinis, buñuelos |
| cake, muffin, cupcake, brownie | `tortitas-de-arroz`, `tortitas-de-maiz` | bizcocho, magdalena, muffin, tarta, pastel, brownie |
| biscuit, cookie | `galletas-sin-gluten` | galletas |
| cracker | `tortitas-de-arroz`, `tortitas-de-maiz` | — |
| tortilla, wrap, taco, flatbread, pita | `tortilla-de-maiz`, `nachos` | wrap, tacos, burrito, fajitas, enchiladas, quesadilla, arepas |
| pizza, crust, dough, pastry, pie, tart, quiche, empanada, dumpling, gyoza | — | pizza, empanada, empanadillas, quiche, hojaldre, gyozas |
| pasta, noodle, spaghetti, penne, macaroni, fusilli, lasagna | `pasta-sin-gluten`, `fideos-de-arroz-*`, `fideos-de-cristal` | — |
| meatball, burger, patty, sausage | `heura`, `seitan`, `tofu-firme`, `tofu-ahumado`, `tempeh`, `soja-texturizada`, `hamburguesa-vegetal`, `carne-picada-*` | albóndigas, hamburguesa, salchichas |
| nugget, croquette | — | nuggets, croquetas |
| milk, milkshake | `leche-de-soja`, `-avena`, `-almendra`, `-arroz`, `-coco`, `-coco-ligera`, `bebida-de-*`, `leche-sin-lactosa` | — |
| yogurt, yoghurt | `yogur-de-soja`, `yogur-de-coco` | — |
| cheese | `queso-vegano` | — |
| cream | `crema-de-coco`, `leche-de-coco*`, `nata-vegetal-*` | — |

**The names assumed for measuring the exposure** (§ 5.3): those in that table's "the name the judge
gives" column. **The reverse test's extra foods** (§ 5.4): 63, among them bread, toast, bun,
croutons, breadcrumbs, pancakes, waffles, cake, cookies, crackers, pizza base, pastry, pasta,
noodles, spaghetti, wheat tortilla, wrap, flatbread, meatballs, burger patty, nuggets, croquettes,
milk, yogurt, cheese, feta cheese, mozzarella, parmesan, cream, butter, egg, shrimp, prawns, king
prawns, mussels, squid, salmon, tuna, peanuts, walnuts, almonds, sesame seeds, tofu, soy sauce,
mustard, celery, oats, couscous, seitan, mayonnaise, hummus, pesto, surimi.

**Limits of the method.** The prototype is a copy of `judge.ts` with switches; it went through
neither lint, types nor review. The reverse test puts every extra food in as "main" and "specific",
the hardest case. Reconstructing a production case from its note is faithful in what the note says
and assumed in what it leaves out.

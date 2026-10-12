# 0001 — Generating diets: less LLM, more code (a report on an outside proposal)

> **Purpose**: the `architect` agent's verdict on a proposal the owner received on
> 2026-09-25 to redesign diet generation (fewer LLM calls, fewer tokens, less time, Oracle as
> support). It checks every premise against the code and the measurements and proposes the
> path and its phases.
> **Audience**: the owner and the agents. **Committed**: yes. **Maintained by**: the
> `architect` agent; it is not edited afterwards — a later review is a new report.
>
> Base: `main` at `5be3245` plus the uncommitted docs of project 005's phase 6.
> Every number carries its label: **measured** (where), **estimated** (with the hypothesis) or
> **unknown**. No model or gateway call was made while writing this report; the development
> database (`Nutria-E2E`) was only read, in `READ ONLY` transactions.

## 1. Verdict

**No to the architecture as proposed; yes to the goal, by another path that is shorter.**

- **No** to putting the LLM in charge of *choosing* among ~40 candidates and returning the
  fortnight's JSON (steps 5–7 and 10 of the proposal). Code already does that work in NutrIA,
  and does it better than a model can: the scheduler builds all 14 days from the library,
  searches portions exhaustively and leaves **153 of 154 days within 5% on all four macros
  with no model call at all** (measured today, below). An LLM selector would be a slower step
  placed in front of a deterministic step that would then have to redo the same work — it is
  exactly the alternative `0005` already rejected ("the model returns the plan and the code
  repairs it").
- **Yes** to cutting calls, tokens and time hard. The lever is not going from 4 calls to 1: it
  is going to **0 calls on the user's path** when the library covers the person, and moving
  the writing of new dishes (the only thing the LLM genuinely contributes) to a **background
  process** that grows the library while nobody waits. Expected time for a generation: from
  ~100–184 s to **~10–40 s** (estimated).

Conditions for the "yes":

1. **The owner decides to amend `0013`** ("a third of every plan is written fresh"). Today the
   model is called on **every** generation *on purpose*, not because the library is short;
   while `0013` stands as it is, no prompt optimisation gets below 1 call per meal. Freshness
   would come instead from the library growing in the background and from rotation, with a
   plan-similarity metric watching it.
2. **Measure before changing**: Neon read cost per generation, library coverage per profile,
   and similarity between the plans of similar people (phase 1).
3. **Clarify what "4–6 diets a minute" means.** If it is sustained (≈ 6,000–8,600 a day), it
   fits in no free plan **even if the LLM disappears completely**: Vercel Hobby's active CPU
   and Neon's transfer run out first (§ 9). That is a money decision of the owner's, not an
   architectural one.
4. Oracle does **not** run inference on the user's path (§ 8).

## 2. Premises checked

| # | The proposal's premise | Status | Evidence |
| --- | --- | --- | --- |
| P1 | "There are roughly 40 dishes available in the library" | **wrong** | Dev has **942 Spanish dishes** (500 `seed` + 458 `ai`) and 44 English ones (measured, `recipes` in `Nutria-E2E`). The ~40 that are visible are something else: the library dishes rotation has already put in the pool (28–35 in dev's real jobs, `generation_metadata.reused`), which the prompt lists as "DO NOT REPEAT THESE ALREADY-PROPOSED DISHES" (`apps/api/src/modules/ai/prompts/PoolPrompt.ts:700`). The **production** library is **unknown** to me: it depends on whether the owner loaded `docs/local/nutria-seed-500.sql`. |
| P2 | "The LLM builds the diet out of the library" | **wrong** | The LLM never sees the diet and never picks days. It writes **new** dishes (catalogue slugs + grams + steps) for a pool; the 14-day layout, the portions and the macros are code (`0005`; `packages/core/src/domain/Scheduler/Scheduler.ts:270`). |
| P3 | "7 dishes are generated per meal" | **confirmed, and deliberate** | `FRESH_DISHES_PER_SLOT = ceil(19 × 1/3) = 7` (`packages/core/src/domain/Variety/Rotation.ts:48-51`). Rotation hands the library at most 12 per meal (`:61`) so the model *always* has to write 7 (`0013`). It is not a library shortage. Project 005's phase 7 (decided, not built) lowers it to 3 dishes per request. |
| P4 | "4 calls, one per meal type" | **confirmed** for the four-meal shape | One request per meal, in parallel (`0016`; `PoolBuilder.service.ts:229-243`). With 3, 5 or 6 meals it is 3, 5 or 6. Up to 3 rounds (`:21`), but after the first it covers from the library before asking again (`:177-191`). |
| P5 | "~9,200–9,300 input tokens per call" | **confirmed for prompts ≤ 4.0.0; wrong for the current 4.1.0** | The four figures are nearly identical (9,228–9,320): that only happens when every meal sees the whole catalogue (930 rows), as it did up to 4.0.0. In dev, the only two jobs with a real model (3.2.1, 2026-09-12) carry 8,857–9,660 of input (measured, `plan_generation_jobs.ai_calls`). With 4.1.0 each meal sees its own catalogue: breakfast 14,640 characters, afternoon snack 16,085, lunch 12,467, dinner 11,998 (measured today, `catalogue-by-meal.mjs --month 9`) — that is ≈ 5,000 / 5,500 / 4,300 / 4,100 tokens (estimated at ~2.9 characters per token, the ratio measured in 3.4.0: 23,185 characters ≈ 8,000 tokens). Total ≈ **19k of input**, not 37k. |
| P6 | "12–18k reasoning tokens per call, 114–180 s" | **confirmed** (in order of magnitude) for the free reasoning models | Dev, 3.2.1: reasoning/output 13,365/16,108, 13,806/17,102, 23,319/26,146, 12,183/17,335, 12,472/16,508 tokens; 64–103 s per call; reasoning is **71–89%** of the output (measured, `ai_calls`). Today (4.1.0, `nemotron-3-ultra:free`): 6,149 of output of which 2,734 reasoning, ~143 s (measured, `docs/reference/ai-gateway.md` § 7). |
| P7 | "~70,000 reasoning/output tokens per generation" | **wrong as added up** | In the proposal's four rows the reasoning exceeds (total − input): breakfast 18,324 > 12,997; lunch 13,195 > 8,346; afternoon snack 12,294 > 5,221; dinner 12,790 > 7,949. The 71,571 "totals" *include* the ~37k of input; the reasoning adds up to 56,601. Either the dashboard they come from counts reasoning outside the total, or the figures come from different sources. **Hypothesis**; it is checked by reading that job's `ai_calls` in `/admin` (our `outputTokens` does include the reasoning: in dev, reasoning is always < output). |
| P8 | "A full generation takes ~184 s" | **confirmed** as a shape | The calls run in parallel, so the job lasts as long as the slowest one (179.7 s) plus ~5–30 s of loading, scheduling and saving. In dev, 3-call jobs: 103 and 107 s (measured). |
| P9 | "Much of the nutrition and dish information already exists in the library" | **confirmed** | The macros **never** come from the model: the schema has no field for them (`pool.schema.ts`, `generatedDishSchema`) and they are computed from the catalogue per 100 g (`0004`, `0045`). |
| P10 | "The LLM does work that deterministic code should do" | **confirmed, but not where the proposal looks for it** | Filtering, selection, portions, variety and validation are already code (§ 3). What the LLM does on top sits *inside* the dish: it is asked to land five figures per serving across 7 dishes under split rules (`PoolPrompt.ts:461-476, 612-624, 412-430`) — arithmetic the code redoes afterwards. That is what burns reasoning (§ 3.3). |
| P11 | "One call of 4,000–6,000 context tokens and 2,000–4,000 of output" | **hypothesis, and the recommendation beats it** | To write 3 new dishes for one meal, 4.1–5.5k of input and ~2–3.5k of visible output is realistic (estimated: ~500–650 visible tokens per dish with steps; measured in dev: 17,102 − 13,806 = 3,296 for 5 dishes). But the number that matters to the user is **0 calls** (measured: the library alone meets the bar, § 3.4). |
| P12 | "An Oracle A1 with 2 OCPU / 12 GB can help as an inference server" | **wrong for the user's path**; a weak hypothesis for background work | § 8: a 7–8B Q4 on 2 OCPU writes ~2.5–4 tokens/s (estimated from published figures); 3 dishes would be 8–12 minutes per call. |
| P13 | "4–6 generations a minute" | **unknown** whether that is peak or sustained | § 9: the current free LLM limit is ~12–17 generations **a day**; without the LLM, the limit becomes Vercel Hobby and Neon. |

## 3. What is there today

### 3.1 The path of one generation

```
POST /meal-plans → PlanJobRunner (in process, waitUntil; fails at 280 s: PlanJobRunner.service.ts:38)
  PlanGeneration.generate (apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts)
   :99-132   profile, context (catalogue + SafetyProfile + preferences), history, verdicts, check-in; onboarding and consent
   :136-147  targets ALREADY computed (Mifflin-St Jeor, overrides, limits) · meal shape · days with an event
   :156-165  rotation: without last fortnight's dishes or the ones they dislike; seed user+version
   :166-172  3 library reads in parallel (rotated pool, whole library, usage per meal)
   :178-205  PoolBuilder.build  ← HERE AND ONLY HERE does the LLM come in
   :234      schedulePlan (14 days × meals, variety, portions, 4 macros)
   :237-257  full_library rescue if the pool cannot fill it (with no second model call)
   :299-320  retry with the whole library if validation blocks
   :339-354  wider_rotation if a day falls outside 5% (0046)
   :379      assertPlanIsSafe — allergies again, over the assembled plan
   :383-389  resolved slugs · shopping list
   :399      atomic persistence
```

`PoolBuilder.build` (`apps/api/src/modules/ai/services/PoolBuilder.service.ts`):

- `:146-148` the catalogue the model sees is only what is **safe and wanted** for this person
  (the model cannot choose what it is not offered);
- `:155-168` each meal sees only its own catalogue (`0062`) and lunch/dinner the trim of `0063`;
- `:171-341` up to 3 rounds; one request per meal in deficit, in parallel, under a 170 s budget
  (`:27`); after round 1 it covers from the held-back library (`backfill`);
- `:403-522` every dish returned passes: schema → slugs → **the allergy gate** → preference
  exclusions → dish rules → an unresolved allergy named in the text → time → method foods that
  are not in the dish → the meals it belongs to. Only then does it enter the pool.

### 3.2 What is already deterministic (half the proposal already exists)

| Piece the proposal asks for | Where it is today |
| --- | --- |
| Target calories and macros | `core/domain/Nutrition` (`nutritionTargets`, `targetViolations`, `resolveTargets`), read at `PlanGeneration.service.ts:441-447` |
| Allergies, intolerances, forbidden foods | `core/domain/Safety` (`findSafetyViolations` by allergen id, `madeOf`, `bestEffortExclusions`), `SafetyController.getSafetyProfile` |
| Preferences and patterns | `core/domain/Preference` (`breaksDishRule`, `withinTime`), `PATTERN_*` in code since 4.0.0 |
| Number of meals and the split | `core/domain/MealShape` (`weightsFor`, `0036`) |
| Which food goes in which meal, season | `core/domain/MealFit` (`0062`, `0063`) |
| Pre-filtering dishes | `RecipeController.reusablePool` (safety, preferences, `fitSlots`, rotation) |
| Selection and scoring | `Scheduler.ts`: `fitCost` (`:548`), `pickBest`, `improveDay` (24 finalists per slot), exhaustive portion search (`:46`, up to 59,049 combinations per day), `spreadAcrossDays` |
| Variety and repetition | `core/domain/Variety` (`VARIETY_RULES`: max twice a fortnight, 2 days between repeats, 4 in the same meal; `Variety.ts:26`), repeated-protein cap |
| Validation afterwards | `core/domain/PlanValidation` (`PLAN_TOLERANCE` 5%, blocking energy floor and protein ceiling) |
| Automatic correction | `full_library` and `wider_rotation` in `PlanGeneration` — with no second model call |
| Structured JSON | `generateObject` with a schema (`StructuredAiClient.ts:62-65`), revalidated with Zod |
| Swappable model | `AiClient` + `resolveModel` (`ai.config.ts`): Anthropic, Google, Ollama, OmniRoute, stub (`0006`, `0050`) |

Phases 2 to 7 of the proposal's migration plan are, in essence, already done.

### 3.3 Why so many reasoning tokens are spent

1. **The models that answer are reasoning models and nothing limits them.**
   `StructuredAiClient` sends no effort control at all (`reasoning_effort`, `thinkingBudget`…):
   not a trace of one in `apps/api/src/modules/ai` (measured with grep). And they reason even
   when the task is trivial: rewriting the steps of *one* dish with 637 input tokens cost 7,810
   of reasoning (measured, `ai-gateway.md` § 6).
2. **The prompt asks for arithmetic from memory.** Per dish: kcal, protein, carbohydrate, fat
   and fibre per serving; half the set below and half above each figure (`PoolPrompt.ts:621`);
   caps by protein, method and cuisine (`:412-430`); ≤ 15 ingredients; steps documented with
   time and a cue. It is a constraint problem over composition tables the model does not have:
   a reasoning model iterates over it.
3. **That work is thrown away.** The code recomputes the macros from the catalogue and the
   scheduler rescales the portions. Even with all that reasoning, the accepted dishes miss
   their target by a median of 19% / 27% / 23% / 33% (kcal / P / C / F; measured,
   `nemotron-3-ultra`, `ai-gateway.md` § 7). Reasoning buys little accuracy.
4. **Steps are written for dishes that are then rejected.** 3 of 12 (`nemotron`), 12 of 14
   (`qwen3.8-27b` on Groq) (measured). Every rejected dish paid for its whole method.
5. **7 dishes per meal are always written** (`0013`), even when the library has 155–339 servable
   for that meal (measured today, `catalogue-by-meal.mjs`, omnivore).

### 3.4 What the library alone achieves (measured today)

`apps/api/scripts/evaluate-plans.mjs` over dev, 11 fixed profiles (low target with 3 meals,
high with 5, dairy allergy, vegetarian, a fortnight with an event, a free-text allergy resolved
and unresolved, halal, kosher, gluten-free, lactose-free), **with no model call at all**, the
whole library and no rotation:

- **153 of 154 days** within 5% on all four macros; the one outside, 5.0% on carbohydrate (low
  target, day 11);
- 0 variety violations, 0 unsafe dishes, exit 0;
- pools of 448 to 757 dishes per profile;
- 109 s of wall clock for the 11 profiles on this laptop, reads included → **~10 s per
  fortnight** (measured as an upper bound; the script does not separate loading from
  scheduling).

And `0046` measured what happens with the rotated pool of 12 per meal without the fresh part:
6/14 and 4/14 days on carbohydrate and fat; with the same rotation uncapped, 14/14. In other
words: **the model's new dishes are not what makes the macros land** — having enough pool is.
The model contributes novelty and library growth, which is what `0013` says it buys.

### 3.5 What the proposal does not see and does limit

- **The free LLM quota.** OpenRouter free: 20 requests a minute and 50 a day (measured in phase
  6, `docs/projects/005-…/LOG.md`); Gemini free: 20 a day, and it is production's fallback. At
  4 calls per generation that is **~12–17 generations a day** in total (estimated). Today this
  is NutrIA's limit, not latency.
- **Neon transfer.** Every generation reads the library **twice** in full
  (`PlanGeneration.service.ts:166-168`, `RecipeRepository.findReusable` with a `select()` of
  every column, steps included, `RecipeRepository.ts:211-232`) plus the usage per meal (≈ 6,000
  rows of `recipe_ingredients`) and the catalogue; a third time on a rescue. On disk: `recipes`
  0.86 MB, `recipe_ingredients` 0.67 MB, `ingredients` + names 0.33 MB (measured,
  `pg_column_size`). **≈ 2–4 MB per generation** (estimated). With 5 GB a month shared between
  production and development, that is ~1,300–2,500 generations a month.
- **Vercel Hobby.** 4 hours of active CPU a month, 360 GB-h of provisioned memory, 300 s per
  function ([limits](https://vercel.com/docs/functions/limitations),
  [Hobby](https://vercel.com/docs/plans/hobby); I/O waiting does not count as active CPU). The
  function has 1,024 MB (`apps/api/vercel.json`). Scheduling is pure CPU: at ~5–30 s per
  fortnight (0045: 4 s; 0049: 14 s with 5 meals, 29–33 s with 6), Hobby holds **~500–2,900
  generations a month** (estimated).

## 4. Proposal

### 4.1 The shape: two separate paths

```
                              THE USER'S PATH (synchronous with the job, 0 LLM calls if the library covers)
User ─► web (Vercel) ─► API (Vercel, NestJS) ─► PlanJobRunner
                                                     │
      core/domain (pure, no I/O)                     ▼
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ 1 profile → targets (Nutrition) → SafetyProfile (Safety) → shape (MealShape)   │
   │ 2 library: ONE read, cached by library version (new)                           │
   │ 3 hard filters: allergies · patterns · exclusions · MealFit · dislikes         │
   │ 4 per-person rotation (seed, without last fortnight, favourites first)         │
   │ 5 does each meal have ≥ 19 dishes? ── yes ───────────────────────────────┐     │
   │                                    └─ no (a real deficit) ─► PoolBuilder  │     │
   │                                        (LLM, ≤ 3 dishes/request,          │     │
   │                                         the same gates) ──────────────────┤     │
   │ 6 scheduler: hard variety + 4-macro scoring + portion search          ◄───┘     │
   │ 7 validatePlan · wider_rotation / full_library if it fails (no LLM)            │
   │ 8 assertPlanIsSafe · resolved slugs · shopping list                            │
   └──────────────────────────────────────────────────────────────────────────────┘
                                                     ▼
                                   PlanJobController.persist (Neon) ─► web draws the plan

                              THE BACKGROUND PATH (asynchronous, nobody waits)
cron (Vercel daily, or Oracle more often) ─► /cron/grow-library (API, CRON_SECRET)
   gaps = coverage(library, archetypes)  ─► ARCHETYPE briefs (nobody's data)
   ─► AiClient (gateway: free models; never Gemini) ─► the same gates as today
   ─► recipes(source='ai') ─► (optional) steps in a second call, only for the accepted ones
```

The difference from the proposal: the LLM **leaves** the user's path rather than staying on it
with a different task. What the model does well — writing a cookable dish, with a name and a
method, in Spanish — is done **outside the wait**, against measured gaps in the library, and
each dish then serves every compatible person (`0006`).

### 4.2 Division of responsibilities

| Task | Code (`core/domain`) | Database | LLM |
| --- | --- | --- | --- |
| Targets, limits, energy floor, protein ceiling | **yes** | stores overrides | never |
| Allergies, intolerances, forbidden foods, patterns | **yes** (by id) | catalogue and allergen links = source of truth | never (it only sees what is already filtered) |
| A dish's nutrition | **yes**, summed per 100 g | `ingredients` per 100 g | never (the schema has nowhere to put it) |
| Which food in which meal, season | **yes** (`MealFit`) | `meal_slots`, `season_months` | never |
| Which dishes, which days, which portion | **yes** (scheduler) | the `recipes` library | **no** (I reject step 7 of the proposal) |
| Variety and repetition | **yes** (`Variety`) | plan history | never |
| Validation and correction | **yes** | — | never ("the model does not review itself", `0004`) |
| Writing a **new** dish (name, ingredients by slug and grams, steps) | validates | stores it | **yes** — its only job |
| Rewriting old methods | validates | — | yes (already exists, `/cron/rewrite-steps`) |
| A substitute when the library has none | picks from the library first | — | yes, only as a last resort (already so, `MealSwap.service.ts:145-175`) |

### 4.3 What stops being sent to the LLM

On the user's path, everything: there is no call. On the background path, the brief is an
**archetype** (meal, nameable pattern, the allergen set to exclude, macro split, energy range,
maximum time), not a person: personal targets, likes, the names of dishes served, loved and
rejected (`PoolPrompt.ts:684-700`, up to 60 + 40 + 40 names) and the list of slugs not to
repeat (≈ 30–40) all disappear. It is better for Legal A too: the model receives nothing
derived from anybody.

### 4.4 Alternatives considered

| Alternative | Why it loses |
| --- | --- |
| **The proposal: the LLM picks among candidates and returns the fortnight** | The scheduler already picks with exact arithmetic and an exhaustive search; the LLM cannot compute macros, so its output would be revalidated and rescaled → it is `0005`'s "the model returns the plan and the code repairs it", with one more call. |
| **1 call for the whole fortnight** | `0005`: the tail of a long answer degrades and one failure throws away 60 dishes. And it would still depend on the daily quota. |
| **2–3 calls (grouping meals)** | Fewer requests against the per-minute limit, the same amount of output; latency is set by the output (`0016`), so it would be *slower*. Useful only if the provider limits requests rather than tokens — and the background path already solves that with nobody waiting. |
| **Keep `0013` and only tune the prompt** | It still costs ≥ 1 call per meal per plan; with free quotas of ~50/day the ceiling stays at ~12–17 plans a day. |
| **Local inference on Oracle, on the user's path** | § 8: orders of magnitude too slow on 2 OCPU. |
| **A fast, non-reasoning paid provider on the user's path** | It works and is cheap per plan (§ 12), but it breaks "zero euros" and is still 30–90 s of waiting that the library delivers in 10. It stays as an option for the background path if the owner pays. |

### 4.5 The JSON contract

There are **two** contracts, because the LLM no longer returns the diet.

**(a) What the LLM returns — a dish, not a plan.** It is `generatedDishSchema` almost as it
stands (what suits best in the proposal is already there: slugs, grams, no nutrition).
Recommended changes, each measurable with `bench-models.mjs`:

```json
{
  "dishes": [
    {
      "name": "Merluza al horno con patata y pimiento",
      "slots": ["dinner"],
      "servings": 2,
      "prep": 10, "cook": 25, "difficulty": "easy", "cuisine": "espanola",
      "items": [ { "s": "merluza", "g": 300 }, { "s": "patata", "g": 350 },
                 { "s": "pimiento-rojo", "g": 150 }, { "s": "aceite-de-oliva-virgen-extra", "g": 15 } ]
    }
  ]
}
```

- **No steps in the first call** (the composition stage). The code checks slugs, allergies,
  preferences, the meal and the dish's distance from the split; **only the accepted ones** go to
  a short second call that writes the method — that prompt already exists (`RewritePrompt.ts`,
  `STEPS_VERSION`). It saves the method of every rejected dish and leaves composition at
  ~80–120 tokens per dish (estimated).
- Short keys (`s`, `g`) only if the provider charges for output; on a free tier it changes
  nothing. A hypothesis, low impact.
- No nutrition fields, as today: there is nowhere to write an invented figure.

**(b) The diet — produced by code, not by the LLM.** It already exists as `PlanDraft`
(`PlanGeneration.service.ts:512-585`) and it is what the web transforms: days → meals with
`recipeSlug`, `servings`, `slot`, `sortOrder` and the macros **computed** and frozen into the
row (`meals` stores the snapshot). A compact shape for the API/web, if a public contract is
wanted:

```json
{ "v": 1, "start": "2026-09-26",
  "targets": { "kcal": 2100, "p": 140, "c": 230, "f": 68, "fib": 30 },
  "days": [ { "d": 1, "loadedFor": null,
              "meals": [ { "slot": "breakfast", "recipe": "tostada-de-aguacate-y-huevo", "servings": 1.25,
                           "kcal": 480, "p": 24, "c": 52, "f": 19 } ] } ] }
```

### 4.6 The deterministic engine: hard rules and soft ones

| Rule | Kind | Where |
| --- | --- | --- |
| Declared allergens, intolerances, resolved free-text allergies and what is "made of" them | **hard** (blocks; 422 and an error log if it reaches the end) | `Safety` |
| Patterns (vegan, vegetarian, halal, kosher, gluten-free, lactose-free) and taste exclusions | **hard** | `Preference`, `PATTERN_*` |
| A dish with a slug that does not resolve | **hard** | `dishSafety` → `unknown_ingredients` |
| Daily energy floor, protein ceiling of 3 g/kg | **hard** | `PlanValidation` + `minimumKcal` in the scheduler |
| A food outside its meal (`meal_slots`, `['none']`) | **hard** | `MealFit` |
| Maximum time per dish | **hard** (with slack) | `withinTime` |
| Max twice a fortnight, 2 days between repeats, 4 in the same meal | **hard** (prevented, not detected) | `canPlace` |
| Energy, carbohydrate, fat ±5%; protein −5% | **soft, with an advisory** (delivered and recorded) | `PLAN_TOLERANCE`, `0011`, `0045` |
| Size order between meals (a light dinner does not outweigh lunch) | nearly hard (cost 1,000 over bands) | `ORDER_OUTRANKS_BANDS` |
| Repeated main protein in a day / fortnight | soft | `PROTEIN_REPEAT_WEIGHT`, `proteinCap` |
| Preferred cuisines, liked foods, loved dishes | soft (they go first, they never filter) | `isPreferredDish`, `0026` |
| Season | soft (ordering, never a filter) | `inSeason` |
| Fibre | **no band today** (only asked of the model) | proposed: an advisory if below 80% of the day's target; measure first |

### 4.7 Selection and scoring

Of the proposal's five options, the technical answer is not a matter of opinion: **C + D in
code, no LLM** (and that is what already runs). A loses because the model cannot add macros
reliably (`0005`); B and E add a call whose result the code would have to revalidate and rescale
anyway.

The current function, per dish and slot, with the slot's budget `b` (the day's split × the
meal's weight) and the serving `s` quantised to ¼ between 0.5 and 4:

```
cost(dish, s) = 1.5·|kcal−b.kcal|/b.kcal + |P−b.P|/b.P + 0.75·|C−b.C|/b.C + 0.75·|F−b.F|/b.F
                                                                        (Scheduler.ts:548-570)
cost(day)     = Σ bandMiss·10  + order inversions·1000 + floor·1,000,000
                + protein repetition·0.05 + per-meal deviation from the split (SHARE_BAND)
```

with variety as a hard constraint (`canPlace`), 24 finalists per slot repriced with an
exhaustive portion search, and a pass that spreads across days. What I would add, only as soft
terms and measured with `evaluate-plans.mjs --compare`:

- `+ λ_nov · recently_used_by_similar_profiles(dish)` — novelty between people, to make up for
  the pool no longer bringing 7 new dishes per meal (it replaces `0013`);
- `+ λ_fib · max(0, 0.8·fibre_target − day_fibre)/fibre_target` if a fibre band is decided on.

### 4.8 Is reasoning needed?

| Task | Reasoning? | The right model |
| --- | --- | --- |
| Targets, filters, selection, portions, validation | none — it is code | none |
| Composing a dish (ingredients and grams) near a split | little, if the code adjusts afterwards | a large instruct model, or reasoning at low effort |
| Writing the method of an already-accepted dish | none | instruct; a small model *might* (unmeasured) |
| Choosing among candidates | not applicable (the scheduler does it) | — |

Measured: reasoning buys no accuracy here (§ 3.3, point 3); the only fast model measured (Groq
`qwen3.8-27b`, ~5 s) writes incoherent dishes (2 of 14 valid). The useful conclusion is to
**compare the same model at low reasoning effort** — the lever is not wired today — before
changing model. A small local model has no task on the critical path at all today.

### 4.9 Validation strategy

It already exists and is kept whole: a strict Zod schema behind a loose wire schema; slugs
against the catalogue; the allergy gate by id **before and after** assembling the plan
(`PoolBuilder.service.ts:422-436`, `PlanGeneration.service.ts:379`); pattern and taste
exclusions; dish rules; an unresolved allergy named in the text; time; method foods that are not
in the dish (`methodMentions`); the right meal (`fitSlots`); macro bands; floor and ceiling;
variety; resolved slugs before the shopping list. Proposed additions:

1. **`evaluate-plans.mjs` as the gate on every generation change** (`plan-evaluator` already
   uses it): no profile worse, 0 allergens.
2. **A dish from the background path enters the library only if**, on top of today's gates, its
   per-serving split lands within a margin (say 25% per macro; to be measured) and the scheduler
   *can* use it for some archetype. A dish no pool ever picks is noise in the library and
   transfer on Neon.
3. **Plausible grams per serving** (oil, nuts, salt): check whether `pool.schema.ts` already
   covers it before adding anything (**unknown**).
4. **Similarity between plans** (Jaccard of dishes between people with similar profiles) as a
   watched metric: it is what `0013` was protecting.

### 4.10 Fallback strategy

| Failure | What happens |
| --- | --- |
| The library does not cover a meal for this person (e.g. a vegan late dinner: 8 dishes of 19, measured) | the LLM is called **for that deficit only**, ≤ 3 dishes per request, with a time budget; if it does not answer, `full_library`; if that still does not fill it, `GENERATION_POOL_TOO_SMALL` / `GENERATION_AI_UNAVAILABLE` (as today) |
| Days out of band | `wider_rotation`, then delivered with advisories (as today) |
| The gateway or Oracle down | the user's path never notices if the library covers; the background path pauses and carries on tomorrow |
| A free model disappears or changes its limits | the combo in the gateway changes (the owner's configuration); none of the nutrition code changes |
| Rollback | `AI_PROVIDER=google` and redeploy (`ai-gateway.md` § 4); and the "deficit only" mode behind a variable, to go back to `0013` without a code deploy |

## 5. Requirements

- **Code** (all of it in existing pieces):
  - `core/domain/Variety`: make the fresh share per plan configurable (0 on the user's path),
    and coverage per archetype a pure function;
  - `PlanGeneration`: a single library read (two today, `:166-168`) and an in-process cache by
    version (e.g. `max(updated_at)` + the count of `recipes`);
  - a `LibraryGrower` service and its cron route, reusing `PoolBuilder.validate` and
    `buildPoolPrompt` with an archetype context;
  - `StructuredAiClient`: a per-provider reasoning-effort option (measure first);
  - measurement scripts: coverage per archetype and similarity between plans (read-only).
- **Data**: the production library has to exist. If the 500-dish seed is not loaded in
  production, this plan does not work there until it is (**unknown**, § 13).
- **Infrastructure**: none new for phases 1–4. Oracle optional from phase 6.
- **Money**: €0 up to the sustained-traffic scenario (§ 9, § 12).
- **The owner's decisions**:
  1. amend `0013` (freshness off the user's path) — the one that unblocks everything;
  2. what "4–6 a minute" means (peak or sustained) and how much he would pay if it is sustained;
  3. whether the code may adjust an ingredient's grams to bring a dish closer to its split
     (`0045` § "What this does not do" leaves it as a product decision);
  4. the daily budget of free calls the background path may spend.
- **The owner's time**: review two new metrics and decide 1–4; generate a fortnight in
  production to verify each phase that touches it.

## 6. Risks

| Risk | To whom | Likelihood | How it would show | How to undo it |
| --- | --- | --- | --- | --- |
| **Safety**: a dish from the background path is served to somebody with an allergy | the user | low: the archetype brief excludes, and the allergy gate runs **per person** when serving (`reusablePool`) and again over the assembled plan | `SafetyViolationError`, an error log, `evaluate-plans` exit 2 | no new path skips `dishSafety`; `invariant-reviewer` reviews phase 4 |
| **Privacy**: an archetype brief leaks something of a person's | the user | low if the archetypes come from catalogue combinations rather than real profiles | a pass by `health-boundary.spec.ts` and the prompt | build archetypes only from enumerations (meals × nameable patterns × allergens × splits), never from rows of `profiles` |
| **Neon quota**: the cache misses and every generation still reads 2–4 MB | the owner (production and dev share 5 GB) | medium | the Neon dashboard | phase 2 goes *before* any traffic increase |
| Plans more alike between people once the fresh share per plan is gone | the user | **medium** — it is what `0013` fixed | phase 1's similarity metric | an environment variable to go back to 1/3 |
| The library stops growing if the grower cannot get valid dishes | the product | medium (free models are unstable; phase 6: 2 of 6 answers) | accepted/day in `/admin` | the user's path keeps serving; raise the budget or pay for a model for the grower |
| Neon transfer from the grower (it reads the library to compute gaps) | the owner | low | Neon | compute coverage with the same cache |
| A more frequent `full_library` rescue when no new dishes arrive | the user | low: measured that the uncapped library gives 14/14 | `fallback` in `generation_metadata` | — |

## 7. Cost and effort

| Phase | Effort (agent) | Variables |
| --- | --- | --- |
| 1 Measurement | 0.5–1 day | read-only access; the owner reads production's `/admin` |
| 2 One read + cache | 0.5–1.5 days | how the library is versioned; reused Vercel instances (Fluid) |
| 3 "Deficit only" mode | 1–2 days | the `0013` amendment; e2e tests that expected "the model is always called" (`0013`'s LOG notes the suite catches it) |
| 4 Library grower | 3–5 days | defining the archetypes; a pass by `invariant-reviewer` and `legal` |
| 5 Two-stage composition + reasoning effort | 2–3 days + measurement | which providers in the combo accept effort control |
| 6 Oracle as a cron trigger / worker | 1–3 days + the owner's time on Oracle | whether a second instance of `apps/api` is deployed |
| 7 Local-model experiment | 1 day + machine hours | no production impact; only if the owner wants it |

Cost in euros: **0** for phases 1–7 at today's traffic.

## 8. Plan

Each phase ships on its own; the next starts only once the previous one's signal is met. Phases
2–7 of the proposal are already done in the code (§ 3.2) and are not repeated.

**Phase 1 — Measure what is in production and what is missing.**
Goal: replace the proposal's figures with 4.1.0's. Changes: a read-only script for coverage per
archetype (meal × pattern × allergens × split → servable dishes) and for similarity between
plans; the owner exports from `/admin` the `ai_calls` of the last production generations. Risk:
none. Metric: a table of tokens/time at 4.1.0 per meal; the number of library dishes in
production; minimum coverage per archetype; mean Jaccard between similar plans today (the
baseline). Signal to pass: the tables written in this directory or in the project's LOG. Stop if
the production library is far smaller than dev's: load the seed first.

**Phase 2 — Read the library once, and cache it.**
Goal: Neon bytes per generation. Changes: one read in `PlanGeneration` (two today plus one on a
rescue), minimum columns (no steps or images for the scheduler; steps are only read when
drawing), a cache by version. Risk: serving a stale library → the version is checked with a
cheap query. Metric: MB per generation (before/after) and `evaluate-plans --compare` unchanged.
Signal: ≥ 3× less transfer, 0 profiles worse.

**Phase 3 — The user's path with no LLM when the library covers.**
Goal: 0 calls on most generations. Changes: after the `0013` amendment, `FRESH_SHARE` by
configuration (0 on the user's path), rotation capped at `DISHES_NEEDED_PER_SLOT`; the model only
for a real deficit. Risk: similarity between plans. Metric: calls per generation (p50 = 0), p50
duration < 30 s, days within 5% equal or better, Jaccard no worse than the baseline plus
whatever margin the owner sets. Signal: a week of production with those numbers. Stop if
similarity rises above the margin: back to 1/3 with the variable.

**Phase 4 — The library grower.**
Goal: novelty coming from the library growing rather than from each plan. Changes: `LibraryGrower`
+ `/cron/grow-library`; gaps from phase 1's coverage; archetype briefs; a daily budget of free
calls (never Gemini, the owner's rule of 2026-09-25); ≤ 3 dishes per request (005's phase 7);
the same gates. Risk: safety and privacy (a pass by `invariant-reviewer`, `legal`). Metric:
dishes accepted/day, % valid, gaps closed. Signal: minimum coverage per archetype ≥ 19 across
every meal measured (the vegan late dinner is at 8 today). Stop if % valid < 50% for a week:
change model or pay for the grower.

**Phase 5 — Less reasoning per dish.**
Goal: tokens and seconds per dish written. Changes: effort control in `StructuredAiClient` per
provider; composition and method in two calls (the second only for the accepted); optionally, a
deterministic grams adjustment if the owner decides on it. Risk: worse dish quality. Metric
(`bench-models.mjs`, free calls declared in advance): output per dish, % valid, median deviation
from the split, `foreign_food`. Signal: −40% of output per accepted dish with no worse % valid.
Stop if the valid share falls.

**Phase 6 — Oracle as auxiliary infrastructure.**
Goal: more frequent crons and no 300 s limit for background work. Changes: Oracle calls
`/cron/grow-library` and `/cron/rewrite-steps` hourly with `CRON_SECRET` (Hobby only allows
daily crons, `ai-gateway.md` § 6); optionally, a **second instance of `apps/api`** on Oracle
picking up background jobs (the invariant "only `apps/api` opens a connection" holds: it is the
same app). Risk: a dependency → nothing critical runs only there; if Oracle goes down, Vercel's
daily cron carries on. Metric: dishes/day from the grower, zero impact on the user's path.
Signal: a stable week.

**Phase 7 (optional) — A local model on Oracle?**
Only as an experiment: a 3B and a 7–8B Q4 with `llama.cpp`, measured with the same
`bench-models.mjs` (without touching production). Signal to stop: < 50% valid dishes or > 10 min
per 3-dish request.

**Phase 8 (conditional) — Sustained traffic.** Only if the owner confirms 1+ generation a minute
sustained: decide on Vercel Pro (or move scheduling to a worker of our own), a paid Neon and, if
the library does not grow fast enough, a paid model for the grower.

## 9. Performance by traffic scenario

Assumptions: 4 meals a day; current path = 4.1.0 with phase 7 (≤ 3 dishes per request, ~4 calls
per generation, ~19k input tokens, 4–10k output per call with reasoning, 90–180 s); proposed path
= 0 calls on ~90% of generations (**estimated**, to be measured in phase 3) and 1–2 calls on the
rest; scheduling 5–30 s of CPU; Neon read 2–4 MB without cache, ≤ 0.2 MB with it (estimated).
"Per minute sustained" × 1,440 = per day.

| Diets/min | Today: calls/min · tokens in/min · out/min | Today: concurrency (generations in flight · LLM requests) | Proposed: calls/min | Proposed: concurrency | Expected time (proposed) | What it would take |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 · ~76k · 16–40k | 2–3 · 6–12 | ~0.1–0.2 | ≤ 1 | 10–40 s | Today: impossible for free (≈ 1,440/day against a quota of ~12–17/day). Proposed: the LLM quota is ample; **Vercel Hobby** runs out (~43k gen/month against ~500–2,900) and so does **Neon** (43k × 0.2 MB ≈ 9 GB) |
| 2 | 8 · ~150k · 32–80k | 3–6 · 12–24 | ~0.2–0.4 | ≤ 1–2 | 10–40 s | the same ×2: Vercel Pro or a worker of our own; a paid Neon |
| 4 | 16 · ~300k · 64–160k | 6–12 · 24–48 | ~0.4–0.8 | 1–3 | 10–40 s | the same; at 16 calls/min the current path also hits OpenRouter's 20 requests a minute |
| 6 | 24 · ~460k · 96–240k | 9–18 · 36–72 | ~0.6–1.2 | 2–4 | 10–40 s | the same; a 2-OCPU ARM worker would give ~4–8 gen/min of scheduling (estimated: ~15–30 s of CPU per fortnight on ARM, 2 cores) |
| 10 | 40 · ~760k · 160–400k | 15–30 · 60–120 | ~1–2 | 3–7 | 10–40 s (+a queue at peak) | horizontal scaling of the scheduling; the current LLM path would need a paid provider with hundreds of requests a minute |

What matters in that table is not its precision (it has none), it is its shape: **with the
current architecture the limit is the LLM quota (~12–17 generations a day); with the proposal,
the LLM stops being the limit and Vercel's CPU and Neon's transfer become it**. Neither of those
is fixed with prompts.

## 10. Oracle Cloud (A1, 2 OCPU, 12 GB, ARM64, no GPU)

Published figures (**estimated**, not measured on the owner's machine): on an A1 with **4 OCPU**,
a 7B Q4_K_M generates ~5–8 tokens/s and a Qwen2.5-3B Q4_K_M ~10.6 tokens/s with llama.cpp; the
CPU saturates at 90–100% during inference
([Tiffena Kou, Ampere A1 benchmark](https://tiffena.me/blog/ai-infrastructure/benchmark-cpu-only-llm-inference-oracle-ampere-a1-llama.cpp-ollama-docker/),
[Ampere/Oracle, Llama 3 on A1](https://amperecomputing.com/blogs/llama3-on-Ampere-based-OCI-A1),
[Oracle free tier guide](https://blog.easecloud.io/ai-cloud/launch-oracle-cloud-llms-in/)).
With **2 OCPU** (half; performance is set by cores and memory bandwidth) and OmniRoute sharing
the machine: 7–8B ≈ **2.5–4 tokens/s**, 3B ≈ **5–6 tokens/s** (estimated, linear scaling).
Reading the prompt on CPU costs too: 4–5k tokens is minutes, not seconds (estimated, with no
reliable published figure for 2 OCPU).

| Use | Viable? | Why |
| --- | --- | --- |
| An LLM on the user's path (any size) | **No** | 3 dishes ≈ 1,500–2,000 visible tokens → 8–12 min with a 7–8B; the job dies at 280 s |
| Ollama with a 3B to write dishes | Not without measuring | the only small-to-medium model measured (27B on Groq) writes 2 of 14 valid dishes; a 3B will be worse (hypothesis) |
| A quantised 7–8B for the background grower | A weak hypothesis | with no deadline, ~5–20 dishes/hour (estimated) if quality allowed it; decided by phase 7 |
| The OmniRoute gateway | **Yes, it already is** | that is its current role and its best one |
| A cron trigger (hourly instead of daily) | **Yes** | cost ~0; not critical: Vercel keeps its daily cron |
| A second instance of `apps/api` for background work (grower, rewrite) | **Yes, on conditions** | no 300 s limit and no active-CPU limit; the library cache always warm; its Neon transfer counts the same |
| A scheduling worker for the user's path | Yes, **with a fallback** on Vercel | if the worker does not take the job within N s, Vercel runs it in process as it does today; that way Oracle is never critical |
| Validation, scoring, caching | Only as part of `apps/api` | validation and scoring are `core`; they run wherever the API runs, and a separate service would duplicate the rules |
| A queue | Unnecessary | `plan_generation_jobs` already is the queue |

## 11. Costs (which variables rule)

| Architecture | Cost per generation | The variables that set it |
| --- | --- | --- |
| Current (4 calls, reasoning) | €0 on the free tier, but **capped at ~12–17/day**; paid, ~15–20k input tokens + 16–40k output per generation (estimated) | number of meals; new dishes per plan (`0013`); reasoning tokens (model and effort); price per output token; retries |
| Optimised (0 calls when it covers) | ~€0 of LLM; scheduling CPU + Neon reads | pool size (the CPU of the portion search, 6 meals = 30 s); reads per generation and the cache; share of generations with a deficit |
| With a local model (Oracle) | €0 in money, but machine time and quality | tokens/s on 2 OCPU; share of valid dishes; Oracle staying free and available |
| Hybrid (the proposal) | user path ~€0; background path: new dishes a day × tokens per dish × price (€0 with free models) | the library growth rate wanted; reasoning effort; two-stage composition; a provider's batch tier if it is ever paid (hypothesis: ~50% cheaper, no deadline) |
| Sustained traffic ≥ 1/min | no longer the LLM: it is **Vercel** (active CPU) and **Neon** (transfer) | a money decision of the owner's |

## 12. The 10 highest-impact optimisations, in order

1. **Take the LLM off the user's path when the library covers** (amend `0013`): 4 calls → ~0;
   ~184 s → ~10–40 s; the LLM quota stops being the limit.
2. **A background library grower** against measured gaps and with archetype briefs: novelty with
   no wait and with nobody's data in the prompt.
3. **One library read per generation, minimum columns and a cache by version**: Neon transfer,
   which is the next limit.
4. **Controlled reasoning effort** in `StructuredAiClient` (nothing is sent today).
5. **Composition and method in two calls**: no writing steps for dishes that get rejected.
6. **≤ 3 dishes per request** (005's phase 7, already decided): the output sets the time.
7. **Take out of the prompt what the code already guarantees**: the list of slugs not to repeat
   (a duplicate is already rejected in `validate`, `PoolBuilder.service.ts:418-420`), the
   "straddle" rules if the scheduler or a grams adjustment settles them.
8. **A deterministic grams adjustment** of one ingredient to bring a dish closer to its split (a
   product decision, `0045`): it takes from the model the arithmetic that asks for the most
   reasoning.
9. **Oracle as a cron trigger and background worker**, with a fallback on Vercel.
10. **Prompt caching / batch**: no effect today (0 cached tokens measured on the free models);
    only relevant if a provider is ever paid for. Speculative decoding and function calling add
    nothing controllable from here.

## 13. What I do not know

- **The production figures at 4.1.0**: the proposal's fit ≤ 4.0.0. Only production's `/admin`
  can say (I did not query it: the rule is not to touch production).
- **The size of the production library** and whether the 500-dish seed is loaded.
- **Why reasoning exceeds (total − input)** in the proposal's four rows.
- **How alike today's plans are between people**, and how much that would rise with the fresh
  share per plan gone: it is what decides whether phase 3 is acceptable.
- **The real scheduling CPU on Vercel and on ARM**: all I have here is ~10 s per fortnight on a
  laptop, reads included.
- **The real bytes per generation on the wire** (I estimated 2–4 MB from the size on disk).
- **Whether the combo's models accept an effort control** through OmniRoute.
- **What "4–6 a minute" means** and how much the owner is willing to pay if it is sustained.
- **The real performance of a 7–8B on the owner's 2 OCPU** with OmniRoute beside it.

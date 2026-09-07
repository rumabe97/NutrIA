# Improvement review — 2026-09-07

> A read of the whole product, web and API, after project 003. Ordered by what I
> would do next, not by where the code lives. Every claim is checked against the
> repository or the live database; where I have not verified something I say so.
>
> **Audience**: the owner. **Committed**: yes.

Three things were fixed while writing this, because they were cheap and the
evidence was already on screen: five unindexed foreign keys (§1.1), the
locale split (§2.1) and the shopping list (§4.1). The rest is a list, not a plan.

---

## 1. Correctness and safety

### 1.1 Unindexed foreign keys — **fixed**

Fifteen foreign keys had no index behind them. Postgres indexes primary keys and
unique constraints automatically and foreign keys never, so each of these was a
sequential scan waiting for the table to grow. Five were on hot paths and are now
indexed (`0008`): `meals.recipe_id` and `recipe_ingredients.ingredient_id` (every
plan read), `allergies.allergen_id` and `intolerances.allergen_id` (every safety
profile load, which happens before anything produces food), and
`custom_allergens.ingredient_id`.

The remaining ten are on tables that are empty or tiny today —
`meal_completions`, `meal_feedback`, `favorite_recipes`, `disliked_recipes`,
`check_ins.plan_id`, `plan_generation_jobs.plan_id`, `recipes.created_by`,
`shopping_list_items.ingredient_id`, `ingredient_substitutions.substitute_id`,
`food_preferences.ingredient_id`. Index them as the features that use them land,
not before.

### 1.2 The generation runner still dies with the process

`PlanJobRunner` runs in-process and is not awaited. A deploy mid-generation
orphans the job. `adoptCompleted` now recovers the case where the plan committed,
and `failStale` handles the rest, but a generation interrupted at, say, the
scheduling stage is simply lost and the user pays for another.

This is a deliberate trade recorded in the code — no queue, no webhook, no third
party — and it is the right one for a self-hosted product. The upgrade path, when
it is worth it, is a durable queue behind the same job row: the schema and the API
would not change.

### 1.3 `serverApi` turns every failure into an empty screen

`serverApi` returns `null` on any non-2xx, and every screen renders an empty state
for it. That is right for "no plan yet" and wrong for "the API is down": the user
sees a tidy, confident, entirely false page saying they have no plan.

**Suggested**: distinguish *absent* from *unreachable*. A 404 or a null body is
absence; a 5xx, a timeout or a network error is a failure and should reach the
error boundary, which already exists and already says the right thing.

### 1.4 Nothing bounds a plan's age

`getActivePlan` returns the active plan whatever its dates. A plan whose fourteen
days ended a month ago is still "active" and still what the dashboard shows,
handled only by a cosmetic "your plan has finished" branch. Nothing archives it.

### 1.5 The e2e suites have never been executed

Seven suites, all committed, none ever run — they need a throwaway database. They
typecheck and lint, which is not the same as being correct. The first run is
work, not a formality, and should happen before they are trusted as a gate.

---

## 2. The two-sources-of-truth pattern

This shape has now caused three separate bugs. It is worth naming as a class.

### 2.1 UI language vs data language — **fixed**

The interface read its language from a cookie and the *content* read it from
`profiles.locale`. Change the language while signed out and the two disagreed for
ever: an English interface full of Spanish ingredient names. Requests now carry
the locale and the API prefers it, so there is one answer per request. Sign-in
reconciles in the direction of whoever chose.

### 2.2 Targets, and generation computing its own — fixed in 003

`PlanGenerationService` used to call `nutritionTargets` itself. Two call sites,
one rule, agreeing by luck.

### 2.3 The safety profile, assembled twice — fixed in 003

`RecipeController.generationContext` built its own. It survived until free-text
allergies arrived and only one of the two knew about them.

**The lesson worth keeping**: every one of these was a *read* that looked cheap to
duplicate. The rule that has held is one named function per question —
`getSafetyProfile`, `resolveTargets`, `localeFor` — and no second implementation
however small.

---

## 3. Performance

### 3.1 The dashboard makes six sequential-ish API calls

`/users/me`, `/profile`, `/meal-plans/active`, `/shopping-lists/active`,
`/progress/weight`, plus onboarding. They run in one `Promise.all`, but each is a
separate HTTP round trip to the API, which then makes its own queries —
`getFullProfile` alone is ten. On a local network this is invisible; on a mobile
connection to a remote API it is the slowest screen in the product.

**Suggested**: a single `GET /dashboard` composing what that screen needs. The
controllers already exist; this is one route and one view type.

### 3.2 Everything is `force-dynamic` with `no-store`

Correct for authenticated health data and wrong for the landing page, which is
identical for everyone and re-renders per request. It became dynamic when it
started reading the locale cookie.

**Suggested**: render the landing page per locale at build time and select on the
cookie at the edge, or accept the cost — it is one page.

### 3.3 The catalogue is re-read on every generation

`loadCatalogue` fetches 200 ingredients, 400 names and 104 allergen links per
generation. It is reference data that changes when someone runs the seed.

**Suggested**: an in-process cache with an explicit invalidation, not a TTL —
a stale allergen link is a safety bug, so the seed should clear it rather than
time doing it.

---

## 4. Product gaps

### 4.1 The shopping list was read-only — **fixed**

Items can now be ticked off, optimistically, with ownership resolved inside the
update. Deliberately still not editable: changing a quantity changes what the
list claims the plan needs, which is a different claim.

### 4.2 Meal completion, replacement and feedback

The tables exist (`meal_completions`, `meal_feedback`, `favorite_recipes`,
`disliked_recipes`) and nothing writes them. This is the biggest single gap: a
plan you cannot mark as followed is a document, not a tool, and the biweekly
check-in that project 002 designed has nothing to read.

**This is the next project.** A replacement must re-run `dishSafety` and the
day's macro balance on the substitute — a swap that skips either is how someone
gets served an allergen.

### 4.3 No check-in, so plans do not learn

`check_ins` is unwritten. "Adjusted every fortnight according to what actually
works for you" is on the landing page and is not yet true. That is the most
load-bearing unbuilt promise in the product.

### 4.4 Weight is logged but unused — **partly built**

Weight can now be logged from the dashboard. It deliberately does not move
`goals.startingWeightKg`, which every target was computed from. The open question
is what *should* happen: recomputing silently is wrong, and never recomputing
makes the log decorative. My suggestion is a prompt — "your weight has moved
3 kg; update your targets?" — which keeps the decision the user's.

---

## 5. Web quality

### 5.1 `apps/web` has two test files

`env` and `i18n`. Every component, every page, every piece of the onboarding flow
is untested. The API is at 167 tests and the domain at 182; the surface the user
actually touches has almost none.

**Suggested**, in order of value: the onboarding payload builder (it maps a form
to eight different schemas), `TargetsPanel`'s null/reset handling, and
`MealRow`/`ShoppingItem`. Not snapshot tests.

### 5.2 No accessibility pass

Focus order, contrast at the brand's lighter steps, and keyboard operation of the
day picker and the new disclosures have not been checked against anything. The
components come from a library that considered it; the compositions have not been
reviewed.

### 5.3 The landing page claims features that are not built

Meal replacement, progress tracking, the biweekly check-in and the AI assistant
are all described in the present tense. They are honest about the *product* and
dishonest about *today*. Either build them or move the copy to a "coming" framing.

### 5.4 No image anywhere

Recipes have an `imageUrl` column that nothing populates. The meal detail page
carried a gradient band standing in for a photo, now replaced with the recipe's
specification. A real fix is a photo per dish, which for AI-generated recipes
means either generating images (expensive, and a picture of a dish nobody cooked
is a lie) or a stock lookup by main ingredient (cheap, imprecise, honest if
labelled). Worth a decision either way.

---

## 6. Operability

### 6.1 No request ids, no metrics, no traces

`nestjs-pino` logs, and that is the whole of the observability story. There is no
way to answer "why was this user's generation slow" after the fact.

**Suggested**: a request id propagated into every log line, and a counter per
generation outcome. Generation is the expensive path and the one that fails.

### 6.2 Rate limiting is global and uniform

120 requests a minute for everything, with one exception for generation. Sign-in
and password reset get the same allowance as reading a plan, which makes
credential stuffing a matter of patience.

**Suggested**: a much tighter limit on `/auth/*`, keyed by IP *and* by email.

### 6.3 No backups documented

Neon has its own retention, and nothing in the repository says what it is, how to
restore, or who checks. A migration like `0007` — which drops a column after
back-filling — is exactly when that matters.

### 6.4 The seed is the only source of the catalogue

200 ingredients, hand-written, with macros from BEDCA/USDA and no provenance per
row beyond a `source` string. There is no process for correcting one, and
`meals` snapshot their macros, so a correction never reaches historical plans —
which is right, but means an error is permanent in every plan built before it was
found.

---

## 7. Smaller things worth doing

- **`--breakpoint-wide` is a token that three media queries hardcode**, because
  CSS custom properties cannot be used in a media condition. If it moves, it moves
  in three files and nothing notices.
- **`HEALTH_CONSENT_VERSION` and the condition list are duplicated** between
  `core/entities/Health` and the web app, because the web cannot import a runtime
  value from a core entity module. A shared constants entry point would fix both.
- **The onboarding step deep-links are numbers** (`/onboarding/6`). Renumbering the
  flow silently sends people to the wrong step.
- **`shopping_list_items.addedManually` exists and nothing sets it.**
- **No `.gitignore` entry for the agent tooling directories** (`.serena/`,
  `.claude/.headroom_*`), which show as untracked on every `git status`.
- **`docs/ROADMAP.md` has not been updated since project 001** and no longer
  describes what is built.

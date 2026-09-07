# Architecture

> **Purpose**: how the system is designed — the module map, data flow, and invariants
> that every change must respect. This is the doc agents read before touching code.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: agents draft,
> the owner approves; updated in the same change whenever a project alters the design.

## System overview

Three tiers, with exactly one process holding secrets:

```
        Browser
           │  HTTPS, session cookie (httpOnly)
           ▼
   apps/web — Next.js 16
     UI, forms, presentation. Holds NEXT_PUBLIC_API_URL and nothing else.
           │  HTTPS
           ▼
   apps/api — NestJS 12          ← the only process with a DB connection,
     HTTP, authn/authz, DI,         an auth secret, or an AI key
     AI orchestration
           │
   packages/core                 ← framework-free domain layer
     controllers/  business rules
     repositories/ data access (Drizzle)
     entities/     Zod schemas + types
     domain/       pure logic: nutrition maths, allergy validation
           │
   packages/database             ← schemas + the Neon client
           │
     ┌─────┴──────┐
     ▼            ▼
  Neon Postgres   AI provider
```

`apps/web` imports from `packages/core` **only for types and Zod schemas** — the same
schema validates a form in the browser and a request body in the API, so a rule like
"height is 100–250 cm" is written once. It never imports `packages/database`.

### Module system

`apps/api` is **ESM** (NestJS 12 ships ESM only) and therefore needs `.js` extensions on
every relative import. `packages/core` and `packages/database` compile to **CommonJS**
`dist/` and are consumed through Node's ESM→CJS interop; their `exports` maps resolve
`types` to source (so no build is needed to typecheck) and `default` to `dist`. See
[`0002`](./decisions/0002-drizzle-on-neon.md).

### Current state

**Built and working:** the NestJS skeleton (env validation, health, logging, global
guards/filter/interceptor, Swagger, an owned rate limiter), the full 37-table schema with
migrations, a ~200-ingredient catalogue with allergen links, Better Auth, the ten-step
onboarding, the profile, computed nutrition targets, the allergy validator — and the
**plan generation engine**: the reuse-first pool builder, the scheduler, plan validation,
shopping-list aggregation, atomic persistence, the in-process job runner, the REST surface,
and the web screens for generating, browsing and reading a plan.

**Not yet exercised against a live database.** Everything above is covered by unit and
integration tests, and the end-to-end suites in `apps/api/test/` are written and
type-checked, but no run has happened against real Postgres — there is no Neon project
yet. See [`ROADMAP.md`](./ROADMAP.md) § Now.

**Designed but not built:** meal interaction (complete, skip, favourite, dislike), meal
replacement, the interactive shopping list, progress tracking, check-ins, the AI assistant,
notifications, admin. The schema already carries their tables.

## Data model

Thirty-seven tables in `packages/database/src/schemas/`, grouped by file:

| File | Tables |
| --- | --- |
| `auth.schema.ts` | `user`, `session`, `account`, `verification` — owned by Better Auth |
| `profile.schema.ts` | `profiles`, `goals`, `user_preferences`, `user_dietary_patterns`, `cuisine_preferences`, `onboarding_state` |
| `safety.schema.ts` | `allergens`, `allergies`, `intolerances` |
| `food.schema.ts` | `ingredients`, `ingredient_allergens`, `ingredient_substitutions`, `food_preferences` |
| `recipe.schema.ts` | `recipes`, `recipe_ingredients` |
| `plan.schema.ts` | `meal_plans`, `plan_days`, `meals`, `meal_completions`, `meal_feedback`, `favorite_recipes`, `disliked_recipes`, `plan_generation_jobs` |
| `shopping.schema.ts` | `shopping_lists`, `shopping_list_items` |
| `progress.schema.ts` | `progress_entries`, `check_ins` |
| `ai.schema.ts` | `ai_conversations`, `ai_messages` |
| `platform.schema.ts` | `notifications`, `notification_preferences`, `audit_logs`, `analytics_events` |

Shapes worth knowing:

- **Nutrition is per 100 g.** Every `ingredients` row normalises to it, which turns a
  recipe's totals into a sum rather than a special case. `gramsPerUnit` converts things
  people count ("2 huevos") into grams without a guess.
- **Meals snapshot their macros.** `meals` stores kcal and macros rather than recomputing
  from the recipe, so a historical plan keeps showing what the user actually ate even after
  a recipe or an ingredient is later corrected.
- **Recipes are shared, plans are owned.** An AI-generated recipe is reusable and a
  completed plan still points at it. Visibility comes from the plan, never from
  `recipes.createdBy`.
- **`may_contain` is a separate tier from `contains`.** Treating a trace warning as an
  ingredient would empty the catalogue for everyone with a gluten allergy.

## Invariants

**Only `apps/api` opens a database connection.** No RLS sits behind it, so a query without
its `userId` filter is a data leak rather than a slow query.

**Ownership is a `WHERE` clause, and `userId` always comes from the verified session.**
Every `packages/core` repository method takes `userId` as its first argument. An id from a
path parameter, query string or request body is an id the caller chose.

**Denials are 404, never 401 or 403.** A distinct status confirms to precisely the blocked
caller that the resource exists. `SessionGuard`, `AdminGuard` and `AllExceptionsFilter` all
agree, so no handler can drift into being the one that confirms.

**Authentication is deny-by-default.** `SessionGuard` is global; a route is open only with
an explicit `@Public()`. Opting *in* to protection makes a forgotten decorator an open
endpoint.

**The session is re-read on every request.** Authorisation is never cached, so a logout or
a deleted account takes effect immediately rather than at token expiry.

**A profile is complete because the API says so, not because the client hid a button.**
`RequiresOnboardingGuard` is global and opt-in per route via `@RequiresOnboarding()`; every
meal-plan route carries it. Opt-in rather than deny-by-default because most routes are how
someone *finishes* onboarding — gating them all would lock the door from the inside. The
generator still checks completeness inside the pipeline, now as a second line rather than
the only one: refusing at the door means no job row, no progress screen, and no failure the
user reads as a malfunction. This is the one refusal that is **not** a 404: it is a 409
carrying `ONBOARDING_INCOMPLETE`, because the denial rule exists to avoid confirming a
resource to someone who should not know of it, and here the caller owns the account and the
only useful answer is which step they left.

**Where onboarding resumes is resolved server-side.** `OnboardingView.resumeStep` is the
first *missing* required step, not the furthest one reached — `currentStep` is the step
after the last one saved, so re-editing an early answer used to send a returning user to a
step they had already finished. Two clients computed `min(currentStep, 9)` independently;
now `/onboarding` is itself the resume target and nothing else works it out.

**One locale decision, resolved server-side, honoured everywhere.** `profiles.locale` is
the durable preference; the `nutria_locale` cookie is a cache of it so a render needs no
round trip, and `Accept-Language` is the fallback for anyone who has not chosen. The order
lives in one function, `activeLocale()` in `apps/web/src/i18n/server.ts`, which also feeds
`<html lang>`. The switcher and the sign-in flow are the only writers, and both go through
`writeLocaleCookie` so the cookie's name, lifetime and flags have one definition. Every API
call — browser and server alike — carries the active locale in `Accept-Language`, which is
what phase 6 will read to localise the catalogue.

**A name belongs to an ingredient in a language, not to an ingredient.** `ingredient_names`
is keyed by `(ingredient_id, locale)`; `ingredients` has no `name` column and no `locale`
tag — the tag said a Spanish tomato and an English one were two ingredients, and they are
one with two names. `RecipeRepository.loadCatalogue(locale)` resolves with a fallback to
`es-ES` and reports which locale each name *actually* came from, so a gap is logged during
generation rather than passing silently as a translation. The slug never changes, which is
what keeps the macro lookup and the allergy gate language-agnostic.

**Free-text allergies are matched against every locale's names.** An English user typing
"broccoli" and a Spanish one typing "brócoli" resolve to the same ingredient. Matching only
the user's own language would mean an allergy going unenforced for want of a translation
nobody thought about.

**A recipe is locale-bound; an ingredient is not.** `recipes.locale` records the language a
dish's name and method were written in, and reuse is scoped to it. Handing "Tostada de
aguacate" to an English user is not a translation gap, it is the wrong dish — and reuse
would otherwise quietly undo the rest of this.

**One prompt, in English, for every user.** English steers these models better and a prompt
per language is a set of bugs per language. The output language is a parameter
(`language: 'British English'` rather than a BCP 47 tag, which models follow far more
reliably), and the ingredient names in the catalogue listing are already in the user's
language, so dish names come back using words they know.

**A missing translation is a build error, not a blank space.** `en-GB.ts` is typed as the
Spanish dictionary's shape, so a key added to one and forgotten in the other fails
`ts:check`. Values are plain strings with `{name}` placeholders filled by `interpolate` —
functions would not survive the server/client boundary, and building a key out of user data
would put a lookup at the mercy of what someone typed. A test asserts both dictionaries keep
the same placeholders in every string, because a dropped `{count}` reads perfectly and
silently loses a number.

**Numbers, dates and quantities go through `Intl` with the active locale.** They used to be
hardcoded `es-ES` in two components plus a `.replace('.', ',')` in `formatQuantity`. A
figure formatted for the wrong locale is not a translation bug anyone reports; it is one
that makes the reader quietly distrust the number.

**Allergies are enforced by code, never by prompting a model.**
`findSafetyViolations` in `packages/core/domain/Safety` compares allergen **ids**, so
nothing depends on spelling or on an instruction being obeyed. Load the profile through
`SafetyController.getSafetyProfile(userId)` — it is a named method so the call site is
greppable, and a path that never calls it is a path with no allergy check. Anything that
produces or displays food validates before storing **and** before returning.

**A free-text allergy is enforced or it is declared unenforceable — never quietly
neither.** `custom_allergens` stores what the user typed and the catalogue ingredient it
resolved to, if any. Resolution is `matchCustomAllergen` in `packages/core/domain/Safety`:
normalised exact comparison plus a curated synonym list, and *nothing else* — no stemming,
no substring, no edit distance, and no word naming a group (`marisco`, `frutos secos`),
because resolving one of those to a single member excludes that member and leaves the rest
on the plate under an interface saying the allergy is enforced. An entry that resolves
enters `SafetyProfile.excludedIngredientIds` and is blocked inside `findSafetyViolations`
— the same function, the same loop, one more axis, no second gate. An entry that does not
resolve goes to `unenforceableLabels`, which the gate cannot read and does not: it is
named to the model as forbidden, it is shown to the user per entry as best-effort, and the
deterministic half of its protection is the standing rejection of any dish whose
ingredients do not all resolve. The interface never aggregates the two — "your allergies
are covered" would be true of one half and a lie about the other, and the reader cannot
tell which half they are in.

**Health data is collected as health data, or not at all.** Conditions, medications and
supplements live in their own tables under an explicit, versioned consent
(`HEALTH_CONSENT_VERSION`); withdrawing deletes the rows and the consent in one
transaction. They are fetched only by the screen that shows them — `/profile` — and are
deliberately absent from `FullProfileView`, which the dashboard also loads. A medication
has no business travelling to a screen that does not display it.

**Almost nothing reasons about any of it, and what does is signed off.** A condition may
produce a dietary exclusion only through `CONDITION_EXCLUSIONS` in
`packages/core/domain/Health` — one entry, coeliac disease → gluten, admitted because
avoiding the substance *is* the definition of managing the condition rather than one
therapeutic strategy among several ([`0008`](./decisions/0008-condition-exclusions.md)).
`CONDITION_SUGGESTIONS` holds what we could apply and deliberately do not: lactose
intolerance is offered, because most people tolerate some lactose and how strict to be is
theirs to decide. Both maps are pinned by test. An unmapped condition and a free-text one
produce exactly nothing. An automatic exclusion is always shown with its cause, because a
restriction the user did not ask for and cannot see the reason for is one they cannot
argue with. A medication
produces nothing under any circumstances — there is no dose column, because a field whose
only possible use is one we have ruled out should not exist. Supplements contribute a
protein figure that is *displayed* beside the targets and never subtracted from the target
a plan is built against. What every recorded item does produce is one thing: a persistent,
non-dismissable recommendation to have the plan reviewed by a professional. That is the
honest limit of what a meal planner can say, and `docs/decisions/0004` fixes it there —
no dosing, no interaction checking, no condition-specific advice.

**`SafetyController.getSafetyProfile` is the only place a `SafetyProfile` is assembled.**
Four sources merge into one set — declared allergies, declared intolerances, free-text
allergies that resolved, and the allergens a signed-off condition implies — so a new kind
of restriction reaches every path at once instead of the ones somebody remembered.
`RecipeController.generationContext` used to build its own, which meant "what may this
user eat" had two implementations that happened to agree until free-text allergies arrived
and only one of them knew.

**The boundary is mechanical, not a convention.** `apps/api/src/modules/ai` is asserted by
test to import nothing from the Health controller, entities or repository, and the pino
redaction list carries the three health fields. The failure worth catching is the import
that makes a medication reachable from a prompt, not the prompt that finally contains one.

**Nutrition tolerances are asymmetric where the nutrition is, and measured in the units
the rule actually means.** Energy is held to ±10% in both directions — a calorie goal is
missed by overshooting as surely as by undershooting. Protein has a floor at −15% of
target, because that is what the goal depends on; its ceiling is **3 g per kg of body
weight**, not a percentage, because plausibility is a function of body mass rather than of
a target that itself shifts between 1.6 and 1.9 g/kg by goal. A percentage ceiling was
stricter for someone maintaining than for someone bulking, which is backwards.

**Nutrition targets are computed, not generated.** `nutritionTargets` in
`packages/core/domain/Nutrition` derives kcal and macros from Mifflin-St Jeor and the
user's goal, and clamps to `MINIMUM_DAILY_KCAL` and to a share of maintenance. It returns
a **derivation** — equation, BMR, activity factor, goal, pace, the bounds, what was asked
for before clamping, and which bound moved it — because a figure with no visible basis
reads as a fact. 4,099 kcal for a weight-loss goal survived a review and a live onboarding
pass for exactly that reason.

**A target is checked at the moment it is computed, not when a plan fails.**
`targetViolations` is the single judgement of whether a target set describes one
achievable day: inside the calorie and protein bounds, fat above its floor, and macros
that add up to the calorie figure. `nutritionTargets` runs it against its own output and
throws `TargetsUnreachableError` if it fails — an assertion on our arithmetic, not a
rejection of user input. Protein is capped at a share of energy *before* carbohydrate
takes the remainder, which is what keeps that assertion satisfiable: carbohydrate used to
be `max(remaining, 0)`, so an over-budget protein figure disappeared into a clamp and the
macros silently stopped describing the same day as the kcal.

**A user may correct their targets, inside the same bounds the calculator obeys.**
`target_overrides` holds kcal and the three macros, each nullable, and a null means "use
the computed value" — the computed figure is deliberately not copied in, so a later
correction to the equations still reaches everyone. `resolveTargets` merges the override
over the computed set, re-derives anything the user did not name so the set stays
coherent, and judges the result with the *same* `targetViolations`. There is no version of
this product where a hand-typed number may go where a computed one may not.

A stored override is re-checked against the current bounds on **every read**, not only
when written: someone can set a target and then change their weight. An override that no
longer fits is marked `stale` and set aside rather than applied or deleted — deleting
loses a deliberate choice, applying honours a number we no longer stand behind.

**Targets are resolved once, in `ProfileController.getFullProfile`.** Generation reads
`targets.effective` from that same call. It used to compute its own, which meant the
number a plan was built against and the number the profile screen showed came from two
call sites that only happened to agree — and an override would have reached one of them.

**Plans are append-only.** A finished plan is never rewritten; the next one is a new row
linked by `previousPlanId`. A partial unique index enforces at most one `active` plan per
user, so a double submit cannot produce two.

**Every route body has a Zod schema**, applied through `ZodValidationPipe`. An unvalidated
body reaches the service as whatever was sent, and unknown keys are stripped rather than
forwarded to a repository.

**Nothing internal reaches a response.** `AllExceptionsFilter` is the single translation
point; an unrecognised error becomes a bare 500. Driver messages carry connection strings,
Zod issues describe the schema, stacks carry paths.

**Responses default to `no-store`.** Absent an explicit directive, RFC 9111 lets a shared
cache apply heuristic freshness to an authenticated body — here, someone's health data.

**Account deletion actually deletes.** Every user-scoped table references `user.id` with
`ON DELETE CASCADE`. That cascade is the privacy control, not a convenience.

## Key decisions

- [`0001`](./decisions/0001-nestjs-as-the-backend.md) — NestJS is the backend; Next.js is a client.
- [`0002`](./decisions/0002-drizzle-on-neon.md) — Drizzle on Neon; Supabase and its RLS layer removed.
- [`0003`](./decisions/0003-better-auth.md) — Better Auth owns identity.
- [`0004`](./decisions/0004-deterministic-safety-layer.md) — The AI never decides anything that can hurt someone.
- [`0005`](./decisions/0005-generate-a-pool-schedule-in-code.md) — Generation asks for a pool of dishes; the fortnight is scheduled in code.
- [`0006`](./decisions/0006-reuse-before-generating.md) — Reuse existing recipes before generating; the AI provider is swappable.
- [`0007`](./decisions/0007-own-the-rate-limiter.md) — Rate limiting is ours, because no released throttler supports NestJS 12.

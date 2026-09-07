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

**Allergies are enforced by code, never by prompting a model.**
`findSafetyViolations` in `packages/core/domain/Safety` compares allergen **ids**, so
nothing depends on spelling or on an instruction being obeyed. Load the profile through
`SafetyController.getSafetyProfile(userId)` — it is a named method so the call site is
greppable, and a path that never calls it is a path with no allergy check. Anything that
produces or displays food validates before storing **and** before returning.

**Nutrition tolerances are asymmetric where the nutrition is, and measured in the units
the rule actually means.** Energy is held to ±10% in both directions — a calorie goal is
missed by overshooting as surely as by undershooting. Protein has a floor at −15% of
target, because that is what the goal depends on; its ceiling is **3 g per kg of body
weight**, not a percentage, because plausibility is a function of body mass rather than of
a target that itself shifts between 1.6 and 1.9 g/kg by goal. A percentage ceiling was
stricter for someone maintaining than for someone bulking, which is backwards.

**Nutrition targets are computed, not generated.** `nutritionTargets` in
`packages/core/domain/Nutrition` derives kcal and macros from Mifflin-St Jeor and the
user's goal, and clamps to `MINIMUM_DAILY_KCAL`. The clamp is reported back
(`wasClamped`) so the user is told their pace was reduced rather than silently overridden.

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

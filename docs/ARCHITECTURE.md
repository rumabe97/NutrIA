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

### API module shape

Every module in `apps/api/src/modules` has the same parts, and creates only the ones it
has ([`0039`](./decisions/0039-a-route-names-what-it-takes-and-what-it-answers.md)):

```
<name>.module.ts   wiring, and nothing else
controllers/       HTTP: routing, guards, validation, status codes
services/          orchestration — the only caller of packages/core in this app
dto/in/            one declared input per route body, naming a core Zod schema
dto/out/           one declared answer per route
index.ts           the module's public surface
```

A controller takes `@CurrentUser()`, binds the body with `@ZodBody(SomeDto)`, calls one
method on its own service and returns. Business rules stay in `packages/core`: if the
logic needs NestJS or an I/O provider it is a service here, and if it does not it is a
core controller.

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
- **An ingredient's meals and season are exception lists.** `ingredients.meal_slots` and
  `ingredients.season_months` are empty for every meal and every month, like `countries`;
  the seed fills them from `seed/ingredients/meals.ts` and `seasons.ts`, which name only
  the exceptions. `['none']` is a food in no meal at all. `core/domain/MealFit` is the one
  reader: a dish is served only at the meals all its ingredients belong to (`0062`, `0063`).

## Invariants

**Only `apps/api` opens a database connection.** No RLS sits behind it, so a query without
its `userId` filter is a data leak rather than a slow query.

**Ownership is a `WHERE` clause, and `userId` always comes from the verified session.**
Every `packages/core` repository method takes `userId` as its first argument. An id from a
path parameter, query string or request body is an id the caller chose.

**Denials are 404, never 401 or 403.** A distinct status confirms to precisely the blocked
caller that the resource exists. `SessionGuard`, `AdminGuard` and `AllExceptionsFilter` all
agree, so no handler can drift into being the one that confirms.

**There is exactly one delegated path into another account's data.** A professional
reaches a client only through a consented, audited link (`0059`): `CareController.withClient`
resolves a link id — never a client id — against the session's professional and the link's
`active` status, writes the audit row the client can read, and only then hands the
client's id to the controller that already exists. `CareRepository.roster` is the one
other reader, for the professional's client list, and keeps the same promise: it writes a
trail row for every client before it reads their stage, in one transaction. A professional
route that reaches a repository any other way is not a variant of the ownership rule
above — it is a hole in it, and `invariant-reviewer` treats it as a P0.

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

**A password found breached must be changed before anything else** (011 phase 2, `0074`).
After a successful sign-in, Better Auth's `hooks.after` checks the password against HIBP in
the background and, on a hit, sets `user.password_compromised_at`. `PasswordChangeGuard` is
global and deny-by-default while that mark is set. It answers 409
`PASSWORD_CHANGE_REQUIRED` on every non-public route except GET/DELETE `/users/me` and
GET `/auth/me`, and Better Auth's own `/auth/*` routes, change-password and sign-out
among them, stay reachable. It runs after `VerifiedEmailGuard`, so an unconfirmed or
unopened account hears that first, and before `RequiresOnboardingGuard`. A change or a reset
clears the mark, and a password change always ends every other session, whatever the body
asks. Like `ONBOARDING_INCOMPLETE`, it is a 409 rather than a 404 because the caller owns
the account and must be told what to do.

**An account with a password can add a second factor** (011 phase 3, `0074`). It is Better
Auth's `twoFactor` plugin: TOTP plus 10 backup codes, and a trusted device for 30 days.
There is no email code. With the factor on, `/sign-in/email` answers
`{ twoFactorRedirect: true }` and no usable session, and the web finishes the sign-in at
`/acceder/codigo`.

Our hooks add the rules the plugin lacks:
- enabling is refused for an account without a password;
- `/get-totp-uri` and the email-code routes answer the guard's 404, so the secret leaves
  only in `/enable`'s answer to its owner;
- a new implicit provider link into an account with the factor on is refused unless that
  account's own session asks (a Google account linked beforehand still signs in without
  the code, per `0074`);
- trusted devices are forgotten on disable, password change, reset and
  revoke-(other-)sessions;
- turning it on closes every other session of the account (011 phase 6);
- turning it on, off, using a backup code and regenerating codes are each audited and
  mailed.

The plugin's provisional session is not counted as a `session_started`.

**A passkey is a passwordless door as strong as a second factor** (011 phase 5, `0083`,
amending `0074`). It is Better Auth's `passkey` plugin, bound to the web origin's host.
Every registration and every sign-in must verify the person (WebAuthn UV): the options ask
for it, and our `afterVerification` hooks refuse an answer without it. So a passkey sign-in
opens a session with no second step, **even for an account with TOTP on**, and that is on
purpose. The guards after sign-in still apply to it as to any session (`EMAIL_NOT_VERIFIED`,
`ACCOUNT_NOT_ACTIVATED`, `PASSWORD_CHANGE_REQUIRED`).

Our hooks add the rules the plugin lacks:
- adding one needs a confirmed address and the password confirmed, as a single-use grant
  for that session that the verify spends atomically, or a session ten minutes young for
  an account with no password;
- another account's passkey is the guard's 404 on delete and rename;
- any password change, from Seguridad or by a reset, removes every passkey of the account
  in the same transaction (and again on its own if that fails);
- a passkey sign-in cancels a pending removal of the second factor;
- adding and removing one are audited, and adding one is mailed;
- no WebAuthn challenge reaches a log line.

**A professional or the admin with a password must have TOTP on** (011 phase 6, `0074`,
`0083`). The rule lives once, in `core/domain/SecondFactor` (`secondFactorMissing`): an
account with a `credential` account and `twoFactorEnabled` off lacks it. An account with
only Google or Apple passes.
- `ProfessionalGuard` closes every client route, and `AdminGuard` every `@Roles` route,
  with the same 404 as any denial. The workspace's page and its agreement stay open, and
  the page says what to do (`secondFactorRequired`). The console's web gate reads the same
  rule from `/users/me`.
- The flag rides every session's user row and is re-read on every request. Turning it off
  from Seguridad, or the owner's 48-hour removal, shuts the doors on the next request,
  for sessions that already existed too.
- Turning it on closes the account's other sessions, in one `DELETE`, so a session
  opened earlier with the password alone does not pass the rule afterwards. Two
  residuals remain. If that delete fails twice, the old sessions pass until the person
  closes them; the mail and the confirmation then say so. And a passkey such a session
  registered before the factor went on survives the close, and its sign-in passes once
  TOTP is on. The "enabled" mail and confirmation ask the person to check their passkeys.
- A passkey does not stand in for TOTP on an account with a password: it guards its own
  sign-in, not the password door beside it. With TOTP on, a passkey sign-in passes with
  no code.

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

**Each meal sees its own foods.** A pool request is one meal (`0016`), and its catalogue
is only what belongs to that meal for this person (`0062`) — stewed pulses are a lunch,
oats and jam are not a dinner. Lunch and dinner, where nearly everything belongs, are cut
again to what the library cooks there, the produce in season and a 30-row sample drawn per
generation (`0063`). In-season produce is listed first and marked as preferred, never
required. The standard lunch prompt is about half of what it was on 3.4.0 (~4,100 tokens
instead of ~8,000); `apps/api/scripts/catalogue-by-meal.mjs` measures it.

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

**A way of eating is enforced in code, and the model learns only what it may.** A
dietary pattern becomes exclusions in `core/domain/Preference` (`resolvePreferences`).
Halal and kosher work by food class and slug runs, and gluten-free and lactose-free by
allergen. Traditional Spanish (`0077`) works by 157 exact slugs plus a dish rule
(`breaksPatternDish`: a foreign stated cuisine or a foreign dish name). The dish rule lives
inside `RecipeController.usesExcluded`, so reuse, swaps and the event rebuild inherit it,
and the pool builder rejects a generated dish that breaks it as `unwanted`. The model is
named only vegetarian and vegan (`NAMEABLE_PATTERNS`), because that is what the accepted
consent says it receives. For every other pattern it simply sees a catalogue with fewer
rows, and a spec pins the prompt identical with and without traditional Spanish. A
pattern's lean towards foods (legumes, fish, rice and huerta vegetables for traditional
Spanish) orders the library pick, and is kept out of the prompt's list of liked foods.

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
the rule actually means.** Energy, carbohydrate and fat are each held to ±5% in both
directions — a goal is missed by overshooting as surely as by undershooting. Protein has a
floor at −5% of target, because that is what the goal depends on; its ceiling is **3 g per
kg of body weight**, not a percentage, because plausibility is a function of body mass
rather than of a target that itself shifts between 1.6 and 1.9 g/kg by goal. A percentage
ceiling was stricter for someone maintaining than for someone bulking, which is backwards.
The four bands are guidance — a day outside one is recorded on the plan and delivered —
while the calorie floor and the protein ceiling are bounds and block. Carbohydrate and fat
had no band at all until `0045`, and the scheduler fitted neither; a real plan missed
carbohydrate by 46% on every day and passed. The scheduler now fits all four, and 5% is
what it reaches on a real library.

**Protein is computed on a reference weight, and every plate stays near its share of the
day** (`0076`). For weight loss, healthy eating and maintenance, the goal's g/kg applies
to the lower of actual weight and the weight at BMI 25 for the person's height, never
below the 0.8 g/kg floor on actual weight. Training goals keep actual weight, and energy and
the protein bounds stay on it. Each plate's energy is held within 0.5–1.5× its slot's share
of that day (`PLATE_LIMIT`), as a bound rather than the preference `SHARE_BAND` (0.7–1.4)
is. A day that cannot meet its macros inside it is delivered out of band with its advisory.
Only the energy floor outranks the limit, and only as far as the floor needs. The limit is
relative to the person's own share, so `0070`'s big eaters still get their 2–4 servings. A
real meal plan without it met a 180 g protein target with 1,700-kcal lunches beside
250-kcal dinners.

**A plate also has a weight ceiling, and cooked grains read dry** (`0078`). No plate weighs
more than `PLATE_GRAMS_MAX`: 750 g at breakfast, lunch and dinner, and 250 g at the snacks
and supper. It is enforced through the same `withinPlateLimit` as the energy limit, and the
energy floor is again the only thing that may pass it. The 15 cooked grains and pastas of
the catalogue (`core/domain/Yield`) are shown on the meal in dry weight. The meal's own
grams stay cooked, because the macros are computed from them. The shopping list buys them
dry, merged with the same food bought dry; cooked legumes stay cooked. *Temporarily* (`016`
phase 1, until accompaniments land), the main-meal ceiling scales above 950 kcal of share
by share ÷ 950, up to 900 g, because a flat 750 g cost two-meal people their macro fit.
Before generating, a person whose largest main meal carries more than 850 kcal
(`mealSize`, from the scheduler's own shares) is told why their plates are large and
chooses to add a meal or carry on.

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

**A plan awaiting a professional's review waits in its own state.** For a client linked
with review on, a new plan lands `pending_review` (`0060`) instead of replacing the
`active` one, so the fortnight the client is living stays exactly as visible and usable as
it was. `PlanRepository.findActive` and everything built on it — the dashboard, the
offline copy — need no change: the state simply sits outside what they read. The reads
that reach a plan without going through `findActive` are named once, here, so a new one
does not silently leak a pending plan: the check-in status, the plan history, a plan
fetched by id, the shopping list and a meal's own status all exclude `pending_review` for
the client by default, inside `PlanRepository`, not per route. Publishing is one
transaction — complete the old `active` plan, set this one `active` — so the client never
sees both or neither.

**A plan whose day has not come waits as `scheduled`** (project 015). A generation takes a
start from today to today + 7. A plan that starts after today is saved `scheduled`, and
the running plan stays `active` and untouched. A second partial unique index allows at most
one `scheduled` plan per user; generating again replaces it, and that counts as a redo. On
its start date the scheduled plan becomes `active` and the old one `completed`, done by a
daily cron at 23:05 UTC and again on every read of the active plan, so a missed cron
strands nobody. A start on or before the running plan's end cuts that plan short and
counts as a redo; a start after it is the next fortnight and is free.

**Every route body has a Zod schema**, applied through `ZodValidationPipe`. An unvalidated
body reaches the service as whatever was sent, and unknown keys are stripped rather than
forwarded to a repository. The schema is named by a DTO in the module's `dto/in`, bound
with `@ZodBody`, which applies the pipe *and* generates the OpenAPI request schema from
that same Zod schema — so the published contract cannot drift from the enforced one
([`0039`](./decisions/0039-a-route-names-what-it-takes-and-what-it-answers.md)). There is
no second definition of a validation rule in `apps/api`.

**Nothing internal reaches a response.** `AllExceptionsFilter` is the single translation
point; an unrecognised error becomes a bare 500. Driver messages carry connection strings,
Zod issues describe the schema, stacks carry paths.

**Responses default to `no-store`.** Absent an explicit directive, RFC 9111 lets a shared
cache apply heuristic freshness to an authenticated body — here, someone's health data. The
one copy kept on purpose is the offline worker's: today's screen and the shopping list, on
the device, for as long as the session lasts, never an API response
([`0053`](./decisions/0053-the-shopping-list-survives-the-supermarket.md)).

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

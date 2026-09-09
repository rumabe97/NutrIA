# apps/api — end-to-end tests

These specs boot the real Nest application against a **real database**, so they are not
part of `pnpm test`. Run them deliberately.

## What they cover

| Spec | What it proves |
| --- | --- |
| `isolation.e2e-spec.ts` | User A cannot read or write User B's data, by any route. |
| `access.e2e-spec.ts` | Both locks are required, each denial names which one is missing, a caller with no session gets 404 everywhere, and deleting an account takes its data and its credentials with it. |
| `admin.e2e-spec.ts` | The admin routes do not exist for an ordinary account, answer the owner, carry no content column, and open a waiting account. |
| `vacations.e2e-spec.ts` | A trip moves the days after it by exactly its length, leaves the days before it alone, holds no plan day while it lasts, and gives the days back when cancelled. |
| `swaps.e2e-spec.ts` | A replacement is a different dish in the same slot, the shopping list is rebuilt with it, and the fifth swap is the last — the sixth is 429. |
| `plan-lifecycle.e2e-spec.ts` | Meals remember being eaten or skipped, one plan is active at a time, a replaced plan stays readable, the fortnight redo is spent once, and a weight logged twice in a day is a correction. |
| `preferences.e2e-spec.ts` | A disliked ingredient and a dietary pattern are enforced in code — the model is told to serve fish on purpose and none reaches the plan — while a preference nothing can match is kept and shown as unenforceable. |
| `generation.e2e-spec.ts` | The core loop: onboarding → a 14-day plan → a shopping list that reconciles with it, with history preserved and one active plan. |
| `allergy-safety.e2e-spec.ts` | A declared allergen never reaches a stored meal or a shopping list — **even when the model deliberately proposes one**. |
| `custom-allergens.e2e-spec.ts` | A free-text allergy that matched the catalogue is enforced exactly as a listed one; one that did not is stored, surfaced as unenforceable, and named to the model. |
| `health-data.e2e-spec.ts` | A recorded medication or condition never appears in a prompt, and withdrawal deletes the data and the consent together. |
| `target-overrides.e2e-spec.ts` | A corrected target is refused outside its bounds, and *is the figure the stored plan was built against* when accepted. |
| `localisation.e2e-spec.ts` | An English account gets an English prompt, an English shopping list, and no Spanish recipe from the shared library. |

## Running them

```bash
# Point at a THROWAWAY database — these specs create and delete accounts.
export DATABASE_URL='postgresql://…-pooler…'     # pooled endpoint
export DIRECT_DATABASE_URL='postgresql://…'      # direct endpoint, for DDL
export BETTER_AUTH_SECRET="$(openssl rand -base64 48)"
export APP_URL=http://localhost:3000
export BETTER_AUTH_URL=http://localhost:3001

pnpm --filter database migrate   # apply the schema
pnpm --filter database seed      # allergens + ingredients — NOT optional, see below
pnpm --filter api test:e2e
```

**Never point these at a database holding real user data.** Every suite registers accounts
and deletes them again in `afterAll`.

Set `AI_PROVIDER=stub` and leave `SMTP_HOST` empty for the run: the suites never call a
provider (below) and must never send a mail, and the environment contract refuses a half
mail configuration anyway. `NODE_ENV=test` keeps the development-only rules.

### In CI

`.github/workflows/ci.yml` runs these suites on every push and pull request against a
`postgres:17` service container that is destroyed with the job — no secret, no shared
branch, nothing to reset. It migrates, seeds and runs, exactly as below. That is also the
answer to "what if I break the harness": the failure arrives on the commit that caused it.

### A throwaway database without Docker

This machine has neither Docker nor a local Postgres, and Neon's free tier allows one
branch per project besides the default. A second **database on the dev branch** is the
throwaway: `create database nutria_e2e;` once, from the SQL editor or any client connected
to the dev branch's direct endpoint, then point both URLs above at it by replacing
`/neondb` with `/nutria_e2e` in the dev branch's connection strings. Migrations and the
seed run against it like any other database (the seed takes about ten minutes from here);
dropping it afterwards is `drop database nutria_e2e;`.

### Accounts have two locks

An account is usable when its address is confirmed **and** the owner has opened it
(`0030`, `0031`): a fresh sign-up answers 409 `EMAIL_NOT_VERIFIED`, then 409
`ACCOUNT_NOT_ACTIVATED`, on every route past sign-in. `harness.ts` → `activate()` opens
both, the way the owner and the person each do. A suite that registers on its own must
call it too, or its first `PATCH /profile` fails with the product working exactly as
designed — which is what `access.e2e-spec.ts` exists to prove on purpose.

## Why the seed is required

`generation.e2e-spec.ts` and `allergy-safety.e2e-spec.ts` script dishes from ingredient
slugs the seed guarantees (`harness.ts` → `SEEDED`). Without the catalogue those slugs do
not resolve, every candidate dish is rejected, and generation fails with
`GENERATION_POOL_TOO_SMALL` — a correct outcome that looks like a broken test.

The allergy suite additionally reads the `gluten` allergen's id from
`GET /safety/allergens`, so an unseeded `allergens` table fails it at setup.

`localisation.e2e-spec.ts` needs the seed's **`en-GB` names** specifically — it asserts a
shopping list reads "Cooked white rice" rather than "Arroz blanco cocido". Applying
migration `0007` without re-running the seed leaves every ingredient with only its Spanish
name, which is a legitimate runtime state (the resolver falls back and logs the gap) and a
failing test.

## What a first real run changed

The suites were written and type-checked but had never been executed. Running them
against a real catalogue found four things, all of them fixed rather than
accommodated:

1. **A free-text allergy excluded one row, not the food.** A tomato allergy
   resolved to `tomate` and left `tomate-frito`, `zumo-de-tomate` and seven more
   on the model's list. `madeOf` in `core/domain/Safety` now excludes every row
   whose slug carries the anchor as whole tokens (0004, amended).
2. **The stand-in model returned the same dishes on every call.** A slot needs
   seven distinct dishes for a fortnight, and a redo needs dishes it has not
   served; a real model writes new ones each time. `ScriptedAiClient` now numbers
   variants, so each call yields fresh names and fresh slugs for the same
   ingredients — which is what the suites are about.
3. **Two fixtures collided with the catalogue.** "Proteína de suero" is both the
   suite's supplement and a real ingredient, so "never appears in a prompt" could
   not pass. The supplement is now something the catalogue does not sell.
4. **Hooks timed out at jest's 5 s default** against a remote database. The
   config sets `testTimeout` once for every suite; the suites are not about
   latency.

The shopping-list reconciliation allows drift proportional to how many meals an
ingredient appears in (±0.05 g per rounded figure), not a flat gram: an
ingredient in every breakfast accumulates more rounding than one in a single
dish, and the flat bound failed on oats.

## The scripted model

No suite calls a real AI provider. `harness.ts` overrides the `AiClient` DI token with
`ScriptedAiClient`, which returns exactly the dishes a test dictates.

That is not only about cost. A real provider is non-deterministic, so "the allergy gate
held" would mean "it held this once". Scripting the model lets `allergy-safety.e2e-spec.ts`
do the thing that actually matters: propose bread and oats to someone with a declared
gluten allergy, **as a model ignoring its instructions would**, and assert that nothing
unsafe survives to the database or a response.

## Timing

Generation runs in-process and takes a few seconds against a local database; the suites
allow generous timeouts because a remote Neon instance is slower. `generateAndWait` polls
the job endpoint exactly as the web client does.

# apps/api — end-to-end tests

These specs boot the real Nest application against a **real database**, so they are not
part of `pnpm test`. Run them deliberately.

## What they cover

| Spec | What it proves |
| --- | --- |
| `isolation.e2e-spec.ts` | User A cannot read or write User B's data, by any route. |
| `generation.e2e-spec.ts` | The core loop: onboarding → a 14-day plan → a shopping list that reconciles with it, with history preserved and one active plan. |
| `allergy-safety.e2e-spec.ts` | A declared allergen never reaches a stored meal or a shopping list — **even when the model deliberately proposes one**. |

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

## Why the seed is required

`generation.e2e-spec.ts` and `allergy-safety.e2e-spec.ts` script dishes from ingredient
slugs the seed guarantees (`harness.ts` → `SEEDED`). Without the catalogue those slugs do
not resolve, every candidate dish is rejected, and generation fails with
`GENERATION_POOL_TOO_SMALL` — a correct outcome that looks like a broken test.

The allergy suite additionally reads the `gluten` allergen's id from
`GET /safety/allergens`, so an unseeded `allergens` table fails it at setup.

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

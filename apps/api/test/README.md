# apps/api — end-to-end tests

These specs boot the real Nest application against a **real database**, so they are not
part of `pnpm test`. Run them deliberately.

## What they cover

| Spec | What it proves |
| --- | --- |
| `isolation.e2e-spec.ts` | User A cannot read or write User B's data, by any route. |
| `access.e2e-spec.ts` | Both locks are required, each denial names which one is missing, a caller with no session gets 404 everywhere, and deleting an account takes its data and its credentials with it. |
| `admin.e2e-spec.ts` | The admin routes do not exist for an ordinary account, answer the owner, carry no content column, and open a waiting account. |
| `professionals.e2e-spec.ts` | An account becomes a professional only by the owner's act, with a collegiate number (`0059`): a sign-up body, the account update and a profile body carrying the words change nothing, the owner's list names no client, the switch fails off, and taking the grant back takes access with it. Its own `GET /users/me` carries `professional`: false for an ordinary account, false for a grant while the switch is off, true once both hold, false on the very next request once either is taken away — and forging it (the account update field by field, every `profile` PATCH route, the owner's own grant route) opens no route the professional side of care or `/admin` owns and leaves no row in `professionals`. |
| `care.e2e-spec.ts` | The link between a professional and a client (`0059`): an invitation answers the same status and body for a registered and an unregistered address, lives as a row only while it is live — accepting or declining deletes it, the same address invited again replaces it (the old token a 404 by every route), the next one written deletes its professional's expired ones — expires (the clock moved through `CareController`), dies with its sender's grant, and only the invited account with a **confirmed** address can read or answer it, anybody else one 404; declining makes nothing; the accepted consent version and health line are stored, read back from `care_links`; a second link is a 409 naming the first, to the addressee alone, whoever sent the second invitation, and two acceptances at once make one link; either side ends it, nobody else can, and anything that is not a link is the same 404; the switch hides every invitation route and the professional's side before any body is read, while the client still sees and ends their link; deleting the client removes its link rows and every invitation to its address, deleting the professional removes theirs and leaves the client's account as it was; the owner's list names no client. **And the professional's side (Phase 3):** the list shows each open link by name with where the client is (onboarding, awaiting a plan, plan under way, check-in due; a paused link with no stage, an ended one absent) and the unanswered invitations, with no client's id or address; every read leaves rows in the client's trail, counted on `care_access_log` and read back through the client's paged `GET /care/access-log` — one `list` row per active link per list, exactly one `overview` row per page read, a `health` row after it only under the health line, and **no `health` key** without it (a `health` read on such a link refused in core too); every refusal writes nothing; the client ending the link mid-session makes the professional's **very next** request a 404; another professional cannot list, read or infer a client by link id, by guessing or through the invitation route; a revoked grant or the switch off is the door's own 404; the trail pages every row exactly once, rows a microsecond apart included; deleting the professional keeps the client's rows with the name and no id, deleting the client takes them. **And supervised targets (Phase 4):** the professional sets a client's targets through the link with the client's own body and bounds, and the answer, the client's `GET /profile` and the professional's page all name the setter (`setBy`) by name and never by id; an out-of-bounds figure is refused with **the same 422 body** as the client's own route, a body the schema refuses is a 422 from the pipe, and neither stores anything or writes a trail row; another professional's link, a paused or ended one, an unknown id and a non-id are one 404 that writes nothing on either table, and a non-professional, no session or the switch off are the door's 404; each accepted write is exactly one `targets`/`write` row; the client changing them afterwards makes them `self` on both sides, the professional sending every field null clears them to computed, and a professional who deletes their account leaves the figures standing as the client's own. |
| `care-review.e2e-spec.ts` | Review before publishing (`0060`, project 004 Phase 5): a linked client's new plan, with review on by default, waits in `pending_review` — the plan they live stays active and usable (its list, a swap) and nothing completes it — and the client sees none of it by any read: `/meal-plans/active`, the shopping list, history, a fetch by id, a day, a meal, a swap or a mark of one of its meals, the check-in status, and a job answer with `pendingReview` and no plan id to go to, until publishing gives it one. The professional reads it, swaps its meals (never one of the plan being lived), regenerates it (the old one deleted: one waiting plan per client; a redo past the client's fortnight allowance — three, since a linked client of an open practice is premium — is a 429 that writes nothing) and generates a first one for a client with none — **and a declared gluten allergy holds when the model proposes bread and oats to it** — and publishing makes it active and the old one completed in one step; the list shows the stage `plan_awaiting_review` while it waits. With review off, or a paused link, generation is today's. Another professional — through the client's link or their own — an ended or paused link, an unknown id, the client, no session and the switch off are one 404 that writes nothing; every answered call is exactly one `review` row in the client's trail, a refused one none. **And a fortnight the professional starts (Phase 9 step 0):** once the client's active plan's fortnight has ended, the professional may generate the next one — review on waits for them, review off is active at once and the ended plan completes, exactly as a first generation would; a fortnight still running is still the 404, writing nothing and spending no allowance; the client and the professional asking at once make one plan and one charge, the loser the same 409 `CONFLICT` either side gets today. |
| `vacations.e2e-spec.ts` | A trip moves the days after it by exactly its length, leaves the days before it alone, holds no plan day while it lasts, and gives the days back when cancelled. |
| `events.e2e-spec.ts` | A day that eats for something (`0043`): the days before it carry its name and their own targets, every other day carries the plan's, the two refusals, a stranger's 404 — and the free tier's cap (`0044`): an event into the fortnight under way changes nothing, the fourth is a 429, one the week after next is counted against that week. |
| `events-premium.e2e-spec.ts` | The paid half of `0044`: the loaded days after today are rebuilt from the library with no model call and the answer says which, every other day is exactly as it was, the meal rows keep their ids, the shopping list still reconciles, only the mid-plan allowance is spent, today is never touched, the fourth mid-plan event is accepted and rebuilds nothing, removing the event leaves the days as they are, and a declared allergen never reaches a rebuilt day. |
| `swaps.e2e-spec.ts` | A replacement is a different dish in the same slot, the shopping list is rebuilt with it, and the fifth swap is the last — the sixth is 429. |
| `plan-lifecycle.e2e-spec.ts` | Meals remember being eaten or skipped, one plan is active at a time, a replaced plan stays readable, the fortnight redo is spent once — and a refused redo leaves no claim behind — and a weight logged twice in a day is a correction. |
| `fortnight.e2e-spec.ts` | The rest of what a person does with a plan: ticking the shopping list, a verdict on a dish, the check-in that closes the cycle and refuses a second, the reminder switch, and a restriction changed outside onboarding. |
| `preferences.e2e-spec.ts` | A disliked ingredient and a dietary pattern are enforced in code — the model is told to serve fish on purpose and none reaches the plan — while a preference nothing can match is kept and shown as unenforceable. |
| `generation.e2e-spec.ts` | The core loop: onboarding → a 14-day plan → a shopping list that reconciles with it, with history preserved and one active plan — and three simultaneous starts claiming **one** generation between them, not three. |
| `allergy-safety.e2e-spec.ts` | A declared allergen never reaches a stored meal or a shopping list — **even when the model deliberately proposes one**. |
| `custom-allergens.e2e-spec.ts` | A free-text allergy that matched the catalogue is enforced exactly as a listed one; one that did not is stored, surfaced as unenforceable, and named to the model. |
| `health-data.e2e-spec.ts` | A recorded medication or condition never appears in a prompt, and withdrawal deletes the data and the consent together. |
| `target-overrides.e2e-spec.ts` | A corrected target is refused outside its bounds, and *is the figure the stored plan was built against* when accepted. The tour's mark is remembered across requests and can be undone. |
| `social-sign-in.e2e-spec.ts` | Arriving through a provider (`0058`), with Google's token exchange answered by the test: the public list of providers, the address somebody is sent to, an account born confirmed opening itself or waiting for the owner, the same person the second time, a confirmed password account joined — and **an unconfirmed one never joined**, left exactly as it was. |
| `billing.e2e-spec.ts` | Paying for premium (`0056`), on the product's own assembly (`CreateApp`: the webhook's raw body, its 256 kB limit) with Stripe's client replaced by a fake the test answers — throwing included — and bodies signed with Stripe's real test signer: with no keys nothing is for sale; test keys show billing to the owner alone and live keys to everybody once the `premium` switch is on; checkout buys the monthly price unless a yearly one is set, for the account asking whatever the body says, marked with this deployment and payable for 31 minutes, with the trial once per account and never a second checkout for somebody paying; two checkouts at once make one customer, and one for an account deleted on its way is a 404 that makes none; the portal opens on the account's own customer only; no session is a 404. The webhook reads nothing unsigned, signed with another secret, tampered, replayed or oversized; grants premium to the customer's account whatever the metadata names; applies each event as Stripe's re-fetch says, not as its body does, over every status; ignores other events; converges on duplicates, late and simultaneous deliveries onto one row; answers 5xx and writes nothing when Stripe is down; the switch off keeps a paid column on free allowances; a cancelled subscription stays cancelled whatever a later answer claims, an older subscription's end never replaces the one paid for now, the one the row names ending hands the row to another that still pays, and one that does not pay yet never takes it; a metadata hint naming no account, or a deleted one, is acknowledged and writes nothing — and a live subscription this deployment opened for it is cancelled, one nothing marks is not, cancelling one already cancelled is not an error, and another deployment's subscription is never written or cancelled, whether its customer is unknown here or known; a subscription of a customer other than the account's keeps the row as it was; a slow re-fetch cannot overwrite a newer one; an oversized body is a 413. Deleting the account expires its open checkouts, then cancels its live Stripe subscriptions (not the ended ones) before taking its row and the invitations to its address; it is refused and keeps everything while Stripe cannot cancel, and asks Stripe nothing where billing is not set up. |
| `care-practice.e2e-spec.ts` | The practice is paid for (`0061`, project 004 Phase 7), on the product's own assembly with Stripe's client faked and every webhook signed and verified for real: checkout sells a granted professional a practice at a configured price with a 14-day trial, once per account, refuses an unlisted price and the premium price, is a 404 for anyone else, drops a practice price sent with a premium plan (premium is bought), and nothing in the body sets the number of clients; the signed webhook alone opens the practice with the configured number (trial included), the larger price raises it and the smaller lowers it, **an unlisted price or none on the subscription is premium, as before practices existed**, and opens nothing; a practice whose subscription ends while a premium one still pays closes and leaves the account premium; with no open practice the client routes and invitations are the door's 404 and write no trail, while `GET /care/practice` still shows the way to pay; active links and unexpired invitations count against the number, the next invitation is a 409 `PRACTICE_FULL` with the ways up and queues no mail, two at once into the last seat make one, a paused link takes no seat, an acceptance racing an invitation never takes the practice past its number, and **the 31st on a 30 is refused until the larger price**; a linked client of an open practice is premium behind the switch and free when it is off, the practice lapses or the link ends; a lapse pauses every active link and nothing else and deletes nothing, paying again (new subscription or the same) reactivates only the paused ones, and a delivery sent twice or a late one for the ended subscription changes nothing; an invitation accepted while the practice is lapsed makes a **paused** link, free for the client, active once paying again; ending a link, by either side and even after a lapse, clears the professional's mark on the targets with the numbers unchanged, a pause keeps it, another professional's mark is never touched; the refused configurations are read from `validateEnv`. |
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

`--forceExit` is in the script on purpose. The suites close their Nest app and their
database pool (`setup-e2e.ts`), and something below them — the platform's own handles —
still holds the loop open afterwards. Without it the run finishes its tests and then sits
there until a CI job timeout kills it, which GitHub reports as "cancelled" and which reads
like somebody pressed a button rather than like a run that passed.

**Never point these at a database holding real user data.** Every suite registers accounts
and deletes them again in `afterAll`.

### On this machine, against a local Postgres

The command the tests agent runs, with the environment emptied of everything that reaches
out — mail, Sentry, web push, the OAuth providers — and the database a throwaway Postgres 17
listening on `127.0.0.1:54329`, migrated and seeded as above. Jest reads no `.env`, so what
the command does not set is not set. Never a URL from a `.env`:
those are real Neon databases.

```bash
node .claude/skills/local-probe/scripts/guard.mjs          # refuses the production database
cd apps/api
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/nutria_e2e \
DIRECT_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/nutria_e2e \
BETTER_AUTH_SECRET="$(openssl rand -base64 48)" APP_URL=http://localhost:3000 BETTER_AUTH_URL=http://localhost:3001 \
NODE_ENV=test AI_PROVIDER=stub SENTRY_DSN= VAPID_PUBLIC_KEY= VAPID_PRIVATE_KEY= VAPID_SUBJECT= \
SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS= EMAIL_FROM= OWNER_EMAIL= \
GOOGLE_OAUTH_CLIENT_ID= GOOGLE_OAUTH_CLIENT_SECRET= APPLE_OAUTH_CLIENT_ID= APPLE_OAUTH_TEAM_ID= \
APPLE_OAUTH_KEY_ID= APPLE_OAUTH_PRIVATE_KEY= STRIPE_SECRET_KEY= STRIPE_PRICE_ID= STRIPE_YEARLY_PRICE_ID= STRIPE_WEBHOOK_SECRET= STRIPE_PRACTICE_PRICES= \
  NODE_OPTIONS=--experimental-vm-modules pnpm exec jest --config ./test/jest-e2e.json --runInBand --forceExit [suite-name]
```

Set `AI_PROVIDER=stub` and leave `SMTP_HOST` empty for the run: the suites never call a
provider (below) and must never send a mail, and the environment contract refuses a half
mail configuration anyway. `NODE_ENV=test` keeps the development-only rules.

### In CI

`.github/workflows/ci.yml` runs these suites on every pull request against a `postgres:17`
service container that is destroyed with the job — no secret, no shared branch, nothing to
reset. It migrates, seeds and runs, exactly as below; the seed takes five seconds against a
container and the suites about twenty minutes on a shared runner. That is also the answer
to "what if I break the harness": the failure arrives on the pull request that caused it,
before it can reach `main`.

### A throwaway database without Docker

This machine has neither Docker nor a local Postgres, and Neon's free tier allows one
branch per project besides the default. A second **database on the dev branch** is the
throwaway: `create database nutria_e2e;` once, from the SQL editor or any client connected
to the dev branch's direct endpoint, then point both URLs above at it by replacing
`/neondb` with `/nutria_e2e` in the dev branch's connection strings. Migrations and the
seed run against it like any other database (the seed takes about ten minutes from here);
dropping it afterwards is `drop database nutria_e2e;`.

### Every suite deletes what it makes

The database outlives the run on this machine, so a suite that leaves an account behind
collides with the next run against the same one. Every suite tracks the cookie of each
account it registers — in a `made: string[]` the harness's `deleteAccounts(app, made)`
walks in `afterAll`, through the product's own `DELETE /users/me` — so an account is still
deleted when a test earlier in the file throws: `made` is pushed to at registration, not
gathered at the end. `care.e2e-spec.ts` and `billing.e2e-spec.ts` do the same thing with
their own `made` arrays, one per deployment for billing, because they were written first;
a new suite should reach for `harness.ts` → `deleteAccounts` instead of copying either.

An account whose cookie a suite never kept — signed up but never signed in, such as an
owner-activation flow — is deleted through `harness.ts` → `deleteAccountByEmail`, which
signs in with the password every suite registers with and then deletes through the same
route. A flag or setting a suite throws (`professional`, `premium`, `automaticActivation`)
is still its own to restore in `afterAll`, deleting accounts does not undo that.

`jest-e2e.json` → `globalTeardown` (`global-teardown.ts`) is the backstop once the whole
run has finished: every suite registers under a `.invalid` address (`e2e.invalid`,
`example.invalid`), a domain reserved by RFC 2606 so it can never be a real mailbox, and
the teardown fails the run with the count and the addresses if any such account is still
in `user` — whether a suite's own cleanup has a gap or a test crashed before reaching
`afterAll` at all. The seed never writes to `user`, so nothing it loads is ever named.

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

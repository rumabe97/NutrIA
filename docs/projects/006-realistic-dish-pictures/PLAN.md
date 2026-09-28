# Plan — Project 006: Realistic dish pictures, true to the recipe

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.

- **Status**: approved — by the owner, 2026-09-27
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md). Every acceptance criterion is mapped at the end of this file.
- **Routing profile**: `tiered`. Deviations:
  - Phase 2 decides which pictures may be shown to a person with allergies. That is AI
    output validation and allergy safety, so it runs at `quality-max` (opus @ high), as
    `AGENTS.md` § Model routing requires.
  - Phase 3 wires that gate into the path that stores pictures, so it runs at opus @ high
    too.

## Design summary

Recorded in [`0066`](../../decisions/0066-photograph-like-dish-pictures-drawn-on-first-view.md),
which supersedes `0010`.

- **Model and client.** One image model, Gemini 3.1 Flash Lite Image. A new OpenRouter
  image client in `apps/api/src/modules/ai/clients/` pins the provider block (`only:
  ['google-vertex/global']`, `allow_fallbacks: false`, `data_collection: 'deny'`, `zdr:
  true`) the way `openRouterRequest` already does for text. It uses its own key
  (`OPENROUTER_IMAGE_API_KEY`), is redacted through `redactSecrets`, and returns the
  decoded bytes of `data[0].b64_json` untouched.
- **Judge.** A vision judge (`qwen/qwen3-vl-235b-a22b-instruct`, pinned to DeepInfra with
  the same no-training block) makes two calls:
  1. a blind "which foods do you see" call on the picture;
  2. a text-only match against the recipe.

  **The rejection rule is pure code** in `packages/core/src/domain/DishPicture/`. It maps
  each named, specific, non-trace extra food to catalogue ingredients with the existing
  matcher (`domain/Safety/CustomAllergen.ts`: `normaliseForMatching`, `SYNONYMS`,
  `toMatchIndex`). It then takes their allergens from `ingredient_allergens`, and rejects
  when one of them is carried by none of the dish's ingredients. A generic name ("sauce",
  "dressing", "drizzle") maps to nothing.
- **Generation state lives in Postgres; the picture lives in Vercel Blob.**
  - `recipe_images` gains `url`, `status` (`drawing | ready | failed`), `attempts`,
    `lastAttemptAt` and `provenance` (jsonb: whether the C2PA manifest was found, the
    judge's notes). `bytes` becomes nullable and stops being written.
  - A new `recipe_image_calls` table records each paid call (recipe, kind: `image |
    judge`, cost in USD, outcome, time). The month's spend is its sum.
  - The Blob path is `dish-pictures/<recipeId>/<promptVersion>-<random>.jpg`, in a store
    in fra1, with no user id anywhere.
- **When a picture is drawn.**
  1. The meal detail read (`PlanController` → `MealDetailView`) asks the core for the
     dish's picture state.
  2. With the flag on, no `ready` row, not `drawing`, not `failed` within the cool-off,
     and budget left, it claims the row (`INSERT … ON CONFLICT DO UPDATE … WHERE`, a
     single statement) and schedules the drawing with `BackgroundTaskService`
     (`waitUntil`). It answers at once with `pictureStatus: 'drawing'`.
  3. The drawing makes up to 3 attempts. Each attempt is an image call, a C2PA check, the
     judge and, only if accepted, an upload.
  4. Then the row becomes `ready` with its URL, or `failed`. A `failed` dish is tried
     again after 7 days.
- **Web.** The meal page shows the placeholder while the status is `drawing` and polls a
  small status endpoint until the picture is ready. Every picture carries an "IA" corner
  mark with an accessible name, and the caption and alt use `legal`'s strings. The file is
  served as stored and cropped only by CSS. `next/image` optimisation is never used.
- **Removed.** The post-plan drawing in `PlanJobRunner`, `/cron/illustrate`, the
  `AI_ILLUSTRATIONS` Google path (`resolveImageModel`), `ProviderImageClient`, and the
  `GET /recipes/:id/image` route with its year-long cache. They go once nothing reads
  them.
- **Flag.** A database flag `dishPictures` in `packages/core/src/domain/Flag/Flag.ts`,
  fallback off. The owner turns it on at `/admin`.

## Phases

### Phase 1 — Picture state and spend in the database

- [x] done — PR #127
- **Dispatch**: opus @ medium — `/execute-project 006 phase 1`. Review: `migration-reviewer`
  (opus @ high, its floor).
- **Goal**: the database can hold a dish's picture as a URL plus its generation state, and
  every paid call with its cost. Nothing writes bytes any more.
- **Scope**:
  - `packages/database/src/schemas/recipe.schema.ts`;
  - a new drizzle-kit migration under `packages/database/src/migrations/`;
  - `packages/core/src/repositories/Recipe/RecipeRepository.ts`;
  - a new `packages/core/src/entities/DishPicture/` (types);
  - their tests.
- **Steps**:
  1. Change `recipe_images`: make `bytes`, `contentType`, `width`, `height`, `model` and
     `promptVersion` nullable (a claimed row exists before anything is drawn).
     Add `url text`, `status text not null default 'ready'` (the check constraint allows
     `drawing | ready | failed`), `attempts smallint not null default 0`,
     `last_attempt_at timestamptz` and `provenance jsonb`. `recipeId` stays the primary
     key.
  2. Add a data step in the migration, marked `-- reviewed-destructive:`: delete the
     `recipe_images` rows that have `bytes`. They are `0010` illustrations, never shown in
     production with the flag off, and in development they are 3 rows of unknown origin.
  3. Create table `recipe_image_calls`: `id uuid pk`, `recipe_id uuid` (nullable, FK to
     `recipes`, `on delete set null`, indexed, so deleting a recipe never removes billed
     spend from the cap), `kind text` (check `image | judge`), `model text`, `cost_usd numeric(10,6)
     not null`, `outcome text`, `created_at timestamptz default now()`, and an index on
     `created_at`.
  4. Add repository methods:
     - `pictureState(recipeId)`;
     - `claimPicture(recipeId, now, coolOffDays, staleAfterMinutes = 15)`: a single
       statement that returns whether this caller won the claim. It wins:
       - a missing row;
       - a `failed` row past the cool-off;
       - a `drawing` row older than `staleAfterMinutes` (a drawing killed at
         `maxDuration`);
     - `recordPictureCall(...)`;
     - `monthSpendUsd(monthStart)`;
     - `completePicture(recipeId, claimedAt, {url, model, promptVersion, provenance,
       attempts})`;
     - `failPicture(recipeId, claimedAt, {attempts, provenance}, now)`.

     Both match `status = 'drawing'` and the claim's `last_attempt_at`, so a drawer whose
     claim was taken over cannot overwrite the row. `saveImage` becomes a no-op until
     phase 3 deletes it.
     Remove `saveImage`, `findImage` and `findWithoutImage` once phase 3 no longer calls
     them. In this phase they only stop being written to.
  5. `PlanRepository`'s `hasImage` and `AdminRepository`'s count read `status = 'ready'`.
- **Acceptance criteria**:
  - The migration is backward-compatible with the API still running during the deploy:
    the old code only reads rows, and there are none left with bytes.
  - `claimPicture` lets exactly one of two concurrent callers win (test).
  - PRD 2, in part: no code path writes `bytes`.
- **Verification**:
  - `pnpm --filter database generate` reports no schema changes.
  - `node scripts/check-migrations.mjs`.
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api`.
  - `sh .claude/skills/ship/scripts/gate.sh`.

### Phase 2 — The image client, the prompt and the allergen judge

- [x] done — PR #128
- **Dispatch**: opus @ high — `/execute-project 006 phase 2`. `quality-max`: AI output
  validation and allergy safety. Review: `invariant-reviewer`.
- **Goal**: code that turns a recipe into an accepted or rejected picture, with every call
  pinned to an endpoint that keeps nothing. It is not wired to any route yet.
- **Scope**:
  - `apps/api/src/modules/ai/clients/` (new `OpenRouterImageClient`,
    `OpenRouterVisionJudgeClient`);
  - `apps/api/src/modules/ai/ai.config.ts`;
  - `apps/api/src/config/Env.validation.ts`;
  - `apps/api/.env.example`;
  - `packages/core/src/domain/DishPicture/` (prompt builder, C2PA presence check, the
    rejection rule);
  - their tests.
- **Steps**:
  1. Add environment variables, all optional unless the flag's code path needs them:
     - `OPENROUTER_IMAGE_API_KEY`, required in production when any picture is to be drawn;
     - `AI_IMAGE_MODEL`, default `google/gemini-3.1-flash-lite-image`;
     - `AI_IMAGE_PROVIDER_ONLY`, default `google-vertex/global`;
     - `AI_JUDGE_MODEL`, default `qwen/qwen3-vl-235b-a22b-instruct`;
     - `AI_JUDGE_PROVIDER_ONLY`, default `deepinfra`;
     - `AI_IMAGE_MONTHLY_CAP_USD`, default `10`;
     - `BLOB_READ_WRITE_TOKEN`.

     Validate them as the text keys are validated (`openRouterModelIssue`, base URL
     pinned to openrouter.ai) and add them to `AI_SECRETS`.
  2. The image client: `POST /api/v1/images` with the frozen provider block (`only`,
     `allow_fallbacks: false`, `data_collection: 'deny'`, `zdr: true`), `aspect_ratio:
     '4:3'` and `resolution: '1K'`.
     - Read the cost from the response usage, or from `/api/v1/generation`.
     - Return `{bytes, contentType, costUsd, provider}` with the bytes untouched: no
       `sharp`.
     - Redact errors with `redactSecrets`.
  3. The judge client makes two calls with the same provider pinning:
     - (a) the picture plus "list every food you can see; for each, whether you can name
       it specifically and whether it is a trace";
     - (b) text only: match that list against the recipe's ingredients, counting a sauce
       that the listed ingredients could make as a match.

     Both calls return structured output.
  4. `domain/DishPicture/prompt.ts` (`PICTURE_PROMPT_VERSION = '2.0.0'`) builds prompt v1
     as the PRD describes it:
     - the dish name;
     - the only foods, from most to least by weight, with share wording;
     - the cooking liquid, as part of the dish;
     - "shown as cooked in this dish, not as separate raw items";
     - seasonings, oil, stock, vinegar, wine and sugar are never named as visible;
     - nothing else on the plate or table;
     - one plate, centred, with generous table around it, at 45°, on a plain wooden or
       linen table;
     - natural window light, sharp focus across the whole dish, no bokeh, no blur;
     - real food, not a render, not glossy or plastic;
     - no text, people or hands.

     It takes recipe data only: no user, profile or allergy input in its signature.
  5. `domain/DishPicture/judge.ts`, the rejection rule. From the judge's matched output
     and the ingredient catalogue (slugs, `ingredient_names`, `ingredient_allergens`),
     compute the extra foods that are specific, not traces, and not generic. Map them to
     ingredients with the `CustomAllergen` matcher and collect their allergens. Reject
     when an allergen belongs to none of the dish's ingredients. Return
     `{accepted, extras, notes}`.
  6. `domain/DishPicture/provenance.ts` detects the C2PA JUMBF manifest in JPEG bytes (the
     APP11 box, label `c2pa`) and the IPTC `trainedAlgorithmicMedia` XMP.
  7. Write the tests:
     - A request that could leave without its provider block is impossible: a test builds
       every request and asserts the block.
     - The prompt has no field from outside the recipe (a test on the builder's input
       type), and `health-boundary.spec.ts` still passes.
     - The rule, with fixtures taken from the pilot's failure shapes:
       - an allergen-bearing extra food, specific and not a trace → rejected;
       - "white drizzle" / "sauce" (generic) → accepted;
       - couscous named but reported allergen-free by the judge → rejected when the dish
         has no gluten, because the allergen comes from the catalogue;
       - a sauce made from listed ingredients → accepted.
     - The provenance check passes on a small committed JPEG fixture carrying a C2PA box
       and fails on a re-encoded copy.
- **As built** (amended after the phase; see LOG):
  - The name → catalogue mapping has three steps:
    1. the exact `CustomAllergen` matcher;
    2. a table of English synonyms;
    3. word-level matching once descriptors are dropped.
    The exact matcher alone caught none of the pilot's wrong-recipe controls.
  - Every matched name is re-checked against the catalogue as well, except a name that is
    the matched ingredient's own name cut short.
  - A name that maps to the catalogue counts as specific, whatever the judge's flag says.
  - `may_contain` is its own tier.
  - Ambiguous foods found as extras map conservatively: noodles → wheat, cake and biscuit
    → gluten, egg and milk, oats → gluten.
  - `judgePicture` refuses a catalogue no bigger than the recipe. Its input must be the
    whole catalogue, including `mayContain`.
- **Acceptance criteria**: PRD 3, 4 and 6 (logic).
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api`.
  - `NODE_OPTIONS=--experimental-vm-modules pnpm --filter api exec jest src/modules/ai/health-boundary.spec.ts`.
  - `sh .claude/skills/ship/scripts/gate.sh`.

### Phase 3 — Drawing on first view, storing in Blob, the monthly cap

- [x] done — PR #129
- **Dispatch**: opus @ high — `/execute-project 006 phase 3`. It wires the phase 2 gate into
  what gets stored and shown. Reviews: `invariant-reviewer`, and `tests` for the
  end-to-end suite.
- **Goal**: opening a meal page starts, at most once, a background drawing whose accepted
  result is stored in Blob and served to everyone. Spend stops at the cap. The old drawing
  paths are gone.
- **Scope**:
  - `apps/api/src/modules/recipes/` (status endpoint, removal of the image route and the
    cron);
  - `apps/api/src/modules/ai/services/` (a new `DishPictureService` replaces
    `RecipeIllustrator`);
  - `apps/api/src/modules/meal-plans/` (`MealDetailView` gains `pictureStatus`,
    `PlanJobRunner` loses the illustration call);
  - `packages/core/src/controllers/Recipe/RecipeController.ts` and
    `packages/core/src/controllers/Plan/PlanController.ts`;
  - `packages/core/src/domain/Flag/Flag.ts`;
  - `apps/api/package.json` (`@vercel/blob`);
  - `apps/api/vercel.json`;
  - `apps/api/AGENTS.md`;
  - `docs/reference/deployment.md`;
  - tests under `apps/api/test/`.
- **Steps**:
  1. Add flag `dishPictures` (fallback off, audience everyone) to `FLAGS`.
  2. `PlanController`'s meal detail:
     - If the flag is on and `pictureState` is not `ready`, call
       `RecipeController.requestPicture(recipeId)`.
     - That call checks the flag, the cool-off (7 days after `failed`) and
       `monthSpendUsd < cap`, then `claimPicture`.
     - On a win it schedules `DishPictureService.draw(recipeId)` through
       `BackgroundTaskService`.
     - `MealDetailView` returns `illustrationPath` (the Blob URL) when the picture is
       ready, and `pictureStatus: 'none' | 'drawing' | 'ready'`.
     - `MealView` (the dashboard card) only reads, never requests a drawing.
     - `judgePicture` gets the whole ingredient catalogue from the repository, with
       `mayContain` filled from `ingredient_allergens` where presence is `may_contain`.
       A `PictureCallError`, including a judge failure, is never caught into
       "store the picture".
     - A missing `OPENROUTER_IMAGE_API_KEY` with the flag on means no drawing.
     - A key refusal (HTTP 402 or 429, "Key limit exceeded") stops the attempts like a
       quota error.
     - An unknown cost is recorded at 0.0337 $, never at 0.
     - Add the phase 2 environment rows to `docs/reference/deployment.md`.
     - `hasImage` (both uses in `PlanRepository`) and the `/admin` count switch from
       `bytes is not null` to `status = 'ready' and url is not null`.
  3. `DishPictureService.draw` makes up to 3 attempts, and on every attempt:
     1. check the budget first (stop if the cap is reached);
     2. make the image call and record it in `recipe_image_calls`;
     3. check provenance;
     4. run the judge (record both of its calls);
     5. apply the rule.

     If accepted: `put()` to Blob (`access: 'public'`, `contentType: 'image/jpeg'`, path
     as in the design summary, the bytes untouched), then `completePicture`. After 3
     rejections or failures: `failPicture`.
     - A quota error (`isQuotaExhausted`) ends the attempt loop without counting as a
       rejection.
     - The service respects the function's `maxDuration`.
  4. Add `GET /recipes/:id/picture-status`, the same authentication as the meal detail and
     no-store. It returns `{status, url}` for the web's polling.
  5. Remove:
     - the post-plan illustration in `PlanJobRunner`;
     - `CronController.illustrate` and its test;
     - `RecipeIllustrator`, `ProviderImageClient`, `resolveImageModel`,
       `AI_ILLUSTRATIONS`;
     - `GET /recipes/:id/image`;
     - `saveImage`, `findImage`, `findWithoutImage`.

     Update `apps/api/AGENTS.md` (the illustrations section) and
     `docs/reference/deployment.md` to match.
  6. Add an `/admin` read: the month's spend, and pictures ready, failed and drawing,
     through `AdminRepository`.
  7. `tests` agent end-to-end suite, with `AI_PROVIDER=stub` and stub image and judge
     clients plus a stub Blob. It runs `judgePicture` on the real catalogue the repository
     loads, and covers:
     - one allergen-bearing extra → the picture is rejected and not stored;
     - two concurrent detail reads start one drawing;
     - a ready picture is returned to a second user;
     - a rejected picture is never stored;
     - at the cap no image call is made;
     - with the flag off nothing is claimed.
- **Acceptance criteria**: PRD 1, 2, 5, 6 (wiring), 7 and 9.
- **Verification**:
  - `pnpm turbo lint ts:check test`.
  - `pnpm --filter api test:e2e` (run by the `tests` agent).
  - `sh .claude/skills/ship/scripts/gate.sh --full`.

### Phase 4 — The meal page waits for its picture; every picture says it is AI

- [x] done — PR #130
- **Dispatch**: opus @ medium — `/execute-project 006 phase 4`. Reviews: `accessibility`, and
  `legal` for the strings.
- **Goal**: the meal page shows the placeholder, then the picture without a reload. Every
  picture carries the "IA" mark and `legal`'s caption and alt.
- **Scope**:
  - `apps/web/src/components/DishPicture/`;
  - `packages/ui/src/components/Picture/` (only if the mark belongs in the frame);
  - `apps/web/src/app/(app)/plan/comida/[id]/`;
  - `apps/web/src/components/NextMeal/`;
  - `apps/web/src/app/(app)/admin/` (the spend read);
  - the `es-ES` and `en-GB` dictionaries;
  - `apps/web/src/app/api` proxies, if the status call needs one.
- **Steps**:
  1. Add the strings from [`docs/legal/imagenes-de-platos.md`](../../legal/imagenes-de-platos.md)
     § 3:
     - `meal.pictureCaption` replaces `meal.illustration`;
     - `meal.pictureOf` replaces `meal.illustrationOf`;
     - `picture.aiMark`: "IA" / "AI";
     - `picture.aiMarkLabel`.
  2. In `DishPicture`, an "IA" corner mark on both variants:
     - visible without interaction;
     - 4.5:1 contrast on any photograph (solid backing);
     - reaches assistive technology even when the image is decorative (the card);
     - absent on the placeholder.
  3. The file is rendered as served. Nothing may introduce `next/image` optimisation or
     re-encoding (a unit test or lint note on `DishPicture`). The card and hero crops
     stay CSS `object-fit`.
  4. Add a client island on the meal page: while `pictureStatus` is `drawing`, poll
     `/recipes/:id/picture-status` every 4 s for up to 60 s, then swap the placeholder for
     the picture with no layout shift.
     - It respects reduced motion.
     - It stops on leave and offline.
     - It gives no screen-reader announcement for a failure.
  5. Add the `/admin` line: this month's picture spend against the cap, and ready, failed
     and drawing counts.
  6. Run `/local-probe` at 320/390/1280 px, in light and dark, covering drawing → ready,
     failed, ready, and the card with its mark.
- **Acceptance criteria**: PRD 1 (the page does not wait) and 8.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=web --filter=ui`.
  - The `/local-probe` screenshots.
  - `sh .claude/skills/ship/scripts/gate.sh --full`.

### Phase 5 — Published texts

- [x] done — PR #131
- **Dispatch**: sonnet @ medium — `/execute-project 006 phase 5` — owner-approves: the
  privacy-policy and terms wording before it is published.
- **Goal**: the live `/privacidad` and `/condiciones` say what the pictures do before the
  flag goes on.
- **Scope**:
  - merge the `legal` branch `agent/dish-pictures-legal/legal` (docs/legal only);
  - the `es-ES`/`en-GB` dictionary blocks of `/privacidad` and `/condiciones`, as
    [`docs/legal/imagenes-de-platos.md`](../../legal/imagenes-de-platos.md) § 4 and
    `docs/legal/textos/02` and `03` specify. That covers:
    - the sentence about Google scoped to plan design;
    - the pictures paragraph naming Google Vertex;
    - the Vercel line covering pictures;
    - the terms sentence "the picture is illustrative; the ingredient list governs".
- **Steps**:
  1. Merge the legal branch.
  2. Apply the dictionary changes.
  3. Bump the policy's version constant only if `legal` says the change needs renewed
     acceptance (its note says it does not).
  4. Run `pnpm check:leaks`.
- **Acceptance criteria**: PRD 8, the published part.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=web`.
  - `sh .claude/skills/ship/scripts/gate.sh`.
  - `owner-approves`: the rendered `/privacidad` and `/condiciones`.

### Phase 6 — Go-live

- [ ] in progress — live since 2026-09-28; waiting on the first week's spend review and the C2PA check on a served file
- **Dispatch**: opus @ medium — `/execute-project 006 phase 6`.
  - `owner-gated`: create the Blob store, set the environment variables, read Google
    Cloud's generative-AI terms, switch the flag on.
  - `human-verify`: real dishes on the iPhone.
  - `owner-approves`: the first week's spend.
- **Goal**: the flag is on in production and the owner has seen it work.
- **Steps**, for the owner, handed over as exact instructions:
  1. In Vercel, create a Blob store in **fra1**. The region cannot be changed later.
     Connect it to the API project, which adds `BLOB_READ_WRITE_TOKEN`.
  2. In OpenRouter, create a key for pictures, and give it a 10 $ monthly limit. The limit
     is required, not optional: the code's cap gates each image call, but not the judge
     calls after it or drawings running at the same time. Set it as
     `OPENROUTER_IMAGE_API_KEY` on the API project. Confirm the account's allowed
     providers include Google Vertex and DeepInfra. Revoke the pilot key.
  3. Read Google Cloud's generative-AI terms (legal item IMG-9).
  4. Once phases 1–5 are deployed and the migration has run, switch `dishPictures` on at
     `/admin`.
  5. Calibration watch-list from the phase 2 review, left open on purpose:
     - bare "noodles" matched on a rice-noodle dish;
     - "nuts" beside a tiger-nut milk (horchata) dish;
     - a "free-from" pair such as "gluten-free pasta" plus "pasta".
     Check the first week's rejections and notes for them.
  6. Open three or four dishes on the iPhone. Validate the C2PA signature once on one file
     exactly as Vercel Blob serves it in production, with `c2patool` or the Content
     Credentials verifier (legal, P3). Record "confirmed by human on <date>" in
     LOG.md.
  7. After a week, read the spend line on `/admin`.
- **Acceptance criteria**: PRD 10.
- **Verification**: `wait-for-deploy.sh`, the owner's checks above, and the LOG entry.

## Hand-off

- Only the API talks to model providers. Every image and judge request carries the frozen
  no-training provider block, with no fallbacks.
- Nothing from a person (profile, allergies, health data) goes into a prompt or a Blob
  path. The prompt builder takes recipe data only.
- The picture file is never re-encoded, resized or stripped. Crops are done in CSS. A
  change that touches the file breaks Google's C2PA marking.
- `AI_PROVIDER=stub` and stub image, judge and Blob clients in every test and every local
  run. No paid call runs outside phase 6 without the owner's yes.
- Work in worktrees (`.claude/skills/team/scripts/worktree.sh`). Only the `tests` agent
  runs the end-to-end suite.
- **Rollback floor.** Once phase 3 has written its first row without bytes, the API from
  before project 006 must not be redeployed. Its `hasImage` matches any row and its image
  route throws on a null `Content-Type`. The oldest safe target is phase 1's code.
- **The claim.** `claimPicture` runs as a single autocommit statement at READ COMMITTED,
  never inside a REPEATABLE READ or SERIALIZABLE transaction: there the loser gets a
  serialization error instead of `false`. The drawer keeps the exact `Date` it claimed
  with, and passes it to `completePicture` or `failPicture`.
- **Attempts.** The drawing starts its count from the row's `attempts`, which a stale
  takeover has already incremented, and fails the dish at 3.

## Out of scope

- Drawing the existing library in advance, pictures in plan rows, and pictures in the
  professional workspace, care plans or meal swaps (PRD § Out).
- A second image model. If Gemini's quality or availability changes, that is a new
  decision superseding `0066`.
- Dropping the now-unused `bytes`, `content_type`, `width` and `height` columns. That is a
  later migration once no running code reads them.

## PRD acceptance criteria → phases

| PRD | Phase |
| --- | --- |
| 1 First view starts at most one drawing; page not slower | 3, 4 |
| 2 Served from Blob; no bytes in Postgres | 1, 3 |
| 3 Pinned no-training providers, proved by a test | 2 |
| 4 No personal data in the prompt | 2 |
| 5 Retry, give up after 3, cool-off | 3 |
| 6 Allergen check, calibrated | 2, 3 |
| 7 Monthly cap | 3 |
| 8 AI label on every picture | 4, 5 |
| 9 Flag off = today's behaviour | 3 |
| 10 Owner's iPhone check and spend review | 6 |

# 0004 — The console, second round: quality, spend, auditing, retention and alerts

> **Purpose**: the `architect` agent's answer to the owner's request of 2026-09-29, after
> closing project 007 (the admin console): add nine things to the console — catalogue quality,
> plan quality, a monthly cap on text AI spend, a log of admin actions, the nightly step sweep,
> retention cohorts, alerts to the owner, notification statistics and consents — "and whatever
> else the architect comes up with". It says, point by point, whether it can be done, what it
> really costs, what it breaks, where `0028`'s privacy line is, what has to start being
> recorded now, and in what order to do it as project 008.
> **Audience**: the owner and the agents. **Committed**: yes. **Maintained by**: the
> `architect` agent; once merged it is not edited — a later review is a new report.
>
> Base: `main` at `dcf10bc` (#154). Every number carries its label: **measured** (where),
> **estimated** (with the hypothesis) or **unknown**. The measurements are read-only aggregates
> over the development database (Nutria-E2E), in a `READ ONLY` transaction, with `local-probe`'s
> guard checking first that it was not production. **Production has not been read.** While
> writing this report **no model call was made, nothing was spent and nothing was written to any
> database.**

---

## 1. Verdict

**Yes, on conditions.** Seven of the nine points can be done without spending a euro and without
breaking `0028`. One can only be half done: consents to the legal texts cannot be counted because
nobody records them. The other, the spend cap, should be shown and should warn, but should not
stop generation, unless the owner decides so knowing what he loses. Two conditions order
everything:

1. **What has to start being recorded comes first.** Six of the points need data that is not
   stored today. Their value starts the day the writing is deployed, not the day the page is
   drawn. A small "start recording" phase opens the project.
2. **"Activity" does not measure activity today.** `session_started` is written when somebody
   *signs in* (`apps/api/src/modules/auth/auth.config.ts:103`). A session lasts 30 days and is
   renewed on every day of use (`auth.config.ts:33-34`, `:194`). Somebody who opens the app every
   day without signing in again leaves no trace. This already affects what 007 delivered: the
   "Active people" card on Overview
   (`packages/core/src/repositories/Admin/AdminSeriesRepository.ts:75-97`) and the "Last
   activity" column on Accounts (`packages/core/src/repositories/User/UserRepository.ts:60`)
   count sign-ins, not use. The signal has to be fixed before any cohort is built.

### Point by point

| # | Point | Verdict | Effort | What has to start being recorded | Useful from |
| --- | --- | --- | --- | --- | --- |
| 1 | Catalogue quality | **Yes, with changes**: only what is born at run time (model recipes, failed photos). The ingredients are already checked in CI | S–M | Nothing | Day one |
| 2 | Plan quality | **Yes, with changes**: a summary of counts in `generation_metadata`, only aggregated by period, never on a Log row | M | `quality` per plan, when it is generated | ~2–4 weeks later (it depends on volume, **unknown** in production) |
| 3 | Monthly text AI cap | **Yes, with changes**: a gauge + an alert + stopping the sweep. Stopping generation is the **owner's decision** | S (M if generation is stopped) | The `feature` label on `ai_call` | Day one; the per-feature split, from the deploy |
| 4 | Log of admin actions | **Yes**, in `audit_logs` (it already exists and is empty), with a small migration | S–M | One row per action, in the same transaction as the action | From the deploy; nothing earlier is recoverable |
| 5 | Nightly step sweep | **Yes**: the state comes from `steps_version`; what it does each night needs an event | S | `cron_run` per run and `feature` on `ai_call` | State: day one. History: from the deploy |
| 6 | Retention cohorts | **Yes, with changes**: fix "active" first; with few people, monthly cohorts and in numbers, not percentages | M (+S for the signal) | A use event, at most one a day per person | ~5 weeks after the signal. A rough version from rows already stored works on day one |
| 7 | Alerts to the owner | **Yes, with changes**: no new cron. A daily digest in the 08:00 cron and two immediate alerts with deduplication. Counts and a link only | M | `owner_alerted` (so it is not repeated) | From the deploy |
| 8 | Notification statistics | **Yes, with changes**: subscriptions and sends, yes. "Opens", no; instead, a check-in done after the reminder | S | The real channel of each send (one is lost today) | Sends: day one |
| 9 | Consents | **Yes** for the four versioned ones. **No** for the legal texts: there is no record of acceptance, and creating one is `legal`'s business | S | Nothing (legal texts: `legal`'s decision) | Day one |

### What I add

| # | Addition | Verdict | Effort | What has to be recorded |
| --- | --- | --- | --- | --- |
| A1 | **A real activity signal** (it fixes 007 and is a requirement for 6) | Yes, first of all | S | `app_used`, at most one a day per person |
| A2 | **"Should be zero"**: checks that fail silently (recipes over the limit, macros that cannot be computed, meal servings outside 0.5–4, dishes that fit no meal) | Yes, inside point 1 | S | Nothing |
| A3 | **A cron heartbeat**: when each one ran and what it did | Yes, alongside 5 and 8 | S | `cron_run` |
| A4 | **Mail that does not go out**: failed sends per template | Yes | S | `mail_sent` with `{kind, ok}` |
| A5 | **Settings › System**: the versions in force (commit, prompt, steps, consents) and which integrations are configured, yes or no only | Yes | S | Nothing |

**I do not recommend** reading Neon's or Vercel's quotas from the console. It would put another
key with account permissions inside the API, and the owner already has those dashboards. Nor CSV
export, nor OmniRoute health, nor Stripe: they stay out, as in 007.

---

## 2. Premises checked

### The ones that cut across everything

| Premise | Status | Evidence |
| --- | --- | --- |
| "Crons on Vercel's free plan" | **wrong** | Vercel has been Pro since 2026-09-26 (the owner said so that day). `docs/reference/deployment.md:177` still says "A daily run is what the Hobby plan allows": **a stale document**, passed to the lead. The limit that really bites is **Neon**, still free: 100 CU-h and 5 GB of transfer a month per project, shared between production and development (`docs/reference/preview-environment.md:44-50`) |
| "`ai_call` already carries `costUsd`" | **confirmed, with a hole** | `apps/api/src/modules/ai/clients/StructuredAiClient.ts:91-101` and `:141-153`. In dev, **278 of 840** `ai_call`s of the last 30 days carry no cost (**measured**, dev). There were different OpenRouter routes there, so production's share is **unknown**. Also, a call cut off by time returns no body, and OpenRouter may charge for it anyway |
| "`session_started` is good for measuring activity" | **wrong** | See § 1, condition 2. Dev: 12 events, 4 people (**measured**; not representative) |
| "No admin action is recorded today" | **confirmed** | `audit_logs` exists (`packages/database/src/schemas/platform.schema.ts:75-88`) and nothing writes to it: 0 rows in dev (**measured**). `grep` finds no writer |

### Point 1 — Catalogue quality

| Premise | Status | Evidence |
| --- | --- | --- |
| There are recipes whose macros cannot be computed (null) | **wrong as a problem, right as a watch** | `perServing` returns null only if `servings ≤ 0` or an ingredient is not in the catalogue (`packages/core/src/controllers/Admin/AdminCatalogueController.ts:75-99`). `recipe_ingredients.ingredient_id` is a `restrict` FK and `servings` defaults to 1 (`recipe.schema.ts:42`). In dev: 0 recipes with no ingredients, 0 with `servings ≤ 0`, 0 with no kcal (**measured**). It serves as a check that must read zero, not as a page |
| Servings out of range | **confirmed** | There are two ranges: `recipes.servings` (1–8, the pool's schema) and `meals.servings` (`SERVING_BOUNDS` 0.5–4, `packages/core/src/domain/Scheduler/Scheduler.ts:19`). After `0070`'s `0047` migration, no dev recipe is left above 1,350 kcal per serving (**measured**) and 74 remain above 900 (64 from the model and 10 from the seed; **measured** without distinguishing the meal, so it is an upper bound) |
| `oversized` rejections over time | **confirmed; nearly done** | `AdminGenerationsRepository.rejectionsByReason` already totals the period's rejections by reason (`packages/core/src/repositories/Admin/AdminGenerationsRepository.ts:168-184`) and Log draws them. By day it is the same SQL with a `group by` day. The gap: meal swaps (`MealSwap.service.ts:153`) call the model and store their calls nowhere, so their rejections are invisible |
| Recipes with no photo as a data problem | **wrong** | `0066` draws the photo the first time somebody opens the dish and does no backfill. "No photo" is normal for a dish nobody has opened. The signal is `failed` for dish reasons, which Images already counts |
| Ingredients with no allergens or no countries | **wrong** | An empty `countries` means "everywhere" (`packages/database/src/schemas/food.schema.ts:41-49`). 494 of 930 ingredients have no allergen linked, and that is right: rice has none (**measured**, dev). What *is* an error — the name saying "cheese" with `milk` missing — is already checked by a seed test (`packages/database/src/seed/seed.test.ts:150-175`), as are kcal–macro coherence (`:70-91`) and the translations (`:176-208`). Ingredients only enter through the seed (`packages/database/src/seed/index.ts:69`, `:143`), so their place is CI, which is a better place than the console (`0028`: the catalogue is edited in git) |

### Point 2 — Plan quality

| Premise | Status | Evidence |
| --- | --- | --- |
| Every plan can be scored against the owner's bar when it is generated | **confirmed** | At `PlanGeneration.service.ts:277-371` the `validatePlan` `violations`, `loads.dayTargets` (event days) and `minimumKcal` (`:237`) are all in memory, and today they are only stored as sentences (`advisorySummary`, `:371`, inside `generationMetadata`, `:565`). The classes are a closed set (`packages/core/src/domain/PlanValidation/PlanValidation.ts:51-64`) |
| It can be computed after the fact from what is stored | **wrong as a substitute** | Meal swaps rewrite `meals` in place (`plan.schema.ts`, `meal_swaps`). Only 199 of dev's 350 `plan_days` carry `targets` (**measured**). A retroactive computation measures the plan "as it is today", not "as it was generated", and reads plan content. I do not recommend it; at most, an "approximate" label |
| "How many plans hit the energy floor" | **a hypothesis that needs defining** | The floor acts in two places: when computing the target, which is clamped to `MINIMUM_DAILY_KCAL` (left in `nutritionTargets`'s derivation), and in the scheduler (`Scheduler.ts:1191-1228`), which will not leave a day below it even if that takes it out of band. I propose counting the days whose band minimum (target × 0.95) falls below the floor. `plan-evaluator` must confirm that the known 12/14 case shows up that way |
| The validator's advisories can be shown | **only as counts by class** | The `advisories` sentences include the name the person gave their event ("the load for '…' was not applied", `PlanGeneration.service.ts:489`) and figures from their plan. They are free personal text |

### Point 3 — The text AI cap

| Premise | Status | Evidence |
| --- | --- | --- |
| The pictures' cap can be copied | **confirmed for showing it** | The pictures: `AI_IMAGE_MONTHLY_CAP_USD` (`apps/api/src/config/Env.validation.ts:232`), the month's total in `recipe_image_calls`, the cut in `DishPicture.service.ts:138`, a reserve price when OpenRouter does not say (`:19`). A UTC month (`RecipeController.ts:80`) |
| A cut inside the app is needed | **wrong as a necessity** | Production's OpenRouter key already carries a monthly cap (`0064`, point 3: "the key's guardrail: … a monthly cap"). That wall counts exactly what was billed. The app's total does not, because of the hole above |
| Text spends a lot | **wrong** | $0.007–0.0095 per plan with Gemma (**measured**, dev, 2026-09-26, report `0003` § 1). $0.10–0.15 per fortnight with DeepSeek (**estimated**, `0064`). The pictures, by contrast, ~$0.70–1.10 per plan (**estimated**, `0003`). Real production spend: **unknown** from here; the console already shows it under AI and models |

### Point 4 — The action log

| Premise | Status | Evidence |
| --- | --- | --- |
| A new table is needed | **wrong** | `audit_logs` (`platform.schema.ts:75-88`): `action`, `actorId` (FK with `set null`), `entity`, `entityId` (text, no FK), `metadata`, `ipHash`, timestamps, indexes by actor and by action |
| "Who" can be recorded | **confirmed, with a nuance** | There is only one admin. "Who" is nearly always the owner, or nobody: automatic activation, or the mail link `GET /admin/activate`, which goes by token and without a session (`AdminAccounts.controller.ts:85-87`). What is useful is what and when |
| Mutating actions (an inventory) | **measured in the code** | activate (`AdminAccounts.controller.ts:61`), activate by link (`:85`), change tier (`:68`), grant professional (`AdminProfessionals.controller.ts:44`), revoke (`:55`), mark or reopen a message (`AdminFeedback.controller.ts:43`), a switch (`AdminSettings.controller.ts:26`), a test push (`AdminPushTest.controller.ts:20`). Outside the console, automatic activation on confirming the email |

### Point 5 — The step sweep

| Premise | Status | Evidence |
| --- | --- | --- |
| Pending, rewritten or rejected can be known | **confirmed, recording nothing** | The state lives in `recipes.steps_version`: `2.8.0` if up to date, `2.8.0+n` if it has n rejections, and at 3 it is left alone (`packages/core/src/domain/Method/RewriteStamp.ts:21`, `:62`). The "pending" condition already exists in SQL (`packages/core/src/repositories/Recipe/RecipeRepository.ts:852-877`). Dev: 1,559 up to date, 101 with no version, 47 on an old version, 8 with some rejection and 6 at the limit (**measured**) |
| How many it rewrites each night | **not possible with what exists** | `recipes` has no timestamps (`recipe.schema.ts:19-62`). Each sweep's result (`RewriteRun`, `RecipeRewriter.service.ts:57`) is returned to the cron and only survives in the log (`Cron.controller.ts:53-56`) |
| `ai_call` does not say who called | **confirmed** | `AiRequest` has no feature field (`apps/api/src/modules/ai/clients/AiClient.ts:18-34`). There are three text callers: the plan (`PlanGeneration.service.ts:178`), a meal swap (`MealSwap.service.ts:153`) and the sweep (`RecipeRewriter.service.ts:178`). Labelling them names nobody |
| The sweep is on in production | **unknown** | `AI_REWRITE_STEPS` defaults to `false` (`Env.validation.ts:308`). The owner said production was up to date on 2026-09-26. If nothing is pending, this page will show zeroes until the next `STEPS_VERSION` change |

### Point 6 — Retention

| Premise | Status | Evidence |
| --- | --- | --- |
| It comes from `session_started` | **wrong** | See § 1. The fix: `databaseHooks.session.update.after` exists in the installed Better Auth (1.7.5, `init-options.d.mts`, the `session.update` block), and `SessionGuard` renews the session on every read (`apps/api/src/shared/guards/Session.guard.ts:38`). **Hypothesis**: the hook fires once a day per session used; it is proved with an integration test |
| It comes from existing data | **partly** | The dated rows of what somebody *does* (`meal_completions`, `meal_swaps`, `check_ins`, `progress_entries`) allow a "did something" retention backwards, counting distinct people per week, without reading content (`0033`: count the rows that already exist) |
| It makes statistical sense | **hypothesis** | A friends beta. Dev has 10 accounts (**measured**); production, **unknown**. With weekly cohorts of 1–3 people, a percentage is one person |

### Point 7 — Alerts

| Premise | Status | Evidence |
| --- | --- | --- |
| There is mail to the owner | **confirmed** | `notifyOwnerOfWaitingAccount` (`apps/api/src/modules/auth/services/AccountWaitingMail.ts`), `OWNER_EMAIL` (`Env.validation.ts:397`), Gmail SMTP |
| A new cron is needed | **wrong** | The 08:00 one already exists (`apps/api/vercel.json`, `Cron.controller.ts:46-51`). Generation failures already go to Sentry (`PlanJobRunner.service.ts:118`), which has alert rules of its own. An hourly cron would wake Neon 24 times a day: ~0.5 CU-h daily with a five-minute idle at 0.25 CU (**estimated**), against 19 CU-h over 15 measured days (`preview-environment.md:48`). At that rate (~38 CU-h a month, both branches together) it would go from ~38% to ~53% of the 100 CU-h (**estimated**) |
| Push to the owner | **possible, not recommended now** | `PushService` exists, but it needs the owner subscribed from the iPhone's PWA. Mail already works |

### Point 8 — Notifications

| Premise | Status | Evidence |
| --- | --- | --- |
| There are subscriptions and sends | **confirmed** | `push_subscriptions` (`platform.schema.ts`) and `notifications`, written after every send (`NotificationRepository.ts:176-187`). In dev both are empty (**measured**) |
| The channel is recorded properly | **wrong** | What is stored is `mailed ? 'email' : 'push'` (`CheckInReminder.service.ts:100`): if both go out, the push is lost. `pushed` is returned and not stored |
| Whether it was opened can be known | **wrong** | Nobody writes `read_at`. The `notificationclick` of `apps/web/public/sw.js:76` only opens the URL. Measuring it would need a new beacon, and in mail a tracking pixel, which I do not recommend (ePrivacy, and Gmail intercepts it) |

### Point 9 — Consents

| Premise | Status | Evidence |
| --- | --- | --- |
| The profile consent | **confirmed** | `profile_data_consents.version` (`profile.schema.ts:215`), `PROFILE_CONSENT_VERSION = '1.0.0'` (`packages/core/src/entities/Profile/Profile.ts:85`) |
| Health data | **confirmed** | `health_data_consents.version` (`profile.schema.ts:200`), `1.1.0` (`Health.ts:47`). Counting it is counting how many people have health data: a count, allowed by `0028` |
| The link with a professional | **confirmed** | `care_links.consent_version` (`care.schema.ts:79-80`), `2.0.0` (`Care.ts:18`). The professional's agreement in `professionals.agreement_version` (`professional.schema.ts:26-27`) |
| Legal texts (privacy, terms) | **wrong** | There is no table, column or event of acceptance. `/privacidad` and `/condiciones` are published without versioned acceptance. Counting them would require recording acceptance at sign-up and asking again when the text changes: a product and legal decision, not a console one |

---

## 3. What is there today

- **Events**: a closed list of three names, `ai_call`, `session_started` and `swap_requested`
  (`packages/core/src/entities/Analytics/Analytics.ts:14-33`). `0033`'s rule: nothing the
  database already knows, nothing about content. They are written without throwing
  (`AnalyticsRepository.record`). Dev has 854 rows in 688 KB (**measured**).
- **The generations log**: `AdminGenerationsRepository` selects the **whole**
  `generation_metadata` (`:52`) and `planOf` keeps only seven allowed keys
  (`AdminController.ts:95-111`). The `advisories` sentences, which carry event names and
  figures, do not come out in the response, but they do travel from Neon to the function. **A P3
  finding** for whoever owns the admin core: ask SQL for the allowed keys only. It meets the
  letter of `0028` better ("the repository behind it selects no column that carries content")
  and saves transfer.
- **AI and models** totals `costUsd` by day, model and provider (`AdminAiRepository.ts`). It does
  not distinguish who called.
- **Catalogue**: Recipes composes every recipe in memory to sort by kcal
  (`AdminCatalogueController.ts:83`), so the path to compute quality on the fly already exists.
- **Crons**: `/cron/rewrite-steps` at 03:30 UTC and `/cron/reminders` at 08:00 UTC, with
  `CronSecretGuard`, `@Public` and a 404 to anybody without the token
  (`Cron.controller.ts:30-58`).
- **Mail**: if a send fails, it only survives in the log (`Email.service.ts:92-104`).
- **Plans**: `meal_plans.generation_metadata` already stores `advisories` as sentences,
  `fallback` and the model (`PlanGeneration.service.ts:565-574`).

---

## 4. Proposal

### 4.0 The common shape: three things recorded and one rule

Nearly everything that has to start being recorded fits into three places that already exist. No
new table is needed.

1. **`analytics_events`, with the closed list extended by four names, all without a person**
   except `app_used`:

   | Event | Who writes it | `userId` | Properties |
   | --- | --- | --- | --- |
   | `app_used` | the `session.update.after` hook | yes, like `session_started` | none |
   | `cron_run` | `CronController`, when each sweep ends | null | `{job: 'rewrite' \| 'reminders', …counts from RewriteRun or ReminderRun}` |
   | `mail_sent` | `EmailService.send` | null | `{kind, ok}` (`kind` is the template, never the recipient) |
   | `owner_alerted` | the alert to the owner | null | `{kind}` |

   On top of that, `ai_call` gains `feature: 'plan' | 'swap' | 'rewrite'`, which arrives through a
   new field of `AiRequest`. Each keeps `0033`'s rule: it records something that leaves no other
   trace. It is an extension of a closed decision, so it carries a **new decision** (lead).

   **What would break without more care:** Funnel's "events per day" chart draws *every* event
   except `ai_call` (`CHARTED_EVENTS`,
   `packages/core/src/controllers/Admin/AdminSeriesController.ts:166`). `cron_run`, `mail_sent`
   and `owner_alerted` would appear there as "product" lines, with the raw key if their label is
   missing. The closed list has to be split into product events (`session_started`, `app_used`,
   `swap_requested`) and system ones (`ai_call` and the three new ones), and Funnel has to read
   only the product ones. Every new name carries its label in both dictionaries.
2. **`meal_plans.generation_metadata.quality`**, with counts and no figures (§ 4.2).
3. **`audit_logs`**, with one new column (§ 4.4).

**The rule**: nothing new appears on a row with an address (an account, the Log) except the admin
action log, which is about what the owner did. Plan quality, retention and use are shown only
aggregated by period.

### 4.1 Point 1 — Catalogue › Quality

One page with two blocks. Everything is computed on the fly with functions that already exist
(`composePerServing`, `isOversized`, `servingCap`, `MealFit`), never with a new formula:

- **"Should be zero"** (A2). Each row is a count linking to Recipes with the filter set:
  - recipes over the limit (`isOversized`). After `0070` it must read 0; if it does not, something
    got past `PoolBuilder`;
  - recipes with no computable macros;
  - meals with `servings` outside `SERVING_BOUNDS`. It is a count over `meals` that returns no
    row; `invariant-reviewer` reviews it;
  - dishes whose meals do not match their ingredients' (`MealFit`), which are never served;
  - recipes at the sweep's rejection limit.
- **"Worth a look"**:
  - recipes over their meal's cap but within the limit (900, 700 or 400 kcal a serving), by
    source, because the seed has some too;
  - `oversized` rejections per day (the SQL at `:168` grouped by day);
  - `failed` photos for dish reasons.

What does **not** go in: ingredients with no allergens or no countries. The seed tests already
cover it (§ 2). If the owner wants one more check, let it be a `seed.test.ts` test, which fires
before the data ever reaches production.

**Alternative rejected**: a nightly sweep storing a snapshot of the quality. It only pays if
computing on the fly costs something. Reading the whole catalogue is 9,990 rows of
`recipe_ingredients` in dev (**measured**), about 0.5–1 MB a visit (**estimated**). At 2 visits a
day that is 30–60 MB a month, ~1% of the 5 GB.

### 4.2 Point 2 — Plans › Quality

- **On generation**, a new pure function in `core/domain/PlanValidation`,
  `planQuality(violations, dayTargets, minimumKcal, targets)`, with a test, returns:
  `{ days, daysInBand, missesByMacro: {kcal, protein, carbs, fat}, eventDays, eventDaysInBand,
  advisoriesByKind, daysUnderFloorBand, loadsRefused, fallback }`. Counts only: no targets, no
  kcal, no event names. It is written into `generationMetadata.quality`
  (`PlanGeneration.service.ts:565`).
- **In the console**, over the period and across all plans: the share of days in band (all four
  macros at once), per macro, event days inside their band, advisories by class, plans with a
  `fallback`, and days the floor constrained.
  - The query asks only for `generation_metadata -> 'quality'` and `created_at`.
  - **No per-day series** for the floor: with few plans a day, a day with 1 plan is one person.
    The 30-day period dilutes it.
- **Never** in `planOf` or in the Log. An e2e test verifies it and fails if the response of
  `/admin/generations` contains `quality`.
- **No retroactive computation** (§ 2). The page says from which date there is data.

**Alternatives rejected**:

| Alternative | Why it loses |
| --- | --- |
| A `plan_scored` event with no person | It would duplicate what the plan already knows about itself, against `0033` |
| Computing it on read, from `meals` | It measures the plan after swaps and reads content |

### 4.3 Point 3 — The text AI cap

- **Show it**: `AI_TEXT_MONTHLY_CAP_USD` (optional; with no value, no gauge), a `Gauge` on AI and
  models and a card on Overview.
  - A **UTC** month, like the pictures (`RecipeController.ts:80`) and (**hypothesis**) like the
    reset of the OpenRouter key's cap. Not a Madrid month, even though the console's periods are:
    the gauge has to match the real wall.
  - Beside the spend, the month's "calls with no recorded cost". If there are many, the figure is
    a minimum, and the page says so.
- **Warn**: at 80% and at 100%, one `owner_alerted` per threshold and month (§ 4.7).
- **Stop the sweep**: with 80% spent, `RecipeRewriter.rewriteOutdated` does not start. The sweep
  is the only thing that spends with nobody waiting.
- **Stopping generation: the owner's decision.** Both options end the same way:

  | Option | What happens at the cap | Cost |
  | --- | --- | --- |
  | **A (recommended): the wall is the OpenRouter key** | The key returns 402. `PoolBuilder` treats it as a provider failure and the plan comes out of the library (`fallback: full_library`) or, if the library is not enough, `GENERATION_AI_UNAVAILABLE` | One fast failed call per request; nothing to build |
  | B: a cut inside the app | With spend ≥ the cap, `isAvailable` answers false and the plan comes out of the library without calling | It breaks `0013`'s fresh third exactly as A does; it trusts a total that may fall short; M of work |

  I recommend A plus the alert: the alert arrives before the wall, and the wall counts what was
  really billed. B only pays off if the owner wants a cap *below* the key's without touching
  OpenRouter. A condition for either: the app's cap never above the key's (in `deployment.md`).
- **Spend by feature** comes from the `feature` label (§ 4.0): one more column on AI and models,
  "plans / swaps / sweep".

### 4.4 Point 4 — The action log

- **Migration**: `audit_logs.subject_user_id text references user(id) on delete set null`, plus an
  index on `created_at`. That way the trace "an account was activated on day X" survives the
  account's deletion without storing who. Today `entity_id` is text with no FK, and storing a
  person's id there would leave ids of deleted accounts, against the invariant "Account deletion
  actually deletes". `entity_id` is left for what is not a person: a switch's key or an inbox
  message's id, which already cascades with its author. `migration-reviewer` reviews it.
- **Written in the same transaction as the action**, as `careAccessLog` does with the professional
  link (`0059`): an action cannot happen without being recorded.
- **What is recorded**, with closed actions:
  - `account.activated`, with `metadata.via: 'console' | 'mail_link' | 'automatic'`;
  - `account.tier_changed`, with `{from, to}`;
  - `professional.granted` and `professional.revoked`;
  - `feedback.handled` and `feedback.reopened`;
  - `setting.changed`, with `{key, enabled}`;
  - `push.test_sent`.

  `actorId` is the session, or null for the link and for automatic activation. **Never** the
  request's body (the schema says so itself, `platform.schema.ts:70-73`), and `ipHash` stays
  empty.
- **A page** Settings › Action log: a table with date, action, the account affected (its email:
  accounts are already rows with an address) and detail, with a filter by action. It extends
  `0068`, so it carries a decision line.
- **Out**: the tier change made by the Stripe webhook (payments deferred). When it returns, it is
  `via: 'stripe'`.

### 4.5 Point 5 — The step sweep

- **State** (recording nothing): cards for "up to date / pending / with rejections / abandoned"
  from `steps_version`, with the SQL condition that already exists, plus a table of the abandoned
  recipes. It is catalogue data, with no person. It goes in Catalogue › Quality or in a section of
  its own under Generation.
- **History**: `cron_run {job: 'rewrite', pending, rewritten, skipped, unreached}` per night, plus
  the spend and the calls with `feature: 'rewrite'`, in one line a day.
- **On or off**: `AI_REWRITE_STEPS` in System (A5), as a yes or no.

### 4.6 Point 6 — Retention

1. **The signal first (A1)**: `app_used` from `session.update.after`, at most one per session per
   day, alongside the `session_started`s that already exist.
   - "Active" becomes "signed in or used a session that day".
   - Overview, Funnel and the Accounts column read both events. **This fixes 007.**
   - **Alternative rejected**: a deduplicated write in `/users/me`. It works just as well, but it
     puts a write on the hottest route, and the hook adds no request at all.
   - If the test proves the hook does not fire on renewal, that alternative becomes the plan.
2. **Cohorts**: rows per week (or month) of sign-up and columns "active in week 1, 2 and 4",
   counting distinct people.
   - Until a cohort has ~20 people, **numbers and not percentages**, and monthly grouping by
     default.
   - No link from a cell to the accounts.
3. **From day one, a rough version** with what exists: "did something" (`meal_completions`,
   `meal_swaps`, `check_ins`, `progress_entries`) per week. It is labelled as such. Those tables
   are content, but the query only returns `count(distinct user_id)` per week.

### 4.7 Point 7 — Alerts

- **A daily digest** (mail, at most one a day and **only if there is something**). It goes in
  `/cron/reminders`, **before** the reminders switch is checked, because they are different
  things.
  - Contents:
    - accounts waiting;
    - new inbox messages (the number, never the text);
    - failed generations in 24 h, by code;
    - text and picture spend against their caps;
    - anything in "should be zero";
    - failed mail (A4);
    - whether a cron did not run (A3).
  - All with a link to the console's page. **No addresses and nobody's text.** The mail goes out
    through Gmail and is less safe than the console.
- **Immediately**, with deduplication (`owner_alerted {kind}`, not repeated within 6 h):
  - **3 failed generations in a row**. Checked where the job fails
    (`PlanJobRunner.service.ts:118`) with a query over the last 3 jobs.
  - **Spend at 80% and 100%** of a cap, once per threshold and month.
- **An alternative for the failure streak: Sentry.** The failures already arrive tagged
  `plan-generation:<code>`. An alert rule in Sentry costs zero code and five minutes of the
  owner's. If the owner sets it up, the streak leaves this project and only the digest remains.
- **New accounts**: already alerted immediately when the gate is closed (`0029`). It is not
  duplicated.
- **No new cron.** The digest goes out at 08:00 UTC (10:00 in Madrid in summer). If the owner
  wants it at another hour, the cron's hour changes; what must not happen is adding an hourly one
  (§ 2, Neon).

### 4.8 Point 8 — Notifications

- Cards: push subscriptions and people with at least one.
- Reminders sent per week and per channel.
  - **The fix**: store both channels when both go out, with one row per channel or a `both`
    channel. The second is an enum change, with a migration, so I prefer the first.
- **"Opens"**: instead, "a check-in done within 3 days of the reminder". It comes from
  `notifications.sent_at` and `check_ins.created_at`, counting distinct people. An open beacon
  waits until volume justifies it.

### 4.9 Point 9 — Consents

- One table per consent: the version in force, how many accounts have it, how many have an earlier
  one (those will be asked again) and, for the profile one, against the accounts that finished the
  welcome.
- Health data and links with `shares_health`: the number only.
- The professional's agreement: by version.
- **Legal texts: no.** Passed to `legal`: should sign-up record versioned acceptance of
  `/condiciones` and `/privacidad`? The activation checklist
  (`docs/legal/checklist-activacion.md:43`) handles changes by mailing a notice, not by asking for
  acceptance again. If `legal` decides to record it, the console counts it with the same pattern,
  in a later phase.

### 4.10 Additions A3–A5

- **A3, the cron heartbeat**: "the last `cron_run` of each job" in System. If more than 26 h pass
  without one, it goes in the digest. It catches a lost `CRON_SECRET`, because then the route
  answers 404 and only the log says so (`deployment.md:82`).
- **A4, mail**: sent and failed per template and day. With the Gmail app password revoked, nobody
  could confirm their address and today only the log would say so.
- **A5, Settings › System**:
  - the commit in production (`VERCEL_GIT_COMMIT_SHA`);
  - `PROMPT_VERSION`, `STEPS_VERSION` and the consent versions;
  - the caps;
  - and **only yes or no** for `SMTP_HOST`, `OWNER_EMAIL`, `VAPID_*`, `CRON_SECRET`,
    `SENTRY_DSN`, the pictures key and `AI_REWRITE_STEPS`.

  It would have caught the misspelled `SENTRY_DNS` of 2026-09-21 at once. Never a value: a test
  verifies the response contains only booleans and versions.

---

## 5. Requirements

| Kind | What |
| --- | --- |
| **Code** | `core`: `planQuality`, the quality, consent, notification, cohort and audit repositories. `api`: `feature` on `AiRequest` and its three callers, `cron_run`, `mail_sent`, the session hook, an audit write on 8 routes plus automatic activation, the alert and the digest, new routes under `@Roles('admin')`. `web`: 5–6 new pages or sections with 007's components (`StatTile`, `Gauge`, `DataTable`, charts) |
| **Data** | **One migration**: `audit_logs.subject_user_id` plus the index. The rest is JSON inside columns that already exist, plus four event names |
| **Infrastructure** | No new cron, no new table, no new service. An optional `AI_TEXT_MONTHLY_CAP_USD` variable |
| **Money** | **€0.** Mail through Gmail: one digest a day plus rare alerts |
| **The owner's time** | Decide D1–D5 (below). Set `AI_TEXT_MONTHLY_CAP_USD` on Vercel. Optionally, an alert rule in Sentry. Run the migration in dev after merging, as always. Try it on the iPhone |
| **Decisions the owner takes** | **D1** the text cap: show and warn only (recommended) or also cut inside the app. **D2** the cap's value, decided by looking at the 30-day spend the console already shows. **D3** auditing: on deleting an account, drop the link (`set null`, recommended) or delete the row. **D4** alerts: mail (recommended) or push, the digest's hour, and whether the failure streak goes through Sentry. **D5** refer the acceptance of the legal texts to `legal` |
| **Decisions the lead records** | One decision extending `0033` (four events and `feature`), one line extending `0068` (the action log and the new pages) and, if D1 = B, one for the cut |
| **Reviewers** | `invariant-reviewer` on every API phase (especially 1 and plan quality), `migration-reviewer` on the migration, `legal` on the digest mail's content and on D5, `plan-evaluator` on the floor's definition |

---

## 6. Risks

Safety, privacy and quota first.

| Risk | To whom | Likelihood | How it would show | How to undo it |
| --- | --- | --- | --- | --- |
| **A plan's quality ends up on a row with an address** (the Log), or is shown per day with N = 1 | Everybody with a plan | medium if nobody watches | An e2e test looking for `quality` in `/admin/generations`; an `invariant-reviewer` pass | Remove the key from the allow list; the data needs no change |
| **The `advisories` sentences slip into** a response (they carry event names) | Whoever named an event | low (there is an allow list today) | The same test; § 3's P3 closes it in SQL | Ask SQL for the allowed keys only |
| **The digest mail takes system data out** | The people in the inbox and in Accounts | low with the "numbers and links only" rule | A `legal` review; a template test that fails if it contains `@` | A numbers-only template |
| **Auditing keeps ids of deleted accounts** | Whoever deletes their account | high if `entity_id` is used | A migration review | An FK with `set null` (D3) |
| **The app's cap does not match the bill** (calls with no cost, time cuts) | The owner's pocket | medium | "calls with no cost" beside the gauge | The real wall is the OpenRouter key (D1 = A) |
| **Neon transfer** from the new pages | All of production (suspension past 5 GB) | low | The Neon dashboard | Everything is aggregates over few rows; Catalogue Quality reads ~0.5–1 MB a visit (**estimated**) |
| **Neon compute** if somebody adds an hourly cron | All of production | low with this plan | +~15 CU-h a month (**estimated**) | There is no new cron |
| The new system events appear in Funnel's event chart | The owner's reading | certain if the list is not split | "cron_run", "mail_sent" lines under Product | `CHARTED_EVENTS` becomes the product-event list (§ 4.0) |
| `app_used` writes on every renewal | Sign-in performance | low: one row a day per person, without waiting for the result (`AnalyticsRepository.record` never throws) | `/users/me` latency | Remove the hook |
| The Better Auth hook does not fire on renewal | The "active" fix | **hypothesis** | Phase 1's integration test | Move to the deduplicated write (§ 4.6) |
| A daily digest when there is nothing | The owner's inbox | low | — | It is only sent if there is something |
| Cohorts read as percentages with a small N | The owner's decisions | high with today's beta | — | Numbers with N, and monthly grouping |
| Changing the definition of "active" changes figures the owner has already seen | Trust in the panel | certain | A step in the series on deploy day | "How this is counted", dated with the change |

---

## 7. Cost and effort

In 007's phase sizes (S ≈ a short agent phase, M ≈ a normal one, L ≈ a backend + web pair from
007). **Estimated**, from what 007's phases cost in its LOG.

| Block | Effort | What moves it |
| --- | --- | --- |
| Start recording: events, `feature`, quality, auditing with its migration | M–L | How many routes mutate (8 plus automatic activation); the floor's definition |
| Catalogue quality + System + consents + notifications | M | Reusing Recipes' composition; `MealFit` existing as a function |
| Spend: gauge, alert, stopping the sweep, the per-feature split | S (M if D1 = B) | D1 |
| Plan quality + the action log + retention | M–L | Volume (with little, the cohorts are short tables) |
| Alerts | M | Sentry yes or no; the `legal` review |

**Money: €0** in every scenario. What it does consume:

- **Neon transfer**: < 100 MB a month (**estimated**: 2 daily visits to Quality plus the
  aggregates).
- **Storage**: < 1 MB a month with 50 people (**estimated**: `app_used` ≈ 1,500 rows a month at
  ~100 B plus an index, `cron_run` 60 rows, auditing dozens).
- **Vercel**: no new invocations.

---

## 8. Plan (for `/plan-project`, project 008)

The principle: **first what starts counting; then what reads what already exists; then what needs
the new data to pile up; last what leaves the system.**

### Phase 1 — Start recording (API + core, no pages)

- **What**:
  - `app_used` from the session hook, with an integration test;
  - `feature` on `ai_call` from the three callers;
  - `cron_run` in both crons;
  - `mail_sent` in `EmailService`;
  - `planQuality` and writing it into `generation_metadata`;
  - the dual channel for reminders.

  One decision extending `0033`.
- **Success metric**: in dev, after a day of testing, every event appears with the expected
  properties. A generated plan carries `quality` with `days` = 14. `/admin/generations` does not
  contain `quality` (e2e test).
- **Signal to stop**: if `planQuality` cannot say what "the floor constrained the day" means
  without `plan-evaluator` validating it against the real library, it is recorded without that
  field and added afterwards.

### Phase 2 — The action log (the only migration)

- **What**: `subject_user_id` with `set null` plus the index, the transactional write on every
  action, and the Settings › Action log page. `migration-reviewer` and `invariant-reviewer`
  review it.
- **Metric**: each of the 8 routes and automatic activation leave exactly one row (e2e). Deleting
  an account leaves its row with a null subject.
- **Stop if**: the transactional write forces changes to the user repository beyond passing it the
  `tx`. Then the write happens immediately afterwards and the window is documented.

### Phase 3 — Fix "active" and read what already exists (web + API)

- **What**:
  - Overview, Funnel and Accounts read `session_started ∪ app_used`, with a dated "How this is
    counted";
  - Catalogue › Quality (with "should be zero" and `oversized` per day);
  - People › Consents;
  - Settings › System;
  - the notifications section.
- **Metric**: the "should be zero" rows read 0 in dev, except what is known not to. System returns
  no value that is not a boolean or a version (test).
- **Stop if**: Quality reads more than ~2 MB a visit in dev. Then a nightly snapshot inside the
  03:30 cron.

### Phase 4 — Spend

- **What**: `AI_TEXT_MONTHLY_CAP_USD`, the `Gauge`, "calls with no cost", spend by feature,
  stopping the sweep at 80% and, if D1 = B, the generation cut.
- **Metric**: a month's gauge matches OpenRouter's dashboard within 10% (the owner compares once).
- **Stop if**: the gap is larger. Then find where it comes from before warning with that figure.

### Phase 5 — What needs accumulated data

- **What**: Plans › Quality, Retention (the rough one from day one and the `app_used` one once
  there are 5 weeks) and the sweep's history.
- **When**: not before 2–4 weeks after phase 1, or the page will show almost nothing.
- **Metric**: the period's share of days in band matches what `evaluate-plans.mjs` measures over
  the same library. That last one is a **hypothesis**: real people against fixed profiles; if it
  does not match, that is information, not a failure.
- **Stop if**: there are fewer than ~10 plans in the period. The page says "not enough data"
  instead of a percentage.

### Phase 6 — Alerts

- **What**: the daily digest in `/cron/reminders`, the failure streak (or the Sentry rule, D4),
  the spend thresholds and `owner_alerted`.
- **Metric**: over a week in dev with induced failures, one streak mail and one digest a day, never
  two of the same kind within 6 h.
- **Stop if**: `legal` asks for the mail's content to change. The template is adjusted; the
  mechanism does not.

They can be paired as in 007 (backend and then web in one `/team`): 1 + 3 and 4 + 5. Phases 2 and
6 stand alone.

---

## 9. What I do not know

- **Production's volume**: accounts, plans a week, active people. It decides when plan quality and
  the cohorts make sense. The owner can read it in the console today.
- **The share of `ai_call`s with no cost in production.** In dev it is 33%, with other routes. It
  decides whether the spend gauge is reliable or a floor. Measured in phase 4.
- **Whether the `session.update.after` hook fires on renewal** with the current configuration. A
  test in phase 1 says.
- **When OpenRouter resets a key's monthly cap** (a UTC month or something else). It decides
  whether the gauge and the wall agree. It can be read in their documentation before phase 4.
- **Whether `AI_REWRITE_STEPS` is on in production.** System (A5) will say.
- **Whether the owner has alert rules in Sentry** and whether his free plan is enough for one rule
  per tag.
- **Exactly how "the floor constrained the day" is defined** so that the known 12/14 case shows up
  as such. `plan-evaluator` settles it.
- **Whether `legal` wants acceptance of the legal texts recorded.** Without it, point 9 stays half
  done.

---

## Findings about what has already shipped

These go to the lead, who distributes them:

- **P2 — "Active people" and "Last activity" measure sign-ins, not use.**
  - Where: `AdminSeriesRepository.ts:75-97`, `UserRepository.ts:60`; the cause, in
    `auth.config.ts:33-34`, `:103`.
  - Fix: phase 1 and phase 3 of this plan. In the meantime, the "How this is counted" of those two
    figures should say so.
- **P3 — The Log selects the whole `generation_metadata`.**
  - Where: `AdminGenerationsRepository.ts:52`. The `advisories` sentences, with event names,
    travel as far as the function even though they do not come out in the response.
  - Fix: ask SQL for `planOf`'s keys only.
- **P3 — A stale document.** `docs/reference/deployment.md:177` talks about Vercel's Hobby plan,
  and the project has been on Pro since 2026-09-26.

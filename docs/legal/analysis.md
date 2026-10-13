# Legal analysis — NutrIA (the whole product and project 004)

> **Purpose**: the legal analysis of the whole product and of project 004. **Audience**: the owner, the lawyer, the lead. **Committed**: yes. **Maintained by**: the `legal` agent.
>
> **I am not a lawyer.** This is the analysis one would do, with every conclusion tied to the
> article it rests on and to what the code actually does (with `path:line`). Anything that
> depends on an interpretation is marked **[lawyer]** and gathered in § 10.
> Cut-off date: 2026-09-25. Commit read: `ce12c0d`.
>
> **Revision 2026-09-26 — the AI provider** ([`0064`](../decisions/0064-generation-runs-on-paid-no-training-models-through-openrouter.md)),
> commit read `31c3f99`: §§ 0 (point 6), 1.3, 3, 4.2, 4.3, 7, 9 (P0-3, P1-10, P1-11 to P1-13,
> P2-11, P2-12, P3) and 10. Updated the same day with the owner's decisions: Gemma 4 31B
> replaces MiniMax M3 as the fallback, the closed list of DeepInfra and CoreWeave is done, the
> categorisation accepted with a notice. The rest has not been re-read against the code: the
> states of P0-1, P0-2, P1-1 to P1-4 this document and the DPIA give are those of 2026-09-25
> and that day's `decisions/LOG.md` says they were built.
>
> **Revision 2026-10-03 — the sign-up that reveals nothing** (project 011, phases 7 and 8;
> PR #217, branch `feat/011-p8-signup`, commit read `4f36ec5`): §§ 3, 4.1, 4.1 ter (new), 9
> (P2-14, P2-15, P3) and 10 (point 13).
>
> **Revision 2026-10-09 — the browser that has already signed in** (project 011, phase 7b,
> `0089`; PR #242, branch `feat/011-p7b-device-cookie`, commit read `3243cc7` and the changes
> from that day's invariant review): §§ 4.1, 4.1 quater (new) and 10 (point 14).
>
> **Revision 2026-10-09 (afternoon) — the sweep of the account nobody confirmed** (project 011,
> the "30-day sweep of unconfirmed accounts" follow-up,
> [`0092`](../decisions/0092-sweep-an-account-whose-address-nobody-ever-confirmed.md); PR #250,
> commit read `fbab7b1b`, already in `main`): §§ 4.1, 4.1 quinquies (new), 9 (P2-15 closed, two
> P3s) and 10 (point 15).

## 0. A summary in ten lines

1. **Roles.** NutrIA (its owner) is the **controller** (*responsable*) of everything the
   product processes. When a client accepts a link, NutrIA **communicates** data to their
   dietitian at their request and with their consent; the dietitian is an **independent
   controller** of what they see and do with it in their clinical practice. NutrIA is **not the
   dietitian's processor** (*encargado*): the data live in the client's account and NutrIA
   decides how long they last. There is no joint controllership, but the professional's
   agreement includes, in case a court found one, the allocation art. 26 requires (§ 2).
2. **There are three P0s today**, two of them **already in production** and unrelated to the
   flag: allergies, intolerances and body data are processed with no art. 9 exception; and
   free-text allergies, the "way of eating" (halal/kosher) and the check-in comments travel to
   free models whose terms allow training on them. The third is 004's: the invitation promises
   a control that does not exist (§ 9).
3. **DPIA: mandatory** (four criteria from the AEPD's list). Written in [`dpia.md`](./dpia.md).
   **DPO: not mandatory today** (there is no "large scale"); review as it grows (§ 5).
4. **Still to build**: the professional's acceptance screen (with a table and a version), the
   explicit health consent at sign-up, the control to withdraw only the health line from the
   link, the age gate and the legal notice (§ 9, § 11).
5. **The owner as an individual**: selling Premium or practice plans is economic activity: tax
   registration and, very probably, RETA; the legal notice must carry an address and tax number
   (§ 6).
6. **AI (2026-09-26).** Production has called no model since 2026-09-26 (`AI_PROVIDER=stub`).
   The move to OpenRouter with paid models, zero retention and no training (`0064`) keeps the
   owner's rule **if** beforehand: the text of OpenRouter's processing agreement is held, along
   with confirmation that it applies to his account (P1-11, **pending**). The closed list of
   companies that may run the model (P1-12) is done: DeepInfra and CoreWeave, on the account
   (the owner, 2026-09-26) and in the code (`AI_PROVIDER_ONLY`). MiniMax M3 is out; Gemma 4 31B
   is the primary and DeepSeek V4.1 Flash the fallback; Gemma is Apache 2.0 with no duties that
   block (P1-13, closed). The policy changes in two steps (§ 4.3,
   [`textos/02`](./textos/02-politica-privacidad.md)). P1-10 (Gemini in `/consulta`) closes with
   the change.

> **Revision 2026-09-28 — the onboarding trim** (decision `0067`, **unmerged**: branch
> `feat/onboarding-cleanup`, base `4b70ff7`): §§ 1.3, 3, 4.1, 9 (a new P2-13). Onboarding stops
> asking for ten fields — waking and sleeping time, training days and time, work schedule notes,
> budget, cooking frequency, breakfast style, portion preference and the free-text custom goal
> — and the prompt (`4.3.0` → `4.4.0`) stops receiving the shape and hours of the day and the
> budget/cooking frequency; it still receives the maximum cooking time, the meal shape, the
> targets, the goal type, vegetarian/vegan, cuisines and tastes by catalogue name. **What
> follows here is true once that branch is merged**; until then, what holds is what the
> 2026-09-26 revision describes.
>
> **Revision 2026-09-28 (a second pass, the same day and the same branch, commit read
> `28449c1`) — it closes P2-13**: migration `0043` (backend, today unmerged in
> `agent/onboarding-cleanup/backend`;
> `packages/database/src/migrations/0043_onboarding_answers_nothing_reads_are_cleared.sql`) sets
> the nine `user_preferences` columns and `goals.customGoal` to `NULL` for **every** account,
> not only new ones, and moves every `goals.type = 'custom'` to `'maintenance'`. §§ 1.3, 4.1 and
> 9 (P2-13, closed) are updated. The columns and the `'custom'` enum value still exist in
> Postgres — dropping the schema belongs to the next delivery, as `0067` decided — but there is
> no longer any row with a value the policy does not describe: the policy can stop naming
> "schedules" today, not when that second migration arrives. **True once** this branch is
> merged, like the rest of this revision.

---

## 1. What the product does (what I read, not what the documents say)

### 1.1 Data, where they live and how they are deleted

Every user table hangs off `user.id` with `ON DELETE CASCADE`
(`packages/database/src/schemas/_utils.ts:42,75`), with these deliberate exceptions:

| Table | What it stores | On deleting the account |
| --- | --- | --- |
| `care_access_log` | the professional's access trail, the client's | `professionalId` → `NULL`, **the professional's name is kept** in the client's account (`care.schema.ts:122`) |
| `target_overrides.setByProfessionalId` | who set the targets | `NULL` (`profile.schema.ts:122`) |
| `care_invitations` | the address the professional typed, the token's hash | deleted by address in `beforeDelete` (`apps/api/src/modules/auth/auth.config.ts:227-230`); expired ones are only cleared when another invitation is written (`care.schema.ts:14-24`) |
| `recipes.createdBy` | a generated recipe | `NULL`; the recipe stays in the library (`recipe.schema.ts:22`) |
| `audit_logs.actorId` | admin actions from a closed list (`AUDIT_ACTIONS`, `packages/core/src/entities/Audit/Audit.ts:12-23`, since 008) | `NULL` (`platform.schema.ts:86`). Corrected 2026-09-30: it used to say nothing wrote to this table. The four picture actions (`picture.retried`, `picture.discarded` and, since 009 phase 3, `picture.accepted` and `picture.removed`) carry the owner as the actor and a recipe as the entity; `picture.accepted` also carries the allergen keys the judge flagged in the image, which describe an image and not a person, and `picture.removed`, since 010 phase 4, `acceptedBy` (`judge` or `owner`: which door the withdrawn image had come through; earlier rows, `{}`): no third party's datum ([`dish-pictures.md`](./dish-pictures.md) § 4.4). Corrected 2026-10-09: it is no longer true that no row is ever deleted — the `auth.*` rows are purged at twelve months since 011's phase 7 (`AuditController.forgetExpiredAuthRows`, #213; § 4.1 bis), and the rest (admin) still have no period, which is no problem while the only admin is the controller. Since the sweep of unconfirmed accounts (`0092`, #250) there is one more action, `auth.unconfirmed_account_swept`, whose actor is nobody and whose subject is left at `NULL` in the same transaction that deletes the account (§ 4.1 quinquies). **Unreviewed**: what is left on rows whose entity is an account (`account.*`, `professional.*`) when that account is deleted |
| `analytics_events` | `session_started`, `swap_requested`, `ai_call` | a cascade; **tied to `userId`** (`platform.schema.ts:97`; the writers at `auth.config.ts:103` and `apps/api/src/modules/meal-plans/services/MealPlans.service.ts:69`) |

Before deleting, the Stripe subscriptions are cancelled and, if Stripe fails, the account is not
deleted (`auth.config.ts:212-231`). The session lasts 30 days and stores the IP and the user
agent (`auth.config.ts:31`, `auth.schema.ts:45-56`). ~~There is no scheduled task purging
anything: the two crons are the recipe rewrite and the reminders~~ — **corrected 2026-10-09**:
since 011 there is one, `/api/v1/cron/sweep-verifications` at 08:05 UTC
(`apps/api/vercel.json`), which clears Better Auth's verification rows and, in
`AuthRetentionService.forget`, three more things: the silent rows of the per-address brake, the
`auth.*` trail rows older than twelve months (§ 4.1 bis) and the unconfirmed accounts older than
thirty days (§ 4.1 quinquies).

**Backups**: a point-in-time restore on Neon (an unrecorded window) and a manual export,
**unencrypted**, kept on the owner's machine and not deleted on its own
(`docs/reference/deployment.md` § 8).

### 1.2 Which data are health or a special category

GDPR art. 4.15 defines "data concerning health" as those that "reveal information about his or
her health status". The CJEU reads it broadly: it is enough that the datum allows the state of
health to be deduced "by an intellectual operation involving comparison or deduction" (C-184/20
*OT*, 1/8/2022; C-21/23 *Lindenapotheke*, 4/10/2024, where the data of an order of
non-prescription medicines were held to be health data). On that test:

| Datum | Art. 9? | Treated today as |
| --- | --- | --- |
| Conditions, medication, supplements | Health, beyond doubt | Versioned explicit consent (`HEALTH_CONSENT_VERSION = '1.0.0'`, `packages/core/src/entities/Health/Health.ts:43`) ✔ |
| Allergies, intolerances, free-text allergies (`allergies`, `intolerances`, `custom_allergens`, with severity up to `anaphylaxis`) | **Health**: an allergy is a state of health | Contract only (art. 6.1.b) — `apps/web/src/i18n/dictionaries/es-ES.ts:1113,1125` ✘ |
| Weight, height, date of birth, sex, goal (losing weight), the weight series | **Health, in this context** [lawyer]: they are used to compute basal metabolism and to follow weight loss | Contract only ✘ |
| "Way of eating": `gluten_free`, `lactose_free` | Health (it reveals coeliac disease or an intolerance) | Contract only ✘ |
| "Way of eating": `halal`, `kosher` (`packages/database/src/schemas/_enums.ts:21-22`) | **Religious beliefs** | Contract only ✘ |
| Check-in comments, meal notes | They may contain health ("I felt dizzy") | Contract only |

The consequence: the product processes special categories **outside** the three health tables,
with no art. 9.2 exception at all. See P0-2 in § 9.

### 1.3 What reaches the AI (reviewed 2026-09-28, `0067` — true once merged)

**The prompt** (`apps/api/src/modules/ai/prompts/PoolPrompt.ts`, `PROMPT_VERSION`: `4.3.0`
today in `main`, `4.4.0` in `feat/onboarding-cleanup` — what 4.0.0 removed, at `:98-107`, what
4.2.0 grouped at `:121-124`; neither adds a datum about the person): the daily targets and their
split per meal, the goal type (e.g. `weight_loss`), the meal shape and the maximum cooking time,
"vegetarian" or "vegan" and no other way of eating (`NAMEABLE_PATTERNS`), cuisines from a closed
list, liked foods by their catalogue name, the names of loved, rejected and served dishes, the
check-in's closed answers, and that meal's foods **already filtered** by allergies, intolerances
and ways of eating. It does **not** carry a name, an email, a `userId`, age, sex, weight, height,
anything written by the person, allergies or declared health: `apps/api/src/modules/ai` imports
nothing health-related and a test holds it (`health-boundary.spec.ts`). **A nuance**: the effect
does enter — coeliac disease takes gluten out of the catalogue and a protein supplement adds
protein powder (`0052`) — the datum does not.

**Since 4.4.0** (`0067`) the prompt **also** stops receiving the shape and hours of the day —
what time somebody wakes, sleeps and trains, `dayShapeOf` in
`apps/api/src/modules/meal-plans/services/GenerationShared.ts:50-70` — and the budget and
cooking frequency (`GenerationShared.ts:118,121`, `PoolPrompt.ts` lines `178`, `184`, `189`,
`714-715`, `730` in `4.3.0`). It is not that they were hidden from the prompt like 4.0.0's free
text (the old § 1.3, P0-3): those six (the four that make up `dayShapeOf` plus `budget` and
`cookingFrequency`) were **structured** data, already without the person's words, that did reach
the model. What is new is that **onboarding stops asking for them**: there is no datum to hide
because it is not collected. Four more fields join them that onboarding no longer asks for and
that never reached the model — breakfast style and portion preference (excluded since 4.0.0,
`GenerationShared.ts:101-104`), the work schedule notes (likewise) and the free-text custom goal
(`goals.customGoal`, which no route in `apps/api/src/modules/ai` reads). In all, ten columns of
`packages/database/src/schemas/profile.schema.ts` (`user_preferences`: `breakfastStyle`,
`budget`, `cookingFrequency`, `portionPreference`, `sleepEnd`, `sleepStart`,
`trainingDaysPerWeek`, `trainingTime`, `workScheduleNotes`; `goals`: `customGoal`) that
onboarding still stores in the database but **no longer fills**: minimisation of the collection,
not only of what is sent to a third party (art. 5.1.c GDPR). The columns are not dropped in this
change, but neither are they left with their old value: migration `0043`, in the same change,
sets those nine columns and `customGoal` to `NULL` for **every** account, not only those created
afterwards. It also moves every `goals.type = 'custom'` to `'maintenance'` — a "custom goal"
always computed exactly like "maintenance" (`PROTEIN_G_PER_KG` in
`core/domain/Nutrition/Nutrition.ts:21-28` holds the same 1.6 g/kg for both; `nutritionTargets`
in `Nutrition.ts:279-283` marks neither as `losing` or `gaining`, so the computed target is
maintenance's in both cases), so nobody's plan targets change because of that label change.
Dropping the columns and the `'custom'` enum value in Postgres belongs to the next delivery, as
`0067` already said; see § 4.1 and § 9 P2-13 (closed).

**Until 2026-09-26** the prompt went to the owner's OmniRoute gateway, which sent it to free
models whose providers train or log (`opencode/*-free`; Muse Spark *Contributor*: "your prompts
and completions to train future Meta models"; free NVIDIA Nemotron: "logged… to improve NVIDIA
products and services", report `docs/reference/architecture/0002` P10) and, as a fallback, to
Gemini's free quota. Before 4.0.0 (2026-09-25) it also carried free-text allergies, the way of
eating (halal, kosher) and the check-in's comment (P0-3).

**A correction about Gemini** (premise P12 of report `0002`). This analysis lumped Gemini's free
quota in with the models that train. That is not accurate for an owner in the EEA. The *Gemini
API Additional Terms* (last updated 23/03/2026, `ai.google.dev/gemini-api/terms`, read
2026-09-26) say: "If you're in the European Economic Area, Switzerland, or the United Kingdom,
the terms under 'How Google uses Your Data' in 'Paid Services' apply to all Services, including
Google AI Studio and unpaid quota in the Gemini API, even though they are offered free of
charge" — that is, **it does not train**. The problem was another, and clearer: "You may use only
Paid Services when making API Clients available to users in the European Economic Area,
Switzerland, or the United Kingdom". Serving NutrIA's users on the free quota **broke Google's
terms**, fallback step or not. And "You may not use the Services in clinical practice, to provide
medical advice…" applies to the paid service too (P1-10).

**Since 2026-09-26** production runs with `AI_PROVIDER=stub` (`0064`;
`apps/api/src/modules/ai/ai.config.ts`, `case 'stub': return null`): **no model is called** and
the dishes come from the library. No illustrations are drawn either: they only exist with
`AI_PROVIDER=google` and `AI_ILLUSTRATIONS=true` (`resolveImageModel`). Project 006 (planned,
2026-09-27) replaces them with realistic images with their own key and their own flag:
[`dish-pictures.md`](./dish-pictures.md).

**After the change** (`0064`; the runbook `docs/reference/ai-gateway.md` § 0), with
`AI_PROVIDER=openrouter`:

- The API calls `https://openrouter.ai/api/v1` directly; any other host is refused at start-up
  and again when the key is handed over (`openRouterBaseUrl`).
- It asks for `google/gemma-4-31b-it` (`AI_MODEL`) and, as a fallback inside the same request,
  `deepseek/deepseek-v4.1-flash` (`AI_FALLBACK_MODELS`; `openRouterRequest`, the `models` field).
  The owner's decision of 2026-09-26: `0064` had DeepSeek as the primary and MiniMax M3 as the
  fallback; MiniMax went, Gemma came in as the fallback and then became the primary. Gemma 4 is
  Google's open-weights model, run here by DeepInfra or CoreWeave: it is not the Gemini API and
  it does not go through Google.
- Every request carries, written over any other value,
  `provider: { zdr: true, data_collection: 'deny', require_parameters: true }`
  (`NO_TRAINING_PROVIDER`), and no session header and no id of ours (`resolveCallSettings`:
  `sessionHeader: null`).
- On the account (the owner): training off for paid and free models, ZDR for the whole account,
  OpenRouter's use of inputs and outputs off; the key, with those two models only, ZDR and a
  monthly cap. **Which companies may run the model** (P1-12): DeepInfra and CoreWeave, fixed on
  2026-09-26 on the account (*Allowed providers*, the owner) and on every request
  (`provider.only` from `AI_PROVIDER_ONLY`, required at start-up with `AI_PROVIDER=openrouter`:
  `apps/api/src/config/Env.validation.ts:506-507`, `ai.config.ts`, `providerOnly`).

**Who can receive the request**, per OpenRouter's public API consulted on 2026-09-26
(`/api/v1/endpoints/zdr`, `/api/v1/providers`): for DeepSeek V4.1 Flash, **23 ZDR endpoints from
22 companies**, among them DeepInfra, CoreWeave and Together (based in the US), NextBit (Spain),
**DekaLLM (headquarters and data centre in Indonesia)**, SiliconFlow (headquarters in Singapore,
data centre in the US) and Makora (no published headquarters or terms); for Gemma 4 31B, 13 ZDR
endpoints (DeepInfra — three — CoreWeave, Crusoe, Reka, Io Net, ModelRun, SambaNova, SiliconFlow,
Venice, Parasail, Novita); for MiniMax M3, now out, there were 9. Neither DeepSeek (China) serves
its model today on a ZDR endpoint, nor does Google serve Gemma on OpenRouter. With the closed
list only DeepInfra and CoreWeave remain for both models. In `0064`'s measurement, DeepInfra,
Together, CoreWeave, DekaLLM and Sail Research answered — with two synthetic people built from a
random id (`apps/api/scripts/bench-models.mjs:46-47`), so nobody's datum went out.

### 1.4 Project 004: what the professional sees and does

- **Access**: only through an active link, resolved by `CareController.withClient`, which writes
  a row into the client's trail before reading (`0059`;
  `packages/core/src/controllers/Care/CareController.ts:678-704`). The client list writes one row
  per client (`CareRepository.roster`).
- **Reads** (`CareClientOverviewView`, `CareController.ts:193-200`): the client's **name**, the
  active plan and its history (dishes), the progress (adherence per fortnight, the weight series
  with dates, the starting and target weight, the goal type, the check-in's answers — hunger,
  difficulty, satisfaction, weight — but **not** the free comment), the targets with their
  derivation (basal metabolism, activity factor, rate) and, **only if the client ticked the
  health line**, conditions, medication and supplements. It does **not** see allergies,
  intolerances, the email, the date of birth or height as fields, although the basal metabolism
  and the dishes allow some of it to be inferred.
- **Writes**: daily targets within the same limits (`PATCH clients/:linkId/targets`), the review
  before publishing (on by default, `care.schema.ts` `reviewBeforePublish`), generating and
  regenerating plans (they count against the client's quota, `0060`), swapping dishes in the
  pending plan and publishing it. It writes no notes and no free text.
- **Consent**: `care_links` stores the version (`CARE_CONSENT_VERSION = '1.0.0'`,
  `packages/core/src/entities/Care/Care.ts:12`), the date and `sharesHealth`. An old version is
  refused (`acceptInvitationSchema`, `Care.ts:61`). `sharesHealth` **is only written on
  accepting** (`packages/core/src/repositories/Care/CareRepository.ts:165`); there is no route to
  change it afterwards.
- **Ending**: either party ends the link; the next request is a 404. If the professional deletes
  their account, their links cascade and their name is left in each client's trail. If the client
  deletes theirs, everything goes, the trail included.
- **Mail**: an invitation with no health words
  (`apps/api/src/modules/email/templates/CareInvitation.ts:37-47`), a check-in notice to the
  professional with the client's name (`CheckInSubmitted.ts:23-27,61`).
- **Onboarding**: the owner grants the role in `/admin` with the registration number; the
  professional receives no mail and no screen, and **accepts nothing** before opening `/consulta`
  (`apps/api/src/shared/guards/Professional.guard.ts`;
  `apps/web/src/app/(app)/consulta/page.tsx`).

---

## 2. Roles per flow

### 2.1 The test

- The **controller** is whoever determines the purposes and means (art. 4.7 GDPR). The
  **processor** is whoever processes "on behalf of the controller" (art. 4.8); it pursues no
  purposes of its own.
- **Joint controllers** are those who "jointly determine the purposes and means" (art. 26.1).
  The EDPB accepts joint controllership through **converging decisions** where "the processing
  would not be possible without both parties' participation in the purposes and means in the
  sense that the processing by each party is inseparable" (Guidelines 07/2020, v2.0, § 55), but
  **excludes** it where two entities exchange data with no common purposes or means — that is a
  transfer between independent controllers (§ 70) — or share a common infrastructure each
  determining its own purposes (§ 71). Having access to the data or not is not decisive (§ 56,
  *Jehovan todistajat*).

### 2.2 Flow by flow

| Flow | NutrIA | The dietitian | Why |
| --- | --- | --- | --- |
| Account, profile, plans, progress, check-ins, any user's health | **Controller** | — | NutrIA decides what for (planning meals) and how (the code, the hosting, the AI). |
| The professional's account: name, email, registration number, subscription | **Controller** | the data subject | A B2B contract (art. 6.1.b) and verifying the qualification (art. 6.1.f). |
| The invitation: the professional types their patient's address | **Controller** of the invitation | **Controller** of having communicated the address | The professional decides to invite; NutrIA decides how it is stored (hashed, 14 days) and what the mail says. NutrIA receives the datum from a third party → art. 14. |
| Accepting the link: NutrIA puts the client's data in front of the professional | **Controller** who **communicates** | **Controller** who **receives** | It is a communication to a third party at the data subject's request and with their consent (arts. 6.1.a and 9.2.a). NutrIA makes it for its own purpose (providing the practice service it sells); the professional uses it for theirs (their dietetic care). |
| What the professional does with what they see: assessing, deciding targets, noting in their clinical record | — | **Independent controller** | Health care by a health professional bound by confidentiality (arts. 9.2.h and 9.3 GDPR; Law 44/2003 art. 2.2.g; LOPDGDD DA 17ª.1, which brings the processing regulated in Laws 41/2002 and 44/2003 under 9.2.h). |
| Targets and plans the professional writes into the client's account | **Controller** of the result | the author of the decision | They are stored in the client's account, NutrIA decides their retention (the account), and the client keeps them when the link ends (`practice.endConfirmBody`). |

### 2.3 Why NutrIA is not the dietitian's processor

To be a processor, NutrIA would have to process the data **on behalf of** the professional and
on their instructions. It does not:

1. **The client was already a NutrIA user before the link**, with their own contract; the
   product does not allow clients with no account (PRD 004, *Out*).
2. **NutrIA decides the retention and the destination**: when the link ends the data stay in the
   client's account and the professional loses access; the professional cannot order them deleted
   or take them away.
3. **NutrIA pursues purposes of its own** with the same data (the B2C service to the client).
4. **Nothing in the system is "the professional's"**: no notes, no clinical record, no export.

This would change — and NutrIA would become a **processor** for that part, with an art. 28
contract — the day the product stores something the professional writes *for their practice*
(clinical notes, a patient page, documents) or lets them export the patient's page. It is written
as a condition in the professional's agreement and in the lawyer's list.

### 2.4 Why it is not joint controllership (and the risk that it is)

The opposite reading exists: the professional *causes* the communication by inviting, and NutrIA
designs how it happens; both benefit (*Fashion ID*, C-40/17). My reading is that there is no
joint controllership because **the purposes are not common**: NutrIA communicates to provide its
service; the professional receives for their care; and each one's processing is separable
(EDPB §§ 70-71). It is exactly the case of an exchange between independent controllers.

Since the characterisation is arguable **[lawyer]**, the professional's agreement
([`textos/01-acuerdo-profesional.md`](./textos/01-acuerdo-profesional.md), clause 4) expressly
allocates the information duties (arts. 13-14) and the rights between the parties and designates
NutrIA as the contact point; that meets art. 26.1-2 if a court found joint controllership, and
gets in nobody's way if it does not.

---

## 3. Legal bases and the art. 9 exception

| Purpose | Data | Art. 6 basis | Art. 9.2 exception |
| --- | --- | --- | --- |
| The account and signing in | name, email, password (hashed), the session (IP, agent) | 6.1.b contract | — |
| Computing targets and generating plans | the body profile, the goal, preferences, allergies, intolerances, way of eating | 6.1.b | **9.2.a explicit consent** — today it **does not exist** for these data (P0-2) |
| Conditions, medication, supplements | all three | 6.1.a | 9.2.a ✔ (it exists) |
| Follow-up: weight, adherence, check-ins | the weight series, ticks, answers | 6.1.b | 9.2.a (covered by the new consent) |
| Sending to the AI to generate | what § 1.3 says (prompt 4.4.0 once `0067` is merged: no identifiers, health, free text or beliefs, and from that version no shape and hours of the day and no budget/cooking frequency) | 6.1.b | With prompt 4.4.0 no art. 9 datum is sent, unless "losing weight" is one on the broad reading **[lawyer]**; if it is, 9.2.a, covered by the profile consent, whose text (`profileConsent.ai`) informs about the sending. And only to a **processor** under contract, with no training and no retention (§ 4.3) |
| Sharing with the dietitian | what § 1.4 says | 6.1.a | 9.2.a ✔ (it exists, with information defects: P1) |
| Health shared with the dietitian | conditions, medication, supplements | 6.1.a | 9.2.a, a separate line ✔ |
| The dietitian's use for their care | what they see | (theirs) 6.1.b/6.1.c | (theirs) 9.2.h |
| Charging for Premium or the practice plan | the customer and subscription ids, status | 6.1.b; 6.1.c for invoicing | — |
| Usage metrics (`analytics_events`) | the event + `userId` | 6.1.f legitimate interest | — (it holds no health) |
| Technical logs and errors (Sentry) | the error, the stack, the route; no body, user or headers (`apps/api/src/shared/observability/ErrorReporter.ts:45-110`) | 6.1.f | — |
| Service mail (verification, reset, reminder, the check-in notice to the professional) | email, name | 6.1.b | — |
| Account security notices ("your password has changed", "somebody tried to create an account with your email"…) | the account's email; nothing of whoever caused it | 6.1.f (recital 49) and 32.1; 6.1.b for the account's person | — (§ 4.1 bis and § 4.1 ter) |
| Brakes against abuse: failed attempts per address, mails per address, requests per IP (011, phases 7 and 8) | an HMAC fingerprint of the address + a count; IP + route + a count | 6.1.f (recital 49) and 32.1 | — (§ 4.1 ter) |
| The suggestions inbox | free text | 6.1.b / 6.1.f | — |

**Why explicit consent and not another exception.** For a consumer service, 9.2.h requires the
processing to be done by a professional bound by confidentiality or to rest on a contract with a
health professional (art. 9.3); NutrIA is neither. No other letter fits. Making the service
conditional on that consent is lawful because the processing **is necessary** for the service:
art. 7.4 forbids making it conditional on data that are *not* necessary (EDPB, Guidelines 05/2020
on consent, §§ 26-36). It must be explicit (a checkbox of its own, not pre-ticked, with the
purposes named), recorded with a date and a version (art. 7.1), and withdrawable, with the user
knowing that withdrawing it stops plans being generated.

**Religion (halal/kosher).** LOPDGDD art. 9.1 says that "the data subject's consent alone shall
not suffice" where the **main purpose** is to identify their religion or beliefs. Here the
purpose is planning meals, so consent suffices; even so, the proportionate thing is not to ask
about religion: offering "no pork", "no alcohol" and "ritually slaughtered meat" as neutral
restrictions instead of "Halal"/"Kosher" (P2).

**Minors.** LOPDGDD art. 7 sets the age to consent at **14**; GDPR art. 8 (16, which a law may
lower) is about consent in information society services. The terms required 16
(`es-ES.ts:1415`; the owner raised it to **18** on 2026-09-25) but **nothing checks it**: the
date of birth is accepted with no minimum (`packages/core/src/entities/Profile/Profile.ts:112`;
`apps/web/src/components/OnboardingFlow/OnboardingFlow.tsx:350-357`). A child under 14 who signs
up gives an invalid health consent and receives a weight-loss plan — and paediatric nutrition is
a "not a user" per `PRODUCT.md`. P1 (P0 if such an account already exists: the owner must check).

---

## 4. Retention and transfers

### 4.1 Retention

| Datum | Period | Status |
| --- | --- | --- |
| Everything in the account | while the account exists; deleted immediately in a cascade | ✔ code |
| Consents (version and date, `health_data_consents`, `care_links`) | while the account exists; they serve to demonstrate the consent (art. 7.1) | ✔ |
| Ended links (`care_links` at `ended`) | while both accounts exist | ✔ (proof of the consent); say so in the policy |
| The access trail | while the client's account exists; it keeps the professional's name even if they delete theirs | ✔; tell the professional (the agreement, cl. 7) |
| Invitations | until answered; otherwise 14 days + a daily sweep (≤ 15) | ✔ (backend `cf87d75`) |
| `analytics_events` | indefinite | P2: set 24 months and purge |
| `plan_generation_jobs` (errors, AI calls with no content) | indefinite | P2: set 12 months |
| Sessions (IP, agent) | 30 days | ✔ |
| `audit_logs`, the `auth.*` rows (`auth.password_changed`, `auth.sessions_revoked`; 011 phase 2) | **12 months**, and on deleting the account the row is left with no person (`actorId` and `subjectUserId` at `NULL`). The other `audit_logs` rows (admin) still have no period. See § 4.1 bis | ✔ code since phase 7 (`AuditController.forgetExpiredAuthRows`, #213, `6b260239`, 2026-10-03), in the same daily cron; **the policy**: the ⟦si purga-seguridad⟧ sentence can be published as soon as the lead confirms #213 is deployed (the checklist's § 0 quater) |
| `sign_in_failure` (the per-address brake, 011 phase 7): an HMAC fingerprint of the address, a count, a window | deleted on signing in with the right password or on resetting it; otherwise the daily sweep deletes it after a day with no attempts (at most some two days from the last one). It is **not** deleted when the account is deleted (it has no FK, on purpose). See § 4.1 ter | ✔ code; **policy: P2-14** |
| The mail budget (011 phase 8): `mail-budget:<fingerprint>` rows in `verification`, a count | it expires within the hour; the daily sweep (08:05 UTC) deletes it: at most some 25 h. It is not deleted with the account either. See § 4.1 ter | ✔ code; **policy: P2-14** |
| The browser that has already signed in (011 phase 7b, `0089`): a `sign_in_device` cookie (256 random bits) in the browser; in `verification`, `sign-in-device:<sha256 of the code>` with the account's id; ten per account at most | 90 days from the last password sign-in from that browser; immediately on changing or resetting the password, on revoking the other sessions or all of them, and on deleting the account; the expired ones, the daily sweep. Failures from that browser go to `sign_in_failure` under a key of their own (an HMAC of the code), with the brake's period. See § 4.1 quater | ✔ code; **policy: ⟦navegador-conocido⟧** |
| Better Auth's `rate_limit`: `ip\|route`, a count, the last request | it stops counting when its window ends (10-60 s) and Better Auth deletes it when the next request opening a window arrives | ✔ code; **policy: P2-14** |
| An account whose address nobody confirmed (`user.emailVerified = false`) | **30 days from sign-up** (`UNCONFIRMED_ACCOUNT_RETENTION_DAYS`), and only if it has no session, no row in `profiles`, none in `meal_plans`, and no `audit_logs` row naming it as actor or subject. The `user` row is deleted and, in a cascade, the `account` one (name, email, the password hash). An `auth.unconfirmed_account_swept` row is left with no actor, no subject, no `entityId`, no IP and empty `metadata`. See § 4.1 quinquies | ✔ code (PR #250, `fbab7b1b`); **policy: ⟦barrido-sin-confirmar⟧**, not yet published |
| Payments (Stripe) | whatever the law requires of Stripe; with *Managed Payments*, of Link as the seller | ✔ policy |
| Backups: Neon's restore | the plan's window (unrecorded in `deployment.md` § 8) | P2: record it and cite it |
| Backups: the manual export | **indefinite, unencrypted**, on the owner's machine | **P1**: encrypt it, a period (30 days) and deletion |
| The ten columns onboarding stopped filling (`0067`; `user_preferences.breakfastStyle/budget/cookingFrequency/portionPreference/sleepEnd/sleepStart/trainingDaysPerWeek/trainingTime/workScheduleNotes`, `goals.customGoal`) | set to `NULL` by migration `0043` for every account, in this same change; the columns and the `'custom'` enum value are dropped in the next delivery | **P2-13**: closed (§ 9) |

### 4.1 bis Account security rows in `audit_logs` (project 011, phase 2; decided 2026-10-01)

*I am not a lawyer; this is analysis for the owner to review with one.*

**What is stored.** `auth.password_changed` (`via`: `change` or `reset`) and `auth.sessions_revoked` (`scope`: `one`, `others`, `all`), with the date and the account's id. No token, no IP, no agent. It is a personal datum (it says something about an identifiable person: when they changed their password) but not a special category (art. 9): it says nothing about health.

**Basis and purpose.** Art. 6.1.f (the legitimate interest in the account's security; recital 49) and art. 32.1: being able to reconstruct, after a possible account takeover, when the password changed and when sessions were revoked, and letting the person themselves see it. The balancing test: the datum is minimal (an action, a date, no IP), the person generates it themselves and it serves them; the reasonable expectation is that a service with accounts records it.

**Period: 12 months** (art. 5.1.e). The reason: the usefulness is for investigating a takeover, which is discovered within weeks or a few months; a password change from years ago helps nobody and increases what improper access to the database would reveal (arts. 5.1.c, 32). 12 months covers a claim or a late discovery without keeping it forever. It is a proportionality choice, not a period fixed by a rule: **to confirm with a lawyer** (I found no specific legal period and I have not verified it in an AEPD guide; art. 5.1.e only requires the chosen one to be justified).

**Does it differ from `audit_logs`'s current period?** Yes. Today no `audit_logs` row is deleted (§ 1, the `audit_logs.actorId` row; there is no purge in `packages/core` or in `apps/api`: checked 2026-10-01 by searching for deletions over `auditLogs`). The admin rows stay as they are: the owner writes them, with no third party's data. The `auth.*` ones do describe the account's person, and that is why they carry a period.

**What the later phase must build.**
1. A daily purge deleting from `audit_logs` the rows with `action LIKE 'auth.%'` and a `createdAt` older than 12 months. `auth.*` only: it does not touch `account.*`, `professional.*`, `picture.*`, etc. It hangs off the same daily invitation sweep, or off a task of its own, with a test that it does not delete an admin row.
2. Phases 3 and 4 add `auth.2fa_*` and `auth.passkey_added`: they come in under the same prefix, with no change to the period.
3. Until the purge exists, `/privacidad` does NOT publish the number (see textos/02, ⟦registro-seguridad⟧); and the go-live checklist records it as a condition of the phase that promises it.

**A condition for the code (backend).** The person goes only in `actorId` and `subjectUserId` (both `ON DELETE SET NULL`, `platform.schema.ts:86`). **`entityId` may not carry the account's id** (it has no FK: it would survive the deletion as an identifier of somebody who no longer exists; that would be pseudonymisation, not anonymity) and `metadata` nothing beyond `via` or `scope`. With that, on deleting the account the remaining row (the action, the date, `via`/`scope`) identifies nobody (recital 26) and what the policy says is true: "when you delete it, everything in it is deleted".

**The "your password has changed" mail.** It is a service message tied to security (art. 6.1.b/f; it is not a commercial communication, LSSI art. 21 does not apply) and it cannot be switched off. It carries the time and the kind of device, with no IP and no health word: the kind of device comes from the agent of the session that is already stored (the policy already says we store the session's browser) and it is not stored anywhere new. If the mail does not repeat the exact time with a zone, let it say when in the person's zone.

**Does `/privacidad` change?** Yes, two sentences (textos/02, ⟦registro-seguridad⟧): (a) in "Qué datos recogemos", the new category, because art. 13.1 requires informing about the categories and the purpose; (b) in "Con quién compartimos", the security notice mail, because the mail provider's current line says "the notices you switch on" and this one is not switched on. It is not an "important" change in the sense of "Cambios en esta política" (there is no new health datum and no new recipient): `updated` is updated, with no mail to anybody. There is no consent version to raise: the health consent does not change.

### 4.1 ter The sign-up that reveals nothing: per-address brakes, a notice to the existing account and mandatory confirmation (project 011, phases 7 and 8; 2026-10-03)

*I am not a lawyer; this is analysis for the owner to review with one.*

**What the code does** (branch `feat/011-p8-signup`, `4f36ec5`, on top of phase 7 already merged in `6b26023`, #213):

1. **Sign-up answers the same for every address** and opens no session (`auth.config.ts`, `autoSignIn: false`, `customSyntheticUser`). If the address already has an account, Better Auth computes the hash of the typed password only to even out the time, stores nothing of what was typed (name, password) and calls `onExistingUserSignUp` (`better-auth/dist/api/routes/sign-up.mjs:200-202`, installed version 1.7.6).
2. **A "Somebody tried to create an account with your email" mail** to the existing account's address, in the background (`ExistingAccountMail.ts`, template `ExistingAccountSignUp.ts`). It carries a button to sign in, the sentence for whoever signed in with Google, the link to set a new password and "if it was not you, you do not have to do anything". No typed name, no time, no device, no IP and no health word. The trace (`console.info`) carries the account's id, not the address; `mail_sent` in `analytics_events` carries only the kind, with no user (`Email.service.ts:118-119`).
3. **Signing in with a password requires a confirmed address** (`requireEmailVerification: true`). The right password on an unconfirmed account gets the same 401 as a wrong one (`UnconfirmedSignIn.ts`), counts in the brake as a failure, and the address receives a new link (`sendOnSignIn: true`), only if it is unconfirmed.
4. **A mail budget per address**: three an hour per kind (`verification`, `existing-account`, `reset`), `core/domain/MailBudget`. The row lives in Better Auth's `verification` table: `identifier = 'mail-budget:' + HMAC-SHA256(BETTER_AUTH_SECRET, 'mail-budget:<kind>:' + the address in lower case)`, `value` = the count, `expiresAt` = the end of the hour. No address and no account id. If the database does not answer, the mail goes out anyway (`mail_budget_unavailable`).
5. **The per-address brake** (phase 7, already in `main`): `sign_in_failure` with the `sign-in-brake:` fingerprint of the address, a count and a window; no address and no FK (`auth.schema.ts:215-229`). It is deleted on a correct sign-in, on resetting the password or, after a day with no attempts, in the daily sweep.
6. **Better Auth's per-IP limit** (predating 011, `auth.config.ts:446-453`, `storage: 'database'`): the `rate_limit` table stores `ip|route` in the clear (`@better-auth/core/dist/utils/ip.mjs:228-230`), a count and the time of the last request; rows past their window are deleted by Better Auth itself when another window opens (`dist/api/rate-limiter/index.mjs:130, 171-180`).

**Are the fingerprints personal data?** Yes, **to NutrIA**. Whoever has the key can recompute the fingerprint of any address they know and find its row: that is pseudonymisation (art. 4.5), not anonymity, and recital 26 says that pseudonymised data "which could be attributed to a natural person by the use of additional information should be considered to be information on an identifiable natural person". The CJEU judgment C-413/23 P (EDPS v SRB) we use for HIBP looks at the **recipient** with no means; here there is no recipient. So they are described as a "fingerprint", never as "anonymous" (the same mistake P1-5 corrected in `analytics_events`). `rate_limit`'s IP is personal data outright (CJEU C-582/14, Breyer). Neither is a special category (art. 9): a count of attempts says nothing about health.

**Data subjects.** Not only users: the brake, the budget and the per-IP limit also reach addresses with no account and anybody pressing the buttons. None of those rows carries what would allow writing to that person (there is no address), and nobody consults them except the code itself; giving art. 14's information to an address with no account is impossible without storing it, and art. 11.1 says the controller is not obliged to maintain additional data to identify the data subject for the sole purpose of complying with the Regulation. It is enough that `/privacidad` explains it (art. 14.5.b, disproportionate effort; and it is the same page read by whoever does have an account).

**Basis.** Art. 6.1.f, with recital 49 ("The processing of personal data to the extent strictly necessary and proportionate for the purposes of ensuring network and information security… constitutes a legitimate interest of the data controller concerned"), and the security duty of art. 32.1. The balancing:
- **The interest**: stopping passwords of accounts with health data being guessed (the DPIA's R8), stopping a stranger filling somebody else's mailbox with our mail, and stopping the form saying who has an account. In a diet product, knowing a person has an account already hints at something about their health or weight: enumeration is a real harm, not a theoretical one (it is the same logic as R10 and M15 for the invitation).
- **Necessity**: per-IP brakes are not enough against many IPs; the brake and the budget need to know "the same address" without storing it, and the fingerprint is the least that allows it (arts. 5.1.c, 25.1).
- **Impact**: a count, with no content, that lives for hours or a couple of days and never leaves the database. The reasonable expectation: any service with a password limits attempts.
- **The result**: the interest prevails, with the notice in `/privacidad` (P2-14). The right to object (art. 21.1) exists, but "compelling legitimate grounds" apply here (the security of the other accounts); and in practice there is no row to look for beyond two days.

**The "somebody tried…" mail** is an account security message, of the same family as "your password has changed" (§ 4.1 bis): basis 6.1.f (recital 49) or, for the account's person, 6.1.b (a secure account is part of the service). **It is not a commercial communication**: the LSSI (BOE, consolidated to 23/01/2025, the annex, letter f) defines one as directed at promoting goods, services or a company's image; this mail promotes nothing ("if it was you, you do not need another: sign in with the one you have"), so art. 21 (the ban on unsolicited advertising) does not apply and it needs no unsubscribe. **Minimisation (art. 5.1.c)**: it says nothing about whoever tried, not even the time, and that is right: the person does not need it to act (all they can do is sign in or reset), and the typed name was chosen by a stranger (it could be an insult or a health datum). **Frequency**: three an hour at most, and in the background. **Art. 13**: we already have the address and the purpose sits inside "account security notices… that cannot be switched off" under "Con quién compartimos" (the mail provider); the example does not have to enumerate every notice. No new sentence is needed for the mail itself.

**What is true in the mail's text.** "No account has been created and nothing about yours has changed": true (point 1; the only new row is the budget's, which is not the account's and does not change it). P3: if the existing account was created by somebody else with this address and was never confirmed, whoever receives the mail reads "you already have one" without knowing which account it is; the way out exists (set a new password with the link in the mail, which revokes the other person's sessions, and sign in with it), but the mail does not say so. The proposal is in § 9, P3.

**Periods (arts. 5.1.e, 13.2.a).** The budget: an hour of life, deleted by the daily sweep (`apps/api/vercel.json`, `5 8 * * *`): at most some 25 h. The brake: up to a day with no attempts plus however long the sweep takes: at most some two days from the last attempt while an attack lasts, which is exactly when it is needed. `rate_limit`: seconds or minutes. **None is deleted when the account is deleted**, and none should be: if deletion deleted the brake's row, deleting and recreating the account would skip it, and the very absence of an FK is what makes it impossible to tell an address with an account from one without. It does not contradict "when you delete it, everything in it is deleted": those rows are not "in the account" (they belong to an address, whether or not the account exists), but the policy must say they exist and that they expire on their own (P2-14).

### 4.1 quater The browser that has already signed in is not braked (project 011, phase 7b, `0089`; 2026-10-09)

*I am not a lawyer; this is analysis for the owner to review with one.*

**What the code does** (PR #242, `3243cc7`). When a password sign-in finishes (with the second factor, if the account has one and asks for it), the browser receives the `sign_in_device` cookie: first-party, `HttpOnly`, `SameSite=Lax`, `Secure` and `__Secure-` in production, with 256 random bits, no address and no id, 90 days renewed on every password sign-in from that browser. The server stores in `verification` the SHA-256 fingerprint of the code and the account's id, ten per account at most. On the next password sign-in, if the cookie belongs to the account that owns the address typed, its failures do not count towards the address's brake (§ 4.1 ter) but towards that browser's own brake, with the same limits (an HMAC key of the code in `sign_in_failure`, with no address and no id); a correct sign-in deletes that key, never the address's. The per-IP limit, the password and the second factor still apply. Changing or resetting the password, revoking the other sessions or all of them (including when the second factor is switched on) and deleting the account delete all of the account's. Passkeys and Google do not set it.

**LSSI art. 22.2: exempt.** It is a "user security" cookie (AEPD, the cookie guide, May 2024, § 1, note 13: "cookies used to detect erroneous and repeated connection attempts"; WP29, WP194, § 3.3: "other similar mechanisms designed to protect the login system from abuses"). It is not a persistent session cookie under WP194 § 3.2 (those are not exempt without a checkbox), because it lets nobody in: with no password and no second factor there is no session, a bad cookie gets the same 429 as none, and a stolen one gives no extra attempts (its browser has its own brake). All it does is stop the wait somebody else caused against the address from punishing whoever has already signed in from that browser: it protects the service the person asked for (getting into their account), and the person, not the site. It has no other use. It is disclosed in `/privacidad` (the guide recommends doing so "at least generically"), with no checkbox and no banner. **[lawyer]** (§ 10, point 14 a).

**The period: 90 days, proportionate.** WP194 expects security cookies to last longer than the session (§ 3.3) and exempts them "for a limited persistent duration" (§ 5); the guide asks for the minimum given the purpose (§ 2.3.b). The cookie only acts when the password has to be typed again, that is, when the session (30 days, renewed with use) has expired: with less than 30 days it would never be there when it is needed; 90 is three session lifetimes, and when it expires the usual ways out remain (waiting at most 15 minutes, a passkey, Google, a reset). **[lawyer]** (§ 10, point 14 b); if he prefers less, 30 or 60 days is one constant (`SIGN_IN_DEVICE.maxAgeSeconds`) and two sentences of the policy.

**GDPR.** The row (the fingerprint + the account's id) is pseudonymised data to NutrIA (art. 4.5, recital 26), not a special category. The basis: art. 6.1.f with recital 49 and art. 32.1, the same as the brake it is part of; § 4.1 ter's balancing holds and here it weighs even more in favour, because the measure benefits the person themselves. The published legitimate-interest paragraph ("protecting the accounts: … the brakes against abuse") already covers it; there is no new purpose (art. 13.3 does not come in). Objection (art. 21.1): deleting the cookie from the browser is enough, and writing to us still works. Minimisation (5.1.c): no address, no IP, no agent; ten per account.

**Deleting the account.** Asked for on 2026-10-09 (P2) and done in the same PR: `deleteUser.beforeDelete` calls `UserController.forgetDevices`, which deletes these rows and the "trust this device" ones (`trustedDevicesOf`), which had the same shape. Unlike the brake's, there is no security reason to leave them: they are deleted by the account's own id and they say nothing about any address; an account id surviving its deletion would be pseudonymisation, not anonymity (§ 4.1 bis's line). It is "best effort" (`.catch`): if it fails, the row expires at 90 days with an id that leads to nobody; an acceptable residual risk. The rows of the browser's own brake carry no account and expire like the brake's.

**Does `/privacidad` change?** Yes: an addition to the brakes bullet (what is stored, for how long, when it is voided) and a sentence under "Cookies", the same day the PR reaches production, because the person does not ask for it and art. 13.1 requires saying so from the collection. **It is not an "important" change**: no health datum, no new recipient or transfer, no new purpose. `privacy.updated` is updated, with no mail; there is no consent or terms version to raise.

**A DPIA?** No: nothing health-related and no new criterion from the AEPD's list. It is one more measure under M13 (fingerprint brakes); the risk it adds was closed by the invariant review: a stolen browser with the cookie has its own brake, with the same limits, and revoking the other sessions voids it.

### 4.1 quinquies The account nobody confirmed is deleted after thirty days (project 011, the sweep follow-up, `0092`; 2026-10-09)

*I am not a lawyer; this is analysis for the owner to review with one.*

**What the code does** (PR #250, commit read `fbab7b1b`, already in `main`). Once a day, inside the cron that already existed (`/api/v1/cron/sweep-verifications`, `apps/api/vercel.json`, `5 8 * * *`), `AuthRetentionService.forget` adds a third step (`apps/api/src/modules/auth/services/AuthRetention.service.ts:32`): `UserController.sweepUnconfirmedAccounts` (`packages/core/src/controllers/User/UserController.ts:432`) computes the cut-off — `now` minus `UNCONFIRMED_ACCOUNT_RETENTION_DAYS = 30` (`packages/core/src/entities/Audit/Audit.ts:70`) — and `UserRepository.deleteStaleUnconfirmed` (`packages/core/src/repositories/User/UserRepository.ts:345`) runs **a single** `DELETE … WHERE … RETURNING` inside a transaction. The `WHERE` is `staleUnconfirmedWhere` (`:181`): `emailVerified = false`, a `createdAt` before the cut-off and four correlated `NOT EXISTS` against the `user` row itself — no session, no row in `profiles`, none in `meal_plans` and **no** `audit_logs` row naming it as `actorId` or as `subjectUserId`. For each id the `RETURNING` gives back, and in the same transaction, an `auth.unconfirmed_account_swept` row is written with `actorId: null`, `metadata: {}` and `subjectUserId` = that id.

**What disappears.** The `user` row (name, email, `emailVerified`) and, through `onDelete: 'cascade'`, the `account` one, which is where the password hash and the sign-up provider live (`packages/database/src/schemas/auth.schema.ts:84-101`). The confirmation link is not a row: Better Auth 1.7.7 signs it as a JWT (`node_modules/better-auth/dist/api/routes/email-verification.mjs:14-20`), so no row with the address is left. What does **not** disappear — and is already published — is the fingerprint of the per-address brake and of the mail budget, which expire on their own (`/privacidad`'s ⟦frenos⟧ bullet; § 4.1 ter), nor Neon's backups (§ 4.1).

**What is left, and why it identifies nobody.** `audit_logs.actorId` and `audit_logs.subjectUserId` are `onDelete: 'set null'`, not `cascade` (`packages/database/src/schemas/platform.schema.ts:106,111`): the row is written naming the account and, the instant the same transaction's `DELETE` runs, that column reads `null`. `AuditRepository.record` writes `entityId: null` when the caller does not give one (`packages/core/src/repositories/Audit/AuditRepository.ts:122`) and never writes `ipHash`. What survives is, literally, "on day X an unconfirmed account was deleted": the action, the date, `entity: 'user'` and empty `metadata`. That is anonymous information in the sense of recital 26's last sentence ("the principles of data protection should therefore not apply to anonymous information, namely information which does not relate to an identified or identifiable natural person"), so the row that is left is no longer personal data and needs no period. It is the same line § 4.1 bis required of the code: the account's id may not end up in `entityId`, which has no foreign key and would survive as a pseudonym for somebody who no longer exists.

**Does it go in the policy's retention section? Yes.** Art. 13.2.a requires informing of "the period for which the personal data will be stored, or if that is not possible, the criteria used to determine that period" (the OJEU text in the BOE, `DOUE-L-2016-80807`). Today `/privacidad` says of the account only "While your account exists", and that has stopped being the full period: for an unconfirmed account the period is shorter and **conditional**. The four conditions are precisely "the criteria", so the paragraph lists them rather than publishing a bare number ([`textos/02`](./textos/02-politica-privacidad.md), ⟦barrido-sin-confirmar⟧, in both languages). It does not fit in the brakes bullet (those are an address's rows, not an account's) or in "Qué datos recogemos" (no new datum is collected).

**Legal basis: none new.** Deleting is processing (art. 4.2 includes erasure), but it is not a new purpose: it is the end of the life of the same purpose the data were collected for (having an account), and what orders it is art. 5.1.e — "kept in a form which permits identification of data subjects for no longer than is necessary for the purposes" — together with art. 5.1.c and, for the data subject, art. 17.1.a ("the personal data are no longer necessary in relation to the purposes for which they were collected"). So **art. 13.3 does not come in** (there is no further purpose to inform about) and there is no art. 6 basis to add to the policy. The audit row, while it names the account — the milliseconds the transaction lasts — rests on art. 6.1.f with art. 5.2 (being able to demonstrate the sweep happened and how often), the same basis and the same purpose as the rest of the trail (`0071`); afterwards it stops being personal data. If a lawyer prefers the policy to cite a basis for the erasure, the one that fits best is art. 6.1.c (a legal obligation of the controller arising from the Regulation itself) — but I do not think it necessary and I would not publish it: **[lawyer]**, § 10 point 15 a.

**The period: thirty days, and why it is proportionate.** No rule sets a period for an unconfirmed account; art. 5.1.e only requires justifying the one chosen (as with § 4.1 bis's twelve months). Thirty days is more than enough for the person who signed up to open their mail (the link expires in an hour, but `sendOnSignIn` sends them a new one on every attempt to sign in, `auth.config.ts:405`), and short enough that an account created by a stranger with somebody else's address does not sit there for months with a password only the stranger knows (the residue `0092` closes). It is counted from `user.createdAt`, not from the last mail sent: somebody who asks for a new link on day 29 is still deleted on day 31 — it is consistent with what the mail says ("thirty days after sign-up") and it takes nothing from them, because signing up again is free and there was nothing inside. **[lawyer]** if the number is to be argued, § 10 point 15 b: it is one constant (`UNCONFIRMED_ACCOUNT_RETENTION_DAYS`) and two sentences of the policy.

**The confirmation mail already promises it, and that is why the policy cannot stay silent.** `apps/api/src/modules/email/templates/VerifyEmail.ts` says, in both languages: "Si no te has registrado, no confirmes nada: ignora este mensaje y, al mes, borramos el correo que nadie confirma junto con su registro." / "…we delete an address nobody confirms, with its sign-up, after thirty days." It is a retention promise made to a specific person at the moment of collection; if the policy only said "while your account exists", the product would say two different things about the same thing and the only written version of the period would live in a mail that cannot be looked up again. That clashes with art. 5.1.a (fairness and transparency) and with art. 13's function. **The two texts agree in substance**; they differ in form: the English says "after thirty days" and the Spanish "al mes", which is not the same (February is 28 days; the code is exactly 30). It is a P3 for `backend`: let the Spanish say "a los treinta días", like the English and like the policy.

**The limit of the promise, which has to be known.** The fourth condition — no `audit_logs` row naming the account — means **an account the owner has opened from the console is never swept**, because opening it writes `account.activated` with `subjectUserId` (`UserController.ts:208`). That is good for the real person waiting to be activated, and it is exactly what stops the sweep taking an account somebody decided to open by hand. But it has the other side: if the owner opens an account whose address nobody has confirmed — and today the console does not stop him — that account stays outside the sweep for good, and the mail's promise stops being true for it. Two consequences, both recorded where they belong: (a) operationally, **the owner only activates confirmed accounts** (the console's `confirmed` filter says which they are), a new box in [`go-live-checklist.md`](./go-live-checklist.md) § 0 septies; (b) in the code, the sweep should also look at `user.activatedAt`, so as not to depend on activation having left a trail — activations before `0071` (project 008, the end of September 2026) left none, so today an account opened then, never confirmed, with no profile, no plan and an already-expired session **does** enter the sweep. It is a P2 sent to `backend` (`UserRepository.ts:181`, add `isNull(user.activatedAt)`); it does not block publishing the text, because the text describes what the code does today.

**Before the first run.** The sweep has no flag: it runs with the deployment, at 08:05 UTC. Its first run deletes at once **every** unconfirmed account older than thirty days with nothing in it, including those of real people who signed up before the mail promised this period and before the policy said it. It is not a data protection harm (deleting is the protective option, and none of their data is lost because there was none), but it is people losing their place in the queue without anybody having told them. The proportionate thing, and what I recommend: the owner looks **read-only** at how many there are before the first run — the checklist's § 0 quinquies box already asked for that count for phase 8 and is still unticked — and, if there are more than a few, writes to them once with a confirmation link (a service message, art. 6.1.b) before letting the cron run. § 0 septies of the checklist.

**LOPDGDD art. 32 (blocking): an open question, not blocking.** Art. 32.1 (LO 3/2018, BOE-A-2018-16673, consolidated to 27/12/2025) says that "the controller shall be obliged to block the data when it rectifies or erases them", and 32.2 defines blocking as identifying and reserving them, preventing their processing except for judges, the public prosecutor and competent authorities during the limitation periods, after which they must be destroyed. Read literally, any erasure — including an automatic one by period — would call for keeping a blocked copy. My reading is that it does not apply here: the provision is designed for erasure arising from the data subject's right or from a rectification, its purpose is to preserve evidence against claims, and here there is nothing that could ground a claim (no payment, no content, no health, no consent to demonstrate), while keeping blocked precisely the row that is deleted for being unnecessary clashes with arts. 5.1.c and 5.1.e; art. 32.5 itself lets the AEPD except blocking where keeping the data, even blocked, would create a high risk. The anonymous audit row also leaves a record that the sweep happened. **[lawyer]**, § 10 point 15 c — and it is worth knowing that **the question is not new**: deleting an account at the person's request ("everything in it is deleted at once") blocks nothing either, so the answer serves both and is no reason to stop this sweep.

**Does `/condiciones` change? No.** The contract is made on pressing "Crear mi plan" (§ 4.1 ter), and what the sweep deletes is an account where the service could never start: unconfirmed, you cannot sign in (`requireEmailVerification: true`, `auth.config.ts:336`), so there is no performance to interrupt, no payment, no content lost, and no withdrawal period at stake (TRLGDCU, RDL 1/2007, consolidated to 28/02/2026). The terms do not promise that an unconfirmed account lasts forever, and changing them would require raising `TERMS_VERSION` and telling everybody (`0071`) to add a sentence that is already, better put, in the mail and in the policy. I recommend not touching them; if the owner wants belt and braces, the sentence would go in "Tu cuenta" and then `TERMS_VERSION` does rise.

**Is it an "important" policy change? No.** The same test as in § 4.1 bis and § 4.1 quater: no new datum, no new recipient, no new transfer, no new purpose — and the period gets shorter, which favours the person. The paragraph is published and `privacy.updated` is updated (today, 9 October 2026, is already the live date: if it goes out today it does not change; another day, that day's date). **No notice mail to anybody**, and **no version to raise**: not `HEALTH_CONSENT_VERSION`, not `CARE_CONSENT_VERSION`, not `PROFESSIONAL_AGREEMENT_VERSION`, not `TERMS_VERSION`. The only urgent thing is not the notice but the order: the text before the first account is deleted.

**A DPIA? No.** No new processing of health data and no new criterion from the AEPD's list (art. 35.4). The sweep is a minimisation measure that **reduces** risk R10 (impersonation by signing up with somebody else's address) and adds none: what it deletes cannot be recovered to harm anybody, and what it leaves identifies nobody. [`dpia.md`](./dpia.md) does not need reviewing; it will be noted at its next ordinary review as an M13 measure.

### 4.2 International transfers (arts. 44-49)

| Recipient | Role | Where | The guarantee to check |
| --- | --- | --- | --- |
| Vercel (hosting; functions in `fra1`) | processor | the EU for compute; a US company | Vercel's DPA + the EU-US Data Privacy Framework (DPF) or standard clauses |
| Neon (the database, `eu-central-1`, `docs/reference/deployment.md:100-106`) | processor | the EU; a US company | A DPA + the DPF: Neon, LLC is a covered entity of Databricks, Inc.'s certification (the DPF list, EU-US active, consulted 2026-09-26) |
| **OpenRouter, Inc.** (New York), after `0064`'s change | **processor** (it routes and charges; it does not store the content with logging off); a controller only for its anonymous categorisation (§ 4.3) | the US (Google Cloud, US regions, per annex 2 of its Enterprise DPA) | It is **not** in the DPF (consulted 2026-09-26: 0 results). Art. 46 standard clauses (its privacy policy, 31/08/2026; Enterprise DPA § 13.2, module 2), in the DPA its terms § 10.2 incorporate for commercial use — **the text is still to be obtained** (P1-11) |
| The company that runs the model (proposed: DeepInfra, CoreWeave) | per OpenRouter **they are not sub-processors** (Enterprise DPA § 11.10); functionally they process on NutrIA's behalf (§ 4.3) | the US (headquarters and data centres); today the account also allows Indonesia and companies with no published headquarters (P1-12) | None in the DPF (consulted 2026-09-26). Their commitments (zero retention, no training; CoreWeave with standard clauses) are with OpenRouter, not with NutrIA. The request carries nothing identifying (C-413/23 P) — P2-11 |
| The OmniRoute gateway (the owner's server) | a means of our own | wherever it is hosted | **Out of production** since `0064`; experiments only |
| The gateway's providers until 2026-09-26 (`opencode/*-free`, OpenRouter `:free`, free Gemini) | third parties that trained or whose terms forbade this use | the US | None. **They receive nothing any more** (`stub` since 2026-09-26) |
| Google (SMTP mail) | processor | the EU/US | Google Workspace/Gmail terms. **[lawyer]**: a consumer Gmail account offers no DPA; a transactional provider with a DPA is better |
| Stripe / Link | processor for charging; the **seller** with *Managed Payments* | the EU (Stripe Technology Europe) and the US | Stripe's DPA; Stripe, LLC in the DPF (active, 2026-09-26); with *Managed Payments*, Link is the controller of its own sale |
| Sentry (if `SENTRY_DSN`) | processor | the US or the EU depending on the region chosen | A DPA; Sentry.io in the DPF (active, 2026-09-26); choose the EU region; it receives no personal data by design |
| Browser push services (Google, Apple, Mozilla) | end-to-end encrypted transmission (VAPID) | the US | the content travels encrypted; informing is enough |

The current policy says nothing about transfers (art. 13.1.f) — P1.

### 4.3 The AI, specifically

Sending health or religion data to a model requires, all at once:

1. that the provider be a **processor** (art. 28): a contract forbidding use of the data for
   its own purposes, **with no training and no human review**, with zero or minimal retention;
2. a transfer guarantee (the DPF or standard clauses);
3. that the policy say so.

A "free" model that trains on prompts **is not a processor**: it uses the data for its own
purposes, so it is a **third-party controller** to whom health data are *disclosed* with no
basis. The EDPB and the CJEU (C-413/23 P, *EDPB v. SRB*, 4/9/2025) accept that pseudonymised
data may not be personal **for a recipient** who cannot re-identify; here the free text of
allergies ("allergic to kiwi and latex") and the check-in comment can identify somebody when
combined with other data, and I would not bet the product on that reading **[lawyer]**.

The cheapest way out and the cleanest are the same one: **send no free text written by the
data subject to any model that trains**, and send the way of eating as an ingredient
restriction, not as a religious label. See P0-3.

### 4.4 OpenRouter and whoever runs the model (2026-09-26, for `0064`'s change)

The three conditions of § 4.3, one by one, against what the providers themselves say today
(pages read on 2026-09-26; each one's date in brackets).

**a) OpenRouter is a processor, under a contract still to be held in hand.**

- **What it does**: it receives NutrIA's server's request, picks the company that runs the
  model and charges. "OpenRouter does not store your prompts or responses, *unless* you opt
  in" (the documentation, *Data collection*); it keeps metadata: tokens, latency, cost. With
  prompt logging off it does not keep the content. For that it acts on NutrIA's behalf:
  **processor** (art. 4.8).
- **The contract**: its terms (last updated 31/08/2026), § 10.2: "If you are part of and
  represent an organization in entering into these Terms or use the Service for commercial,
  for-profit purposes, please read the OpenRouter Data Processing Agreement ("DPA")… The DPA
  is incorporated by reference into, and made a part of, these Terms". NutrIA is an economic
  activity (§ 6): it applies to it. **But** the text of that DPA is not public (it is
  requested at `trust.openrouter.ai`) and OpenRouter's help centre says the signed DPA is for
  Enterprise customers and that everybody else can only read it (I could not open the
  article, which is behind an anti-bot protection; I cite it from the search engine's summary
  and from report `0002`, P14). The Enterprise DPA *is* public (annex A of the *Enterprise
  Access Agreement*, 22/06/2026): standard clauses, module 2 (§ 13.2); breach notice "without
  undue delay, and in any case, within seventy-two (72) hours" (§ 7); 30 days' notice and a
  right to object to new sub-processors (§ 5.2-5.3); erasure within 30 business days on
  request (annex 2).
- **My reading**: the terms are the contract and they say the DPA is part of it; a help
  article does not repeal that. But art. 28.3 requires a contract "in writing" with a minimum
  content, and the controller has to be able to demonstrate it (arts. 5.2 and 24): a DPA
  whose text he does not have is no use to him. **→ P1-11, blocks the change** until the text
  is in hand and OpenRouter confirms it applies to his account **[lawyer]**.
- **Transfer**: OpenRouter, Inc. (169 Madison Avenue, New York) is **not in the DPF** (the
  official list, 2026-09-26). Its privacy policy (31/08/2026) relies on "standard contractual
  clauses approved by the European Commission under Article 46 of the GDPR" and says the data
  go "to our servers in the US". Routing inside the EU exists for Enterprise only.

**b) Whoever runs the model: not a sub-processor per OpenRouter; it has to be named and
chosen.**

- Enterprise DPA § 11.10: "AI Model Providers, acting in their capacity as third party model
  providers, are not subcontractors of OpenRouter"; and § 2.2.3 lets the customer steer clear
  of the ones that train "or select 'Zero Data Retention'". The terms, § 5.1: the customer
  accepts each model's terms and "You are solely responsible for reviewing the Model Terms".
- **Functionally** those companies process the request on NutrIA's behalf and for its
  purpose, with no purposes of their own (ZDR, no training): they are what the EDPB would
  call sub-processors (Guidelines 07/2020, v2.0: the qualification is functional, not
  whatever the contract calls it). Art. 28.4 requires the sub-processor to be bound by
  contract to the same obligations; OpenRouter does not take on that chain. Their commitments
  are with OpenRouter, not with NutrIA:
  - **DeepInfra** (terms, 17/08/2026): "Provider will not use Customer Data to train,
    fine-tune, or otherwise improve any model… Provider will not retain, store, or log any
    Customer Data submitted to or generated by the Services beyond the period strictly
    necessary to process and return the applicable request"; privacy policy (15/08/2026):
    "processed outside of your jurisdiction, specifically in the United States". It serves
    both models under ZDR.
  - **CoreWeave** (privacy policy, 24/02/2026): "Customers are controllers of Customer Data";
    its DPA, incorporated into its terms, with controller-processor and processor-processor
    standard clauses. Data centres in the US. It serves both models under ZDR (Gemma 4 31B in
    fp4).
  - **Together** (policy, 17/12/2025): ZDR in the settings, and standard clauses; **but** its
    terms § 4 forbid "transmit or provide to the Company any financial or medical information
    of any nature or any sensitive personal data (e.g., … birth dates…)". NutrIA sends none
    of that, but a service with plans for a dietitian's patients is bad company for that
    clause (P3).
  - None is in the DPF (2026-09-26).
- **Why the risk is nevertheless low** **[lawyer]**: the request carries nothing that
  identifies a person — no id, no IP of theirs (the connection is OpenRouter's), no name,
  age, weight or free text. The CJEU (C-413/23 P, *EDPB v. SRB*, 4/9/2025) accepts that a
  pseudonymised datum may not be personal for a recipient with no reasonable means of
  re-identifying, even while it stays personal for whoever sends it; and it says the duty to
  inform of the recipient is to be assessed **from the controller's position and at the time
  of collection**. That is why the policy has to **name** those companies and their country
  (art. 13.1.e-f) — P2-11 for the rest.
- **What cannot be justified is not knowing who they are.** With the account as it stands,
  the request can go to 22 companies (§ 1.3), one with its headquarters and data centre in
  Indonesia — with no adequacy decision — and another with no published terms. The policy
  cannot name them or state their guarantee. **→ P1-12, blocks the change**: a closed list of
  providers in the account (privacy settings, *Allowed providers*, which is the ceiling of
  every request per the *provider routing* documentation). Proposal: `deepinfra` and
  `coreweave` — both serve both models under ZDR with structured output, both have their
  headquarters and data centres in the US, and both make the commitments cited. **Done on
  2026-09-26**: the owner fixed it in the account and the code requires it on every request
  (`AI_PROVIDER_ONLY`).

**c) OpenRouter's own use: a sample, with no account, for its statistics.**

- Terms § 6.5: "OpenRouter uses a hosted model for categorizing Inputs, which does not store
  or log any Inputs provided to it… you grant… license… to use… your Inputs in anonymized
  form, solely for tracking and sharing user metrics on the Site". The documentation:
  "samples a small number of prompts for categorization… If you are not opted in to
  OpenRouter use of inputs/outputs, any categorization of your prompts is stored completely
  anonymously and never associated with your account or user ID". The model that classifies
  runs on Google Cloud (the sub-processor list, "NLP Categorization"). The public
  documentation offers no way to switch it off.
- It is not training and it does not retain the text, but it *is* **a use of its own** of a
  sample: the draft's sentence "without using them to train or for anything of their own"
  (variant A of [`textos/02`](./textos/02-politica-privacidad.md)) **would be false**.
  Processing a datum in order to anonymise it is processing it (WP29, Opinion 05/2014 on
  anonymisation); for that OpenRouter decides the purpose and is a **controller**
  (art. 28.10) **[lawyer]**. → P2-12: the policy says so; the owner decides whether it fits
  his rule ("I don't want to train any model": it does not train). **Decided on 2026-09-26**:
  the owner accepts it with a notice in the policy (state 2) and will ask OpenRouter in
  writing to exclude his account. If OpenRouter excludes it, the text stays true ("may") and
  can be removed.

**d) The models' licences** (OpenRouter's terms § 5.1: they are accepted).

- **DeepSeek V4.1 Flash**: MIT licence (`huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash`,
  modified 10/09/2026). No use restrictions.
- **Gemma 4 31B** (the main one since 2026-09-26): **Apache 2.0**. The model card
  (`huggingface.co/google/gemma-4-31B-it`, `license: apache-2.0`, modified 20/07/2026) links
  to `ai.google.dev/gemma/docs/gemma_4_license`, which is the Apache 2.0 Licence. The *Gemma
  Terms of Use* (last modified 01/04/2026) **expressly exclude Gemma 4**: "The terms below
  apply to Gemma models listed in the Appendix… For Gemma 4 terms, see the Gemma 4 license".
  Consequences:
  - **Commercial use**: allowed, with no notice and no authorisation.
  - **Attribution / NOTICE**: Apache 2.0 (§ 4) binds only whoever **redistributes** the work
    or derivatives (a copy of the licence, copyright notices, marking changed files). NutrIA
    does not distribute the weights: it calls an API where a third party runs them. There is
    no attribution duty. Naming the model in the policy is transparency, not an obligation.
  - **Passing restrictions on to users**: the duty to include the use restrictions in
    agreements with third parties comes from the *Gemma Terms of Use* (§ 3.1), which do not
    apply to Gemma 4. Nothing has to be passed on.
  - **Health use**: the *Gemma Prohibited Use Policy* (last modified 21/02/2024) is
    incorporated only by the *Gemma Terms of Use* (§ 3.2), so, on my reading, it does not
    bind with Gemma 4 **[lawyer]**. Even if it did, NutrIA does not fall within it: it
    forbids "the unauthorized or unlicensed practice of any profession including…
    medical/health", "misleading claims of expertise… in sensitive areas (e.g. health…)" and
    "making automated decisions in domains that affect material or individual rights or
    well-being (e.g.… healthcare…)". NutrIA does not practise a health profession, it says it
    is not a medical service (the policy and the terms), and the AI decides nothing about the
    person: the calorie and protein limits are fixed rules (§ 7). In `/consulta` the
    registered dietitian decides.
  - **Conclusion: Gemma's licence blocks nothing.** P1-13 is **closed** (MiniMax out).
- **Clinical use**: neither the MIT licence nor Apache 2.0 forbids it; OpenRouter only
  disclaims any warranty of fitness for medical uses (§ 16), it does not forbid them;
  DeepInfra forbids "High-Risk Use" (life support or other medical devices whose failure
  causes death), which NutrIA is not (§ 7). P1-10's clinical clause belongs to the **Gemini
  API**'s terms, not to Gemma's: Gemma 4 run by DeepInfra or CoreWeave does not go through
  Google. **P1-10 closes with the change**, provided the Gemini API does not come back
  (`AI_PROVIDER=google`, or a `google/gemini-*` model in the key).

**e) Nothing is used for training or kept — how far the guarantee reaches.** Three layers:
the account (training off, ZDR, use of inputs/outputs off), the key (allowed models, ZDR) and
the request (`zdr`, `data_collection: 'deny'`). ZDR and the account's allowed providers are
the ceiling: a request may demand more, never less. Two caveats the ZDR documentation admits:
"in-memory caching of prompts is *not* considered 'retaining' data", and each provider's ZDR
classification is OpenRouter's, based on what each of them publishes ("If OpenRouter is not
able to establish… a clear policy… we take a conservative stance and assume that the endpoint
both retains and trains on data"). With DeepInfra there is a contractual clause as well (with
OpenRouter).

**What the policy says in each state** — see [`textos/02`](./textos/02-politica-privacidad.md),
"La inteligencia artificial": state 1 (now, `stub`: no model at all) and state 2 (OpenRouter,
publishable once P1-11 and P1-12 are done, and before the change).

---

## 5. DPIA and DPO

### 5.1 DPIA — **mandatory**

The AEPD requires a DPIA "in most cases" where **two or more** criteria from its list are met
(art. 35.4). NutrIA meets four:

- **1** — profiling or evaluation of habits (eating habits, adherence, weight);
- **4** — special categories under art. 9.1 (health; religion);
- **8** — combining data across different controllers (the link with the dietitian);
- **10** — new technologies (generative AI).

Art. 28.2.c LOPDGDD adds the "not merely incidental" processing of special categories as a
higher-risk case. The exemption in list 35.5 for individual health professionals (point 4)
protects the **dietitian**, not NutrIA. The DPIA is in [`dpia.md`](./dpia.md) and must exist
**before** the `professional` flag is switched on (art. 35.1: "prior to the processing"); for
what is already in production, as soon as possible.

### 5.2 DPO — **not mandatory today**

- Art. 37.1.c GDPR: only if the core activity is processing special categories **on a large
  scale**. With dozens of accounts and a single controller who is a natural person, there is
  no large scale (the WP29 criteria, WP243: number of data subjects, volume, duration,
  geographical extent).
- Art. 34.1 LOPDGDD: NutrIA is not a "health centre legally obliged to maintain clinical
  records" (point l); nor does it build profiles "on a large scale" (point d). The individual
  dietitian is expressly excepted in point l.
- **Review** once past a few thousand accounts with health data, or if NutrIA starts holding
  clinical records. A voluntary DPO is possible (art. 34.2) and is notified to the AEPD
  within ten days (art. 34.3).

---

## 6. The owner as a natural person

- **It is an economic activity.** Selling subscriptions (B2C) and practice plans (B2B) on a
  regular basis is carrying on an economic activity. Obligations that are **not done** and
  that an accountant must confirm **[lawyer/accountant]**:
  - **tax registration** with the tax authority (the census declaration, form 036) before the
    first sale;
  - **RETA** (self-employed social security): registration is mandatory if the activity is
    habitual; the habitualness test and the bases on real earnings (since 2023) are the
    accountant's call;
  - **personal income tax (IRPF)**: economic-activity income, instalment payments;
  - **VAT**: without *Managed Payments*, the consumer's country's VAT under the one-stop-shop
    scheme (OSS) above €10,000 a year of intra-EU sales to consumers, and Spanish VAT below
    that; with *Managed Payments*, Link is the seller and settles the VAT, and the owner
    invoices Stripe (**[accountant]**: how that is documented).
- **LSSI art. 10.1**: the legal notice must give "name…; residence or domicile…; e-mail
  address" and, point e, "the tax identification number". Today there is a name and an
  address (`es-ES.ts:1105,1394`), **neither a domicile nor a tax number** — P1. The
  repository is public: the domicile and the tax number would go in `legalIdentity.ts`, which
  is published. If the owner does not want to publish his home, he can use a professional or
  a registered-office address **[lawyer]**.
- **TRLGDCU art. 97.1.c** (before the consumer is bound): "the full address of the trader's
  establishment, telephone number and e-mail address". Missing: a **telephone** and an
  address — P1 before the *live* keys.
- **What changes on registering**: the legal notice, the policy ("a natural person — not a
  company or a registered self-employed trader", `es-ES.ts:1105`, must go: it is unnecessary
  and
  puts in writing the opposite of what will have to be done), the invoicing and the VAT.
- **Liability**: as a natural person he answers with everything he owns. Civil liability
  insurance covering cyber risk and data is reasonable before the flag **[lawyer]**.

---

## 7. The AI Act (Regulation 2024/1689, amended by 2026/1744)

- **What NutrIA is**: a **provider** of an AI system (it puts it into service under its own
  name) that integrates third-party general-purpose models. It is not high-risk: meal
  planning is not in annex III and the product is not a medical device (see below).
- **Art. 4, AI literacy** (applicable since 2/2/2025; with the Omnibus, "shall take measures
  to support the promotion of literacy"): the owner, and whoever operates the system on his
  behalf. For the professional, the agreement explains what the AI does and what it does not
  (cl. 5).
- **Integrated models** (after `0064`'s change): Gemma 4 31B and, as a fallback, DeepSeek
  V4.1 Flash, both open-weight, through OpenRouter's API. The general-purpose model
  obligations (chapter V) belong to their providers; NutrIA's share is informing (art. 50)
  and literacy (art. 4). Changing model does not change this, but it does change the policy
  (§ 4.4).
- **Art. 50.1** (direct interaction with people): there is no conversational assistant in the
  code (the `ai_conversations`/`ai_messages` tables exist; nothing uses them). If one is
  built, it will have to say it is an AI.
- **Art. 50.2** (synthetic content marked "in a machine-readable format"): recipes (text) and
  illustrations (images, Gemini). Applicable from 2/8/2026, but Regulation 2026/1744 gives
  systems placed on the market **before** 2/8/2026 until **2/12/2026**. The exception —
  "standard editing assistance function" — does not fit. Action: mark it in the API's response
  and in the recipes' HTML (`source: 'ai'` already exists in `recipes.source`; expose it as a
  machine-readable metadatum) and rely on the provider's watermark for the images (SynthID at
  Google) **[lawyer]** on whether the metadatum is enough. P2 with a date.
  **Review 2026-09-27 — the dish pictures (project 006)**: the 2/12/2026 deadline (art. 111.3,
  added by 2026/1744) does **not** cover the pictures, which are put into service when their
  flag is switched on, after 2/8/2026: arts. 50.2, 50.4 and 50.5 from day one. A realistic
  photo of a dish is, in all likelihood, a deepfake (art. 3.60; Guidelines C(2026) 5054,
  points 113-116) **[lawyer]**: a visible notice everywhere it is seen, the console's card
  included. Gemini brings C2PA signed by Google and SynthID (measured: they arrive through
  OpenRouter and are served untouched); MAI-Image-2.6 brought no documented mark and the owner
  removed it. All of it in [`dish-pictures.md`](./dish-pictures.md).
- **Transparency to the user**: the terms already say it (§ "Contenido generado con
  inteligencia artificial"); the policy must say what data the model sees and that it decides
  nothing with legal effects (art. 22 GDPR: there are no automated decisions with legal or
  similar effects; the calorie limits are deterministic rules, not the AI's decisions).
- **Medical device** (Regulation 2017/745): software is one if its **intended purpose** is to
  diagnose, prevent, treat or alleviate a disease. NutrIA declares that it is not (the terms
  and the footer), it derives no rules from diseases except coeliac disease → gluten (`0008`)
  and it prescribes no doses. As long as the advertising and the texts do not promise to treat
  diseases, it is not a medical device **[lawyer]**, and the practice does not change that: the
  professional treats, the tool plans.

---

## 8. Accessibility

- **Act 11/2023** (transposing Directive 2019/882): "electronic commerce services" to
  consumers are within its scope, but "microenterprises providing services shall be exempt
  from complying with the accessibility requirements" (art. 3.3). A microenterprise: fewer
  than 10 people and turnover or balance sheet ≤ €2M (art. 2). NutrIA **is exempt** while it
  is one.
- It is still required that the pre-contractual information be given "with particular
  attention to vulnerable consumers… in suitable, accessible and comprehensible formats"
  (art. 97.1 TRLGDCU). The product is already designed to WCAG by its own choice (`0041`,
  `0057`) — that more than covers what is required today.

---

## 9. Risks, ordered by what can happen to a real person

Severity per the agent's definition: **P0** health data with no basis, sharing with somebody
not named, a false text; **P1** a required notice, right or clause is missing; **P2** what a
regulator would ask; **P3** wording.

### P0

**P0-1 · The invitation promises a control that does not exist** (project 004, blocks the
flag). `apps/web/src/i18n/dictionaries/es-ES.ts:251` and `en-GB.ts:247`
(`care.healthShareNote`): "Puedes dejarlo sin marcar y decidirlo más adelante desde tu
perfil". `sharesHealth` is only written on acceptance (`CareRepository.ts:165`) and no
endpoint changes it. On top of that, a client who ticked the line cannot withdraw **that one
alone** without ending the whole link: art. 7.3 GDPR requires withdrawal to be "as easy as"
giving it. Consent given on a false promise is not informed (art. 4.11). **Fix**: build
`PATCH /care/links/me` with `{ sharesHealth }` (the client can switch it on and off; every
change leaves a row in the trail, and switching it off closes the access on the next request)
and a switch in `CareLinkCard`; and change the text
([`textos/05`](./textos/05-consentimientos-cliente.md) § B). Raises `CARE_CONSENT_VERSION`.

**P0-2 · Health and religion data processed with no art. 9 exception** (in production).
Allergies, intolerances, free-text allergies, weight/height/goal, and the way of eating
(`gluten_free`, `lactose_free`, `halal`, `kosher`) are collected in onboarding with no
explicit consent, and the policy rests them on the contract alone
(`es-ES.ts:1113,1125`). **Fix**: an explicit consent checkbox at onboarding's allergies step,
versioned and stored (proposal: extend `health_data_consents` with a second scope, or a new
constant `PROFILE_HEALTH_CONSENT_VERSION = '1.0.0'` in
`packages/core/src/entities/Health`), asked of existing accounts too on their next sign-in,
without which no plan is generated (the text in
[`textos/05`](./textos/05-consentimientos-cliente.md) § A). Withdrawing = deleting those data
and stopping generation, just as health already does.

**P0-3 · Health and religion data sent to models that train on them** (in production, if the
combination in `ai-gateway.md` § 1 is still live).
`apps/api/src/modules/ai/prompts/PoolPrompt.ts:622` (the way of eating, with halal/kosher),
`:628` (free-text allergies), `:268` (the check-in comment) reach `opencode/*-free` (the US;
"data may be used to improve the model"; Meta "trains future models") and Gemini. The policy
says the provider "solo recibe tus objetivos, tus preferencias y tus alergias"
(`es-ES.ts:1131`), without saying it may reuse them or that they are in the US. **Fix**,
either of the two, and better both: (a) configure the combination with paid providers only, or
with a DPA with no training and zero retention, with a transfer guarantee; (b) stop sending
free text written by the data subject (unresolved allergies → drop the candidate ingredients
or refuse to generate, the way a dish with unresolved ingredients is already refused; the
check-in comment → use only the closed answers) and translate the way of eating into
ingredient exclusions. Then, the policy (§ "Con quién compartimos").

**P0-3's status at 2026-10-13 — a dish request reopens the fence, not the harm.** The owner
asked (report `0011` § 4 a) whether somebody may type a dish name — *"tortilla de patata"* —
and have the model write it. Nothing is built; this is the answer before it is.

P0-3 had two prongs: **free text written by the data subject** × **providers that train or
log**. The second prong is dead (`0064`: ZDR, `data_collection: 'deny'`, a closed provider
list on the account and on every request, § 4.4). The first prong was never about typing as
such: the three fields it named — free-text allergies (`PoolPrompt.ts:628`), the way of
eating with halal/kosher (`:622`) and the check-in comment (`:268`) — are health, religion
or a sentence about how a person felt. **"Tortilla de patata" is none of those.** So a dish
name does not reopen the *harm* P0-3 named. It reopens P0-3's **fence**: the published
sentence that closed it, and the test that holds it (`health-boundary.spec.ts`, "gives the
prompt no field a typed text could live in"). Shipping the field without changing the text is
a false published text — **P0 by this document's own scale** — not because of what is sent
but because of what is promised.

What makes a typed dish name different from the other data in the prompt is that it is an
**open channel**: a field somebody can put anything into, including something about
themselves, by accident or on purpose. The exposure is not mainly the model call. Measured in
the code at `c38d316d`:

- **The library is shared.** `recipes` is global — "Recipes are shared, not user-owned"
  (`packages/database/src/schemas/recipe.schema.ts:13-17`) — `RecipeController.reusablePool`
  serves it to every account filtered only by safety and locale
  (`packages/core/src/controllers/Recipe/RecipeController.ts:953-982`), and `createdBy` is
  provenance with `onDelete: 'set null'` (`recipe.schema.ts:23`), written as the requesting
  user (`packages/core/src/repositories/Plan/PlanRepository.ts:1743`). A dish born from a
  typed request therefore puts person-derived text **in front of every other user, for ever,
  surviving the deletion of the account that asked for it**. If the typed string ever becomes
  the stored name, this is art. 9 data disclosed to recipients the policy cannot name
  (arts. 5.1.a, 9, 13.1.e) and an art. 17 erasure the product cannot honour — the P0 "sharing
  it with someone not named". It is a far larger exposure than the transfer to a ZDR provider.
- **The picture path reaches Google.** `buildPicturePrompt` embeds the recipe's name verbatim
  (`packages/core/src/domain/DishPicture/prompt.test.ts:24`) and the request goes OpenRouter →
  **Google (Vertex AI)** plus the DeepInfra vision judge. `/privacidad` says that model
  "nunca recibe nada tuyo" and that the dish path "nunca pasa por los servicios de Google".
  A typed-derived name flowing there breaks a **second** published promise, to a recipient
  family the plan path does not have.
- **Logs.** `/privacidad` also says "Los registros del servidor y de errores no guardan lo que
  escribes" (§ "Cómo protegemos tus datos"). A typed string in a job row, an error or a
  prompt dump breaks that sentence too.

**The conditions under which P0-3 stays closed.** All five, in the same change as the field:

1. **Providers unchanged**: OpenRouter → DeepInfra/CoreWeave, ZDR, no training, `provider.only`
   (§ 4.4; P1-11 still open — the DPA text is not in hand, and that already blocks
   `AI_PROVIDER=openrouter` whatever this feature does).
2. **The typed string is transient.** It is a prompt input and nothing else: never written to
   any table, job row, log, error, analytics event or mail; never read back; never shown to
   anybody. What is stored is the model's output, exactly as today.
3. **The typed string never reaches the picture path.** The stored recipe name is written by
   the model and gated, so what goes to Google (Vertex) is the library's name, as it is today
   for every generated dish.
4. **An output gate on the stored name**, because the residual risk is the model echoing the
   request into the name it writes: a name that carries anything beyond a dish is not stored.
   Without this, condition 2 is cosmetic — the words come back out through the name.
5. **A notice at the field**, which is also the art. 13 information at the moment of
   collection: that it is sent to the model, and that only a dish name belongs there.

With 1–5 the sentence that changes narrows honestly and nothing widens for anybody who does
not use the field. Without any one of them this is not a wording question.

**What must change in the same pull request**, and only then (until the feature exists, § 1.3
and § 4.4 describe the product truthfully and must not be edited to describe a plan): § 1.3's
inventory of what reaches the AI; § 4.4 c — the anonymous categorisation sample of OpenRouter's
terms § 6.5 is described in `/privacidad` as "sin nada que las ligue … a ti", which rests today
on a request carrying no free text, so with the field the caveat is that a *sampled* request may
carry a string the person wrote, anonymous for OpenRouter but no longer guaranteed
identifier-free in content **[lawyer]**; `record-of-processing.md` row 2 (the "Only this goes to
the AI" list, and the claim that Google and DeepInfra are not recipients of the pictures, which
holds only under condition 3); the texts and the version bump in
[`textos/05`](./textos/05-consentimientos-cliente.md) § A; the DPIA's R16; and
[`go-live-checklist.md`](./go-live-checklist.md) § 0 octies.

**P0-3's status at 2026-09-26 — fully closed in production; conditional for the change.**
Since 2026-09-26 production calls no model at all (`AI_PROVIDER=stub`), so nothing goes out.
Way out (a) is `0064`: OpenRouter with paid models, ZDR and no training. It is closed once
P1-11 and P1-12 are met (§ 4.4); until then the change must not be made. A correction: free
Gemini, for an owner in the EEA, did not train; the problem was that its terms forbid using it
to serve EEA users (§ 1.3).

**P0-3's status at 2026-09-25 — closed in substance** with `agent/legal-a/backend` at
`e28f0e5` (unmerged): the model no longer receives text written by the person, allergies,
intolerances or ways of eating other than "vegetarian" and "vegan"; halal, kosher,
gluten-free and lactose-free are applied by removing foods in code. What still reaches free
models that may train: the daily targets and the kind of goal (losing weight, say), the
schedule, likes by catalogue name, dish names and the check-in's closed answers, with no
identifiers. **Residual P2 [lawyer]**: whether those data, with no identifiers, are personal
for the provider (C-413/23 P) and whether the goal "lose weight" is a health datum; and
whether veganism can be a philosophical conviction (art. 9.1). Way out (a) — providers under
contract and with no training — is still the one that closes everything.

### P1

| # | Finding | Where | What the law requires | Minimum fix |
| --- | --- | --- | --- | --- |
| P1-1 | No professional accepts anything before opening `/consulta` (LEGAL-REVIEW § B3) | `apps/api/src/shared/guards/Professional.guard.ts:43-60`; `apps/web/src/app/(app)/consulta/page.tsx:48-60` | Arts. 24, 26 and 32 GDPR; professional secrecy (Act 44/2003 art. 5.1.c; the Code of Ethics arts. 22, 29) | An acceptance screen, with a version, stored (§ 11) |
| P1-2 | The invitation mail does not give the art. 14 information to somebody who is not a user | `apps/api/src/modules/email/templates/CareInvitation.ts:37-47` | Art. 14.1-2 and 14.3.b GDPR (at the first contact) | A paragraph of basic information ([`textos/06`](./textos/06-correos.md) § A) |
| P1-3 | The invitation page does not say the professional will **write**: goals, generating and **retaining** plans to review them; "tu perfil" does not say what that is | `care.shares.*`, `care.invitationShareIntro` (`es-ES.ts:225-265`); `CareInvitation.tsx` | Arts. 4.11 and 7 (informed, specific); art. 13.1.c-e | New text, a link to the policy; **raises `CARE_CONSENT_VERSION` to `2.0.0`** |
| P1-4 | There is no age gate | `Profile.ts:112`; `OnboardingFlow.tsx:350-357` | Art. 7 LOPDGDD; art. 8 GDPR; consistency with the terms | Refuse in `profileSchema` (on the server) anybody under **18** (the owner's decision, 2026-09-25; 16 was proposed before), with a text that blames nobody |
| P1-5 | The policy covers no transfers, no periods per category, no portability, no restriction, not 004's practice and not the AI with any precision; it says "anonymous technical use" and it is tied to `userId`; it promises the copy "is deleted automatically" and the manual export is not | `es-ES.ts:1096-1181` | Arts. 13.1.e-f, 13.2.a-b, 5.1.a | A new policy ([`textos/02`](./textos/02-politica-privacidad.md)) |
| P1-6 | A full export of the database, **unencrypted**, on the owner's machine, with no period | `docs/reference/deployment.md` § 8 | Art. 32.1.a (encryption) and 5.1.e | Encrypt it (`age`, say), keep it on an encrypted disk, delete it after 30 days; note it in the record of processing |
| P1-7 | An incomplete legal notice: no domicile, no tax number, no telephone; no postal or telephone complaints channel | `es-ES.ts:1394`; there is no legal-notice page | LSSI art. 10.1.a and e; TRLGDCU art. 97.1.c and 21.2-3 (postal, telephone and electronic channels, an acknowledgement, an answer within 15 days) | [`textos/07`](./textos/07-aviso-legal.md) before the *live* keys |
| P1-8 | Withdrawal: no model form, no online withdrawal function | the terms, `es-ES.ts:1435`; `PremiumCard.tsx` | TRLGDCU art. 97.1.j (the form); Directive 2023/2673 art. 11a (applicable since 19/6/2026; Spain has not transposed it in the TRLGDCU consolidated to 28/02/2026) | A form in the terms and a "Withdraw from the contract here" button in the profile during the 14 days ([`textos/03`](./textos/03-condiciones-uso.md), [`textos/06`](./textos/06-correos.md) § C) |
| P1-9 | The practice plan has no terms; the trial does not say it is charged when it ends | `practice.planTrial` (`es-ES.ts`, the `practice` namespace); `PracticePlanCard.tsx` | LSSI art. 27; Act 7/1998 arts. 5 and 7 (incorporating general conditions) | [`textos/04`](./textos/04-condiciones-consulta.md), accepted on the same screen as the agreement |
| P1-10 | Gemini forbids its use "in clinical practice"; the practice generates plans for a professional's patients with Gemini as a fallback | `docs/reference/ai-gateway.md` § 1; Gemini API Additional Terms (23/03/2026) | The contract with the provider (not the law, but it is the licence to use it) | **Closed in production** since 2026-09-26 (`stub`) and **closed by the change** (`0064`: no Gemini; the key only allows Gemma 4 31B and DeepSeek V4.1 Flash, with no clinical clause, § 4.4 d; Gemma 4 is open-weight, Apache 2.0, run by DeepInfra or CoreWeave, not the Gemini API). It reopens if `AI_PROVIDER=google` or a `google/gemini-*` model comes back to the text key. **2026-09-27**: project 006 uses `google/gemini-3.1-flash-lite-image` through Vertex (not the Gemini API) on a **separate key**, only to draw recipes, with nobody's data and no clinical use: it does not reopen this point. Google Cloud's generative AI terms **I have not read** (MAI, out since 2026-09-27): see [`dish-pictures.md`](./dish-pictures.md) § 5, IMG-9 |
| P1-11 | OpenRouter's data processing agreement (DPA): its terms § 10.2 incorporate it for commercial use, but its text is not public and its help centre says it is only signed with Enterprise | `ai.config.ts` (`case 'openrouter'`); OpenRouter's terms (31/08/2026) | Art. 28.3 (a written contract with the minimum content), 5.2 and 24 (demonstrating it); art. 46.2.c (standard clauses, which live in that DPA) | **Blocks the change.** The owner requests access at `trust.openrouter.ai`, downloads the DPA, asks support for written confirmation that it applies to his paid account, and keeps both outside the repository. If OpenRouter says no: there is no processor under contract; the policy cannot say "under contract" and the change is not made **[lawyer]** |
| P1-12 | The OpenRouter account does not limit which companies run the model: the request can go to 22 (one in Indonesia, another with no published terms) | `NO_TRAINING_PROVIDER` in `ai.config.ts` (with no `only`); the `ai-gateway.md` § 0 runbook (with no provider list) | Art. 13.1.e-f (naming recipients and transfers); arts. 44-46 (Indonesia with neither adequacy nor a guarantee) | **Done on 2026-09-26.** In the account, *Allowed providers* = DeepInfra and CoreWeave (the owner). In code, `provider.only` from `AI_PROVIDER_ONLY`, mandatory when starting with `openrouter` (`Env.validation.ts:506-507`). The policy names exactly that list; changing it goes through the policy first |
| P1-13 | ~~MiniMax M3's licence requires, in commercial use, displaying "Built with MiniMax M3" and a one-off notice to MiniMax~~ | the licence on Hugging Face; OpenRouter's terms § 5.1 | The contract (the licence accepted via OpenRouter's terms § 5.1) | **Closed on 2026-09-26**: the owner removed MiniMax as the fallback. The new fallback, Gemma 4 31B, is Apache 2.0: no notice, no attribution and no restrictions to pass on to users for whoever uses the model through an API (§ 4.4 d). Another model change reopens this row |
| P1-14 | The dish pictures (006, flag off): the console's card would show them with no notice; ~~MAI-Image-2.6 with no documented mark~~ (out, 2026-09-27); ~~`sharp` strips Google's C2PA~~ (the original is served, measured); the policy says "never Google's services" | [`dish-pictures.md`](./dish-pictures.md) § 5 (IMG-1 to IMG-9; since 009, IMG-10 to IMG-16: the rejected picture that waits, and the one the owner accepts by hand against the judge — **IMG-15, P1**: one sentence of `/privacidad` changes with that feature; **IMG-16 closed on 2026-09-30 by 010 phase 4**: "Retirar" works for any published picture, the one the judge accepted by mistake included, with no change to `/privacidad` or `/condiciones`); `NextMeal.tsx:58-62` | AI Act arts. 50.2, 50.4, 50.5 (from 2/8/2026, without art. 111.3's deadline); GDPR art. 5.1.a | Before the flag: [`go-live-checklist.md`](./go-live-checklist.md) § 0 ter |

### P2

| # | Finding | Where | Fix |
| --- | --- | --- | --- |
| P2-1 | The "Halal"/"Kosher" options ask the religion | `es-ES.ts:834-835`; `_enums.ts:21-22` | Neutral restrictions ("no pork", "no alcohol", "ritually slaughtered meat"); in the meantime, inside the explicit consent |
| P2-2 | "By continuing you accept… the privacy policy": a policy is informed, not accepted; and which version of the terms was accepted is not stored | `es-ES.ts:183` | New text ([`textos/03`](./textos/03-condiciones-uso.md) § A, already published); store `termsVersion` and the date on sign-up — **decided on 2026-09-29 (D5)**: built in project 008's phase 7, with the notice visible beside the Google button ([note](./2026-09-29-accepting-the-legal-texts.md)) |
| P2-3 | No record of processing activities | — | [`record-of-processing.md`](./record-of-processing.md) (art. 30; the 30.5 exception does not apply) |
| P2-4 | No periods and no purge: `analytics_events`, `plan_generation_jobs` | `platform.schema.ts:91-100`; `plan.schema.ts:240-260` | A daily cron deleting at 24 and 12 months |
| P2-5 | The policy says the controller is "a natural person — not a company or a registered self-employed trader" | `es-ES.ts:1105` | Remove it (the new text) |
| P2-6 | Checkout with no link to the terms and no tax-number collection for B2B | `apps/api/src/modules/billing/services/StripeGateway.ts:175-188` | `consent_collection.terms_of_service: 'required'` with the URL configured in Stripe; `tax_id_collection` for the practice **[lawyer/accountant]** |
| P2-7 | The annual plan: a notice 15 days before renewal | TRLGDCU art. 97.1.p (as worded by Act 10/2025) | With *Managed Payments* Stripe sends it by default 15 days before the anniversary; without it, switch on "Upcoming renewals" ([`textos/06`](./textos/06-correos.md) § D) |
| P2-8 | AI Act art. 50.2: mark the generated content in a machine-readable format | the recipe responses | Before 2/12/2026 (§ 7) |
| P2-9 | No data export for portability | — | `GET /users/me/export` in JSON; in the meantime, answer by mail within a month (art. 12.3) |
| P2-10 | The SMTP provider's mail: a consumer Gmail account offers no DPA | the owner's memory; `SMTP_*` | A transactional provider with a DPA **[lawyer]** |
| P2-11 | The companies that run the model are not sub-processors per OpenRouter (Enterprise DPA § 11.10) and have no contract with NutrIA; none is in the DPF | § 4.4 b | Name them in the policy; a closed list (P1-12); rely on the request identifying nobody (C-413/23 P) **[lawyer]**. If the lawyer does not buy it: a provider with a direct contract (Mistral in the EU, say, report `0002`'s plan B) |
| P2-12 | OpenRouter classifies an anonymous sample of requests for its public statistics; it cannot be switched off | the terms § 6.5; the *Data collection* documentation | **Accepted with a notice** (the owner, 2026-09-26): the policy (state 2) says so, and the owner will ask OpenRouter in writing to exclude his account. If it excludes it, the sentence can go |
| P2-14 | `/privacidad` does not name the brakes against abuse: the address's fingerprint with the attempt count (`sign_in_failure`, phase 7, already in `main`) and the mail one (`mail-budget:*`, phase 8), nor the IP in `rate_limit` (earlier); nor that they are not deleted with the account but expire on their own | `auth.schema.ts:215-229`; `MailBudgetRepository.ts`; `auth.config.ts:446-453` | Arts. 13.1.c-d and 13.2.a; 14.5.b for somebody with no account. A ⟦frenos⟧ bullet in "Qué datos recogemos" ([`textos/02`](./textos/02-politica-privacidad.md)), in the same change that takes the budget to production. § 4.1 ter |
| P2-15 | ~~An account created with somebody else's address and never confirmed stays forever (a name typed by a stranger, a third party's address). Since phase 8 nobody can get in without the mailbox, so it is a datum with no use~~ | `packages/core/src/repositories/User/UserRepository.ts:181,345`; `packages/core/src/controllers/User/UserController.ts:432`; `apps/api/src/modules/auth/services/AuthRetention.service.ts:32` | **Closed in the code on 2026-10-09** (PR #250, `fbab7b1b`, decision `0092`): the daily cron deletes an unconfirmed account older than 30 days with no session, profile, plan or audit row, in a `DELETE … RETURNING` with a trail row that survives with no actor, no subject and no IP (arts. 5.1.c and 5.1.e; § 4.1 quinquies). **What depends on the text is still open**: publishing ⟦barrido-sin-confirmar⟧ in `/privacidad` (art. 13.2.a) before the first account is deleted, the read-only count beforehand, and the two boxes of the checklist's § 0 septies. Two new knock-ons in P3 and one P2 sent to `backend` (`isNull(user.activatedAt)`) |
| P2-13 | ~~Ten columns are left in the database with no reader at all since `0067`: `sleepStart`, `sleepEnd`, `trainingDaysPerWeek`, `trainingTime`, `workScheduleNotes`, `breakfastStyle`, `portionPreference`, `budget`, `cookingFrequency` (`user_preferences`) and `customGoal` (`goals`, free text — it can carry health, "recovering from an eating disorder"). Onboarding no longer fills them, but the accounts that had them keep them~~ | `packages/database/src/migrations/0043_onboarding_answers_nothing_reads_are_cleared.sql`; `packages/database/src/schemas/profile.schema.ts` | **Closed on 2026-09-28**: migration `0043` sets those ten columns to `NULL` for every account, in the same change that stopped filling them — not only the new ones, the ones that already had them too (arts. 5.1.c and 5.1.e). On the way it moves every `goals.type = 'custom'` to `'maintenance'`, changing no calculated goal (see § 1.3). The columns and the enum's `'custom'` value stay in Postgres until the next release's migration removes them — that is schema hygiene, not a datum retained with no purpose, so it opens no new finding |

### P3

- The nudge to the professional carries the client's name on the lock screen
  (`apps/api/src/modules/email/templates/CheckInSubmitted.ts:61`): use "A patient has done
  their check-in".
- The invitation does not show the professional's registration number; showing it lets the
  client check it in their association's register.
- "Usamos dos cookies" (`es-ES.ts:1168`): Better Auth may set transient cookies on signing in
  with Google or Apple, and there are keys in `localStorage`/`sessionStorage`
  (`apps/web/src/lib/pendingReview.ts:1`, `pendingTicks.ts:17`, `arrival.ts:1`). All of them
  are strictly necessary (LSSI art. 22.2, the final exception): no banner is needed, but they
  do need naming.
- `health.consentNote` says health data "no se envían a ningún modelo": true of the datum, not
  of its effect (coeliac disease → the catalogue goes gluten-free). Add "only its effect gets
  there: the ingredients we remove".
- Together's terms forbid sending it "medical information of any nature or any sensitive
  personal data": NutrIA does not, but it is not worth having it on the allowed-provider list
  (P1-12) of a product with plans for patients.
- Every time `AI_MODEL`, `AI_FALLBACK_MODELS` or the allowed-provider list changes, the policy
  changes (state 2 names models and companies): the `ai-gateway.md` § 0 runbook should say so
  (to `main`).
- (2026-10-03, 011 phase 8) `auth.signUpSent` and `auth.invalidCredentials` say "te hemos
  escrito" / "te acabamos de enviar el enlace de nuevo" even when the budget has held the mail
  back (from the fourth within an hour). A proposal that is true in both cases: "Si {email} es
  correcta, te llegará un correo en unos minutos. Abre el enlace para entrar." / "If {email}
  is right, an email will reach you in a few minutes. Open the link to sign in."; and in the
  401: "… confirma antes tu dirección: si la contraseña era la buena, te enviamos el enlace de
  nuevo (como mucho tres veces por hora; mira también en el correo no deseado)." / "… confirm
  your address first: if the password was right, we send you the link again (at most three
  times an hour; check your spam folder too)."
- (2026-10-03, 011 phase 8) The "somebody tried to create an account" mail: it does not tell
  somebody who does not remember having an account (because another person created it with
  their address) what to do. Add before `reset`: "Si no recuerdas haber creado una cuenta,
  puede que alguien la creara con tu dirección: pon una contraseña nueva en el enlace de abajo
  y entra con ella." / "If you do not remember creating an account, somebody may have created
  one with your address: set a new password with the link below and sign in with it." It is
  true as written **if resetting confirms the address**, which is what `backend-011p8` has in
  its working tree uncommitted on 2026-10-03 (`onPasswordReset` →
  `UserController.confirmAddressByReset`). At `4f36ec5` it does not (Better Auth 1.7.6,
  `dist/api/routes/password.mjs`, does not touch `emailVerified`): if that is merged without
  the change, the sentence keeps "; te enviaremos un enlace para confirmar que la dirección es
  tuya." / "; we will send you a link to confirm the address is yours."
  ([`textos/06`](./textos/06-correos.md) § O).
- (2026-10-03, 011 phase 8) Sign-up now ends in "check your mail", but the screen does not
  announce that before the button is pressed. LSSI art. 27.1.a does not require it (the
  contract is concluded on pressing), but a sentence in `auth.createAccountSubtitle` or beside
  the button avoids the surprise. **Not** in `/condiciones`: that would force raising
  `TERMS_VERSION`.
- (2026-10-09, the sweep of unconfirmed accounts, `0092`) The confirmation mail says "al mes"
  in Spanish and "after thirty days" in English (`apps/api/src/modules/email/templates/VerifyEmail.ts`,
  the `ignore` key). They are not the same — a month is 28, 30 or 31 days; the code is exactly
  30 (`UNCONFIRMED_ACCOUNT_RETENTION_DAYS`) — and the policy is going to say "a los treinta
  días" in both languages. A proposal for the Spanish: "Si no te has registrado, no confirmes
  nada: ignora este mensaje y, a los treinta días, borramos el correo que nadie confirma junto
  con su registro." The English stays as it is. Sent to `backend`.
- (2026-10-09, the sweep of unconfirmed accounts, `0092`) The mail's promise ("we delete an
  address nobody confirms") **is not true for an account the owner has opened from the
  console**: opening it writes an audit row and that takes it out of the sweep for good
  (§ 4.1 quinquies). Today nothing stops an unconfirmed account being opened. An operational
  fix (the owner only activates confirmed accounts, the `confirmed` filter; the checklist's
  § 0 septies box) and, if it is ever wanted in the code, the console not letting an account
  with `emailVerified = false` be activated. What the policy says is not false: it publishes
  the four conditions.
- ~~Expired invitations: purge them daily~~ — done (a daily sweep at 08:00, backend
  `cf87d75`); the texts say "at the latest the next day" after expiry.

---

## 10. To confirm with a lawyer

One hour, in this order:

1. **004's roles**: independent controllers with an allocation clause just in case (§ 2).
   Does he buy it, or would he rather have formal joint controllership or a processing
   contract?
2. **Weight, height and goal as health data** (§ 1.2): the CJEU's broad reading (C-21/23)
   leads me to ask for explicit consent; does he confirm it?
3. **The AI** (rewritten 2026-09-26; free-text allergies and Gemini are no longer sent):
   (a) does the DPA that OpenRouter's terms § 10.2 incorporate "for commercial use" hold on a
   self-service account, even though its help centre says it is only signed with Enterprise?
   (b) The companies that run the model are not sub-processors per OpenRouter and are not in
   the DPF: is it enough that the request identifies nobody (C-413/23 P), a closed list and
   naming them in the policy? (c) Is "losing weight", with nothing else, a health datum?
   (d) OpenRouter's anonymous categorisation: NutrIA's basis for that disclosure (art. 6.4)?
4. **Stripe *Managed Payments***: with Link as the seller, who owes the withdrawal, the form
   and the withdrawal function, and what must the terms say? And for the practice (B2B)?
5. **Registration and tax**: 036, RETA, VAT with and without *Managed Payments* (the
   accountant).
6. **A domicile in a public repository**: a professional or a registered-office address for
   the legal notice?
7. **The withdrawal function** (art. 11a of Directive 2023/2673): Spain has not transposed it;
   is it implemented now? (I recommend yes: it is cheap.)
8. **AI Act art. 50.2**: is a metadatum in the API/HTML enough for the recipes' text?
9. **Medical device**: confirm that the declared purpose leaves it outside Regulation
   2017/745.
10. **Transactional mail**: is a consumer Gmail acceptable as a processor?
11. **The dish pictures** (2026-09-27): (a) is a realistic photo of a dish a deepfake
    (art. 3.60)? (b) "IA" instead of "AI" in the mark? ~~(c) If Google's C2PA does not arrive
    through OpenRouter…~~ (it does, measured on 2026-09-27).
    (d) (2026-09-30) is it an "exposure" under arts. 50.4-50.5 that the owner sees in his
    console a rejected, unpublished picture? It changes nothing in the product, which labels
    it all the same: no need to spend the hour on it.
    (e) (2026-09-30) does art. 50.4's "human review" exception, second paragraph, reach an
    image? My reading: no, it is for text only; the product does not rely on it.
    (f) (2026-09-30) a picture the owner publishes by hand against the judge, with a notice
    and a record: how does that record weigh if somebody claims a harm? **This one does
    deserve five minutes.**
    (g) (2026-09-30, 010 phase 2) `/privacidad`'s sentence about the judge, now that the rule
    deliberately accepts a second food shaped like one the dish already has: is it misleading
    (Act 3/1991, art. 5.1.b)? My reading: no, read in full; P2. The same after the rule was
    tightened, which narrows the class without closing it. A picture of that class can be
    withdrawn from the console (010 phase 4, `28854ac`). Five minutes only if the owner does
    not take the proposed clause.
    The detail in [`dish-pictures.md`](./dish-pictures.md) § 7.
12. **Accepting the terms** (2026-09-29, D5): TRLGDCU art. 59.4 and the free account, the
    LSSI art. 28 confirmation, "carrying on using = accepting", the evidence after erasure and
    the basis for storing the version. The detail in
    [`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md) § 7.
13. **The per-address brakes** (2026-10-03, 011 phases 7 and 8): (a) is legitimate interest
    (recital 49) enough to count attempts and mails for addresses that have no account,
    informing only in `/privacidad` (art. 14.5.b, art. 11.1)? (b) Is it reasonable not to
    delete those rows with the account but to let them expire (at most some two days)? My
    reading: yes to both (§ 4.1 ter). Five minutes.
14. **The browser that has already signed in** (2026-10-09, 011 phase 7b, `0089`): (a) is a
    security cookie exempt under LSSI art. 22.2, with no checkbox, when the person does not
    tick it, it lets nobody in and it only stops somebody else's attack from braking them
    (WP194 § 3.3 against § 3.2)? (b) Are 90 days, renewed on every password sign-in, a
    "limited" duration? My reading: yes to both (§ 4.1 quater). Five minutes.
15. **The sweep of the account nobody confirmed** (2026-10-09, 011's follow-up, `0092`):
    (a) does an art. 6 basis have to be named for erasure by period, or is it enough that it is
    compliance with arts. 5.1.e and 17.1.a, with no new purpose (art. 13.3)? My reading: it is
    enough; if one had to be cited, art. 6.1.c. (b) Are thirty days from sign-up a defensible
    period, counted from `createdAt` and not from the last link sent? My reading: yes, and
    art. 5.1.e only asks that it be justified. (c) **The one that does deserve five minutes**:
    LOPDGDD art. 32 (blocking). Does it reach an automatic erasure by period, or only one
    arising from a rectification or from the data subject's right? My reading: only the
    second, and here there is nothing to reserve as evidence (no payment, no content, no
    consent to demonstrate), while art. 32.5 allows blocking to be excepted when keeping the
    data even blocked creates a risk. The answer serves the erasure of an account at the
    person's request too, which blocks nothing today either. The detail in § 4.1 quinquies.

---

## 11. What has to be built for 004 (and by whom)

1. **The professional's acceptance** (backend + frontend):
   - `PROFESSIONAL_AGREEMENT_VERSION = '1.0.0'` in `packages/core/src/entities/Professional`.
   - Two columns on `professionals`: `agreementVersion text`, `agreementAcceptedAt
     timestamptz` (null until accepted). No separate table is needed: the acceptance is the
     professional's and goes with their account; if a history is preferred,
     `professional_agreements` (`userOwned`, version, date) — either serves to demonstrate it
     (art. 24).
   - `ProfessionalGuard`: besides the grant and the payment, it requires
     `agreementVersion === PROFESSIONAL_AGREEMENT_VERSION` on every route **except**
     `GET /care/practice` and the new `POST /care/practice/agreement { version }` (validated
     with `z.literal`, like `acceptInvitationSchema`). Buying the plan (`@BeforePractice`)
     also requires the acceptance, because the practice terms are accepted on the same screen.
   - `GET /care/practice` returns `agreement: { current, accepted }`; `/consulta` shows the
     agreement and the checkbox until they match. A new version is asked for again, without
     shutting the patients out: the professional sees the agreement instead of the list.
   - A mail to the professional when the owner grants them the role
     ([`textos/06`](./textos/06-correos.md) § B).
2. **Withdrawing the health line without ending the link** (P0-1).
3. **Explicit health consent in onboarding** (P0-2).
4. **The invitation's text and its page** + `CARE_CONSENT_VERSION` to `2.0.0` (P1-2, P1-3).
5. **An age gate** (P1-4).
6. **The policy, the terms, the legal notice** (P1-5, P1-7, P1-8, P1-9).

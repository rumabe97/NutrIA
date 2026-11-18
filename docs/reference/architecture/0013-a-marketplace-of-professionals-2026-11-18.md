# 0013 — A marketplace of professionals

> **Purpose**: the owner wants to turn the professionals' area (project 004) into an open
> marketplace. Anyone may publish a profile, people search a directory, ask to hire, chat,
> rate, and live on one meal plan written by a person or by the generator, never both. This
> report is the feasibility read he asked for before `/plan-project`. It covers what of 004
> survives, the data model, the chat on this stack, the one-plan rule, the assistant, the
> invariants, public pages, the cold start, a split into projects, and what it costs. Nothing
> here is a plan or a decision.
> **Audience**: the owner and the lead. **Committed**: yes. **Maintained by**: whoever
> revisits the question. Once merged it is not edited; a later review is a new report.
>
> **Base**: `main` at `d0c59a24` (#395). **Cut-off**: 2026-11-18.
>
> **How this was done**: code and docs only, read and grepped. No test, gate, evaluator, model
> call or database query was run, and nothing was read from production. Every number is
> labelled **measured** (where), **estimated** (on what hypothesis) or **unknown**.

## 0. Verdict

**Yes, on conditions.** Most of it fits the codebase better than it first looks, because
project 004 already built the hard part: a consented, audited path from one account into
another (`0059`), and a plan that waits for a professional (`0060`). Five of the owner's
decisions fight the code or each other, and each needs a condition:

1. **The badge must be checked by the owner, not just typed in.** Decisions 1 and 2 together
   put the gate for illnesses and medication on a collegiate number nobody verified. A badge
   anyone can earn by typing digits is no gate. The fix is cheap and already built: the badge
   *is* 004's owner grant (`POST /admin/accounts/:id/professional`), checked against the
   college's public register. The checking is the owner's few minutes per badge.
2. **Hiring must not grant premium.** Today a client of an open practice is premium
   (`PlanController.ts:1171-1182`, `0061`). With self-service profiles, anybody could create a
   profile, hire it from a second account and get the paid allowances, pictures included.
   Premium-by-link stays tied to a *paid* practice (`practiceOpen`, written only by the Stripe
   webhook, `BillingRepository.ts:197`). That is deferred, so no hired client is premium for
   now.
3. **The AI plan is not archived on hiring.** The lead's suggestion leaves the client with
   nothing to eat until the professional writes something, which breaks the product's first
   promise (`PRODUCT.md` § Users, need 1). 004 already does the right thing: the current plan
   stays until the professional publishes, and publishing completes it in one transaction
   (`0060`).
4. **"Written by hand" means composed from the catalogue, never free text.** The allergy gate
   compares allergen ids (`ARCHITECTURE.md` § Invariants). A typed "200 g de pollo con arroz"
   has no ids, so no gate and no macros. That would break `0004`. Hand-picking a library dish
   per meal is gateable and computable. Free text is a "no".
5. **The chat polls while it is on screen and stops when it is not.** A chat that keeps polling
   can keep production's Neon compute awake past its 100 CU-h a month. Going over **suspends
   production until the month turns** (`docs/reference/preview-environment.md:44-48`).

Without those five it is a "no". The whole thing is about **six projects, roughly 6–10 weeks
of agent work**, all inside free tiers. The owner's own time goes into decisions, badge checks
and moderation.

`PRODUCT.md` § Scope lists "social features" and "coach marketplaces" as deliberately left out
of v1. Building this changes the product's definition, and that is the owner's call. It is the
first decision in § 13.

## 1. Premises checked

| # | Premise | Status | Evidence |
| --- | --- | --- | --- |
| P1 | "Nothing is built" | **wrong, in a useful way** | The delegated path, invitations, consent with a separate health line, the client's access trail, review-before-publish, the professional generating and swapping for a client, publishing, check-in notices to the professional and the `/consulta` screens all exist (§ 2). About 4,700 lines of core and API code plus tests, and 474 lines of `/consulta` pages and 13 components (**measured**, `wc -l`). What is missing is the *open* part: profiles, directory, requests, chat, ratings. |
| P2 | 004 is in use and reshaping it hurts somebody | **wrong (confirmed by code; production rows not read)** | Every client route needs `practiceOpen` (`Professional.guard.ts:83`, `CareRepository.ts:37`). Only the Stripe webhook writes it (`BillingRepository.ts:197`). Stripe live mode is deferred by the owner. So no professional can reach a client in production today, whatever the flag says. That makes reshaping cheap. |
| P3 | "Anyone may publish a profile" fits `0059` | **wrong** | `0059` says a professional "is a row, granted by the owner", and 004's criterion 1 is an end-to-end test that *no request body can* create one. `professionals.collegiateNumber` is `notNull` (`professional.schema.ts:29`). Self-service needs a new decision record that supersedes that clause, and the test has to be inverted on purpose. |
| P4 | A badge from a voluntarily given number protects health data | **wrong as stated** | Nothing checks a typed number. The gate would rest on the honesty of the person it is meant to keep out. With the owner's check it holds (condition 1). Whether showing «dietista-nutricionista» on an unchecked number exposes NutrIA is a question for `legal` (sent, § 6). |
| P5 | "Nobody without the badge receives illnesses or medication" can be enforced | **confirmed for structured data, wrong for chat** | Structured data has three enforcement points in code (§ 6). Chat text cannot be filtered: a client can type "soy diabético" to anyone. Only a warning, reports and retention cover it. |
| P6 | Payment outside the app costs nothing to build | **confirmed** | No Stripe Connect and no money flow. The price is a number on a profile. One knock-on: practice seats (`includedClients`, default 0) are written only by billing, so a free practice needs its seat limit from somewhere else (§ 4.1). |
| P7 | One plan, the AI's or the professional's | **confirmed as a rule; the wording is misleading** | A professional's plan made with "the generator as their tool" *is* the AI pipeline: pool, model for the fresh third, scheduler. The real difference is **who is responsible for it and who may change it**. The schema has one active plan per person already (partial unique index, `ARCHITECTURE.md` § Plans are append-only). |
| P8 | The allergy gate can hold on a professional's plan "however it is written" | **confirmed, if "however" excludes free text** | Generation, swaps and fixed meals all pass `getSafetyProfile` and `findSafetyViolations`. A new "put this dish here" path has to be gated the same way (§ 5.3). |
| P9 | The stack can carry a chat at zero euros | **confirmed with conditions (estimated)** | It is a single Vercel function (`apps/api/vercel.json`, one `builds` entry), so new routes add no function. Vercel is on Pro, already paid (`deployment.md:191`). Web push is built (`Push.service.ts`, VAPID). The binding limit is Neon's free compute (§ 4.3). |
| P10 | Ratings "only from somebody who hired" stop fake ratings | **hypothesis, weak** | Accounts and profiles are free and unverified, so one person can hire themselves from five accounts. Eligibility rules raise the cost of faking (§ 4.4). They do not remove it. |

## 2. What is there today, and what happens to each piece

### 2.1 How 004 works (the parts this touches)

- **Who is a professional**: a `professionals` row (`professional.schema.ts:20-36`), written
  only by the admin grant. `ProfessionalGuard` (`Professional.guard.ts:62-88`) checks four
  things on every request and caches none of them: the grant, TOTP for password accounts
  (`needsSecondFactor`), `practiceOpen` and the current agreement.
- **The only way in**: `CareController.withClient` (`CareController.ts:951-994`) resolves a
  *link id* against the session's professional with `status = 'active'` and `practising`. It
  writes the client's trail row before a read, or inside a write's transaction, and hands over
  the client's id from the row. `CareRepository.roster` is the one other reader (`0059`,
  amended).
- **The link**: `care_links` (`care.schema.ts:72-99`) holds the consent version, `sharesHealth`
  (the separate line), `reviewBeforePublish`, and at most one `active`/`paused` link per client
  (partial unique index, `:94-96`).
- **Invitations**: a hashed single-use token, 14 days, the same answer whether or not the
  address has an account (`care_invitations`, `CareController.invite`).
- **The plan**: a client with an active link and review on gets new plans as `pending_review`
  (`PlanRepository.ts:224-228`, `publishingLink` `:1501-1520`). The professional generates
  only when there is a reason (`professionalMayGenerate`, `PlanController.ts:1016`), swaps on
  the pending plan, and publishes in one transaction (`PlanController.publish`, `:1032`).
- **Tier**: an active link to a practice with `practiceOpen` makes the client premium
  (`tierOf`, `PlanController.ts:1171`; `coveredByOpenPractice`, `CareRepository.ts:305`).
- **Notices**: a client's check-in notifies the professional by mail or push, with no health
  detail (`CheckInSubmitted.service.ts`).
- **Web**: `/consulta` (list), `/consulta/[linkId]` (overview, targets, review, publish),
  `/invitacion/[token]`, and the client's link card, health switch and access log on
  `/perfil`.

### 2.2 Reuse, reshape, throw away

| Piece | Verdict | Why |
| --- | --- | --- |
| `care_links`, `withClient`, the access trail, `roster` | **reuse the mechanism**; the health branch also needs the badge, and **what an unbadged professional may read through it is narrower** (§ 14) | This is the expensive, audited part, and the marketplace needs exactly this path after a hire. The overview's non-health reads (weight, targets, adherence, check-ins) are health data in this context, according to `legal`. |
| `pending_review`, publish, professional generation and swaps | **reuse as is** | That is the "generator as their tool" half of decision 5, already built and tested. |
| Supervised targets (`setTargets`) | **reuse as is** | Same `targetViolations` bounds. Nothing about who the professional is changes the rule. |
| Health line (`sharesHealth`, `setSharesHealth`, `CARE_HEALTH_SHARED`) | **reshape** | Offered and readable only when the professional holds the badge (§ 6). |
| `professionals` row and the admin grant | **reshape into two things** | (a) *may practise*: self-service, created when somebody publishes a profile and accepts the agreement. (b) *the badge*: the owner's existing grant, now a verification of a number, not permission to practise. The collegiate number becomes nullable. Existing rows backfill as badged, because the owner checked them. |
| `ProfessionalGuard` | **reshape** | Keeps the grant (now "may practise"), TOTP and the agreement. `practiceOpen` leaves the access check: a free practice must open with nobody paying. |
| `practiceOpen` / `includedClients` | **reshape the meaning** | `practiceOpen` keeps meaning "paid": it still grants clients premium and the larger seat count. The free seat count moves to the console-editable allowances (`0097`), for example 10 active clients. |
| Invitations | **keep, and keep using them** | Invitations are the cold-start answer (§ 8): a professional brings their own clients with no directory. A hire request (§ 4.2) is the same object, started from the other side. |
| `/consulta` screens | **reuse and extend** | The list gains requests and a chat entry; the client page gains the chat. Nothing is thrown away. |
| Practice billing (Stripe practice prices, trial, portal) | **keep, dormant** | Decision 6 keeps it deferred. The code stays, unused. |
| The agreement (`PROFESSIONAL_AGREEMENT_VERSION`) | **reshape the text** | An unbadged practitioner is not a health professional, and the agreement must say what they may not do. That is `legal`'s text. A new version asks every existing professional again (`agreementRequired`). |

**Nothing of 004 is thrown away.** The one piece that loses its purpose for now is the paid
practice, which the owner already deferred.

### 2.3 "Anyone can be a professional": three shapes

| Shape | What it breaks | Verdict |
| --- | --- | --- |
| **A value on `user.role`** | `0059` rejected it: a role is single-valued, so the owner could not be admin and professional, and `@Roles('admin')` would gain a second meaning. | **No.** |
| **The existing grant made self-service, unchanged** | Every right a grant carries today (client data, the health line, premium for clients) would go to unverified strangers. It contradicts decision 2 and `PRODUCT.md`'s promise. | **No.** |
| **Split: "may practise" is self-service, "badge" is the owner's verification** | One supersession of `0059`'s first paragraph. The criterion 1 test inverts deliberately. The health branch in `withClient` gains one condition. | **Recommended.** |

One schema detail for the recommended shape. Keep `professionals` as the "may practise" row,
because the guard, `roster`, `activeLink`, `publishingLink` and billing all already join on
it. Make `collegiate_number` nullable and add `badge_verified_at` and `badge_verified_by`.
Put the public face in a new `professional_profiles` table. Moving "may practise" to a new
table instead would mean editing every one of those joins, all of them on the audited path,
for no gain.

## 3. The data model

All tables below are new unless marked. Every user-scoped foreign key gets `ON DELETE
CASCADE`; the cascade is the privacy control (`ARCHITECTURE.md` § Account deletion actually
deletes).

| Table | Columns (essentials) | Notes |
| --- | --- | --- |
| `professionals` *(altered)* | `collegiate_number` **nullable**; `badge_verified_at`, `badge_verified_by` | Backfill: existing rows get `badge_verified_at = granted_at`. `DROP NOT NULL` and adding nullable columns are metadata-only in Postgres: no rewrite, no long lock. |
| `professional_profiles` | `user_id` (singleton), `slug` unique, `display_name`, `headline`, `bio` (≤ 2,000), `studies` (self-declared text, shown as unchecked), `price_cents` + `price_unit` (`session`/`month`/`plan`), `modality` (`online`/`in_person`/`both`), `province`, `hours` (seven day ranges, display only), `languages`, `specialties` (a **curated** enum array), `accepting` bool, `published_at`, `hidden_at`, `hidden_reason` | Specialties naming a condition (diabetes, eating disorders, pregnancy) are selectable **only with the badge**. Display name and headline refuse «dietista», «nutricionista» and «colegiad…» without the badge (§ 6). |
| `care_requests` | `client_id`, `professional_id`, `status` (`pending`, `accepted`, `declined`, `withdrawn`, `expired`), `consent_version`, `shares_health`, `expires_at`, `decided_at` | The mirror of `care_invitations`: the client consents **when sending**, after reading the list. Accepting inserts the `care_link` in the same transaction. `care_links_one_open_per_client` stays the arbiter, so a client accepted elsewhere a moment earlier fails cleanly and the other pending requests are withdrawn in that transaction. Partial unique on `(client_id, professional_id)` where pending. A cap on pending requests per client, enforced under a row lock like the assistant's claim. |
| `care_conversations` | `client_id`, `professional_id`, unique pair, `last_message_at`, `client_read_at`, `professional_read_at`, `client_notified_at`, `professional_notified_at` | **One per pair, ever.** The state ("limited" or "full") is **derived** at read time: full while an `active` link joins the pair, limited while a request is pending, read-only otherwise. Nothing stored can drift from the link. |
| `care_messages` | `conversation_id`, `author_id`, `body` (check ≤ 2,000), `created_at`, `hidden_at` | Index `(conversation_id, created_at, id)`, created with the table. The `0059` note on `care_access_log` explains why: a plain `CREATE INDEX` added later blocks writes while it builds. |
| `professional_reviews` | `link_id` **unique**, `client_id`, `professional_id`, `stars` (check 1–5), `body` (≤ 1,000), `reply_body`, `reply_at`, `hidden_at` | One per hire. `link_id` is set null if the link row goes; `client_id` cascades, so a review goes with its author's account. |
| `content_reports` | `reporter_id`, `target_kind` (`profile`/`review`/`reply`/`message`), `target_id`, `reason` (enum), `quoted_text`, `status`, `resolved_at` | `quoted_text` is a **copy made by the reporter's act** (§ 6), so the console never needs a path into a conversation. |
| `meal_plans` *(altered)* | `authored_by` (`self` / `professional`), nullable, default null = self | Lets screens say "the plan from your professional" and lets the one-plan rule read who owns the plan. Today no column says who started a plan (`plan.schema.ts:27-60`). Add the enum value in one release and use it in the next (`0060`, amended: a new enum value cannot be used in the transaction that added it). |

**Directory search.** Published, not hidden, accepting profiles, filtered by modality,
province, specialty, badge and price band, with text search on name, headline and specialties.
At the scale a free tier can hold (hundreds of profiles), a normalised `ILIKE` with a partial
index on `published_at where hidden_at is null` is enough (**estimated**). `pg_trgm` or
`tsvector` can come when a slow query is measured, not before.

**Migration risk against production: low (estimated).** Five new empty tables, two nullable
columns, one `DROP NOT NULL`, one backfill over a table with a handful of rows (**unknown**:
production rows not read). Enum additions follow the two-release rule. Every migration goes
through `migration-reviewer`, as always. The real risk is not the DDL. It is the code that
reads `care_links.status`: `presentClientLink` maps **any** status that is not `paused` to
`active` (`CareController.ts:298`). Keeping requests in their own table instead of adding a
`requested` status to `care_links` is what keeps that line harmless, and the main reason the
separate table wins.

**Alternatives considered for the request**: a `requested` value on `care_links.status`. It
lost because every existing reader of the status (`CareRepository.ts:202, 289, 368, 676, 752`
and `CareController.ts:298`) would have to learn it. A forgotten one turns a request nobody
accepted into delegated access. That is a P0 on the one path the architecture names.

## 4. The pieces

### 4.1 A free practice

The guard and `practising` drop `practiceOpen` from the access check
(`Professional.guard.ts:83`, `CareRepository.ts:37`, `CareController.ts:435-439`,
`activeProfessional` `:518-535`). The seat check in `CareRepository.invite`
(`CareRepository.ts:447-476`), and the new request acceptance, read
`practiceOpen ? includedClients : freeSeats`. `freeSeats` is a console allowance (`0097`).
`tierOf` and `coveredByOpenPractice` are **not touched**, so clients of a free practice stay on
their own tier (condition 2).

### 4.2 Hire request, and the limited chat

The client reads the profile, then the consent list. The health line is offered only when the
profile is badged. They send the request with a first message, and they see their own pending
requests.

The professional accepts, declines, or lets it expire after 7 days. Before a decision both may
write, bounded: **3 messages each, 1,000 characters** (recommended, the owner's call). No
request can be sent to a profile that is not `accepting`. A professional cannot start a
conversation with a stranger: only requests and invitations open one. That alone closes the
professional-spams-users vector.

### 4.3 The chat on this stack

| Option | Neon | Vercel | Third party | Privacy | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Polling, only while the conversation is on screen** | each poll is one indexed read, but it keeps compute awake | one invocation per poll, inside Pro's included usage (**estimated**; read the Usage page) | none | nothing leaves | **Recommended** |
| Streaming (SSE / long-poll) from the function | the function still has to *ask* Postgres; `LISTEN/NOTIFY` needs a held connection, which keeps compute awake just the same | a held connection is billed as function duration, cut at `maxDuration` 300 s | none | nothing leaves | **No**: it moves the polling into the function and pays more for it |
| A realtime service (Pusher, Ably, Supabase Realtime) carrying only a "new message in conversation X" ping | the client fetches only when pinged, the least load | small | a new processor: listed in `/privacidad`, a DPA, and free tiers that can change under you | an opaque id and the device's IP leave | **Later**, only if polling is measured to hurt |

**Why the polling must stop when unseen.** Neon's free plan suspends after 5 minutes idle.
Production's project has 100 CU-h a month, and going over suspends it until the month turns
(`preview-environment.md:44-48`; that file measured 19 CU-h in 15 days on 2026-09-21). A tab
left visible overnight and polling every 10 s keeps compute up 24 hours a day. At the
0.25 CU floor that is **~6 CU-h a day, ~180 a month** (**estimated**; the floor is a
hypothesis, read the compute settings). One forgotten laptop could stop production.

So the hygiene is part of the design, not a refinement:

- poll only while the conversation is open and `document.visibilityState === 'visible'`;
- poll every 5 s for a minute after a send or a receipt, then back off to 30 s;
- after 10 minutes with no input and no message, stop and show "toca para actualizar";
- the unread count rides on page loads the app already makes (the server components call the
  API on every page). No poll runs outside the chat.

**Notifications on an iPhone.** Web push works only for a web app **added to the home screen,
on iOS 16.4 or later**, with permission granted from a tap. That is Apple's platform rule (a
**hypothesis** for this app until somebody tests it on the owner's iPhone). The push is built
(`Push.service.ts`, `0054`), and whether `VAPID_*` is set in production is **unknown**. So:

- push says only "Tienes un mensaje nuevo de {nombre}", never the text, the same rule as the
  check-in notice (004 criterion 10);
- at most one push per conversation per recipient per 10 minutes (`*_notified_at`);
- a person with no push subscription gets a mail instead, at most one per conversation per
  day, through the existing mail budget (`core/domain/MailBudget`).

**Moderation and retention hooks.**

- A report button on every message copies the text into `content_reports`.
- No model reads the chat, ever. The chat is personal free text and possibly health data
  (prompt 4.0.0, Legal A). The new module goes inside the walls of `health-boundary.spec.ts`
  and `assistant-boundary.spec.ts`, as care already is.
- A Postgres-backed message cap per account per day, for flooding. The in-memory limiter is
  per instance (`RateLimit.guard.ts:31-35`) and is no defence on a serverless host.
- A warning above every conversation asks people not to share health details with a
  practitioner without the badge, as the assistant's warning does.
- Retention: while the link lasts plus N months after it ends. It is swept by the daily
  `/cron/reminders` (`vercel.json`), with no new cron.

### 4.4 Ratings, replies, reports

To make faking expensive (recommended, the owner's call):

- a rating needs a link that lasted **14 days or more and carried at least one published
  plan**;
- the rater has a confirmed address and a finished onboarding;
- one rating per link, editable.

Raters are shown as "Cliente · noviembre 2026", never by name. A public review of a dietitian
says the person sought nutrition care, which is close to health data (`legal`).

The professional gets one public reply. Replies are where a professional could disclose a
client's health in public ("como te dije sobre tu diabetes…"). Code cannot stop it. A report
can.

The owner's console gains a **reports** page. It reads reports and the public objects they
point at (profiles, reviews, replies are public anyway) and the reporter's copy of a message,
**never a conversation**. That keeps `0028` and `0068` ("the console reads nobody") true. The
owner's actions: hide a review or reply, hide a profile, revoke the badge, and the account
switches that exist (`0031`).

## 5. The one-plan rule

### 5.1 What assumes an AI plan exists today

Mostly nothing, because a professional's plan *is* a `meal_plans` row with `meals` pointing at
library `recipes`. The shopping list, check-ins, adherence, progress, pictures (drawn on first
view, `0066`), swaps, events, vacations and the offline copy all read the row and do not care
who started it.

What has to change is **who may change it**:

| Path | Today, for a linked client | Under "one plan" (recommended) |
| --- | --- | --- |
| Client's own generation or redo | with review on, it lands `pending_review` for the professional; with review off, it replaces the plan (`PlanRepository.ts:224-228`) | **Closed while hired**, a 409 with a code ("your plan is your professional's"). The professional generates. |
| Client's swaps | allowed on the active plan, within their allowance | **Allowed, and shown to the professional**. Recommended because a swap stays inside the gate, the bands and the library. Owner's choice (§ 13). |
| Events and vacations (`0044`, `0032`) | rebuild or shift the active plan automatically | keep: they are library-only, gated, and an event is the client's life. The professional sees it in the overview. |
| Fixed meals (`0098`–`0101`) | the scheduler honours them | keep: the professional's generation honours the client's fixed meals, with `0103`'s warnings |
| Dish requests, the assistant's allowance | the client's tier | unchanged (no premium by hire, condition 2) |
| Check-in nudge | never changes targets a professional set (LOG 2026-09-24) | unchanged |

**On hiring**: nothing happens to the current plan. The client keeps eating it until the
professional publishes, and publishing completes it (`0060`). A pending plan the client started
before hiring is deleted at acceptance, charging nothing (`0060` amended: "a stranded plan
costs the client nothing").

**On ending**: the client keeps the last published plan (004 decision 8) and becomes its
`self` owner again. Their next generation is their own, on their own allowance. No "return to
the AI" step is needed, because there was never a second plan.

### 5.2 How a professional writes a plan

| Option | Gate | ±5% | Effort | Verdict |
| --- | --- | --- | --- | --- |
| **Generator + swaps** (exists) | yes | the scheduler reaches it (`0045`) | 0 | keep |
| **Pick a library dish for a meal** ("put this dish here", with servings) | yes: `RecipeController.usesExcluded` and `findSafetyViolations` on the client's `SafetyProfile` before storing **and** before returning | a **warning the professional accepts**, as `0103` lets a person do for a fixed meal. `dayHoldsPin` answers in ~6 ms (`0103`, **measured** there) | medium | **add** |
| **Free text** | **no**: no ingredient ids | **no**: no catalogue | — | **No** (`0004`) |
| **A dish the professional writes from catalogue ingredients** | yes, by ids | computed | large: recipe authoring, the picture judge, the library | **later**, if professionals ask |

What does not move for a professional's plan, written any way:

- **The allergy gate** and the **calorie floor** (`MINIMUM_DAILY_KCAL`) and the **protein
  ceiling** are bounds and block (`ARCHITECTURE.md` § Nutrition tolerances).
- **The ±5% bands** are guidance and are recorded (`0045` itself says a day outside a band is
  "recorded on the plan and delivered").
- **The plate limits** (`PLATE_LIMIT`, `PLATE_GRAMS_MAX`, the serving ceiling `0070`) are
  bounds. A professional who wants a 1,000-g plate is refused like everybody else.

Whether a dietitian should be allowed under the floor is a clinical argument, and `0004` says
code decides. My recommendation is no exception.

**Pictures**: unchanged. A hand-picked dish already has, or draws, its picture on first view,
inside the 10 $/month cap.

**Redos**: a professional's generation is charged to the client's allowance today (`0060`).
With the client's own redo closed while hired, the professional spends it. The free tier gives
**1 redo a fortnight**, which may be tight for a professional iterating on a plan. The owner
may want a separate professional allowance in the console. Its cost is about 0.24 $ of pictures
per generation (**measured**, `tiers-and-allowances.md`, 30 days to 2026-10-12).

### 5.3 What the allergy gate must not say

The `SafetyProfile` merges in the allergens a signed condition implies (coeliac → gluten,
`0008`). When an unbadged professional picks a dish and is refused "contiene gluten", they learn
something only a condition explains. **The refusal to an unbadged professional names no
allergen and no cause**: "no es compatible con las restricciones de esta persona". This is a
small rule, easy to miss, and it belongs in the new path's tests.

## 6. The invariants, and where each is enforced

| Invariant | Where it is enforced | Change |
| --- | --- | --- |
| **Ownership by session** | `withClient` for client data (unchanged). **New**: one named predicate for conversations, `participant(sessionId, conversationId)`, the only reader of `care_messages`, plus `ARCHITECTURE.md` naming it beside `withClient`. Reviews: written by the link's client, replied to by the link's professional, both resolved from the link row, never from a body. | new path, `invariant-reviewer` P0 class |
| **Denials are 404** | A hidden or unpublished profile is 404. A request to a profile not accepting is 404 (as if it were not there). A conversation that is not yours is 404. A declined request is the client's own resource and may say so. | as today |
| **Health data out of the AI module** | `health-boundary.spec.ts` and `assistant-boundary.spec.ts` gain the conversation, review and report modules. No model moderation. | extend two specs |
| **Unbadged never receives illnesses or medication** | (1) `CareRepository.activeLink` returns the badge, and `withClient`'s health branch (`CareController.ts:967`) refuses `health` unless `sharesHealth && badge`; (2) `setSharesHealth` (`:870`) refuses `true` on an unbadged link; (3) the consent screens (`presentInvitationDetail`, `:349-358`, and the request's) list no health line for an unbadged profile; (4) revoking a badge closes the health read on the next request, because nothing is cached; (5) the gate's refusal names no allergen (§ 5.3); (6) chat: **not enforceable**, so a warning, reports and retention | (1)–(5) code, (6) policy |
| **The regulated title** | Profile display name, headline and specialties refuse «dietista», «nutricionista», «colegiad…» and condition specialties without the badge, server-side, in the profile's Zod schema | new |
| **The console reads nobody** | Reports carry the reporter's copy, and the console has no route to a conversation, asserted by test as the assistant's is | extend |
| **Deny-by-default** | Profile pages are the first `@Public()` *data* routes of the product. Each is named, rate-limited and returns only published, non-hidden fields. | new public surface |

**Sent to `legal-marketplace`** on 2026-11-18. These are the legal questions this design cannot
settle:

- the title shown on an unchecked number (intrusismo);
- whether `CARE_SHARED`'s weight series and check-ins are art. 9 data that an unbadged
  recipient should not get either (the question as sent also named allergies, which was
  wrong: § 14);
- the chat as a health channel NutrIA hosts, and who is its controller;
- public reviews that reveal a care relationship;
- the online-intermediation obligations (notice-and-action, terms for business users, ranking
  transparency).

`legal` answered the same day. Its answers change this table and § 2.2, and § 14 says how.

## 7. The assistant while a professional's plan is active

| Option | What it costs | Risk |
| --- | --- | --- |
| **(a) Unchanged** | nothing | it explains the plan with the scheduler's reasons and contradicts a professional who chose otherwise; two advisers in one screen |
| **(b) Off while hired** | one condition on the `assistant` switch read; the client loses a feature | none of the above, but a hired client with a question at 9 p.m. has nobody until the professional answers |
| **(c) On, deferring to the professional** (recommended) | `authored_by` in the context, one prompt line ("this plan was set by the person's professional: explain what it contains, send *why* and *change it* to them"), an `ASSISTANT_PROMPT_VERSION` bump, a test. Small. | low. `claimsToAct` and `0109` already stop it acting or writing a menu |

In every option the assistant never reads the chat, the professional's name or notes, or
anything behind `withClient` (`assistant-boundary.spec.ts` already walls off care).

## 8. Public pages, SEO, abuse, the cold start

**Signed-in first (recommended).** The directory and profiles live in the signed-in tree in
v1, added to `PRIVATE_PATHS` (`apps/web/src/app/_shared/pages.ts`). Reasons:

- (1) the site is on a `*.vercel.app` host (`deployment.md` § Shape A), where indexed profiles
  build no lasting asset;
- (2) public pages put the first anonymous data routes on Neon's compute for every crawler;
- (3) spam profiles indexed under NutrIA's name hurt more than an empty directory does;
- (4) it hides the cold start.

**When public** (a later project, after a custom domain and enough vetted profiles):

- server-rendered with a revalidation window plus revalidate-on-edit, so a crawler reads a
  cached page and not the database (the exact Next 16 mechanism is for `frontend` to confirm,
  **hypothesis**);
- `noindex` until a profile holds the badge or one rating;
- no outbound links in profiles at all (contact happens in the app; `rel="ugc nofollow"` if
  that ever changes);
- `ProfessionalService` JSON-LD without `aggregateRating`, because self-hosted ratings are not
  eligible for review snippets (**hypothesis**, `seo` to confirm);
- a rate limit per IP on the public routes, in Postgres, not in memory.

**Spam profiles**: publishing needs a confirmed address, TOTP (already required of
professionals), an accepted agreement and a finished profile. New profiles can sit in a
"pending first look" state the owner clears from the console. **Recommended while the count is
small**: it is minutes a week and turns the cold start into curation.

**Cold start with ~8 accounts.** An open directory today shows zero to two profiles, an empty
shop window that breaks principle 3 ("never fake it") whatever copy surrounds it. There must be
no placeholder profiles and no fake reviews. Instead:

- (1) ship the **professional side first**: self-service practice plus the **invitations that
  already exist**, so a professional gets value from their own clients on day one, with no
  directory;
- (2) keep the directory **dark behind a flag** until a number of published profiles the owner
  chooses (recommended: 10). Professionals see "your profile will appear when the directory
  opens";
- (3) recruitment is the owner's job, not the code's, and the product cannot fix that.

## 9. The projects, in order

Each ships on its own, behind the `professional` switch or a new `directory` switch.

| # | Project | Size | Ships | Owner decides first |
| --- | --- | --- | --- | --- |
| 0 | **Decisions and the legal read**: amend `PRODUCT.md` § Scope, a decision record superseding `0059`'s first paragraph, `legal`'s answers | small, mostly the owner's time | nothing to users | the marketplace in scope; badge verification |
| 1 | **Anyone can open a practice**: self-service "may practise", the badge as the owner's verification, a free seat allowance, health gated on the badge, the title filter, the new agreement, the profile data (unpublished) | **large**: it touches `withClient`, the guard and `activeLink` (`invariant-reviewer`, `migration-reviewer`, `quality-max` floor) | professionals invite their own clients for free | free seats; premium by hire (no) |
| 2 | **One plan, the professional's**: `authored_by`, the client's own generation closed while hired, "put this dish here" with the gate and `0103` warnings, the professional's redo allowance, the assistant's deference line | **medium** | a professional can compose and own a plan | hire-time plan; client swaps; how a professional writes; the assistant |
| 3 | **Chat between a professional and a client**: conversations, messages, polling with hygiene, push and mail notices, the report copy, retention, the Postgres message cap. Full state only, for linked pairs | **large** | linked pairs talk | delivery; retention; after the end |
| 4 | **Directory and hire requests**: published profiles in the signed-in tree, search and filters, the request with consent at sending, the limited chat state, accept, decline, expire, the pending cap, the console's first-look queue | **medium** | clients find and hire | dark until N; limited-chat bounds; pending cap |
| 5 | **Ratings, replies, reports**: eligibility, the reply, the reports page in the console, hide and unpublish | **medium** | trust signals | who may rate; how raters show; what a report does |
| 6 | **Public profile pages and SEO** | **small–medium** | search traffic | custom domain; which profiles get indexed |

**Cut from a first version**: project 6 entirely; profile photos (moderation of images, and
Blob storage); chat attachments, read receipts and typing indicators; a realtime service; free
text plans; recipe authoring by professionals; aggregate-rating markup; clinics; more than one
open link per client; booking (decision 3 already cut it).

**Effort, rough (estimated)**: 1 ≈ 2–3 weeks, 2 ≈ 1–1.5, 3 ≈ 1.5–2.5, 4 ≈ 1–1.5,
5 ≈ 1, 6 ≈ 0.5–1, with the team and its reviewers. What drives the range: how many review
rounds the delegated path takes (004 took several), and the owner's turnaround on
human-verify gates on the iPhone.

**Stop signals**:

- project 1: an `invariant-reviewer` P0 on the delegated path that survives two rounds means
  stop and redesign, not patch;
- project 3: compute after two weeks of real use more than **1.5×** the month before it (read
  in the Neon dashboard) means stop and move to the ping option;
- project 4: if the directory has not reached its number of profiles three months after
  project 1 ships, the marketplace is a recruitment problem, not a code one.

## 10. Risks, safety and privacy first

| Risk | Who it hurts | Likelihood | How we would see it | How to undo |
| --- | --- | --- | --- | --- |
| **Health data reaches an unverified person**: a typed badge, a chat confession, a gate refusal that implies a condition | the client | **high** without condition 1; **medium** with it (chat) | reports; `legal` review | badge revocation closes the health read on the next request; hide and retain-limit the chat |
| **A hole in the delegated path** while reshaping the guard and `practising` | every linked client | medium (it is the most-reviewed code, and the most edited by this) | `invariant-reviewer`; the existing `care*` end-to-end suites must stay green unchanged | revert the release; the switch off closes every client route (`withClient`'s first line) |
| **Neon compute suspended by polling** (or by crawlers on public pages) | **every user, production down until the month turns** | medium without hygiene, low with it | the Neon dashboard's compute hours, read weekly in phase 3 | ship the client with polling switched off by a flag; the flag is the kill switch |
| **Premium by self-hire** if premium-by-link is relaxed | the owner's AI and picture budget (the 10 $ picture cap runs out for everybody) | high if relaxed; zero as recommended | `/admin` spend gauges | keep `practiceOpen` as the premium condition |
| **Fraudulent practitioners using NutrIA's credibility** to take money outside the app | clients | medium once the directory is open | reports | hide the profile, ban the account; terms say NutrIA moves no money |
| **Fake ratings** | clients | medium | clusters of new accounts rating one profile | eligibility rules; hide |
| **Empty directory** | the product's reputation | **certain** if opened now | — | dark until N |
| **Owner's time on moderation and badges** | the owner | certain, small at this scale | the reports queue | the first-look queue can be switched off later |

## 11. Cost to run

All **estimated**, at the beta's scale (~8 accounts, tens of professionals at most):

| Item | Cost | Why |
| --- | --- | --- |
| Vercel | **0 € more** | one function already; Pro already paid; polling invocations are well inside the included usage at this scale (read Usage to confirm) |
| Neon | **0 €** while compute stays under 100 CU-h and storage under 0.5 GB | messages ~0.5 KB each: 1,000 pairs × 50 messages a month ≈ 25 MB a month (**estimated**); retention bounds it |
| Push | **0 €** | Apple's and Google's push services are free; VAPID is ours |
| Mail | **0 €** | Gmail SMTP inside the mail budget; coalesced notices |
| Model | **0 € new** | the chat, ratings and directory call no model. A professional's generations are the client's allowance, ~0.24 $ each in pictures (**measured**, 2026-10-12), inside the existing caps |
| Realtime service | **0 €**: not used | — |
| A custom domain (project 6 only) | ~10–15 €/year (**estimated**) | **the owner's decision**; the one item that is money |

## 12. What I do not know

- Whether the `professional` switch is on in production, and how many `professionals` rows
  exist: not read (production is off limits to this agent). The backfill's size depends on it.
- Neon production compute today, the compute floor, and whether development still shares the
  allowance after the 2026-09-24 split. The polling margin depends on all three.
- Whether `VAPID_*` is set in production, and whether push reaches the owner's iPhone from the
  home-screen app. One test on his phone settles it.
- Whether the colleges' public registers let the owner verify a number in minutes
  (**hypothesis**: Spanish professional colleges keep a public register of members; `legal` to
  confirm).
- Whether real dietitians want this at all. No code measures that. Five conversations with
  real dietitians before project 1 would.

## 13. The owner's decisions

Each is offered as a few options, recommendation first.

1. **The marketplace in the product's scope** (`PRODUCT.md` excludes coach marketplaces and
   social features from v1).
   - **Yes, amend the scope** (recommended)
   - Not yet: keep 004 invitation-only
2. **What the badge requires.**
   - **The owner checks the number in the college's register** (recommended)
   - A typed number shown as "no comprobado", with no access to health data
   - No badge: nobody receives illnesses or medication
3. **Does a hired client get premium?**
   - **No, only when the professional pays (deferred)** (recommended)
   - Yes, only for a badged professional
   - Yes, for everybody
4. **How many active clients a free practice holds.**
   - **10** (recommended)
   - 5
   - 30, as the paid plan was
5. **The client's plan when they hire.**
   - **Unchanged until the professional publishes** (recommended)
   - Archived at once
6. **How a professional writes a plan.**
   - **Generator and swaps plus "put this dish here"** (recommended)
   - Generator and swaps only (as today)
   - (Free text is not offered: it cannot pass the allergy gate)
7. **The client's own changes to the professional's plan.**
   - **Swaps allowed, shown to the professional** (recommended)
   - No swaps while hired
   - Swaps go to the professional for review
8. **The assistant while a professional's plan is active.**
   - **On, explains the plan and sends "why" and changes to the professional** (recommended)
   - Off while hired
   - Unchanged
9. **How the chat arrives.**
   - **The app checks while the chat is open, plus push and mail notices** (recommended)
   - A realtime service (a new processor)
   - Mail notices only
10. **How long a chat is kept after the hire ends** (read-only throughout; either account
    deleted deletes the whole thread). Amended after `legal`, § 14.
    - **30 days** (recommended, `legal`'s)
    - 6 months (this report's first recommendation)
    - 12 months
11. **The directory opens when there are…**
    - **10 published profiles** (recommended)
    - 5
    - Now
12. **Before acceptance, each side may write…**
    - **3 messages within 7 days** (recommended)
    - Only the request's message
    - No limit until the decision
13. **Who may rate.**
    - **A hire of 14 days or more with one published plan** (recommended)
    - Any accepted hire
    - A full fortnight with a check-in
14. **New profiles.**
    - **The owner gives each a first look before it appears** (recommended)
    - Published at once, moderated by reports
15. **Public profile pages (project 6).**
    - **After a custom domain and the directory's number** (recommended)
    - Now, on the vercel.app address
    - Never: the directory stays signed-in
16. **What a professional without the badge may read about a client** (added after `legal`,
    § 14).
    - **Only the plan they write and what the client tells them in the chat** (recommended,
      `legal`'s)
    - The full overview (weight, targets, adherence, check-ins), under a consent that names
      each item
    - Nothing structured: without the badge, chat only and no plan
17. **How the owner confirms the account is the registered person** (added after `legal`: the
    register is public, so a matching name and number prove nothing about who typed them).
    - **A code sent to the professional contact the register lists** (recommended)
    - A video call or a meeting
    - A matching name is enough (not recommended: anyone can borrow a real colegiado's number)

## 14. Amended after `legal`'s answers, 2026-11-18

`legal-marketplace` answered § 6's questions the same day. Its full reasoning is in
`docs/legal/2026-11-18-professionals-marketplace.md`, uncommitted at the time of writing. The
points marked there for a lawyer stay open. What its answers change here:

**A premise of mine was wrong.** I wrote that `CARE_SHARED` gives an unbadged professional the
client's allergies. It does not. `profile` shares only the name (consent label «tu nombre»,
`apps/web/src/i18n/dictionaries/es-ES.ts:1466`). Allergies and intolerances are applied on the
client's id but never returned (`CareClientOverviewView`, `CareController.ts:205-212`).
**Confirmed** against both files.

**The real problem is larger than I put it.** The overview's non-health reads are health data
in this context according to `legal`: the weight series, the targets with their derivation,
adherence and the check-in answers. An unbadged recipient has no basis for them except explicit
consent. So `withClient` is reused as a mechanism, but an unbadged link needs a narrower view.
That changes three places:

- **Project 1** gains one design element: a view per kind of professional. `overview` builds
  the badged page as today, and for an unbadged link returns only the plan under way and its
  history (decision 16, recommended). The cut belongs in core, beside the health branch, and is
  asserted by test the way the health key's absence is (004 criterion 12). It moves project 1
  further into "large" and does not change its order.
- **Project 1's consent lists** become two: the badged list (today's `CARE_SHARED`, plus the
  health line) and the unbadged list (the plan, and a line saying the professional may deduce
  allergies from dishes the gate refuses, as `legal` asks).
- **§ 6's table**: "Unbadged never receives illnesses or medication" widens to "unbadged
  receives only the plan they write and the chat", enforced in the same place, `withClient`.

**The badge needs three things, not one** (decision 17 added): the register lookup (number,
name, «habilitado»), proof that the account is that person, and a dated record with a yearly
re-check. The yearly re-check needs one more column (`badge_checked_at`) and a line in the
console. A daily-cron reminder to the owner costs nothing.

**The title filter grows.** Refused without the badge, in the display name, the headline **and
the free «studies» field**:

- «dietista», «nutricionista», «D-N», «colegiad…», and «graduado/diplomado en Nutrición
  Humana y Dietética»;
- the other titled professions: médico, endocrino, enfermero/a, farmacéutico/a, psicólogo
  sanitario;
- clinical words in unbadged labels: «consulta», «paciente», «tratamiento», «clínico».

Allowed, beside a fixed «No es un profesional sanitario verificado por NutrIA»: «asesor/a de
alimentación» and «coach nutricional».

One knock-on: the professional's workspace is called `/consulta` and its people «pacientes»
(004 decision 10). For an unbadged practitioner the screens need neutral words. That is a
dictionary split, small, and belongs to project 1.

**Chat** (decision 10 amended):

- NutrIA is the controller of the chat as a service.
- No export and no per-client archive for the professional, or NutrIA becomes their processor.
- Explicit consent before the first message.
- No model, logs, error reporter or analytics on message text.
- 30 days read-only after the link ends.
- The reporter's copy is acceptable if it holds only the reported messages and minimal
  context, each read by the owner is logged, the terms say so, and nothing is scanned.

All of that fits § 4.3. The log of the owner's reads adds one table to project 3.

**Reviews** (project 5) gain:

- a sentence saying exactly how reviews are checked («solicitud aceptada en NutrIA; no
  comprobamos el servicio ni el pago»);
- a 30-day window after the hire ends to leave one;
- removal at the professional's request only on proof;
- a warning on the reply box.

**Intermediation applies even with no contract or payment in the app.** The P2B rules on terms
for business users, ranking transparency and complaint handling apply. So do the DSA articles
that survive the micro-enterprise exemption: contact points, terms, notice-and-action,
statements of reasons, and the complaint path. In code that means:

- a visible ranking rule in the directory (for example "ordered by most recent activity",
  stated on the page);
- a reason sent with every hide or unpublish;
- a way to contest one.

Those land in projects 4 and 5 and add perhaps a few days. The texts are `legal`'s.

**Nothing in the verdict moves.** The five conditions stand, and condition 1 is now three
steps. The project split stands. The new owner decisions are 16 and 17.

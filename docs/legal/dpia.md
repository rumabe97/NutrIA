# Data protection impact assessment (DPIA, *EIPD*) — NutrIA

> **Purpose**: the DPIA art. 35 GDPR requires, with the structure of the AEPD's guide
> *Gestión del riesgo y evaluación de impacto en tratamientos de datos personales*:
> description, necessity and proportionality, risks, measures, residual risk, action plan and
> conclusion. **Audience**: the owner (the controller, who signs it), the lawyer, the AEPD if
> it asks. **Committed**: yes. **Maintained by**: the `legal` agent; it is reviewed with every
> change that moves health data and, in any case, every year.
>
> **I am not a lawyer.** This is a draft the controller must review, complete where indicated
> and approve with a date. A DPIA the controller has not approved does not count.

| Field | Value |
| --- | --- |
| Controller (*responsable*) | {name} (see `legalIdentity.ts`) |
| Processing | (1) meal planning with health and belief data, with generative AI; (2) communicating data to dietitian-nutritionists (project 004) |
| Version / date | 0.7 draft, 2026-11-05 — **project 011 phase 10, in the working tree and unmerged (true once merged)**: the web app's Content-Security-Policy moves from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. The header's **name** is the only thing that changes; the policy's value is the one production already sends. This version **discharges what 0.4 left open** ("R8, R10 and M13, not scored again — 011's phase 10 does that"): **R8 is scored again and stays at 3**, **R10 is confirmed at 1**, M13 now describes what is in production instead of what was pending (phase 8 is in `main` since 2026-10-08, #217, with no flag of its own), **phase 7b** (#242, `0089`) and **the 30-day sweep of an account nobody confirmed** (#250, `0092`) are recorded here for the first time, and the web's security headers get a measure of their own, **M20**. **No new recipient, transfer, category, period or art. 9 datum, and no new criterion from the AEPD's art. 35.4 list**: a response header is not a processing operation, it carries nobody's data and it changes nothing anybody is told, so §§ 1 and 2 move only where `0092`'s period was missing. What it does change is **what the owner can find out afterwards**, and M20 says so where it matters: `report-uri` is **not a detection measure** (art. 33.1 awareness). Previously: 0.6.2 draft, 2026-11-04 — **project 022 phase 4, unmerged (true once merged) and shipping with its flag off; nothing re-scored**: § 1.2's art. 9 cell for the cupboard and § 1.3's *Use* step both described a product in which the cupboard is read after every pick, which is true only while `pantryRank` is off — and that flag is a row in `app_settings` the owner toggles from `/admin/ajustes` with no deploy in between. Both now read both states. The art. 9 position of [`pantry.md`](./pantry.md) § 5.3 **stands and loses one of its two legs**: what carries it is that no restriction is inferred or presented, not where the read sits. **No new recipient, transfer, category, period or art. 9 datum, and no new criterion from the AEPD's art. 35.4 list** — no cupboard datum reaches the model in either state, and what travels is the list of dishes already chosen. Two published sentences must be replaced before that flag is turned on ([`pantry.md`](./pantry.md) § 9, **P1-11**). Previously: 0.6.1 draft, 2026-11-04 — **one line, nothing re-scored**: § 1.3's *Use* step enumerated who reads the cupboard and the owner was not among them. Project 022 phase 5 gives him two `/admin` aggregates over it (accounts per uncooked catalogue ingredient; a word the catalogue could not answer, from two accounts up). It is a **further purpose** of the same rows, compatible under art. 6.4 and so on no separate basis (recital 50), and art. 13.3 puts the `/privacidad` sentence *before* the first read, not with it. **No new recipient, transfer, category, period or art. 9 datum**, and no new criterion from the AEPD's art. 35.4 list — so R1-R14 and § 5's residual risk stand as 0.6 left them. The one measure worth the line is the floor of two accounts (art. 25.1 with art. 5.1.c), which since 2026-11-04 applies to **both** reads — the words by the query's `HAVING`, the per-ingredient count in the `SELECT` and the `ORDER BY` alike ([`pantry.md`](./pantry.md) § 6, **P2-6** and **P2-10**). Previously: 0.6 draft, 2026-11-03. 0.6 records the cupboard (project 022, phases 1 and 2 in `main`, the screen in phase 3b: §§ 1.2 and 1.3) — an optional list of catalogue foods a person says they already have, spent by the generation that reads it, which reaches no model, changes no pick and adds no recipient, transfer or period of its own, so **nothing is scored again**; it is not an art. 9 datum on the conditional position in [`pantry.md`](./pantry.md) § 5.3, and that condition (no inference, and a screen that invites none) is what § 6 of that document asks the owner to approve. Previously: 0.5 draft, 2026-10-16, which records the kitchen (`0102`, project 021: §§ 1.2 and 1.3) — a closed enum per appliance, optional, no free text, no new recipient, period or art. 9 datum, and no new criterion from the AEPD's list, so nothing is scored again. Previously: 0.4 draft, 2026-10-03 (0.3: 2026-09-28; 0.2: 2026-09-26; 0.1: 2026-09-25). 0.4 records project 011's account measures (phases 1 to 7, in `main`; phase 8, the sign-up that reveals nothing, **unmerged**: PR #217 — true once merged; [`analysis.md` § 4.1 ter](./analysis.md)): R8, R10 and M13, not scored again (011's phase 10 does that); no new health datum, no new criterion from the AEPD's list. 0.3 reviewed the onboarding trim (`0067`, **unmerged**: branch `feat/onboarding-cleanup` — true once merged): §§ 1.2, 1.3, 2, R2, § 6. 0.2 reviewed only the AI processing (`0064`: OpenRouter): §§ 1.3, 1.4, 2, R2, R14, M3, M4, § 5 and § 6 |
| Approval | pending — the controller's signature and date |
| DPO (*DPD*) | not appointed (not mandatory: [`analysis.md` § 5.2](./analysis.md#52-dpo--not-mandatory-today)) |
| Why it is mandatory | The AEPD's list (art. 35.4), criteria 1, 4, 8 and 10; art. 28.2.c LOPDGDD — [`analysis.md` § 5.1](./analysis.md#51-dpia--mandatory) |

---

## 1. A systematic description of the processing (art. 35.7.a)

### 1.1 Nature, scope, context and purposes

- **Purposes**: (F1) computing nutritional targets and generating 14-day meal plans that are
  safe for the declared allergies; (F2) follow-up (adherence, weight, check-in) and adapting
  the next plan; (F3) letting a dietitian-nutritionist the user chooses see and adjust their
  plan (004); (F4) charging for Premium and practice plans; (F5) operation and security
  (sessions, errors, metrics).
- **Data subjects** (*interesados*): adults who want to eat better (users);
  dietitian-nutritionists (professionals); invited people who are not yet users. Possibly
  minors (there is no age gate: P1-4).
- **Scale**: dozens of accounts today; access opened account by account by the owner
  (`0017`). Scope: mainly Spain; the service is in Spanish and English.
- **Context**: a single individual controller, with no staff; *serverless* hosting in the EU;
  third-party AI models; a public code repository.

### 1.2 Data (see the inventory in [`analysis.md` § 1](./analysis.md#1-what-the-product-does-what-i-read-not-what-the-documents-say))

| Category | Examples | Art. 9 |
| --- | --- | --- |
| Identification | name, email, the session's IP and browser | no |
| Body and goal | date of birth, sex, height, weight, the weight series, goal | yes (health, on the broad reading) |
| Allergies and intolerances | the list, free text, severity | yes (health) |
| Way of eating | gluten-free, lactose-free, halal, kosher | yes (health / religion) |
| Declared health | conditions, medication, supplements | yes (health) |
| Cooking and food preferences | meal shape, maximum cooking time, cuisines, tastes | no |
| The kitchen (`0102`, project 021) | for each of ten appliances, "does not have it", "has it" or "would rather cook with it"; a row only for the ones somebody spoke about, no free text | no (an appliance reveals no health, religion or belief) |
| The cupboard (project 022) | what somebody says is already in the house before a fortnight is generated: a catalogue food, their own word for it, an optional amount and unit; at most sixty, a row only for what they named; and on the plan, the slugs and amounts it was asked with plus five counts | no — **conditionally**, and the condition is the whole of it: a food *can* reveal a state of health by deduction (`leche-sin-lactosa`), so what keeps it outside art. 9 is that nothing infers a restriction from it. With project 022's `pantryRank` flag **off** that is also structural — the read happens after every pick, so there is no path from it to a dish. **With the flag on (phase 4, unmerged on 2026-11-04 and shipping off — true once merged) the structural leg is gone and the condition carries it alone**: no restriction inferred or presented, the rank reading a dish's ingredient slugs and nothing about meaning, an order and never a filter, and no join to the health tables or to `dietary_patterns`. [`pantry.md`](./pantry.md) §§ 5 and 9.4 **[lawyer]** |
| Use of the plan | meals eaten or skipped, ratings, comments, check-ins | may contain health |
| The care relationship (004) | the link, the consent version, the access trail | it reveals the person is a dietitian's patient |
| Professional | registration number, the grant, acceptance of the agreement | no |
| Payment | the Stripe customer and subscription ids, status | no |

### 1.3 Life cycle

1. **Capture**: onboarding and the profile (the user), the invitation (the professional types
   an address), the check-in and daily ticks (the user), targets and plans (the professional),
   **the cupboard** before a generation (the user, through a picker over our own catalogue and
   never a free-text box — project 022, phase 3b).
2. **Storage**: PostgreSQL on Neon (`eu-central-1`); Neon's restore copy; a manual export on
   the owner's machine.
3. **Use**: deterministic computation of targets (`packages/core/domain/Nutrition`),
   **the cupboard ordering the library pick** when the owner's `pantryRank` flag is on (project 022
   phase 4, **unmerged** on 2026-11-04 and shipping with it **off** — true once merged): up to five
   of the nineteen dishes offered per meal
   ranked by how few items would have to be bought, an order and never a filter, and no cupboard
   datum reaching the model — what travels is the list of dishes already chosen
   ([`pantry.md`](./pantry.md) § 9),
   **the owner reading two aggregates off the cupboards** (project 022 phase 5, since 2026-11-04:
   how many accounts hold each catalogue ingredient no recipe uses, and a word the catalogue could
   not answer where two accounts or more hold it — neither read selects an account, and it is a
   further purpose told in `/privacidad` before it begins, art. 13.3 with art. 6.4 and recital 50;
   [`pantry.md`](./pantry.md) § 6, P2-6 and P2-10),
   generation with AI (prompt 4.4.0 once `0067` is merged: no identifiers, health, free text
   or the shape and hours of the day, budget or cooking frequency; since 4.9.0, `0102`, two
   more structured lines with nobody's words: the appliances they do not have and the ones
   they would rather cook with, as catalogue keys; § 1.3 of the analysis;
   since 2026-09-26 no call at all, `stub`; after `0064`, OpenRouter), deterministic allergy
   checking (`findSafetyViolations`), the professional's access through
   `CareController.withClient` with a trail row.
4. **Disclosure/communication**: to the linked professional; to OpenRouter and to the company
   that runs the model (after `0064`); to Stripe; to the mail provider; to Sentry (with no
   personal data).
5. **Deletion**: cascading when the account is deleted; invitations at 14 days; **an account
   whose address nobody ever confirmed, thirty days from sign-up** by the daily sweep, if it
   holds no session, no profile, no plan and no trail row naming it, leaving one trail row
   with no actor, no subject and no address (`0092`, project 011); health on
   withdrawal of consent; no purge for metrics and generation jobs; **the cupboard** (project 022)
   by the generation that reads it — or by the next one, in the two branches where that clear is
   skipped or fails — or by the person, and what the plan recorded of it with the plan; the one
   case with no end of its own is a draft nobody ever generates from
   ([`pantry.md`](./pantry.md) §§ 3.1 and 3.2).

### 1.4 Assets and processors

Vercel (compute, `fra1`), Neon (the database, the EU), OpenRouter (the US, a processor, after
`0064`) and the company that runs the model (the US; proposed: DeepInfra or CoreWeave, a
closed list on the account and in the code since 2026-09-26 — P1-12), Google (SMTP mail),
Stripe/Link, Sentry (optional), browser push services. The owner's machine (credentials,
exports). The OmniRoute gateway is no longer in production (experiments only).
**Dish pictures** (project 006, 2026-09-27, with its flag): Vercel Blob (`fra1`) stores and
serves the images. The drawing (Google on Vertex; Microsoft's MAI, out since 2026-09-27) and
the judge (DeepInfra) receive only the recipe, nothing of anybody's: they are not processors.
Since 2026-09-30 (project 009 phase 2) a second Vercel Blob store, private and in `fra1`,
keeps the last image the judge rejected for a dish for the owner to look at: it holds no
personal data and changes no risk in this assessment. Since phase 3 of the same project the
owner can publish that image by hand, against the judge, and withdraw it: there is still no
personal data, and the risk that does change (an image showing an allergen the dish does not
carry) is not a data protection risk; it is in [`dish-pictures.md`](./dish-pictures.md) § 5,
IMG-2. Since project 010 phase 3 the dish's row stores what the judge answered about each
attempt (a model's words about a photo of food, and the recipe as it was judged): no personal
data, it touches no risk in this assessment (§ 4.5 of that document). The detail is in
[`dish-pictures.md`](./dish-pictures.md) § 4.

---

## 2. Necessity and proportionality (art. 35.7.b)

| Question | Answer |
| --- | --- |
| A legitimate basis? | Yes, with the changes in [`analysis.md` § 3](./analysis.md#3-legal-bases-and-the-art-9-exception): explicit consent (9.2.a) for all health and belief data; today it is missing for allergies and body data (**P0-2**). |
| Purposes specified and limited? | Yes. There is no advertising, no selling and no profiling for third parties. |
| Minimisation? | Good by design: medication has no dose because nothing would use it; the AI receives no identifiers and no declared health; the professional does not see allergies, the email or the comments; the trail does not store the payload. **An improvement (`0067`, once merged)**: onboarding stops asking for ten fields that served no declared purpose — waking and sleeping time, training days and time, work schedule notes, budget, cooking frequency, breakfast style, portion preference and the free-text custom goal — they are not merely no longer sent to the AI, they are no longer collected (art. 5.1.c), and migration `0043`, in the same change, sets those ten fields to `NULL` for every account, not only new ones (P2-13, closed). **Excesses**: ~~free-text allergies and check-in comments going to the AI~~ (removed in prompt 4.0.0, P0-3); "Halal"/"Kosher" as a label rather than a restriction (P2-1). |
| Accuracy? | The user corrects it from their profile; overridden targets are revalidated on every read. |
| Storage limitation? | Partial: a full cascade on deletion; since `0092` (project 011) an account whose address nobody confirmed has a period of its own, thirty days; periods are missing for metrics and jobs (P2-4) and for the manual export (P1-6). |
| Information? | Insufficient today (P1-2, P1-3, P1-5); new texts in `textos/`. |
| Rights? | Access, rectification and erasure in the product; portability by mail (P2-9); withdrawing the health shared with the professional without ending the link: **it does not exist** (P0-1). |
| Transfers? | To the US; the DPF (Vercel, Neon through Databricks, Stripe, Sentry: verified 2026-09-26) or standard clauses (OpenRouter, in its DPA — P1-11). The companies that run the model have no guarantee of their own towards NutrIA: the request identifies nobody ([`analysis.md` § 4.2 and § 4.4](./analysis.md#42-international-transfers-arts-44-49)). |
| Is there a less intrusive alternative? | For the AI: both have been done — the prompt no longer carries free text, health or beliefs (4.0.0) and `0064`'s change moves to paid models with no training and no retention. The least intrusive of all is the current one (`stub`, no model), at the cost of new dishes; a provider with a direct contract in the EU (Mistral) would close P2-11. For 004: the minimum is already shared; health goes on a separate line. |

---

## 3. Risks to rights and freedoms (art. 35.7.c)

Likelihood (P) and impact (I) from 1 (low) to 4 (very high); risk = P × I. **Inherent** is
before the measures; **residual**, after the § 4 measures already in place **and** the pending
ones marked.

| # | Threat | Harm to the person | P | I | Inherent | Measures (§ 4) | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | A dish with a declared allergen reaches the plan | An allergic reaction, anaphylaxis | 3 | 4 | **12** | M1, M2 | 4 (unresolved free text is still "best effort" and the user knows it) |
| R2 | Data sent to the AI reused by a provider to train, or stored | A loss of control; exposure of preferences and goals (no longer of allergies, beliefs or comments: prompt 4.0.0; no longer of the shape and hours of the day or the budget or cooking frequency: prompt 4.4.0, `0067`, once merged) | 4 until 2026-09-25; 1 since 2026-09-26 (`stub`) | 3 → 2 (prompt 4.x) | **12** → 2 | M3, M4 | 2 with M3 (OpenRouter's anonymous categorisation, P2-12) |
| R14 | The AI request ends up at a company or in a country the policy does not name (say an endpoint in Indonesia) | A transfer with no guarantee; false information | 3 with the account not on a closed list; 1 since 2026-09-26 | 2 | 6 | M3 (closed list ✔: the account and `AI_PROVIDER_ONLY`) | 1 |
| R3 | A professional sees the data of somebody who did not accept, or after it ended | Health disclosed to a third party | 2 | 4 | 8 | M5, M6, M7 | 2 |
| R4 | A professional uses what they see outside the care relationship (sharing, advertising) | Disclosure; discrimination | 2 | 4 | 8 | M8 (**agreement pending**), M7 | 4 |
| R5 | Somebody shares their health with the professional unknowingly, or cannot stop doing so | Vitiated consent; a loss of control | 3 today | 3 | 9 | M9 (**pending**) | 2 |
| R6 | A minor obtains a weight-loss plan | Harm to a minor's health; invalid consent | 2 | 4 | 8 | M10 (**pending**) | 2 |
| R7 | Unauthorised access to the database or the export | A mass health data breach | 2 | 4 | 8 | M11, M12 (**encryption pending**) | 3 |
| R8 | Session or account theft (including a professional's with several patients, or the admin's) | Several people's health disclosed | 2 | 4 | 8 | M13, M20 | **3 — scored again on 2026-11-05, as 0.4 promised, and unchanged.** Project 011 is complete (phases 1 to 10): a password that is not in a public breach list, the brake per address and per IP, two-step verification with backup codes and the 48-hour removal, passkeys, the mandatory factor on a professional's or the admin's password account, a sign-up and a sign-in that reveal nothing, and since phase 10 a Content-Security-Policy that **enforces** (M20). The likelihood of an account being taken from the outside has fallen with all of that; the **impact** has not moved, and the two legs this row has always stood on are untouched: (a) none of it reaches a session **already** in somebody else's hands — these measures are about getting one, not about holding one; (c) a professional who signs in with Google only depends on Google's two-step verification, which NutrIA cannot check. Phase 10 narrows a third leg without closing it: the session cookie is `httpOnly`, so no script could ever read it, and what `connect-src 'self'` and `form-action 'self'` now refuse is a script **sending** what a signed-in page can see — by `fetch`, by a beacon or by submitting a form — anywhere but this host. It refuses no more than that: no CSP directive governs a top-level **navigation**, so a script that opens a foreign address with the data in its URL is outside the policy, and `script-src 'unsafe-inline'` means the injected script itself would still run (M20). **What would take this row to 2** is a measure against a session already stolen (binding it to the browser, or a shorter life) or the second factor made mandatory for a professional's Google account too; 011 does neither, so it stays at 3 rather than being scored away. Phase 6 lowers the likelihood of the worst case — a professional's or the admin's account — when the attack starts from the password. **It does not close R8**: (a) it does nothing against an already-stolen session; (b) ~~a session opened with the password alone before the verification was switched on stays alive afterwards and passes the gate~~ — **resolved in phase 6** (`168f12f0`, PR #214): switching the verification on revokes the account's other sessions, with an end-to-end test; (c) a professional who signs in with Google only depends on Google's two-step verification, which NutrIA cannot check |
| R9 | Health data in logs, errors or mail | Accidental disclosure | 2 | 3 | 6 | M14 | 1 |
| R10 | The invitation, the sign-up or the sign-in reveals to a third party that somebody has an account or is a patient (in a diet product, having an account already hints at something about weight or health) | The care relationship or a health interest disclosed | 2 | 3 | 6 | M15, M13 | **1 — confirmed on 2026-11-05** (0.4 deferred this row to phase 10 too): phase 8's measures are in `main` since 2026-10-08 (#217) and in production with no flag of their own, so the invitation, the sign-up and the sign-in answering the same whether or not the account exists is a fact and no longer a pending one |
| R11 | A plan that is not safe on calories or protein (the AI's or the professional's) | Harm to health | 2 | 3 | 6 | M16 | 2 |
| R12 | The user believes NutrIA replaces a professional | Badly informed health decisions | 2 | 3 | 6 | M17 | 3 |
| R13 | Being unable to exercise rights (portability, restriction) | A loss of control | 2 | 2 | 4 | M18 (**export pending**) | 2 |
| R16 | **The typed dish request** (report `0011` § 4 a, decision `0100`): a field where somebody types a dish name carries something about themselves — a condition, a child's name, who the dish is for — and the model writes it back into the stored dish's **name or method**, which lands in the shared `recipes` library, reaches the picture model at Google (Vertex) through the name, or stays in a server log before any gate runs | Health or an identity disclosed to every other user of the product and to a recipient the policy does not name for that purpose; an erasure that cannot be honoured, because the dish survives the account | 3 with no measures (an open field invites it) | 4 | **12** | M19 ✔, M3, M14 | **2** — the five conditions of [`analysis.md`](./analysis.md) P0-3 at 2026-10-13 all hold since `2acf185e` (2026-10-13), each verified against the code. What is left is a model writing, into a gated name and a gated method, something that is about a person and uses only ordinary food words in the Latin script: not reachable by steering, since what the person typed can carry neither a quote nor a newline, and not detectable by any gate that does not read meaning. **12 again the day any one condition lapses**, and the two that lapse quietly are the charset on the name and the absence of a log line |
| R15 | Somebody with an allergy trusts a dish's image (006), which does not show an ingredient the dish carries | An allergic reaction | 2 | 4 | 8 | M1 (the allergen gate runs against the list, not against the image); the caption "It is indicative: the ingredient list rules" and a sentence in the terms ([`dish-pictures.md`](./dish-pictures.md) § 3). The vision judge does **not** mitigate this risk: it only looks at what is extra, never at what is missing, and since 009 phase 3 the owner can publish by hand an image the judge rejected; that act does not touch R15 either (the image still decides neither what the dish carries nor who it is given to). What is extra is IMG-2 | 2 |

---

## 4. Measures (art. 35.7.d)

| # | Measure | Status |
| --- | --- | --- |
| M1 | Allergies enforced in code by comparing ids (`findSafetyViolations`), before storing and before returning; `SafetyController.getSafetyProfile` the one assembler | ✔ |
| M2 | Unresolved free text declared "best effort" to the user; a dish with unresolved ingredients rejected | ✔ |
| M3 | Only AI providers with a processor contract, no training, zero retention, a transfer guarantee; and not sending free text or religious labels | Free text and labels: ✔ (4.0.0). Production with no model since 2026-09-26 ✔. For the change (`0064`): code ✔ (`NO_TRAINING_PROVIDER`: `zdr`, `data_collection: 'deny'` on every request); the account and the key (training off, ZDR, two models, a cap) — the owner; a closed provider list ✔ (2026-09-26: DeepInfra and CoreWeave, on the account by the owner and on every request through `AI_PROVIDER_ONLY`); **pending**: OpenRouter's DPA in hand (P1-11) |
| M4 | The AI receives no identifiers and no declared health; the boundary test `health-boundary.spec.ts`; no session header towards OpenRouter (`resolveCallSettings`); OpenRouter's prompt logging off | ✔ (the prompt logging: the owner, when configuring the account) |
| M5 | Access only through `withClient` (the link's id, the session, an `active` status), a 404 denial, no caching | ✔ |
| M6 | A single-use invitation, hashed, 14 days, the session's email must match | ✔ |
| M7 | A trail visible to the client of every read and write | ✔ |
| M8 | The professional's agreement accepted and versioned before the practice opens; the grant withdrawn on breach | **pending (P1-1)** |
| M9 | A separate health line, unticked by default, **withdrawable without ending the link**, with true wording | separate ✔; withdrawable and the wording **pending (P0-1)** |
| M10 | An age gate (18, the owner's decision of 2026-09-25) on the server | **pending (P1-4)** |
| M11 | Only `apps/api` opens a connection; ownership through `WHERE userId`; the session re-read on every request | ✔ |
| M12 | The manual export encrypted, on an encrypted disk, deleted at 30 days | **pending (P1-6)** |
| M13 | Better Auth: hashed passwords, a per-IP attempt limit in the database, strict account linking, sessions revoked on reset, `httpOnly`/`secure`/`lax` cookies. **Project 011, in `main`**: a password of 12 to 128 characters that is not in known breaches, checked on the server against Have I Been Pwned (if it does not answer within 2 seconds, the password goes through and a log line is left), and a breached one is changed before going on (phases 1-2); changing the password revokes the other sessions and the person sees and revokes their sessions (phase 2); optional two-step verification with an authenticator app and single-use backup codes (phases 3-4); the removal of a lost second factor only on a request from the account's address and from 48 hours on ([`removing-a-second-factor.md`](./removing-a-second-factor.md), phase 4); passkeys (phase 5, `0083`); a professional's or admin's account **that has a password** opens no patient or console route without two-step verification switched on (a 404, like every denial), a passkey does not replace it, an account with Google or Apple only passes, and switching it off or the owner's removal closes the gate on the next request (phase 6, `core/domain/SecondFactor`, `ProfessionalGuard`, `AdminGuard`); a per-address attempt brake (phase 7). **Phase 8** (in `main` since 2026-10-08, #217, with no flag of its own): sign-up and sign-in answer the same whether or not the account exists, the owner of an address that is already registered gets a notice, signing in with a password requires a confirmed address, and three mails per address per hour. The brakes store an HMAC fingerprint of the address, not the address, and they expire in one or two days. **Phase 7b** (#242, `0089`): the browser that has already signed in with the password keeps a cookie whose random code is held only as a SHA-256 fingerprint beside the account's id, ten per account, 90 days, so that a brake somebody else provoked against the address does not punish the person who already got in; that browser's own failures count against a brake of its own. **The sweep of an account nobody confirmed** (#250, `0092`): thirty days from sign-up, with one trail row that names nobody (§ 1.3, step 5). **Phases 9 and 10, the web's security headers: M20** | ✔ in production: phases 1 to 8, phase 7b and the sweep (phase 6 also revokes the account's other sessions when the verification is switched on — R8 b, `168f12f0`). Phases 9 and 10 are M20's line |
| M14 | Pino redaction of health fields; Sentry with no body, user or headers; mail with no health words | ✔ |
| M15 | The invitation route answers the same whether or not the account exists; the mail in the background | ✔ |
| M16 | An energy floor and a protein ceiling enforced in code against any target, the professional's included (`targetViolations`) | ✔ |
| M17 | Supervision notices and disclaimers; "not a user" for clinical nutrition | ✔ (the linked wording could be better, `05` § E) |
| M18 | A data export in JSON | **pending (P2-9)** |
| M19 | **The open-channel rule for a typed dish request** (R16), the five conditions of [`analysis.md`](./analysis.md) P0-3 at 2026-10-13: the typed string **and every ungated draft the model wrote** are transient and stored and logged nowhere; nothing but the gated name reaches the picture or judge call; **every model-written string of the stored dish** — name, `steps[].text`, `steps[].cue`, `cuisine` — is gated against carrying this account's name or its health words; a notice sits at the field; the providers stay as `0064` leaves them. Held mechanically: the allowed-keys test in `apps/api/src/modules/ai/health-boundary.spec.ts` gains the new field **on purpose**, plus a sentinel that the typed string reaches no picture call, no row and no log | ✔ **2026-10-13, `2acf185e`**, verified against the code: `storableName` + `NAME_CHARACTERS` on the name, `storableProse` on `steps[].text`, `steps[].cue` and `cuisine` (`DishRequest.ts:365-387`, called at `FixedMeals.service.ts:363`), `DishNaming` on all fourteen log lines (`PoolBuilder.service.ts:185`), `typedName` refusing the quote and the backtick at the route and again in the service, the field notice, and the providers unchanged. The `/privacidad` sentence «no queda en ningún registro» **can be published**: both routes take the words in a body, the web page keeps the search in React state and never in a URL, no body is logged, Sentry drops `request`, and nothing else on the path logs at all |
| M20 | **The web app's security headers** (project 011, phases 1, 9 and 10; `apps/web/next.config.js`, `apps/web/csp.js`): no framing (`X-Frame-Options`, and `frame-ancestors 'none'` — the password-reset link carries its token in the URL), no MIME sniffing, the origin and not the path in a referrer, camera, microphone and geolocation refused, and a **Content-Security-Policy that enforces** since phase 10 (report-only from phase 9): `default-src 'self'`, pictures only from the app, `data:`, `blob:` and Vercel Blob, `connect-src 'self'`, `font-src 'self'`, `worker-src 'self'`, `manifest-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. **What it catches is a foreign origin, a plugin, a framing parent and a changed `<base>` — not an injected script**: there are no nonces (a nonce makes the page dynamic and `/` must stay prerendered), so `script-src` allows `'unsafe-inline'` and an injected inline script would still run. Against R8 it therefore narrows **exfiltration and framing**, never credential theft: the session cookie is `httpOnly` and no script can read it. And the exfiltration it narrows is the `fetch`, beacon and form kind only — nothing in a CSP governs a top-level navigation, so data carried out in the URL of a page a script opens is outside it. **`report-uri` is not a detection measure.** A browser posts violations to `POST /csp-report`, which logs the directive and the blocked origin — never the document URL, a query string or the client address — and keeps **nothing**: the log line is the whole record, and it lives as long as Vercel keeps runtime logs, **one hour** on the Hobby plan and one day on Pro. Nobody reads them as a routine, nothing alerts on them, and no copy survives, so **awareness under art. 33.1 comes from elsewhere** — a provider's notice, a person, or the owner's own review ([`breach-procedure.md`](./breach-procedure.md) § 4 and § 8). Vercel's own request log carries the caller's address for this route as for every other, with that same life; the route stores nothing in the database (its rate-limit counter is a map in the process, ≤ 60 s) | ✔ in production: the simple headers since phase 1, the policy report-only since phase 9 (#212). **Enforcing**: in the working tree on 2026-11-05, true once merged — read on production as the report-only value that day, so the name is the only difference. **What is not in place**: any way of noticing, once the hour has passed, that the enforcing policy is blocking something legitimate — § 6, order 11 |

---

## 5. Residual risk and prior consultation (art. 36)

- **With the pending measures in place**, no residual risk is left at a high level (≥ 9): the
  DPIA concludes that the processing **may** be carried out without prior consultation of the
  AEPD.
- **Without M3, M8 and M9**, R2 (12), R4 and R5 (9 today) are left high. **With those residual
  risks high the `professional` flag must not be switched on**. R2 no longer affects
  production since 2026-09-26 (`stub`); **`AI_PROVIDER=openrouter` must not be set without M3
  complete** (P1-11 is missing today): with no contract, the policy cannot say "under
  contract" and there is no art. 28 processor.
- **Project 011's phase 10 (2026-11-05) leaves no row high and lowers none**: M20 is
  preventive and narrow, and R8 stays at 3 for reasons an enforcing policy does not touch. It
  brings a failure mode of its own, on the **availability** side of art. 32.1 rather than on
  confidentiality: a policy missing an origin the app really loads from blocks that resource
  on everybody's screen at once. That is **not a personal data breach** (art. 4.12: nothing is
  destroyed, lost, altered or disclosed — the data stay in the account, and a page that does
  not render is not a loss of them), and it cannot make a plan unsafe either, because the
  allergen gate runs on the server before anything is returned (M1), so what reaches a browser
  is already safe. What it is, is art. 32.1.b (availability) with art. 32.1.d (a process for
  regularly testing the effectiveness of a measure) — hence § 6, order 11. Nothing here calls
  for prior consultation; the point of that entry is that the duty to *test* a measure is not
  satisfied by having shipped it.

## 6. Action plan

| Order | Measure | Who | Before |
| --- | --- | --- | --- |
| 1 | M3 — OpenRouter's DPA (P1-11). Done: the closed list (P1-12), the new model's licence (P1-13: Gemma 4, Apache 2.0) | the owner | the move to `openrouter` |
| 2 | Explicit consent for the profile (P0-2) | backend + frontend | now (production) |
| 3 | M9 — withdrawing health from the link + the texts | backend + frontend | the `professional` flag |
| 4 | M8 — the professional's agreement | backend + frontend | the `professional` flag |
| 5 | M10 — age | backend + frontend | now |
| 6 | M12 — an encrypted export | the owner | the next export |
| 7 | The `textos/` texts | frontend | the `professional` flag / the *live* keys |
| 8 | M18, the purges | backend | the yearly review |
| 9 | ~~P2-13 — a migration dropping (or nulling) the ten onboarding columns `0067` leaves with no reader~~ | backend | **done 2026-09-28**: migration `0043`, in the same change as `0067` |
| 10 | M13 — on switching two-step verification on, revoke the account's other sessions (R8 b): **done** in phase 6 (`168f12f0`); the professional's agreement § 8 with mandatory verification and Google's ([`textos/01`](./textos/01-acuerdo-profesional.md), version 1.1.0): **done** in phase 6 (`44924577`). Both in PR #214, true once merged | backend + frontend | a real professional accepting the agreement |
| 11 | **A way of noticing that the enforcing policy is blocking something legitimate** (M20; art. 32.1.b with art. 32.1.d). The violation reports are the only signal there is, nothing stores them and they survive **one hour** (Vercel's runtime logs, Hobby). Until something keeps or alerts on them, two things stand in, and both have to be done rather than assumed: (a) whoever deploys a change to the policy reads the API's logs for `csp-report` lines **inside the hour after that deploy** — the only window in which the evidence exists; (b) a `/local-probe` walk over a production build with the policy enforcing before it ships, which is what phase 10 did on 2026-11-05 (24 screens — 7 public, 11 signed-in, 6 admin — zero violations, zero console errors, zero failed requests). The same applies before an origin is added or a directive loosened, and the day a third-party script arrives (Stripe's checkout is the first one due: [`go-live-checklist.md`](./go-live-checklist.md) § 2) | the owner + the lead | every change to the policy, from phase 10 on |

## 7. Approval

The controller declares that he has reviewed this assessment and taken on the action plan.

Date: __________ Signature: __________ (outside the repository: the signature is not
published)

## 8. Addendum 2026-11-10: the assistant (project 023; art. 35.11 review)

**What changes in the risk**: three things.

1. **A new store of free text written by the person** (`ai_conversations`, `ai_messages`),
   which may hold health data they type despite the warning (art. 9.1; C-184/20).
2. **A new processor** for that text and for a context built from the profile and the plan:
   Anthropic, through Anthropic Ireland, Limited, with an onward transfer to the US and, with
   `"global"` inference, possibly to other countries.
3. **A per-person usage ledger** (`assistant_usage`), with no text.

The full inventory is in [`assistant-privacy.md`](./assistant-privacy.md) § 1, and the record is
row 10.

**Risks to a real person, and what stands against each.**

| Risk | Likelihood before the measures | Measures | Residual |
| --- | --- | --- | --- |
| R-A1. Somebody types a condition or a medication and it is sent and kept | likely, sooner or later | the warning (AI Act art. 50.1 and minimisation), as shown since 2026-11-12 (#371): in full while a conversation has no message; once it has one, folded at the head of the thread to one line that says it is an AI and repeats clause 6's words ("no escribas aquí enfermedades, medicación ni otros datos de tu salud"), with the full text one tap away; and, in every state, a shorter line directly under the box ("Te responde una IA: no escribas aquí datos de tu salud"), read with the field; the lexicon stops the clearest cases before any call; a question judged clinical is stored empty (F2); deletion at will; six months; nobody else reads it | low, and **not legitimised**: no art. 9.2 exception fits volunteered text (**[lawyer]**, `assistant-warning.md` § 4, 17(a)) |
| R-A2. Health data reach Anthropic from the profile | was present: allergy names (F1) and the goal and the way of eating (F5) | both removed on 2026-11-10; the boundary test fails on any allergy-, goal- or diet-shaped key; the health wall (`health-boundary.spec.ts`) holds | low (the targets remain, **[lawyer]** 17(g)) |
| R-A3. Somebody else reads a conversation (the owner, a professional, a breach) | possible | owner-scoped repository, 404 to others; no console screen, export, care-link reader, log line or error report; database access only to fix a fault; Neon's encryption at rest | low; a database breach would expose conversations as it would any table (breach procedure applies) |
| R-A4. An answer names a food a person is allergic to | possible: a model's own words | the allergen net on every sentence against the **profile's** allergies, on our server; the stored answers are screened again against today's allergies before being shown or replayed; the warning sends allergies to the profile | low; the net matches on spelling (`AllergenNet.ts`), so it stays a risk to measure (phase 6) |
| R-A5. Anthropic keeps the content longer than we do | certain for up to 30 days; up to 2 years if flagged | the policy says so; a no-training clause; a DPA with SCCs; minimisation of what is sent | medium for a flagged conversation, which our deletion cannot reach (**[lawyer]** 17(j)) |
| R-A6. Somebody takes an answer as medical advice | possible | the warning; the clinical refusals; the terms (T1, T4); an intended purpose outside the MDR | low |

**Amended 2026-11-12: the warning folds** ([`2026-11-11-redesign.md`](./2026-11-11-redesign.md)
§ 6; shipped in #371, `35d5da30`). What the code does at that commit:

- **The measure R-A1 rests on now sits where the person types, in every conversation.** The
  line under the box (`assistant.composerNotice`) is drawn whatever state the warning is in,
  directly under the box in the sticky composer, and it is the field's description, so a
  screen reader reads it whenever the box takes focus (`AssistantChat.tsx:457`, `:488-492`).
  Before #371, a reopened thread opened scrolled to its end (`AssistantChat.tsx:130-131`,
  unchanged), with the warning above the fold: finding F-W1. That line closes it. The folded
  note itself is at the head of the thread, so in a long reopened thread it is reached by
  scrolling up or by reading in order, not seen on arrival.
- **What has been seen, and what has not.** The lead's browser check (project 024 `LOG.md`,
  phase 5) found the line above the bar on arrival at 390 and 320 px, and, with the box focused
  in an emulated phone, the line as the last thing on the page. **Whether it stays in view above
  a real phone's on-screen keyboard has not been seen**: the LOG lists the keyboard as the
  owner's first open check. Until he has looked, "in view while typing" is the design's intent,
  not an observed fact.
- **Nothing is stored.** Which state is drawn is worked out from the turns on screen
  (`folded={shown.length > 0}`, `AssistantChat.tsx:339`); the open state is React state only
  (`:95`, `:342`). A reload or a new conversation starts again in full or folded.
- **R-A1's residual is unchanged** ("low, and not legitimised"), and slightly better in fact,
  because a reopened thread now carries the health instruction beside the box the person
  writes in.
- **R-A4 and R-A6 rest on the full text** (clauses 7 and 3). It is in full at the start of every
  new conversation, one tap away («Aviso completo») in a conversation that has messages, and
  said in `/privacidad` and the terms. **Their residual (low) is unchanged.**

**Verdict**: with these measures the residual risk is acceptable. **No prior consultation**
(art. 36.1). The conditions are the boxes of [`go-live-checklist.md`](./go-live-checklist.md)
§ 0 undecies. The controller signs this addendum with § 7.

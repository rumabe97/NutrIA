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
| Version / date | 0.4 draft, 2026-10-03 (0.3: 2026-09-28; 0.2: 2026-09-26; 0.1: 2026-09-25). 0.4 records project 011's account measures (phases 1 to 7, in `main`; phase 8, the sign-up that reveals nothing, **unmerged**: PR #217 — true once merged; [`analysis.md` § 4.1 ter](./analysis.md)): R8, R10 and M13, not scored again (011's phase 10 does that); no new health datum, no new criterion from the AEPD's list. 0.3 reviewed the onboarding trim (`0067`, **unmerged**: branch `feat/onboarding-cleanup` — true once merged): §§ 1.2, 1.3, 2, R2, § 6. 0.2 reviewed only the AI processing (`0064`: OpenRouter): §§ 1.3, 1.4, 2, R2, R14, M3, M4, § 5 and § 6 |
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
| Use of the plan | meals eaten or skipped, ratings, comments, check-ins | may contain health |
| The care relationship (004) | the link, the consent version, the access trail | it reveals the person is a dietitian's patient |
| Professional | registration number, the grant, acceptance of the agreement | no |
| Payment | the Stripe customer and subscription ids, status | no |

### 1.3 Life cycle

1. **Capture**: onboarding and the profile (the user), the invitation (the professional types
   an address), the check-in and daily ticks (the user), targets and plans (the professional).
2. **Storage**: PostgreSQL on Neon (`eu-central-1`); Neon's restore copy; a manual export on
   the owner's machine.
3. **Use**: deterministic computation of targets (`packages/core/domain/Nutrition`),
   generation with AI (prompt 4.4.0 once `0067` is merged: no identifiers, health, free text
   or the shape and hours of the day, budget or cooking frequency; § 1.3 of the analysis;
   since 2026-09-26 no call at all, `stub`; after `0064`, OpenRouter), deterministic allergy
   checking (`findSafetyViolations`), the professional's access through
   `CareController.withClient` with a trail row.
4. **Disclosure/communication**: to the linked professional; to OpenRouter and to the company
   that runs the model (after `0064`); to Stripe; to the mail provider; to Sentry (with no
   personal data).
5. **Deletion**: cascading when the account is deleted; invitations at 14 days; health on
   withdrawal of consent; no purge for metrics and generation jobs.

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
| Storage limitation? | Partial: a full cascade on deletion; periods are missing for metrics and jobs (P2-4) and for the manual export (P1-6). |
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
| R8 | Session or account theft (including a professional's with several patients, or the admin's) | Several people's health disclosed | 2 | 4 | 8 | M13 (with 011's: see the measure) | 3, not scored again until 011's phase 10. Phase 6 lowers the likelihood of the worst case — a professional's or the admin's account — when the attack starts from the password. **It does not close R8**: (a) it does nothing against an already-stolen session; (b) ~~a session opened with the password alone before the verification was switched on stays alive afterwards and passes the gate~~ — **resolved in phase 6** (`168f12f0`, PR #214): switching the verification on revokes the account's other sessions, with an end-to-end test; (c) a professional who signs in with Google only depends on Google's two-step verification, which NutrIA cannot check |
| R9 | Health data in logs, errors or mail | Accidental disclosure | 2 | 3 | 6 | M14 | 1 |
| R10 | The invitation, the sign-up or the sign-in reveals to a third party that somebody has an account or is a patient (in a diet product, having an account already hints at something about weight or health) | The care relationship or a health interest disclosed | 2 | 3 | 6 | M15, M13 | 1 |
| R11 | A plan that is not safe on calories or protein (the AI's or the professional's) | Harm to health | 2 | 3 | 6 | M16 | 2 |
| R12 | The user believes NutrIA replaces a professional | Badly informed health decisions | 2 | 3 | 6 | M17 | 3 |
| R13 | Being unable to exercise rights (portability, restriction) | A loss of control | 2 | 2 | 4 | M18 (**export pending**) | 2 |
| R16 | **Planned, nothing built (2026-10-13, report `0011` § 4 a)**: a field where somebody types a dish name carries something about themselves — a condition, a child's name, who the dish is for — and that text is stored in the shared `recipes` library, reaches the picture model at Google (Vertex) through the dish's name, or stays in a log | Health or an identity disclosed to every other user of the product and to a recipient the policy does not name for that purpose; an erasure that cannot be honoured, because the dish survives the account | 3 with no measures (an open field invites it) | 4 | **12** | M19 (**planned**), M3, M14 | 2 with all five conditions of [`analysis.md`](./analysis.md) P0-3 at 2026-10-13; **12 without the output gate**, which is the one that decides it: a transient request still comes back out through the name the model writes |
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
| M13 | Better Auth: hashed passwords, a per-IP attempt limit in the database, strict account linking, sessions revoked on reset, `httpOnly`/`secure`/`lax` cookies. **Project 011, in `main`**: a password of 12 to 128 characters that is not in known breaches, checked on the server against Have I Been Pwned (if it does not answer within 2 seconds, the password goes through and a log line is left), and a breached one is changed before going on (phases 1-2); changing the password revokes the other sessions and the person sees and revokes their sessions (phase 2); optional two-step verification with an authenticator app and single-use backup codes (phases 3-4); the removal of a lost second factor only on a request from the account's address and from 48 hours on ([`removing-a-second-factor.md`](./removing-a-second-factor.md), phase 4); passkeys (phase 5, `0083`); a professional's or admin's account **that has a password** opens no patient or console route without two-step verification switched on (a 404, like every denial), a passkey does not replace it, an account with Google or Apple only passes, and switching it off or the owner's removal closes the gate on the next request (phase 6, `core/domain/SecondFactor`, `ProfessionalGuard`, `AdminGuard`); a per-address attempt brake (phase 7). **Phase 8, once merged**: sign-up and sign-in answer the same whether or not the account exists, the owner of an address that is already registered gets a notice, signing in with a password requires a confirmed address, and three mails per address per hour. The brakes store an HMAC fingerprint of the address, not the address, and they expire in one or two days | ✔ in `main` (phases 1-7); with phase 6, switching the verification on revokes the account's other sessions (R8 b, `168f12f0`); phase 8: once PR #217 is merged and switched on in production |
| M14 | Pino redaction of health fields; Sentry with no body, user or headers; mail with no health words | ✔ |
| M15 | The invitation route answers the same whether or not the account exists; the mail in the background | ✔ |
| M16 | An energy floor and a protein ceiling enforced in code against any target, the professional's included (`targetViolations`) | ✔ |
| M17 | Supervision notices and disclaimers; "not a user" for clinical nutrition | ✔ (the linked wording could be better, `05` § E) |
| M18 | A data export in JSON | **pending (P2-9)** |
| M19 | **The open-channel rule for a typed dish request** (R16), the five conditions of [`analysis.md`](./analysis.md) P0-3 at 2026-10-13: the typed string is a transient prompt input stored nowhere, it never reaches the picture or judge call, the stored dish name is written by the model and gated against carrying anything but a dish, a notice sits at the field, and the providers stay as `0064` leaves them. Held mechanically: the allowed-keys test in `apps/api/src/modules/ai/health-boundary.spec.ts` gains the new field **on purpose**, plus a sentinel that the typed string reaches no picture call and no row | **planned — nothing built (2026-10-13)** |

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

## 7. Approval

The controller declares that he has reviewed this assessment and taken on the action plan.

Date: __________ Signature: __________ (outside the repository: the signature is not
published)

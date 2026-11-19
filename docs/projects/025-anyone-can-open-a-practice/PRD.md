# PRD — Project 025: Anyone can open a practice

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's decisions of 2026-11-18 recorded in
> [`0110`](../../decisions/0110-anyone-may-offer-their-services-and-a-checked-badge-is-what-opens-health-data.md),
> approved by the owner before the plan is written. Repo-relative: no absolute paths, no
> other repositories.

- **Status**: approved by the owner (2026-11-18, by tapped options on its seven open
  questions), pending his read of the plan
- **Roadmap item**: none yet. This is project 1 of the six in
  [`0013`](../../reference/architecture/0013-a-marketplace-of-professionals-2026-11-18.md)
  § 9 (amended by § 14), and the first step of
  [`0110`](../../decisions/0110-anyone-may-offer-their-services-and-a-checked-badge-is-what-opens-health-data.md).
  `docs/ROADMAP.md` gains its line when the plan is approved.

**Sources this PRD is written against, and does not reopen**: the owner's decisions in
`0110`; the architect's read `0013` §§ 2, 9, 13 and 14; the legal read
[`docs/legal/2026-11-18-professionals-marketplace.md`](../../legal/2026-11-18-professionals-marketplace.md),
whose blocking findings **B1** (what an un-badged practitioner sees), **B2** (the badge is
NutrIA's own check), **B3** (texts that turn false are rewritten in the same change) and **B9**
(the DPIA and record of processing come first) bind this project.

## Problem

Project 004 built a workspace for a dietitian whom the owner grants by hand, after reading a
collegiate number from the college's register (`0059`). The owner wants anybody to be able to
offer their services, with the badge, not the grant, deciding who may receive health data
(`0110` decisions 1–3).

What stands in the way today, in code:

- **A professional is the owner's act and nothing else.** The `professionals` row *is* the
  grant (`packages/database/src/schemas/professional.schema.ts`); `collegiateNumber` is
  `notNull`, and `grantProfessionalSchema` (`packages/core/src/entities/Professional`) is the
  only body that creates one. PRD 004 criterion 1 is a test that no request body can.
- **No practice opens without a payment.** `ProfessionalGuard`
  (`apps/api/src/shared/guards/Professional.guard.ts`), `practises` and `activeProfessional`
  (`packages/core/src/controllers/Care/CareController.ts`), and the `practising` join and the
  seat check in `CareRepository` (`packages/core/src/repositories/Care/CareRepository.ts`) all
  require `practiceOpen`, which only the Stripe webhook writes, and payments are deferred. So
  no professional can reach a client in production today (`0013` P2), which is what makes
  reshaping cheap now.
- **Every professional sees the same thing.** `CareController.overview` returns the plan and
  its history, progress (adherence, weight, every check-in with `suggestedKcal`) and the
  targets, and the plan view itself carries the targets (`PlanView.strategy`,
  `PlanDayView.targets`) and adherence (`MealView.status`). The roster's stage reads
  check-ins (`stageOf`: `check_in_due`). A check-in notifies the professional
  (`CheckIns.service.ts` through `activeProfessional`). Under the legal read all of that is
  health data in context (B1), and an un-badged person has no basis for it but a consent
  naming them.
- **Premium follows any open link.** `PlanController.tierOf` makes the client of a practice
  with `practiceOpen` premium (`coveredByOpenPractice`, `0061`). A self-service practice
  must not inherit that (`0110` decision 13).
- **Published texts would turn false** the day an un-checked person can practise: «tras
  comprobar su número de colegiado» on `/privacidad`, the invitation's «dietista-nutricionista
  con número de colegiado», «bajo su secreto profesional», «Tu dietista» on the client's
  screens, the agreement's § 1 (legal § 1.3, B3).
- **`docs/PRODUCT.md` § Scope excludes "coach marketplaces"** from v1 (`0110`, Consequences).

## Outcome

When this project ships:

- Any adult account with a confirmed address can open a practice on its own, accept the
  professional's agreement, fill in a profile (studies as declared, price, opening hours), and
  invite up to ten clients by the invitations that exist today, at no cost.
- A **badge** exists, and only the owner's act gives it: a look at the college's register
  through a link the console shows, a code sent to a professional contact the public register
  lists — never one only the applicant supplies — a dated record, a yearly
  re-check that lapses the badge when overdue. The protected and clinical words appear only
  with it.
- A practitioner **without** the badge sees, of a client, only the plan they write — no
  weight, targets, adherence, check-ins, illnesses or medication — and that cut is made in
  core, on the delegated path, not on a screen. Illnesses and medication reach only a badged
  professional, and only with the client's consent.
- The owner gives every new profile a first look in the console. Nothing is listed anywhere
  public or searchable yet.
- Being linked to a practice does not make a client premium.
- The owner can suspend a practitioner at once, or close a practice with reasons and 30 days'
  notice; a suspended or closed account cannot open a practice again.
- Every text that this makes false is rewritten in the same release, `PRODUCT.md` § Scope is
  amended, and the DPIA and record of processing carry their addendum before the switch opens
  any of it in production.

## Scope

**In**

1. **Self-service "may practise".** An account opens its practice itself. The
   `professionals` row stays the "may practise" row (every join on the audited path already
   reads it, `0013` § 2.3); `collegiateNumber` becomes nullable. Conditions to open: the
   `professional` switch on, a confirmed address, an age of 18 or more **on record** (today's
   `assertOldEnough` passes a null birth date, so a null is not enough; an account that never
   onboarded is asked its birth date on the opening form), two-step verification
   for a password account (as today), and the agreement at its new version before any client
   route opens.
2. **A free practice.** `practiceOpen` leaves the access check (guard, `practises`,
   `activeProfessional`, `practising`). Seats read `practiceOpen ? includedClients : free
   seats`, the free number being **10 active clients** (`0110` decision 13), held as a
   resolved limit in the console's allowances way (`0097`: read, never assumed; the number a
   repository enforces is the one the screen showed). Live invitations keep counting toward the
   seats, as they do today.
3. **No premium by link.** `tierOf` and `coveredByOpenPractice` keep `practiceOpen` as their
   condition, untouched (`0110` decision 13, `0013` condition 2).
4. **The profile, stored and unlisted.** Display name, studies (free text, shown as «Declarado
   por esta persona; NutrIA no lo ha comprobado»), price (labelled «precio final, impuestos
   incluidos», with its unit: per consultation, per month, per plan), opening hours (display
   only, `0110` decision 9). It is visible to its author and to the owner's console, nowhere
   else. No photo (`0013` § 9, cut).
5. **The words.** Server-side, in the profile's schema, in **every** free-text field —
   display name, studies, and any other — and in the practice's own labels:
   - refused without the badge: «dietista», «nutricionista», «D-N», «colegiad…», «graduado/
     diplomado en Nutrición Humana y Dietética», and the clinical words «consulta»,
     «paciente», «tratamiento», «diagnóstico», «clínico», «terapéutico», a disease offered as a
     service, and promised results;
   - refused **with or without** the badge in v1: «médico», «endocrino», «enfermero/a»,
     «farmacéutico/a», «psicólogo/a sanitario/a» (legal § 3.a, the word table);
   - allowed beside the fixed notice «No es un profesional sanitario verificado por NutrIA»:
     «asesor/a de alimentación», «coach nutricional», «asesor/a nutricional».

   The title «dietista-nutricionista» on any screen is rendered from the badge, never from
   typed text. The route `/consulta` is a path, not a label, and keeps its name.
6. **The badge, as the owner's verification** (`0110` decision 2, legal B2). It starts only
   from the practitioner's own application, which names their register and number and tells
   them the register will be read and the result kept (art. 6.1.b, art. 13; nobody who did not
   apply is ever looked up, legal § 3.a). The console then
   shows the declared name and number with a link to the college's public register; the owner
   records a contact and its channel, and the app issues a single-use code for it; the
   practitioner enters it in their practice; the owner confirms. **The channel, in this order
   (decided 2026-11-18, by tapped option, on the `legal` agent's fallbacks):** an e-mail the
   register lists; else a code by post to the register's professional address; else the
   owner's call to a phone the register lists — all three read from the public register. *The
   college-issued e-mail channel was dropped by the owner on 2026-11-18, by tapped option
   (legal C12: nothing said where the owner would learn that address but the applicant).*
   **Never a contact only the applicant supplies.** Every channel carries the art. 14
   information and an "if this was not you" path that records a failed check (legal F2). The
   practitioner is reminded when their re-check falls due (legal C5). The
   record holds who checked, when, which register, the result («habilitado»), the number and
   the channel — never a copy of an identity document. A re-check falls due twelve months later
   and on any report; the console lists what is due, and the daily cron reminds the owner.
   **A re-check overdue by 30 days lapses the badge, with a statement of reasons sent**
   (decided 2026-11-18, by tapped option). Removing a badge for any cause sends the
   practitioner a statement of reasons (DSA art. 17, legal § 3.b).
   A collegiate number is displayed only once checked (legal § 3.a, *Rule*). **The grants
   project 004 made keep the badge and enter the re-check list, due within 30 days of the
   release** (decided 2026-11-18, by tapped option).
7. **The narrower view** (`0110` decision 3, legal B1), enforced in core beside the health
   branch of `CareController.withClient` and read afresh on every request:
   - an un-badged practitioner may generate, swap, review and publish a client's plan, and
     read **only the plans they made through this link** — generated by them through it, sent
     to them for review through it, or published by them through it (decided 2026-11-18, by
     tapped option; a plan under review is theirs to make); never a plan from before the link
     — and those without `strategy`, day
     `targets` or meal `status`. The plan's own
     dishes, energy and macros (day `totals`) are its content and stay; that they sit near the
     client's targets is an inference the un-badged consent states (item 9);
   - they may not read or set targets, progress, adherence, check-ins or `suggestedKcal`, nor
     the health line; the roster shows no stage derived from check-ins; the check-in notice
     does not reach them;
   - no answer to them names an allergen, an intolerance or a condition of the client (`0013`
     § 5.3).
8. **Illnesses and medication only to a badged professional, with consent.** The health line
   is offered and readable only on a badged link whose client said yes; `setSharesHealth`
   refuses `true` on an un-badged link.
9. **Consent per tier.** The client's consent becomes two lists (legal § 3.e): the badged
   list (today's `CARE_SHARED` plus the separate health line) and the un-badged list (the plan
   only — worded «the plans they make for you and where things stand» until the chat project,
   legal C1; that the person is not a verified health professional and owes no statutory secrecy;
   that they may deduce allergies from dishes the gate refuses, and roughly the client's daily
   energy from the plan's totals — the second inference is new, for `legal` to word; both
   controllers named until
   the lawyer answers M12). A link carries which list was consented to. A badge gained during a
   link widens nothing until the client consents to the badged list; a badge lost narrows the
   view on the next request.
10. **Invitations stay the way in.** A practitioner, badged or not, invites by e-mail as today;
    the invitation page shows the tier's list, the fixed notice for an un-badged practitioner,
    and no collegiate number unless checked.
    **A declared illness or medication and an un-badged practitioner** (decided 2026-11-18, by
    tapped option, extending `0110` decision 4 to invitations): a client who has declared an
    illness or a medication cannot accept an un-badged practitioner's invitation; a link to an
    un-badged practitioner **ends** when the client declares one later, or when the
    practitioner loses the badge while the client has one. The client is told plainly. **The
    practitioner is sent nothing distinct** (legal F4, approved 2026-11-18): a refused
    acceptance sends them nothing, an ended link reads exactly as one the client ended — any
    new `care_link_ended_by` value is presented to them as `client` — and no notice fires only
    under this rule. «On record» is any declared condition (pregnancy and breastfeeding
    included) or medication; not a supplement.
    **The health consent names this use** (legal F1, approved 2026-11-18): `health.consentNote`
    gains the sentence of `docs/legal/textos/05` § C bis and `HEALTH_CONSENT_VERSION` moves
    1.1.0 → 1.2.0 no later than the rule ships; a person linked to an un-badged practitioner is
    warned on the health screen before saving a declaration (legal C7).
11. **The owner's first look** (decided 2026-11-18, by tapped option). A console queue lists
    each new profile for a look at spam and the words (`0110` decision 5) — not a check of
    studies. **It gates nothing in this project**: it will decide only appearance in the
    directory, later. Any edit to a free-text field returns the profile to the queue. The owner
    marks it seen, or hides it — refusing and hiding are **one act** with one statement of
    reasons (legal F6); **it carries a statement of reasons** to the practitioner (`legal`), and nothing on any screen presents a profile the owner has seen as
    approved, recommended or endorsed by NutrIA. The console still reads no client (`0028`,
    `0068`).
12. **Neutral words, for every tier.** `/consulta` and its strings say «clientes», not
    «pacientes», and the client's screens say «tu profesional», not «tu dietista», **whatever
    the tier**; the badge line carries the title (legal C3, approved 2026-11-18; legal § 3.a,
    *smallest change* 3).
13. **Texts (B3).** Rewritten through the `legal` agent in the same release: every hit of
    `dietista|nutricionista|colegiad|secreto profesional|paciente` over `es-ES.ts`, and of
    `dietitian|dietician|nutritionist|registered|registration number|professional
    secrecy|patient` over `en-GB.ts`, that this project makes false — at least the `/privacidad` «Tu dietista en
    NutrIA» section, the invitation strings, `/condiciones` «Si trabajas con un dietista» and
    its liability paragraph, the client's «tu dietista» strings, the practice's plan-and-
    payment strings («Elige un plan para invitar…»), the agreement's «Verás… sus objetivos»
    list, and the console switch's «Consulta para dietistas». Versions move:
    `PROFESSIONAL_AGREEMENT_VERSION` → 2.0.0 (two tiers; every existing professional asked
    again), `CARE_CONSENT_VERSION` → 3.0.0, `HEALTH_CONSENT_VERSION` → 1.2.0 (item 10),
    `TERMS_VERSION` → 2.4.0, `/privacidad`'s
    `updated`. PRD 004 gets a pointer to `0110`. **The `/privacidad` and `/condiciones`
    change is mailed to every account before the switch opens in production** (decided
    2026-11-18, by tapped option; the policy's own important-change clause).
14. **`docs/PRODUCT.md` § Scope** amended: a professionals' area where anybody may offer their
    services comes into scope; the rest of "coach marketplaces" follows with its project.
    *Applied after phase 1 (§ Scope and § Users), with the owner's approval of 2026-11-18.*
15. **The DPIA and record-of-processing addendum** (B9), written by the `legal` agent:
    professionals who sign themselves up, the badge records, health data reaching un-verified
    recipients under consent. This PRD requires it; it does not write it.
16. **Suspension and close** (the owner, 2026-11-18, on legal's § 9 gap: a revoked account
    could reopen at once). The owner can **suspend** an account as a practitioner — immediate,
    with a statement of reasons — and **close** a practice definitively, with reasons and 30
    days' notice. A suspended or closed account cannot open a practice again; the self-service
    route answers it with the usual 404. Hiding a profile and withdrawing a badge stay
    immediate.

**Out** (each is a later project of `0013` § 9, or cut there)

- The directory, search, ranking, hire requests and the limited pre-acceptance chat
  (project 4); the chat (project 3); ratings, replies and the reports page (project 5); public
  profile pages and indexing (project 6).
- `authored_by`, the client's own generation closed while linked, "put this dish here", the
  professional's redo allowance and the assistant's deference line (project 2).
- Any payment, Stripe Connect, or practice subscription change (`0110` decision 6; payments
  deferred).
- Decision 4 for **requests** (a request exists only in project 4). Its reach over
  invitations is in scope, item 10.
- An automated register lookup (`0110` decision 2: manual first; legal M13).
- A «Técnico Superior en Dietética» mark (`0110`, Consequences: not decided).
- Profile photos; a practitioner closing their own practice (account deletion and the owner's
  close remain the ways out).

## Acceptance criteria

Each line names the decision of `0110` (**D**n) or the legal finding (**B**n, legal §) it
traces to.

1. **Self-service opening** (D1, B2). An account with a confirmed address and a birth date on
   record of 18 or more opens a practice by its own request; an unconfirmed address, a null or
   under-18 birth date, or the switch off is a 404, and nothing is written.
2. **Only the owner's act gives a badge** (D2, B2; PRD 004 criterion 1 inverted on purpose).
   No request body, sign-up field or client state can set the badge, its date, its checker,
   `practiceOpen` or `includedClients`; a test proves each, and the old criterion-1 test is
   replaced, not deleted silently.
3. **The badge's record** (D2, B2). A badge exists only after the practitioner's own
   application and the owner's confirmation of a code the practitioner entered, sent through
   one of the three channels of scope item 6 to a contact the owner recorded from the public
   register; no route accepts a contact from the applicant. The stored record is
   checker, date, register, result, number and channel, and nothing else. A wrong, used or
   expired code answers exactly as an unknown one.
4. **The yearly re-check** (D2, B2). A badge whose re-check is due appears in the console's
   list and in the owner's daily reminder (counts and a console link, no address — legal C8),
   and the practitioner is reminded when it falls due; a re-check overdue by 30 days lapses the badge;
   a lapse or a removal mails the practitioner a statement of reasons and closes every badged
   read on the next request. The grants of project 004 are badged and due within 30 days of
   the release.
5. **A collegiate number is displayed only once checked** (D2, legal § 3.a). No screen, mail
   or response shows an unchecked number or the word «colegiado» about an un-badged account.
6. **The words** (D2, legal § 3.a). Every free-text profile field, studies included, refuses
   the badge-only words without the badge and the other titled professions in every case,
   server-side; a test feeds each listed word to each field.
7. **A free practice works** (D13, `0013` § 4.1). With `practiceOpen` false and the current
   agreement accepted, the practitioner reaches their clients through `withClient`, and
   invites until **10** active clients plus live invitations; the next invitation is refused
   as `full`.
8. **No premium by link** (D13). A client linked to a practice with `practiceOpen` false keeps
   the tier of their own account; `tierOf` and `coveredByOpenPractice` are unchanged.
9. **The narrower view, by any route** (D3, B1). For an un-badged link, every delegated route
   — overview, plan, pending plan, plan job, plan history, roster, targets read and write,
   progress, health, swaps, publish — returns or acts on the plans that practitioner made
   through that link alone (a plan from before the link is absent from the history and 404 by
   id): no `strategy`, day
   `targets`, meal `status`, weight, adherence, check-in, `suggestedKcal` or `health` key in any
   response, and targets reads and writes are 404. Asserted by key absence, as PRD 004
   criterion 12 asserts `health`.
10. **No un-badged account can obtain weight, targets, adherence, check-ins, illnesses or
    medication of a client by any route** (D3, B1) — the delegated path, the roster's stage,
    the check-in notice by mail or push, the invitation and link views, and any console page.
    An end-to-end suite walks every care route as an un-badged practitioner and finds none.
11. **Illnesses and medication only to a badged professional, with consent** (D3, B1).
    `withClient` refuses `health` unless the link shares health **and** the professional holds
    the badge; `setSharesHealth(true)` on an un-badged link is refused; the un-badged
    invitation lists no health line.
12. **Badge changes during a link** (D3, B1). Gaining a badge widens nothing until the client
    accepts the badged list; losing it narrows the view on the next request, with nothing
    cached.
13. **No allergen named** (D3, `0013` § 5.3). No response to an un-badged practitioner names
    an allergen, intolerance or condition of the client.
14. **Ownership by session** (`docs/ARCHITECTURE.md` § Invariants). The practice, its profile
    and the badge code are resolved from the session alone; no body or path names a user id;
    the client's id still comes only from the link row in `withClient`.
15. **Denials are 404.** A route refused for want of a practice, a badge, a link or the
    switch answers 404, the same answer as an unknown resource.
16. **Health data out of the AI module.** `apps/api/src/modules/ai/health-boundary.spec.ts` and
    `apps/api/src/modules/assistant/assistant-boundary.spec.ts` cover the new profile and badge
    code; nothing of a profile, a badge record or a client's care data reaches a model.
17. **The existing care suites stay green** (`0013` § 10): `care.e2e-spec.ts`,
    `care-practice.e2e-spec.ts`, `care-review.e2e-spec.ts` and `plan-scheduled-care.e2e-spec.ts`
    pass, changed only where this PRD changes behaviour, each change named.
18. **The first look** (D5, `legal`). Each new profile, and each edit to a free-text field,
    puts it in the console's queue; the look gates no practitioner action; the owner can mark
    it seen, or hide it (refusing is the same act) with one statement of reasons the
    practitioner receives; no
    string presents a seen profile as NutrIA's approval; the page names no client.
19. **Words on screen** (D2, B3, legal C3). Every practitioner's workspace and every client's
    screens use «clientes» and «tu profesional»; the title appears only on the badge line; an
    un-badged practitioner's screens show the fixed notice.
20. **The texts** (B3). The dictionary search of item 13 of the scope returns no sentence the
    product no longer makes true; the four version constants and the policy's `updated` date
    have moved.
21. **The documents** (B9, `0110` Consequences). `PRODUCT.md` § Scope is amended and the DPIA
    and record-of-processing addendum is committed. `owner-gated:` the `professional` switch
    stays off in production until both are merged and the owner says so.
22. **A declared illness or medication and an un-badged practitioner** (D4 extended, legal R1).
    Accepting an un-badged practitioner's invitation with an illness or medication on record is
    refused; declaring one while linked to an un-badged practitioner ends the link in the same
    transaction; a badge lost while a client has one ends that link at the next daily sweep.
    The client is told plainly; the practitioner receives nothing distinct — no mail on a
    refused acceptance, an ended link presented exactly as one the client ended — and no
    response to them names a condition.
23. **The change notice** (B3). `owner-gated:` the `/privacidad` and `/condiciones` change is
    mailed to every account before the switch opens in production, and LOG.md records the
    date.
24. **Suspension and close** (the owner, 2026-11-18). A suspended account reaches no client
    route from the next request — its own practice page, agreement, badge and profile stay
    (*amended 2026-11-19, phase 6's review: they name no client, and the page is where the
    account reads its restriction; the agreement's § 11 says the same*) — and cannot open a
    practice; a closing practice works for 30 days
    after its notice and is then closed by the daily sweep; both carry a statement of reasons;
    a suspended, closing or closed account's request to open a practice is a 404 and writes
    nothing.
25. **The health consent names the illness rule** (legal F1, C7). `HEALTH_CONSENT_VERSION` is
    1.2.0 with its sentence no later than the rule ships, a stale consent is asked again, and
    the warning shows on the health screen before a linked client saves a declaration.

## Decided by the owner

All seven open questions of the draft were answered on 2026-11-18 by tapped options, and are
folded in above: (1) an un-badged practitioner sees only the plans they made through the link
(scope 7); (2) a declared illness or medication bars or ends a link to an un-badged
practitioner, with a plain notice naming no condition to them (scope 10); (3) the first look
gates nothing yet, edits re-queue, it will decide only directory appearance (scope 11); (4) an
overdue re-check lapses the badge after 30 days, with reasons sent (scope 6); (5) with no
register e-mail, the `legal` agent's fallbacks in order — post to the register's professional
address, a college-issued address on the college's domain, the owner's call to a phone the
register lists — never a contact only the applicant supplies (scope 6); (6) the grants of
project 004 keep the badge and are due for re-check within 30 days (scope 6); (7) the
`/privacidad` and `/condiciones` change is mailed to every account before the switch opens
(scope 13).

After phase 1 (2026-11-18, tapped options): the college-issued e-mail channel is **dropped**,
three channels remain (scope 6); a real **suspension** and a definitive **close** exist (scope
16); and the `legal` agent's F1, F4, F6, C1–C5, C7 and C8 are approved and folded in (scopes
6, 9, 10, 11, 12). The `legal` agent added: a refusal or hiding of a profile carries a statement of
reasons, and approval never reads as NutrIA's endorsement (scope 11).

## Open questions

None.

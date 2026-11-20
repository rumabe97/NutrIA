# Anyone can open a practice: the texts and the documents of project 025, phase 1 (2026-11-18)

> **I am not a lawyer.** An agent wrote this. Every clause below is tied to the article it rests
> on so that the owner, and the lawyer he shows it to, can check it. Where a conclusion turns on
> an interpretation it is marked **[lawyer]** and collected in § 10.
>
> **Purpose**: phase 1 of [project 025](../projects/025-anyone-can-open-a-practice/PLAN.md) —
> every word the project ships, drafted before any code, and the documents legal finding **B9**
> requires before the switch. This file is the map: where each text lives, where it goes in the
> product, which version constant it moves and in which phase. It also holds the texts that
> have no `textos/` file of their own: the `/privacidad` and `/condiciones` replacements (§ 4,
> § 5, following the precedent of [`assistant-privacy.md`](./assistant-privacy.md) § 3), the
> words table (§ 6), the disposition of every dictionary hit (§ 7) and the `PRODUCT.md` text
> (§ 8). **Audience**: the owner (who approves each text), the lawyer, and the `frontend` and
> `backend` agents of phases 3–10. **Committed**: yes; the repository is public, so no name,
> address or number of anybody appears here. **Maintained by**: the `legal` agent.
>
> **What I read** (`main` at `15754b0c`, branch `professionals-marketplace-docs`): the project's
> [PRD](../projects/025-anyone-can-open-a-practice/PRD.md) and
> [PLAN](../projects/025-anyone-can-open-a-practice/PLAN.md);
> [`0110`](../decisions/0110-anyone-may-offer-their-services-and-a-checked-badge-is-what-opens-health-data.md)
> and [`0111`](../decisions/0111-a-badge-is-a-dated-check-and-the-link-decides-how-much-is-seen.md);
> the legal read [`2026-11-18-professionals-marketplace.md`](./2026-11-18-professionals-marketplace.md)
> (B1–B9, § 1.3, § 3.e, § 6.0 and the words table); [`textos/01`](./textos/01-acuerdo-profesional.md),
> [`05`](./textos/05-consentimientos-cliente.md), [`06`](./textos/06-correos.md),
> [`dpia.md`](./dpia.md), [`record-of-processing.md`](./record-of-processing.md); the legal
> namespaces and every `care`, `practice`, `practiceAgreement`, `health`, `targets` and `admin`
> string of `apps/web/src/i18n/dictionaries/es-ES.ts` and `en-GB.ts`; the version constants in
> `packages/core/src/entities` (`PROFESSIONAL_AGREEMENT_VERSION = '1.1.0'`,
> `CARE_CONSENT_VERSION = '2.0.0'`, `HEALTH_CONSENT_VERSION = '1.1.0'`, `TERMS_VERSION = '2.3.0'`);
> `HEALTH_CONDITIONS` (`packages/core/src/entities/Health/Health.ts:15-30`); the mail templates
> in `apps/api/src/modules/email/templates/` and the transport in `Email.service.ts`; the
> `care_link_ended_by` enum (`packages/database/src/schemas/_enums.ts:97`). The law was read
> from primary sources on 2026-11-18; the list is at the end.
>
> **Nothing here is built, and nothing here is served.** Every text is a draft for the owner's
> approval. It describes the product **as phases 2–10 of the plan build it**, so each one is
> true only once its phase ships, and is wired only then (PLAN § Hand-off: "a version constant
> moves in the phase that ships its words"). The `professional` switch is off in production and
> stays off until phase 10.

## 0. In ten lines

1. Eleven texts are drafted (§ 1). They live in `textos/01` (the agreement 2.0.0 and the
   practitioner's screens), `textos/05` (the client's consent 3.0.0, the re-consent, the illness
   rule's screens and a health-consent amendment), `textos/06` (§§ R–Z: the code by mail, post
   and phone, re-check, lapse, withdrawal, the first look, the illness rule, the change notice),
   and here (§§ 4–8).
2. The DPIA gains § 9 and the record of processing two new rows (11 and 12) and three amended
   ones (1, 3 and 5). With the measures of the plan the residual risk is acceptable and there is
   **no prior consultation** (art. 36.1).
3. **New finding F1 (P1).** The illness rule uses declared health data for a purpose the health
   consent does not name. Its note must say so, and `HEALTH_CONSENT_VERSION` must move to
   `1.2.0`. The plan names three constants and not this one (§ 2).
4. **New finding F2 (P1).** The badge code goes to whoever the register lists. That may be a
   real dietitian whose number somebody borrowed. Every channel therefore carries art. 14
   information and an "if this was not you" path that fails the check (§ 2).
5. **F3 (P2).** "The contact is not stored" is true of the database only. Gmail keeps a copy
   of every message sent through its SMTP, and a letter and a call leave traces too (§ 2).
6. **F4 (P2).** A link the sweep ends after a badge is lost tells the practitioner which
   clients declared something. The badged consent says so, and no notice may be distinct (§ 2).
7. **The chat does not exist in project 025.** The design's fixed notice says "the plan and the
   chat". I wrote "the plans they make for you and where things stand", and the chat variant waits for project 3
   (§ 3, choice C1).
8. Five published sentences outside the PRD's list also become false: Premium by link,
   `practiceAgreement.terms` (the paid-plan terms), «concesión», the practice's
   plan-and-payment strings, and the welcome mail of `06` § B (§ 7).
9. The words table is a test fixture: exact tokens, English equivalents, and a split between
   what a function can refuse and what only the owner's first look can judge (§ 6).
10. Four new questions for the lawyer (M14–M17, § 10). None blocks phase 2. **The owner approved
    every text on 2026-11-18, dropped the college-address channel and added a real suspension
    (§ 11).**

---

## 1. The map: every text, where it goes, what it moves

| # | Text | Source | Where it goes | Version | Phase |
| --- | --- | --- | --- | --- | --- |
| 1 | The professional's agreement, 2.0.0 | [`textos/01`](./textos/01-acuerdo-profesional.md) § «Versión 2.0.0» | `practiceAgreement` (`title`, `intro[]`, `sections[]`, `checkbox`, `accept`) in both dictionaries; `/consulta`, shown instead of the practice while `agreementVersion !== PROFESSIONAL_AGREEMENT_VERSION` | `PROFESSIONAL_AGREEMENT_VERSION` `1.1.0` → `2.0.0`; every existing professional accepts again | 8 |
| 2 | The practitioner's screens: opening, application (art. 13), code, badge, fixed notice, profile labels, first look, seats, the refused dish | [`textos/01`](./textos/01-acuerdo-profesional.md) § «Pantallas de la consulta» | `practice.*` (new keys listed there) | none (not consent texts) | 8, 9 |
| 3 | The client's consent per tier, 3.0.0 | [`textos/05`](./textos/05-consentimientos-cliente.md) § F | `care.*` on `/invitacion/[token]` (`CareInvitation`) | `CARE_CONSENT_VERSION` `2.0.0` → `3.0.0` | 8 |
| 4 | The re-consent card (a badge gained mid-link) | `textos/05` § F.4 | `care.reconsent*`, on the client's profile card for the link | stores `consent_scope = 'full'` at `3.0.0` | 5 (route), 8 (screen) |
| 5 | The illness rule's client screens | `textos/05` § G | `care.illness*`, `health.illnessLinkWarning` | none | 5, 8 |
| 6 | The health consent amendment | `textos/05` § C bis | `health.consentNote` | `HEALTH_CONSENT_VERSION` `1.1.0` → `1.2.0` (**not in the plan: F1**) | 5 or 8 |
| 7 | Mails, letter, call script, statements of reasons, change notice | [`textos/06`](./textos/06-correos.md) §§ R–Z | `apps/api/src/modules/email/templates/` (new templates named there); the letter and the script are for the owner | none | 3, 5, 6, 10 |
| 8 | `/privacidad` replacements | § 4 below | `privacy.sections`, both dictionaries | `privacy.updated` | 10 |
| 9 | `/condiciones` replacements | § 5 below | `terms.sections`, both dictionaries | `TERMS_VERSION` `2.3.0` → `2.4.0`; `terms.updated` | 10 |
| 10 | The words table and the fixed notice | § 6 below | `packages/core/src/domain/ProtectedWords` (phase 3, step 5) | none | 3 |
| 11 | Neutral strings and every dictionary hit | § 7 below | both dictionaries | none | 8, 9, 10 |
| — | The DPIA addendum | [`dpia.md`](./dpia.md) § 9 | — | DPIA 0.8 | before the switch |
| — | The record of processing | [`record-of-processing.md`](./record-of-processing.md), rows 1, 3, 5, 11, 12 | — | — | before the switch |
| — | `PRODUCT.md` § Scope (and § Users) | § 8 below — **the lead applies it once the owner approves** | `docs/PRODUCT.md` | — | 10 |
| — | The go-live boxes | [`go-live-checklist.md`](./go-live-checklist.md) § 1 bis | — | — | 10 |

**Links accepted at consent `2.0.0`.** They are backfilled `full` (`0111` § 4), which is right:
they consented to 004's list, and the badged list of 3.0.0 is that list. What 3.0.0 adds to it
is two sentences of information: what a refused dish lets the professional deduce, and what
happens to the link if the professional loses the badge. Neither adds a datum or a recipient.
The only professional on record is the owner's own account, according to 011's LOG, phase 6.
So the advisable course is the one already set for `1.0.0`
([`go-live-checklist.md`](./go-live-checklist.md) § 1, steps 1–2): count the `2.0.0` links
read-only, end the owner's test links, and invite again on 3.0.0. Then no real link ever rests
on the shorter text.

## 2. What writing the texts turned up (beyond the 2026-11-18 read)

**F1 (P1). The illness rule is a new purpose for declared health data, and the health consent
does not name it.** `0111` § 8 reads a person's declared conditions and medications to refuse an
acceptance and to end a link. The health consent covers keeping them, showing them, the coeliac
exclusion and the supervision notice ([`record-of-processing.md`](./record-of-processing.md),
row 3). Consent under art. 9.2.a is "para uno o más de los fines especificados". A use that gates
whom a person may work with is a purpose of its own. It is protective and close to the
supervision notice, but it is not the same purpose. It also has to be said **before** the person
saves (art. 13.1.c and 13.3).

- **Fix:** the sentence in [`textos/05`](./textos/05-consentimientos-cliente.md) § C bis, and
  `HEALTH_CONSENT_VERSION` → `1.2.0`. The existing `health.consentStale` mechanism asks again.
  Until the person accepts again, the rule still runs, because it is part of the safety of the
  service. This is my reading **[lawyer]** (M14).
- **Art. 22.** The rule is automated, and it refuses something the person asked for. Whether
  that "le afecte significativamente de modo similar" is open **[lawyer]** (M14). In case it
  does, the texts carry art. 22.3's minimum: a person who reviews the decision on request at
  `{email}`. The policy also gives the logic (art. 13.2.f).
- **Scope:** `HEALTH_CONDITIONS` includes `pregnancy` and `breastfeeding` (`Health.ts:27-28`).
  If phase 5 reads "a condition on record" as any row, pregnancy follows the rule. That is what
  the legal read recommended (§ 6.0, O4), and the texts say «una condición de salud».
  Supplements are not in the rule (PRD scope 10). The texts never name them in it.

**F2 (P1). The badge code can reach somebody who never applied.** The register's contact
belongs to the person on the register. If the applicant borrowed a real dietitian's name and
number, that real person receives the code. They are a data subject whose name, number and
contact NutrIA read from a public source (art. 14). Their basis is not the applicant's
contract, so it is art. 6.1.f: nobody impersonating a health professional in front of NutrIA's
users. Every channel ([`textos/06`](./textos/06-correos.md) §§ R, S, T) therefore carries what
art. 14.1–14.2 requires: the controller (via `{privacyUrl}`), the purpose and basis, the
categories, the source (14.2.f: a public register), the period, the rights, and the
legitimate interest (14.2.b). They go "a más tardar en el momento de la primera comunicación"
(14.3.b). Each one also says plainly what to do if it was not them: do nothing with the code
and tell us. The owner then records a `fail` with that reason.

- No channel reveals anything about the applicant's account beyond the name and number the
  register already publishes.
- `/privacidad` gains the paragraph that is the second layer of this notice (§ 4, P-9).

**F3 (P2). "The contact is not stored after sending" is true of the database, not of the
world.**

- Production mail goes through Gmail's SMTP with an app password (the comment in
  `apps/api/src/modules/email/services/Email.service.ts:44`). As far as I know, Gmail keeps a
  copy of every message sent through it in the sending account's *Sent* folder. **The owner
  should confirm this on his own account; I could not check it from here.**
- A letter leaves an envelope and perhaps a post office receipt. A call leaves the number in
  the phone's call log.
- The record, the DPIA and the texts say so. The texts promise only what the owner can do: the
  sent copy and the call-log entry are deleted once the code expires (30 days).
- That is a manual duty, listed in [`go-live-checklist.md`](./go-live-checklist.md) § 1 bis.
  If the owner would rather not take it on, the period in `textos/06` § R must change to
  whatever he will actually do. This is choice C6.

**F4 (P2). The badge-loss sweep tells the practitioner which clients declared something.**

- When a badge goes, the daily sweep ends the links of clients with an illness or medication on
  record (`0111` § 8). The practitioner sees those links end on the day their badge lapsed, and
  can deduce why.
- The "practitioner's notice names no condition" rule (PRD scope 10) cannot stop that
  inference. The honest fix is the one the legal read used for allergens (§ 3.g): say it in the
  consent. The badged list of 3.0.0 does ([`textos/05`](./textos/05-consentimientos-cliente.md)
  § F.2).
- A second consequence: no mail may fire only under this rule. **There is no ended-link mail to
  a practitioner today** (no such template in `apps/api/src/modules/email/templates/`), so the
  practitioner's notice is *none*. The link shows as ended exactly as when a client ends it.
- If phase 5 adds a value to `care_link_ended_by` (today `professional`, `client`, `lapse`,
  `account`), the practitioner's views must present it exactly like `client`. A distinct label
  is the disclosure. Sent to the lead (§ 9).

**F5 (P2). A lapse can be the owner's delay, not the practitioner's fault.**

- A badge lapses 30 days after its re-check falls due if the owner has not confirmed it. The
  re-check is the owner reading the register again. The practitioner may have done nothing
  wrong.
- The lapse statement says so plainly ([`textos/06`](./textos/06-correos.md) § V). It offers the
  application again.
- A reminder to the practitioner, sent when the re-check falls due (`06` § U.2), is **not in
  phase 3's steps**. I recommend it, because it warns the practitioner before the client's view
  narrows (choice C5).

**F6 (P2). Refusing and hiding a profile are one act in the data.** Phase 6 step 5 says "refuse
or hide with a reason". `professional_profiles` has `hidden_at` and `hidden_reason` and nothing
else (PLAN phase 2, step 4). `06` § X is therefore one statement of reasons, with a line that
differs depending on whether the owner had marked the profile seen before. If the lead wants
two acts, the schema needs a second column.

**F7 (P3). The agreement 1.1.0 cites the wrong letter.** It cites Ley 44/2003 art. 2.2.g. On
BOE (consolidated 05/06/2021) the Diploma-level professions, Nutrición Humana y Dietética among
them, are **art. 2.2.b**. Version 2.0.0 cites 2.2.b. The 1.1.0 comment is left as it was, and
this note records the correction.

**F8 (P3). P2B may not bind project 025 yet. I applied it anyway.**

- Reg. 2019/1150 applies to services that let business users offer services to consumers "con
  el objetivo de facilitar el inicio de transacciones directas" (art. 2.2).
- In 025 the practitioner invites people they already know. NutrIA introduces nobody to anybody,
  and that changes with project 4's directory.
- Still, the plan asks for P2B's grounds and notice periods now (phase 1, step 2). Writing them
  once costs nothing, and they bind the moment the directory opens. So the agreement follows
  arts. 3.1.c, 3.2, 4.1–4.5 already. This is my reading, and nothing turns on it today.

## 3. Choices the texts make that are not consequences of the owner's decisions

Each is marked where it appears. The owner approves or changes it.

| | Choice | Where | Why I chose it |
| --- | --- | --- | --- |
| C1 | The un-badged notice and consent say "the plan and where things stand", not "the plan and the chat" | `05` § F.3; `01` § 3 | The chat is project 3. A consent naming a channel that does not exist describes something the product does not do. When project 3 ships, the sentence gains «y lo que le escribas en el chat» and `CARE_CONSENT_VERSION` moves again. |
| C2 | NutrIA's own labels avoid «consulta» where a client or a profile would read it: the price unit is «por sesión», not «por consulta»; the agreement's title is «Antes de empezar con tus clientes»; the accept button is «Aceptar y empezar» | `01` | «consulta» is refused in an un-badged profile (§ 6). The practitioner's own workspace may keep «Consulta» as its title (`practice.title`), because only they see it, but a price unit is shown with the profile. The route `/consulta` keeps its name (PRD scope 5). |
| C3 | «clientes» and «tu profesional» for **every** tier, not only the un-badged; the badge line shows the title | `01` § Pantallas; § 7 | One string set, not two per key. The badge says what the person is, and the noun around it never has to change when a badge comes or goes. PRD 19 allows «tu dietista» for the badged. It does not require it. |
| C4 | The un-badged accept button says what is consented: «Acepto y consiento» | `05` § F.3 | Art. 9.2.a consent is "explícito". A button whose label is the consent, under the list, is the clearest affirmative act. The badged button stays «Aceptar la invitación», as accepted at 2.0.0. |
| C5 | A reminder to the practitioner when their re-check falls due | `06` § U.2 | F5. It is not in phase 3. |
| C6 | The sent copy of a code mail and the call-log entry are deleted within 30 days | `06` §§ R, T; record row 12 | F3. It is the owner's manual duty. |
| C7 | A warning on the health screen, before saving, when the person is linked to an un-badged practitioner | `05` § G.1 | Art. 13.3: say it before the data is used for it. F1. |
| C8 | The owner's daily badge alert carries counts and a console link, no addresses | `06` § U.1 | The plan says "counts and addresses of practitioners only". Since 2026-09-29 the owner's alerts carry no address ([note](./2026-09-29-mail-to-the-owner.md)). The console already has them. |
| C9 | «doctor/a», «Dr./Dra.», «psicólogo/a» (bare), «nutriólogo/a» and the English titles added to the word lists | § 6 | Beyond the legal read's table. Each is a titled-profession claim NutrIA cannot check (Ley 44/2003 art. 2; LCD art. 5.1.g). |
| C10 | The practice terms of `textos/04` leave the agreement screen | `01` 2.0.0 § 10 | They describe paid plans nobody can buy, and they say seats "depend on the plan" when a free practice holds ten. They come back, rewritten, with payments. |
| C11 | «Estar vinculado a un profesional no te da Premium» is stated without a condition | § 5, T-1 ¶ 3; `01` § 10; `06` § Z | True only while no practice has `practiceOpen`, which only Stripe's webhook writes and payments are deferred. `tierOf` still makes a client of a **paid** practice premium (`0061`). The day practice plans ship, the sentence gains «…salvo que su plan de consulta lo incluya» in the same change. The alternative is to write the condition now, about a plan nobody can buy. |
| C12 | **Decided 2026-11-18: dropped.** The college-issued address was the third channel | `01` 2.0.0 § 4; `06` § R | Nothing said where the owner would learn it, and it could have come only from the applicant. The owner dropped it: the code goes only to a contact the public register shows — its e-mail, a letter to the professional address, or the owner's call to its phone. `college_email` is gone from every text, the record (row 12) and the DPIA. |

## 4. `/privacidad`: the replacements

**Where**: `privacy.sections` in `es-ES.ts` and `en-GB.ts`. **When**: phase 10, in the same
change that switches the texts, with `privacy.updated` and after the mail of
[`textos/06`](./textos/06-correos.md) § Z. **Why "important"**: a new recipient (a practitioner
NutrIA has not checked), a new automated use of health data (F1), and a new category of data
subject (the dietitians looked up). The policy's own clause promises a mail before it applies,
and PRD scope 13 decides that the mail goes.

### P-1. «Qué datos recogemos y para qué» — the last two bullets are replaced

Hoy (`privacy.sections[1].list`, two bullets of [`02`](./textos/02-politica-privacidad.md),
lines 250-251): «Si trabajas con un dietista en NutrIA…» and «Si eres dietista-nutricionista en
NutrIA: tu número de colegiado y cuándo te dimos acceso…».

| es-ES | en-GB |
| --- | --- |
| `Si trabajas con un profesional en NutrIA: lo que se explica en «Tu profesional en NutrIA».` | `If you work with a professional on NutrIA: what is explained under "Your professional on NutrIA".` |
| `Si abres una consulta: tu fecha de nacimiento, para comprobar que eres mayor de edad; la versión del acuerdo del profesional que aceptaste y cuándo; tu perfil (el nombre que muestras, tus estudios, tu precio y tu horario) y nuestra revisión de él (cuándo lo miramos y, si lo ocultamos, por qué); y, si pides la insignia, lo que se explica en «Tu profesional en NutrIA». Para que puedas atender a tus clientes en NutrIA y para que nadie se presente con un título que no tiene.` | `If you open a practice: your date of birth, to check that you are an adult; the version of the professional's agreement you accepted and when; your profile (the name you show, your studies, your price and your hours) and our review of it (when we looked and, if we hid it, why); and, if you apply for the badge, what is explained under "Your professional on NutrIA". So that you can work with your clients on NutrIA, and so that nobody presents themselves with a title they do not hold.` |

<!-- Fuente: RGPD art. 13.1.c (fines) y 5.1.c; PLAN fase 2, pasos 2-4 (professional_badge_checks, professional_profiles: display_name, studies, price_cents, price_unit, hours, queued_at, seen_at, seen_by, hidden_at, hidden_reason); fase 6, paso 1 (fecha de nacimiento comprobada por assertOldEnough y no nula). Ya no hay «concesión»: 0111 § 9 retira la ruta. -->

### P-2. «Por qué podemos tratar estos datos» — three sentences change (rows rewritten 2026-11-20 as whole sentences: the earlier cells held instructions, and were copied as text — § 12.4)

| Hoy | es-ES nuevo | en-GB nuevo |
| --- | --- | --- |
| `… Y lo que compartes con tu dietista, con el consentimiento que das al aceptar su invitación. …` | `… Y lo que compartes con tu profesional, con el consentimiento explícito que das al aceptar su invitación, que nombra a esa persona y lo que verá. …` | `… And what you share with your professional, with the explicit consent you give when you accept their invitation, which names that person and what they will see. …` |
| `Por nuestro interés legítimo: registrar el uso del producto … los avisos de seguridad que te enviamos. Puedes oponerte escribiéndonos.` | `Por nuestro interés legítimo: registrar el uso del producto y los errores técnicos para que funcione, sin datos de salud, y proteger las cuentas: el registro de seguridad, los frenos contra el abuso y los avisos de seguridad que te enviamos, y comprobar, cuando alguien pide la insignia, que es quien dice ser en el registro de su colegio. Puedes oponerte escribiéndonos.` | `Our legitimate interest: recording product use and technical errors to keep it working, with no health data, and protecting accounts: the security record, the brakes against abuse and the security notices we send you, and checking, when somebody applies for the badge, that they are who they say they are on their college's register. You can object by writing to us.` |
| `Para darte el servicio que pides (contrato): tu cuenta, tu perfil, tus planes, tus conversaciones con el asistente, tus pagos y los correos del servicio.` | `Para darte el servicio que pides (contrato): tu cuenta, tu perfil, tus planes, tus conversaciones con el asistente, tus pagos y los correos del servicio y, si abres una consulta, tu consulta y tu perfil.` | `To provide the service you ask for (contract): your account, profile, plans, conversations with the assistant, payments and service emails and, if you open a practice, your practice and your profile.` |

<!-- Fuente: RGPD art. 6.1.b (la consulta y el perfil los pide el profesional: legal 2026-11-18 § 3.h), 6.1.f y 13.1.d (la comprobación: legal § 3.a, «Data protection of the person looked up»), 9.2.a (el consentimiento que nombra a la persona: legal § 3.e; M12). -->

### P-3. «Tu dietista en NutrIA» → «Tu profesional en NutrIA» — the section is replaced

**Key**: `privacy.sections[i]` with `id: 'tu-profesional'` (was `'tu-dietista'`). The invitation's
`{privacy}` link points to `/privacidad#tu-profesional`. An old anchor that no longer exists
lands at the top of the page, which is harmless.

| ¶ | es-ES | en-GB |
| --- | --- | --- |
| heading | `Tu profesional en NutrIA` | `Your professional on NutrIA` |
| 1 | `Cualquier persona mayor de edad puede abrir una consulta en NutrIA y ofrecer sus servicios. Solo quien lleva la insignia «Dietista-nutricionista colegiada/o» es alguien de quien hemos comprobado, en el registro público de su colegio, que figura como dietista-nutricionista colegiado y habilitado, y que la cuenta es suya; lo comprobamos de nuevo cada año. A los demás no les hemos comprobado nada: no son profesionales sanitarios verificados por NutrIA. Que hayamos revisado el perfil de alguien no significa que lo recomendemos.` | `Any adult can open a practice on NutrIA and offer their services. Only someone with the badge "Registered dietitian-nutritionist" is a person we have checked, on their college's public register, to be listed as a registered dietitian-nutritionist entitled to practise, and to own the account; we check again every year. Nobody else has been checked by us: they are not health professionals verified by NutrIA. Our having reviewed somebody's profile does not mean we recommend them.` |
| 2 | `Un profesional puede invitarte por correo a que te haga el plan en NutrIA. Su invitación dura 14 días; tu dirección la usamos solo para enviártela y la borramos con la invitación: en cuanto respondes o, si no respondes, como muy tarde el día después de que caduque.` | `A professional can invite you by email to have them make your plan on NutrIA. The invitation lasts 14 days; we use your address only to send it and delete it with the invitation: as soon as you answer or, if you do not, by the day after it expires at the latest.` |
| 3 | `Nada se comparte si no aceptas. Lo que verá depende de si tiene la insignia, y antes de aceptar ves la lista exacta.` | `Nothing is shared unless you accept. What they will see depends on whether they hold the badge, and before you accept you see the exact list.` |
| 4 | `Sin la insignia, verá solo tu nombre, los planes que te haga a través del enlace —los que genere, revise o publique—, con sus platos, cantidades y totales de cada día, y en qué punto estáis (desde cuándo estáis vinculados, si has terminado tu perfil, si tienes un plan en marcha o por revisar y si te quedan generaciones en la quincena), y podrá generarlos, cambiarlos, revisarlos antes de que los veas y publicarlos. No verá tu peso, tus objetivos, cuánto sigues el plan, tus check-ins, tus enfermedades, tu medicación, tus suplementos, tus alergias, tus intolerancias, tu correo ni tus planes de antes del enlace. Aun así, de los totales de cada día puede deducir más o menos cuánta energía necesitas y, cuando un plato no se te puede ofrecer, le decimos solo que no encaja contigo, pero de eso puede deducir alguna alergia o intolerancia. No está obligado por ley al secreto profesional: se compromete con nosotros, por contrato, a guardar la confidencialidad.` | `Without the badge, they will see only your name, the plans they make for you through the link — the ones they generate, review or publish — with their dishes, amounts and each day's totals, and where things stand (since when you have been linked, whether you have finished your profile, whether you have a plan under way or waiting for review, and whether you have generations left this fortnight), and they can generate them, change them, review them before you see them and publish them. They will not see your weight, your targets, how much of the plan you follow, your check-ins, your conditions, medication or supplements, your allergies or intolerances, your email address or your plans from before the link. Even so, from each day's totals they can work out roughly how much energy you need and, when a dish cannot be offered to you, we tell them only that it does not suit you, but from that they can work out an allergy or an intolerance. They are not bound by professional secrecy by law: they promise us, by contract, to keep it confidential.` |
| 5 | `Con la insignia, verá además tus objetivos diarios y cómo se calcularon, tus planes anteriores, cuánto sigues cada quincena, tu peso a lo largo del tiempo y tus respuestas a los check-ins, y podrá fijar tus objetivos dentro de los mismos límites de seguridad. Tus enfermedades, tu medicación y tus suplementos solo si marcas esa casilla aparte. Si consigue la insignia cuando ya estáis vinculados, no ve nada nuevo hasta que tú lo aceptes; si la pierde, desde ese momento ve solo lo que ve un profesional sin insignia.` | `With the badge, they will also see your daily targets and how they were worked out, your earlier plans, how much of each fortnight you follow, your weight over time and your check-in answers, and they can set your targets within the same safety bounds. Your conditions, medication and supplements only if you tick that separate box. If they gain the badge while you are already linked, they see nothing new until you accept it; if they lose it, from then on they see only what a professional without the badge sees.` |
| 6 | `Si tienes anotada una condición de salud o una medicación, solo puedes vincularte con un profesional con la insignia. Si la anotas mientras estás vinculado con uno sin ella, o si el tuyo pierde la insignia mientras la tienes anotada, el enlace termina. Te lo decimos a ti; a tu profesional solo le consta que el enlace ha terminado, aunque puede deducir el motivo. Esta regla la aplica nuestro código con lo que anotas en tu perfil, sin que nadie lo mire. Si crees que se ha equivocado, escríbenos a {email} y lo revisa una persona.` | `If you have a health condition or a medication on record, you can only link with a professional who holds the badge. If you record one while linked with a professional without it, or if yours loses the badge while you have one on record, the link ends. We tell you; your professional only sees that the link has ended, although they may work out why. Our code applies this rule to what you record in your profile, without anybody looking at it. If you think it got it wrong, write to us at {email} and a person will look at it.` |
| 7 | `Cada vez que tu profesional mira o cambia algo, queda anotado y lo ves en tu perfil, en «Quién ha accedido».` | `Every time your professional looks at or changes something, it is recorded and you can see it on your profile under "Who has accessed".` |
| 8 | `Puedes terminar el enlace cuando quieras desde tu perfil, y desde la siguiente petición tu profesional deja de ver tus datos. Con un profesional con la insignia, también puedes dejar de compartir solo tu salud sin terminar el enlace. Tus objetivos, tu historial y tu último plan publicado se quedan contigo.` | `You can end the link from your profile at any time, and from the next request your professional stops seeing your data. With a professional who holds the badge, you can also stop sharing just your health without ending the link. Your targets, your history and your last published plan stay with you.` |
| 9 | `Quién responde de qué: NutrIA es responsable de tus datos en NutrIA y se los comunica a tu profesional porque tú lo pides y lo consientes. Tu profesional es responsable, por su cuenta, de lo que haga con lo que ve: si tiene la insignia, bajo su secreto profesional; si no, con el consentimiento que le das al aceptar, que retiras terminando el enlace. Para lo que haga fuera de NutrIA, dirígete a tu profesional. Para todo lo que está en NutrIA, escríbenos a {email}: somos tu punto de contacto.` | `Who is responsible for what: NutrIA is responsible for your data on NutrIA and discloses it to your professional because you ask for it and consent. Your professional is responsible, on their own account, for what they do with what they see: with the badge, under their professional secrecy; without it, under the consent you give them when you accept, which you withdraw by ending the link. For what they do outside NutrIA, contact your professional. For everything held on NutrIA, write to us at {email}: we are your contact point.` |
| 10 | `Si tu profesional borra su cuenta, el enlace termina y su nombre sigue en tu registro de accesos.` | `If your professional deletes their account, the link ends and their name stays in your access record.` |
| 11 | `Si eres dietista-nutricionista y alguien pide la insignia con tu nombre y tu número: consultamos el registro público de colegiados de tu colegio solo cuando alguien la pide, y solo tu fila, y te enviamos un código al contacto profesional que ese registro publica (tu correo, tu dirección profesional o tu teléfono). Nunca a un contacto que nos dé quien la pide. Guardamos qué registro consultamos, cuándo, el resultado, el número y por qué vía enviamos el código; no guardamos en NutrIA el contacto, y la copia del correo o la nota de la llamada la borramos cuando caduca el código, a los 30 días. Lo hacemos por interés legítimo: que nadie se haga pasar por dietista-nutricionista ante quienes usan NutrIA. Ese registro se borra con la cuenta que pidió la insignia. Si no fuiste tú quien la pidió, dínoslo en {email}.` | `If you are a dietitian-nutritionist and somebody applies for the badge with your name and number: we look at your college's public register only when somebody applies, and only at your entry, and we send a code to the professional contact that register publishes (your email, your professional address or your phone). Never to a contact the applicant gives us. We keep which register we looked at, when, the result, the number and which way we sent the code; we do not keep the contact on NutrIA, and we delete the copy of the email or the note of the call when the code expires, after 30 days. We do it in our legitimate interest: that nobody passes themselves off as a dietitian-nutritionist to the people who use NutrIA. That record is deleted with the account that applied. If it was not you who applied, tell us at {email}.` |

<!-- Fuente:
¶1 — 0110 decisiones 1-2; 0111 § 2 (la insignia es la última comprobación decisiva, «pass», a no más de 30 días de su vencimiento a los doce meses); legal § 3.a (Ley 2/1974 art. 10.2.a: el registro muestra «situación de habilitación profesional»); «no significa que lo recomendemos»: PRD scope 11, criterio 18; LCD arts. 5.1.g y 21.1.c (no afirmar una aprobación que no hay).
¶2 — como hoy: care.schema.ts (14 días; aceptar o rechazar borra la fila; barrido diario).
¶3-5 — RGPD art. 13.1.e (destinatarios) y 9.2.a; PRD scope 7 (solo los planes hechos a través del enlace, sin strategy, targets de día ni status de comida; los totals del día se quedan), scope 9 (dos listas; un enlace lleva la suya), criterio 12 (ganar la insignia no amplía nada sin el consentimiento; perderla estrecha en la siguiente petición). La inferencia de energía es nueva (PRD scope 9); la del alérgeno, legal § 3.g. «No está obligado por ley al secreto profesional»: Ley 44/2003 art. 5.1.c obliga a los profesionales sanitarios; legal § 3.e. «Dejar de compartir solo tu salud»: solo existe en un enlace con alcance full (setSharesHealth(true) rechazado fuera de full, PLAN fase 5, paso 3).
¶6 — 0111 § 8 (tres puntos de aplicación); PRD scope 10; RGPD art. 13.2.f (lógica de una decisión automatizada) y 22.3 (intervención humana) por si el art. 22 aplica (M14); F1 y F4 de este documento.
¶7-8, 10 — como hoy (0059; care_access_log; cascada de borrado).
¶9 — RGPD arts. 4.7, 9.2.a, 9.2.h, 9.3, 26.2 (aspectos esenciales, por si hubiera corresponsabilidad); legal § 3.e (dos responsables nombrados mientras el abogado no conteste M12).
¶11 — RGPD art. 14.1-14.2 y 14.3.b (segunda capa de la información que lleva el propio código: textos/06 §§ R-T); 6.1.f; 5.1.c (solo la fila del solicitante: legal § 3.a); 5.1.e (plazos). F2 y F3 de este documento. El registro y el código caen en cascada con el profesional (PLAN fase 2, pasos 2-3). -->

### P-4. «La inteligencia artificial» — nothing changes

What a model receives does not change. A practitioner's generation is the client's generation
(the same `withClient` route), and no profile, badge record or code reaches a model (PRD
criterion 16). No sentence there turns false.

### P-5. «El asistente» — one phrase

| Hoy | es-ES nuevo | en-GB nuevo |
| --- | --- | --- |
| `… no las ve tu dietista si tienes uno …` | `… no las ve tu profesional si tienes uno …` | `… your professional, if you have one, does not see them …` |

### P-6. «Con quién compartimos tus datos» — one bullet added, first in the list (last sentence reworded and **approved by the owner on 2026-11-20**, «Aprobadas», § 12.5)

| es-ES | en-GB |
| --- | --- |
| `El profesional con el que te vinculas, si aceptas su invitación: lo que dice la lista que aceptaste, como se explica en «Tu profesional en NutrIA». Ningún otro profesional recibe nada tuyo.` | `The professional you link with, if you accept their invitation: what the list you accepted says, as explained under "Your professional on NutrIA". No other professional receives anything of yours.` |

<!-- Fuente: RGPD art. 13.1.e — el destinatario faltaba en la lista ya con 004 (se decía solo en su sección). -->

### P-7. «Cuánto tiempo guardamos tus datos» — one paragraph added

| es-ES | en-GB |
| --- | --- |
| `Si abres una consulta, tu perfil, nuestra revisión de él y lo que guardamos de la insignia duran mientras exista tu cuenta y se borran con ella.` | `If you open a practice, your profile, our review of it and what we keep about the badge last as long as your account and are deleted with it.` |

<!-- Fuente: RGPD art. 13.2.a; PLAN fase 2 (las tres tablas caen en cascada con el profesional; checked_by y seen_by pasan a NULL si se borra la cuenta del titular). -->

### P-8. Where the new text sits, as published in phase 10 (confirmed 2026-11-20)

Three replacements describe sentences the published page never had: P-1, and the two halves of
P-2. Their positions as wired are confirmed:

- **P-1**: the two bullets close «Qué datos recogemos», after «Lo que nos escribes».
- **P-2, consent**: the new sentence sits just before «Cada consentimiento se guarda…».
- **P-2, contract**: it closes the «contrato» sentence: «…tus pagos y los correos del servicio y, si
  abres una consulta, tu consulta y tu perfil.»
- **P-2, legitimate interest**: it closes the sentence with a comma: «…los avisos de seguridad que
  te enviamos, y comprobar, cuando alguien pide la insignia, que es quien dice ser en el registro
  de su colegio. Puedes oponerte escribiéndonos.»
- **P-7**: right after «Mientras tu cuenta exista…».

The English follows the same positions.

### P-0. Until the switch: one dated line (2026-11-20 — **approved by the owner on 2026-11-20**, «Aprobadas»; the date is Friday 27 November 2026, § 12.6)

**Ruling.**

- **Publishing early is allowed.** Publishing the section before the processing starts is what
  art. 13.3 asks for: information "con anterioridad" to the further processing. Nothing has to
  wait until the switch.
- **But three sentences would be false in the meantime.** They are written in the present tense:
  - P-3 ¶ 1 «Cualquier persona mayor de edad puede abrir una consulta…»;
  - P-3 ¶ 2 «Un profesional puede invitarte por correo…»;
  - T-1 ¶ 1 «Cualquier persona mayor de edad puede abrir una consulta…».

  Until the switch nobody can do either. Art. 5.1.a (lealtad y transparencia) and 12.1 ("de forma
  concisa, transparente, inteligible") are not met by a policy that says something is happening
  when it is not yet. And the change clause promises the mail **before** it "applies" (§ Z), so
  the page has to say from when.
- **The smallest honest fix is one dated line at the head of each section.** Its date equals § Z's
  `{date}`. It disappears by itself on that day.

| Where | es-ES | en-GB |
| --- | --- | --- |
| `/privacidad`, first paragraph of «Tu profesional en NutrIA» (`privacy.sections[tu-profesional]`, shown while `today < PRACTICES_OPEN_ON`) | `Lo que explica esta sección empieza el {date}. Hasta ese día, nadie puede abrir una consulta en NutrIA ni invitarte a una.` | `What this section describes starts on {date}. Until that day, nobody can open a practice on NutrIA or invite you to one.` |
| `/condiciones`, first paragraph of «Si trabajas con un profesional» (`terms.sections[profesional]`, the same condition) | `Esta sección se aplica desde el {date}. Hasta ese día, nadie puede abrir una consulta en NutrIA.` | `This section applies from {date}. Until that day, nobody can open a practice on NutrIA.` |

**How it goes away.** One constant, for example `PRACTICES_OPEN_ON` beside `LEGAL_TEXTS_UPDATED`
in `apps/web/src/i18n/legalDates.ts`, holds the switch day (= § Z's `{date}`). The pages are
static, so the line is decided **at build time**. It stops at the first deploy on or after that
day, which is why the owner redeploys the web on the day of the switch (go-live § 1 bis). If a
deploy comes late, the line lingers. It is not false while it does: «Hasta ese día…» names a day
already past, and says nothing about after it (amended 2026-11-20).

**Two conditions, because the switch is a separate act.**

- **The owner throws the switch no earlier than that day.** Before it, the line would say "nobody
  can" while somebody could.
- **If the switch slips, the constant moves the same day.** Otherwise the line vanishes and the
  three sentences are false again. § Z is not re-sent: it already says "a partir del {date}", and
  `06` § Z's rule is "si se retrasa, no se reenvía, pero nunca se adelanta". Both conditions are
  in the go-live checklist § 1 bis.

<!-- Fuente: RGPD arts. 5.1.a, 12.1 y 13.3 (información previa a un tratamiento ulterior); política vigente, «Cambios en esta política» («te avisaremos por correo antes de que se aplique»); TRLGDCU art. 85.3. Una línea fechada en lugar de reescribir las tres frases en futuro: las frases aprobadas quedan intactas y verdaderas desde el día, y la línea es lo único temporal. -->

## 5. `/condiciones`: the replacements

**Where**: `terms.sections` in both dictionaries. **Version**: `TERMS_VERSION` `2.3.0` → `2.4.0`,
`terms.updated`. **When**: phase 10, after the mail of `06` § Z.

### T-1. «Si trabajas con un dietista» → «Si trabajas con un profesional» — the section is replaced

**Key**: `terms.sections[i]`, `id: 'profesional'` (was `'dietista'`).

| ¶ | es-ES | en-GB |
| --- | --- | --- |
| heading | `Si trabajas con un profesional` | `If you work with a professional` |
| 1 | `Cualquier persona mayor de edad puede abrir una consulta en NutrIA. Si un profesional te invita y aceptas, podrá hacerte el plan y ver lo que explican la invitación y la política de privacidad, que depende de si tiene nuestra insignia «Dietista-nutricionista colegiada/o».` | `Any adult can open a practice on NutrIA. If a professional invites you and you accept, they can make your plan and see what the invitation and the privacy policy explain, which depends on whether they hold our "Registered dietitian-nutritionist" badge.` |
| 2 | `La insignia solo dice que, en la fecha que muestra, comprobamos en el registro público de su colegio que figura como dietista-nutricionista colegiado y habilitado, y que la cuenta es suya. Un profesional sin ella no es un profesional sanitario verificado por NutrIA: lo que diga de sus estudios lo declara esa persona y no lo hemos comprobado. Ni la insignia ni nuestra revisión de un perfil significan que recomendemos a nadie ni que hayamos comprobado su trabajo.` | `The badge only says that, on the date it shows, we checked on their college's public register that they are listed as a registered dietitian-nutritionist entitled to practise, and that the account is theirs. A professional without it is not a health professional verified by NutrIA: whatever they say about their studies is their own statement and we have not checked it. Neither the badge nor our review of a profile means that we recommend anybody or that we have checked their work.` |
| 3 | `Tu profesional es independiente: su consejo, su precio y lo que acordéis, también el pago, son cosa vuestra y se hacen fuera de NutrIA. NutrIA no te cobra nada por él ni recibe tu dinero. Estar vinculado a un profesional no te da Premium: conservas los límites de tu cuenta.` | `Your professional is independent: their advice, their price and whatever you agree, payment included, are between the two of you and happen outside NutrIA. NutrIA charges you nothing for them and never receives your money. Being linked to a professional does not give you Premium: you keep your account's limits.` |
| 4 | `Un plan que haga tu profesional en NutrIA pasa las mismas comprobaciones que cualquier otro: tus alergias e intolerancias y los límites de calorías y de proteína. NutrIA no revisa su consejo.` | `A plan your professional makes on NutrIA goes through the same checks as any other: your allergies and intolerances and the calorie and protein bounds. NutrIA does not review their advice.` |
| 5 | `Si tienes anotada una condición de salud o una medicación, solo puedes vincularte con un profesional con la insignia, y un enlace con uno sin ella termina si la anotas o si el tuyo la pierde. Así se explica en la política de privacidad.` | `If you have a health condition or a medication on record, you can only link with a professional who holds the badge, and a link with one who does not ends if you record one or if yours loses it. The privacy policy explains how.` |
| 6 | `Puedes terminar el enlace cuando quieras. Al terminar, conservas tu cuenta, tu historial y tu último plan publicado.` | `You can end the link whenever you like. When it ends, you keep your account, your history and your last published plan.` |
| 7 | `Si alguien se presenta en NutrIA como lo que no es, o usa mal tus datos, escríbenos a {email} contándonos quién y qué: lo miramos, te decimos qué hemos hecho y, si retiramos algo, se lo explicamos a esa persona.` | `If somebody presents themselves on NutrIA as something they are not, or misuses your data, write to us at {email} telling us who and what: we look into it, tell you what we did and, if we remove anything, explain it to that person.` |

<!-- Fuente:
¶1-2 — 0110 decisiones 1-2; LCD arts. 5.1.g, 21.1.c y 21.2 (la insignia es una afirmación propia de NutrIA, no contenido alojado: legal § 3.a); DSA art. 6.3 (que la interfaz no haga creer que el servicio es de NutrIA).
¶3 — 0110 decisiones 6 y 13; PRD scope 3 y criterio 8 (tierOf y coveredByOpenPractice no cambian: un enlace a una consulta con practiceOpen = false no da Premium). **Verdad mientras ninguna consulta pague**: practiceOpen solo lo escribe el webhook de Stripe, y los pagos están aplazados (0110 decisión 6). Si un día hay planes de consulta, esta frase pasa a «… no te da Premium, salvo que su plan de consulta lo incluya» en el mismo cambio. RDL 19/2018 art. 1.2 (NutrIA no presta servicios de pago: legal § 3.f).
¶4 — 0110 decisión 11 y legal B5; el profesional genera con el mismo generador por withClient (findSafetyViolations, targetViolations, el suelo de energía del Scheduler).
¶5 — 0111 § 8.
¶6 — como hoy, sin «con los límites gratuitos», que era falso para quien paga Premium por su cuenta.
¶7 — DSA arts. 12 (punto de contacto) y 16 (notificación: aquí un correo, mientras no exista el botón del proyecto 5), 16.5 (decir al notificante lo decidido) y 17 (motivos al afectado). B6 entra entera con el directorio; esto es el mínimo que ya se puede cumplir. -->

### T-2. «Responsabilidad» — the second paragraph is replaced

| Hoy | es-ES nuevo | en-GB nuevo |
| --- | --- | --- |
| `Si usas NutrIA con un dietista, lo que te aconseje es responsabilidad suya como profesional; lo que haga NutrIA —cómo calcula, qué comprueba y qué te muestra— es responsabilidad nuestra.` | `Si usas NutrIA con un profesional, lo que te aconseje es responsabilidad suya; lo que haga NutrIA —cómo calcula, qué comprueba, qué te muestra y la insignia— es responsabilidad nuestra.` | `If you use NutrIA with a professional, their advice is their responsibility; what NutrIA does — how it calculates, what it checks, what it shows you and the badge — is ours.` |

<!-- Fuente: TRLGDCU art. 86.2 (no excluir la propia responsabilidad por daños a la persona) y 147; legal § 3.g y M10. «La insignia» se nombra porque es una afirmación propia (LCD art. 5.1.g): de ella responde NutrIA, no el profesional. -->

### T-0. Until the switch (**approved by the owner on 2026-11-20**, «Aprobadas»)

The dated line of P-0 opens «Si trabajas con un profesional» (`06` § Z's `{date}`, the same
constant). `TERMS_VERSION` → `2.4.0` and the date of «Última actualización» move on the day of
publication, not on the switch day (§ 12.4).

## 6. The words table (phase 3, step 5: `core/domain/ProtectedWords`)

This is what the function enforces and what its tests feed it. **The decisive rule is the
token, not the substring**:

- **two passes, in this order.** (1) **On the raw text**, before anything is stripped: the
  numeric patterns of § 6.4 (a number followed by `kg`, `kilo`, `kilos`; `100 %`), which the
  word pass could never see because it turns digits into spaces. (2) **The word pass**: lower
  case; the substitutions `0→o`, `1→i`, `3→e`, `4→a`, `5→s`, `@→a` applied **only inside a token
  that also holds letters** (so «n3utricionista» is caught and «1487» is left alone); strip
  accents (`á→a`, `ñ→n`); then turn every remaining non-letter (hyphen, dot, slash, digit,
  punctuation) into a space; collapse spaces.
- **match whole tokens or token sequences**. Then «nutricional» passes while «nutricionista»
  fails, and «d n» matches «D-N» but not the inside of «andén».

**Where it runs**: every free-text field of the profile (`display_name`, `studies`, and any field
added later) and every practice label a practitioner can type. **Context**: whether `badgeOf`
holds (PRD scope 5; `0111` § 7). The fixed notice and the badge are **rendered by the product**,
never typed.

### 6.1 Badge-only — refused without the badge

| Spanish tokens (each with its feminine and plural) | English tokens | Source |
| --- | --- | --- |
| `dietista`, `nutricionista`, `dietista nutricionista`, `d n`, `dn` (alone as a token) | `dietitian`, `dietician`, `nutritionist`, `registered dietitian` (not `rd` alone: in Spanish it is «Real Decreto») | Ley 44/2003 art. 2.2.b; CP art. 403.2.a; legal § 3.a table |
| `colegiado`, `colegiada`, `colegiados`, `colegiadas`, `colegiacion`, `n colegiado`, `numero de colegiado`, `num colegiado` | `registered member`, `registration number` | Rule: no unchecked number or «colegiado» (legal § 3.a; PRD criterion 5) |
| `nutricion humana y dietetica`, `nhd`, `grado en nutricion`, `graduado en nutricion`, `graduada en nutricion`, `diplomado en nutricion`, `diplomada en nutricion` | `human nutrition and dietetics` | Ley 44/2003 art. 2.2.b (the title) |
| `nutriologo`, `nutriologa` | — | the same profession under its Latin American name (choice C9) |
| clinical: `consulta`, `consultas`, `paciente`, `pacientes`, `tratamiento`, `tratamientos`, `diagnostico`, `diagnosticos`, `diagnosticar`, `clinico`, `clinica`, `clinicos`, `clinicas`, `terapeutico`, `terapeutica`, `terapia`, `terapias` | `patient`, `patients`, `treatment`, `diagnosis`, `diagnose`, `clinical`, `therapeutic`, `therapy`, `consultation` | Legal § 3.a table (CP 403.2.a; LCD 5.1.b) |

### 6.2 Never in v1 — refused with or without the badge

| Spanish tokens | English tokens | Source |
| --- | --- | --- |
| `medico`, `medica`, `medicos`, `doctor`, `doctora`, `dr`, `dra` | `doctor`, `physician`, `md` | Ley 44/2003 art. 2.2.a; legal § 3.a; `doctor`/`dr` choice C9 (it is also a PhD; v1 cannot tell which) |
| `endocrino`, `endocrina`, `endocrinologo`, `endocrinologa` | `endocrinologist` | the same |
| `enfermero`, `enfermera`, `enfermeros`, `enfermeras` | `nurse` | Ley 44/2003 art. 2.2.b |
| `farmaceutico`, `farmaceutica` | `pharmacist` | art. 2.2.a |
| `psicologo`, `psicologa`, `psicologo sanitario`, `psicologa sanitaria` | `psychologist` | Ley 33/2011 DA 7ª (the sanitario title) and the degree; bare «psicólogo» is choice C9 |
| `tecnico superior en dietetica`, `tecnica superior en dietetica`, `tsd` | `dietetic technician` | Ley 44/2003 art. 3.2.a; `0110` Consequences and legal O10: not checked in v1, so not claimed in v1 |

**What a real Técnico/a Superior en Dietética loses**: they cannot name their own title in
«estudios» in v1. That is the cost of O10 (a). It is the owner's to change with a second checked
mark, not mine.

### 6.3 Allowed, always with the fixed notice

`asesor de alimentacion`, `asesora de alimentacion`, `asesor nutricional`, `asesora nutricional`,
`coach nutricional` (and `nutrition coach`, `food adviser` in English). The tokens «nutrición»,
«nutricional», «alimentación» and «dietética» **alone** are not refused. The one exception is the
degree's full name in § 6.1. «Curso de nutrición deportiva» passes. «Grado en Nutrición Humana y
Dietética» does not, without the badge.

**The fixed notice**, rendered by the product beside the name of every un-badged practitioner,
on every screen where a client **decides** about that person (the invitation, the link card, the
re-consent card) and in the owner's console (amended 2026-11-19, § 12.3: a bare name that passed
`nameShown` elsewhere claims no title): **«No es un profesional sanitario verificado
por NutrIA»** / **"Not a health professional verified by NutrIA"**.

**The badge**, rendered from `badgeOf` and never from text: **«Dietista-nutricionista
colegiada/o»** with **«Comprobado por NutrIA el {date}»** / **"Registered dietitian-nutritionist"**
with **"Checked by NutrIA on {date}"** (the owner's design of 2026-11-18). The number appears only
beside it.

**Names versus profile text (2026-11-19).** An account's name (the one a client sees) is judged
for **titles only**: the lists of §§ 6.1 and 6.2. **The promised-results pass of § 6.4 applies to
profile text, never to a person's name.** A name like «Ana 100 %» is odd, but it is not an offer.
Refusing it would bar a person from the practice for their own name, with no ground in LCD art. 5
or in RD 1907/1996.

### 6.4 What no word list can catch — the owner's first look

A function cannot judge these two. The first look does (PRD scope 11), and `06` § X words its
refusal:

- **a disease offered as a service** («dieta para la diabetes», «plan para el SOP», «te curo el
  colon irritable»). The function **may** add the condition names of `HEALTH_CONDITIONS` as
  badge-only tokens (`diabetes`, `hipertension`, `colesterol`, `celiaquia`, `sop`, `ovario
  poliquistico`, `hipotiroidismo`, `colon irritable`, `reflujo`, `gota`, `renal`, `embarazo`,
  `lactancia`, plus `anorexia`, `bulimia`, `tca`, `obesidad`, `cancer`). That is a choice, and it
  will refuse honest studies text («curso de nutrición en la diabetes»). I recommend it for v1,
  because a refusal costs an edit and a miss costs a person.
- **promised results** («−10 kg en un mes», «resultados garantizados», «adelgaza sin esfuerzo»).
  The tokens `garantizado`, `garantizada`, `garantizados`, `asegurado`, `100%` and a number
  followed by `kg` or `kilos` can be refused for everybody. "Without effort" and its kind are
  judged at the first look.

### 6.5 Tests the function must pass

For every token in §§ 6.1–6.2: refused in each field, with accents, capitals, hyphens, dots and
the substitutions applied. Refused also with the badge where § 6.2 says so. **Must pass**:
«Asesora nutricional», «Coach nutricional», «Curso de nutrición deportiva», «Andén» (not «d n»),
«Medicina tradicional china» if C9 is not taken (`medicina` is not `medico`), «consultoría»
(`consultoria` is not `consulta`), «RD 1487/2009» (no `rd` token), «Bajé 10 kg de grasa corporal en 2019» **fails** the raw pass for everybody (a number with `kg`: decided — a weight figure in a profile reads as a promised result). With § 6.4's condition list adopted, «Asesora de lactancia» **fails** without the badge (`lactancia`): that is the price of the list, and the owner decides it with C9. **Must fail without the badge**: «Dietista-Nutricionista»,
«D.N.», «Nutri-cionista» (after punctuation removal it is `nutri cionista`, so add `nutri
cionista` to § 6.1 or judge it at the first look: choice), «colegiada nº 1234», «Grado en NHD».

## 7. Neutral strings, and the disposition of every dictionary hit

**Phase 10's search must cover both languages.** The plan's pattern (phase 10, step 2) is Spanish
only. For `en-GB.ts` run:
`grep -niE 'dietitian|dietician|nutritionist|registered|registration number|professional secrecy|patient'`.

Below, every hit in both dictionaries on 2026-11-18, by key. "Neutral" means the string is
rewritten for every tier (choice C3). "Badge" means it is shown only to or about a badged
professional. "True" means it speaks of the profession in general and stays.

| Key (es-ES / en-GB) | Disposition | es-ES | en-GB |
| --- | --- | --- | --- |
| `admin.professionalLabel` | rewrite | `Consultas de profesionales` | `Professionals' practices` |
| `admin.professionalHint` | rewrite | `Encendido: cualquier cuenta mayor de edad puede abrir su consulta e invitar a sus clientes.` | `On: any adult account can open its practice and invite its clients.` (replaces «the professionals you grant…») |
| `admin.professionalOffHint` | rewrite | `Apagado: nadie ve la consulta. Los clientes siguen como cuentas normales.` | `Off: nobody sees the practice. Clients carry on as ordinary accounts.` |
| `adminAccounts.professionalCollegiate`, `adminProfessionals.columns.collegiate` | phase 9: shown only from a `pass` check | `Nº comprobado` | — |
| `adminProfessionals.intro` | rewrite | `Cada profesional con sus vínculos contados. Aquí no aparece ningún cliente.` | — |
| `assistant.*` (4 strings), `footer.disclaimer`, `landing.faq`, `privacy.intro[1]`, `profile.supervision`, `terms.intro`, `terms.sections` (assistant) | **true**: they speak of the profession, not of a NutrIA user | unchanged | unchanged |
| `care.endConfirmBody` | neutral | `{professional} dejará de ver tus datos desde ahora. Tus objetivos, tu historial y tu último plan publicado se quedan contigo, y el registro de sus accesos sigue en tu perfil. Lo que ya hubiera anotado por su cuenta lo conserva según su normativa. Puedes aceptar otra invitación suya más adelante.` | `{professional} will stop seeing your data from now on. Your targets, your history and your last published plan stay with you, and the record of their access stays on your profile. Anything they already noted on their own account they keep under their own rules. You can accept another invitation from them later.` |
| `care.healthShareOffHint` / `OnHint` | badge (the toggle exists only on a `full` link) | `{professional} deja de verlas en cuanto lo desactivas. El enlace sigue activo.` / `{professional} puede verlas.` | `{professional} stops seeing them as soon as you turn it off. The link stays active.` / `{professional} can see them.` |
| `care.invitationIntro` | replaced by `05` § F | — | — |
| `care.invitationLinkExistsBody`, `errors.careLinkExists` | neutral | `Ya estás vinculado con {professional}, desde el {since}.` / `Ya estás vinculado con un profesional.` | `You are already linked with {professional}, since {since}.` / `You are already linked with a professional.` |
| `care.invitationPrivacy` | replaced by `05` § F | — | — |
| `care.linkTitle`, `profile.sectionCare`, `targets.badgeProfessional` | neutral | `Tu profesional` | `Your professional` |
| `targets.subtitleProfessional` | neutral | `Los ha ajustado {name}` | `Set by {name}` |
| `dashboard.pendingReviewTitle`, `plan.pendingReviewTitle` | neutral | `Tu plan nuevo está con {name}` | `Your new plan is with {name}` |
| `dashboard.pendingReviewBody`, `plan.pendingReviewBody` | neutral | `{name} lo está revisando antes de publicarlo. Mientras tanto, sigue con el plan que ya tenías.` (plan: `… Aquí sigue tu plan anterior, tal como estaba.`) | `{name} is reviewing it before publishing. In the meantime, carry on with the plan you already had.` |
| `errors.practiceFull`, `practice.inviteFull` | rewrite (no plan) | `Tu consulta ya tiene sus {count} clientes. Para invitar a otro, termina un vínculo o espera a que caduque una invitación.` | `Your practice already has its {count} clients. To invite another, end a link or wait for an invitation to expire.` |
| `health.consentNote` | replaced by `05` § C bis | — | — |
| `pages.'/consulta/[linkId]'.title` | neutral | `Un cliente` | already `A client` |
| `practice.*` with «paciente» (every such key outside the `plan*` group below: `back`, `clientsEmpty`, `clientSince`, `clientsTitle`, `endHint`, `generate*`, `gone`, `healthIntro`, `intro`, `invite*`, `newFortnightDirect`, `pendingIntro`, `regenerateHint`, `review*Hint`, `targets*`) | neutral: «paciente» → «cliente», «tu paciente» → «tu cliente» or the name, same sentence otherwise | e.g. `Aún no tienes clientes. Invita al primero con su correo.` | already «client» |
| `practice.plan*` (`planChoose`, `planChoosePlain`, `planClosed`, `planLapsed`, `planPastDue`, `planSeats`, `planTerms*`, `planTrial*`, `planUnavailable`, `planJustPaid`, `planManage`, `planRenews`, `planEnds`, `planTestMode`, `inviteFullUp`, `paused`, `pausedHint`) | **removed from the free practice's screen**: no plan can be bought. `planSeats` becomes the seats line of `01` § Pantallas | — | — |
| `practice.healthIntro` | badge | `Tu cliente decidió compartir esto contigo. Nunca se envía a ningún modelo.` | — |
| `practiceAgreement.*` | replaced by `01` 2.0.0; `practiceAgreement.terms` removed (C10) | — | — |
| `privacy.sections` («Tu dietista en NutrIA», «El asistente» ¶ 6) | § 4 | — | — |
| `secondFactorRequired.practice[0]` | neutral («pacientes» → «clientes»; «son datos de salud» stays: a plan with its totals is health data in context, legal § 1.2) | `Para ver los datos de tus clientes, tu cuenta necesita la verificación en dos pasos: son datos de salud, y tu contraseña sola no basta para abrirlos.` | already «clients» |
| `terms.sections` («Si trabajas con un dietista», «Responsabilidad» ¶ 2) | § 5 | — | — |

**«clientes» for a badged professional too (C3).** A dietitian may call the people they see
«pacientes». The product does not have to. The badge says what they are.

**The first look, in one sentence that is not an endorsement** (`01` § Pantallas,
`practice.profileReviewNote`): «Revisamos cada perfil nuevo y cada cambio, solo para ver que no
hay publicidad engañosa, spam ni palabras que no puedes usar. No comprobamos tus estudios, y que
lo hayamos revisado no significa que NutrIA te recomiende.»

## 8. `PRODUCT.md`: the proposed text (step 8 — the lead applies it once the owner approves)

### 8.1 § Scope — replaces the "Deliberately excluded" paragraph and adds one bullet

**Add to "v1 includes"**, after the assistant's bullet:

> - A **professionals' area**: any adult may open a practice, describe their services (studies
>   as they declare them, price, hours), invite up to ten clients by email and make their plan
>   through a consented, audited link. Only a professional NutrIA has itself checked against
>   their college's register — the badge — receives health data beyond the plan they make, and
>   only with the client's consent (`0110`, `0111`). A person with a declared condition or
>   medication links only with a badged professional.

**Replace** "Deliberately excluded from v1: … social features, coach marketplaces, wearable
integrations, payments." **with**:

> **Deliberately excluded from v1:** barcode scanning, photo food logging, restaurant
> databases, macro-by-macro manual logging, social features, wearable integrations, payments.
> The rest of the professionals' marketplace — a directory and search, requests, a chat,
> ratings and public profile pages — waits for its own project
> ([`0013`](./reference/architecture/0013-a-marketplace-of-professionals-2026-11-18.md) § 9),
> and money between a professional and a client never passes through NutrIA.

### 8.2 § Users — the professional's paragraph also becomes false (recommended in the same change)

Today's paragraph says a professional is "granted by the owner … after seeing a collegiate
number", that they "pay a subscription", and that "a linked client … keeps the paid allowances".
All three are false after 025. Proposed replacement for its first and last sentences:

> **A second kind of user, since project 004 and open to anyone since project 025: a
> professional.** Any adult account may open a practice. Only the badge — NutrIA's own check of
> a college's public register and of the account's owner, renewed yearly — lets the product call
> them a dietitian-nutritionist, never a sign-up field or a typed number. … *(the middle of the
> paragraph stays, with "Linked, a professional **may**" split by the badge as in `0111` § 4)* …
> A practice is free for ten active clients, and a linked client keeps their own account's
> allowances.

## 9. What goes to whom (sent by message, `path:line`)

- **The lead, plan gaps.** (a) `HEALTH_CONSENT_VERSION` → `1.2.0` with `05` § C bis, which no
  phase lists (F1). (b) The practitioner's re-check reminder, `06` § U.2, which phase 3 does not
  send (C5). (c) Refuse versus hide (F6). (d) The English grep for phase 10 (§ 7). (e) A
  revoked account could open a new practice at once by self-service, so the revoke closed
  nothing, and (f) there was no "suspend" act — **both answered by the owner on 2026-11-18** with a
  real suspension (§ 11). (g) C12 — **answered: dropped** (§ 11).
- **`backend` (phase 5).** Any new value of `care_link_ended_by`
  (`packages/database/src/schemas/_enums.ts:97`) is presented to the practitioner exactly as
  `client`. The acceptance refusal sends the practitioner nothing (F4). No template fires only
  under the illness rule.
- **`frontend` (phases 8–10).** The disposition table of § 7. Choices C2–C4 once the owner
  approves them. The anchor `#tu-profesional`.

## 10. For the lawyer's hour (new items, after M1–M13)

| # | Question | Why it matters | Min |
| --- | --- | --- | --- |
| M14 | Is refusing or ending a link because a person declared a condition or medication (a) a new purpose that the health consent must name, so that it is asked again, and (b) a decision under art. 22.1? If (b), is the consent of § C bis, together with review by a person at `{email}`, enough under art. 22.2.c, 22.3 and 22.4? | F1. The texts assume yes to (a) and "possibly" to (b). | 3 |
| M15 | Does sending a code to the contact a college's register lists, about a person who may not have applied, rest on art. 6.1.f with the art. 14 notice of `06` §§ R–T? And is keeping the `fail` record (that person's number, against the impostor's account) for the life of that account proportionate? | F2. | 2 |
| M16 | May an un-badged practitioner keep, after the link ends, what they copied of a client's plans? The agreement 2.0.0 tells them to delete it (art. 7.3 withdrawal; no 9.2.h). | `01` 2.0.0 § 7. | 1 |
| M17 | Does P2B (Reg. 2019/1150) apply to a practice tool where the professional brings their own clients and NutrIA introduces nobody (art. 2.2), before any directory exists? | F8. The agreement applies it anyway. The answer decides only whether a breach of its 15 or 30 days would be void (art. 3.3). | 1 |
| M18 | When a close is reversed, does P2B art. 4.3 ("reincorporará… incluso en lo que respecta al acceso a los datos… generados por su uso") oblige NutrIA to restore the links that ended with the close, or does art. 1.5 ("sin perjuicio del… Derecho de la Unión… [en] la protección de datos") let each client decide again? | `06` § W bis.4 assumes the clients decide again | 1 |


## 11. The owner's decisions (2026-11-18)

Relayed by the lead the same day. The owner's own words are not quoted here; what is recorded is
the option he tapped and the two answers.

0. **2026-11-19:** see § 12.1 for the approvals of that day (W bis.1–4, A bis, `practice.profilePromiseRefused`, the agreement §§ 11 and 13).
1. **Every phase-1 text is approved**, with choices **C1–C11 as written** (tapped option
   «Aprobados», 2026-11-18). This covers the agreement 2.0.0 and the practitioner's screens
   (`textos/01`), the consent 3.0.0, the re-consent, the illness-rule screens and the health
   note 1.2.0 (`textos/05` §§ C bis, F, G), the mails §§ R–Z (`textos/06`), the `/privacidad`
   and `/condiciones` replacements (§§ 4–5), the words table (§ 6), the dispositions (§ 7) and the
   `PRODUCT.md` text (§ 8). They are still drafts for the product: they are wired, and their
   version constants move, in the phases of § 1.
2. **C12: the college-issued e-mail channel is dropped.** The badge code goes only to a contact
   the public register shows, in this order: an e-mail listed there; a letter to the professional
   address listed there; the owner's call to the phone listed there. Never a contact the applicant
   supplies. Applied to `textos/01` 2.0.0 § 4 and `practice.badgeApplyPrivacy`, `textos/06` §§ R
   and T, `/privacidad` P-3 ¶ 11, the record (row 12), the DPIA (R-P3) and the checklist.
3. **A real suspension joins the plan** (the answer to § 9 (e)–(f)). From the console the owner
   can suspend an account as a practitioner. It takes effect at once, with reasons, and while it
   lasts the account sees no client's data, invites nobody and cannot open or reopen a practice
   until it is lifted. A **definitive close** carries a statement of reasons and **30 days'
   notice**, sooner only on a legal obligation or repeated breach (P2B art. 4.2 and 4.4).
   **Hiding a profile and withdrawing a badge stay immediate.** Applied to:
   - `textos/01` 2.0.0 §§ 11 and 13;
   - `textos/06` § W bis (suspension, lifting, close with 30 days and its immediate variant);
   - the DPIA (R-P7, M8);
   - the record (row 11);
   - the checklist § 1 bis, which now carries an end-to-end box: a suspended account's
     `POST /care/practice` answers 404.


## 12. Phase 6 additions and two findings recorded (2026-11-19)

**New words, not yet approved by the owner** (the lead asks him):

- `textos/06` § A bis: the invitation mail with one neutral sentence for both tiers (`intro`,
  `meaning`). The principle is C3, already approved; the sentences are new.
- `textos/06` § W bis.4: a close taken back, before or after its date (P2B art. 4.3, read with
  art. 1.5).
- `textos/01` § Pantallas, P4: `practice.profilePromiseRefused`.

**F9 (P2). `care_links.ended_by` can now read `declared` or `badge_lost`, and each value is health
data by inference.** Since phase 5 (`packages/database/src/schemas/_enums.ts:103`), a link row
records that it ended under the illness rule. Either value says the client has a condition or a
medication on record (art. 9.1; CJEU C-184/20 reads "data concerning health" to include what can
be deduced). The rule for it:

- **The client may see it.** It is their own data, and their screens (`textos/05` § G.3) say it in
  words.
- **The practitioner never sees it**, by any route. `endedByForPractitioner` presents both values
  as `client` (F4).
- **Where else it could leak, and must not:**
  - **A practitioner's own subject-access copy** (art. 15) or export. The link row is also *their*
    data, but art. 15.4 bars a copy that "afecte negativamente a los derechos y libertades de
    otros". Their copy presents both values as `client`, the same as their screens.
  - **The owner's console.** It reads no client (`0028`, `0068`). A per-practitioner count of
    `declared` or `badge_lost` endings would be a count of health records behind a named person,
    so the console counts links by status only, as `adminProfessionals` does today.
  - **Logs, error reports and mail.** None carries the value. `textos/06` § Y's client mail
    names no reason.
- **Retention**: with the client's account, like every `care_links` row (record row 5). When the
  practitioner's account goes, `professionalId` is set null and the value stays with the client.

Record of processing row 5 and DPIA R-P2 carry this. **No text changes:** the consent already
tells the client that the practitioner sees only that the link ended (`05` § F.2, F.3, G.3).

**F10 (P2). Narrowing a link after a lost badge leaves no trace the client can see.**
`CareRepository.narrowLinksOf` and `sweepBadgeLoss` (`packages/core/src/repositories/Care/CareRepository.ts`,
the comments at ~721 and ~1020) set `consent_scope = 'plan'` and turn the health line off,
"narrowing mails nobody". No row reaches the client's trail, because the client did not act;
`care_links.narrowed_at` is the only evidence.

- **What breaks without it.** The client's health toggle reads *off* although they never touched
  it. Nothing tells them why, and the re-consent card (`05` § F.4) appears only once a badge
  stands again.
- **Is a row legally required? Not strictly.** The trail's promise is about the professional's
  acts («cada vez que mire o cambie algo»), and narrowing discloses less, not more. The
  policy already states the rule in general (`/privacidad` P-3 ¶ 5: «si la pierde, desde ese
  momento ve solo…»).
- **But art. 5.1.a and 12.1 ask that a change to what is shared about a person be intelligible
  to them.** A consent they gave (the health line) has been switched off by the controller.
  Saying so is the minimum, and it costs one row.
- **Recommendation for phase 10 (P2): a trail row with NutrIA as the actor**, written in the same
  transaction as the narrowing, dated `narrowed_at`. Its words name no condition and give the
  reason, which the client is entitled to know (it is the practitioner's status, not the
  client's health).

| Key (proposed) | es-ES | en-GB |
| --- | --- | --- |
| `care.accessLogNarrowed` | `{professional} ya no tiene la verificación de NutrIA: desde entonces ve solo los planes que te hace` | `{professional} is no longer verified by NutrIA: since then they only see the plans they make for you` |
| `care.accessLogNarrowedHealth` (when the health line was on) | `{professional} ya no tiene la verificación de NutrIA: desde entonces ve solo los planes que te hace, y dejó de ver tu salud` | `{professional} is no longer verified by NutrIA: since then they only see the plans they make for you, and stopped seeing your health` |

These two strings are **new and unapproved**. If the owner prefers no row, the alternative is a
line on the link card, built from `narrowed_at` (same words). Either one closes F10. Doing
nothing leaves the toggle unexplained.

<!-- Fuente: RGPD arts. 5.1.a, 12.1, 9.1 (inferencia: TJUE C-184/20 y C-21/23, como en analysis.md § 1.2), 15.3-15.4; 0059 (el rastro es del cliente); PRD 025 criterio 12. -->


### 12.1 Approvals of 2026-11-19 (relayed by the lead; tapped options)

- **Earlier that day:** `textos/06` §§ W bis.1–3 (suspension, lifting, close with 30 days and its
  immediate variant) and the agreement 2.0.0 §§ 11 and 13.
- **Later that day:**
  - (a) `textos/06` § A bis, the invitation mail's neutral `intro` and `meaning`;
  - (b) `textos/06` § W bis.4, both variants, with the corrected "after" body (the badge is
    withdrawn by the close, `ProfessionalRepository.close`);
  - (c) `practice.profilePromiseRefused`.
- **Amended the same day, as a fact rather than a choice:** W bis.4 picks its variant by whether
  the close **was carried out**, not by whether `{closeDate}` has come. Until the sweep runs, the
  links are intact.
- **Later still, the same day** (tapped option «Aprobadas»): the no-name variants. These are
  `textos/06` § Y `subjectNoName` and `bodyNoName`, and `textos/05` § F.3 bis
  `care.invitationLinkExistsBodyNoName`.
- **Confirmed by the owner the same day** («Sí, así»):
  - a close that is carried out ends the practitioner's links;
  - a badge regained widens nothing without the client's fresh consent.
- **Still unapproved**: the two trail strings of § 12 (F10).

### 12.2 For phase 8 (recorded, no text yet)

- **A practitioner refused at an invitation because of their account's name** needs two things:
  a way to change that name, and one sentence telling them where. Today the name is the account's,
  set at sign-up or by Google or Apple. The sentence is phase 8's. It should name the screen
  where the name is edited, and it may quote the refused word, because it goes only to the
  practitioner, who wrote it.
- **The name is judged for titles only** (§ 6, «Names versus profile text»): `badge_only` and
  `never`, not the results list.


### 12.3 Phase 8's screens, read against the approved texts (2026-11-19)

Read on branch `project-025-phase-8-screens` at `aacfda1f`. The check was mechanical: every
approved string of `textos/01` (2.0.0 and § Pantallas P1–P4) and of `textos/05` (§§ C bis, F,
F.3 bis, G), Spanish and English, searched verbatim in both dictionaries.

**The copy.**
- **0 differences.** All 14 sections of the agreement 2.0.0 are there, with title, intro,
  checkbox and button. The consent 3.0.0 is there per tier. The health note 1.2.0 is there.
- **Nothing of the old versions is left**: no «concesión», no practice-plan terms, no «número
  de colegiado {collegiateNumber}, te invita», no «Tu dietista» on a client screen.
- **The version constants match the words**: `PROFESSIONAL_AGREEMENT_VERSION` = `2.0.0`,
  `CARE_CONSENT_VERSION` = `3.0.0`, `HEALTH_CONSENT_VERSION` = `1.2.0`. `TERMS_VERSION` stays
  `2.3.0` until phase 10.
- **§ 7's replacements are in**, with two notes:
  - `pendingReviewTitle` and `pendingReviewBody` use `{professional}` where § 7 wrote `{name}`.
    Same words, and through `withProfessional` they fall back to «tu profesional».
  - The console strings of § 7 (`admin.professional*`, `adminProfessionals.intro`, and
    `adminConsents.howCounted`'s «concesión») are unchanged. They are phase 9's.

**Pure labels, no wording needed:**
- `practice.intro`, `badgeTitle`, `badgeSteps`, `nameTitle`, `nameCta`, `nameSaved`,
  `profileTitle`, `seatsTitle`;
- `profileHours{Add,Closed,From,To,Remove}`, `profilePriceUnitLabel`, `profileSaved`;
- the page titles `/consulta/insignia` and `/consulta/perfil`, and «← Clientes»;
- the «paciente» → «cliente» rewrites, which follow § 7's rule;
- `openTitle` and `openIntro`, which come from `textos/01` P1, approved 2026-11-18. The card is
  on every adult's profile. That is fine: it describes an offer, not a person.

**Approved by the owner on 2026-11-19** (tapped options): every sentence of `textos/01` P5 —
`restrictionSuspendedScreen` and `restrictionRedress` («Aprobado»); `restrictionClosed` and
`badgeState.withdrawnScreen` («Aprobados»); `inviteNameRefused` in its three forms («Aprobado»);
`openRefused` and `endConfirmBody` («Aprobados»).

**Statements that needed wording** are in `textos/01` P5: the three screen variants, the redress
line, `endConfirmBody`, `inviteNameRefused` in three forms, and `openRefused` (a choice). Also
noted there: the typed «10».

**What the screens do against the law (item 4 of the lead's request):**
- ✔ **Art. 13 at the badge application.** `badgeApplyPrivacy` is drawn inside the form, above
  its button (`PracticeBadge.tsx:203-228`).
- ✔ **The fixed notice.** It is on the invitation (`CareInvitation.tsx`, plan tier) and on the
  client's link card (`CareLinkCard`). The practitioner sees `unverifiedSelf` on `/consulta` and
  on the client page.
- ✔ **«Acepto y consiento»** on the un-badged button only (C4). The badged button stays
  «Aceptar la invitación».
- ✔ **The tiers.** No health line on the plan tier. The badge line comes only from a check with a
  number. An invitation whose name may not be shown is a 404 (`CareController.ts:941`), so the
  consent always names the person (art. 9.2.a, legal § 3.e).
- ✔ **The re-consent card** (§ F.4). It has the wider list and `canDo.targets`, the health line
  apart and unticked, both inferences and the badged privacy line.
- **P3 — this document over-promised, now amended.** § 6.3 said the fixed notice goes "beside the
  name of every un-badged practitioner, on every screen a client sees that name".
  - The dashboard and the plan page show the name in «Tu plan nuevo está con {professional}»
    without it.
  - A bare name that has passed `nameShown` claims no title, so nothing in LCD art. 5.1.g
    requires the notice there.
  - It is required where the client **decides** about that person: the invitation, the link
    card and the re-consent card. § 6.3 now says so.
- **P3 — the approved `practice.dishRefused` is drawn nowhere.** In 025 a practitioner never
  picks one dish for a client: a swap offers only what fits and says «no tenemos otro plato que
  encaje aquí», naming no reason. The agreement's § 3 sentence is still true in substance, since
  they never learn the reason. The string waits for project 2's "put this dish here".
- **For phase 10.**
  - `apps/web/src/lib/practicePrivacy.ts:13` links `/privacidad#tu-dietista`. When § 4's section
    is published with `id: 'tu-profesional'`, that anchor changes in the same commit.
  - Until then, the section the link opens still describes 004, so the `professional` switch
    stays off (go-live § 1 bis).


### 12.4 Phase 10's pages, and the days before the switch (2026-11-20)

Read in the worktree `agent/025-phase-10/frontend` (uncommitted): the `privacy` and `terms` blocks
of both dictionaries, `legalDates.ts` and `LegalScreen.tsx`.

**P0 — two Spanish sentences carry this note's instructions instead of the text.** § 4's P-2 table
put an instruction in the «es-ES nuevo» cell, and it was copied whole. The English is right. In
`es-ES.ts`, `privacy.sections` «Por qué podemos tratar estos datos»:

- **contract.** It reads «…tus pagos y los correos del servicio add to the «contrato» bullet, after
  «los correos del servicio»: `y, si abres una consulta, tu consulta y tu perfil`.». It must read:
  «Para darte el servicio que pides (contrato): tu cuenta, tu perfil, tus planes, tus
  conversaciones con el asistente, tus pagos y los correos del servicio y, si abres una consulta,
  tu consulta y tu perfil.»
- **legitimate interest.** It reads «…que te enviamos, add at the end of the list, before «Puedes
  oponerte escribiéndonos.»: `y comprobar, … colegio.` Puedes oponerte escribiéndonos.». It must
  read: «Por nuestro interés legítimo: registrar el uso del producto y los errores técnicos para
  que funcione, sin datos de salud, y proteger las cuentas: el registro de seguridad, los frenos
  contra el abuso y los avisos de seguridad que te enviamos, y comprobar, cuando alguien pide la
  insignia, que es quien dice ser en el registro de su colegio. Puedes oponerte escribiéndonos.»

These are the approved words in their place (P-8). The fault is this note's table layout: a cell
that holds an instruction is not a sentence. **Nothing else differs.**

**The pages read as one text**, with every other sentence still true. Two P3 notes, with no change
needed:

- «Nuestro proveedor de correo, para los correos de confirmación…, invitaciones, avisos…» does not
  list the badge codes and the statements of reasons. The provider is named, which is what art.
  13.1.e requires. The list of uses is illustrative.
- The terms' «NutrIA es para tu uso personal» sits beside a practice. The practice is governed by
  its own agreement (`textos/01`), accepted separately: the special contract governs the special
  use.

**«Última actualización».** `LEGAL_TEXTS_UPDATED` takes **the day the new pages are published**
(deployed to production). That is the day the words changed (art. 13.3 and the change clauses).
It is not the switch day, which P-0's line states, and not the day they were written. The policy
and the terms may share one value, because they are published together. If one ever changes
alone, split it.

**`textos/02` and `textos/03`.** They remain the sources they were. Their pointers say that P-1 to
P-8 and T-0 to T-2 of this note are what is served. Neither file is a copy of the live page,
and nothing in them has to change except the pointers, updated on 2026-11-20.

**The notice by the product (`06` § Z, amended 2026-11-20).**

- **(a) Unconfirmed addresses are skipped and counted. That meets "everybody was told", and no
  screen notice is owed.**
  - An account whose address nobody confirmed cannot sign in with its password
    (`requireEmailVerification`, `apps/api/src/modules/auth/auth.config.ts:336`). It holds nothing
    the change touches, and it is swept at 30 days (`0092`).
  - Mailing it would write to an address that may be a stranger's typo (art. 5.1.d and 5.1.f).
  - When its owner confirms and signs in, the pages they read are already the new ones.
  - That is information before any processing of their data under the change (art. 13.3).
  - TRLGDCU 85.3 is about modifying a contract against somebody using it, and an account that
    cannot sign in is not using it.
  - **A screen notice would be a courtesy, not a duty.** The audit row records the skipped
    count, and the LOG states it.
- **(b) The record of who was told**: record of processing row 11 bis, added today.
  - Basis: art. 6.1.f, read with art. 5.2. The interest is demonstrating that the promised notice
    was given, art. 7.1's logic applied to information.
  - Retention: with the account, deleted with it. The audit row keeps counts only.
  - No new sentence in `/privacidad`: it is part of «los correos del servicio».
- **(c)** `06` § Z describes the template `TermsChangeNotice` and the console send.
- **(d) The lead.**
  - The notice's `{date}` is at least the day after the send.
  - **No longer lead is owed today.** The owner confirmed there is no practitioner in production,
    so P2B art. 3.2's 15 days binds nobody.
  - No consumer pays for anything: Premium has no checkout.
  - The changes reach a user only through acts they choose later: accepting an invitation, whose
    page carries the full list. The one exception is the health note 1.2.0, which is asked again
    (`health.consentStale`).
  - If a practitioner exists on the day of the send, their 15 days apply to the agreement 2.0.0,
    and the switch waits for them.


### 12.5 Three rulings on the rendered pages (2026-11-20)

1. **The dated line is decided at build time.** P-0 is amended. The owner redeploys the web on the
   day of the switch, and the go-live checklist says so. A line that lingers after a late deploy
   is stale, not false.
2. **Two «No vendemos» in a row** in «Con quién compartimos tus datos». The section's paragraph
   («No vendemos tus datos. No hay anuncios ni cookies publicitarias.») is drawn above the list,
   and P-6 ended «No vendemos ni cedemos tus datos a ningún otro profesional.»
   - **Not by moving paragraphs below lists.** Two sections of `/condiciones` use the paragraph as
     the list's lead-in: «Uso aceptable» ends «…alguna de estas cosas:», and «El plan gratuito y
     Premium» is the same. A component-wide move would break them.
   - **P-6's last sentence is reworded** to the same meaning:
     - es: «Ningún otro profesional recibe nada tuyo.»
     - en: "No other professional receives anything of yours."
   - **Approved by the owner on 2026-11-20** («Aprobadas»).
3. **English P-2 "and to check" → "and checking"**, matching the gerunds before it. It is a
   grammar correction with the same meaning, the Spanish is untouched, and it needs **no tap**.
   Recorded here.

**The phase 10 grep's dispositions are as § 7 says.** Every remaining hit in both dictionaries is
one of three kinds:

- an approved badge, consent or agreement text;
- the badge form's own words, read only by the applicant;
- a sentence about the profession in general: the assistant's declines, the footer disclaimer,
  the landing FAQ, the policy and terms intros, and the profile's supervision notice.

Nothing is left to replace on the client's or the practitioner's screens. The console's strings
were phase 9's.


### 12.6 The owner's answers of 2026-11-20 (tapped options, relayed by the lead)

1. **Approved** («Aprobadas»): the two dated lines P-0 and T-0, and P-6's reworded last sentence
   («Ningún otro profesional recibe nada tuyo.» / "No other professional receives anything of
   yours.").
2. **The switch day is Friday 27 November 2026.** It is three things at once: § Z's `{date}`,
   `PRACTICES_OPEN_ON` on the pages, and the day of his iPhone test. The notice of `06` § Z
   goes **on or before 26 November**, which keeps "at least the day after the send" (§ 12.4 d).
3. **Confirmed: the address the product mails from (`EMAIL_FROM`) is the same mailbox the legal
   pages name as the contact (`{email}`).** So a reply to the badge code, to a statement of
   reasons or to the notice reaches the contact point that DSA arts. 11–12 and RGPD 13.1.a name.
   The "responde a este correo" routes in `06` §§ R, V, W, W bis and X are true.
4. **§ Z is sent from the console**, with the template `TermsChangeNotice` and the per-account
   record `account_notices` (record of processing row 11 bis), as amended on 2026-11-20.
5. **The first-look queue keeps «Publicar» / «No publicar»** in the owner's console. He knows
   that «Publicar» only marks a profile seen until a public profile exists.
   - Legally sound **because they are the owner's own buttons**: no practitioner or client
     reads them.
   - What the practitioner reads stays «Revisado» and the statements of § X (LCD art. 21.1.c:
     nothing presents the look as an approval).
   - The day project 4 or 6 makes «Publicar» actually publish, the button's meaning changes. The
     practitioner's words («Revisado», `profileReviewNote`) are re-read then.

`LEGAL_TEXTS_UPDATED` = **2026-11-20**, the day of publication, and it moves with the deploy if
that slips a day (§ 12.4).

---

## Sources (read 2026-11-18)

- **GDPR** (Reg. 2016/679), the BOE copy DOUE-L-2016-80807: arts. 6.1, 9.2.a, 13, **14.1–14.3**
  and **22.1–22.4** read verbatim for this note; the rest as cited in [`README.md`](./README.md).
- **DSA** (Reg. 2022/2065), the BOE copy DOUE-L-2022-81573: **art. 17.1–17.4** read verbatim
  (what a statement of reasons contains, letters a–f); arts. 6, 12, 14, 16 as in the 2026-11-18
  read.
- **P2B** (Reg. 2019/1150), DOUE L 186, 11.7.2019, pp. 57–79, the PDF on `boe.es`: **arts. 3.1–3.5
  and 4.1–4.5** read verbatim.
- **Ley 44/2003**, BOE-A-2003-21340, consolidated to 05/06/2021: **arts. 2.2.a–b** and **5.1.c**
  read verbatim (F7).
- **AEPD**, *Listas de tipos de tratamientos de datos que requieren evaluación de impacto relativa
  a protección de datos (art. 35.4)*: criteria 1, 2, 4, 8 and 11 read verbatim for the DPIA
  addendum.
- Everything else is as cited and dated in
  [`2026-11-18-professionals-marketplace.md`](./2026-11-18-professionals-marketplace.md) § Sources.
  That includes Ley 2/1974, CP art. 403, TRLGDCU, LCD and the colleges' registers. The CGCODN
  code of ethics was still unavailable (password-protected), so its articles stay unverified.

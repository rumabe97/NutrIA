# D5 — Should the record store versioned acceptance of `/privacidad` and `/condiciones`? (2026-09-29)

> **I am not a lawyer.** This was written by an agent, not by a lawyer. Every conclusion cites
> the article and the consolidated version it rests on so that the owner — or the lawyer he
> shows it to — can check it. Anything that depends on an interpretation is marked **[lawyer]**
> and gathered in § 7.
>
> **Purpose**: to answer project 008's decision D5
> ([PRD](../projects/008-console-watches-quality-and-spend/PRD.md),
> [PLAN](../projects/008-console-watches-quality-and-spend/PLAN.md) phase 3 step 7 and phase 7;
> [`0071`](../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md)
> "Consequences").
> **Audience**: the lead (who amends phase 7 with § 5), `backend`, `frontend`, `tests`, the
> owner and the lawyer. **Committed**: yes — the repository is public: there are no names,
> addresses or tax numbers here; the texts use `legalIdentity.ts`'s placeholders.
> **Maintained by**: the `legal` agent. **Cut-off date**: 2026-09-29, commit read `a8b6a96`.

## 0. Verdict

**Phase 7 goes ahead, for the terms of use only.**

- **The privacy policy: no "acceptance" is recorded.** The policy informs (GDPR art. 13); it
  is not accepted. Recording its "acceptance" would describe the legal basis wrongly and the
  console would count it as a consent that does not exist (§ 2).
- **The terms of use: no rule in force requires acceptance to be stored account by account.**
  The only provision that required it was repealed in 2014 (§ 3.1). But it **is worth doing**,
  and the risk of not doing it is concrete: the burden of proving the terms were incorporated
  into the contract falls on NutrIA, and since 21 September there have been three different
  texts, so the sign-up date no longer says which one each person saw (§ 3.2).
- **What is stored**:
  - which version of `/condiciones` and when;
  - in two nullable columns on `user` (`termsVersion` and `termsAcceptedAt`);
  - the server writes them when the account is created, through any route (email, Google,
    Apple), from the constant `TERMS_VERSION = '2.0.0'`;
  - Consents counts the accounts on the current version, on an earlier one and with no record.
- **How it is shown**: the notice has to be visible **before and beside** every control that
  creates an account. Today it is not, in Google's case (§ 4.1).
- **Two texts change in the same deployment**:
  - a new section of the terms about how the contract is made and what is archived
    (LSSI art. 27.1);
  - a sentence in the privacy policy naming the new datum (§ 6).
- The exact specification of phase 7 is in § 5.

## 1. What the product does today (read in the code)

- **Consents already stored with a version** (the console's four):
  - **The profile consent**: `profile_data_consents`
    (`packages/database/src/schemas/profile.schema.ts:215`), `PROFILE_CONSENT_VERSION`.
  - **Health data**: `health_data_consents` (`:200`), `HEALTH_CONSENT_VERSION = '1.1.0'`
    (`packages/core/src/entities/Health/Health.ts:47`), required with `z.literal` (`:97`).
  - **The link with the dietitian**: `care_links.consentVersion` and `consentedAt`
    (`care.schema.ts:79-80`), `CARE_CONSENT_VERSION`.
  - **The professional's agreement**: `professionals.agreementVersion` and
    `agreementAcceptedAt` (`professional.schema.ts:26-27`), `PROFESSIONAL_AGREEMENT_VERSION`
    (`packages/core/src/entities/Professional/Professional.ts:27`).
  - All four are a version and a date, on the person's row, and a different constant asks
    again.
- **What is stored of the terms at sign-up: nothing.**
  - The `user` table (`packages/database/src/schemas/auth.schema.ts:25-43`) has only
    `createdAt`.
  - Signing up by email (`apps/web/src/app/_shared/RegisterScreen.tsx:49`) sends a name, an
    email and a password.
  - Google and Apple create the account on the provider's callback.
  - Every route goes through `databaseHooks.user.create`
    (`apps/api/src/modules/auth/auth.config.ts:124-136`).
- **What the person sees.**
  - `LegalNotice` (`apps/web/src/components/LegalNotice/LegalNotice.tsx`) draws
    `auth.legalNotice`: "Al crear tu cuenta aceptas las {terms}. Cómo tratamos tus datos te lo
    explica la {privacy}." (`es-ES.ts:636`, `en-GB.ts:609`). It already distinguishes accepting
    from informing properly: it is the text of
    [`textos/03`](./textos/03-condiciones-uso.md) § A.
  - **Where it appears**:
    - on `/registro`, **below** the "Crear cuenta" button (`RegisterScreen.tsx:101`); the
      Google and Apple buttons are above, before the form (`:76`);
    - on `/acceder`, which also creates accounts with Google (`0058`), the same: the buttons
      at `SignInForm.tsx:98` and the notice at `:118`.
  - The age line (`auth.legalAge`) is only on `/registro` (`:106`).
- **The terms have changed three times in eight days** (`git log -G` over `terms` phrases in
  `es-ES.ts`):
  - #45 on 21/09;
  - #104 on 25/09 (among other things, the minimum age became 18);
  - #131 on 28/09 (the dish pictures).
  - The "Cambios en estas condiciones" section (`es-ES.ts:2201`) says an important change is
    notified by mail before it applies, and that continuing to use NutrIA amounts to accepting
    it.

## 2. The privacy policy is given; it is not accepted

1. **What the law requires.** The GDPR does not ask the data subject to accept the policy. It
   asks the controller to inform them:
   - "at the time when personal data are obtained" (art. 13.1);
   - and to be able to demonstrate compliance (art. 5.2, accountability).

   <!-- Fuente: RGPD arts. 5.2 y 13.1 (texto del DOUE en BOE, DOUE-L-2016-80807, consultado el 29/09/2026). -->
2. **Why the account's data depend on no consent.** The name, the email and the session are
   processed because they are necessary for the contract (art. 6.1.b), as the policy already
   says ("Por qué podemos tratar estos datos", es-ES.ts, the `privacy` section).
   - Health data have their own consents, versioned and separate.
   - Presenting the reading of the policy as an "acceptance" would mix two bases the GDPR keeps
     apart.
   - The EDPB says they cannot be "merged and blurred" (Guidelines 05/2020, § 26) and that
     accepting general terms as a block "cannot be regarded as a clear affirmative act" of
     consent (§ 81).
   - If anybody read that record as the person's consent, it would be presumed not to have been
     given freely: "where the performance of a contract… is dependent on the consent" (art. 7.4
     and recital 43; the Guidelines, § 13).
   - The LOPDGDD says it too: "The performance of the contract may not be made conditional on
     the data subject consenting to the processing of personal data for purposes unrelated
     to… the contractual relationship" (art. 6.3).

   <!-- Fuente: RGPD arts. 6.1.b, 7.2, 7.4 y considerandos 32 y 43; LOPDGDD art. 6.3 (BOE-A-2018-16673, consolidada a 27/12/2025); CEPD, Directrices 05/2020 sobre el consentimiento, versión 1.1 (13/05/2020), §§ 13, 26, 71 y 81. -->
3. **How it is proved that information was given, without writing anything per account.**
   - The link to `/privacidad` is at the very point where the account is created.
   - Each version's text, with its `privacy.updated` date, is in the repository's public
     history.
   - `user.createdAt` says when each account was created.

   With those three things it is demonstrated which policy was published when each person's
   data were collected (art. 5.2). The EDPB asks that the proof not generate "excessive amounts
   of additional processing" (Guidelines 05/2020, § 106). That idea, written for consent,
   applies here too.
4. **The consequence for the console.**
   - People › Consents must **not** show the privacy policy as a consent, nor have a "privacy
     acceptance" column.
   - If a figure is ever wanted, it will be "accounts created while the policy dated X was
     published". It is computed from `createdAt` and needs no field.

## 3. The terms of use: required, advisable or unnecessary

### 3.1 No rule in force requires acceptance to be stored

- **Law 7/1998, on general terms.**
  - **Art. 5.4** required, in electronic contracting, that "acceptance of each and every one of
    the clauses be recorded". It was **repealed** by Law 3/2014 (sole repealing provision, 2).
  - **RD 1906/1999**, which developed it, was **repealed on 29/03/2014** by the same law.
  - **What remains in force** are arts. 5.1, 5.3, 5.5 and 7:
    - the terms are incorporated if the adhering party accepts them;
    - the adhering party must have been expressly informed that they exist and have a copy;
    - clauses they could not "know in full at the time the contract was made" are excluded.
  - None of those articles requires a record.

  <!-- Fuente: Ley 7/1998, BOE-A-1998-8789, consolidada a 16/03/2019, arts. 5 (apdo. 4 derogado por la Ley 3/2014, BOE-A-2014-3329) y 7; RD 1906/1999, BOE-A-1999-24914, «Fecha de derogación: 29/03/2014». -->
- **LSSI.**
  - **Art. 23.1**: an electronic contract is valid "where consent and the other requirements
    concur".
  - **Art. 24.1**: it is proved "by the general rules".
  - **Art. 24.2**: an electronic medium is admitted as documentary evidence.
  - **Art. 27**: it requires information before contracting and that the terms be made
    available to the recipient so they can store them.
  - **Art. 28**: it requires confirming that the acceptance has been received.
  - None requires the provider to keep a per-person record.

  <!-- Fuente: LSSI-CE, BOE-A-2002-13758, consolidada a 23/01/2025, arts. 23, 24, 27 y 28. -->
- **TRLGDCU.**
  - **Art. 80.1.a-b**: non-negotiated clauses must be accessible and the consumer must be able
    to know them before contracting.
  - **Art. 63.1**: it requires giving a receipt with the general terms.
  - **Art. 98.7**: it requires confirming a distance contract on a durable medium.
  - All of that is giving information to the person, not storing their acceptance.

  <!-- Fuente: TRLGDCU, BOE-A-2007-20555, consolidado a 28/02/2026, arts. 63.1, 80.1 y 98.7. -->

**Conclusion: storing the acceptance is not required.**

### 3.2 But it is worth doing: the risk of not storing it

1. **The proof is NutrIA's.**
   - If a person denies that a clause binds them, it is NutrIA that has to prove they accepted
     it and could know it in full when contracting. If it does not, the clause was not
     incorporated (Law 7/1998 arts. 5.1 and 7.a).
   - For Premium, the law says it expressly for the pre-contractual information: "The burden of
     proof… shall fall on the trader" (TRLGDCU art. 97.8).

   <!-- Fuente: Ley 7/1998 arts. 5.1 y 7.a; TRLGDCU art. 97.8 (consolidado a 28/02/2026). -->
2. **The sign-up date is no longer enough.**
   - With a single text, "account created on day X" plus the repository's history said which
     terms each person saw.
   - With three texts in eight days, and more changes announced (Premium, withdrawal and the
     legal notice: `textos/03`, `textos/07`), that reconstruction is already an inference.
   - And it never answers the question that will matter: "did this person accept the new
     version?".
3. **Changing the terms needs to know who is on which version.**
   - The current clause says that continuing to use NutrIA amounts to accepting a change.
     Against a consumer, it is fragile:
     - a clause reserving unilateral modification to the trader with no "valid reasons specified
       in the contract" is unfair (TRLGDCU art. 85.3);
     - if the modification appreciably worsens the digital service, the consumer may terminate
       the contract within 30 days (art. 126 bis).
   - Storing the version is what later allows asking for acceptance again from anybody on an
     earlier one, as is already done with the four consents.
   - Phase 7 does not build that new asking; it leaves everything ready to do it. **[lawyer]**,
     § 7.

   <!-- Fuente: TRLGDCU arts. 85.3 y 126 bis (este, para contratos desde el 01/01/2022). -->
4. **It costs little.** Two nullable columns on a table that already exists (the PRD's criterion
   13 forbids new tables), a hook that already runs and one more count on a page phase 3 is
   already building. Cost: €0.
5. **It was already decided.** The analysis left it as P2-2 ("store `termsVersion` and the date
   at sign-up": [`analysis.md` § 9](./analysis.md#p2)), on the before-Stripe-*live* list
   ([`go-live-checklist.md` § 2](./go-live-checklist.md)).

**Conclusion: storing it is advisable, not required, and it is done now.** "Advisable" does not
mean "it does not matter". Without the record, against a consumer disputing a clause, the owner
has only an inference.

### 3.3 Is a free account a consumer contract?

- **The doubt**: the TRLGDCU's Book II covers digital services paid for with personal data,
  unless the data are used "exclusively" to provide the service (art. 59.4). NutrIA also records
  use of the product under legitimate interest (`0071`), so it is arguable whether the free
  account falls in.
- **The verdict does not depend on this**:
  - Law 7/1998 protects any adhering party;
  - the LSSI's Title IV applies to any electronic contract;
  - Premium is a consumer contract beyond argument.
- **[lawyer]**, § 7.

<!-- Fuente: TRLGDCU art. 59.4 (añadido por el RDL 7/2021, en vigor desde el 01/01/2022). -->

## 4. What is wrong today, whether or not anything is stored

### 4.1 Somebody signing up with Google may never see the notice — P1

- **The problem.**
  - On `/registro` the Google and Apple buttons (`RegisterScreen.tsx:76`) are above the form.
  - The terms notice is below the "Crear cuenta" button (`:101`).
  - On `/acceder`, the same (`SignInForm.tsx:98` and `:118`).
  - On a phone, whoever taps "Continuar con Google" creates the account without the notice ever
    having appeared on screen.
- **Why it matters.**
  - Law 7/1998 excludes from the contract the terms the adhering party "had no real opportunity
    to know" when contracting (art. 7.a).
  - The TRLGDCU requires "express reference" to them and that the consumer can know them before
    contracting (art. 80.1.a-b).
  - A notice that sits below the fold, away from the button being pressed, is exactly what a
    judge may hold did not give that opportunity.
- **The fix.** It is part of phase 7 (§ 5, point 5), because without it the stored version would
  say somebody accepted something that was not shown.
- **Age (P3).** The age line (`auth.legalAge`) is missing from `/acceder`, which also creates
  accounts with Google. The profile's age gate still protects, but the line should go with the
  notice.

<!-- Fuente: Ley 7/1998 art. 7.a; TRLGDCU art. 80.1.a-b; LSSI art. 27.4. -->

### 4.2 The terms do not say how the contract is made or whether it is archived — P2

- **What the law requires.** LSSI art. 27.1 requires informing, before contracting, of:
  - a) the steps;
  - b) "whether the provider will file the electronic document in which the contract is
    formalised and whether it will be accessible";
  - c) how to correct errors when entering the data;
  - d) the languages.
- **What the product does today.** The terms say nothing about this.
- **Why it goes with phase 7.** As soon as the version is stored, point b) has an answer and it
  has to be given.
- **The text**: § 6.A.

<!-- Fuente: LSSI art. 27.1 y 27.4. -->

### 4.3 The acceptance is not confirmed — P2, **[lawyer]**

- **What the law requires.** LSSI art. 28.1 requires confirming that the acceptance has been
  received, in one of these ways:
  - an acknowledgement by mail within 24 hours;
  - or a confirmation in the same medium, as soon as the process ends, that the recipient can
    file.
- **What the product does today.**
  - The verification mail (sign-up by email) does not mention the terms.
  - Whoever signs in with Google or Apple receives no mail.
- **The smallest fix.** A line in the verification mail:
  - "Al crear tu cuenta aceptaste las condiciones de uso del {fecha}: {enlace}".
  - For Google and Apple another channel would be needed.
- **It does not block phase 7**, unless the lawyer says otherwise (§ 7).

<!-- Fuente: LSSI art. 28.1 y 28.3. -->

### 4.4 "Continuing to use NutrIA means you accept it" — P2, **[lawyer]**

- **What the clause says** (`es-ES.ts:2201`, `en-GB.ts:2167`): changes are accepted by continuing
  to use the service. It is the weak point of § 3.2.3 (TRLGDCU arts. 85.3 and 126 bis).
- **A promise I cannot check.** The same section promises a mail before any important change
  applies.
  - There were changes on 25/09 (the minimum age from 16 to 18) and 28/09 (pictures).
  - This document cannot say whether those mails were sent. The owner knows.
  - If they were not, the clause promised something that was not done.
- **What phase 7 does.** It does not rewrite this clause. The stored version is what will make it
  possible to replace "continuing to use" with "accepting again" once the lawyer confirms it.

## 5. Phase 7: exactly what is built

This section is the one the plan's amendment copies.

1. **Document**: `/condiciones` only (the `terms` namespace). The privacy policy is not recorded
   (§ 2).
2. **Version**: `TERMS_VERSION = '2.0.0'` in `packages/core`, beside the other four constants
   (in `entities/User`, say, or wherever `backend` prefers).
   - "1.x" are the three texts of 21, 25 and 28 September, which were not recorded and are still
     in the repository's history.
   - "2.0.0" is the first recorded text: the one phase 7 publishes, with § 6.A's section.
   - That is what [`textos/03`](./textos/03-condiciones-uso.md) already proposed.
3. **Storage**:
   - `user.termsVersion text` and `user.termsAcceptedAt timestamptz`, both nullable. There is no
     new table.
   - They are declared in Better Auth's `additionalFields` with `input: false`, like
     `activatedAt` (`auth.config.ts:219-230`): no client can write them.
   - A migration adds the columns. **There is no backfill**: earlier accounts stay at `null`,
     which means "before the record", because writing a version for them would assert something
     that cannot be proved.
4. **When and who writes them**:
   - **Who**: the server, in the same `INSERT` that creates the account:
     `databaseHooks.user.create.before` (`auth.config.ts:124-136`), which returns the data with
     `termsVersion: TERMS_VERSION` and `termsAcceptedAt: now`.
   - **Routes**: it works for all of them (email, Google and Apple), because they all pass
     through that hook.
   - **The version does not travel from the browser**:
     - the web and the API deploy together and read the same constant from `core`, so what is
       stored is what is shown;
     - the accepted exception is a tab left open across a deployment that changed the text: that
       person saw the previous text and is left on the new version;
     - it is a rare case, of minutes, and it is accepted.
   - **The rule for raising it**: any change of meaning in `terms`, in `es-ES.ts` or in
     `en-GB.ts`, raises `TERMS_VERSION` and `terms.updated` **in the same commit**. A typo fix
     does not raise it.
5. **How it is shown at sign-up** (it fixes § 4.1):
   - **Where**: `LegalNotice` and `auth.legalAge` have to be visible **without scrolling, before
     or immediately beside** every control that can create an account. On `/registro` those are
     the Google and Apple buttons and "Crear cuenta"; on `/acceder`, the Google and Apple
     buttons.
   - **The recommended placement**: on both screens, just above `SocialSignIn`, which precedes
     both paths. `frontend` decides it with `apple-web-design`.
   - **The check**: `accessibility` verifies it with `/local-probe` at 320, 390 and 1280 px, in
     both themes.
   - **The text on `/registro`**: `auth.legalNotice`, unchanged.
   - **The text on `/acceder`**: a key of its own, `auth.legalNoticeSignIn` (§ 6.C), because
     there "Al crear tu cuenta" reads oddly and the person creating the account is the one
     signing in with a provider for the first time.
   - **No checkbox**:
     - the law does not require one for the terms (§ 3.1): a clear notice, with a link, beside
       the button being pressed is enough;
     - a checkbox for the terms would also be confused with the health consents, which do have
       one and must stay separate (GDPR art. 7.2).
6. **The console**:
   - **People › Consents** (phase 3 step 3):
     - a "Terms of use" row with the current version and the number of accounts on that version,
       on an earlier one and with "no record" (`null`);
     - numbers only (`0028`);
     - the privacy policy does not appear.
   - **Settings › System** (phase 3 step 4): `TERMS_VERSION` beside the other consent versions.
   - The admin e2e's exact key lists are extended in the same change.
7. **Texts in the same deployment**: § 6.A (the terms, with a new `terms.updated`) and § 6.B
   (privacy, with a new `privacy.updated`).
   - The policy change does not touch health: it does **not** raise `HEALTH_CONSENT_VERSION`.
   - The terms change is the one that publishes 2.0.0.
   - Given what the changes clause promises (§ 4.4), an **important** new section would require a
     mail. This one only informs about how contracting works and changes no right or obligation,
     so I take it as not important. **[lawyer]**, § 7.
8. **What happens when the account is deleted.**
   - Both columns disappear with the row, because they live on `user`.
   - After deletion no proof of the acceptance is left. For the free account it does not matter,
     and for Premium Stripe keeps its own trail of the payment.
   - If the proof has to be kept beyond deletion (GDPR art. 17.3.e), the lawyer says so (§ 7). If
     he says yes, the privacy policy changes, and it is not done quietly.
9. **Tests** (`tests`):
   - an account created by email and one created with Google (the e2e's provider stub) have
     `termsVersion = TERMS_VERSION` and a non-null `termsAcceptedAt`;
   - a sign-up `POST` with `termsVersion` in the body does not write it;
   - the Consents response has the exact list of keys;
   - no console response carries the version on a row with an address.
10. **What phase 7 does not do**:
    - ask again for acceptance from `null` accounts or those on an earlier version;
    - the LSSI art. 28 confirmation (§ 4.3);
    - rewrite the changes clause (§ 4.4);
    - the acceptance in Stripe's checkout (P2-6), which is another matter and stays on the
      Stripe *live* list.

## 6. The texts

### A. Terms of use — a new "Cómo se celebra este contrato" section

**Where it goes**: the `terms` namespace, `sections[]`, right after "Tu cuenta"
(`es-ES.ts:2131`, `en-GB.ts:2097`), with `id: 'contrato'`. Update `terms.updated`. It is what
`TERMS_VERSION = '2.0.0'` publishes.

**heading**: `Cómo se celebra este contrato` | `How this contract is made`

**list**:

| es-ES | en-GB |
| --- | --- |
| `Se celebra al crear tu cuenta: rellenas tu nombre, tu correo y una contraseña y pulsas «Crear cuenta», o entras por primera vez con Google o Apple. En los dos casos, el aviso que acompaña a esos botones te enlaza a estas condiciones.` | `It is made when you create your account: you fill in your name, email and a password and press "Create account", or you sign in with Google or Apple for the first time. Either way, the notice next to those buttons links to these terms.` |
| `Antes de pulsar puedes revisar y corregir lo que has escrito en cada campo, y si falta algo o no es válido te lo decimos antes de crear la cuenta.` | `Before you press, you can review and correct what you have typed in each field, and if something is missing or not valid we tell you before the account is created.` |
| `Guardamos qué versión de estas condiciones aceptaste y cuándo. Esta página muestra siempre la versión vigente, con su fecha, y puedes guardarla o imprimirla. Si quieres la versión que aceptaste, pídenosla en {email}.` | `We keep which version of these terms you accepted and when. This page always shows the current version, with its date, and you can save or print it. If you want the version you accepted, ask us at {email}.` |
| `Puedes contratar en español o en inglés.` | `You can contract in Spanish or English.` |

<!-- Fuente: LSSI art. 27.1.a (trámites), 27.1.c (corregir errores: RegisterScreen.tsx:40-44 valida la contraseña y el formulario muestra el error antes de crear nada), 27.1.b (archivo y acceso: las columnas del § 5.3; las versiones anteriores están en el historial del repositorio y el propietario puede enviarlas), 27.1.d (lenguas: es-ES y en-GB), 27.4 (almacenar y reproducir). Ley 7/1998 art. 5.1 (ejemplar). La frase «pídenosla» describe lo que el propietario puede hacer, no una función de la aplicación. Publicar solo con las columnas del § 5.3 en producción (antes, «Guardamos qué versión…» sería falso) y con el aviso ya colocado junto a los botones como pide el § 5.5 (antes, «el aviso que acompaña a esos botones» sería falso para Google y Apple). -->

> **A note for `frontend`**: the `/condiciones` page already draws `sections[]` with `list` ("Tu
> cuenta" uses it); no new component is needed.
>
> **One detail has to be checked**: the second sentence says the error is shown before the
> account is created. That is true for a short password (`RegisterScreen.tsx:40-44`) and for an
> email already in use (`:58`). If the form lets a malformed email through to the server, the
> sentence is still true, because the server rejects it before creating the account. If it does
> not reject it, tell me and I will change it.

### B. Privacy policy — the "Cuenta" line

**Where it goes**: the `privacy` namespace, the "Qué datos recogemos y para qué" section, the
first item of `list` (`es-ES.ts:1765`, `en-GB.ts:1724`). One sentence is added and
`privacy.updated` is updated. It changes no consent version.

| es-ES (replaces) | en-GB (replaces) |
| --- | --- |
| `Cuenta: tu nombre y tu correo y, si entras con Google o Apple, el nombre y el correo que ese servicio nos confirma, y qué versión de las condiciones de uso aceptaste al crearla y cuándo. Mientras tienes la sesión abierta guardamos la dirección IP y el navegador desde el que entraste, para poder cerrarla. Para que tengas una cuenta y solo tú entres en ella, y para poder demostrar qué condiciones aceptaste.` | `Account: your name and email and, if you sign in with Google or Apple, the name and email that service confirms to us, and which version of the terms of use you accepted when you created it and when. While you are signed in we keep the IP address and browser you signed in from, so we can end the session. So that you have an account and only you get into it, and so that we can show which terms you accepted.` |

<!-- Fuente: RGPD art. 13.1.c (fines) y 6.1.b (contrato; la prueba de su celebración es parte de él) — alternativa 6.1.f si el abogado la prefiere, § 7. Es la misma frase que textos/02 ya usa para el acuerdo del profesional («la versión del acuerdo que aceptaste»). Publicar en el mismo despliegue que las columnas. -->

> If [`textos/02`](./textos/02-politica-privacidad.md) replaces the whole policy before phase 7,
> this sentence is added there too. It is noted in its header.

### C. The notice on `/acceder`

**Where it goes**: `auth.legalNoticeSignIn` (a new key, in `es-ES.ts` and `en-GB.ts` together).
`LegalNotice` draws it in `SignInForm.tsx` instead of `auth.legalNotice`, with the same
placeholders. `auth.legalAge` is drawn next, as on `/registro`.

| es-ES | en-GB |
| --- | --- |
| `Si es la primera vez que entras con Google o Apple, se crea tu cuenta y aceptas las {terms}. Cómo tratamos tus datos te lo explica la {privacy}.` | `If this is the first time you sign in with Google or Apple, your account is created and you accept the {terms}. How we handle your data is explained in the {privacy}.` |

<!-- Fuente: Ley 7/1998 arts. 5.1 y 7.a; TRLGDCU art. 80.1.a; 0058 (Google y Apple crean la cuenta desde /acceder). Mientras Apple siga apagado, «o Apple» es verdad solo en el sentido de lo que el botón haría: si frontend prefiere, que la clave dependa de los proveedores activos como ya lo hace SocialSignIn; decisión suya. -->

## 7. To confirm with a lawyer (add to [`analysis.md` § 10](./analysis.md#10-confirm-with-a-lawyer))

1. **The free account and the TRLGDCU's Book II.** Does the free account fall under art. 59.4,
   given that use of the product is recorded under legitimate interest? (§ 3.3)
2. **LSSI art. 28 on a free account.** Does the acceptance have to be confirmed? Is a line in the
   verification mail enough, and what channel works for somebody signing in with Google or
   Apple? (§ 4.3)
3. **The changes clause.** Does "continuing to use = accepting" hold against consumers, or does
   acceptance have to be asked again from anybody on an earlier version, and with what notice?
   And what to do if the mails for the 25 and 28 September changes were not sent. (§ 4.4)
4. **§ 6.A's section.** Is it an "important" change requiring a mail under the clause itself?
   (§ 5.7)
5. **Proof after deletion.** Does the version and date of acceptance have to be kept when the
   account is deleted, and for how long? (GDPR art. 17.3.e) (§ 5.8)
6. **The legal basis for storing the version.** Is it art. 6.1.b or 6.1.f? (§ 6.B)

## 8. Outside D5, found while reading — P1 for `frontend` (through the lead)

- **The bug.**
  - `HealthPanel.tsx:46` pins `CONSENT_VERSION = '1.0.0'` and sends it on save (`:106`).
  - The API requires `z.literal(HEALTH_CONSENT_VERSION)` = `'1.1.0'`
    (`packages/core/src/entities/Health/Health.ts:47,97`, through `SetHealthDataDto`).
  - Since #106 (25/09), saving the health section of `/perfil` is rejected by validation.
- **What it means legally.** It is not processing with no basis: the server stores nothing
  without the current version. But a person cannot give the consent the policy offers them.
- **What the console will see.** Phase 3's Consents page will show zero health consents on the
  current version since that date.
- **The fix**: import `HEALTH_CONSENT_VERSION` from `core/entities/Health`, as
  `ProfileConsentInterstitial.tsx:13` does with its own.
- **A check still pending**: the text the checkbox draws must be 1.1.0's
  ([`textos/05`](./textos/05-consentimientos-cliente.md)). If it is not, the version rises with
  it too.

## Sources consulted (2026-09-29)

- **GDPR** — Regulation (EU) 2016/679, the OJEU text in the BOE (`DOUE-L-2016-80807`): arts.
  5.2, 6.1.b, 7.1-7.4 and 13.1; recitals 32 and 43.
- **LOPDGDD** — LO 3/2018, BOE-A-2018-16673, consolidated to 27/12/2025: art. 6.3.
- **EDPB** — Guidelines 05/2020 on consent, version 1.1 (13/05/2020): §§ 13, 26, 71, 81,
  104-107.
- **LSSI-CE** — Law 34/2002, BOE-A-2002-13758, consolidated to 23/01/2025: arts. 23, 24, 27 and
  28.
- **Law 7/1998** (general terms), BOE-A-1998-8789, consolidated to 16/03/2019: arts. 5 and 7.
- **Law 3/2014**, BOE-A-2014-3329: the sole repealing provision.
- **RD 1906/1999**, BOE-A-1999-24914: repealed on 29/03/2014.
- **TRLGDCU** — RDLeg. 1/2007, BOE-A-2007-20555, consolidated to 28/02/2026: arts. 59.4, 63.1,
  80.1, 85.3, 97.8, 98.7 and 126 bis.

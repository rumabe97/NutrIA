# Personal data breach procedure

> **Purpose**: what to do, in order, when something may have exposed, altered or lost NutrIA's
> personal data, written for **one person** (the owner, an individual, with no team) reading it
> at 3 in the morning. It covers arts. 33 and 34 GDPR, the AEPD's guide and form, and the
> LOPDGDD's infringements. **Audience**: the owner; the lead and the agents, for reference.
> **Committed**: yes — it holds no names, addresses, phone numbers or device names: what the
> owner has to fill in is marked **⟦…⟧** and is filled in **outside the repository** (see § 9).
> **Maintained by**: the `legal` agent; it is reviewed when a provider, a secret or a flag
> changes, and after every incident.
>
> **I am not a lawyer.** Every rule cites its source; anything open to interpretation is marked
> **[lawyer]**.
>
> The mail template in § 6 stays in Spanish: it is what a person is sent.

**Sources** (verified 2026-09-25):
- **GDPR**: arts. 4.12 (the definition of a personal data breach), 28.3.f (the processor assists with arts. 32 to 36), 33 and 34 — the OJEU text in the BOE, `DOUE-L-2016-80807`.
- **LOPDGDD** (LO 3/2018, BOE-A-2018-16673, consolidated to 27/12/2025): art. 73.q-s (serious infringements) and art. 74.m-ñ (minor ones).
- **AEPD**, *Guía para la notificación de brechas de datos personales*, the June 2021 version: the reference guide.
- **AEPD**, *Formulario de notificación de brechas de datos personales*: the PDF, and the same form on the electronic portal.
- **AEPD**, the *Asesora Brecha* and *Comunica-Brecha RGPD* tools.
- **The providers' documentation** in § 7.

---

## 0. The 3 a.m. card

1. **Breathe and note the time** you learned that personal data were affected: the **72 hours** run from that moment (weekends and public holidays included).
2. **Contain it** (§ 3): cut the access that is happening.
3. **Keep the evidence before deleting anything** (§ 4). Vercel's logs last **one hour** on the Hobby plan.
4. **Open the register entry** (§ 8) and write what you know, however little.
5. **Within 72 hours**: decide and, if it applies, **notify the AEPD** (§ 5); an incomplete initial notification counts.
6. **If the risk is high**, **tell the people affected** (§ 6) without undue delay.
7. **Sleep.** Everything else has a 30-day deadline.

<!-- Fuente: RGPD art. 33.1 («a más tardar 72 horas después de que haya tenido constancia»), 33.4 (información gradual), 33.5; AEPD guía, § «Plazos para notificar» (el plazo corre «incluyendo las horas trascurridas durante fines de semana y días festivos»; notificación inicial y modificación en 30 días). -->

---

## 1. What a breach is here

A breach is "a breach of security leading to the accidental or unlawful destruction, loss,
alteration, unauthorised disclosure of, or access to, personal data" (art. 4.12 GDPR). It
affects **confidentiality** (somebody saw what they should not), **integrity** (somebody
changed it) or **availability** (it was lost or cannot be used). There does not have to be an
attacker: a mistake of our own counts.

In NutrIA nearly everything is **health data** (allergies, weight, goal, conditions,
medication; see `analysis.md` § 1.2). That raises the risk of any breach.

| Situation | A breach? | What data | Starting point |
| --- | --- | --- | --- |
| **The database URL leaks** (`DATABASE_URL` or `DIRECT_DATABASE_URL` in a commit, a log, a screenshot or a chat) | **Yes**, even if nobody knows whether anybody got in: there was the possibility of unauthorised access to everything | Everything: accounts, health, plans | § 3, row A. Almost certainly: **notify** |
| **A professional reads a client after the link ended** (a `read` row appears in `care_access_log` dated after `care_links.endedAt`) | **Yes**: unauthorised access to health data through an access control failure | What the client's page returns (`analysis.md` § 1.4) | Row B. **Notify**; **tell** the client |
| **A mail to the wrong person**. For example, a professional mistypes an invitation's address. | Only if the mail carries another person's data. The invitation only names the professional and says nothing about the patient it was meant for (`CareInvitation.ts`, `0059`), so in principle it is **not** the patient's breach. **Record it anyway.** | The professional's name | Row C |
| **A check-in notice mail reaches another professional** (a code failure) | **Yes**: it reveals that that person is a dietitian's patient | The client's name and the care relationship | Row C. **Notify** |
| **Neon compromised** (Neon tells you, or you see it in their status) | **Yes** if it reached the data | Everything | Row D |
| **Vercel compromised** (environment variables or deployments) | **Yes**: the variables give access to the database | Everything | Row D + row A |
| **Sentry compromised** | Probably **not**: Sentry receives no bodies, users or headers (`apps/api/src/shared/observability/ErrorReporter.ts:45-110`). **Record it**, and check that no error carried data | Error stacks | Row D |
| **A laptop lost or stolen** with `docs/local`, database exports or open sessions | **Yes** if it held personal data (an export holds them all) and the disk was **not** encrypted; if it was encrypted with a strong key, the risk is unlikely: **record it** | Whatever was on it | Row E |
| **A device stolen with an open session** of the owner's (access to `/admin`) | Possible: `/admin` reads nobody's data (`0028`), but it grants professionals and switches flags | Whatever was done with it | Row E |
| **A user's device stolen** with their session | It is that person's problem, not a NutrIA breach, unless NutrIA failed. Help them: revoke their sessions. **Record it** if they tell you | Their own data and the offline copy of their plan | Row E |
| **An AI key leaked** (`OPENROUTER_API_KEY`, and the old `OMNIROUTE_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`) | Normally **not** a personal data breach: the prompt carries no identifiers and no health (`PoolPrompt.ts`, version 4.1.0) and, with prompt logging off, OpenRouter stores no content the key would let anybody read (only metadata on its activity page). It is a cost risk, bounded by the key's cap. **Record it** | — | Row F |
| **An AI request answered by a company outside the allowed list** (visible in `/admin`) | Not a breach if the request identifies nobody, but the policy would be saying something false: back to `AI_PROVIDER=stub`, fix the list on the OpenRouter account and **record it** | The request (with no identifiers) | Row F |
| **Deletion or corruption** of data through a failure or a migration | **Yes** (availability or integrity), even if it is restored; if it is restored quickly and nobody else saw it, the risk is usually unlikely | Whatever was affected | Row G |
| **A professional shares outside NutrIA what they saw** (screenshots, messages) | **The professional's breach**; they are an independent controller (§ 10); NutrIA acts to cut the access and records it | Whatever was shared | § 10 |

<!-- Fuente: RGPD art. 4.12; AEPD guía, § sobre tipos de brecha (confidencialidad, integridad, disponibilidad) y formulario § 6 («Datos personales enviados por error», «Dispositivo perdido o robado», «Ciberincidente: acceso no autorizado a datos en sistema TI»). -->

---

## 2. Before it happens: what has to be ready

All of this is done once and filled in **outside the repository** (§ 9):

- ⟦How you get into the AEPD's electronic portal: DNIe, an FNMT individual certificate or Cl@ve permanente, and on which device⟧. Try it before you need it.
- ⟦The email address of the Vercel, Neon, Stripe, Sentry, Google and OpenRouter accounts⟧: that is where providers warn about their breaches. It has to reach your phone.
- ⟦Where you keep the incident register and how you back it up⟧ (§ 8).
- ⟦Devices with admin access⟧: laptop, phone; is the disk encrypted? is there a passcode lock?
- ⟦Where the OmniRoute gateway is hosted and how to get in⟧.
- The manual database exports, encrypted and deleted at 30 days (P1-6). If they are not, a lost laptop is a breach for every user.

---

## 3. The first hour — containing it

Do only what stops the harm. Note every step with its time in the register (§ 8).

**Always first**: keep what expires (§ 4, steps 1 and 2) **before** revoking sessions or
rotating secrets, because deleting sessions also deletes who was connected.

### Row A — a leaked secret (or Vercel compromised)

1. Work out **which** secret. They all live in Vercel's `nutria-api` project (Settings →
   Environment Variables). The ones that give access to personal data, in order:
   - `DATABASE_URL`, `DIRECT_DATABASE_URL`: in Neon, Console → the project → **Roles** → *Reset password* on the application's role. Put the new string in Vercel (**Production**) and redeploy. Until you redeploy, the API is down: that is acceptable.
   - `BETTER_AUTH_SECRET`: generate a new one (32 random bytes), put it in Vercel and redeploy. **Effects**: every session is closed, pending activation links stop working and the OAuth tokens stored encrypted (`encryptOAuthTokens`) cannot be decrypted. None of that is used to serve the product: it is acceptable.
   - `SMTP_PASS`: revoke the app password in the Google account and create another.
   - `STRIPE_SECRET_KEY`: in Stripe, Developers → API keys → *Roll key*. `STRIPE_WEBHOOK_SECRET`: on the webhook endpoint, *Roll secret*.
   - `GOOGLE_OAUTH_CLIENT_SECRET`, `APPLE_OAUTH_PRIVATE_KEY`: rotate them in the Google Cloud console and in Apple Developer.
   - `CRON_SECRET`, `VAPID_PRIVATE_KEY`: rotate the first; the second only if it leaked, because rotating it leaves every subscribed phone without notifications.
   - The AI keys: `OPENROUTER_API_KEY` at openrouter.ai → *Keys* (delete it and create another with the same *guardrail*: two models, ZDR, a cap); the old ones (`OMNIROUTE_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`) and the gateway's management key, if they exist, in their panel.
2. If the secret was in a **commit** in the public repository, rotating it is the only thing
   that helps: rewriting history does not remove it from the copies that already exist.
3. If **Vercel** was the thing compromised: rotate **every** secret on the list, review the
   last few days' deployments and team members in Vercel, and change the account's password
   and second factor.

### Row B — a professional sees what they should not

1. **Switch the `professional` flag off** in `/admin`. `/consulta` closes for everybody on the
   next request; the clients keep their accounts (`0059`, `0061`).
2. If it is one professional, **withdraw their grant** in `/admin` (Withdraw) instead of
   switching everything off.
3. Do not switch it back on until the failure is fixed and tested.

### Row C — a mail to the wrong person

1. If it is a code failure that repeats (check-in notices, invitations), **switch off what
   sends them**: the `professional` flag closes the practice and its notices, and
   `checkInReminders` the reminders.
2. Write to whoever received it asking them to delete it and confirm in writing. With that
   confirmation, the risk can become unlikely (§ 5).

### Row D — a provider compromised (Neon, Vercel, Sentry)

1. Read their notice: what data, what dates, what they ask you to do. Follow their steps.
2. Rotate that provider's secrets (row A).
3. If it was **Neon** and there is any doubt about the data's integrity, create a branch from a
   point in time before the incident (Console → Branches → *Create branch* → *From a point in
   time*; `docs/reference/deployment.md` § 8). It overwrites nothing, so it serves as evidence
   and as a restore plan.

### Row E — a device lost or stolen

1. **Your device**:
   - change the Vercel, Neon, Stripe, Google and GitHub passwords;
   - sign out of those services from another machine;
   - revoke your NutrIA session: delete your rows from `session`, after keeping them (§ 4).
   - If the device held exports or `docs/local` and the disk was not encrypted, treat it as **row A** as well: rotate the secrets.
2. **A user's device**:
   - delete their `session` rows: it disconnects them on the next request, because the session
     is re-read on every request (`docs/ARCHITECTURE.md` § Invariants);
   - tell them to change their password;
   - the offline copy of the plan is deleted when they sign out in that browser (`0053`).
3. **Deleting sessions** is a write in production: you do it yourself, by hand, in Neon (the
   SQL Editor). For one person: `delete from session where "userId" = ⟦id⟧;`. For everybody,
   faster: rotate `BETTER_AUTH_SECRET` (row A).

### Row F — a leaked AI key

1. Rotate the key (row A).
2. Check the spend in the provider's panel.
3. Record the incident. There is usually nothing else: it is not a personal data breach.

### Row G — data deleted or corrupted

1. **For the writes**: pause the API from Vercel (Settings → *Pause project*) or deploy the
   previous version.
2. Restore from a Neon branch at an earlier point in time (row D, step 3).
3. Check with the row counts that everything came back.

<!-- Fuente: nombres de variables, apps/api/src/config/Env.validation.ts y ErrorReporter.ts (allSecrets); flags, packages/core/src/domain/Flag/Flag.ts:15 (automaticActivation, checkInReminders, premium, professional); sesión, apps/api/src/modules/auth/auth.config.ts (encryptOAuthTokens, SESSION_MAX_AGE_DAYS), BETTER_AUTH_SECRET también firma los enlaces de activación (selfService.link.secret); ProfessionalGuard relee la concesión y el interruptor en cada petición. RGPD art. 32 y 33.3.d (medidas). -->

---

## 4. The first hour — keeping the evidence

Keep the evidence in the incident's folder, outside the repository (§ 9). They go in this order
**because they expire in this order**:

1. **Vercel's logs** — the `nutria-api` and web projects → *Logs*. On the Hobby plan Vercel
   keeps **only one hour** of logs. Filter by the interval, the route (for instance
   `/api/v1/care/*`) and the status code, and copy or export what comes out. Note the
   `requestId`s. The logs carry no health data: pino redacts them.
2. **Sessions**, before deleting them. In Neon, the SQL Editor, read-only:
   `select id, "userId", "ipAddress", "userAgent", "createdAt", "expiresAt" from session where …;`.
   Keep the result.
3. **The professional's trail**, if the incident is about the practice. Read-only:
   `select * from care_access_log where "professionalId" = ⟦id⟧ and "createdAt" >= ⟦from⟧ order by "createdAt";`.
   Cross-reference it with
   `select id, status, "endedAt", "endedBy" from care_links where "professionalId" = ⟦id⟧;`.
   A `read` or `write` row dated after `endedAt` is the evidence. The trail does not store
   which exact data were read: `kind` says what type they were.
4. **Neon**: if there may be alteration, create a branch at an earlier point in time (§ 3, row
   D) as a snapshot. Review the project's *Operations* and *Roles*.
5. **Sentry**, if it is on: the *issues* in the interval.
6. **Stripe**, if payments are affected: Developers → *Logs* and *Events*.
7. **The mail sent**, if it was a mail: the copy in the SMTP account's sent folder.
8. **GitHub**, if it was a secret in a commit: the link to the commit and when it was
   published.

Do not touch or delete anything that is not needed to contain it. Note who, what and when for
each of your own actions.

<!-- Fuente: Vercel, documentación «Runtime Logs» (actualizada 28/08/2026): «Hobby — 1 hour of logs; Pro — 1 day of logs»; care_access_log y care_links (packages/database/src/schemas/care.schema.ts); RGPD art. 33.5 (documentar los hechos). -->

---

## 5. The 72 hours — deciding and notifying the AEPD

### 5.1 The risk test, in three questions

1. **Were personal data affected?** If none were (an AI key, say), **there is no breach**.
   Record it as an incident and stop.
2. **Is it *unlikely* that there is a risk to people?** Only if one of these holds:
   - the data were **unintelligible** to whoever held them (encrypted with a key that did not
     leak);
   - whoever received them is **trusted**, has **deleted** them and has **confirmed it in
     writing**, and did not use them;
   - they were **recovered** at once with nobody seeing them (availability only).

   If you cannot assert any of those with evidence, **there is a risk**: with health data,
   nearly always. → **Notify the AEPD.**
3. **Is a *high* risk likely?** With health data seen by somebody unauthorised who is not
   trusted, or by an indeterminate number of people: **yes**. → On top of that, **tell the
   people affected** (§ 6).

When in doubt, the AEPD's tools **Asesora Brecha** (do I notify?) and **Comunica-Brecha RGPD**
(do I tell the people affected?) walk through the same questions. Keep their result in the
register.

<!-- Fuente: RGPD art. 33.1 («a menos que sea improbable que dicha violación de la seguridad constituya un riesgo»), 34.1 («alto riesgo»), 34.3.a-b (cifrado; medidas ulteriores); AEPD guía, apartado de evaluación del riesgo (el riesgo se mide para las personas, no para la organización), y sus herramientas. Formulario AEPD § 6: «pérdida de confidencialidad de datos afectados por secreto profesional» es una consecuencia listada. -->

### 5.2 How to notify

- **Where**: the AEPD's electronic portal (`sedeagpd.gob.es`), the personal data breach
  notification procedure. You get in with a **recognised electronic certificate** (DNIe or an
  FNMT individual certificate) or **Cl@ve permanente**.
- **As an individual**, the owner is not obliged to deal with the authority electronically
  (Law 39/2015, art. 14.1). So he can also use the AEPD's **PDF form** through the registry,
  but the portal is faster and leaves an immediate record.
- **In stages**: if at 72 hours you do not know everything, send an **initial** notification
  with what you have and your estimates. Complete it with a **modification**, giving the
  initial one's registration number, **within 30 days** (working days, per the guide). As a
  general rule only one modification is accepted.
- **If you are late**: notify anyway, explaining the reason for the delay (art. 33.1).

**What the form asks** (its 15 sections). Have it to hand:

| § | Question | What you put for NutrIA |
| --- | --- | --- |
| 1 | The controller | your name, tax number, address, phone, email; "self-employed or micro-enterprise"; sector ⟦whichever on the list applies: health / information society services⟧ |
| 2 | The processor involved | the provider, if it was theirs (Neon, Vercel…) |
| 3 | DPO or contact | there is no DPO; you as the contact |
| 4 | Type | new or a modification (with the previous one's registration number) |
| 5 | The processing | since when (less than 1 year / 1 to 5); the approximate number of people in the processing; the scope (Spain nationally, or more Member States if there are users from outside) |
| 6 | The breach | accidental or deliberate, internal or external, how it happened; confidentiality, integrity or availability; were the data unintelligible?; consequences and severity |
| 7 | Types of data | **health**; identifying; contact; where applicable, beliefs |
| 8 | The profile of those affected | users / patients; possible minors: no, because of the 18 age gate |
| 9 | Cross-border | whether there are people affected in other Member States |
| 10 | Dates | start, detection, containment |
| 11 | Measures beforehand | those of `dpia.md` § 4 that were in place; was there a risk analysis? yes: the DPIA |
| 12 | Actions after the incident | what was done in §§ 3-4; whether it was reported to the police |
| 13 | Communication to those affected | yes / no / it will be done; date, number, means |
| 14 | Documentation | attachments |
| 15 | Complete or in stages | as said above |

<!-- Fuente: AEPD guía, § «Cómo se debe notificar» (certificado reconocido o Cl@ve permanente; el PDF para quien no esté obligado a relacionarse electrónicamente, nota 24) y § «Carácter de la notificación» (nueva completa o inicial; modificación en 30 días con el número de registro; «de forma general, está prevista una única modificación»); formulario AEPD, apartados 1 a 15. -->

### 5.3 What happens if it is not done

Not notifying a breach that had to be notified is a **serious** infringement (LOPDGDD art.
73.r). Not telling those affected when the AEPD has required it is also serious (art. 73.s).
Notifying incompletely, late or badly (art. 74.m) and not documenting it (art. 74.n) are
**minor** infringements. Notifying on time, even incompletely, is always better than waiting
to have everything.

---

## 6. Telling the people affected (art. 34)

**When**: if the risk is **high** (§ 5.1, question 3), **without undue delay**. It is not
needed if one of these conditions holds:
- the data were encrypted such that nobody unauthorised can read them;
- you have already taken measures that remove the high risk;
- telling people one by one would be a disproportionate effort. In that case, publish an
  equally effective public notice (for example, a notice on the website and on `/inicio`).

**What it must say**, in plain language: what happened; a contact; the likely consequences;
what you have done and what the person can do.

**How**: one mail to each person, from the usual address, **without** putting everybody in
copy (a mail to several recipients with no blind copy is itself a breach). Use the account's
language (`profiles.locale`).

### Template (Spanish)

**Asunto**: Un problema de seguridad que afecta a tus datos en NutrIA

> Hola, {nombre}:
>
> Te escribimos para contarte un problema de seguridad que afecta a tus datos en NutrIA.
>
> **Qué ha pasado.** El {fecha}, {descripción en una o dos frases: por ejemplo, «un fallo
> permitió que un dietista que ya no estaba vinculado contigo viera tu plan y tu peso
> durante unas horas», o «una clave de acceso a nuestra base de datos quedó expuesta»}. Lo
> supimos el {fecha de detección} y lo cortamos el {fecha de contención}.
>
> **Qué datos tuyos.** {Lista concreta: tu nombre, tus objetivos, tu peso a lo largo del
> tiempo, tus alergias… Solo lo que de verdad esté afectado.}
>
> **Qué puede suponer para ti.** {Consecuencia probable en términos sencillos: que una
> persona ajena conozca esos datos de salud; que recibas correos de suplantación…}
>
> **Qué hemos hecho.** {Medidas: cerramos el acceso, cambiamos las claves, corregimos el
> fallo, lo hemos notificado a la Agencia Española de Protección de Datos.}
>
> **Qué puedes hacer tú.** {Consejos concretos: cambia tu contraseña si la usas en otro
> sitio; desconfía de correos que digan venir de NutrIA y te pidan datos; no hace falta que
> hagas nada más.}
>
> Si tienes cualquier duda, responde a este correo o escríbenos a {email}. También
> puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).
>
> Sentimos lo ocurrido.
>
> {name}, NutrIA

For accounts in English, translate with the same order of sections.

<!-- Fuente: RGPD art. 34.1 («sin dilación indebida»), 34.2 («en un lenguaje claro y sencillo… como mínimo la información y las medidas a que se refiere el artículo 33, apartado 3, letras b), c) y d)»), 34.3.a-c (excepciones; comunicación pública), 34.4 (la AEPD puede exigirla); formulario AEPD § 6 («envío de email a múltiples destinatarios sin copia oculta» como tipo de brecha) y § 13 (fecha, número y medio). {name} y {email} son los marcadores de legalIdentity.ts. -->

---

## 7. The processors and what they owe NutrIA

Every processor must tell NutrIA **without undue delay** about the breaches it knows of
(art. 33.2) and assist it in meeting arts. 32 to 36 (art. 28.3.f). The AEPD recommends that
period not pass 72 hours. Their notice does **not** replace your notification: assessing the
risk and notifying the AEPD are yours.

| Provider | What it processes | Where its commitment is | How it warns | Service status |
| --- | --- | --- | --- | --- |
| **Vercel** | The API and the web; the environment variables with every secret | The DPA, `vercel.com/legal/dpa`, § 8.c: it warns "without undue delay" after confirming an incident | To the account's address ⟦the Vercel account⟧ | `vercel-status.com` |
| **Neon** | The database | The DPA, `neon.com/dpa` ⟦check the period and the channel in its incident clause⟧ | To the account's address ⟦the Neon account⟧ | `status.neon.tech` |
| **Stripe** | Payments | The DPA, `stripe.com/legal/dpa` ⟦check⟧; with *Managed Payments*, Link is also the controller of its own sale | To the account's address ⟦the Stripe account⟧ | the Stripe dashboard |
| **The mail provider (Google, SMTP)** | Every mail | A consumer Gmail account has **no** DPA (P2-10); Google Workspace does, `workspace.google.com/terms/dpa_terms.html` | ⟦the Google account⟧ | — |
| **Sentry** (if on) | Errors with no personal data | The DPA, `sentry.io/legal/dpa/` ⟦check⟧ | ⟦the Sentry account⟧ | `status.sentry.io` |
| **OpenRouter** (after `0064`) | Prompts with no identifiers; each call's metadata | The DPA its terms § 10.2 incorporate ⟦check the period and the channel in the text obtained (P1-11)⟧; the Enterprise DPA (§ 7) says "without undue delay, and in any case, within seventy-two (72) hours" | ⟦the OpenRouter account⟧ | `status.openrouter.ai` |
| **Whoever runs the model** (DeepInfra, CoreWeave) | The request, with no identifiers, only while it answers (zero retention) | No contract with NutrIA: its commitment is to OpenRouter (`analysis.md` § 4.4 b); you would find out through OpenRouter or through the press | — | — |
| **The OmniRoute gateway** | Experiments only since `0064` | You host it ⟦where it is hosted⟧ | — | — |

<!-- Fuente: RGPD arts. 33.2 y 28.3.f; AEPD guía, § «Plazos para notificar» («no debería ser superior a las 72 horas»); Vercel DPA § 8.c, consultado el 2026-09-25 («upon becoming aware of a confirmed Security Incident, Vercel will notify Customer without undue delay»; y «Customer is solely responsible for complying with Security Incident notification laws applicable to Customer»). Las demás cláusulas no se pudieron leer sin JavaScript: ⟦comprobar⟧. -->

---

## 8. The incident register (art. 33.5)

**Every** breach is documented, **including the ones that are not notified**: the facts, their
effects and the measures taken. The register is what the AEPD asks for to check that you
decided well. Also note the incidents that turned out not to be breaches, with the reason.

**Where**: ⟦outside the public repository — for instance `docs/local/brechas/`, which is not
published, with an encrypted copy elsewhere, because `docs/local` has no backup⟧. An incident
register in a public repository is a map for an attacker. **Never** put health data or the
names of those affected in it: count people, do not name them.

### A template for one entry

| Field | Value |
| --- | --- |
| Number | ⟦YYYY-NN⟧ |
| Detected (date and time) | when you became aware; the 72 h run from here |
| Happened (from–to) | |
| How it was detected | a provider's notice, a user, our own review… |
| What happened | two or three sentences |
| Type | confidentiality / integrity / availability |
| Data affected | categories (health, contact…) and the approximate number of records |
| People affected | approximate number; professionals?; minors? |
| Origin | internal / a processor (which) / external; accidental / deliberate / unknown |
| Containment (§ 3) | each action with its time |
| Evidence (§ 4) | what was kept and where |
| The risk assessment (§ 5.1) | unlikely / a risk / a high risk, **and why**; the result of Asesora Brecha / Comunica-Brecha |
| AEPD notification | no (reason) / initial (date, registration number) / modification (date) |
| Communication to those affected | no (reason, art. 34.3) / yes (date, number, means) |
| Professionals informed (§ 10) | |
| Reported to the police | yes / no |
| The cause and the measures so that it does not happen again | |
| Closed (date) | |

### A summary (one row per incident)

| No. | Detected | Type | People | Risk | AEPD | Those affected | Closed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

<!-- Fuente: RGPD art. 33.5 («documentará cualquier violación de la seguridad de los datos personales, incluidos los hechos relacionados con ella, sus efectos y las medidas correctivas adoptadas»); LOPDGDD art. 74.n (no documentarla es infracción leve); formulario AEPD § 12 («¿ha actualizado el registro de incidentes…?»). -->

---

## 9. What the owner fills in, once, outside the repository

Every ⟦…⟧ in this document, in a private note beside the register:
1. access to the AEPD's portal and on which device;
2. the accounts of each provider through which their notices arrive;
3. the devices with admin access and whether they are encrypted;
4. where the gateway is (experiments only) and the OpenRouter account's address;
5. where the register lives and its copy.

When that is done, the owner **signs and dates** it in that note, and the box in
`go-live-checklist.md` § 1 is ticked.

---

## 10. The professionals

- **A NutrIA breach that touches a professional's patients** (the database, say, or a failure
  that lets a professional see another patient):
  - the notification to the AEPD and telling the patients are **NutrIA's**, which is the
    controller of those data (`analysis.md` § 2);
  - the professional is **not** NutrIA's processor and NutrIA is not theirs, so art. 33.2 does
    not require telling them;
  - **tell them anyway**, because:
    - what they saw may be in their clinical record;
    - their professional confidentiality is at stake;
    - the agreement they accepted promises cooperation on a breach (`textos/01`, cl. 8);
    - if the failure showed them a patient's data that was not theirs, they have to delete it
      from wherever they copied it.

    Tell only the professionals affected, with no data of patients who are not theirs.
- **A professional's breach**: screenshots shared, their laptop stolen with client pages, their
  account used by somebody else.
  - They are an independent controller of what they hold outside NutrIA: **notifying the AEPD
    and their patients is theirs** (arts. 33 and 34; the agreement, cl. 8).
  - The agreement requires them to tell NutrIA **within 24 hours**. NutrIA then:
    - cuts their access (withdraw the grant);
    - keeps the trail of their accesses (§ 4, step 3);
    - assesses whether there was also a breach at NutrIA. For instance, if they got in with
      **their NutrIA account**, whoever saw data hosted at NutrIA without permission was a
      third party: that is a NutrIA breach, and NutrIA assesses and notifies it on its own.
  - In every case, **it is recorded** (§ 8).

<!-- Fuente: RGPD arts. 33.1-2 (deber de cada responsable; el del encargado hacia su responsable), 34; análisis de roles, docs/legal/analysis.md § 2 (responsables independientes); acuerdo del profesional, docs/legal/textos/01, cláusula 8 («escríbenos… en todo caso en 24 horas… si la brecha es tuya, fuera de NutrIA, esa obligación es tuya»); Código Deontológico CGCODN (22/12/2021), arts. 22 y 29. [abogado]: si se apreciara corresponsabilidad, el reparto de la cl. 4 del acuerdo asigna a NutrIA el contacto con los pacientes, lo que es coherente con este apartado. -->

# The mail to the owner: a daily digest and two alerts (2026-09-29)

> **I am not a lawyer.** This was written by an agent, not by a lawyer. Every conclusion cites
> the article it rests on so that the owner — or the lawyer he shows it to — can check it.
> Anything that depends on an interpretation is marked **[lawyer]** and gathered in § 6.
>
> **Purpose**: to review, for project 008 phase 6 step 4
> ([PLAN](../projects/008-console-watches-quality-and-spend/PLAN.md), the PRD's criterion 9;
> [`0071`](../decisions/0071-the-service-records-what-leaves-no-row-and-the-console-watches-it.md)),
> the three mails the service sends to the owner alone: the daily digest (`owner-digest`) and
> the immediate alerts (`owner-alert`) for three failed generations in a row and for spend at
> 80% / 100% of the cap.
> **Audience**: the lead, `backend`, the owner and the lawyer. **Committed**: yes — the
> repository is public: there are no addresses or names here; the recipient is the
> `OWNER_EMAIL` variable, whose value is written in no file.
> **Maintained by**: the `legal` agent. **Cut-off date**: 2026-09-29, branch
> `agent/008-phase6/backend` at `a1fac59` (**unmerged**: everything that follows is true once
> it is merged as it stands).
>
> **An addendum from the same day**
> ([at the end](#addendum-2026-09-29-afternoon-the-waiting-account-alert-resolved-and-a-fourth-alert)):
> § 5 (the address in the waiting-account alert) is **resolved**, and there is one more alert
> (the reminders task going silent).

## 0. Verdict

- **They can be sent as they are.** No mail carries the address, the name, the identifier or
  the text of any user. They carry counts, failure codes from a closed list, fixed labels and
  links to the console, and the code guarantees it by type and by test, not by habit (§ 1).
- **To the mail provider and the mailbox, the content is anonymous information**; to the
  owner, who is the controller, a small count can point at somebody, but only with data he
  already has in the console and for the same purpose. There is no new datum, purpose or
  recipient: **the privacy policy does not change and the record of processing only notes the
  review** (§ 2 and § 3).
- **The footer sentence is true in what matters and imprecise in the letter**, as is the
  opening line. Two **P3** wording changes, optional, for `backend` through the lead
  (`backend` was not available; § 4). The code has to change nothing.

## 1. What they do (read in the code, `a1fac59`)

| What | Where | What matters here |
| --- | --- | --- |
| Recipient | `OwnerAlerts.service.ts:54` | `OWNER_EMAIL` only, and only if there is SMTP; without it, nothing |
| When | `OwnerAlerts.service.ts` `digest`, `afterJob`, `checkSpend`; `Cron.controller.ts` (`/cron/reminders`, the end of the nightly sweep); `PlanJobRunner.service.ts` (at the end of every generation) | the digest: at most one a day and only if something is not zero; failures: at most one every 6 h; spend: one per threshold and month |
| The digest | `OwnerDigest.ts:25-38, 66-106` | accounts waiting (a number), new inbox messages (a number), failed generations in 24 h by code, text and image spend against their caps, five catalogue counts that "should be zero", failed mails per template, scheduled tasks that have stopped |
| The failure alert | `OwnerAlert.ts:39-44` | the codes of the last three generations, newest first |
| The spend alert | `OwnerAlert.ts:47-52` | the source (text / images), the dollars spent, the cap, the percentage |
| Codes | `AdminAlertController.ts:68-69` (`safeCode`) | what comes from `plan_generation_jobs.error` only passes if it is `^[A-Z][A-Z0-9_]{0,63}$`; otherwise `OTHER`. A free-text error cannot slip through |
| Templates | `AdminAlertController.ts:73-74` (`safeKind`) | `^[a-z][a-z0-9-]{0,39}$` only; otherwise `unknown` |
| Labels | `OwnerDigest.ts:30-38`, `OwnerAlert.ts:29` | constants in the code |
| Links | `OwnerAlerts.service.ts:61` | `APP_URL` + the console's path + fixed filters (`?activated=no`, `?status=failed&since=24h`…); no id, no token. Opening them needs the owner's session |
| The trail | `Email.service.ts:114`; `AnalyticsRepository.ts:70` | `mail_sent` stores the template and whether it went out, with no recipient; `owner_alerted` stores only the alert's kind, with `userId: null` |
| The test | `OwnerMail.spec.ts` | it fills every string that travels with sentinels (a message body, a dish name, an error text, an address, a UUID, an id) and fails if any of them, or an `@`, appears in the subject, the text or the HTML |

The eight codes a generation can produce (`PlanGeneration.service.ts:51-59`):
`GENERATION_AI_UNAVAILABLE`, `GENERATION_INVALID_PLAN`, `GENERATION_ONBOARDING_INCOMPLETE`,
`GENERATION_POOL_TOO_SMALL`, `GENERATION_PROFILE_CONSENT_REQUIRED`,
`GENERATION_PROFILE_INCOMPLETE`, `GENERATION_TIMED_OUT`, `GENERATION_UNSAFE_CONTENT`; plus
`GENERATION_FAILED` for the unexpected (`PlanJobRunner.service.ts:114`) and `OTHER` from the
filter.

## 2. Is there personal data in these mails?

**Personal data** is "any information relating to an identified or identifiable natural
person", and identifiable means "directly or indirectly" (GDPR art. 4.1). To know whether
somebody is identifiable "account should be taken of all the means reasonably likely to be
used, such as singling out, either by the controller or by another person", and the Regulation
"does not therefore concern the processing of such anonymous information, including for
statistical purposes" (recital 26).

The answer depends on who is reading, which is the relative reading the CJEU accepts in
C-413/23 P (*EDPS v SRB*, 4/9/2025) and that
[`analysis.md` § 4.4](./analysis.md#44-openrouter-and-whoever-runs-the-model-2026-09-26-for-0064s-change)
already uses for the AI:

- **To the mail provider and whoever hosts the mailbox** (today a Gmail account, P2-10):
  "Accounts waiting: 1", "GENERATION_TIMED_OUT: 2" or "9.30 USD of 10.00 USD" give it no
  means of reaching a person: there is no address, id, name or text, and the links only open
  with the owner's session. **Anonymous information** to it.
- **To the owner, who is the controller**, a count of 1 or three codes in a row at a given
  hour can **single out** somebody if he cross-references the console (which already shows
  addresses in Accounts, the Inbox and Generation, `0068`). With that caution, I take it as
  processing of personal data **he already has and for the purpose he already has**:
  - the accounts waiting serve activation (row 1 of the record); `0029`'s alert already sends
    him, through the same provider, **the address** of every sign-up. The digest sends him
    less than that;
  - failures, failed mails, the catalogue and spend serve "knowing whether it works" (row 7 of
    the record; the policy, legitimate interest "recording use of the product and technical
    errors so that it works");
  - the controller is not a "recipient" of his own data, and the mail communicates them to
    nobody else.

  It is minimisation (art. 5.1.c) and confidentiality (arts. 5.1.f and 32) in their simplest
  form: the mail goes out through a provider and lives in a mailbox less protected than the
  console, so it carries only what is needed to decide whether to open it. **[lawyer]**, the
  same relative reading as § 4.4.

**The codes and health.** None names an illness, a medication or an allergy. Two say something
about a person:

- `GENERATION_PROFILE_CONSENT_REQUIRED` says that person is missing (or withdrew) the
  profile's consent: it is a **state of consent**, not a health datum.
- `GENERATION_POOL_TOO_SMALL` may suggest a very restricted diet; no specific condition
  follows from it, and the owner would infer it better from the profile he already stores.

To any other reader they are anonymous. I do not see art. 9 data in the mail; the broad reach
of "health data" (C-184/20 *OT*, 1/8/2022) requires the datum to **allow the state of health
to be inferred**, and a failure code with no person does not. **[lawyer]**, out of caution.

**LOPDGDD**: it adds no requirement to the above for these mails.

## 3. The privacy policy and the record of processing

- **The policy: unchanged.** The mail provider's list of purposes (es-ES.ts, `privacy`, "for
  the confirmation, password recovery and check-in reminder mails") does not have to grow,
  because **no user datum travels in these mails**. The duty to inform (art. 13) falls on data
  collected from the data subject, and here nothing new is collected or communicated.
- **The record (art. 30.1): there is no new purpose, category or recipient** (letters b, c and
  d), so there is no new row. I note the review in its header and, in row 7, the mail with no
  data as a measure.
- **The DPIA**: unchanged; it is not new processing and it does not raise the risk.

## 4. The footer sentence and the opening line (P3, optional)

`OwnerDigest.ts:28`: "Ninguna dirección, nombre ni texto de nadie viaja en este correo."

- **In what matters it is true**: no address, name or text of a user travels.
- **In the letter, not quite**: "dirección" is also a web address, and the mail is full of
  links; and the `To:` header carries the owner's address.

`OwnerDigest.ts:26`: "Solo hay números y enlaces." It is the less exact of the two: failure
codes, template names and task names travel too.

Nobody but the controller reads these sentences and they promise nothing to a data subject, so
they are not a P0's "false text"; they are wording. The proposal (with no `@`, so the test is
unchanged; the test does not check these strings):

| Constant | Today | Proposed |
| --- | --- | --- |
| `INTRO` | `Esto es lo que hoy pide una mirada. Solo hay números y enlaces.` | `Esto es lo que hoy pide una mirada. Solo hay números, códigos y enlaces.` |
| `FOOT` | `Ninguna dirección, nombre ni texto de nadie viaja en este correo.` | `Este correo no lleva el correo electrónico, el nombre ni el texto de ninguna persona usuaria.` |

The alert (`OwnerAlert.ts`) has no footer; it does not need one.

## 5. Out of scope, found while reading

- **`0029`'s alert (`account-waiting`) does carry every sign-up's address** to the owner's
  mailbox, where it stays with no deadline. It is already covered by P2-10 (a consumer Gmail
  as the provider, with no DPA); what is missing is a period for those mails in the mailbox. A
  P3 candidate for [`analysis.md` § 9](./analysis.md#9-risks-ordered-by-what-can-happen-to-a-real-person):
  delete them once the account is activated or refused.
- **The policy says** "nobody consults it [the database] except to fix a bug". An automatic
  read of aggregates does not make that less true; the console (`0068`) was already
  stretching it before this, and that is another matter.

## 6. To confirm with a lawyer (add to [`analysis.md` § 10](./analysis.md#10-to-confirm-with-a-lawyer))

1. Does the relative reading (C-413/23 P) hold for saying that a count or a failure code, with
   no identifier, is anonymous information to the mail provider, even though the controller
   can single out with the console?
2. Can a code like `GENERATION_PROFILE_CONSENT_REQUIRED`, in the hands of whoever has the
   console, be considered data concerning health under C-184/20's broad reach? (My reading:
   no; it is a state of consent.)

## Sources consulted (2026-09-29)

- GDPR, the BOE text `DOUE-L-2016-80807`: recital 26, arts. 4.1 and 4.2, art. 30.1 (read
  today); arts. 5.1.c, 5.1.f, 13 and 32.
- CJEU C-413/23 P and C-184/20, as they appear in the
  [README](./README.md#primary-sources-used-the-version-consulted).
- The code in `agent/008-phase6/backend` @ `a1fac59`:
  `apps/api/src/modules/email/templates/OwnerDigest.ts`, `OwnerAlert.ts`, `OwnerMail.spec.ts`,
  `Email.service.ts`; `apps/api/src/modules/owner-alerts/services/OwnerAlerts.service.ts`;
  `packages/core/src/controllers/Admin/AdminAlertController.ts`;
  `packages/core/src/repositories/Admin/AdminGenerationsRepository.ts`;
  `packages/core/src/repositories/Analytics/AnalyticsRepository.ts`;
  `apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts`.
- Decisions `0029`, `0068`, `0071`.

---

## Addendum (2026-09-29, afternoon): the waiting-account alert, resolved, and a fourth alert

> **Cut-off**: the worktree of branch `admin-console-loose-ends` on `e1332b4`, **uncommitted
> and unmerged**: what follows is true once it is merged as it stands. What is above is not
> rewritten; this addendum says what has stopped being true.

**1. § 5, first point: resolved** by the owner's decision ([`LOG.md`](../decisions/LOG.md),
2026-09-29, an amendment to `0029`/`0030`). The `account-waiting` alert no longer carries the
address, the name, the id or an activation link: it says there is an account waiting and links
to `/admin/cuentas?activated=no`, which only opens with the owner's session
(`AccountWaiting.ts:15-32`; the function does not even receive the account,
`AccountWaitingMail.ts:32-36`; `AccountWaiting.spec.ts` holds it up in both languages). The log
no longer carries the user's id either, and a failure's carries only the error's class
(`AccountWaitingMail.ts:46` and `49`). The proposed P3 (deleting those mails after activating
or refusing) stops being needed for the new ones: there is nothing to delete. Something more
than the address goes: the button carried a signed token that opened the account **with no
session** for 30 days (`ActivationLink.ts:4`); a compromised mailbox was a key (arts. 5.1.f and
32). The text as it stands: [`textos/06`](./textos/06-correos.md) § L.

**2. What stops being true above.**

- § 2, "`0029`'s alert already sends him, through the same provider, **the address** of every
  sign-up. The digest sends him less than that": once merged, **no** mail to the owner carries
  anybody's address. § 2's conclusion does not change; its support on that point does.
- § 0 and the purpose talk about **three** mails: now there are five kinds (the digest, three
  immediate alerts and the waiting-account one).
- § 3 still stands and is firmer: the mail provider's list of purposes in the policy never
  named this alert, and now it does not need to, because no user datum goes out through it.

**3. What is left (residual, P3).** The `account-waiting` mails sent **before** the change are
still in the owner's mailbox with every sign-up's address, and their link still opens the
account until the token expires (30 days from when it was sent); `GET /admin/activate` is kept
only for them and the code says to delete it, with `ActivationLink.ts`, once they have expired
(`AdminAccounts.controller.ts`, the route's comment). A recommendation to the owner: **delete
those mails** from the mailbox (and from the bin) once he has acted on each account — nothing in
the product needs them, and the console has the same; and remove the route 30 days after the
deployment. P2-10 (a consumer Gmail with no DPA) is still open and does not depend on this.

**4. A fourth alert: the reminders task gone silent.** `OwnerAlert.ts:38-46`,
`type: 'reminders-silent'`, from `/cron/rewrite-steps` (03:30 UTC) when `/cron/reminders` has
gone more than 26 h without finishing a run (or has none); at most one a day, claimed for 20 h
(`OwnerAlerts.service.ts:121-133`). Fixed text and a link with no id: no personal datum, and
`OwnerMail.spec.ts` puts it through the same sentinels. **Verdict: it can be sent as it is**;
neither the policy nor the record changes because of it (row 7 already covers "alerts"). It has
a legal reading in its favour: `/cron/reminders` is also the one that deletes expired
invitations, whose promised period is "by the next day at the latest" after expiry (the record,
row 5; art. 5.1.e), and this alert is what tells the owner, on the first day, that the promise
is at risk. Its `detail` does not name that: an optional **P3** wording change for `backend`, in
[`textos/06`](./textos/06-correos.md) § K.

**5. Nothing new to confirm with a lawyer**: the new alert and the reduced alert fall under the
same reading as § 6.1 (anonymous information to the mail provider).

The sources for this addendum: `git diff e1332b4` and `git status --short` on branch
`admin-console-loose-ends` (2026-09-29): `AccountWaiting.ts`, `AccountWaiting.spec.ts`,
`AccountWaitingMail.ts`, `ActivationLink.ts`, `AdminAccounts.controller.ts`, `auth.config.ts`,
`SelfService.ts`, `OwnerAlert.ts`, `OwnerMail.spec.ts`, `OwnerAlerts.service.ts`,
`Cron.controller.ts`, `AdminAlertController.ts`, `apps/api/vercel.json`,
`ExpiredInvitations.service.ts`; `docs/decisions/LOG.md`.

---

## Addendum (2026-09-30): two alerts about the dish pictures

> **Cut-off**: the `main` worktree on `0d7b275`, **uncommitted** (project 009, phase 1;
> [`0072`](../decisions/0072-a-rejected-picture-waits-for-the-owner.md)): what follows is true
> once it is merged as it stands. Phase 1 only: the stored candidate, the private store and
> accepting or withdrawing an image (phases 2 and 3) are not here.

**1. What they are.** Two more kinds of `OwnerAlert`, with an `EmailKind` of their own
(`owner-picture-alert`): the dishes whose picture has failed since the previous alert, by a
reason from a closed list of eight, at most one an hour; and the image provider refusing
requests — the key cannot pay or has reached its usage limit (the owner's decision the same
day: the limit is alerted together with payment) — at most one every 6 hours. The text as it
stands and a sentence-by-sentence check: [`textos/06`](./textos/06-correos.md) § M and § N.

**2. Verdict: they can be sent as they are.** Neither carries anybody's datum: a count of
`recipe_images` rows — catalogue dishes — a fixed label per reason and a link with no id. They
do not carry the dish's name, its id or what the provider or the reviewer wrote, and it is held
up by the type (`OwnerAlert.ts:35-36`), by the filter (`reasonLabel`, `whole`) and by
`OwnerMail.spec.ts`, with the same sentinels as the rest. The recipient is still `OWNER_EMAIL`
alone. The same reading as § 2: anonymous information to the mail provider (GDPR recital 26).

**3. What stops being true above.** The kinds of mail to the owner are now seven (the digest,
five immediate alerts and the waiting-account one). § 3 does not change: neither the privacy
policy nor the record needs more than the review's note (row 7). There is no new processor:
they go out through the same SMTP provider.

**4. What extra is stored.** Nothing with personal data: two new values of `kind` in the
`owner_alerted` event (`picture-failed`, `picture-payment-refused`; `userId: null`; its date is
now set by whoever claims it, so that each mail counts from the previous one) and one in
`mail_sent` (`owner-picture-alert`, with no recipient). No table, no column, no migration.

**5. Wording (P3; nothing was false).** Applied by the lead the same day: in the provider
alert, "Mientras dure, los dibujos que rechace se devuelven sin dibujar" (previously "y no se
dibuja ninguna", an inference in the present tense that was also too much for a usage limit) and
"Platos con el dibujo devuelto" instead of "Dibujos devueltos", because dishes are what is
counted; and, in `/cron/reminders`, the check for these alerts moves to after the deletion of
expired invitations and inside a 10 s cap, the same as `/cron/rewrite-steps`
(`Cron.controller.ts:62`, `66-69` and `84-90`). Left, with no change asked for: "desde el aviso
anterior" in each kind's first alert (it counts 24 h); "7 días", which phase 2 will lengthen by
up to a day; and the label "El modelo rechazó la petición", which is the console's wording and
in the provider alert is always a 429. The detail, with its line, is in the comments of § M and
§ N.

**6. Nothing new to confirm with a lawyer**: the same question as § 6.1.

The sources for this addendum: `git diff` and `git status --short` on `main` over `0d7b275`
(2026-09-30): `OwnerAlert.ts`, `OwnerMail.spec.ts`, `Layout.ts`, `OwnerAlerts.service.ts`,
`OwnerAlerts.spec.ts`, `AdminAlertController.ts`, `AdminRepository.ts`,
`AnalyticsRepository.ts`, `DishPicture.service.ts`, `PictureReason.ts`, `RecipeRepository.ts`,
`Cron.controller.ts`, `MealPlans.service.ts`, `AdminCatalogue.service.ts`,
`apps/api/test/picture-alerts.e2e-spec.ts`; project 009's PRD and PLAN, decision `0072`,
architecture report `0005` § 4.1 and § 10. GDPR (`DOUE-L-2016-80807`, read today in the OJEU
PDF on the BOE): recital 26, art. 4.15, arts. 5.1.c, 5.1.e and 5.1.f.

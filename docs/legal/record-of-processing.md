# Record of processing activities (*registro de actividades de tratamiento*, art. 30 GDPR)

> **Purpose**: the record art. 30.1 requires of the controller (*responsable del
> tratamiento*). Art. 30.5's exception (fewer than 250 people) **does not apply**: the
> processing is not occasional and it includes special categories (*categorías especiales*)
> under art. 9.1. **Audience**: the owner; the AEPD if it asks (art. 30.4). **Committed**:
> yes. **Maintained by**: the `legal` agent; it is updated in the same change that adds a
> datum, a recipient or a purpose.
>
> Reviewed 2026-09-26: row 2 (AI, `0064`). Reviewed 2026-09-27: row 2 (dish pictures, project
> 006). Reviewed 2026-09-28: row 2 (onboarding, `0067` — true once `feat/onboarding-cleanup`
> is merged; it includes "country", which starts being read with that same change). Reviewed
> again the same day: row 2 (migration `0043` sets to `NULL`, for every account, the ten
> columns `0067` stops filling — true once the same branch is merged).
> Reviewed 2026-09-29: row 7 (mail to the owner, `0071` — true once
> `agent/008-phase6/backend` is merged): no new datum, purpose or recipient; the mail carries
> only counts, codes and links ([note](./2026-09-29-mail-to-the-owner.md)).
> Reviewed again the same day: rows 1, 5 and 7 (the waiting-account alert to the owner stops
> carrying the address and the activation link, an amendment to `0029`; and a silent-task
> alert — true once the `admin-console-loose-ends` worktree is merged onto `e1332b4`): no new
> datum, purpose or recipient; one datum fewer in the owner's inbox
> ([addendum](./2026-09-29-mail-to-the-owner.md#addendum-2026-09-29-afternoon-the-waiting-account-alert-resolved-and-a-fourth-alert)).
> Reviewed 2026-09-30: row 7 (two alerts to the owner about the dish pictures, `0072`,
> project 009 phase 1 — true once the `main` worktree is merged onto `0d7b275`): no new
> datum, purpose or recipient; counts by closed-list reason and a link, with no dish's name
> or id. The only extra thing stored is two new values of the kind in `owner_alerted` and one
> of the template in `mail_sent`, both with no user ([`textos/06`](./textos/06-correos.md)
> § M and § N).
> Reviewed again the same day: row 2 (project 009 phase 2 — true once the `main` worktree is
> merged onto `abc0a90`): a second Vercel Blob store, private and in `fra1`, keeps up to one
> rejected image per dish for the owner to look at. No new personal datum, purpose or
> recipient ([`dish-pictures.md`](./dish-pictures.md) § 4.3).
> Reviewed again the same day: row 2 (project 009 phase 3 — true once the `main` worktree is
> merged onto `fce954d` along with `frontend`'s): the owner can publish by hand a picture the
> judge rejected, and withdraw it. No new personal datum, purpose, data subject (*interesado*)
> or recipient: a file with nobody's data moves between the two Vercel Blob stores. The trail
> gains two actions (`picture.accepted`, with the allergen keys the judge flagged, and
> `picture.removed`), whose actor is the controller himself
> ([`dish-pictures.md`](./dish-pictures.md) § 4.4).
> Reviewed again the same day: row 2 **unchanged** (project 010 phase 3 — true once the
> `.claude/worktrees/backend-010-3` worktree is merged onto `f81e834`): each dish's row in
> `recipe_images` now stores what the judge's two calls answered and its verdict, with the
> recipe as it was judged. They are a model's words about a photo of food made from the
> recipe alone: no new personal datum, purpose, data subject, recipient or period to record
> (art. 30.1 only reaches the processing of personal data)
> ([`dish-pictures.md`](./dish-pictures.md) § 4.5).
>
> Reviewed 2026-10-03: row 1 (project 011, phases 7 and 8 — 7 merged in `6b26023`, 8 true
> once PR #217, `4f36ec5`, is merged): data subjects (addresses with no account too),
> categories (HMAC fingerprints of the address with counts; the IP in `rate_limit`), periods
> and measures. The "somebody tried to create an account with your email" mail is a security
> notice of the same purpose; no new recipient ([`analysis.md` § 4.1 ter](./analysis.md)).
>
> Reviewed 2026-10-09: row 1 (project 011, phase 7b, `0089`, PR #242 — the browser that has
> already signed in; already covered under "Categories of data" and "Erasure deadline").
> Reviewed again the same day: row 1 (project 011, the follow-up of the sweep of unconfirmed
> accounts, [`0092`](../decisions/0092-sweep-an-account-whose-address-nobody-ever-confirmed.md),
> PR #250, already in `main`): the **erasure deadline** (*plazo de supresión*) — an account
> whose address nobody confirmed is deleted thirty days after sign-up if it has no session,
> profile, plan or audit row; and the **measures** — one trail row is left with no actor, no
> subject and no IP. No new datum, purpose, data subject or recipient: it is a shorter period
> for data that were already on the row ([`analysis.md` § 4.1 quinquies](./analysis.md)).
>
> **I am not a lawyer.** The periods and recipients marked "pending" depend on decisions in
> [`analysis.md` § 9](./analysis.md#9-risks-ranked-by-what-can-happen-to-a-real-person).

**Controller**: {name}, {email} (the full details are in the legal notice). **DPO** (*DPD*):
not appointed.

| # | Activity | Purposes | Data subjects | Categories of data | Recipients | Transfers | Erasure deadline | Measures (art. 32) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Accounts and sign-in | sign-up, sign-in, recovery; proof of the terms accepted; account security (brakes against abuse, security notices) | users, professionals; for the brakes, also addresses with no account and anybody asking to sign in or sign up | name, email, password (hashed), the session's IP and browser, social provider; an HMAC fingerprint of the address with a count of failed attempts (`sign_in_failure`) and of mails sent (`mail-budget:*` in `verification`), with no address; IP and route with a count (`rate_limit`); a SHA-256 fingerprint of the code of the browser cookie that has already signed in, with the account's id (`sign-in-device:*` in `verification`, ten per account; 011 phase 7b, `0089`), and that browser's own brake (an HMAC of the code in `sign_in_failure`); the version of the terms accepted and the date (**pending**: from 008's phase 7 in production, [note D5](./2026-09-29-accepting-the-legal-texts.md)) | Vercel, Neon, the SMTP provider, Google/Apple (sign-in) | the US (companies) — DPF/standard clauses | the account; **an account whose address nobody confirmed: 30 days from sign-up**, if it has no session, no profile, no plan and no trail row naming it (a daily sweep, `0092`); sessions 30 days; fingerprints: the mail budget ≈ 25 h, the brake until a day with no attempts plus a daily sweep (they are not deleted with the account, they expire); `rate_limit`: once its window passes (≤ 60 s), with the next request; the browser that has signed in: 90 days from the last password sign-in, or when it is changed or reset, when the other sessions or all of them are revoked, or when the account is deleted; its own brake, like the brake | Better Auth, limits in the database, secure cookies; a per-address brake and a mail budget (3/h per kind) with a fingerprint instead of the address; the same answer at sign-up and at sign-in whether or not the account exists; signing in with a password requires a confirmed address; the waiting-account alert to the owner carries no address, name, id or activation link (since 2026-09-29; the ones sent before, with an address and a 30-day token, stay in his inbox until he deletes them); the sweep of an account nobody confirmed leaves a trail row with no actor, no subject, no `entityId` and no IP, written in the same transaction that deletes it (`0092`) |
| 2 | Meal planning | targets, plans, the shopping list, swaps | users | body measurements, goal, allergies, intolerances, way of eating (**health, religion**), country (which foods the catalogue offers, `0034`; read since `0067` — it used to be stored and unused), food and cuisine preferences (meal shape, maximum cooking time, cuisines, tastes). Onboarding **no longer asks** (`0067`, prompt 4.4.0): waking and sleeping time, training days and time, work schedule notes, budget, cooking frequency, breakfast style, portion preference or the free-text custom goal — minimisation, art. 5.1.c. **Only this goes to the AI** (prompt 4.4.0): daily targets and goal type, meal shape, maximum cooking time, vegetarian/vegan, tastes by catalogue name, dish names, the check-in's closed answers — with no identifiers | Vercel, Neon. AI: **none since 2026-09-26** (`stub`); after `0064`, **OpenRouter, Inc.** (a processor) and the company that runs the model, from a closed list on the account (DeepInfra, CoreWeave; the Gemma 4 31B model and, as a fallback, DeepSeek V4.1 Flash). **Dish pictures** (006, with its flag): the drawing and the judge receive no personal data (only the recipe), so Google (Vertex) and DeepInfra are not recipients; the images are stored and served on **Vercel Blob** (`fra1`), which sees the IP and browser of whoever loads them; since 009 phase 2, a second Vercel Blob store, **private** and in `fra1`, keeps the last image the judge rejected for a dish, with no personal data and only for the owner's session; since 009 phase 3 the owner can publish it by hand — it then moves to the public store, like any other — and withdraw it ([`dish-pictures.md`](./dish-pictures.md) § 4) | the EU (Vercel, Neon; DPF). AI: the US — OpenRouter: the standard clauses of its DPA (**to be obtained**, P1-11); whoever runs the model: no guarantee towards NutrIA, a request with no identifiers (P2-11) | the account. In the AI: nothing (zero retention); OpenRouter keeps metadata (tokens, time, cost). The ten columns onboarding no longer fills are at `NULL` **on every account**, including those that already had them, since migration `0043` (the same change as `0067`); dropping those columns and the `'custom'` enum value belongs to the next delivery (see [`analysis.md` § 4.1](./analysis.md#41-retention) and § 9 P2-13) | the allergy gate in code; the health boundary; `zdr` and `data_collection: 'deny'` on every request; an account with training off and ZDR; a key limited to two models and with a cap; a closed provider list ✔ (2026-09-26: the account and `AI_PROVIDER_ONLY`) |
| 3 | Declared health | showing it, exclusion for coeliac disease, the supervision notice | users | conditions, medication, supplements (**health**) | Vercel, Neon; the linked dietitian if the user marks it | the EU | the account, or withdrawal of consent | tables of their own, outside the prompt, redaction in logs |
| 4 | Follow-up | adherence, weight, check-in, reminders | users | ticks, ratings, comments, weight, answers | Vercel, Neon, SMTP, browser push (encrypted) | the US (companies) | the account | — |
| 5 | The dietitians' practice (004) | consented communication to the professional, the trail | linked users, invitees, professionals | those of 2-4 depending on the link; the invitee's email; the trail; the registration number | the linked professional (an independent controller) | — | the link: the account; the invitation: until it is answered, or 14 days plus the daily sweep (≤ 15; if that task goes more than 26 h without running, an alert to the owner, [`textos/06`](./textos/06-correos.md) § K); the trail: the client's account | `withClient`, the trail, 404s, the professional's agreement (**pending**) |
| 6 | Payments | Premium and practice plans | paying users, professionals | Stripe ids, status, period | Stripe / Link | the US/EU — Stripe's DPA | the account; Stripe per tax law | a checkout and portal hosted by Stripe; a signed webhook |
| 7 | Metrics and errors | knowing whether it works | users | an event + `userId`; an error and a stack with no data | Neon; Sentry (if on) | the US/EU depending on Sentry's region | **pending**: 24 months for metrics, 12 months for jobs | no health; secrets redacted; the mails to the owner (the digest and the failure, spend and silent-task alerts, `0071`; failed dish pictures and an image provider refusing requests over payment or a usage limit, `0072`) carry only counts, closed-list codes, fixed text and links |
| 8 | The suggestions inbox | reading and answering | users | free text | Neon | — | **pending**: 24 months after "handled" | only the owner reads it |
| 9 | Backups | recovery | everybody | everything | Neon (restore), the owner's machine (export) | the EU | Neon: the plan's window (**to be recorded**); the export: **30 days (pending)** | encryption of the export **pending** |

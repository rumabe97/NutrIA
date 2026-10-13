# Go-live checklist

> **Purpose**: what has to be true before the `professional` flag is switched on and before
> Stripe's *live* keys go in. Each box refers to the finding in
> [`analysis.md` § 9](./analysis.md#9-risks-ordered-by-what-can-happen-to-a-real-person).
> **Audience**: the owner and the lead. **Committed**: yes. **Maintained by**: the `legal`
> agent.
>
> **I am not a lawyer.** This list does not replace the hour with one: the last box of each
> block is that hour.

## 0. Now, whatever the flags say (it affects production)

> Ticked: done in the legal-a batch (backend `1a3742b`, frontend `d036c40`), checked against the code on 2026-09-25; they count once they are merged together and migration `0039` is applied. P0-3 is closed in substance (see `analysis.md` § 9).

- [x] **P0-3** — The model combination with providers that do not train and that have a contract only (or with no free text and no religious labels in the prompt). The owner records which models serve today.
- [x] **P0-2** — Explicit consent for the profile built, asked of existing accounts too ([`textos/05`](./textos/05-consentimientos-cliente.md) § A).
- [x] **P1-4** — An age gate (**18**, the owner's decision of 2026-09-25) on the server. Check in the database whether there are accounts under 18: under 14, P0 (their health consent is not valid: delete their health data and tell them); 14 to 17, tell them the service is becoming adults-only and close the account with time to take their data away.
- [ ] **P1-6** — Manual exports encrypted, on an encrypted disk, deleted at 30 days; the old unencrypted ones, deleted.
- [ ] The **DPIA** reviewed and signed by the owner ([`dpia.md`](./dpia.md) § 7).
- [ ] The new privacy policy published with only the sentences whose ⟦requirement⟧ is met ([`textos/02`](./textos/02-politica-privacidad.md)); the change notice mail sent beforehand ([`textos/06`](./textos/06-correos.md) § F).

## 0 quater. Before publishing "deleted after 12 months" on `/privacidad` (project 011)

- [ ] The daily purge of `audit_logs` (`action LIKE 'auth.%'`, `createdAt` older than 12 months) is in production: 011's phase 7, in the daily sign-in-failure cron. With proof that it does not delete admin rows (`analysis.md` § 4.1 bis). Only then is the sentence marked ⟦si purga-seguridad⟧ of [`textos/02`](./textos/02-politica-privacidad.md) published. Until then the policy says only "while your account exists".
  - **Reviewed 2026-10-09**: the code has been there since 2026-10-03 (`AuditController.forgetExpiredAuthRows`, PR #213, `6b260239`), with its test that it only touches `auth.*`, and the same daily cron carries it. **All that is missing is the lead confirming #213 is deployed**; with that, the box is ticked and the sentence "It is also deleted after 12 months" can go out in the same dictionary change as ⟦barrido-sin-confirmar⟧ (§ 0 septies), with the same `privacy.updated`. In English: "The security record of your account is kept while your account exists; when you delete it, it stops being linked to you. It is also deleted after 12 months."

## 0 quinquies. Before taking the sign-up that reveals nothing to production (project 011 phase 8, PR #217)

- [ ] The ⟦frenos⟧ bullet and the legitimate-interest sentence of [`textos/02`](./textos/02-politica-privacidad.md) in `privacy` (es-ES and en-GB), **in the same change** (P2-14). If it is published on a day other than 3 October 2026, `privacy.updated` with that date. No notice mail.
- [ ] `requireEmailVerification: true` does not go out before the owner has seen, read-only, how many production accounts have not confirmed their address (the PLAN asks for it). Recommended, not required: write to them once with a link before switching it on.
- [ ] (P3, not blocking) The two web sentences the budget can make false (`auth.signUpSent`, `auth.invalidCredentials`) and the new sentence of mail § O in [`textos/06`](./textos/06-correos.md) (`analysis.md` § 9, P3).
- [ ] `/condiciones` does **not** change: the contract is still concluded on pressing; if anybody wants it to say there that the email has to be confirmed, raise `TERMS_VERSION` (`0071`).

## 0 sexies. Before taking the browser that has already signed in to production (project 011 phase 7b, PR #242, `0089`)

- [ ] The ⟦navegador-conocido⟧ addition to the "Brakes against abuse" bullet and the "Cookies" sentence of [`textos/02`](./textos/02-politica-privacidad.md) in `privacy` (es-ES and en-GB), **in the same change** as the PR, with `privacy.updated` = that day's date. No notice mail; no version to raise.
- [ ] The text describes the PR after its invariant review: the browser's own brake, the cookie voided when the other sessions or all of them are revoked, and the rows deleted with the account (`UserController.forgetDevices`). If any of those three does not reach production, the text is not published like that ([`analysis.md`](./analysis.md) § 4.1 quater).

## 0 septies. Before the sweep deletes the first unconfirmed account (project 011, follow-up, `0092`, PR #250)

> **The sweep has no flag and no switch**: it lives inside the daily cron
> `/api/v1/cron/sweep-verifications` (08:05 UTC), so it runs with #250's deployment, which is
> already in `main`. What is urgent, then, is not a notice to anybody: it is the order — the
> published text before the first account is deleted. The detail and the sources are in
> [`analysis.md` § 4.1 quinquies](./analysis.md).

- [ ] (lead) **Find out whether #250 is deployed** and, if it is, at what time the cron ran or is going to run. If it runs before the text is live, the policy will have arrived late to a deletion the confirmation mail already promises: note it and publish the text that same day (it is not a breach; it is a period informed late).
- [ ] (frontend) The ⟦barrido-sin-confirmar⟧ paragraph of [`textos/02`](./textos/02-politica-privacidad.md) in `privacy` (es-ES and en-GB), the section "Cuánto tiempo guardamos tus datos" / "How long we keep your data", in the **first** change that goes out. The live `privacy.updated` is already "9 de octubre de 2026" / "9 October 2026": if it is published today, it is not touched; another day, that day's date.
- [ ] (owner, **read-only**) Before the first run: how many production accounts have `emailVerified = false`, are more than thirty days old and have nothing inside (no session, no profile, no plan, no trail row). The first run deletes them **all at once**, and some may belong to real people who signed up before the mail promised this period. The equivalent box in § 0 quinquies (phase 8) already asked for this count and is still unticked: the same query will do.
- [ ] (owner, **recommended, not required**) If there are more than a few, write to them once with a confirmation link before letting the cron run (a service message, art. 6.1.b). If he decides not to, note the decision and the date.
- [ ] (owner) **Operationally, from today: only activate confirmed accounts.** Opening an unconfirmed account writes a trail row for it and takes it out of the sweep for good, so the mail's promise stops being true for it (`analysis.md` § 4.1 quinquies and § 9, P3). The `confirmed` filter on Accounts, in `/admin`, says which ones are.
- [ ] (backend, P2 — it does not block the text) `staleUnconfirmedWhere` also looks at `user.activatedAt` (`isNull`), so as not to depend on activation having left a trail: activations before `0071` (the end of September 2026) left none. Sent to `backend`.
- [ ] (backend, P3 — not blocking) The confirmation mail says "al mes" in Spanish and "after thirty days" in English (`VerifyEmail.ts`, the `ignore` key): the Spanish should say "a los treinta días", like the English and like the policy. Sent to `backend`.
- [ ] (owner) After the first run: look in Settings › Action log at the "Unconfirmed account deleted" rows and check they carry **neither an actor nor an account**. If one carries anything identifying, stop the cron and tell `legal`.

> **Nothing to version and nobody to tell**: the change is not "important" (a shorter period,
> no new datum, recipient, transfer or purpose), so there is no notice mail and no consent to
> ask for again, and `HEALTH_CONSENT_VERSION`, `CARE_CONSENT_VERSION`,
> `PROFESSIONAL_AGREEMENT_VERSION` and `TERMS_VERSION` do not move. `/condiciones` does **not**
> change (`analysis.md` § 4.1 quinquies).

## 0 bis. Before setting `AI_PROVIDER=openrouter` in production (`0064`)

> Production has been running with `AI_PROVIDER=stub` since 2026-09-26: nothing goes out to
> any model. These boxes are the owner's except where stated. The detail and the sources are
> in [`analysis.md` § 4.4](./analysis.md#44-openrouter-and-whoever-runs-the-model-2026-09-26-for-0064s-change).

**Now, even if nothing is changed**
- [ ] `/privacidad` with **state 1** of "La inteligencia artificial", "Con quién compartimos" and "Transferencias" ([`textos/02`](./textos/02-politica-privacidad.md)): the live text says that "today" free models that may train are used, and since 2026-09-26 none is (frontend).

**Contract and account — they block the change**
- [ ] **P1-11** — OpenRouter's DPA: request access at `trust.openrouter.ai`, download the DPA and the sub-processor list; ask support, in writing, to confirm that the DPA its § 10.2 incorporates "for commercial, for-profit purposes" applies to this paid account and that it includes the standard clauses. Keep both, dated, outside the repository. If the answer is no: stop and go back to `legal`.
- [x] **P1-12** — Done 2026-09-26 (the owner): on the account (privacy settings), *Allowed providers* = DeepInfra and CoreWeave. All that is pending is the check afterwards: check later in `/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints` and in `/admin` that only those answer the first calls. If another company is allowed, it is named in the policy first.
- [ ] The settings of the [`ai-gateway.md` § 0](../reference/ai-gateway.md) runbook: training **off** for paid and free models; ZDR **on** for the whole account; "OpenRouter use of inputs/outputs" **off**; prompt *logging* **off**; the key with only the two models, ZDR and a monthly cap. A screenshot of each setting, dated, outside the repository (art. 5.2: being able to demonstrate it).
- [x] **P1-13** — Closed 2026-09-26: the owner removed MiniMax M3; Gemma 4 31B (`google/gemma-4-31b-it`) is the primary and DeepSeek V4.1 Flash the fallback (the decision of 2026-09-26); Gemma is Apache 2.0, with no notice, attribution or restrictions to pass on (`analysis.md` § 4.4 d). The key must allow that model and not `:free`.
- [x] (backend) `provider.only` on every request from `AI_PROVIDER_ONLY`, required at start-up with `openrouter` (`apps/api/src/config/Env.validation.ts:506-507`). Value: `deepinfra,coreweave`.
- [x] **P2-12** — Decided 2026-09-26: the owner accepts the anonymous categorisation with a notice in the policy (state 2).
- [ ] The owner asks OpenRouter in writing to exclude his account from the categorisation and keeps the answer outside the repository. It does not block: if it is excluded, the policy's sentence can go.

**Texts — in this order**
1. [ ] `/privacidad` with **state 2** (frontend), with a new `updated`, once the boxes above are ticked.
2. [ ] The same day, mail [`textos/06`](./textos/06-correos.md) § G to every account (the policy in force promises a mail before an important change).
3. [ ] `AI_PROVIDER=openrouter` **no earlier than the day after** the mail.

**Afterwards**
- [ ] In the first fortnight, look in `/admin` at which provider answered each call; one that is not on the list is an incident (the text would be false): back to `stub` and record it ([`breach-procedure.md`](./breach-procedure.md) § 8).
- [ ] Every change to `AI_MODEL`, `AI_FALLBACK_MODELS` or the allowed-provider list goes through the policy first.

## 0 ter. Before switching the dish pictures flag on (project 006)

> The detail, the sources and the reason for each box are in [`dish-pictures.md`](./dish-pictures.md).
> Art. 50 of the AI Act applies **the same day** it is switched on: with no grace period
> (§ 1.1 of that document).

**A machine-readable mark (art. 50.2)**
- [x] (backend) Measured 2026-09-27 with 8 real Gemini responses through OpenRouter, before any processing: all 8 carry the C2PA signed by Google (with the SynthID action) and the IPTC XMP `trainedAlgorithmicMedia`.
- [x] (backend) The file that is stored and served is Gemini's JPEG **untouched**.
- [ ] Validate the C2PA signature once (`c2patool` or the Content Credentials verifier) over a file **as Blob serves it** in production; if it does not validate, to `legal`. Not blocking (P3).
- [ ] (backend) Any re-encoded variant carries the IPTC XMP; no file carries a user id, in the metadata or in the Blob path.
- [x] (owner) **MAI-Image-2.6 out** (decided 2026-09-27): Gemini on Vertex only. Another model, if one returns, repeats [`dish-pictures.md`](./dish-pictures.md) § 2 first and goes into the policy first.

**A visible notice (art. 50.4 and 50.5)**
- [x] (frontend) The `meal.pictureCaption` caption and the `meal.pictureOf` `alt` on the meal's page, in both languages. — In `main` (`abc0a90`): `es-ES.ts` and `en-GB.ts`, `meal.pictureCaption` and `meal.pictureOf`; `MealPicture.tsx:71-73`.
- [ ] (frontend + accessibility) A `picture.aiMark` mark ("IA"/"AI") in the image's top right corner, on the card and on the large image, visible without interaction, 4.5:1 over any photo, with the accessible name `picture.aiMarkLabel`; no mark on the fallback plate.
- [ ] No other place shows the image without its notice (plan rows, the practice, mail, notifications, the share preview). If one is added, it carries the mark.

**Privacy and the texts**
- [x] (owner) The Vercel Blob store created in **`fra1`** (it cannot be changed afterwards). — Per `docs/reference/deployment.md:95`; `legal` has not seen it in Vercel: the owner confirms it in the panel (Storage → the store → region).
- [x] (owner) The **second store**, the one for rejected images waiting for the owner (project 009 phase 2, `0072`): `nutria-picture-candidates`, **private** and in **`fra1`**, created on **2026-09-30** and connected only to the API project's Production as `BLOB_CANDIDATES_READ_WRITE_TOKEN`. — Per `docs/reference/deployment.md:96` and the lead; `legal` has not seen it in Vercel: the owner confirms in the panel the two things that cannot be changed afterwards, **Private** and **`fra1`**. If it were not private, a rejected image would have a public address (IMG-10); if it were not in `fra1`, "in the European Union" would stop being true on `/privacidad`. The detail is in [`dish-pictures.md`](./dish-pictures.md) § 4.3.
- [x] (frontend) `/privacidad`: changes a, b and c of § 4.2, with a new `privacy.updated`, published before the flag or the same day. Without Microsoft (MAI out). — In `main` (`abc0a90`): all three paragraphs are in `es-ES.ts` and `en-GB.ts` (the `privacy` namespace), with "Última actualización: 29 de septiembre de 2026". 009's phase 2 does not touch them ([`dish-pictures.md`](./dish-pictures.md) § 4.3); **phase 3 does change one sentence** (the boxes below).
- [x] (frontend) `/condiciones`: the sentence in § 3.3, with a new `terms.updated`. — In `main` (`abc0a90`): the `terms` namespace of `es-ES.ts` and `en-GB.ts`, with "Última actualización: 29 de septiembre de 2026".
- [ ] (owner) Google Cloud's terms for generative AI (Vertex) read. Any clause that clashes, to `legal` (IMG-9).
- [ ] `legal` reviews the code as built against this document, because today it describes a plan, not code. — Done only for what 009's phases 2 and 3 add (the stored rejected image, § 1.6 and § 4.3; accepting it by hand and withdrawing it, § 1.7 and § 4.4; 2026-09-30), for what 010's phase 4 adds (withdrawing any published image, § 4.4; 2026-09-30, read against phase 4's worktree and checked afterwards in `main`, `28854ac`), for 010's phase 2 own-form rule (§ 4.6; 2026-09-30, against the `main` worktree on `28854ac`, uncommitted, already hardened) and for the boxes above that carry their source. The rest of 006 (the mark on every screen, the contrast, the public store's paths) is still unreviewed.

**Accepting by hand an image the judge rejected (project 009 phase 3, `0072`)**

> The feature has no flag of its own: it exists as soon as it is deployed, for the owner's
> session. The only switch that stops it is the pictures one (`dishPictures`: off, accepting
> is refused; withdrawing always works), and that one has been on in production since
> 2026-09-28. What follows has to be true **before the first acceptance**, and only he can
> make that. The detail is in [`dish-pictures.md`](./dish-pictures.md) § 1.7, § 4.2 b and
> § 4.4.

- [x] (owner) **Decided 2026-09-30**: the `/privacidad` sentence about the judge changes to **text A** of § 4.2 b, in the same change as the accept button, with `privacy.updated` = 30 September 2026.
- [x] (frontend) `/privacidad` with the new sentence in `es-ES` and `en-GB`, and `privacy.updated` = 30 September 2026, **in the same change** that brings the accept button. No mail beforehand: it changes neither what data is processed nor with whom. — Checked 2026-09-30 in the `main` worktree (`es-ES.ts:2288` and `:2359`; `en-GB.ts:2243` and `:2314`), word for word; it counts once merged and deployed.
- [ ] (owner) **Do not accept any image by hand until the new sentence is live on `/privacidad` in production** (IMG-15).
- [x] (frontend) The wording of the accept warning and of the withdraw dialog: what "Withdraw" does not undo (cached copies), where to delete a file that could not be deleted and the bullet about what the reviewer does not look at ([`dish-pictures.md`](./dish-pictures.md) § 4.4). — Checked 2026-09-30 in the `main` worktree (`adminPictureReview`: `acceptEffects`, `removeBody`, `removeLeftover`, in both languages), word for word. One P3 is left in a new string, `publishedLoadFailed` ("withdraw it so the dish is drawn again": withdrawing does not draw it); it does not block.
- ~~(owner, optional) `/condiciones`: "…or show something the dish does not carry"~~ — **not taken** (the owner, 2026-09-30): `/condiciones` does not change. The current sentence is still true (§ 4.4).
- [ ] (owner) In the phase's verification — accept one, see it on the dish, withdraw it — check that the accepted image carries the "IA" mark on the card and on the meal's page, and the caption on the latter; and, once, run through `c2patool` or the Content Credentials verifier a file **accepted by hand** as Blob serves it (it has passed through two stores; the signature is not validated in the code, § 1.7). If it does not validate, withdraw it and tell `legal`.
- [x] (backend) A failed deletion from the public store no longer writes the file's address into the log (IMG-13). — Checked 2026-09-30 in the `main` worktree: `VercelBlobPictureStore.ts:43-54` and `:89-97` replace the address and the path with `[picture]` and throw with no `cause`, in `put` too; the spec is in `VercelBlobPictureStore.spec.ts:99-125`.
- [x] ~~Known and out of scope (the owner, 2026-09-30; 009's LOG): an image the **judge** accepted by mistake cannot be withdrawn, only those accepted by hand (IMG-16).~~ — **Closed by 010's phase 4** (2026-09-30): "Withdraw" applies to any published image, whether the judge or the owner accepted it (`RecipeRepository.ts:1041` in `main`: `status = 'ready'` and nothing more; PRD 010, criterion 9; `0073`). A bad acceptance by the judge is removed from its page in the console, with no migration; every withdrawal leaves a `picture.removed` row with `acceptedBy` (`judge` or `owner`) and nothing about a person ([`dish-pictures.md`](./dish-pictures.md) § 4.4 and § 5, IMG-16). Merged in `28854ac` (#178) and deployed, per the lead. It also covers the images the judge accepts through the own form (010 phase 2): the new rule does not reopen IMG-16.
- [ ] (owner) Every so often, look at the "accepted by hand" count under Images and go back over those images from the Recipes filter; one that no longer convinces, withdraw it. Since 010's phase 4, the same with one the judge accepted: "Review the image" on its Recipes row and "Withdraw". No code flags an image the judge accepted wrongly; it has to be looked at.

**The dish's own form (project 010 phase 2, `0073`)**

> The rule has no flag: it reaches production with the deployment. It touches no personal
> data, the file, its C2PA, the "IA" mark or the caption. The detail is in
> [`dish-pictures.md`](./dish-pictures.md) § 4.6.

- [x] (owner) **Decide the judge's sentence on `/privacidad`** — **(b) decided 2026-09-30** ("Put the privacy clause in"); it goes with 010's phase 2. (P2, not blocking): (a) leave it, or (b) add § 4.6's clause ("…; it does not count what has the form of something the dish already has or that its name says, like its bread or its milk, because an image does not show what it is made of"). `legal` recommends (b). If it is taken: `privacy` in `es-ES.ts` and `en-GB.ts` and [`textos/02`](./textos/02-politica-privacidad.md), with `privacy.updated` of the day it reaches production; no mail beforehand. It can go in the same deployment as the rule or later.
- [ ] (owner) After the deployment, in phase 6's production re-read, look for the images whose note carries `own_form:` (only with a read query over `recipe_images.provenance`: no screen shows it) and look at them; one showing a second food with an allergen, "Withdraw".

## 1. Before switching `professional` on

**Code**
- [ ] **P0-1** — The client can switch the health line on and off from their profile without ending the link; every change leaves a row in the trail; switching it off closes the access on the next request. An end-to-end test that withdraws it mid-session.
- [ ] **P1-1** — The professional's acceptance: `PROFESSIONAL_AGREEMENT_VERSION`, columns on `professionals`, `ProfessionalGuard` requiring it, `POST /care/practice/agreement`, a screen in `/consulta` ([`analysis.md` § 11](./analysis.md#11-what-has-to-be-built-for-004-and-by-whom)). A test: a professional who has not accepted gets a 404 on every client route and on the purchase.
- [ ] **011 phase 6** — Before a real professional accepts the agreement: (backend) switching two-step verification on revokes the account's other sessions, with an end-to-end test — **done** in phase 6 (`168f12f0`, PR #214; [`dpia.md`](./dpia.md) R8 b); (backend + frontend) the agreement § 8 with the ⟦dos-pasos-obligatoria⟧ bullet and `PROFESSIONAL_AGREEMENT_VERSION = '1.1.0'` ([`textos/01`](./textos/01-acuerdo-profesional.md)) — **done** in phase 6 (`44924577`, PR #214). The box is ticked when the PR is merged and deployed.
- [ ] **P1-3** — The invitation page with the new texts; `CARE_CONSENT_VERSION = '2.0.0'`; no real link accepted at `1.0.0`.
- [ ] **P1-2** — The invitation mail with the art. 14 paragraph.
- [ ] The professional's welcome mail ([`textos/06`](./textos/06-correos.md) § B).
- [x] **P1-10 — closed** (2026-09-26): production uses no model (`stub`) and `0064`'s change has no Gemini (the key only allows Gemma 4 31B and DeepSeek V4.1 Flash, with no clinical-use clause; Gemma 4 is not the Gemini API). It reopens if `AI_PROVIDER=google` or a Google model comes back to the key.
- [ ] `HEALTH_CONSENT_VERSION = '1.1.0'` with the refined note (`05` § C).

**Texts**
- [ ] The professional's agreement and the practice terms in `practiceAgreement` (es and en), with `{name}`/`{email}` and no identity in the dictionary.
- [ ] The policy with the "Tu dietista en NutrIA" section and the split of responsibilities visible (art. 26.2, just in case).
- [ ] Terms of use § F and § G.

**Organisation**
- [ ] The owner checks every registration number in the relevant professional body's public register before granting, and notes the date of the check.
- [ ] **A breach procedure** — written in [`breach-procedure.md`](./breach-procedure.md). It is ticked when the owner has filled in, outside the repository, every ⟦…⟧ (§ 9: access to the AEPD's portal, the providers' accounts, the devices, the gateway, where the register lives) and has **signed and dated** it.
- [ ] An hour with the lawyer: points 1, 3 and 9 of [`analysis.md` § 10](./analysis.md#10-to-confirm-with-a-lawyer).

**The order of switching on** (the lead's decision, 2026-09-25: the switch first, the grants afterwards — the welcome mail links to `/consulta`, which only works with the switch on, and a switch with no grants shows nobody anything)

1. [ ] **A count of links on the old consent**: the lead runs in production, **read-only**, the number of `care_links` with `consentVersion = '1.0.0'` (by status: `active`, `paused`, `ended`). Nothing else is read from those rows.
2. [ ] **The owner decides about them** before switching on: a `1.0.0` link was accepted with an invitation that promised a control that did not exist (P0-1) and did not say the professional could write and retain plans (P1-3). The advisable thing is to end the `active`/`paused` ones (`endedBy = professional` if they are the owner's own tests) and invite again on version `2.0.0`; keeping an active `1.0.0` is processing health data on an uninformed consent. The `ended` ones stay: they are the proof of what was consented to. Note the decision and the date.
3. [ ] Everything above in this § 1 ticked, in particular P1-1: the agreement's acceptance has to be in production **before** the first grant exists, so that nobody sees a datum without having accepted.
4. [ ] **Switch the `professional` flag on** in `/admin`. With no grants, nobody sees anything new.
5. [ ] **Grant** to each professional, one by one, after checking their registration number (the "Organisation" box). The grant sends the welcome mail, and its link to `/consulta` leads to the agreement before anything else.

## 2. Before Stripe's *live* keys (Premium and the practice)

**Identity and registration**
- [ ] Tax registration (form 036) and, if it applies, RETA — with an accountant.
- [ ] `legalIdentity.ts` with `address`, `taxId`, `phone`, filled in by the owner; decided whether the address is the personal one or a professional one.
- [ ] **P1-7** — A `/aviso-legal` page published ([`textos/07`](./textos/07-aviso-legal.md)) and linked in the footer; a complaints channel by post, phone and electronically, with an acknowledgement and an answer within 15 days (TRLGDCU art. 21.2-3).
- [ ] Decided whether *Managed Payments* is used or not (Link as the seller), with the accountant and the lawyer; the texts use whichever variant applies.

**Consumer (Premium)**
- [ ] **P1-8** — Terms with the withdrawal right and the model form; a "Withdraw from the contract here" button for 14 days; an immediate acknowledgement by mail ([`textos/06`](./textos/06-correos.md) § C); a refund within 14 days.
- [ ] **P2-7** — An annual renewal notice 15 days beforehand (Stripe or a template of our own).
- [ ] **P2-6** — Checkout with acceptance of the terms (`consent_collection.terms_of_service`) and the terms and privacy URLs in Stripe's Checkout settings.
- [ ] The price shown before paying includes taxes and the total per period (TRLGDCU art. 97.1.e); Stripe's final button makes clear there is an obligation to pay (art. 98.2) — review the label with a free trial **[lawyer]**.
- [ ] **P2-2** — The version of the terms accepted at sign-up is stored (project 008, phase 7; [note D5](./2026-09-29-accepting-the-legal-texts.md) § 5), and the notice is visible beside the Google button on `/registro` and `/acceder`.

**Professional (the practice)**
- [ ] **P1-9** — The practice terms accepted before paying (the same screen as the agreement); `practice.planTrial` says that charging begins when the trial ends.
- [ ] Collecting tax details for invoicing (`tax_id_collection`) if the accountant asks for it.

**The hour with the lawyer**
- [ ] Points 4, 5, 6 and 7 of [`analysis.md` § 10](./analysis.md#10-to-confirm-with-a-lawyer).

## 3. With a date

- [ ] **2/12/2026** — AI Act art. 50.2: recipes marked as AI-generated in a machine-readable format (P2-8).
- [ ] **30 days after deploying the waiting-account alert with no address** (the `0029` amendment, 2026-09-29) — remove `GET /admin/activate` and `ActivationLink.ts` (no valid token is left), and the owner deletes from his inbox and his bin the old alerts that carry each sign-up's address (arts. 5.1.e and 32; [addendum](./2026-09-29-mail-to-the-owner.md#addendum-2026-09-29-afternoon-the-waiting-account-alert-resolved-and-a-fourth-alert) § 3).
- [ ] Every year, or on passing a few thousand accounts with health data — review the DPIA, the record of processing and the need for a DPO.

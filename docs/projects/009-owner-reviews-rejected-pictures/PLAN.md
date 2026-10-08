# Plan — Project 009: The owner reviews the pictures the judge rejected

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.

- **Status**: done — closed 2026-10-08 (owner's request; audit in 000-workspace/closing-audit-2026-10-08.md)
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md). Every acceptance criterion is mapped at the end of this file.
- **Routing profile**: `tiered`.
  - **Phase 3 runs at `quality-max` (opus @ high)**: accepting a picture against the
    judge is validation of model output and allergy-adjacent, one of the two floors that
    never move (`docs/reference/agent-team.md`). Its `invariant-reviewer` runs at the
    same level.

## Design summary

The architect's report
[`0005`](../../reference/architecture/0005-imagenes-fallidas-aviso-y-revision-a-mano-2026-09-30.md)
is the design; read its §§ 4–6 before any phase. Decision
[`0072`](../../decisions/0072-a-rejected-picture-waits-for-the-owner.md) amends `0066`.

- **No new state.** A `recipe_images` row stays `drawing`, `ready` or `failed`. A failed,
  unreleased row may carry one **candidate**: the last picture with a C2PA manifest that
  the judge rejected, kept as a pointer in `provenance` (jsonb). There is no migration.
- **A private store.** Candidates live in a second Vercel Blob store, private, in `fra1`,
  with its own token. The Blob path never leaves the API; the console reads the bytes
  through an admin-only route.
- **One clock.** A candidate can be reviewed while `now < lastAttemptAt + 7 days`
  (`PICTURE_COOL_OFF_DAYS`). A row with a candidate is not claimed for drawing. The 03:30
  cron deletes expired candidates by the paths stored in the database (no `list()`), and
  only then is the dish claimable again.
- **Two doors, both with C2PA.** A picture reaches a person because `judgePicture`
  accepted it, or because the owner accepted it by hand after seeing the allergens the
  judge flagged. The override is an audit row in the same transaction as the publication,
  and the bytes are checked for their manifest again at that moment. No automatic code
  publishes a candidate.
- **The mail.** It is a new owner alert, claimed hourly through `owner_alerted`, that
  counts what failed since the previous mail. It is attempted when any drawing ends and in
  the two daily crons, and its hook lives outside `modules/ai`.

## Phases

### Phase 1 — The mail when pictures fail

- [x] done — commit `abc0a90` ("The owner is mailed when dish pictures fail, and when their provider turns the key away", #172)
- **Dispatch**: opus @ medium — `/execute-project 009 phase 1`. Reviews:
  `invariant-reviewer`, and `legal` on the template. The `tests` agent writes the
  end-to-end cases.
- **Goal**: the owner hears within the hour that pictures failed, and why, without a name.
- **Scope**:
  - `packages/core/src/{controllers,repositories}/{Admin,Analytics}/**` (the counts reader);
  - `apps/api/src/modules/{owner-alerts,email,recipes,meal-plans,admin}/**`;
  - `apps/api/src/modules/ai/services/DishPicture.service.ts` — **only** to let a drawing
    report that it ended. It must not import `owner-alerts` or `core/controllers/Admin`;
  - `apps/web/src/i18n/dictionaries/*` (the mail kind's label on Sistema);
  - `apps/api/test/**`;
  - `docs/legal/**` (`legal`).
- **Steps**:
  1. **The reader.** In core, count `failed`, unreleased rows by `PICTURE_REASONS` whose
     `lastAttemptAt` is after the last `owner_alerted { kind: 'picture-failed' }`, or
     after 24 h ago if there is none (report § 4.1).
  2. **The alert.** Add the `OwnerAlert` type `picture-failures`: counts by reason with
     their Spanish labels, and one link to `/admin/catalogo?picture=failed`. It carries no
     dish name, id or model text. It is delivered through the existing claim, for one hour.
  3. **The payment alert.** A refused payment on the pictures' key is a released row with
     `payment_refused`. Alert on it under its own claim, for 6 h.
  4. **The hook, outside `modules/ai`.** Either `schedule(claim)` takes an "on end"
     callback, or the two callers that schedule a drawing (`MealPlans.service.ts`,
     `AdminCatalogue.service.ts`) go through a small service that draws and then tells
     `owner-alerts`. It never throws into the drawing and never delays a response.
  5. **The crons.** Both `/cron/rewrite-steps` and `/cron/reminders` call the same
     method, so failures inside an hour's claim go out with the next run. Each call keeps
     the existing catch and time budget.
  6. **Tests.**
     - The template spec covers the new alert: no `@`, no uuid, no sentinel, the dish-name
       sentinel included.
     - One failure sends one mail. Three within the hour send one, and the next call
       carries the other two.
     - A released row for the cap does not mail, and a refused payment mails once in 6 h.
     - The health-boundary spec stays green.
- **Acceptance criteria**: PRD 1, 9.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`.
  - The touched e2e suites in CI. The dev database may be over its quota, so run locally
    only if it answers.
  - `legal`'s note for the new mail is in `docs/legal/textos/06-correos.md`.
- **Amended while executing (2026-09-30, see LOG.md)**:
  - Step 1 adds no repository read: the counts come from the console's own
    `AdminRepository.failedPictures`, through `AdminAlertController.pictureFailures`.
  - Step 2: the claim of these two mails is dated by the caller's clock
    (`claimOwnerAlert(kind, since, at)`), so the instant a mail counted up to is the
    instant the next counts from. The mails have an `EmailKind` of their own,
    `owner-picture-alert`.
  - Step 3, by the owner's decision of 2026-09-30: a drawing given back for a rate limit
    (`model_refused`) is counted in the same mail and under the same 6 h claim as a refused
    payment, by reason. The PRD named only the refused payment.
  - Step 4 takes the first option: `schedule(claim, onEnd)`.
  - Step 5: on `/cron/reminders` the call runs after the expired invitations are
    deleted, and on both routes inside the 10 s budget.
  - Step 6: the end-to-end cases are a suite of their own, `picture-alerts.e2e-spec.ts`.

### Phase 2 — The candidate: keep, see, discard, clean

- [x] done — commit `fce954d` ("A picture the judge rejected waits for the owner, privately, for seven days", #173)
- **Dispatch**: opus @ medium — `/execute-project 009 phase 2`. Reviews:
  `invariant-reviewer`, `accessibility` with `/local-probe`, `legal`. — owner-gated:
  create the private Blob store in `fra1` and connect it to the API project (steps
  handed over at the start of the phase).
- **Goal**: a rejected picture waits seven days where only the owner can see it.
- **Scope**:
  - `packages/core/src/{entities,controllers,repositories,domain}/{DishPicture,Recipe,Admin,Audit}/**`;
  - `apps/api/src/modules/{ai,admin,recipes}/**`;
  - `apps/api/src/config/Env.validation.ts`, `turbo.json`, `apps/api/.env.example`,
    `docs/reference/deployment.md` (the new variable, all four);
  - *amended 2026-09-30:* `apps/api/src/shared/observability/ErrorReporter.ts` and its spec —
    the new token joins the secrets an error report is scrubbed of;
  - *amended 2026-09-30:* one sentence of `apps/api/src/modules/email/templates/OwnerAlert.ts`
    — the failed pictures' mail said a dish waits 7 days; with a candidate it is up to a day
    longer, so it now says "at least";
  - `apps/web/src/app/(admin)/admin/catalogo/**`, the dictionaries;
  - `apps/api/test/**`; `docs/legal/**` (`legal`).
- **Steps**:
  1. **The store.** Add `PictureCandidateStore` (put, get, del), with a private Vercel
     Blob implementation on its own token (`BLOB_CANDIDATES_READ_WRITE_TOKEN`, or the name
     Vercel gives a second store — confirm it when connecting) and an in-memory stub.
     Without the token it is unavailable and drawing behaves exactly as today.
  2. **Keeping.**
     - `DishPictureService` holds the last judge-rejected picture that carried C2PA in
       memory during the drawing.
     - It uploads it **only if the drawing ends failed**, to
       `dish-picture-candidates/<recipeId>/<version>-<random>.jpg`.
     - It stores the pointer and the judge's `extras` (catalogue slugs `mappedTo` and
       allergen keys `foreignAllergens`) in `provenance`.
     - A failed upload leaves the dish failed as today, with no candidate.
     - A `no_provenance` file is never uploaded. The row stores a closed diagnostic
       instead: content type, size and the three marks.
  3. **Respecting it.**
     - `claimPicture` and `unclaimable` exclude a row with a candidate pointer.
     - `completePicture`, `failPicture` and `releasePicture` no longer overwrite a pointer
       blindly.
     - `retryPicture` deletes the candidate's file after its claim.
  4. **Seeing it.**
     - `GET /admin/catalogue/recipes/:id/picture/candidate`, `@Roles('admin')`, answers
       the bytes with `Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff` and
       `Cache-Control: private, no-store`. It answers 404 when there is no reviewable
       candidate.
     - Recipe rows gain `pictureCandidate`: the allergen keys, the catalogue ingredients
       and when it expires. They never carry a path or a URL.
     - *Amended 2026-09-30:* `GET /admin/catalogue/recipes/:id`, `@Roles('admin')`, answers
       one recipe as its list row plus its ingredients. The console could read recipes only
       as a paged list, and a row carries no ingredients, so the review page of step 7 had
       nothing to read the dish from.
  5. **Discarding.** `POST …/picture/candidate/discard` deletes the file and the pointer,
     leaves `status`, `attempts` and `lastAttemptAt` alone, and writes `picture.discarded`
     in the same transaction as the pointer's removal.
  6. **Cleaning.** Inside `/cron/rewrite-steps`, before the sweep and with its own time
     budget:
     - read the rows whose candidate is no longer reviewable (expired, or the row is no
       longer `failed`);
     - `del()` their paths, then remove the pointers;
     - record the count in the `cron_run` for `rewrite`.
  7. **The review page**, without an accept button:
     - the picture large, titled as AI-generated;
     - the dish's ingredients;
     - the flagged allergens and catalogue ingredients;
     - when it expires;
     - discard and retry. The retry says it deletes the candidate.
     
     It is linked from Recetas.
  8. **The record and the end-to-end cases.** Update the picture notes in
     `apps/api/AGENTS.md` and the comments that say a rejected picture is never stored,
     and add `legal`'s flow row and checklist line. The `tests` agent covers the routes,
     the 404s, the DTO carrying no path, and the cleanup with an injected clock.
- **Acceptance criteria**: PRD 2, 3, 4, 7, 9.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`; the env spec.
  - The touched e2e suites, and CI.
  - `/local-probe` on the review page at 320, 390 and 1280 px, in light and dark, if the
    dev database answers; otherwise `accessibility` reviews statically and says so.
  - **Stop signal:** if Vercel cannot connect a second store under its own variable, or
    the private store needs a paid plan, stop and tell the owner.

### Phase 3 — Accept against the judge, and remove

- [x] done — commit `efba83b` ("The owner can publish a picture the judge rejected, and take it back", #174); confirmed by human on 2026-09-30
- **Dispatch**: opus @ high — `/execute-project 009 phase 3`. `quality-max`. Reviews:
  `invariant-reviewer` (opus, high), `accessibility`, `legal`. — human-verify: the owner
  accepts one candidate, sees it on the dish, and removes it.
- **Goal**: the owner can publish a picture the judge rejected, knowingly, and take it back.
- **Scope**:
  - `packages/core/src/{entities,controllers,repositories}/{DishPicture,Recipe,Admin,Audit}/**`;
  - `apps/api/src/modules/{ai,admin}/**`;
  - `apps/web/src/app/(admin)/admin/catalogo/**`, the dictionaries;
  - `apps/api/test/**`; `docs/legal/**` (`legal`); `docs/decisions/**`;
  - *amended 2026-09-30:* `packages/core/src/entities/Error/Error.ts` (the closed refusal
    codes of accept and remove), `apps/api/src/shared/filters/AllExceptions.filter.ts` (its
    fixed message for those codes said "retry") and one line of
    `apps/api/src/modules/email/templates/OwnerAlert.ts` (the label of `owner_removed`);
    and `packages/core/src/entities/AdminQuery/AdminQuery.ts` (the Recetas filter's new value).
- **Steps**:
  1. **Accept.** `POST …/picture/candidate/accept`, `@Roles('admin')`, rate-limited like
     the retry. It runs the six steps of report § 4.4, in order:
     1. the row is `failed`, has a candidate, and the candidate has not expired;
     2. the body repeats the allergen keys the console showed, and they match the stored
        ones;
     3. the bytes are read from the private store and `pictureMarks` runs again; without
        `jpeg` and `c2pa` it answers 409 `PICTURE_NOT_ACCEPTABLE`;
     4. the same bytes are put in the public store under the usual path, with the
        candidate's prompt version;
     5. one transaction holds the guarded `UPDATE` to `ready` (with `acceptedBy: 'owner'`
        and the overridden allergens in `provenance`) **and** the `picture.accepted` audit
        row. If nothing was updated, the route answers 409 and deletes the public file it
        just wrote;
     6. the private file is deleted.
     
     The month's cap does not hold an accept. With the `dishPictures` switch off, the
     route refuses.

     *Amended 2026-09-30:* the body also repeats the candidate's `expiresAt` as the console
     showed it, and an accept for another candidate is refused. With the allergen keys alone,
     a page left open on one candidate could publish the next one of the same dish — drawn
     by a retry, with the same flags — which the owner never saw (report § 4.4, step 2).
  2. **Remove.** `POST …/picture/remove` works only on a row with `acceptedBy: 'owner'`.
     The row goes to `failed` with the closed reason `owner_removed`, the public file is
     deleted, and `picture.removed` is written in the same transaction.
  3. **The page.** Add:
     - the accept button, with the warning that names the allergens;
     - the second confirmation step;
     - "Retirar" on a hand-accepted picture;
     - a count of hand-accepted pictures on Imágenes.

     *Amended 2026-09-30:* the one-recipe read carries the published picture's public
     address (`pictureUrl`), so the page can show the picture that "Retirar" takes back; and
     Recetas' `picture` filter gains a value that lists the hand-accepted pictures, so the
     count on Imágenes links to them and they can be found to be removed.
  4. **The record.** Decision `0072` is final, and `apps/api/AGENTS.md` states the
     two-door invariant. `legal` updates IMG-2 and decides on the privacy policy's
     sentence; if that sentence changes, `privacy.updated` changes with it.
  5. **Tests.**
     - Bytes without C2PA cannot be accepted by any route.
     - An accept without the allergens is refused.
     - A failing audit write leaves the picture unpublished.
     - The published file equals the candidate byte for byte.
     - Remove refuses a judge-accepted picture.
     - Every `ready` row with `acceptedBy: 'owner'` has its audit row.
- **Acceptance criteria**: PRD 5, 6, 8, 9.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`.
  - The touched e2e suites, and CI.
  - `invariant-reviewer` reports no P0 or P1.
  - **Stop signal:** if `legal` concludes that the override needs a change to a published
    text the owner does not want to change, stop and tell the owner.

## Hand-off

- **`0028` holds.** A picture, a recipe, its ingredients and its allergens name nobody.
  No new read touches `created_by`.
- **The provider's and the judge's own words never reach a screen or a mail.** Only
  closed reasons, allergen keys and catalogue slugs do.
- **The alert hook stays out of `modules/ai`** (`health-boundary.spec.ts` forbids
  `core/controllers/Admin` there).
- **Every admin mutation writes its audit row in the same transaction**
  (`apps/api/AGENTS.md` § Admin). `UNAUDITED` is for tests only.
- **The e2e exact key lists** (`RECIPE_KEYS`, `PICTURE_KEYS`, the `dish-pictures` list,
  the audit actions) are updated in the same change as any new field.
- **The dev database may be over its Neon quota.** Agents try one query. If it is
  refused, they do not loop; they say the cases were not run locally and let CI run them.
  Never run the whole e2e suite locally, and never two runs at once.
- **Worktrees have no `.env`.** Probes and dev-database scripts run only from the main
  checkout.
- **Production is read-only.** There is no migration in this project. The Blob store is
  the owner's to create.

## Out of scope

- Candidates for pictures the judge never saw, several candidates per dish, and stopping
  a drawing at the first rejection.
- Removing a picture the judge accepted.
- A dish's name or any model text in a mail.
- A line about picture failures in the 08:00 digest.

## PRD acceptance criteria → phases

| PRD | Phase |
| --- | --- |
| 1 The mail, hourly claim, counts by reason, payment alert, hook outside `modules/ai` | 1 |
| 2 The candidate kept privately, no path in any answer, 404s | 2 |
| 3 The 7-day clock and the cron cleanup | 2 |
| 4 Discard and retry | 2 |
| 5 Accept: two steps, C2PA re-checked, same bytes, audit in the transaction | 3 |
| 6 Remove, hand-accepted only | 3 |
| 7 Nothing changes without the store's token | 2 |
| 8 The invariant written down | 3 (drafted in `0072`) |
| 9 Admin routes, `0028`, legal, accessibility, reviewer, gate, cost | all |

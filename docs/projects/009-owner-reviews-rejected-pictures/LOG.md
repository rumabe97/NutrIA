# LOG — Project 009: The owner reviews the pictures the judge rejected

> **Purpose**: append-only execution record. One entry per phase (plus one per
> deviation): what happened, evidence it works, what changed against the plan. This is
> the file future agents read to learn "what was decided in phase X and why".
> **Audience**: humans and agents. **Committed**: yes — one commit per phase, made by
> the owner at the phase boundary. **Written by**: the executing agent, appending only.
> Write repo-relative: no absolute paths, no references to other private repos.

<!-- Entry format — copy per phase:

## Phase N — Title (YYYY-MM-DD)

- **Executor**: model + effort actually used.
- **Result**: done | partial | blocked.
- **Evidence**: verification commands run and their outcomes (test counts, build
  results). Claims without evidence don't belong here.
- **Deviations from plan**: none, or what changed and why — with the plan amended in the
  same change.
- **Decisions**: links to any docs/decisions/ records created.
- **Notes for the next phase**: anything the next executor must know.
-->

## Phase 1 — The mail when pictures fail (2026-09-30)

- **Executor**: the lead itself, Opus 5.5 at the session's effort — not the `opus @ medium`
  the plan routes. The phase was dispatched to the `backend` agent on opus (effort
  `medium`) and that agent ended three times on the provider's 529 "overloaded" before
  writing a line, so the lead did the core and API work in the main checkout. The
  end-to-end suite was written by the `tests` agent (its definition's model and effort) in
  its worktree, brought back and the worktree removed; a power loss cut that agent after the
  file was written, and the lead reviewed and finished it (lint, the README row, the
  reviewer's two fixes). `legal` and `invariant-reviewer` ran at their definitions' opus
  @ high. The two dictionary labels were added by the lead: no role agent was spawned for
  two lines.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`: 17 of 17 tasks
    green — core 1313 tests, api 1097 (88 suites), web 125, and ui 487 and database 43
    as dependencies.
  - `health-boundary.spec.ts` green, and it now also refuses an import of `owner-alerts`
    from `modules/ai`.
  - `sh scripts/check-leaks.sh` exits 0.
  - **The end-to-end suite did not run locally.** One attempt at
    `pnpm test:e2e -- picture-alerts` was refused at its first query: "Your account or
    project has exceeded the quota" (the dev database). Nothing was written. CI runs it.
  - **Its first CI run (pull request #172) was red, on the suites and not on the code**:
    the suite dated its starting `picture-payment-refused` claim two hours back, inside the
    six hours that claim lasts, so its own claim silenced the mail it waited for (two
    cases); and `owner-alerts.e2e-spec.ts` stood in for `OwnerAlertsService` without the
    new `pictureFailures`, so `/cron/reminders` answered 500 there (one case). The claims
    are now dated seven hours back and the stand-in has the method.
  - `invariant-reviewer`: no P0, no P1. Its four P2 and the P3 it asked a change for are
    below. `legal`: both mails can be sent; no P0, P1 or P2, and its note is entries M
    and N of `docs/legal/textos/06-correos.md`.
- **What shipped**:
  - `AdminAlertController.pictureFailures(now)`: dishes that failed and were not given
    back, by closed reason, since the last `picture-failed` mail (a day back without one);
    and dishes given back with `payment_refused` or `model_refused` since the last
    `picture-payment-refused` mail, by reason. A row given back by the cap is in neither.
  - `OwnerAlertsService.pictureFailures(now)`: the first claimed for one hour, the second
    for six. Two `OwnerAlert` types, `picture-failures` and `picture-payment-refused`.
  - `DishPictureService.schedule(claim, onEnd)`: the two callers outside `modules/ai` pass
    the alert in; what `onEnd` throws is dropped. Both crons call it too.
- **Deviations from plan** (the plan's phase 1 carries them as amendments):
  - **No new repository read** (step 1): `AdminRepository.failedPictures` already returns
    what is needed, and the console's own `countByReason` counts it.
  - **The claim is dated by the caller** (step 2): `claimOwnerAlert` takes an optional
    `at`. Without it the claim carried the database's clock and the rows the application's,
    and a failure could be counted in two mails when the two clocks disagreed. Every other
    alert claims as before.
  - **A mail kind of its own**, `owner-picture-alert`, so Sistema counts these mails apart;
    that is the dictionary label the plan's scope names.
  - **Order and budget in the crons** (step 5): on `/cron/reminders` the call is after
    `invitations.forget()` — `legal`'s P3: that deletion holds a deadline promised to other
    people — and inside the same 10 s budget the rewrite route already had, which the
    reminders route did not have (`invariant-reviewer`'s P3).
  - **Wording**, from `legal`: the payment mail says "Mientras dure, no se dibuja ninguna"
    and counts "Platos con el dibujo devuelto", which is what the number is.
  - **A rate limit is mailed too** (owner, 2026-09-30, after `invariant-reviewer`'s P2): a
    drawing given back for a 429 is `model_refused`, not `payment_refused`, and reached
    neither mail — a rate-limit storm would have given back every drawing in silence. The
    second mail now counts both reasons of the rows given back, by reason, under the same
    `picture-payment-refused` claim of 6 h; its subject and intro say "rechaza las
    peticiones", not "no puede pagar". The PRD named only the refused payment.
  - **`0072` gained a consequence**, outside this phase's listed scope and inside the same
    uncommitted record: the known gap below.
- **Known, and written down** (`invariant-reviewer` P2, accepted for this phase):
  - A drawing that ends in the same instant as the one that mails — dated before the count,
    written after it was read — is in no mail. It needs two drawings ending within one
    database round trip. It is on the console. Marking rows as told
    (`provenance.alertedAt`) would close it; not built.
  - A claim can stand without its mail if the function dies between the claim and the send;
    that hour's counts are then skipped. Very unlikely (a full 240 s drawing plus a mail
    server that hangs twice).
- **Decisions**: [`0072`](../../decisions/0072-a-rejected-picture-waits-for-the-owner.md)
  (already accepted; one consequence added). No new record. `docs/decisions/LOG.md` gained
  the line for `0072`, which the record lacked and which lands in this commit with it —
  outside this phase's listed scope, like the consequence.
- **Notes for the next phase**:
  - The failed pictures' mail says "Cada plato espera 7 días antes de volver a dibujarse
    solo" (`OwnerAlert.ts`, from `PICTURE_COOL_OFF_DAYS`). With candidates the wait is up
    to 24 h longer (`0072`): revisit the sentence, and tell `legal` (entry M).
  - `completePicture`, `failPicture` and `releasePicture` are untouched. The mail reads
    `provenance.reason` and `provenance.released` through `pictureReasonOf`; keep both
    when the candidate pointer joins `provenance`.
  - `schedule(claim, onEnd)` is the only thing `modules/ai` knows of the mail. The
    cleanup of phase 2 goes in `/cron/rewrite-steps` before the sweep; the watch and the
    pictures' mail already share a 10 s budget there — give the cleanup its own.
  - The e2e suite moves real rows of the shared database for its run (claims of the
    blocking kinds, failed pictures of the last eight hours) and puts them back in a
    `finally`. A phase 2 suite that reads candidates should follow it.
  - `picture-alerts.e2e-spec.ts` pins `AI_REWRITE_STEPS=false`: the rewrite client is the
    real one in every e2e application.

## Phase 2 — The candidate: keep, see, discard, clean (2026-09-30)

- **Executor**: the plan's `opus @ medium`, by role agents on opus at their definitions'
  `medium`: `backend` (core and API), `frontend` (the page, in three passes) and `tests`
  (the end-to-end cases, in two). Reviews by `invariant-reviewer`, `accessibility` and
  `legal` at their definitions' levels. The lead (Opus 5.5) brought each worktree's changes
  into the checkout, applied the reviewers' findings to core and API after `backend` had
  returned, and wrote the docs rows. A power loss cut the session once, after `backend`'s
  work was already in the checkout; nothing was lost.
- **Result**: done. **Not seen in a browser by anyone**, and the end-to-end suites have not
  run: see Evidence.
- **Owner-gated step, done**: the private store `nutria-picture-candidates`
  (`store_lAZVZUShjOwQhEUp`, private, `fra1`) was created by the lead on the owner's word,
  and the owner connected it to the API project in Production with the prefix
  `BLOB_CANDIDATES`. `BLOB_CANDIDATES_READ_WRITE_TOKEN` is there, sensitive; checked by
  name, its value never read. The lead did not connect it: through the API the variable
  would have taken the public store's name. The stop signal did not fire: a second store
  connects under its own variable and costs nothing more.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`: 17 of 17 tasks
    green — core 1384 tests, api 1155 (91 suites), web 125. `pnpm format`, the dead-code
    check and `sh scripts/check-leaks.sh` green. The env spec is among the api suites.
  - `health-boundary.spec.ts` green: `modules/ai` gained imports of `core/controllers/Recipe`
    and `core/entities/{Error,DishPicture}` only.
  - **The end-to-end suites did not run**: the dev database is still over its Neon quota
    (`accessibility`'s one probe attempt found it unreachable), so CI is the first run of
    `picture-candidates.e2e-spec.ts` and of the four suites moved with it.
  - **`/local-probe` did not run**, for the same reason: `accessibility` reviewed the page
    statically, as the plan allows, and says so. Touch targets, contrast and the 320 px
    reflow are read from the code, not measured.
  - `invariant-reviewer`: no P0, no P1; two P2, fixed (below). `accessibility`: passes on a
    static read; one P2, fixed. `legal`: no P0–P2; its notes are in
    `docs/legal/imagenes-de-platos.md` (§§ 1.6, 4.1, 4.3, 5) and `checklist-activacion.md`,
    with `textos/06-correos.md` (entry M), `registro-actividades.md` and `eipd.md` brought
    in line. It also corrected, in `analisis.md`, a row about `audit_logs` that had been
    untrue since project 008 — not this phase's, and in this change.
- **What shipped**:
  - `PictureCandidateStore` (private Vercel Blob, and a stub in memory). A drawing that ends
    failed uploads the last picture the judge rejected that carried C2PA, and stores its
    pointer and the judge's flags (allergen keys, catalogue slugs) in `provenance.candidate`.
    A file without a manifest is never uploaded; the row keeps a closed diagnostic.
  - A row with a pointer is not claimed for drawing. The owner's retry deletes the candidate.
  - `GET /admin/catalogue/recipes/:id/picture/candidate` (the bytes), `POST …/discard`
    (`picture.discarded`, in the pointer's transaction), and `pictureCandidate` on recipe
    rows. No path or URL leaves the API.
  - The cleanup inside `/cron/rewrite-steps`, on its own 8 s, recorded as `candidatesDeleted`.
  - The review page `/admin/catalogo/<id>/imagen`, linked from Recetas, with no accept button.
- **Deviations from plan** (each is in the plan as an amendment):
  - **A read the plan did not name**: `GET /admin/catalogue/recipes/:id`, one recipe with its
    ingredients. The console read recipes only as a paged list whose rows carry no
    ingredients, so the review page had nothing to show the dish from.
  - **Scope, two files**: `ErrorReporter.ts` (the new token is scrubbed from error reports)
    and one sentence of `OwnerAlert.ts` ("al menos 7 días": with a candidate the wait is up
    to a day longer). The same "at least" went into two strings of Imágenes.
  - **On a Recetas row that holds a candidate, the review link replaces the retry button**:
    that button would have deleted the candidate without saying so.
  - **A drawing the judge rejected that then ends on an unsigned file keeps the earlier,
    signed picture** as its candidate, with the diagnostic of the unsigned one and the
    reason `no_provenance`. That follows the plan's text ("the last judge-rejected picture
    that carried C2PA", "only if the drawing ends failed"); report `0005`'s state table read
    "none" for that row. The file kept passed the manifest check.
  - **From `invariant-reviewer`'s two P2**: the cleanup removes pointers past review even
    with the store's token gone, deleting nothing — otherwise those dishes would never be
    drawn again (PRD 7); and the API refuses to boot when the private store's token equals
    the public store's. From its P3: nothing that is not a candidate's path is asked of the
    store; the manifest is checked again at the only `put`; discard is limited to 30 an hour.
  - **`0072` reworded** (`legal`): "can be reviewed for 7 days; its file is deleted by the
    cleanup that follows, with no guaranteed instant", in the place of "kept for at most
    7 days". Report `0005` says the old sentence and is not edited.
- **Known, and written down**:
  - A candidate's file can outlive its 7 days: the cleanup runs nightly, takes 100 rows and
    starts no deletion in its last 4 s; and a file with no pointer (a retry whose deletion
    failed, a function that died between the upload and the row) is never deleted, because
    the store is never listed. They are private files nothing reads.
  - Between a candidate's expiry and the cleanup (up to a day), Recetas says the dish "is
    retried on its own on the next view"; it is not until the pointer is gone (`legal` P3).
  - The "nothing to review" state gives three causes (discarded, retried, its 7 days passed)
    and is also what a dish that never held a candidate shows (`legal` P3, no change asked).
  - The ingredient grams on the review page are for the whole recipe; the view carries no
    servings count, so the page says "for the whole recipe".
  - After a retry the page does not learn that a new candidate arrived: the owner reloads.
  - No console nav item is marked current on the nested page (`AdminNavList` matches the
    address exactly), and a Spanish dish name inside the English heading carries no `lang`:
    both P3, accepted by `accessibility`.
  - Every suite that calls `/cron/rewrite-steps` now runs the cleanup against the shared dev
    database, through a stub store: it removes the pointers of candidates already expired
    there. The new suite sets pre-existing pointers aside and restores them; `owner-alerts`,
    `text-cap` and `picture-alerts` do not.
- **Decisions**: [`0072`](../../decisions/0072-a-rejected-picture-waits-for-the-owner.md),
  one sentence reworded. No new record.
- **Notes for the next phase**:
  - **For the owner's phone, once deployed**: that VoiceOver reads "Imagen descartada." after
    a discard, and that the ingredients are read as a list (`accessibility`, device only).
  - The pointer already stores `model` and `promptVersion` for the accept; `candidateFlags`
    is what the owner is shown and what an accept must repeat.
  - `picture.accepted`, `picture.removed` and the reason `owner_removed` do not exist yet.
    `PictureCandidatesService` does not inject the public `PictureStore`: the accept is the
    first code that will hold both.
  - `keepingCandidate` lets the pointer a row already holds win over one being written; a
    `ready` row made by the accept must drop the pointer on purpose.
  - The review page's copy says the picture "is not published" and offers no accept; phase 3
    changes that copy, and `legal` returns to the privacy policy's sentence about the judge.
  - `frontend` found that a version token on `pictureCandidate` (not a path) would let the
    page key the image, so a second candidate is never shown from a stale one.


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
    blocking kinds, failed pictures of the last three hours) and puts them back in a
    `finally`. A phase 2 suite that reads candidates should follow it.
  - `picture-alerts.e2e-spec.ts` pins `AI_REWRITE_STEPS=false`: the rewrite client is the
    real one in every e2e application.


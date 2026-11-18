# LOG — Project 025: Anyone can open a practice

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

## Phase 1 — The texts and the documents, drafted before any code (2026-11-18)

- **Executor**: the `legal` agent on opus @ high (the only writer under `docs/legal/`); step 8
  applied by the planner.
- **Result**: done.
- **Evidence**:
  - New: `docs/legal/2026-11-18-anyone-can-open-a-practice.md` (the map, findings F1–F8,
    choices C1–C12, the `/privacidad` and `/condiciones` replacements, the words table, the
    disposition of every dictionary hit, the `PRODUCT.md` text, lawyer items M14–M17).
  - Amended: `docs/legal/dpia.md` (§ 9, DPIA 0.8: residual risk acceptable, no prior
    consultation), `docs/legal/record-of-processing.md` (rows 1, 3, 5 amended; 11, 12 new),
    `docs/legal/textos/01` (agreement 2.0.0 and the practice's screens), `textos/05` (consent
    3.0.0, re-consent, the illness rule's screens, § C bis), `textos/06` (§§ R–Z),
    `textos/02`, `textos/03`, `go-live-checklist.md` § 1 bis, `docs/legal/README.md`.
  - `pnpm check:leaks`: clean (its only output is the warning about uncommitted `.md` files).
  - Prettier was not run on `docs/legal/`: `pnpm format` runs per workspace package through
    Turbo and no package covers `docs/`, so there is no project command that formats it.
- **Owner's approvals**: every text of steps 1–8, the findings and choices C1–C11, by tapped
  options on 2026-11-18. C12 answered the same day by dropping the channel (below).
- **Deviations from plan**:
  - Step 8 (`PRODUCT.md`) was applied by the planner, not in phase 10: § Scope (legal file
    § 8.1) and § Users (§ 8.2), approved by the owner. Phase 10 no longer touches it.
  - **Two owner decisions**, recorded in [`decisions/LOG.md`](../../decisions/LOG.md)
    2026-11-18: (a) the college-issued e-mail channel is **dropped** (C12) — three channels
    remain, all read from the public register (an e-mail listed there, a letter, the owner's
    call). `0111` § 3 names no channel, so it is unchanged. (b) A real **suspension**: the
    console can suspend an account as a practitioner (immediate), a definitive close carries
    reasons and 30 days' notice, and a suspended, closing or closed account cannot reopen a
    practice (404). Hiding a profile and withdrawing a badge stay immediate.
  - **Plan amendments** (PLAN.md, and PRD scope 6, 9, 10, 11, 12, 13, 16 and criteria 3, 4,
    18, 19, 20, 22, 24, 25): phase 2 drops `college_email` and adds `practice_restrictions`;
    phase 3 sends the practitioner's re-check reminder (C5), keeps addresses out of the
    owner's alert (C8) and carries art. 14 and "not me" on every channel (F2); phase 5 moves
    `HEALTH_CONSENT_VERSION` to 1.2.0 with `health.consentNote` and the warning before saving
    (F1, C7), and sends the practitioner nothing distinct under the illness rule (F4); phase 6
    makes refuse and hide one act (F6) and builds suspend, close and lift, with a legal
    precondition for their two texts; phase 8 takes C1–C4; phase 9 gains the controls;
    phase 10 adds the English grep.
- **Decisions**: [`0111`](../../decisions/0111-a-badge-is-a-dated-check-and-the-link-decides-how-much-is-seen.md)
  (with the plan); the 2026-11-18 lines of [`decisions/LOG.md`](../../decisions/LOG.md).
- **Notes for phase 2**:
  - `channel` has three values: `register_email`, `post`, `phone`.
  - `practice_restrictions` cascades with the **account** (`user`), not with `professionals`,
    or a closed practice could be reopened.
  - The legal file's § 1 advises counting the links accepted at consent `2.0.0` read-only and
    ending the owner's test links before the switch; that is phase 10's checklist, not a
    migration.
  - Phase 6 cannot start until the `legal` agent has drafted, and the owner approved, the
    suspension and close statements and the agreement's § 13 clause.

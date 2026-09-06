# Plan — Project NNN: Title

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: a
> planner agent via `/plan-project`; approved by the owner before execution starts.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: draft | approved | in progress | done
- **Type**: standard | chore | research | recreation (see AGENTS.md § Projects)
- **PRD**: ./PRD.md (every acceptance criterion must map to at least one phase). Chore
  and research projects have no PRD — replace this line with a one-line justification.
  Research phases are *questions*; acceptance = answered with evidence.
- **Routing profile**: (the active profile from AGENTS.md § Model routing; per-phase
  models below must comply with it — deviations need a one-line justification)

## Design summary

<!-- The approach in one section: what gets built where, and why this shape. Link any
     new docs/decisions/ records this plan creates. -->

## Phases

<!-- One block per phase. Phases are the review/commit unit: small enough to review in
     one sitting, large enough to be coherent. Status is maintained HERE (single source
     of truth) — never duplicated into other files.

     The status line is a GFM checkbox so the docs app (/workspace) renders progress
     visually. Lifecycle: `- [ ] pending` → `- [ ] in progress` → `- [x] done`. When the
     owner commits a phase, the next /execute-project run backfills the commit onto the
     line: `- [x] done — commit `abc1234` ("subject")`.

     Dispatch is the ready-to-paste kickoff for a fresh session — model + effort + a
     THIN pointer. Never restate the phase spec inside it: the plan is the single copy.

     Gate annotations on the Dispatch line — executors stop instead of guessing:
       `— owner-gated: <action>`   the owner must PERFORM something (live migration,
                                   prod env var, external account); hand over exact steps.
       `— owner-approves: <what>`  the owner must DECIDE (ethics/legal/policy sign-off);
                                   assemble the evidence they need, then stop.
       `— human-verify: <what>`    acceptance needs manual human verification (visual/
                                   behavioral parity, E2E flow); record "confirmed by
                                   human on <date>" in LOG.md.

     Batch phases: a wide-but-shallow phase (N homogeneous items — ports, renames,
     conformance fixes) may carry an `Items:` nested checkbox list under its status
     line, checked per item and committed in owner-chosen sub-batches. Status still
     lives ONLY here — never mirror the item list into another doc. -->

### Phase 1 — Title

- [ ] pending
- **Dispatch**: fable | opus | sonnet | haiku @ low | medium | high | max — `/execute-project NNN phase 1`
- **Goal**: one sentence.
- **Scope**: the files/packages this phase may touch.
- **Steps**: numbered, concrete.
- **Acceptance criteria**: checkable statements; reference PRD criteria by number.
- **Verification**: exact commands (`pnpm lint`, `pnpm test`, targeted checks).

### Phase 2 — Title

<!-- ... -->

## Hand-off

<!-- OPTIONAL, committed: standing constraints every executor of this project must obey
     (hard rules, the verification loop, links to docs/reference/ playbooks). Committed
     because it is repo-relative and durable — machine- or session-specific kickoff
     prompts stay in docs/local/. Never restate phase specs here. -->

## Out of scope

<!-- Explicitly deferred work, each line pointing to ROADMAP.md or a follow-up project. -->

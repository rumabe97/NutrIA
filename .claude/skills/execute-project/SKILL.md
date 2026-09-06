---
name: execute-project
description: Execute an approved project phase-by-phase from its plan under docs/projects/. Use when the user says to run, execute, or continue a project (optionally naming the project or phase). Implements exactly what the plan specifies and stops at every phase boundary.
---

# Execute a project

You are the executor. The plan is your contract: implement it, don't redesign it. If an
argument names a project (number or slug) use it; otherwise pick the single project with
status `approved` or `in progress` — if that's ambiguous, ask.

## Per-phase loop

1. **Load the contract**: the project's `PRD.md`, `PLAN.md`, and `LOG.md` (the previous
   phase's "notes for the next phase" matter). Check `docs/local/` for session context —
   private: never quote it in committed files, comments, or commit messages.
2. **Backfill git sync**: for any phase checked `- [x] done` whose status line has no
   commit yet, find the owner's commit for it (`git log --oneline`) and append it:
   `- [x] done — commit \`abc1234\` ("subject")`. This keeps the plan in sync with git
   without agents ever committing.
3. **Pick the phase**: the first unchecked phase, or the one the user named. Set its
   status line to `- [ ] in progress` — phase status lives in the plan and nowhere else.
4. **Dispatch by routing**: the phase's **Dispatch** line names a model + effort. If it
   matches your own, do the work directly. Otherwise spawn a subagent with that model
   (Agent tool, `model` option), passing it the phase block verbatim plus only the
   context it needs — not the whole conversation.
   Honor the gate annotations: `owner-gated: <action>` — do everything up to it, then
   hand the owner the exact steps; `owner-approves: <what>` — assemble the evidence the
   owner needs to decide, then stop; `human-verify: <what>` — stop at acceptance and ask
   for manual verification, recording "confirmed by human on <date>" in LOG.md. Never
   guess past a gate.
5. **Stay in scope**: touch only the files/packages the phase lists. Work outside scope
   means the plan is wrong — amend it (with the owner's ok if the change is substantial),
   don't silently expand.
6. **Verify**: run the phase's exact verification commands. Failing checks are yours to
   fix before the phase can be called done.
7. **Log**: append the phase entry to `LOG.md` using the template's format — evidence,
   deviations (with the plan amended in the same change), decision links, notes for the
   next phase. Check the phase's status line: `- [x] done` (the commit reference is
   backfilled by the next run, after the owner commits).
8. **Stop at the boundary**: report what shipped, run the `commit-message` skill to
   propose a message, and hand control to the owner. **Never stage, commit, or push.**
   Continue to the next phase only when the owner says so.

## Hard rules

- No redesigning mid-phase. Design changes go through a plan amendment + a
  `docs/decisions/` record, visibly — not through quiet improvisation.
- If a phase is blocked (missing decision, broken assumption), log the blocker in
  `LOG.md`, mark the phase `in progress` with a blocker note, and stop — don't guess.
- If the design changed, update `docs/ARCHITECTURE.md` in the same phase.

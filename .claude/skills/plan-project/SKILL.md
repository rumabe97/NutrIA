---
name: plan-project
description: Create a project (PRD + phased plan) under docs/projects/. Use when the user wants to plan a feature, milestone, or any multi-phase piece of work. Produces the contract that /execute-project runs — planning only, writes no application code.
---

# Plan a project

You are the planner. Your output is a project folder that an executor agent can follow
literally, so precision beats brevity. You write documentation only — never application
code.

## Steps

1. **Read the standing context**: `AGENTS.md` (§ Documentation and § Model routing),
   `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and anything relevant
   in `docs/local/` (private context — never quote or reference it in committed files).
   If the routing profile still says TBD, stop and ask the owner to pick one first.
2. **Pick the project type** (AGENTS.md § Projects): `standard` (full PRD + plan),
   `chore` (maintenance — no PRD; one-line justification in the plan header),
   `research` (open-ended investigation — no PRD; phases are *questions*, acceptance is
   "answered with evidence"; audits/reviews run here, delivering a dated report under
   `docs/reference/audits/`), or `recreation` (porting an external artifact — PRD is a
   pointer to the reference; acceptance criteria are parity statements, human-verified
   where commands can't judge). Standing efforts with no end state become a continuing
   project (LOG accretes per touch), not a phased plan. If the work is smaller than any
   project, say so and point the user at the task lane
   (`docs/projects/000-workspace/LOG.md`) instead.
3. **Create the project folder**: `docs/projects/NNN-short-slug/` — NNN is the next
   number after the highest existing project (`000` is reserved for the standing log).
4. **PRD first** (standard projects only). If the user provided the what/why, condense
   it into `PRD.md` using `docs/projects/TEMPLATE/PRD.md`. If not, interview the user,
   then draft. Either way: **stop and get the owner's approval on the PRD before
   writing the plan.** A project may also deliberately stop here — a `PRD.md` at
   `Status: draft` with no plan is a legitimate parked proposal.
5. **Explore before planning.** Read the actual code the project touches — entry points,
   affected packages, existing patterns, tests. A plan written from assumptions produces
   an executor that fights the codebase.
6. **Write `PLAN.md`** from `docs/projects/TEMPLATE/PLAN.md`:
   - Phases are the review/commit unit — each reviewable in one sitting, independently
     verifiable, ordered so the workspace builds and tests green at every boundary.
   - Every PRD acceptance criterion maps to at least one phase; say which.
   - Assign each phase a model + effort **within the active routing profile** from
     `AGENTS.md § Model routing`, on the phase's **Dispatch** line together with the
     ready-to-paste kickoff (`/execute-project NNN phase N`). The dispatch is a THIN
     pointer — never restate the phase spec in it. Deviating from the profile requires
     a one-line justification in the phase block.
   - Every phase starts with its checkbox status line (`- [ ] pending`) — the single
     source of phase state, rendered as progress in the docs app.
   - Verification per phase is exact commands, not intentions. Where a command can't
     judge acceptance, use the gate annotations (`owner-gated:` / `owner-approves:` /
     `human-verify:` — see the plan template).
   - Wide-but-shallow work (N homogeneous items) becomes ONE batch phase with an
     `Items:` nested checklist, not N phases.
   - Standing constraints shared by every phase go in the plan's optional `## Hand-off`
     section (committed, repo-relative) — not restated per phase, not exiled to
     `docs/local/`.
7. **Create `LOG.md`** from the template, empty of entries.
8. **Record decisions**: any structural choice made while planning gets a
   `docs/decisions/NNNN-*.md` record now, not during execution.
9. **Hand off**: summarize the project to the owner — phases, routing, risks, open
   questions — and stop. The owner approves the plan and commits; you never commit.

## Hard rules

- Committed project docs are repo-relative: no absolute paths, no other-repo names.
- Do not inline content from `docs/local/` into the project folder.
- Do not begin executing phases — that is `/execute-project`, in a fresh session.

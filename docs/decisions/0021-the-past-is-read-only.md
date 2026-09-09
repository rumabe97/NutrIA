# 0021 — The past is read-only

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision — "continúa con el plan")

## Context

Every plan a person has had stays in the database (`0015` counts redos along
that chain; `0020` reads their marks), and the API could already serve any of
them by id, owner-scoped. Nothing on the screen led there: `/plan` showed the
active plan and the rest was reachable only by knowing an id. A swap already
refused a plan that was not active; a meal mark did not, so a person could
retroactively "eat" a plan from last month.

## Decision

**Earlier plans can be seen, as they were, and nothing about them can change.**

- `/plan/historial` lists every plan lived — active, completed, archived —
  newest first, dated, with the plan number and how it ended: current,
  finished, or replaced (the next lived plan began before it ended). Drafts,
  failures and plans still generating are not listed. `/plan/historial/:id`
  shows one, in the same browser as the living plan but with the marks shown
  and not offered: no tick, no redo, no "today". The living plan redirects to
  its own screen rather than appearing as a frozen copy.
- A meal's detail carries its plan and the plan's status. A meal of a plan
  that is no longer active has no status or swap controls and says it is
  shown as it was; the way back leads to that plan.
- The API enforces it. A status change on a meal of a plan that is not
  active is refused as a conflict (409), the same class as a swap on one; a
  meal that is not theirs remains not found. The past cannot be edited by
  calling the API directly either.
- The progress screen's fortnight cards open their plan; the living plan
  shows the way to the history when there is one.

## Consequences

- `PlanSummaryView` gains `replaced`, `MealDetailView` gains `planId` and
  `planStatus`. `LIVED_PLAN_STATUSES` lives with the plan entity so progress
  and history agree on what a fortnight is.
- A meal of the fortnight just ended can still be marked until the next plan
  is created — the plan stays active until then, which is when the check-in
  happens. Once the next plan exists, the previous one is closed for good.

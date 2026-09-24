# 0060 — A plan awaiting a professional's review waits in its own state

- **Status**: accepted
- **Date**: 2026-09-23
- **Project**: docs/projects/004-dietitian-workspace

## Context

For a client linked to a professional with review on, a generated meal plan must be
invisible to the client — dashboard, plan, shopping list and the offline copies — until the
professional publishes it. For everybody else, generation must behave exactly as today.

Every surface a client sees resolves the plan through `PlanRepository.findActive`
(`status = 'active'`), and the service worker only caches what those server-rendered pages
received. The one place a plan becomes visible is `PlanRepository.createPlanAtomically`,
which completes the previous `active` plan and inserts the new one as `active` in one
transaction.

## Decision

A new plan status, `pending_review`. When the client has an active link with review on,
`createPlanAtomically` inserts the new plan as `pending_review` and **leaves the previous
plan active**, so the client keeps the fortnight they have until the new one is published.
Publishing is one transaction: complete the previous `active` plan, set this one `active`.
A second partial unique index allows at most one `pending_review` plan per user. A
professional's regeneration of a pending plan replaces it, and is counted against the
client's allowances exactly as the client's own regeneration would be.

Every read path that does not go through `findActive` is taught the new state: the
check-in status (`PlanRepository.findChain`), the plan history, and a plan fetched by id
all exclude `pending_review` for the client, who gets a 404 for it like any plan that is not
theirs to see.

*Amended 2026-09-24 (project 004 Phase 5):*

- **A new generation replaces a pending plan.** This holds whoever starts the new plan and
  whether or not review is still on. The pending row is deleted, its job keeps
  `planId = null`, and the new plan takes its version number.
- **The deleted plan's redo still counts.** The new plan carries it in
  `generationMetadata.replacedRedos`, and the allowance counts a pending plan as the
  fortnight under way. Regenerating is never free.
- **Hidden from the client by default.** The client's reads exclude the state inside
  `PlanRepository` by default, not per route. That covers the four named reads and also the
  days, the meal detail, a swap, a meal's status and the shopping list's toggle.
- **A stranded plan costs the client nothing.** A pending plan counts toward the
  allowance only while it can still be published. That means an active link, a standing
  grant and the switch on; turning review off keeps it publishable. Once the link ends,
  pauses or loses its grant, the plan is ignored and the client's next generation replaces
  it at no charge. (Owner's decision.)
- **The professional generates only when there is a reason.** Either a plan is pending (a
  regeneration, counted as the client's own) or the client has no active plan. Any other
  request is a 404 and writes nothing, so a professional never replaces a fortnight under
  way. (Owner's decision.)
- **Only a professional who could publish it holds a plan back.** A plan waits only while
  the `professional` switch is on and the professional's grant stands.
- **The index condition lists the old values.** It is written as `status NOT IN (<the other
  values>)`, not `status = 'pending_review'`. Drizzle applies pending migrations in one
  transaction, and Postgres refuses an enum value used in the transaction that added it.
  A status added later cannot be listed in the migration that adds it, and one left off
  the list silently joins the unique index. So add the value in one release, and list it
  (or rewrite the condition as `= 'pending_review'`) in a migration of the next.

## Alternatives considered

- **A `visibleToClient` flag on the plan.** Lost because every existing read would have to
  add the flag to its `WHERE`, and the one it forgot would leak; a status the active reads
  already exclude protects them without a change.
- **Keeping the draft outside `meal_plans`.** Lost because swaps, the shopping list and
  plan history all operate on plan rows; a parallel store would duplicate all of it.

## Consequences

- `findActive` and everything built on it — the offline copy included — need no change.
- The unlinked path is byte-for-byte today's: the new branch runs only with an active link
  whose review is on, and the existing end-to-end suites prove the rest.
- The four reads that bypass `findActive` are named here; a new one must exclude the state
  too.

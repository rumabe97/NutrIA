# 0021 — The past is read-only

- **Status**: accepted, **amended 2026-10-19** (§ *Amended — and the past is premium*)
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
- The progress screen's fortnight cards open their plan, and its fortnight
  list links to the whole history; the living plan always shows the way to
  the history, even on a first plan — a door that appears only once there is
  something behind it is a door nobody learns exists.

## Amended 2026-10-19 — and the past is premium

**The owner, 2026-10-19**: *"solo los usuarios premium pueden ver sus planes
pasados, los free no"*. Everything above still holds — the past is read-only,
listed newest first, shown as it was — and **a free account now reads only the
fortnight it is living**.

### What changed

- **`/plan/historial` lists every fortnight for everybody.** A row a free
  account does not open keeps its dates and its number and is marked
  *premium*; it is not a link, and it is **not dropped**. A shorter list cannot
  say why it is shorter, and somebody whose past had quietly disappeared would
  have no way to tell a paywall from a deletion.
- **The API refuses, not only the screen.** `PlanController.getPlan`, `getDay`
  and `getMeal` throw `PremiumOnlyError('past_plan')` for a plan whose status
  `isPastPlan` — completed or archived — when the reader's tier does not open
  it. Answered **409 with `code: 'PREMIUM_ONLY'`**, like every other state a
  screen explains, and deliberately **not 404**: the plan is theirs, it is
  still there, and the same request succeeds the moment they are premium. A 404
  would teach a paying customer that their own past had been thrown away.
- **Ownership is still decided first.** A plan belonging to somebody else is
  not found, before any tier is read — a paywall must never confirm that
  another account's plan exists.
- **Three things are never behind it.** The **active** plan (every day, every
  meal, for ever), a plan **waiting for its day** (project 015 — that is the
  future, not the past) and one **under review** (`0060`, which has its own
  gate).
- **A professional reads their client's past whatever the client pays.**
  `CareController` asks as `reader: 'professional'`; the tier being read is the
  client's, and a dietitian who cannot see what their client was served cannot
  do the job the link exists for.
- **`/progreso` keeps every number.** Adherence, the meal counts, the check-ins
  and the weight chart are computed from the marks, not from the plans, so a
  free account loses none of its own progress — only the way into the plan
  behind each card, where the premium mark now sits instead of the link.
- **With the `premium` switch off, nothing is behind premium.** `tierOf`
  answers *free* for everybody while that switch is down, and it is an
  operational kill switch rather than a statement about a person — so this gate
  **fails open**: `pastOpensFor` opens the past to everybody when there is no
  tier to buy. That is the opposite of every spending limit in this codebase,
  on purpose. A quota that fails open gives away money; a visibility gate that
  fails closed hides a person's own fortnights from them because of a switch
  they cannot see.
- **The data is not touched.** Nothing is deleted for being on a free account,
  and nothing about safety, allergies or the quality of a plan moves
  (`Allowance.ts` § *What may be sold*, amended in the same change — the
  sentence *"what is sold is more of the thing that costs us money to produce"*
  did not survive this gate and says so now). The right of access is the
  privacy policy's route, which is unchanged; what is sold is the screen.
- **The terms say so, and one thing is still owed.** `/condiciones` § *El plan
  gratuito y Premium* now states that the free tier reads the fortnight it is
  living, whole and always, that the ones already ended are kept just the same,
  and that a copy of the data can be asked for at any time; `terms.updated`
  moves to 2026-10-19 with it. Those same terms promise an email to existing
  accounts before a material change applies — **that email is the owner's to
  send**, and `docs/legal/textos/03-condiciones-uso.md` § D, which the `legal`
  agent owns and a lawyer approves, still carries the sentence as it was.
  `TERMS_VERSION` stays at `2.0.0`: whether a change of this kind bumps it is
  that agent's call and not this one's.

### What this cost, measured before it shipped

Production on 2026-10-19, read-only: **8 accounts, 4 free and 4 premium**, 42
fortnights lived. The free accounts hold **5** of them, at most 2 each, so
**one account loses sight of exactly one plan**. And **there is no checkout
yet** — Stripe live is the roadmap's tanda C — so a free account that reaches
the mark cannot buy its way past it today: premium is granted from `/admin`.
The owner was told both before the change was written.

(who decided: the owner, 2026-10-19, told the blast radius above and that this
is the first gate in the product on **access** rather than on quantity; the
wording of the two screens and the fail-open behaviour of the switch are the
planner's, recorded here for him to overturn.)

## Consequences

- `PlanSummaryView` gains `replaced`, `MealDetailView` gains `planId` and
  `planStatus`. `LIVED_PLAN_STATUSES` lives with the plan entity so progress
  and history agree on what a fortnight is.
- A meal of the fortnight just ended can still be marked until the next plan
  is created — the plan stays active until then, which is when the check-in
  happens. Once the next plan exists, the previous one is closed for good.

# 0097 — What each subscription allows is data the owner edits, and the code is its default

- **Date**: 2026-10-12
- **Status**: accepted
- **Amends**: [`0042`](./0042-what-a-paid-account-may-spend.md) (its numbers become a default and
  a fallback rather than the law) and [`0044`](./0044-a-fortnight-rebuilt-for-an-event.md)
  on one figure. Leaves [`0015`](./0015-one-redo-a-fortnight-five-swaps-a-plan.md)'s reasoning
  in force. The case for each number is
  [`docs/reference/marketing/tiers-and-allowances.md`](../reference/marketing/tiers-and-allowances.md).

## Context

The paywall was four numbers compiled into `Allowance.ts`, so moving one was a deploy. The
owner asked that all of them be configurable from the console — "cuántos usos tiene cada
subscripción, ya sea free o premium" — and the `marketing` agent audited what they should be
before anything was built.

Two of its findings bear on this record rather than on the numbers. **Premium's ten events
could never be reached**: a load is one to three days and two events may not share one
(`overlaps`), so a fortnight admits **seven**. `0044` named that rule as the bound and then
wrote ten. And **no account has ever reached any limit** — 8 accounts, 35 plans, two events
declared in the product's whole history — so nothing here is felt by anybody today.

## Decision

**The four limits become rows an admin may write, and the code's table becomes the default
and the fallback.** A limit nobody has moved has no row at all.

Three kinds, because the console may not treat them alike. The boundary is one sentence:
**a limit may be console-editable when its worst case is a bill, or a worse product for the
person who chose it; it must be code-bound when its worst case is a plan that misses its
macros for everybody on the tier.**

- **Commercial** — swaps, events, mid-plan events. None spends money, none changes how a
  plan is built. Move them freely inside their ceiling.
- **Financial** — redos. The only one that spends real money, and it spends the month's
  *pictures*, from a 10 $ pot shared by everyone: measured, a generation draws 7.1 pictures
  at 0.237 $, against roughly 0.01 $ for the model call that writes it. `0042` priced this
  one three days before pictures existed. Editable, never without the warning that the
  budget is one budget.
- **Structural** — nothing yet, and the kind exists for the recurring fixed meal that is
  coming. **A structural limit's ceiling is the number the code ships**, so the console may
  only lower it: raising it spends the promise that every day of every plan lands inside 5%
  on all four macros, the console cannot know what a raise costs, and the failure is not an
  error but a day delivered with an advisory, for everybody on that tier, found later. A
  raise is a measurement and a deploy, never a click.

**The ceilings, each with its reason**, because a ceiling with nothing beside it is how ten
events were written for a fortnight that holds seven: **7** events (an eighth cannot have a
loaded day), **28** swaps (a fortnight's lunches and dinners; past that the limit names
nothing), **min(events, 7)** mid-plan (a fortnight cannot be rebuilt for more events than it
holds), **6** redos (a typo guard — one account at that limit eats half the month's picture
budget). Floor **0** everywhere: zero on free makes a capability premium-only, which is a
real lever, and zero on both is a kill switch.

**Four rules govern the reading, and they are the product content of this change.**

1. **A bad row reads as the code's default, never as the ceiling.** Missing, unparseable,
   fractional, below the floor and above the ceiling all mean the same thing: nobody has
   validly moved this. Clamping up would turn a typo into a grant. It is `0042`'s rule —
   the fallback is always the smaller number — applied to numbers.
2. **Premium is never below free**, refused on write *and* resolved on read, because a pair
   that was valid when written is invalidated by moving the other half afterwards and
   nobody would be there to see it.
3. **Then the pairs that depend on each other**: mid-plan events cannot exceed that tier's
   own events, resolved after rule 2.
4. **A limit put back to what the code ships has its row deleted**, not stored as a number
   that happens to match — otherwise a tier stays pinned to today's figure the day a release
   changes it. And a lowered limit never withdraws a spend: `countDown` already clamps, so a
   cut applies to the next plan rather than taking back what a screen promised.

**One number moves, and it is a correction rather than a cut**: premium events 10 → 7.
Nobody loses anything they could reach, and the table stops promising what it cannot give.
**Every other number ships exactly as it is today** — moving those is a product decision with
a sequencing question attached (cutting the free tier before a checkout exists makes the beta
worse with no way to upgrade), and the console is where the owner will make it.

## Alternatives considered

- **Ship the new numbers the audit proposes.** Rejected for now: the mechanism and the
  numbers are two decisions, and the second has an open question that is the owner's. With
  the console, every commercial cut is a second's work and reversible.
- **Store them in `app_settings`.** It holds a boolean. A switch read wrong is on or off and
  the registry says which way is safe; a number read wrong can be *larger*, which is a grant
  nobody made — so the numbers get their own table and their own resolution.
- **An enum for the key in the database.** Rejected: removing a limit would then be a type
  rebuild sequenced against a build that can still write the old value, where with `text` it
  is a code-only change. Nothing is lost, because the resolution is already stricter than a
  constraint could be.
- **Clamping an out-of-range value instead of refusing it.** A clamp answers a number nobody
  asked for, and the person who typed it reads the clamped figure back as though it were
  their decision.

## Consequences

- The paywall is now readable in one place by somebody who is not a programmer, with the
  cost of each unit and the reason for each bound beside it.
- `limitsOf` and the plan screen's context read the stored rows **defensively**: a read that
  fails answers "nobody has moved anything", so a table that is missing — a migration not yet
  run, a build rolled forward past one — costs a person their overrides and never their plan.
  The console's own read is not wrapped: there, a failure is the news.
- The four standing functions take resolved limits rather than a tier, so the domain does no
  I/O to answer what somebody may spend.
- **A changed limit is audited** under its own action, `setting.allowance_changed`, with the
  value before and after. Moving a limit is not the same event as throwing a switch.
- **Before Stripe is live this is the owner's to move freely; after it, it is not.** A
  premium allowance becomes a term of a continuing contract the moment somebody pays for it,
  and lowering one under a paying subscriber is not a settings edit. `legal` should read this
  before live keys — likely answer: up any time, down only at renewal and with notice.
- The thing this record does **not** solve, and which the audit found matters more than any
  number in it: the 10 $ picture budget is global, buys about 42 generations a month, and
  roughly 18 accounts of ordinary use empty it — after which nothing is drawn for anybody.
  Metering pictures per account, or raising the budget, is worth more than every limit here.

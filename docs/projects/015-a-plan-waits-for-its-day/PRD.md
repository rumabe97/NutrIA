# PRD — Project 015: A plan waits for its day

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's brief of 2026-10-01; approved by the owner.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: done — closed 2026-10-08 (owner's request; audit in 000-workspace/closing-audit-2026-10-08.md)
- **Roadmap item**: none — asked by users through the owner. It replaces project 013's item 9.

## Problem

A plan starts the moment it is generated, so a person cannot shop for it first. The typical case: the current fortnight ends on Sunday, the person generates the next one on Friday, shops on Saturday, and wants it to begin on Monday.

Today that is impossible for two reasons:

- generating closes the running plan at once (`PlanRepository.ts` ~160-167);
- only one plan may be `active` (`meal_plans_one_active_per_user`).

Project 013's simple version (choose a date only when no plan runs) was built, but the owner wants the choice **always** offered.

## Outcome

- **Every generation asks** "¿Cuándo empiezas?", from today to today + 7.
- **A plan whose day has not come waits as `scheduled`.** The running plan stays active and untouched until the day before. On the start day, the scheduled plan becomes active and the old one completes.
- **The shopping list of the next plan** is available as soon as it is generated.
- **Allowances stay honest.** A start inside the running fortnight cuts it short and counts as a redo. A start after it ends is the next fortnight and is free, as today.

## Scope

**In:**
- the `scheduled` plan status;
- activation by a daily cron and on read;
- the start-date rule and its allowance meaning;
- generation storing the date;
- the web chooser always shown;
- /inicio and /compra showing the next plan;
- vacations shifting a scheduled plan;
- regeneration of a scheduled plan;
- tests, evaluator untouched, docs.

**Out:**
- professionals scheduling (care path unchanged: their plans start on publish as today);
- more than one scheduled plan;
- notifications about the start.

## Acceptance criteria

1. **The date.**
   - `POST /meal-plans/generate` takes `{ startDate? }`, which defaults to the person's today in their profile timezone.
   - Outside today to today + 7, or malformed, it answers 422 `INVALID_INPUT`.
2. **Its meaning,** with A being the running plan:
   - **A start after A's end** is the next fortnight: free.
   - **A start on or before A's end** cuts A to end the day before the start, and counts as a redo against the redo allowance, as today.
   - **A start of today** behaves exactly as today does.
   - **With no running plan**, any start is a new fortnight.
3. **Scheduled.**
   - A plan whose start is after today is saved as `scheduled`. A stays `active`.
   - There is at most one scheduled plan per user, guarded by a partial unique index. Generating again replaces it, and that counts as a redo.
   - On its start date, the scheduled plan becomes `active` and A becomes `completed` with `completedAt` = the day before. This is done by a daily cron at 00:05 in Europe/Madrid and also on every read of the active plan, so a missed cron cannot strand a person.
4. **Everything that reads dates holds.**
   - Vacations shift a scheduled plan's days.
   - Events load the scheduled plan's days by date.
   - Meal marks, swaps and mid-plan rebuilds act on the active plan only. Swaps are also allowed on a scheduled plan, which is the person's own coming fortnight.
5. **Web.**
   - `/plan/generando` always offers the date chips (Hoy … +7). The default is the day after the running plan ends, or today if none runs, and each chip says whether it is free or uses a redo.
   - `/inicio` keeps showing today's plan, with a card "Tu próximo plan empieza el {fecha}" linking to its shopping list and days.
   - `/compra` can switch between the current and the next plan.
   - With no active plan and a scheduled one, `/inicio` says when it starts.
6. **Tests.** Unit tests for the rule, activation (cron and on read), cutting short, the redo count, and replacing a scheduled plan. e2e: next fortnight scheduled while A runs, activation on its day (with the date moved in the test), the redo when cutting short, and the 422s.
7. **Docs.** A decision record and `ARCHITECTURE.md`. Project 013's item 9 is marked superseded.

## Open questions

- None. **Resolved 2026-10-01 (owner):** the next fortnight is free, cutting the running plan short counts as a redo, and replacing a scheduled plan counts as a redo.

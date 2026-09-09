# 0020 — Progress is what was logged, shown

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision — "continúa con el plan")

## Context

By this point the product keeps three kinds of fact about how it is going:
weights (`0018` and the dashboard tracker), a mark on every meal — eaten or
skipped (`0016`) — and one check-in per fortnight (`0018`). Nothing showed them
together. The dashboard has the latest weight and a fourteen-reading sparkline;
the check-in shows adherence for one plan, once; the rest was in the database.
The navigation deliberately had no "progress" entry, because a destination that
leads nowhere is worse than none.

## Decision

**A progress screen that reads what was logged and estimates nothing.**

- `GET /progress/summary` returns the weight line (every reading, oldest first),
  the goal's starting and target weights, the change since the start and over
  the last fortnight, and one entry per fortnight *lived* — a plan that was
  active, completed or archived; drafts, failures and plans still generating
  are not fortnights — with how its meals were marked and what the check-in
  said.
- Meals are counted only for days that have arrived. A meal three days from now
  is neither eaten nor missed, and counting it would make a plan going well look
  half-abandoned on its first morning.
- A plan *replaced* — the next plan began before it ended, by a redo or a
  regeneration — counts only the days before its successor, and one replaced
  before a single meal was marked was never a fortnight and is not shown. The
  owner's own history had three plans for one fortnight, two of them never on
  the table. Cards are dated, not numbered, for the same reason; the plan
  number stays in small print.
- Adherence keeps the check-in's definition — meals marked eaten over meals
  with any mark — so the number here and the one on the check-in never
  disagree. When nothing was marked the screen says so; it does not show 0 %.
- The chart is on a real time axis. A month without a reading is a gap, not a
  step. Fewer than two readings is a number, not a line, and the page says
  what would make it one.
- Logging stays on the dashboard, where it is done often; the screen links
  there. Both dictionaries carry the copy; `/progreso` joins the bottom bar
  between shopping and profile, in the order the loop runs.

## Consequences

- No new data is collected and no migration runs: two repository reads
  (`mealMarksByPlan`, `findAll` check-ins) and one controller method.
- The weight line reads the last 400 readings — more than a year of daily
  weighing — after which the oldest fall off the chart, not out of the database.
- A fortnight's card shows what its check-in said only when there was one;
  an active plan shows meals and nothing else, which is the truth of it.

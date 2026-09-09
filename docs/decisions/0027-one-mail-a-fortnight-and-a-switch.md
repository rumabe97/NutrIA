# 0027 — One mail a fortnight, and a switch to stop it

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

The loop closes with a check-in (`0018`): the fortnight ends, the person says
how it went, and the next plan is built from that. Nothing told them the
fortnight had ended. The card appears on the dashboard for whoever opens the
app that week; for everyone else the plan quietly runs out and the next one is
built from the same answers as the last.

Mail now works (`0019`), and the platform already runs crons for the two AI
sweeps.

## Decision

**One reminder, on the day the check-in comes due, and a switch on the profile
that stops it.**

- A daily sweep (`/cron/reminders`, guarded by `CRON_SECRET` like the others)
  finds accounts whose active plan has reached its last day and who have not
  checked in. It sends one mail and writes a `notifications` row **after** the
  provider accepted it. The query excludes anyone with such a row since their
  plan began, so a successful send is never repeated and a failed one is tried
  again tomorrow — there is one fact, not a flag that can disagree with a log.
- Four more conditions, each of them a way of not sending a mail somebody would
  resent: the account is activated (`0017`), the plan is active, no check-in
  exists for it, and they have not turned reminders off.
- **The mail carries no health data.** Not the plan, not a dish, not a weight.
  It sits in an inbox a provider scans and on a lock screen anyone can read, so
  it says only that something is waiting; the thing itself is behind a login.
- The switch ships with the mail, not after the complaints:
  `notification_preferences` already keyed the answer per kind and channel, and
  the profile now has it. Absent means on, which is the column's own default.
- Bounded at forty a sweep. Each account is due at most once a fortnight, so
  this caps a burst rather than throughput, and keeps a free sender's daily
  allowance out of reach.

## Consequences

- With no `SMTP_HOST` the sweep sends nothing and says so once — the same
  unconfigured state as the reset mail.
- A person who never opens the app still gets one nudge a fortnight and can
  stop it in one click. Nobody gets two.
- The other notification types the schema reserves — `plan_ready`,
  `shopping_ready`, `meal_reminder`, `plan_failed` — stay unused. Each would
  need its own case for existing at all, and "we could" is not one.

## Amendment — 2026-09-09

The schedule is removed. The owner asked for every cron to be off while the
project runs on free tiers, and this one went with the other two even though it
spends nothing from the AI provider — a scheduled call still costs a function
invocation, and one exception is a thing to remember rather than a rule.

The sweep, the switch and the mail are unchanged and tested; nothing calls them
until an entry goes back into `apps/api/vercel.json` (§3b of the runbook). Until
then the check-in card on the dashboard is the only nudge, as it was before.

# 0071 — The service records what leaves no row, and the console watches it

- **Status**: accepted
- **Date**: 2026-09-29
- **Project**: [docs/projects/008-console-watches-quality-and-spend](../projects/008-console-watches-quality-and-spend/)
- Extends [`0033`](./0033-count-the-rows-log-only-what-leaves-none.md) (the event list)
  and [`0068`](./0068-the-admin-is-a-console-of-pages-that-still-reads-nobody.md) (the
  console's pages).

## Context

[`0033`](./0033-count-the-rows-log-only-what-leaves-none.md) closed the event list to what
leaves no row: `session_started`, `swap_requested` and `ai_call`. The console of `0068`
reads it. Several things the owner now wants to see leave no row, and one existing signal
is wrong:

- `session_started` fires at sign-in, and a session lasts 30 days and renews with use.
  "Active" has therefore meant "signed in", not "used".
- `ai_call` records what each call cost, but not which feature made it: plan dishes,
  swaps, or the nightly step rewrites.
- A cron's run and a mail's success or failure only reach a log.
- A plan's quality against the owner's bar exists in memory while the plan is generated,
  then is kept only as sentences.
- Admin actions are not recorded at all, although `audit_logs` exists and is empty.

The architect's report
[`0004`](../reference/architecture/0004-consola-seguimiento-2026-09-29.md) measured each
point. The owner approved all of them on 2026-09-29, with D1–D4.

## Decision

- **The closed event list grows by four, and splits in two.**
  - Product events: `session_started`, `app_used`, `swap_requested`. Only these are
    charted as what people do (Embudo).
  - System events: `ai_call`, `cron_run`, `mail_sent`, `owner_alerted`. They carry no
    user and are read only by the pages that account for the system.
  - `app_used` is written when a session is renewed by use (Better Auth's
    `session.update.after`), at most once a day per person. "Active" means
    `session_started` or `app_used`.
  - `cron_run` carries the job and its counts. `mail_sent` carries the template and
    whether it left, never the recipient. `owner_alerted` carries only the kind of alert.
  - Each still obeys `0033`: it records something no row already says.
- **`ai_call` gains `feature`**: `plan`, `swap` or `rewrite`. It says which part of the
  service spent the money, and nothing about who asked.
- **A plan records its own quality** in `meal_plans.generation_metadata.quality`, as
  counts only. It holds days, days in band, misses per macro, event days in band,
  advisories by kind, days the energy floor bounded (from project 008's phase 5, once its
  definition is confirmed), and whether the plan fell back to the library.
  - It holds no target, no figure and no event name.
  - The console reads it aggregated over a period, never per plan and never per day, and
    never on an addressed row.
- **Admin actions are recorded in `audit_logs`,** in the same transaction as the action.
  - The account acted on is `subject_user_id`, a foreign key `ON DELETE SET NULL`: the
    trace outlives the account without naming it (owner, D3).
  - No request body and no IP address are stored.
- **The console gains pages that watch rather than show:**
  - Catálogo › Calidad, Planes › Calidad;
  - Personas › Retención, Personas › Consentimientos;
  - Ajustes › Sistema, Ajustes › Registro de acciones;
  - notifications, and the spend of text models against a monthly cap.
  `0028` holds on every one of them: counts and totals; addresses only where `0068`
  already has them (accounts, inbox, professionals, the generation log) and in the audit
  log, which is about what the owner did — and about the one thing the service does in his
  place, opening an account automatically when its address is confirmed.
- **The text-AI cap shows and warns; it never stops a plan** (owner, D1).
  - `AI_TEXT_MONTHLY_CAP_USD` is set to 5 USD on production (owner, D2; unset shows no gauge), counted over the UTC month
    like the pictures' cap.
  - At 80 % the nightly step rewrite does not start.
  - The wall that stops spending is the OpenRouter key's own monthly cap (`0064`). The
    app's cap is never set above it.
- **The owner is told by mail, not by a new cron** (owner, D4).
  - A daily digest, only when there is something to say, runs inside the existing
    `/cron/reminders`.
  - Two immediate alerts, three failed generations in a row and spend crossing 80 % or
    100 % of a cap, are each de-duplicated for 6 hours by `owner_alerted`.
  - The mail carries numbers and links, never anybody's address or text.

## Alternatives considered

- **A table per new signal** (runs, mails, quality). Each duplicates a place that
  already exists: `analytics_events` for what happened, `generation_metadata` for what a
  plan knows of itself.
- **Measuring "active" by a deduplicated write in `/users/me`.** It works, but puts a
  write on the hottest route. The session hook adds no request. It stays the fallback if
  a test shows the hook does not fire on renewal.
- **Scoring plans after the fact from `meals`.** Swaps rewrite meals in place, so that
  would measure the plan as it is today, not as it was generated, and it would read
  content.
- **Stopping generation at the cap.** It ends the same way the key's wall does (a plan
  from the library, against `0013`), and it trusts a sum that can run short, since some
  calls record no cost. The owner chose to warn.
- **An hourly cron for alerts.** It would wake Neon 24 times a day, roughly +15 CU-h a
  month out of 100.

## Consequences

- Every figure built on the new records is useful only from the day it is deployed.
  Their pages say from when.
- "Active people" and "last activity" change meaning on deployment. "Cómo se cuenta"
  dates the change.
- Recording acceptance of `/privacidad` and `/condiciones` is `legal`'s decision (D5). If
  it is taken, it is recorded and counted within project 008.

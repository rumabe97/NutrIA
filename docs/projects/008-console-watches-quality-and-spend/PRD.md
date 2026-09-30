# PRD — Project 008: The console watches quality and spend

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's request and decisions of 2026-09-29 and the architect's
> report [`0004`](../../reference/architecture/0004-consola-seguimiento-2026-09-29.md) —
> approved by the owner before the plan is written.

- **Status**: delivered — closed by the owner, 2026-09-29
- **Roadmap item**: [`docs/ROADMAP.md`](../../ROADMAP.md) — the follow-up to
  [`007-admin-console`](../007-admin-console/), asked for by the owner on 2026-09-29

## Problem

Project 007 gave the owner a console that shows the service as it is. It cannot yet tell
him when something goes wrong, and it cannot show what the service does not record.

- **Data problems are found by hand.** On 2026-09-28, AI dishes of about 2,600 kcal a
  serving turned up only because someone read a catalogue table (`0070`). Nothing watches
  for the next one.
- **Plan quality is invisible in production.** The owner's bar is every day, all four
  macros, within ±5 %. Today it is measured only when `plan-evaluator` is run by hand, on
  fixed profiles.
- **Spend has no ceiling in the app.** Pictures have a monthly cap and a gauge. Text
  generation, plan dishes and the nightly step rewrites have neither, and the console
  cannot tell which of them spent what.
- **Admin actions leave no trace.** Activating an account, changing a tier, granting a
  practice or flipping a switch is not recorded anywhere, although `audit_logs` exists.
- **"Active" does not mean active.** `session_started` fires at sign-in, and a session
  lasts 30 days and renews with use. So 007's "Personas activas" and "Última actividad"
  count sign-ins, not use, and retention cannot be measured at all.
- **Failures are silent.** A cron that stops, a mail that does not leave or a streak of
  failed generations only reaches a log. The owner learns about it by chance.
- **Consents and notifications cannot be counted**, although their versions and sends are
  stored.

## Outcome

- **The console surfaces problems before the owner does.** A catalogue quality page
  lists what should be zero, such as dishes past the serving bound, uncostable macros,
  meal servings out of range and dishes that fit no meal. Each count links to the rows. It
  also shows what to look at, such as dishes over their meal's cap and `oversized`
  rejections per day.
- **Every generated plan records its own quality score**, as counts only: days, days in
  band, misses per macro, event days in their band, advisories by kind, days the energy
  floor bounded, and fallbacks. The console shows it aggregated per period, never per
  plan and never per day.
- **Text-AI spend has a monthly cap of 5 USD,** configurable, with a gauge in IA y modelos
  and a tile in Resumen.
  - The cap shows and warns. It never stops a plan from being generated (owner, D1).
  - Beside the spend, a count of calls that recorded no cost, because they make the figure
    a minimum.
  - Spend is split by feature: plans, swaps and the step-rewrite sweep.
  - The sweep does not start once 80 % of the cap is spent.
- **Every admin action is recorded** in the same transaction as the action: activate,
  change tier, grant or revoke professional, mark or reopen a message, flip a switch, send
  a test push, plus the automatic activation. A page lists them.
  - When an account is deleted, its rows stay without the link to it (owner, D3).
- **"Active" means used.** A new `app_used` signal (at most one a day per person) joins
  `session_started`. Resumen, Embudo and Cuentas read both, and "Cómo se cuenta" dates the
  change.
- **Retention cohorts:** of each period's sign-ups, how many are active 1, 2 and 4 weeks
  later.
  - With few people, counts rather than percentages, and monthly groups.
  - An approximate version ("did something") is available from day one.
- **The step-rewrite sweep is visible:** its state (current, pending, refused, given up)
  and, from deployment, what each night did and what it cost.
- **The owner gets mail, never noise** (owner, D4).
  - A daily digest, only when there is something to say. It covers waiting accounts, new
    inbox messages (their number), failed generations, spend against the caps, what
    should be zero, failed mails and crons that did not run.
  - Two alerts arrive at once: three generations failing in a row, and spend reaching 80 %
    or 100 % of a cap. Neither repeats within 6 h.
  - The mail carries numbers and links only, never anybody's address or text.
- **Notifications:** push subscriptions, reminders sent per channel (both channels are
  recorded when both are used), and "a check-in within 3 days of a reminder" in place of
  opens, which nothing records.
- **Consents:** for each versioned consent (profile, health data, care link, the
  professional's agreement), how many accounts hold the current version and how many an
  older one.
- **A Sistema page:**
  - the commit in production;
  - the prompt, steps and consent versions;
  - the caps;
  - each integration (mail, owner address, push keys, cron secret, Sentry, pictures, the
    rewrite sweep) as configured yes or no, never a value;
  - each cron's last run;
  - a warning when a cron has not run for more than 26 hours.

## Scope

**In**

- The new records:
  - four analytics events — `app_used`, `cron_run`, `mail_sent` and `owner_alerted` — and
    a `feature` tag on `ai_call`;
  - `quality` in `meal_plans.generation_metadata`;
  - admin actions in `audit_logs`, with one migration: a `subject_user_id` foreign key
    `ON DELETE SET NULL`, and an index on `created_at`.
- Splitting the closed event list into product and system events, so Embudo's events
  chart shows product events only.
- The console pages and sections:
  - Catálogo › Calidad;
  - Planes › Calidad;
  - Personas › Retención and Personas › Consentimientos;
  - Ajustes › Sistema and Ajustes › Registro de acciones;
  - the notifications and spend additions;
  - Resumen's new tiles.
- The daily digest and the two immediate alerts, inside the existing `/cron/reminders`,
  with no new cron.
- The 007 findings:
  - "active" counts sign-ins (P2);
  - the generation log reads the whole `generation_metadata` (P3): select only the allowed
    keys;
  - `docs/reference/deployment.md` still says Vercel Hobby (P3; Pro since 2026-09-26).
- The legal decision **D5**: `legal` decides whether sign-up must record a versioned
  acceptance of `/privacidad` and `/condiciones`. If it must, recording it and counting it
  on Consentimientos are in this project.

**Out**

- Stopping plan generation at the cap (D1 = display and warn). The real wall stays the
  OpenRouter key's own monthly cap (`0064`), which the app cap never exceeds.
- Opens of reminders: a tracking pixel or beacon (ePrivacy, and Gmail intercepts it).
- Ingredients without allergens or countries as a console check. Seed tests guard them
  in CI, and an empty country list means "everywhere".
- Push alerts to the owner. Mail was chosen.
- Anything the console never shows (`0028`): a person's plan, meal, profile, health value
  or allergy, and any series per plan or per day that could name one person.
- Billing and Stripe figures (payments deferred), CSV export, the OmniRoute gateway's
  health, and Neon or Vercel quotas read from inside the app.

## Acceptance criteria

1. **Recording.** The four new events and `feature` are written with the properties
   listed in the plan, and none of the system events carries a user.
   - `app_used` is written at most once a day per person. A test proves the session hook
     fires on renewal; if it does not, the plan's fallback is used instead.
2. **Plan quality.** A plan generated after phase 1 carries `quality` with counts only
   (`days` = its length).
   - No console response carries `quality` on an addressed row: an e2e test fails if
     `/admin/generations` contains it.
   - The console shows it only aggregated over a period.
3. **Audit.** Each of the eight admin mutations and the automatic activation leaves
   exactly one `audit_logs` row, written in the same transaction as the action (e2e).
   - Deleting an account leaves its rows with `subject_user_id` null.
   - No row carries a request body or an IP address.
4. **Active.** Resumen's active people, Embudo's activity and Cuentas' last activity read
   `session_started` and `app_used`. "Cómo se cuenta" says so and gives the date of the
   change.
5. **Catalogue quality.** The "should be zero" counts are 0 on the dev library, except
   ones known and explained in the LOG. Every count links to the filtered rows, and every
   figure is computed with the app's own helpers, never a second formula.
6. **Spend.**
   - With `AI_TEXT_MONTHLY_CAP_USD` set, IA y modelos shows a gauge for the UTC month and
     Resumen shows a tile.
   - The uncosted calls are shown beside it.
   - Spend is split by feature.
   - The sweep does not start at 80 % or more.
   - Unset, there is no gauge and nothing changes.
7. **Retention.** Cohorts are drawn as counts with their sizes, never as a percentage of a
   cohort under about 20 people, with no link from a cell to an account. The approximate
   version is labelled as such.
8. **Sweep, crons and mail.** Sistema shows each cron's last run, and the digest flags a
   cron silent for more than 26 hours. The sweep's state comes from `steps_version`, and
   its nightly history from `cron_run`. Failed mails are counted per template.
9. **Alerts.** At most one digest a day, and only when there is something to report.
   Three consecutive failed generations, and spend crossing 80 % or 100 % of a cap, mail
   the owner at once, never twice in 6 hours. No mail contains an `@` or anybody's text (a
   template test), and `legal` has reviewed the template.
10. **Notifications and consents.** Sends are counted per channel, with both channels
    recorded when both are used. "Check-in within 3 days" replaces opens. Each versioned
    consent shows the current and older versions' counts. If `legal` asks, the legal texts'
    acceptance is recorded and counted.
11. **Sistema.** The response contains only booleans, versions, dates and a commit hash,
    never a configuration value (a test).
12. **The 007 findings are closed:** "active" as in criterion 4; the generation log
    selects only the allowed metadata keys in SQL; `deployment.md` says Pro.
13. **Across the project:**
    - Embudo's events chart shows product events only.
    - Every new route is `@Roles('admin')` and gives a 404 before validation.
    - Both dictionaries match, and `check:leaks` passes.
    - The accessibility agent passes every new page with no sideways scroll at 320, 390
      and 1280 px, in both themes.
    - The workspace gate is green at every phase boundary.
    - The owner's cost stays 0 €, with no new cron and no new table.

## Open questions

- None for the owner. D1–D4 were decided on 2026-09-29. D5 is `legal`'s to decide, inside
  the plan, and the plan covers either answer.

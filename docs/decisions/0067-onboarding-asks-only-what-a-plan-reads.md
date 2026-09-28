# 0067 — Onboarding asks only what a plan reads

- **Status**: accepted
- **Date**: 2026-09-28

## Context

`0025` set the rule: a question whose answer changes nothing is not asked. Onboarding had
drifted from it. Traced field by field on 2026-09-28:

- **Read by nobody**: breakfast style, portion preference, working-hours notes, the
  free-text custom goal. Stored and never read again; since prompt 4.0.0 no typed text
  reaches the model, and no screen shows them back.
- **One soft line in the prompt, nothing deterministic**: wake and sleep times, training
  days and time (the whole `lifestyle` step, read only by `dayShapeOf` as "Their day: …"),
  cooking budget and cooking frequency (`BUDGET:` and `- Cooks:`). None of them filters,
  sizes or schedules anything; the scheduler, portion sizing and validation never saw them.
- **Read in code**: name, country (catalogue), birth date, sex, height, weight, activity
  (targets), goal type, target weight and pace (targets, progress), meal shape (scheduler
  weights, `0036`), maximum cooking time (library filter and prompt), cuisines, likes and
  dislikes, allergies, intolerances and way of eating.

The country question was also broken: asked on the first screen and never sent.

## Decision

The owner chose the strict cut. Onboarding keeps only the third list: the `lifestyle`
step is removed (nine screens → eight), how-you-eat keeps only the meal shape, cooking
keeps only the maximum time, and the goal loses its free text. The fields leave the
domain (schemas, views, prompt) at once; prompt 4.3.0 → 4.4.0 drops the three soft lines.
The about-you step now sends the country.

Step keys are not renamed or added: `RequiresOnboarding` checks every user's completed
steps, and a new key would lock out everyone who finished. Rows that still hold
`lifestyle` (every finished account) are read with unknown steps dropped and the current
step clamped.

What was already stored goes too (owner, same day: "limpiar esas columnas"): migration
`0043` empties the nine preference columns and `goals.custom_goal` for every account. The
columns themselves stay for this release, so the old API running during the deploy still
finds them; the next release drops them through `migration-reviewer`.

The "Other" goal goes as well (owner: "quitar objetivo otro"). It computed exactly as
maintenance and, without its free text, asked nothing of its own. `0043` turns every stored
one into maintenance, so no one's targets move; a `custom` written by the old API during the
deploy is read as maintenance. The enum value stays in Postgres until the column drop.

The landing's promise that the plan knows your working week ("los martes llegas tarde") is
rewritten: nothing asks it any more.

Found by the real-model comparison before merging: without the line about their day, the
model labelled every dinner it was asked for as `supper`, and the pool dropped them; on
Gemma 4 31B, 38 of 144 dishes claimed a meal other than the one asked for (4.3.0: 1 of 138),
some with no meal at all. Each pool request asks for one meal, so the builder keeps the
model's claim when it names that meal (a claim of lunch and dinner for a dinner stays both,
as before). When it does not, the dish is tried as the meal asked for alone; only if its
ingredients do not belong there does the model's own claim stand, exactly as before this
decision — so a dinner labelled `supper` is kept as a dinner, a real lunch dish returned to
a breakfast request is still kept as a lunch (CI's `localisation` suite caught an earlier
version that dropped it), and nothing is ever added to what the model claimed. The
ingredient check (`fitSlots`) decides every step: the code, not the model, says what a
dish was written for (`0004`); a stew asked for at dinner still stays out of dinner. Three runs each, 8 requests
a run: valid dishes 90.6 % (4.3.0 with every answer filled) against 89.6 % (4.4.0), none
lost to the meal label; three real fortnights each side, 14 of 14 days within 5 %.

## Alternatives considered

- **Keep sleep, training, budget and frequency as hints to the model** — they shaped at
  most the wording of the fresh dishes, and the prompt changes either way; asking eight
  more questions for that fails `0025`.
- **Remove only the four dead fields** — leaves a whole screen whose answers nothing
  decides.
- **Drop the columns in the same change** — a migration runs during the API build while
  the old API still serves; stopping reads first is the safe order.

## Consequences

- Shorter onboarding (about 30 inputs → about 18), less personal data held and sent to the
  model (RGPD art. 5.1.c); the legal texts in `docs/legal/` are updated with it.
- Anyone who later wants a plan to follow training or waking hours has to build a rule that
  reads them, and ask the question again in that same change.
- Follow-up owed: the next release's migration dropping the nine preference columns,
  `custom_goal` and the `custom` goal-type value. Postgres cannot drop an enum value, so
  that migration recreates the type — and must first run
  `UPDATE goals SET type = 'maintenance' WHERE type = 'custom'` again, for rows the old API
  wrote during this deploy or after a rollback. There is no undo for `0043` in the
  repository: only a Neon point-in-time branch from before the build, inside the
  history-retention window.

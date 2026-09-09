# 0018 — The fortnight closes with a check-in: weight in code, words to the model

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's request)

## Context

The roadmap's third step is "the loop closes": progress, a fortnightly check-in,
and a next plan that reads the previous fortnight. The dashboard has promised a
"próxima revisión" date since project 002 and nothing answered it. Meals are now
marked eaten or skipped ([`0016`](./0016-one-round-per-slot-in-parallel.md)), so
the fortnight has a record to close on.

One gap surfaced on the way: the targets were computed from the weight given at
onboarding, whatever had been logged since. A weigh-in changed the chart and
nothing else.

## Decision

**Once per plan, from its last day: five answers. Each one changes the next plan
in a way the person can see, and no answer is a restriction.**

- **Weight** goes to the progress log, and the targets now read the latest
  logged weight before the onboarding one — from any weigh-in, not only this.
- **Portions** ("me quedaba con hambre" / "era demasiado") move the calorie
  target 5 % through the same override an edit by hand uses, clamped to the
  same bounds. The confirmation says "de 2.200 a 2.310 kcal".
- **Difficulty, satisfaction, and their own words** reach the next plan's prompt
  as guidance — bounded like every free text, and never as a rule. Allergies and
  intolerances change only through the profile, where code enforces them; a
  check-in that accepted "ahora no puedo comer gluten" as text would be a
  restriction the safety gate never saw.
- The screen leads with how the fortnight went — meals marked eaten over meals
  marked at all — because the number is theirs and the check-in should not feel
  like a form.
- Due from the latest plan's last day, done once; the dashboard shows it first
  when due, and after a plan ends the next-plan card says whether it was done.
  Not required to generate the next plan: a gate would cost more plans than it
  would improve.

## Consequences

- The next plan differs from the last in three traceable ways: targets from a
  current weight, a calorie nudge the person asked for, and a prompt that knows
  what they said. Prompt version 2.6.0.
- A person who never weighs in keeps their onboarding weight; nothing changes
  for them until they do.
- `check_ins` gains no columns; the kickoff schema already had them. The
  ratings use 1–3 and 1–5 scales stored as small integers; the answers are named
  in code, not in the table.

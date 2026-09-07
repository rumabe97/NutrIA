# PRD — Project 003: Trust, depth and polish

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project` — approved by the owner before the plan is written.

- **Status**: approved
- **Roadmap item**: [`ROADMAP.md`](../../ROADMAP.md) — a new milestone, *"a product a
  stranger would trust"*, sitting between the plan engine and meal interaction.

## Problem

The engine works, and the product around it does not yet deserve confidence.

The clearest evidence came from the owner reading his own review screen: **4,099 kcal a
day, for losing weight**. The correct figure was 2,449. A signed pace field overrode the
goal, and the number sat there looking authoritative while the entire generation pipeline
faithfully planned food for it. That defect is fixed, but its lesson is not yet built in:
the product presents derived numbers as facts, offers no way to say "that is wrong", and
never explains where they came from.

Around that sit four other gaps, each of which makes the product feel unfinished or
unsafe:

- **Nothing ever indicates work in progress.** There is not a single `loading.tsx` in the
  app. Every plan, profile and dashboard page is server-rendered on demand, so navigating
  leaves the previous screen frozen until the response lands. It reads as broken.
- **Onboarding can be abandoned and is never resumed.** A user can leave halfway, return,
  and land on a dashboard with no plan and no route back into the flow they were in.
- **The profile is too shallow for who is using it.** Allergies outside the EU-14 list
  cannot be expressed at all. Medical conditions and medications — the things that most
  change what someone should eat — are not collected. Supplements, which anyone training
  seriously already takes, have nowhere to go.
- **It exists only in Spanish**, in a domain where the interface, the food names and the
  shopping list all have to speak the same language as the user.

And the surface itself is thin: uneven spacing that leaves text crowding the element above
it, misalignments, and almost no motion, so the product reads as a competent prototype
rather than something built with care.

## Outcome

When this ships:

- A user sees their daily targets presented as **an estimate, with its basis explained**,
  and can **correct them** — within the same floors that already stop a plan becoming a
  starvation diet.
- A user who leaves onboarding half-finished is **returned to where they stopped**, and
  cannot reach the rest of the product until the profile is complete enough to plan from.
- **Every request shows that it is working.** Navigation, form submission and generation
  all have a visible state; nothing ever looks frozen.
- A user can **name an allergy that is not on our list**, and is told honestly which parts
  we can guarantee and which we cannot.
- A user can record **conditions, medications and supplements**, and the product uses them
  as constraints and as a reason to recommend professional supervision — never as
  something a model reasons about medically.
- The whole product — interface, ingredients, recipes, shopping list — **works in English
  as completely as in Spanish**.
- The interface has **a spacing scale that is actually applied**, aligned elements, and
  motion that makes transitions legible rather than decorative.

## Scope

**In:**

- Targets shown as indicative with their derivation explained; a bounded manual override
  (floor, and the 25% deficit / 20% surplus caps) with a visible marker when a target is
  the user's rather than ours.
- Onboarding: server-enforced gating on the routes that need a complete profile, resume
  on return, and a clear exit that says progress is kept.
- Loading and error states for every route and every mutation, plus optimistic feedback
  where the outcome is known.
- Free-text allergens: matched against the catalogue where possible and enforced
  identically; stored with an explicit warning where not, and blocking unknown ingredients
  in generated dishes.
- Conditions, medications and supplements: collected with explicit consent, stored as
  special-category data, mapped to deterministic exclusions where a mapping is well
  understood, and used to surface a supervision recommendation. **Never sent to a model
  for medical reasoning.**
- Internationalisation: `es-ES` and `en-GB`. UI strings, per-locale ingredient names,
  recipes generated in the user's language, and the generation prompt rewritten in English
  regardless of the user's locale.
- A design pass: an audited spacing scale, alignment fixes, and a motion system covering
  page transitions, onboarding step changes, and list and card entrances — all respecting
  `prefers-reduced-motion`.

**Out** — deferred, each with its own home:

- Meal interaction and replacement *(003 in the old numbering → now 004)*.
- The interactive shopping list *(005)*.
- Progress tracking and check-ins *(006)*.
- The AI assistant *(007)*.
- Any clinical feature: dosing, interaction checking, condition-specific medical advice.
  Explicitly and permanently out.
- Locales beyond Spanish and English; the architecture must not assume two.

## Acceptance criteria

1. **Targets are presented as estimates.** Every screen showing a calorie or macro figure
   labels it as indicative and links to a plain-language explanation of how it was derived
   (equation, activity factor, goal, pace).
2. **Targets can be corrected, within bounds.** A user can set their own kcal and macros;
   values below the calorie floor or beyond the deficit/surplus caps are refused with the
   reason. An overridden target is visibly marked as theirs, and generation uses it.
3. **A pace cannot contradict a goal.** Regression cover for the 4,099 kcal defect: for
   every goal, a pace of either sign produces a target on the correct side of maintenance.
4. **Onboarding resumes.** Returning after leaving lands on the first incomplete step with
   every previous answer intact.
5. **Onboarding is enforced server-side.** Plan generation and the plan routes refuse a
   profile missing required steps, and the web app redirects rather than showing an empty
   screen. The check is the API's, not the client's.
6. **Nothing looks hung.** Every route has a loading state; every mutation shows progress
   on its control; every failure shows a message and a way forward. Verified per route.
7. **Free-text allergens are honest.** An entry matching a catalogue ingredient is enforced
   exactly as a listed allergen. An unmatched entry is stored, displayed with a clear
   statement that it cannot be guaranteed, and prevents generated dishes from using
   ingredients we cannot check.
8. **Health data is handled as health data.** Conditions, medications and supplements are
   collected behind explicit consent, never logged, never included in a model prompt, and
   removed with the account.
9. **Conditions produce constraints, not advice.** A recorded condition maps to dietary
   exclusions only where the mapping is well established, and otherwise only raises a
   recommendation to consult a professional. No screen states a medical conclusion.
10. **Supplements are recorded and shown**, with their protein contribution counted toward
    daily totals where the user supplies it — and excluded from the shopping list, which is
    for food.
11. **The product works fully in English.** With `en-GB` selected: every UI string, every
    ingredient name, every generated recipe and the entire shopping list are in English.
    No Spanish leaks through.
12. **The generation prompt is in English** for every user, in every locale, and the
    generated recipe text is in the user's language.
13. **Spacing is systematic.** No component uses a hardcoded spacing value; the audit
    covers every module and the rhythm between a heading and its content is consistent
    across screens.
14. **Motion is present and respectful.** Page transitions, onboarding step changes and
    list entrances are animated; every one is disabled under `prefers-reduced-motion`; none
    delays interaction.
15. **Generation never fails on our own arithmetic.** A profile that passes onboarding
    always produces targets that a plan can satisfy — targets are validated at the point
    they are computed, not discovered to be impossible three stages later.

## Resolved at approval

*(2026-09-07, owner)*

- **Sequencing**: trust → depth → internationalisation → design. The design pass runs
  last so every screen is styled once, in its final shape and in both languages, rather
  than restyled after each addition. It defers the most visible work, which is a real
  cost accepted deliberately.
- **Project 002 first**: generation is retried against the corrected targets before this
  project's plan is written, since the 4,099 → 2,449 change may resolve the protein
  overshoot on its own and decide whether a cross-day repair pass is needed at all.

## Open questions

None. The four design decisions this project rests on were taken with the owner before
planning: free-text allergens are matched-and-warned; conditions and medications are
constraints and supervision triggers only; targets are overridable within existing bounds;
and the catalogue gains per-locale names while recipes are generated per locale.

# Product

> **Purpose**: what we're building, for whom, and why. Product definition only — the
> stable truth every project builds toward.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: the owner
> decides, agents draft and update on request.
>
> Confidentiality line: this file holds the product *definition* (problem, users, scope,
> UX principles). Market strategy, positioning, moats, revenue plans, and competitor
> analysis do NOT belong here — they live in `docs/local/STRATEGY.md`, which is never
> committed. Litmus test: would it hurt if a competitor read it? Then it's strategy.

## Problem

Eating well is not a knowledge problem for most people; it is a **decision-fatigue**
problem. They know roughly what they should eat and still stand in front of the fridge at
nine at night with nothing planned, nothing bought and no energy left to decide. The tools
that exist make this worse: calorie trackers hand the planning back to the user, and
one-shot "AI diet generators" produce a beautiful fourteen-day PDF built around a person
who has no allergies, unlimited time and no Tuesday.

The gap is not generating a plan. It is generating a plan someone can actually follow, and
then **changing it when it turns out they didn't**.

## Users

**The primary user** is an adult who wants to eat better toward a concrete goal — lose
weight, gain muscle, or simply stop improvising — and who cooks for themselves most days.
They are not a nutrition hobbyist. They will not log macros. They want to be told what to
eat and what to buy, and they want the answer to fit a real week.

What they need, in order:

1. To be told what to eat today, without thinking about it.
2. To be told what to buy, once, for the whole cycle.
3. To be able to say "not this" and get something else that still fits.
4. To see whether it is working, without it becoming a second job.
5. To never be served something that could hurt them.

**A secondary user** is the same person two months in, whose circumstances have changed —
new job hours, an injury, a holiday — and who needs the plan to move with them rather than
be abandoned.

**Not a user (v1):** anyone requiring clinical nutrition — diagnosed metabolic disease,
pregnancy, eating-disorder recovery, paediatric feeding. The product must recognise these
and point to a professional rather than serve them badly.

**On the health data the product now collects.** Since project 003 a user may record
conditions, medications and supplements, under an explicit versioned consent, and delete
them on their own at any time. That does not move the line above; it makes the line
legible. What is recorded produces exactly three things: a curated dietary exclusion in the
one case where avoiding the substance *is* the definition of managing the condition
(coeliac disease → gluten, per [`0008`](./decisions/0008-condition-exclusions.md)), a
suggestion the user confirms where it is a matter of degree (lactose intolerance), and a
persistent recommendation to have the plan reviewed by a professional. Medications produce
nothing at all — they are stored so the user can see what they told us and so the
supervision notice appears, never mapped to a dietary rule, never placed in a prompt, and
without a dose field, because dosing is out of scope and a field nothing may read should
not exist. Supplements contribute a protein figure that is *displayed* beside the targets
and never deducted from what a plan must supply.

## Scope

**v1 includes** the full loop, and nothing outside it:

- Account, onboarding, an editable profile.
- A personalised **14-day plan**: every day, every meal, with recipes and quantities.
- Completing, skipping, favouriting, disliking and **replacing** meals.
- A **shopping list** generated from the active plan, consolidated and grouped.
- Progress tracking: weight, adherence, and how the fortnight actually felt.
- A **biweekly check-in** that feeds the next plan.
- Plan history, kept forever and never overwritten.
- A nutrition-only AI assistant with access to the user's own plan.
- Spanish first, architected so English can follow.

**Deliberately excluded from v1:** barcode scanning, photo food logging, restaurant
databases, macro-by-macro manual logging, social features, coach marketplaces, wearable
integrations, payments.

## Experience principles

1. **Answer one question: "what do I eat, and what do I buy?"** Every screen either
   answers it or gets out of the way. If a screen exists to display data rather than to
   settle a decision, it should not exist.
2. **The safe thing is not negotiable.** Allergies and calorie floors are enforced by code
   before anything reaches the user, and the product says so plainly rather than promising
   it in marketing copy.
3. **Never fake it.** No button that pretends to work, no progress bar that is a timer, no
   plan that is a placeholder. Absent and honest beats present and hollow.
4. **Adaptation is the product, not a feature.** The check-in is the hinge the whole thing
   turns on; everything else exists to make that fortnight's data worth having.
5. **Calm over clever.** The user is tired and hungry. Large type, few choices, one obvious
   next action.
6. **Mobile is where this is used.** Standing in a kitchen, or in a supermarket aisle.

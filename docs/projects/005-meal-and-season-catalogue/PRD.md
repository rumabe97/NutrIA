# PRD — Project 005: Each meal sees its own foods, in season

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's decisions of 2026-09-25 — approved by the owner before
> the plan is written.

- **Status**: approved — by the owner, 2026-09-25, adding generation on the free models
  as the project's last part
- **Roadmap item**: [`docs/ROADMAP.md` § 7. Generation through a gateway](../../ROADMAP.md) —
  the follow-ups measured after it went out

## Problem

**The model is shown the whole catalogue for every meal.** A request for one slot's dishes
lists all 930 ingredients the person may eat: about 5,600 of the prompt's ~8,000 tokens
(measured 2026-09-24 on a lunch request, 8,013 prompt tokens reported by the gateway). The
dish library in development uses 413 of those 930 ingredients; 517 appear in no recipe at
all — 39 of 43 drinks, 50 of 60 frozen foods, 176 pantry rows. A breakfast request is shown
chorizo, lentils and frozen squid alongside the oats.

That size has a price:

- **It shuts out the providers the owner is moving to.** Groq's free tier allows 8,000
  tokens a minute; every request was refused with a 413 before it started. The free
  OpenRouter models that answered took 150–200 seconds, and the gateway cuts at 180.
- **It costs twice what it needs to** on every provider, Gemini included, and the reading
  time is paid on every call.

**Nothing says what a meal is made of, only what it weighs.** 98 of the 372 dinners in the
library carry a pulse — lentils, chickpeas, beans — against 13 of 243 breakfasts. Stewed
lentils for dinner is not how most people here eat. The prompt already tells breakfast and
snacks what kind of food they are (3.3.0); lunch and dinner have no such line, and the
catalogue cannot say "not at dinner" at all.

**Nothing knows the month.** Tomatoes in January and oranges in August are offered exactly
like anything else. The catalogue has no notion of season.

## Outcome

1. A request for one meal lists only the ingredients that belong in that meal, and the
   pool prompt for a typical lunch is **at least 45% smaller** than on 3.4.0, measured the
   same way.
2. Nobody on an omnivore diet is proposed, or served from the library, a stewed pulse at
   dinner, supper or breakfast. Somebody who eats vegan or vegetarian keeps pulses at
   dinner, in light forms: hummus, purées and creams, warm salads — not stews.
3. Fruit and vegetables in season in Spain in the month the fortnight starts are marked as
   preferred and listed first. Nothing is forbidden for being out of season, and what is
   sold all year round (onion, garlic, potato, lemon…) always counts as in season.
4. None of it costs plan quality, shown without spending a model call: the plan
   evaluator's macro results are unchanged, the library still covers every slot, and the
   allergy gate is untouched.
5. Generation works on the free models the owner is moving to — Groq and OpenRouter's
   free tier behind the gateway, Gemini as the fallback: a fortnight is generated inside
   the time budget without a request being refused for its size or its rate.

## Scope

**In:**

- Which meals each ingredient belongs to, and the months each fruit and vegetable is in
  season in Spain, on the catalogue — as short lists of exceptions, the way `countries`
  and `classes` already are: an ingredient named nowhere belongs to every meal and every
  month.
- The owner reviews both lists before they reach production.
- The pool prompt's catalogue narrowed to the requested meal, with in-season produce
  first and marked.
- Lunch and dinner each told what kind of food they are, as breakfast and snacks
  already are.
- The library's existing dishes served only at the meals their ingredients belong to: a
  lentil stew stays a lunch, it stops being a dinner.
- A generated dish that names a meal its ingredients do not belong to keeps the meals it
  does.
- **Last:** generation on the free models. Measure them on the smaller prompt, with free
  calls only, and change how the pool builder asks — how many dishes, how many requests
  at once, how they are paced — so a fortnight fits their limits. The pool builder asks
  for every slot at once (`0016`), and several requests of ~4,000 tokens in the same
  minute exceed Groq's 8,000 a minute even when one fits.

**Out:**

- Changing the gateway's combo or the models in it — the owner's configuration.
- Seasons anywhere but Spain. An English account gets the same months; a British
  calendar is the same catalogue work `0034` left for a British shelf.
- Spending Gemini's daily requests to measure anything. The owner declined it
  (2026-09-25). Live measurement uses free models only, with the number of calls stated
  before they are made.
- Moving generation off the serverless function onto the owner's server. If the free
  models cannot fit inside the 280-second budget however the requests are paced, that is
  a roadmap item of its own (`docs/ROADMAP.md` § 7), not this project.
- The prompt audit's H6 (the catalogue ahead of the per-slot brief, for caching): with
  the catalogue cut to one meal's foods it stops being most of the prompt, and the audit
  measured no prompt caching on the models that answered.

## Acceptance criteria

1. The catalogue carries, for each ingredient, the meals it belongs to and — for fruit
   and vegetables — the months it is in season in Spain; both default to "all" and are
   seeded from committed lists the owner has approved.
2. The pool prompt for one meal lists only ingredients that belong to it; for the
   standard lunch request the prompt is at least 45% smaller than on 3.4.0, by the same
   measurement.
3. Stewed pulses are absent from the dinner, supper and breakfast catalogues shown to an
   omnivore, and from the library dishes served at those meals; a vegan or vegetarian
   still sees pulses at dinner, with the prompt asking for light forms.
4. In-season fruit and vegetables for the fortnight's starting month appear first in the
   produce list and are marked as preferred; out-of-season ones are still listed.
5. Lunch and dinner each carry a one-line description of what kind of food they are,
   beside breakfast's and snacks'.
6. Offline quality holds: the plan evaluator's results on its fixed profiles are no worse
   than on `main`; every slot keeps enough library dishes to fill a fortnight; no allergy
   check changes.
7. `PROMPT_VERSION` records the change; `STEPS_VERSION` does not move.
8. The free models are measured on the new prompt with free calls only, in a committed,
   repeatable script, and the result is written down.
9. With the gateway's free models first and Gemini last, a fortnight's generation
   finishes inside the time budget, and no request is refused for its size or for the
   provider's per-minute rate.

## Open questions

None. `supper` (a late snack after dinner) gets the snacks' foods in the draft lists, which
the owner reviews in phase 2 with everything else.

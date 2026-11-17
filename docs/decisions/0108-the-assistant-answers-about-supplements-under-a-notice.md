# 0108 — The assistant answers about supplements, under a notice code attaches

> **Purpose**: one decision record (ADR). Captures the WHY that chat sessions lose.
> **Audience**: future agents and humans. **Committed**: yes. **Maintained by**: agents
> draft one immediately after any decision that constrains future work. ADRs are
> immutable: a changed decision is a NEW record that supersedes the old one.

- **Status**: accepted — narrows what
  [`0104`](./0104-the-assistant-answers-and-the-service-is-the-only-source-of-a-number.md)
  clause 2 calls clinical; the rest of `0104` and all of
  [`0105`](./0105-only-a-nutritional-figure-has-to-be-the-services.md) stand
- **Date**: 2026-11-16
- **Deciders**: owner (the request, and both choices below, by tapped options), agent
- **Project**: docs/projects/023-an-assistant-that-answers-from-your-plan

## Context

Since it went live the assistant has cut every question about a supplement. `0104` clause 2 put
"supplements as treatment, doses" under `clinical`; the label prompt said the same; the lexicon
refused the word «dosis» before any model was called. «¿Merece la pena la creatina?» got the
professional-review sentence.

The owner, 2026-11-16: *«El asistente debe responder preguntas sobre suplementación, pero avisando
que es una IA, lo legal vaya. Temas de proteína en polvo, creatina, omega 3, etc.»*

Two things had to be decided before a line was written, and he decided both:

- **Whether it may state amounts.** Those would be the model's figures — the thing `0104` exists
  to prevent. He chose the middle of three: amounts for sports supplements, none for vitamins and
  minerals.
- **Whether to measure on the real model**, with his own key. Yes.

## Decision

1. **A question about a food supplement, asked in general by an adult, is nutrition.** What one
   is, what the evidence says, whether it is worth it, when and how it is taken. The label prompt
   says so and carries examples of both sides.

2. **A usual amount may be said for four supplements, and for nothing else**: creatine, protein
   powder, omega-3 and caffeine — the four the owner named (`AMOUNT_FAMILIES` in
   `packages/core/src/domain/Assistant/Supplement.ts`). For a vitamin, a mineral or any other
   supplement — BCAAs, a pre-workout, melatonin, a herb — the assistant says what it is for and
   that the amount is the label's or a professional's. The line is drawn by consequence, as `0004`
   draws every line: an invented figure for vitamin D or iron is the kind somebody is harmed by.

3. **The amounts are given to the model, and bounded in code** — `0104`'s principle, kept. The
   prompt states the only amounts it may say: 3 g of creatine a day and no loading phase; no more
   than 200 mg of caffeine at a time and 400 mg a day; 250 mg of EPA and DHA a day and never above
   3 g; the label's serving of protein powder. They are the references the products' own labels are
   held to (`docs/legal/assistant-supplements.md` § 4.1), not a judgement of ours — the first
   measurement had the model saying "3 to 5 g" of creatine, and Spain's maximum in a supplement is
   3. `withheldSupplementAmount` then reads every answer as it is released and withholds one that
   states: an amount in international units, anywhere; an amount per kilo of body weight; more than
   `SUPPLEMENT_CEILINGS_MG` of creatine, caffeine or omega-3; any amount of anything else. The
   decline is its own, `supplement_amount`, with words that say why. It reads spelling and units,
   so it is a net and not a guarantee — «una cápsula al día» passes it, and the tests say so by
   name.

4. **The notice is attached by code.** `noticeFor` decides from the words of the question — with
   the question before it, so a follow-up is read with what it follows — and of the answer whether
   the exchange is about a supplement; the service sends that as a code with the end of the stream,
   with a stream that failed part-way, and with every stored answer it reads back; the words live
   in the web dictionaries. It is **never stored**: worked out on each read, so an answer written
   before this decision gains it and a change to the rule reaches every thread. A model that
   forgets to hedge changes nothing, and a model told to write the notice was never the mechanism.

5. **What stays clinical.** A supplement beside a medication, a condition, a symptom, a test
   result, a pregnancy, breastfeeding, an eating disorder or somebody under 18; a supplement taken
   to treat, prevent or cure. The lexicon runs every category but one as before: «dosis» is let
   through **only** beside one of the four, with no other supplement and no child in the sentence,
   and the other categories are still read on that same question.

   **What is not a supplement is refused by code, before any call**: steroids, SARMs, clenbuterol,
   DNP, ephedrine, "fat burners" and the rest of `BANNED_SUBSTANCES` are a category of the lexicon
   of their own (`banned`), read first — so «dosis de creatina y clembuterol» never reaches a model.

6. **A nutritional figure is still the service's** (`0105`, unchanged). How much protein a scoop
   carries is on the product's label, and the prompt says to say so; «20 g de proteína por cacito»
   is withheld by the figure check exactly as before.

7. **The wall is untouched.** The assistant is not told the supplements, conditions or medication
   a person declared, and has nowhere to be told (`Assistant.boundary.test.ts`,
   `health-boundary.spec.ts`). It answers about supplements in general, to somebody it knows
   nothing clinical about — which is why the notice says to ask a professional first in the cases
   it cannot see.

## Alternatives considered

- **Amounts for every supplement, under the notice.** More useful, and the owner was offered it.
  Rejected by him: the figure most worth asking for is the one most able to hurt.
- **Letting the model choose the amount of the four**, as first built. Rejected on the legal
  review the same day: it said "3 to 5 g" of creatine and "3 to 6 mg of caffeine per kilo", both
  over the reference a label is held to, and the second fitted to the person.
- **"Sports supplements" as an open family** — pre-workouts, BCAAs, beta-alanine and the like
  beside the four, as first built. Rejected: the owner named four, no list gives the rest an
  amount, and a pre-workout is a mixture.
- **No amount at all — always "see the label".** The most prudent and the least useful: the
  commonest question about creatine is how much.
- **Asking the model to write the notice.** Rejected for the reason every rule here is in code
  (`0004`): a notice that depends on a model remembering it is absent exactly when it matters.
- **Storing the notice with the turn.** Rejected: it would freeze a rule that is going to be
  tuned, and need a column. Reading it from the words each time costs nothing.
- **Reusing `invented_figure` for a vitamin's amount.** Its sentence says the figure "does not
  come from your plan", which is not why this one is withheld. A decline whose words are wrong is
  worse than one more value in a check constraint (migration `0070`).
- **A deterministic list of supplements as the gate**, instead of the label. Rejected as in `0104`:
  a lexicon refuses what spelling can catch; it cannot tell «creatina» from «creatina con mi
  medicación para la tensión» said another way.

## Consequences

- The label is now the main thing between a supplement question that is general and one that is
  clinical, and the label is a model. Measured on 2026-11-16 with `claude-haiku-5-5`
  (`apps/api/scripts/assistant-models.mjs --supplements`), twice — before the ceilings and after:
  26 of 26 labelled as expected both times, fifteen answered and eleven cut. With the final prompt
  every amount stated was one the prompt supplies (3 g of creatine; 200 and 400 mg of caffeine;
  250 mg and 3 g of omega-3), no answer gave an amount of anything else, a figure for a scoop or a
  brand, and the amount check withheld none. Three answers were withheld by the allergen net, which
  is the measurement's own declared egg allergy and not this change. Cost 0.011 $ a run. A model
  change repeats it.
- A person whose question is cut keeps getting the `clinical` sentence, which now reads slightly
  wide ("dosis"): a dose of a sports supplement is answered. Its words were left alone.
- The lists in `Supplement.ts` are the product's position. A family added to `AMOUNT_FAMILIES` is
  a supplement the assistant may give an amount for, and needs its ceiling and its source: it is a
  decision, not a tidy-up. A name missing from `NO_AMOUNT` or `BANNED_SUBSTANCES` is a hole.
- `/privacidad` and `/condiciones` change with it, and `TERMS_VERSION` is `2.3.0`: both said an
  answer is stopped on "a figure that does not come from your plan", which a creatine amount is.
- An older copy of the web app — one a phone has kept — shows an empty line for the new decline
  until it reloads.
- The legal reading — which rules bear on general information about supplements, the notice's
  words, what `/privacidad` and `/condiciones` say — is `docs/legal/assistant-supplements.md`, the
  `legal` agent's.

# 0109 — The assistant writes no menu, not even a day

> **Purpose**: one decision record (ADR). Captures the WHY that chat sessions lose.
> **Audience**: future agents and humans. **Committed**: yes. **Maintained by**: agents
> draft one immediately after any decision that constrains future work. ADRs are
> immutable: a changed decision is a NEW record that supersedes the old one.

- **Status**: accepted — narrows what
  [`0104`](./0104-the-assistant-answers-and-the-service-is-the-only-source-of-a-number.md)
  clause 1 lets the assistant write; the rest of `0104` stands
- **Date**: 2026-11-17
- **Deciders**: owner (both choices below, by tapped options), agent
- **Project**: docs/projects/023-an-assistant-that-answers-from-your-plan

## Context

`0104` clause 1 says the assistant does not "generate a fortnight". As built, the prompt said
"never write a plan of several days" and `claimsToAct` withheld an answer that named **five or
more** distinct days. Everything under that passed: a day's menu, four days in one message, a
week in two, and all of it for somebody with no plan at all.

The owner, 2026-11-17: *«Entiendo que el asistente, si le pido un plan completo no me lo da, ¿no?
¿Y si no tengo planes? No quiero que la gente abuse de eso, igual que con las recetas.»* A plan is
what the product makes and what its allowances meter (redos, swaps, dish requests); a chat that
writes one, twenty messages a fortnight, is the way round them. It is also a plan nobody checked:
no scheduler, no allergy gate on the whole, no ±5 %.

He was shown the gaps and chose, each from options:

- **Menus**: *«Ni un día completo»* — over "from two days" and "leave it at five".
- **Recipes**: *«Dejarlas»* — over premium-only, an allowance of their own, or none.

## Decision

1. **The assistant writes no menu of its own**: not a day of meals, not several days, with a plan
   or without one, however it is asked for. The prompt says so (`ASSISTANT_PROMPT_VERSION`
   `1.5.0`) and sends the person to Plan.

2. **Code withholds one.** `claimsToAct` now also withholds an answer that lays out, under
   headings, **three or more different meals of a day** or **two or more days**, where what
   follows the heading is not the plan's own dish. The decline is still `acting`, with new words.
   The five-days-named rule stays as it was.

3. **The plan read back is not a menu.** `claimsToAct` takes the dish names of the active plan
   from the context. A heading followed by one of them — by name, or by every word of the name in
   any order — counts for nothing, and neither does one followed by a share of the day or an
   amount of energy. «¿Qué como el jueves?» and «¿por qué tanto almuerzo?» are the first things
   the assistant is for. Somebody with no plan has no dish to read back, so the same words to them
   are a menu.

4. **Having no plan changes nothing else.** The assistant still answers — ideas for a meal, a
   recipe, a doubt — inside the same allowance of messages; the prompt tells it to say the plan is
   generated from Plan, and not to make one up.

5. **Recipes stay as `0104` left them**: one, with its quantities, when asked; no macros of its
   own (`0105`); bounded by the message allowance and nothing else.

## Alternatives considered

- **From two days**, letting one day's menu through. Offered; he chose the stricter. One day is
  already the product in small, and seven messages make a week of it.
- **Reading only the shape of the answer** — three meal headings, whatever follows. Rejected: it
  withholds a person's own Thursday, which is the core use.
- **Refusing on the question** («hazme un menú») before any call. Rejected for the reason `0104`
  gives against a lexicon as the gate: it stops a spelling, and the answer is where the menu is.
- **A recipe allowance of its own, or recipes for premium only.** Offered; he left them. A recipe
  without macros and outside the plan is what any search gives, and much of the chat's use.

## Consequences

- It is a net that reads headings. A menu written as running prose passes it; and since a
  sentence is released as soon as it passes, two meals of a three-meal menu are on screen when the
  third stops it. `ClaimsToAct.test.ts` names both.
- It errs towards withholding where the plan is paraphrased: a plan dish named with a word
  missing is not recognised, and the person is told where their plan is. The prompt asks for the
  names exactly as given.
- Somebody explaining meals under headings with no dish and no figure («Desayuno: ligero, para
  arrancar») could trip it. Not seen; `apps/api/scripts/assistant-models.mjs --menus` is the set
  to run when the prompt or the model changes.
- Measured on 2026-11-17 with `claude-haiku-5-5` (`assistant-models.mjs --menus`, then again with
  `--no-plan`; 0.012 $ for both): five ways of asking for a menu, refused in prose every time and
  sent to Plan, with a plan and without; «¿qué como el jueves?» and «¿por qué tanto almuerzo?»
  shown whole, read from the plan; ideas for a dinner and a recipe given. The code's net withheld
  nothing in either run — the model never wrote a menu for it to stop — so on a real model it is
  proven only not to stop the plan read back.
- `/privacidad` and `/condiciones` are unchanged: they say what the assistant talks about and
  that it never changes a plan, both still true. `TERMS_VERSION` stays. The terms' list of why a
  question may go unanswered has never named this decline, and still does not.
- An older copy of the web app shows the old `acting` sentence («ni escribirte uno entero») until
  it reloads — imprecise for a one-day menu, not false.

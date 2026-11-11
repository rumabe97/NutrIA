# Which model the assistant answers on — 2026-11-11

Project 023, phase 6 (PRD 14). `apps/api/scripts/assistant-models.mjs`, run once against
`claude-haiku-5-5`, `claude-sonnet-5-5` and `claude-opus-5-5` with the real label prompt, the real
answer prompt (`ASSISTANT_PROMPT_VERSION` 1.3.1) over a fixed one-day context, and a declared egg
allergy the model is never told. Every answer went through the screens the route runs: the clinical
lexicon, the label, the allergen net, `figuresAreAllSupplied` and `claimsToAct`. The raw answers are
kept privately; this is the comparison. Total spend: 0.23 $.

## The numbers

| | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Labels right (of 10) | **10** | **10** | **10** |
| Outcome as expected (of 10) | 9 | 10 | 9 |
| Answers withheld by a screen | 1 | 0 | 1 |
| Invented figures | 0 | 0 | 0 |
| Offered to build a fortnight or change the plan | 0 | 0 | 0 |
| Errors | 0 | 0 | 0 |
| Median time to first chunk | **2.4 s** | 4.3 s | 3.1 s |
| Cost per message | **0.00037 $** | 0.0079 $ | 0.0145 $ |
| Per month at ~350 messages | **0.13 $** | 2.77 $ | 5.07 $ |

The four that must decline (insulin, a dose, breastfeeding, the football) were declined by all
three, by the label and in code, before any answer was written. Macros per meal were answered by all
three with the service's own figures (48 / 72 / 44 g), and each one passed the figure check. All
three turned down the fortnight and pointed at the app.

## The one difference is the net, not the model

The one answer Haiku and Opus lost was the egg-free tortilla. Both answers were safe: chickpea flour,
tofu, legume purée. They were withheld because they said *«sustituir el huevo»* and *«sin huevo»*.
The allergen net matches names, and a negation still names the food. Sonnet happened not to write
the word. That is luck of wording, not judgement. Over a hundred questions, every model will lose some
answers this way.

This is the net working as designed. It is conservative, and the model never learns the allergy
(`docs/decisions/LOG.md`, 2026-11-10). It could learn to read «sin X» and «en vez de X», but that
belongs to a decision about the safety layer (`0004`), not to this choice of model. The cost is
visible: a person with an egg allergy who asks how to replace egg gets the decline.

## Recommendation

**Keep `claude-haiku-5-5`**, which is already the default, so nothing needs setting on Vercel.

On this set all three labelled every question correctly and none invented a figure. Haiku is the
fastest to its first words and costs 20 to 40 times less. Sonnet's perfect score came from one word
it happened to avoid. Haiku's one blemish in the answers was a typo (*«antiguapegajosa»*).

Sonnet is still affordable, at under 3 $ a month against roughly 100 € of credit that expires
unspent. If the answers ever read thin on the iPhone, switching to Sonnet is one variable
(`AI_ASSISTANT_MODEL=claude-sonnet-5-5`) and no code.

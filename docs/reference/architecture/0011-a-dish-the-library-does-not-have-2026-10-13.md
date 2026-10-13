# 0011 — "The dish I want is not there": what is actually missing, and what to do about it

> **Purpose**: the owner asked, on 2026-10-13, what happens when the dish somebody wants to fix
> to a weekday is not in the library — and whether we could write it on demand. This measures
> **why** a dish is not offered, finds that the library is usually not the reason, and sets out
> the options with what each one really costs. It names the one that is nearly free and the one
> that collides with a promise already published.
> **Audience**: the owner. **Committed**: yes. **Maintained by**: whoever revisits the question;
> once merged it is not edited, and a later review is a new report.
>
> **Base**: `origin/main` at `101d8e20` (#277, the fixed meal shipped). **Cut-off**: 2026-10-13.
>
> **Measured**, not argued: the local library of 982 recipes on local Postgres, through the real
> `GET /fixed-meals/fixable` with a real session. Every number below came back from that route or
> from a read query against the same database. No model was called.

## 0. The short version

The owner's example was *patatas a la riojana*. **That dish is in the library, and it was not
offered.** The reason has nothing to do with the library, with the plate, or with the model:

> `Patatas a la riojana con costilla y chorizo` takes **15 min prep + 35 min cooking = 50
> minutes**, and the account had said it would cook for **30**.

Raising that one preference to 60 minutes, and changing nothing else:

| | fixable before | after |
| --- | --- | --- |
| lunch | 263 | **328** |
| dinner | 157 | **194** |
| *patatas a la riojana* | not offered | **offered at lunch and dinner** |

So the first finding is that **"the dish is not there" is a symptom with at least five different
causes, and the screen tells the person none of them.** It shows a shorter list and says nothing.
Generating new dishes answers only one of the five.

## 1. Why a dish is not offered

`GET /fixed-meals/fixable` is `pinnable` over `reusablePool`. A dish has to survive both. The
filters, in the order they bite:

| # | What removes it | Where | Is it right? |
| --- | --- | --- | --- |
| 1 | An allergen or intolerance this person declared | `dishSafety`, `mentionsUnresolvedAllergy` | **Yes, absolutely.** Never relax this |
| 2 | Their way of eating — vegetarian, halal, gluten-free | `usesExcluded` | Yes: it is who they are, not a preference |
| 3 | A dish they said they dislike | `verdicts.disliked` | Yes; and they would not fix it anyway |
| 4 | **It takes longer than they said they would cook** | `withinTime` | **This is the one worth arguing about** — § 3 |
| 5 | The recipe does not say how to cook it | `hasUsableMethod` | Yes: a recipe with no method is not a recipe |
| 6 | It does not belong at that meal for this person | `fitSlots` (`0062` § 5) | Yes |
| 7 | **It cannot be sized into that meal's plate** | `fitsPlate`, `PLATE_LIMIT` 0.5–1.5 of the share, `PLATE_GRAMS_MAX` | Yes, and `0098` already refused to let a pin past it |
| 8 | Its fresh fruit is out of season in the fortnight judged | `seasonFor`, `monthOf` | Yes for the fortnight; **wrong for a standing rule** — § 5 |
| 9 | The library does not have it at all | — | The owner's actual question |

**Number 7 is bigger than it looks.** For the same person, on the same day, 158 dishes are
fixable at lunch and not at dinner, and 52 at dinner and not at lunch. The plate's size is the
binding constraint far more often than the library's contents are — a dinner share is smaller
than a lunch one (`0036`), so a big stew fits one and not the other, and a small plate the
reverse.

**Number 9 is real but narrower than it feels.** Searching the library for the owner's two
examples: *patatas a la riojana* exists exactly (plus two more "a la riojana"); *tostadas con
tomate, pavo y queso fresco* does not exist exactly, but `Tostada de centeno con requesón, pavo
y tomate sazonado` is the same plate with requesón instead of queso fresco.

## 2. What the screen should say first, and it costs almost nothing

Today the person searches, sees a list, and the dish they wanted is not in it. They cannot tell
causes 1–8 from cause 9, and four of those eight are things **they can act on**.

The cheapest useful change in this whole report: **let them search by name, and when a dish
matches but is filtered out, say which filter and what to do**.

- *"Takes 50 minutes; you said 30. Raise it in your profile."* → actionable, and it is the case
  the owner hit.
- *"Too big for your dinner. It fits your lunch."* → actionable, and it is the most common case.
- *"Out of season in this fortnight."* → explains itself.
- *"It has prawns, and you are allergic."* → never offer the dish, and this sentence is the one
  case where the honest answer is a refusal rather than a route forward.

It needs no model, no new table, and no change to anything that reaches a provider. It turns an
invisible absence into a sentence. **I would do this first whatever else is decided**, because
it is also what makes the next options legible: a person who is told "we do not have it" is the
only person who should be offered a way to get it written.

## 3. Letting a fixed meal ignore the cooking-time preference

`withinTime` is the filter that excluded the owner's own example, and it is the one filter in the
list whose justification is **a preference about what the generator picks**, not a fact about the
person or the plate.

That is exactly `0099`'s argument, one layer up. `0099` decided that a **variety cap counts the
meals the generator chose**, because a cap exists to stop the generator reaching for pasta a
fifth time and charging it for a Friday somebody fixed measures the person instead. The cooking
time is the same shape: *"I have half an hour on a weekday"* is an instruction to the planner. It
is not an instruction about the one dish the person deliberately asked for, on the one day they
asked for it.

**Measured**: +65 lunches and +37 dinners become fixable, and the owner's example is among them.

It is not free of judgement: somebody who fixes a 50-minute stew to a Tuesday will meet it every
other Tuesday, having told us they have 30 minutes. The honest form is to **offer it, labelled**
— *"50 min, longer than the 30 you usually want"* — rather than to filter it away silently or to
offer it silently. One filter, one sentence, no new infrastructure.

## 4. Writing a dish on demand — and the promise it collides with

This is what the owner asked about, and it has a constraint that is easy to miss.

**`/privacidad` says, today, in the live Spanish text:**

> «Un modelo de inteligencia artificial diseña los platos. Recibe tus objetivos diarios, tus
> horarios de comida, si eres vegetariano o vegano, y los alimentos y platos que te gustan o no,
> **siempre con los nombres de nuestras listas**. Nunca recibe tu nombre, tu correo, tu edad, tu
> peso ni tu altura, **nada que escribas a mano**…»

A free-text box that sends *"tortilla de patata"* to the model breaks that sentence. It is the
same class of defect as the pitch promising ten events: a published promise the product stops
keeping. It is **not** illegal — the providers are under zero retention and do not train
(`0064`, `analysis.md` § 4.4) — but it reopens `analysis.md` P0-3, whose whole resolution was
that free text written by the person stops reaching any model, and it needs the policy changed
and `privacy.updated` moved.

So the choice is not "generate or not". It is **what the request is made of**:

**(a) Free text.** *"tortilla de patata"*. Best result, and it costs a policy change plus the
argument in P0-3 being reopened. If the owner wants this, it is a `legal` question before it is
an engineering one.

**(b) A closed request, built from names the code already owns.** The person does not type: they
pick ingredients from the catalogue (patata, huevo, cebolla) and a meal, and the code composes
the brief. That stays inside *"siempre con los nombres de nuestras listas"* — it **is** a name
from our lists — so **no policy change, no P0-3 argument**. The seam exists: `promptPreferences`
already takes a `swapWish`, and the swap flow already asks the model for a dish with a wish
attached (`wishFor`). Today those wishes are four code-written strings; this makes a fifth whose
content is catalogue slugs.

**(c) The wish rides the next generation.** Same brief as (b), but instead of a model call now,
it is added to the fortnight the person was going to generate anyway, which already asks the
model for fresh dishes. Free in model calls. Slower: you get it next fortnight, not today.

**What generation does not fix.** A newly written *tortilla de patata* still has to pass filters
1–8. It can come back too big for the dinner it was asked for, or over the cooking time, and
that is discovered **after** the call was paid for — unlike today, where the list is the answer
and costs nothing. Any of (a), (b), (c) needs a story for "we wrote it and it still does not
fit", and (c)'s is much the gentlest.

**And it is a `financial` allowance** in `0097`'s terms, the second one after plan redos: it
spends money from a pot everybody shares. It would need a number, bounds and a reason in
`ALLOWANCE_BOUNDS` like any other.

## 5. Two things the fixed meal already needs, which overlap this

Both are already recorded as owed (`0099`, and the `migration-reviewer`'s note on `0063`), and
both are the same mechanism:

- **A rule stops being honourable and nobody is told.** `pinnable` is judged against the next
  fortnight, so a summer dish fixed in June fails silently in December (filter 8). The same
  symptom arrives if the dish leaves the catalogue, or if the account switches language and the
  rule points at a Spanish dish its pool will never hold.
- **One notice covers all three**, and it is the owner's chosen option 3, part two.

If that notice is built, it is also the natural home for *"your Friday rule could not be served
this fortnight — it was out of season"*, which is the honest end of the season problem for a
rule that is meant to last for ever.

## 6. What I would do, in order

1. **Say why a dish is not offered** (§ 2). No model, no table, no policy. It answers the owner's
   actual experience — he looked for a dish that *was there* and could not tell why it was not
   offered.
2. **Let a fixed meal ignore the cooking-time preference, labelled** (§ 3). One filter, one
   sentence, measured: +65 lunches, +37 dinners, and the owner's own example. The argument is
   `0099`'s, already accepted.
3. **Build the "this rule can no longer be honoured" notice** (§ 5), which is owed anyway.
4. **Then, and only if 1–3 leave a real gap: the closed request, riding the next generation**
   (§ 4 b + c). It is the only variant that needs neither a policy change nor a new model call,
   and by then there will be evidence of how often the gap is real rather than a filter nobody
   explained.

Free text to the model (§ 4 a) I would not do without the `legal` agent looking at it first, and
I would not do it at all if (b) turns out to be enough — the published sentence it breaks is one
of the clearest promises on that page.

## 7. What was measured, so it can be checked

- `GET /fixed-meals/fixable?weekday=4&slot=…` with a real session, local Postgres, 982 recipes:
  breakfast 186, lunch 263, dinner 157. Library totals for the same locale: breakfast 279, lunch
  342, dinner 360.
- Lunch ∖ dinner = 158 dishes; dinner ∖ lunch = 52; both = 105.
- `Patatas a la riojana con costilla y chorizo`: 632 kcal and 702 g per serving, prep 15 + cook
  35. The account's `cookingTimeMinutes` was 30. Its lunch share is 842 kcal, so `PLATE_LIMIT`
  admits 421–1,263 kcal and `PLATE_GRAMS_MAX` 750 g — the plate was never the problem.
- `PATCH /profile/preferences {"cookingTimeMinutes": 60}`, nothing else changed: lunch 263 → 328,
  dinner 157 → 194, and all three "a la riojana" dishes offered.
- Library search: 3 dishes matching "riojana", 63 matching "tostada", 67 "pavo", 14 "queso
  fresco", 1 with tostada + tomate + pavo together.

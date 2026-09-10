# 0035 — The panel counts our own calls, and says so

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

Four of the six generations that failed in production failed for the same
reason: the provider refused. Gemini's free tier gives this account **twenty
requests a day** for the model in use, and the console showed twenty-seven
against that twenty over the trailing window. Meanwhile token use sat at 4.77K
against 250K a minute — two percent of what is allowed.

So the binding constraint is **requests per day**, not tokens, and nothing in
the product could say how close today was to the wall. The owner asked for a
panel: what is left, what each generation burns, how long until it resets.

The obvious version of that panel cannot be built. Google publishes no endpoint
for remaining quota; a screen claiming to know it would be inventing a number
about somebody's money.

## Decision

**Count what leaves this service, measure it against a limit the operator
configured, and say plainly that those are two different things.**

- Every request to a provider records an `ai_call` event — model, tokens in and
  out, whether it succeeded, and whether the refusal was a spent quota. It
  qualifies under `0033`'s own test: a failed call leaves no row anywhere, and a
  successful one leaves its cost inside a plan's metadata, which cannot answer
  "how many requests today".
- Recorded at the client, because that is the only place a request actually
  leaves the building. Not awaited into a failure — the repository swallows its
  own errors, so a counter can never break a generation.
- `AI_REQUESTS_PER_DAY` and `AI_TOKENS_PER_MINUTE` are configuration, not
  constants: they belong to an account and a model, and Gemini gives one model
  twenty a day and another five hundred. **Unset shows a count with no bar** —
  a limit nobody stated is not a limit this product may invent.
- The screen says, in its own copy, that this is our count against the
  operator's number, and that a difference from the console is calls that did
  not come through here.
- The daily reset is Pacific midnight, because that is Google's day. Worth
  saying out loud: an owner in Spain looking at a spent allowance at nine in the
  morning is looking at a counter that resets at nine in the morning, and
  nothing about a calendar would suggest that.

## The rest of the panel

- **Pagination.** The account list was capped at two hundred rows, **oldest
  first** — so past a few hundred accounts the screen showed the founders and
  lost everybody who needed something. It is now newest first and paged, in the
  URL, so a page survives a refresh and a share. The end-to-end suites found
  this, having filled the throwaway database past the cap.
- **Sections.** The screen is grouped by what a question is about rather than by
  the order the features were built in.

## Consequences

- The count starts empty and fills from the next call. There is no backfill:
  the requests that already happened left no row, which is the whole reason
  this exists.
- Illustration and rewrite sweeps count too, and should — they spend the same
  twenty.
- What is deliberately not built: an alert, a hard stop at the limit, or
  anything that pauses generation. This screen tells the owner what is
  happening; deciding what to do about it needs a person, and the product
  already fails honestly when the provider says no.

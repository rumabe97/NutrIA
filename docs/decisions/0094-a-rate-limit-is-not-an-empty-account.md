# 0094 — A rate limit is not an empty account, and the judge waits one out

- **Date**: 2026-10-10
- **Status**: accepted
- **Amends**: [`0066`](./0066-photograph-like-dish-pictures-drawn-on-first-view.md), which made a
  402 and a 429 one thing — "the account cannot pay for another call". They are still both
  refusals that give the drawing back without blaming the dish; what changes is that they
  are no longer the same reason, the same mail sentence, or the same answer.

## Context

The owner was mailed *"la clave de imágenes no puede pagar o ha llegado a su límite de uso"*
and said he was nowhere near any limit. He was right, twice over.

What production actually recorded, over the three days to 2026-10-10:

- Every one of the five refusals was `judge: OpenRouter /chat/completions answered 429 —
  provider: DeepInfra`. **Five 429s, zero 402s.** The account could pay; the provider was
  asking for a slower pace.
- The failing call was the **judge**, not the image provider the mail names. The drawing
  itself never failed once: 21 of 21 drawn.
- Of those 21 drawn pictures, **11 were judged and ten were given back** — all of them to a
  judge 429, all since 2026-10-09 10:30, before which there were none.

Two defects, one in words and one in money.

The words: `reasonOfCall` filed every 4xx that was not a 402 under `model_refused`, and
`AdminAlertController` put that reason in the mail whose sentence explains a 402. So a
passing rate limit on a second-hand provider reached the owner as "your key cannot pay".

The money: a judge call costs about **0.0007 $** and the drawing it judges about
**0.0337 $**, forty-eight times more — and the drawing is already paid for by the time the
judge runs. Giving it back over a 429 throws away the expensive half of the attempt to
save the cheap one, and the dish pays for a second drawing on its next visit. Ten pictures
in three days, about **0.34 $** of a 10 $ month, and it is also why dishes were showing up
without a picture.

## Decision

- **A judge call waits out a rate limit** (`JUDGE_RATE_LIMIT_WAITS_MS`: two waits, 2 s then
  5 s, seven seconds in all, inside the attempt's own minute). Every attempt is still
  recorded, the failures included, so the console counts what the provider did. A drawing is
  given back only when the waits are spent.
- **Only the judge waits, and only on a rate limit.** The image call has paid nothing yet
  when it is turned away, so there is nothing to save by waiting. A 402 does not pass by
  waiting and neither does a policy: both are raised at once.
- **A 429 is its own reason**, `rate_limited`, between `payment_refused` and
  `model_refused`, which now means a 4xx that is neither. A 429 whose words name a spent key
  or quota stays `payment_refused`: the words are read before the status.
- **The refusals mail names which of the three it is** and no longer asserts the cause in
  its opening sentence. It still carries all three, because a provider that keeps turning
  drawings away is news whichever reason it gives — but only one of the three is about
  money, and the mail now says so.

## Alternatives considered

- **Stop mailing about rate limits.** It is what the owner first asked for, and it was
  rejected after the retry landed: with the waits in place a 429 that still gives a drawing
  back means a sustained throttle, which is exactly the thing worth knowing. Silence there
  would have traded a false alarm for a blind spot.
- **Retry the image call too.** Nothing is paid when a drawing is refused, and the dish is
  not blamed for it, so waiting buys only a faster picture at the risk of sitting on a
  provider that is down.
- **More waits, or longer ones.** Seven seconds fits inside `ATTEMPT_MIN_MS` with room to
  spare. Longer would start eating the drawing's own budget to chase a provider that, by
  then, is not rate limiting but failing.
- **Read OpenRouter's `retry in Ns`.** `gateway.ts` already parses it, but for the gateway's
  own path; `PictureCallError` does not carry it. Worth doing when the waits prove too
  blunt, and not before.

## Consequences

- A passing 429 now costs a judge call and seven seconds instead of a drawing. On the three
  days measured that would have been ten pictures, about 0.34 $, and ten dishes that would
  have had their picture the same day.
- `rate_limited` is a new member of a closed set that the console, the mails and two
  dictionaries all name. A reason added here is added in all four.
- The judge's provider is now the thing to watch: the failures began at one moment on
  2026-10-09 and the model behind them is `qwen/qwen3-vl-235b-a22b-instruct`, routed by
  OpenRouter to DeepInfra. If the waits stop being enough, the lever is the route, not the
  retry.
- A 429 is still a refusal for `isRefusal`: the drawing is given back, the attempt is not
  counted against the dish, and the dish is drawn again on its next visit. Only the
  reason, the mail's words and the waiting are new.

# 0096 — What is bought can be typed, and it is typed against the whole plan

- **Date**: 2026-10-11
- **Status**: accepted
- **Amends**: [`0091`](./0091-the-shopping-list-is-read-by-range-and-bought-by-amount.md), which made
  what is bought an amount and left typing one out — "a small step, the column exists, but
  stays out of 020". This is that step.

## Context

`0091` stored what is bought as grams and gave the shop floor a box: ticking buys the days
on screen, unticking gives their share back. Three states came out of it — untouched, partly
bought, done — and the partial one is what a real shop looks like.

What the box cannot say is **how much**. A reader who put 400 g of the 700 in the trolley
could only tick it (and claim all 700) or leave it (and claim none). Project 020's PRD put
typing out of scope on the owner's choice of 2026-10-09 and said it might return as its own
project; on 2026-10-11 the owner asked for it directly, and a project folder would have
blocked on him committing it, so it ships as one change with this record.

It closes a second thing by accident. `0091` refuses to unmark a row from a range narrower
than what is bought — a week's box cannot express "give back less than everything", so the
gesture is refused and the reason said. Typing *is* that expression, so the notice now names
a way out instead of a dead end. The waiver project 020 recorded is half closed.

## Decision

**A row's bought amount can be typed**, in a field behind a disclosure beside the row.

- **It is typed against the whole plan, not the days on screen.** `boughtGrams` is the plan's
  own accumulator and a row computes what the visible days still need from it. Framed against
  the range, somebody who bought 500 g last week would be typing into a number whose meaning
  moves with the filter. The field's hint says the whole figure out loud.
- **Behind a disclosure, not always on screen.** A list is a hundred rows and almost every one
  of them is a tick. A field on each would cost every reader a second tab stop and a taller
  row to serve the rare case; the list reads as it did until somebody needs it.
- **In the row's stored unit**, never the formatted one. `formatQuantity` renders 1,200 g as
  "1,2 kg", and a field labelled kg would take "2" as two grams. The label names the unit —
  grams, millilitres, units, slices — and the hint carries the formatted total.
- **`fromDisplay` is the inverse of `toDisplay`**, in the domain beside it, and the two agree:
  three eggs typed are 174 g stored and three eggs read back. It rounds, and **never rounds
  up**: `0078`'s 5 g step is applied once, when a range is summed into what a shop owes, and
  applying it to a figure read off a scale would invent grams nobody bought. It caps at the
  plan's need, as the server caps it, so the screen and the round trip cannot disagree.
- **The same body, through the same queue.** Typing builds `{ boughtGrams, checked }` exactly
  as the box does and goes through `queueMark` + `flushMarks`, so it works with no signal and
  cannot race a flush already draining (`0055`).
- **The refusal guard stays on the box alone.** It exists because a box cannot say "less than
  everything"; a typed amount can, so porting it would forbid the very gesture it describes.

## Alternatives considered

- **A field on every row.** Honest and stateless, and it fails restraint: two hundred tab
  stops and a taller row each, to serve the rare case.
- **A dialog or sheet per row.** The design protocol rules it out for a one-line edit, and a
  hundred of them would hide the list behind the thing being read off it.
- **Making the quantity itself the button.** It would read well — but the quantity sits inside
  the label on purpose since 020, which is what puts it in the box's accessible name, and a
  button cannot live inside a label. It would undo an accessibility fix to save a tab stop.
- **Typing against the days on screen.** Rejected above: the arithmetic stops being coherent
  the moment the filter moves.
- **Committing on blur.** Mis-fires one-handed, which is the posture this is for. A real form
  with a Save button gives Enter for free and Escape its way out.

## Consequences

- The 020 waiver "clearing a row from a narrower range needs the whole range" is half closed:
  the notice that refuses it now describes something the reader can do.
- `fromDisplay` is where any future conversion from what a person typed belongs. It and
  `toDisplay` are a pair; a change to one is a change to both.
- The field is a second control per row for a keyboard reader, reached only through the
  disclosure. Nothing else about the row moved: the box, the name and the quantity are where
  020 left them.
- `/compra/proxima` gets it for nothing — `ShoppingItem` is the same component on both
  screens.
- Still out, and still deliberately: a price per ingredient, a list across plans, and
  anything that writes to the plan from the shopping screen. What is bought remains the only
  writable thing on it.

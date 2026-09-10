# 0038 — A tour of what is already here

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

The owner's own diagnosis, from watching people use it: they do not know what
the product does. Not that they dislike a feature — that they never met it. The
plan, the shopping list and the progress chart are in the navigation bar with
their own names, so those are found. Everything else is a button on a screen
somebody has to already be on: changing a dish along an axis, saying which meals
they eat and how big, pausing a fortnight for a trip, the check-in that sets the
next plan's targets.

Those four are also the whole of what makes this product different from a PDF of
recipes, which makes "nobody found them" the most expensive bug on the board.

## Decision

**Five stops, shown once, on the dashboard.**

Each stop is a title, one sentence, and a link to the screen it describes.
Nothing else — no highlighted rectangles chasing elements around a layout, which
is the version of this feature that breaks every time a screen changes.

What is in it, and why only these:

| Stop | Why it is here |
| --- | --- |
| The fortnight is already planned | The premise. Everything else assumes somebody knows a plan exists. |
| A dish can be changed, and you can say how | The most valuable button in the product, on a screen nobody scrolls. |
| Which meals you eat, and how big | New (`0036`), and invisible: it lives inside an onboarding step. |
| A trip pauses the plan | The alternative is somebody abandoning a fortnight they could have kept. |
| The check-in | The one thing the product needs *from* the person, and the reason the next plan fits better. |

The shopping list and the progress chart are deliberately **out**: they are in
the navigation bar, and a tour that reads out the menu is a tour nobody
finishes.

## Where the mark lives

`profiles.tour_seen_at`, not browser storage. A tour that reappears on the phone
after being read on a laptop is worse than one nobody sees, and "have I been
told this" is a fact about a person, not about a browser. A timestamp rather
than a boolean, because *when* answers a question a flag cannot: whether
somebody saw the tour before or after the thing it now describes existed.

Null means never — which is **every account that existed before the tour did**,
on purpose. They are the ones who have been using features nobody ever named.

## Consequences

- It opens on the dashboard and only there. A tour that can open on any screen
  is a tour that interrupts the shopping list.
- A native `<dialog>`: the focus trap, the Escape key and the backdrop are the
  platform's, and each is something a hand-rolled overlay gets subtly wrong.
  Closing is closing however it happens — the mark is written on `close`, so
  leaving by Escape counts exactly like pressing the last button.
- The mark is written fire-and-forget. Nothing on screen waits for it: a mark
  that failed to save costs one repeated tour, while a modal held open by a
  spinner over a dropped request costs more.
- Replayable from the profile, next to the box for saying what is missing
  (`0037`) — the two questions a person has after a tour are "what was that
  again" and "why isn't there a…", and they should be in the same place.
- A failed `/profile` read counts as *seen*, so an error never turns into a nag.

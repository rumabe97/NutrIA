# 0041 — What a page owes a reader who cannot see it

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

An audit of `apps/web` and `packages/ui` against WCAG 2.2 AA found twenty-five
defects. Most were small and uncontroversial — a missing `role="alert"`, a
`<nav>` with no name, a button below the minimum target size — and were simply
fixed. Three were not, and this record exists for those.

## The three that were decisions

### A control has to look like a control

Inputs and secondary buttons fill with the page's own colour and were
distinguished from it only by `--border-01`, which measures **1.26:1**. WCAG
1.4.11 asks 3:1 of the boundary that says a control is there, and outdoors on a
phone the gap between 1.26 and 3 is the difference between finding a field and
hunting for it.

`--border-01` keeps every divider, card edge and popover outline, where it is
decoration and low contrast is correct. A new `--border-interactive` at 3.15:1
carries the meaning: inputs, textareas, secondary buttons, checkboxes, radios,
the select trigger, the switch track, the pill groups.

### There is no third tier of grey

`--foreground-03` was documented in its own comment as sub-AA and not for text —
and then used as text in sixty-three places, including the labels of the bottom
navigation bar. The fix looked like a one-token remap until the ratios were
computed:

| grey | on the light page | on the dark page |
| --- | --- | --- |
| `gray-09` (what it was) | 3.15 | 3.65 |
| `gray-10` (the step between) | 3.60 | 4.46 |
| `gray-11` (what it is now) | **4.90** | **6.92** |

The middle step fails in light mode, so on this near-white ground **there is no
value that is both legible and lighter than the secondary tier**. The AA
threshold lands about four hex steps from `gray-11` itself.

So `--foreground-03` now resolves to the same value as `--foreground-02`. The
tier survives as a semantic name and dies as a colour, and hierarchy in those
sixty-three places has to come from size or weight instead — or from a lighter
page ground, which is a redesign rather than a fix. Recorded rather than quietly
shipped, because "tertiary text is now the same colour as secondary" is a visual
change to every screen and the owner should meet it here rather than in a diff.

### A topic under a section is a heading

The landing's steps, features and safety items, and the profile's card names,
were semibold paragraphs. The landing's outline was one `h1`, five `h2`s and
nothing between; the dashboard's was an `h1` and nothing at all. That outline is
what a screen reader's rotor offers and what a crawler weighs.

They are headings now, at the size they already were — a card label that grew
because its tag changed would be a redesign smuggled in as a fix.

## Consequences

- The tour opened by `0038` announced itself as an unnamed dialog and placed
  initial focus on the link that dismissed it. Both are fixed; a modal that
  opens by itself has to say what it is and start somewhere that is not the exit.
- Failure is announced. Plan generation had a correct live region that **did not
  exist in the branch that renders the failure**, so a person waiting minutes for
  a plan was never told it had failed.
- Closing a panel returns focus to the control that opened it, rather than
  dropping it on `<body>`.
- Every route has its own `<title>` and navigation moves focus, so changing
  screen is an event a screen reader can perceive. This overlaps `0040` — the
  same change serves search and serves a reader who cannot see the screen, which
  is usually the way of it.
- `prefers-reduced-motion` now zeroes `animation-delay` as well as duration.
  It did not, so a delayed element held its invisible start state for the length
  of its delay — motion removed, invisibility kept.

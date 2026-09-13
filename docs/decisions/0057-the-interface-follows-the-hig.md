# 0057 — The interface follows the HIG: one control vocabulary, one card, a finger's target

**Status**: accepted · **Date**: 2026-09-13 · **Deciders**: owner, agent

## Context

The owner installed a design skill built on Apple's Human Interface Guidelines and asked
for an audit of the web app against it, then for everything it found to be fixed "so it
looks like Apple". The audit was a FAIL: a payment error painted in a pastel that measured
1.8:1; white text on the brand green at 3.9:1 in dark mode, on every primary button; tap
targets of 24–37px on the actions a person makes with a thumb at a table; a bottom-bar tab
whose "you are here" was a hue change of 1.5:1; two button vocabularies (a black pill for
actions, a green rectangle for navigation); the card recipe copied into sixteen stylesheets
and drifted to three radii; a profile of thirteen undivided cards.

## Decision

- **One control vocabulary.** `ui/components/Button` is the only thing that looks like a
  button, and it exports `buttonClassName` so a link that must stay an `<a>` (`CtaLink`,
  the pager, the map link) wears the same classes. Four variants — `primary`, `secondary`,
  `tertiary`, `destructive` — and one primary per view. A toggle is a `secondary` that
  shows `aria-pressed`; a filled button is an action, never a state. Sizes are 32/40/48,
  the height of an input and a select in the same rows.
- **A fill that carries a white label in both schemes.** `--color-brand-fill` and
  `--color-brand-fill-hover` are what a filled control, a ticked box, a chosen day and a
  progress bar use. NutrIA sets them to the light step 09 in both schemes (4.8:1 with
  white; 3.9:1 off the dark page), because the dark step 09 is lightened to read on a dark
  ground and drops a white label to 3.9:1. `--color-error-fill` does the same for red.
- **Semantic radii, iOS's values.** `--radius-control` 10, `--radius-card` 14,
  `--radius-sheet` 20. Every control, card and sheet reads one of them.
- **One card.** `apps/web/components/Card` is the raised surface; nothing else declares
  the recipe. `padding` picks the tier (`sm` for a tile, `lg` for a card that is the
  screen). A link or a list item that is a card is `<Card as={Link}>` / `<Card as="li">`.
  A sheet (the tour) and the hero's preview are not cards and keep their own surface.
- **A finger's target.** `--target-min` (44px) applies under `(pointer: coarse)` to every
  button, input, select, chip, pill, switch line, disclosure toggle and standalone link; a
  pointer keeps the desktop heights. The header's segmented control keeps its 28px look and
  grows its hit area instead.
- **Nothing by colour alone.** The bottom bar's current tab is also semibold with a
  heavier stroke; a chosen chip is a tinted wash with a fill-coloured border.
- **The profile is a settings list**: five sections with small-caps headings — plan, data,
  notices and language, help, danger zone — and every block in them is a card with a
  title one step above the body.
- **Four tracking values and no others**: display, headline, `--tracking-title` inside a
  screen, `--tracking-caps` for a small-caps label.
- **Motion that is state, not decoration.** No hover lifts. The landing's reveal runs at
  `--duration-slow` and holds a compositing layer only while hidden.
- **The rest of the audit**: the premium card's error uses `--color-error-text`; the
  admin's failed calls use the text step of red and handled messages step back in tone
  with a "Visto" chip rather than fading to 2.2:1; the delete button is `destructive`; the
  event form's submit is secondary on the generation screen, where starting the plan is
  the action; the map link says it opens elsewhere; the feedback box shows its label; the
  headers grow at 200% zoom instead of clipping; the tour is a bottom sheet on a phone.

## Alternatives considered

- **Importing the skill's own CSS.** Its scale is Apple's (17px body) and its tokens are
  a parallel set; adopting it would have meant re-theming every screen. The skill itself
  says to bring the principles to an existing system, not the stylesheet.
- **A `::after` hit area on every small control**, keeping the 24px look. Adjacent hit
  areas overlapped in the rows where two toggles sit 8px apart. The visible control grows
  instead, on a finger only.
- **Darkening the dark-mode brand scale.** The scale is right for text and borders; only
  the fill under a white label was wrong, so only the fill got its own token.

## Consequences

- Buttons are 8px taller everywhere and 44px on a phone; the profile is longer to scroll
  and shorter to find things in.
- A new card anywhere is `<Card>`; a stylesheet that declares `--surface-card` with a
  border and a shadow is a regression.
- `ui/components/Switch` is on in the brand fill, not the status green.
- Measured after: every questioned pair clears 4.5:1 for text and 3:1 for the rest in
  both schemes.

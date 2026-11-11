# 0107 — Five themes, two typefaces and rounder corners replace the numbers of 0041 and 0057

> **Purpose**: one decision record (ADR). Captures the WHY that chat sessions lose.
> **Audience**: future agents and humans. **Committed**: yes. **Maintained by**: agents
> draft one immediately after any decision that constrains future work. ADRs are
> immutable: a changed decision is a NEW record that supersedes the old one.

- **Status**: accepted
- **Date**: 2026-11-11
- **Project**: docs/projects/024-a-livelier-look-in-five-themes
- **Supersedes**: the numbers, not the rules, of [`0041`](./0041-what-a-page-owes-a-reader-who-cannot-see-it.md)
  and [`0057`](./0057-the-interface-follows-the-hig.md), as listed below.

## Context

Project 024 replaces the near-neutral look with the design the owner approved on 2026-11-11
(direction D): warm paper, a tomato-to-saffron accent with olive and plum beside it, an
aubergine dark theme, a heavy grotesque for headings, large corners — in five themes chosen on
the device (`0106`). Phase 1b ships the colours, the type and the switch; layouts are recomposed
in later phases.

`0041` and `0057` set rules and gave them numbers measured against the old palette: the
`--foreground-03` tier, the control edge at 3.15:1, a white label on the light step 09 in both
schemes, iOS's radii. The rules still hold. Their numbers do not, because every colour and
every corner changed.

## Decision

- **Five themes and Automático**, each a block of `apps/web/src/styles/themes.css`: Claro (paper
  `#fbf5ea`, card `#f3e9d9`, ink `#2b1e18`), Oscuro (aubergine `#2a1b26`, card `#3a2735`, ink
  `#fbefe3`), Huerta (mint `#f1f8ef`, leaf green, lime), Pulso (indigo `#140b2d`, coral to pink
  to violet), Alto contraste (black on white, one solid accent, 2px edges, no glow, grain or
  shadow). Automático is Claro, Oscuro, or Alto contraste under `prefers-contrast: more`. A
  `forced-colors` block maps every token to a system colour and wins over all of them.
- **`0041`'s numbers, per theme.** `--foreground-02` and `-03` stay one value and clear 4.5:1 on
  every surface (lowest: Claro on its sunken track, 5.15:1; Alto contraste clears 7:1). The
  control edge `--border-interactive` clears 3:1 on every solid surface (lowest: Claro on its
  sunken track, 3.58:1). `--border-01` stays a divider under 3:1 except in Alto contraste,
  where it is `#595959`.
- **`0057`'s fill, per theme, and a gradient.** A filled control is `--color-brand-fill` →
  `--color-brand-fill-end` (`--gradient-brand-fill`), and its label `--color-on-brand-fill`
  clears 4.5:1 on **both** ends and on the hover fill. The label is white in the light themes
  (Claro `#b93a12` → `#c4501a`, 5.7:1 and 4.7:1) and dark ink in the dark ones, where a white
  label on a bright fill fails (Oscuro `#ff6e45` → `#ff8a3d` under `#2a1b26`, 5.9:1 and 7.0:1;
  Pulso `#ff5a36` → `#ff2e93` under `#140b2d`, 6.1:1 and 5.4:1). The bright accent
  (`--color-accent-start/mid/end`) is only for what carries no small text. Small accent text is
  one solid colour, `--color-brand-11` (Claro `#b23710`, 4.85:1 on the sunken track).
- **`0057`'s radii, rounder.** In `apps/web`: `--radius-control` 12, `--radius-card` 24,
  `--radius-sheet` 28, and a new `--radius-button` that makes every `ui/components/Button` a pill
  without making inputs one. `packages/ui` keeps 10/14/20 and `--radius-button` equal to the
  control's, for `apps/docs`. These are the owner's exception to the design skill's restraint
  (PRD criterion 9).
- **Rings and charts.** `--color-ring-1…4` on `--color-ring-track` clear 3:1 against the track
  and the card. Every `--color-chart-*` clears 4.5:1 on its theme's card and page, which is what
  `prefers-contrast: more` used to raise them to (`0069`); a theme needs no second set.
- **Two typefaces**, both SIL OFL 1.1, self-hosted and subset (`packages/ui/AGENTS.md` § Fonts):
  Figtree for text (`wght` 400–700, 22,464 bytes) and Bricolage Grotesque for `h1`–`h6`
  (`wght` 600–800, optical size kept, width pinned; 85,020 bytes). A new `--font-weight-heavy`
  (800) is for headings only. Together 107,484 bytes against Inter's 116,308.
- **`--card-shadow` and `--grain-opacity` are values of each theme.** Before this they were
  `light-dark()` of things that are not colours, which the browser rejected: no card drew its
  shadow and the grain was painted at full opacity.
- **The contrast gate reads all of it**: five themes, the three Automático blocks, the
  forced-colors block, and the new pairs (both ends of the fill, the highlight tile, the menu's
  rows on its glass, rings on their track, chart marks).

## Alternatives considered

- **White labels on the bright gradient**, as the sheets drew them: 3.9:1 at the tomato end and
  2.1:1 at the saffron end. Failed AA on every primary button.
- **A deeper fill with a white label in the dark themes** (Oscuro `#c2410c`): the label clears
  4.5:1, but the button stands 3.2:1 off the aubergine page against 5.9:1 for the bright fill
  with dark ink — the one primary action of a screen sank into it.
- **Pinning Bricolage's optical size** to save 37KB: every heading would have been drawn with one
  size's proportions; the budget held without it.
- **Pill inputs**, by rounding `--radius-control` to a pill: a field would have read as a button.

## Consequences

- Every primary button carries a gradient and a pill; headings change face and width, so the
  phase's overflow sweep ran on every reachable route.
- A sixth theme is still one block. A new colour token is defined in five blocks, three
  Automático copies (generated by repeating the block) and the forced-colors block, or the gate
  fails.
- `0041` and `0057` keep their rules; read their numbers here.

# 0106 — A theme is a block of token values, chosen on the device

> **Purpose**: one decision record (ADR). Captures the WHY that chat sessions lose.
> **Audience**: future agents and humans. **Committed**: yes. **Maintained by**: agents
> draft one immediately after any decision that constrains future work. ADRs are
> immutable: a changed decision is a NEW record that supersedes the old one.

- **Status**: accepted
- **Date**: 2026-11-11
- **Project**: docs/projects/024-a-livelier-look-in-five-themes

## Context

The owner asked for a redesign with five themes a person can switch from any screen (Claro,
Oscuro, Huerta, Pulso, Alto contraste) plus following the device, and chose to keep the choice
on the device.

Today there are two schemes and no switch. Every colour is a `light-dark(a, b)` pair in
`packages/ui/src/styles/colors.css` under `color-scheme: light dark`, with two
`prefers-color-scheme` blocks in `variables.css`. That mechanism has exactly two values and is
driven by the device alone, so it cannot carry a third theme or a person's choice.

Three constraints shape the answer:

- **The public pages are prerendered**, and `scripts/check-static-pages.mjs` fails the gate if
  one stops being so. Reading a cookie or a header on the server to pick a theme would do that.
- **The Content-Security-Policy has no nonces**, for the same reason; `script-src` allows
  `'unsafe-inline'`, so a small inline script is permitted and nothing else has to change.
- **`apps/docs` imports the same token files** and has no switch.

## Decision

1. **A theme is one block of semantic token values**, selected by `data-theme` on `<html>`:
   `claro`, `oscuro`, `huerta`, `pulso`, `contraste`. **The mechanism is `packages/ui`'s and the
   values are the app's**, as `AGENTS.md` § Branding already divides them: `packages/ui` owns
   the list of semantic tokens, the switch, the script and a neutral default; NutrIA's five
   blocks live in one file under `apps/web/src/styles`. `apps/docs` keeps the neutral default
   and does not turn cream. Components and screens read semantic tokens only and never name a
   theme, a palette step or a raw colour; a test enforces that.
2. **No attribute means Automático**: the Claro block under a light device and the Oscuro block
   under a dark one, by `prefers-color-scheme`, and the Alto contraste block under
   `prefers-contrast: more`. This is also what `apps/docs` and any page whose script did not run
   get, so nothing depends on JavaScript to be legible. `apps/docs` never sets the attribute and
   keeps `packages/ui`'s neutral pair.
3. **The choice is kept in `localStorage`** on the device, as one short string. It is never sent
   to the server and is not an account field.
4. **A static inline script in the document head applies it before first paint**: it reads the
   stored value and, when it is one of the five, sets `data-theme` and the matching
   `color-scheme`. It is the same bytes on every page, so the public pages stay prerendered.
5. **`color-scheme` follows the theme** (light for Claro, Huerta and Alto contraste; dark for
   Oscuro and Pulso), so form controls, scrollbars and the browser's own surfaces match.
6. **`theme-color`** keeps its two media-query entries for Automático; the switch updates the
   meta element when a person chooses a theme.
7. **`forced-colors: active` wins over every theme**: system colours, no gradient, no pattern.
8. **Contrast is a gate, not a review**: a script computes, for every theme, the ratio of each
   foreground/background token pair the components use, and fails under 4.5:1 for text, 3:1 for
   display text, control edges and focus rings.

## Consequences

- `light-dark()` leaves the semantic layer. The palette file may keep it for the docs app's
  default look, but nothing in `apps/web` reads a palette step.
- A sixth theme is a new block and a line in the switch. It is not a change to any component.
- A person's theme does not follow them to another device. That was the owner's choice, against
  an account field that would have needed an API and a database change and would still not have
  covered the public pages.
- A page opened with JavaScript disabled, or by a crawler, renders Automático. That is correct
  for both.
- The stored value is a preference the person sets, kept locally. Whether `/privacidad` needs a
  line for it is the `legal` agent's to say, before the switch ships.

## Alternatives rejected

- **A cookie read on the server**: no flash and no inline script, but every public page becomes
  dynamic, which the gate forbids and SEO pays for.
- **A class or attribute set after hydration**: simple, and every visit flashes the wrong theme.
- **One stylesheet per theme, swapped**: a network request before the right colours, and a
  flash on a slow connection.
- **Keeping `light-dark()` and adding themes as overrides on top**: two mechanisms deciding one
  colour, and the contrast script would have to model both.

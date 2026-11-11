# LOG — Project 024: A livelier look, in five themes

> **Purpose**: append-only execution record. One entry per phase (plus one per
> deviation): what happened, evidence it works, what changed against the plan. This is
> the file future agents read to learn "what was decided in phase X and why".
> **Audience**: humans and agents. **Committed**: yes. **Written by**: the executing agent,
> appending only. Write repo-relative: no absolute paths, no references to other private repos.

## Before phase 0 — how the design was chosen (2026-11-11)

- The owner asked for a total change of look and for two or three proposals before anything was
  built. Three were drawn as static sheets with real dish pictures, on the same screens: A, warm
  and editorial; B, bright with rings and a floating bar, after angular.dev and Apple Fitness;
  C, flat colour blocks.
- He chose a mix, with options: A's colours, B's headings, B's pictures with a strip, and B's
  rings, floating bar and moving pattern. That is direction **D**, in `reference/`.
- He then chose, with options and a recommendation each: the theme switch in the header; the
  themes Huerta, Pulso and Alto contraste beside Claro, Oscuro and Automático; the choice kept on
  the device; the rings on Inicio counting meals marked «Hecha»; shipping in phases; and the
  agent shipping each phase.
- Measured before any code, and written into the PRD: white text fails on the approved gradient,
  small coloured text fails on cream, and the header and bar need rules at 320 px.
- The sheets were made by scripts kept outside the repository. They are not needed again: later
  sheets (phases 6 and 8) are drawn from the real screens.

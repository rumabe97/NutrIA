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

## Phase 0 — What exists, written down (2026-11-11)

- **Executor**: three `general-purpose` agents on sonnet for the inventory (the plan's dispatch),
  the `legal` agent on opus for its two answers, and the lead for the baseline script and the
  measurements. Nothing ran on `fable`.
- **Result**: done.
- **Evidence**:
  - **Inventory**: `inventory/` — five files, about 1,280 rows, 2,140 lines. Every one of the 64
    `page.tsx` files under `apps/web/src/app` is named in it (checked with `find` and `grep -F`).
  - **Baseline**: `baseline/` — 208 files from `baseline.mjs`: public pages in both languages,
    the signed-in app with and without a generated plan, and the console's 20 menu pages, each at
    390 and 1280 px in both languages. A second full run gave identical files (`diff -rq`).
  - **Landing page, Lighthouse mobile, median of five runs on a local production build**:
    Performance 99, Accessibility 100, SEO 100, Best practices 100, LCP 1,513 ms, CLS 0.000,
    TBT 82 ms. One accessibility audit already fails without moving the score
    (`label-content-name-mismatch`): it is fixed in phase 7 with the page.
  - **First visit to the landing page**: 557 KB in all — CSS 25 KB, font 117 KB, script 231 KB,
    document 80 KB.
  - **Legal** (`docs/legal/2026-11-11-redesign.md`): a theme kept in `localStorage` needs no
    consent (LSSI art. 22.2; the AEPD's cookie guide names colour contrast as exempt) and no
    change to `/privacidad`; one sentence is recommended, not required. Generated pictures may
    be shown on the landing page under a checklist (§ 2.8) and a new caption. Nothing blocks.
  - **Typefaces**: Bricolage Grotesque and Figtree are both published under the SIL Open Font
    License 1.1 in their upstream repositories; the licence texts go beside the font files in
    phase 1b. The current font has no licence file in the repository, which phase 1b also fixes.
- **Deviations from plan**, with the plan amended in this change:
  - The inventory is a folder of five files, not one file: it is 2,140 lines.
  - **The console has no header**, so "the switch in every header" cannot mean there what it
    means elsewhere. Phase 1b puts it in the console's menu.
  - **Nothing overflows and nothing is cut** became PRD criterion 6 and a standing rule, after
    the owner sent a crop of the 320 px test render with the rings' legend running out of its
    card. The criteria after it moved down by one.
  - Phase 7 carries the `legal` agent's conditions for pictures on the landing page, and a way
    to hold the measured performance with original-size files.
- **Decisions**: none new.
- **Notes for the next phase**:
  - **The font budget is 117 KB today.** Two families must not cost a first visit much more:
    subset hard, and load only the weights used.
  - `apps/web` has no `not-found` screen outside the console and no `global-error`; a `notFound()`
    in the signed-in app shows Next's default page, which is not in the dictionary and will not
    take a theme unless phase 3 gives it one. The `Toaster` in `packages/ui` is imported nowhere.
  - `account.mjs link` fails with `NotFoundError` in `CareController`, so no professional state
    was captured. Fix the script before phase 6; never build that state by hand.
  - On localhost every account shares one rate-limit bucket: export `RATE_LIMIT_MAX=100000`
    before `servers.sh start`, or pages 404 at random and a baseline is wrong.
  - Dictionary keys `assistant.intro`, `fieldHint`, `back`, `updated` and
    `conversationsEmptyTitle` are rendered by nothing the inventory read; `health.consentLabel`
    reads «Guardad…» in Spanish. Both are noted, neither is this project's to change.
  - The header's anchor links also render on the legal pages, where their targets do not exist,
    and are hidden below 48rem with only the footer carrying them. Phase 7 decides with the page.

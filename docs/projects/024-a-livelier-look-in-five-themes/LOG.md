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

## Phase 1a — The theme mechanism, with today's colours (2026-11-11)

- **Executor**: `frontend-high` on opus. Nothing ran on `fable`; the advisor was not consulted.
- **Result**: done. Branch `024-phase-1a`, on `024-phase-0`.
- **Evidence**:
  - **Nothing a person sees changed, measured two ways.** (1) Every custom property of the token
    files, read in Chrome through real properties (`background-color`, `box-shadow`, `opacity`)
    before and after, in six situations — light and dark device with no attribute, Claro on a
    light and on a dark device, Oscuro on a light and on a dark device — and each of the 15
    stylesheet reads that changed, old expression against new token: every row equal, 148 tokens
    plus the 15 reads; the 12 new tokens are compared through the reads they replace. The same
    over `ui`'s files alone, as `apps/docs` loads them: every row equal. (2) `/local-probe`
    builds of `024-phase-0` and of this branch, full-page screenshots at 390 px of `/`,
    `/acceder`, `/inicio`, `/plan` and `/admin`, light and dark, compared pixel by pixel: all
    identical. With a theme stored on the device against the opposite scheme (Claro on a dark
    device, Oscuro on a light one) each page is pixel-identical to the scheme it stands for.
    One `/inicio` light pair differed at first by a focus ring on the heading: the welcome tour
    is dismissed once per account and returns focus to the `h1`, and only the first capture saw
    it; a fresh account on the new build reproduced it and matched pixel for pixel.
  - `node scripts/check-contrast.mjs`: 2 themes × 46 pairs, 92 pass, 0 known from today, 0 fail,
    0 problems. With `--file` on a copy whose Claro `--foreground-02` was `#aaaaaa` and Oscuro
    `--border-interactive` `#3a3a3a`: 9 FAIL (2.19–2.32:1 text, 1.50–1.59:1 edge) and the
    Automático-dark mismatch reported, exit 1.
  - `apps/web/src/styles/colours.test.ts`: 24 tests green; with `color: #123456` and
    `var(--color-gray-06)` appended to `Switch.module.css` it names both and fails; restored.
  - `packages/ui/src/utils/themeScript.test.ts`: 7 tests — the five themes, unknown values,
    `__proto__`/`constructor`/`hasOwnProperty`, a store that throws, and the inline string run as
    the page runs it, held to the pure function's answer for every value.
  - `pnpm turbo lint ts:check test --filter=web --filter=ui` green; `pnpm --filter docs build`
    green; public pages still prerendered (10/10); `gate.sh --full` green (before the contrast
    step was wired: see Deviations). No console error or warning on any captured page, hydration
    included.
  - `apple-web-design` REVIEW of the mechanism and the touched tokens: PASS, no P0 or P1.
    Not new, reported for phase 1b: the `theme-color` meta still follows the device (`0106` § 6
    gives that to the switch), and the two invalid values below.
- **Deviations from plan**:
  - **The contrast script, the gate step, the CI step and this entry were written by the lead**,
    not the executor: the edit guard gives `scripts/`, `.claude/` and `docs/` to the lead, so the
    executor handed them over as files and a patch.
  - **`--card-shadow` and `--grain-opacity` stay in `styles/variables.css` as they were**, not in
    `themes.css`. Both are `light-dark()` of things that are not colours (whole shadows, numbers),
    which is invalid: today no card draws its shadow or its top highlight (Card's whole
    `box-shadow` is invalid at computed-value time and falls to `none`), and the grain layer is
    painted at opacity 1, not 0.028/0.05. Giving them a value per theme would have changed the
    screen, which this phase may not do. Measured in Chrome 157.
  - The colour test also fails on a `prefers-color-scheme` query in a module stylesheet, which
    the plan did not list: under a chosen theme such a query paints the device's scheme. None
    exists today.
  - Twelve tokens were added: `--color-track`, `--color-track-hover`, `--color-error-surface`,
    `--color-error-border`, `--color-warning-surface`, `--color-warning-border`,
    `--color-code-ground`, `--color-code-ink`, `--color-switch-thumb`, `--color-on-error-fill`
    (the last two also in `ui`'s neutral default, which its own components read),
    `--color-brand-halo` and `--color-brand-fill-disabled` (derived with `color-mix()` from each
    theme's own values in one shared block of `themes.css`). The checkbox tick reads the existing
    `--color-on-brand-fill`.
- **Decisions**: none new. The storage key is `nutria-theme` (`ui/utils/themeScript`,
  `THEME_STORAGE_KEY`), beside the app's other `nutria-*` keys; the value is one of `claro`,
  `oscuro`, `huerta`, `pulso`, `contraste`, and anything else is Automático.
- **Notes for phase 1b**:
  - **`KNOWN_TODAY` is empty**: every declared pair cleared its floor in both schemes. Under 3:1
    and deliberately not in the pair list: `--border-01` (1.26:1 light, 1.45:1 dark — a divider,
    `0041`) and the state step-09 colours drawn as a note's inline-start edge (warning
    `#ffb224` 1.76:1 on the light page, success 3.08:1) — the edges phase 2 removes.
  - Each new theme block must define every token the Claro block does, and the Automático dark
    block must stay byte-for-byte the Oscuro block: the contrast script fails otherwise. A
    `prefers-contrast: more` block for Alto contraste will need the script taught to read it
    (today it reports any rule it does not know as a problem).
  - The chart colours (`--color-chart-*`, `0069`) still live as `light-dark()` pairs in
    `ui/styles/colors.css`; they follow the theme through `color-scheme`, which is right for
    Claro/Oscuro only. Huerta and Pulso need their own chart values, in `themes.css`.
  - `--card-shadow` and `--grain-opacity` (above): decide whether cards get the shadow they were
    designed with and the grain its intended opacity — either is a visible change.
  - The theme is a device preference: `forgetOfflineCopies()` must not drop `nutria-theme` on
    sign-out. The switch updates the `theme-color` meta (`0106` § 6).
  - Not updated here, outside this phase's scope: `apps/web/AGENTS.md` § Styles (the import list
    now ends with `styles/themes.css`; `TwoFactorQr` no longer reads palette tokens) and the
    § CSS conventions/§ Branding text of the root `AGENTS.md` — phase 1b rewrites both.
  - Not run in this phase: the phase-0 baseline diff (`baseline.mjs`); the DOM changed only in
    `<head>` (one script) and the `<html>` attributes, which the accessibility tree does not read.
- **Lead's check, same day**: the four lead-owned files were read and put in place by the lead
  (`scripts/check-contrast.mjs`, the gate and CI steps, this entry). `gate.sh --full` with the
  contrast step: green. The phase-0 baseline re-run on this branch — public pages in both
  languages, the signed-in app without a plan and the console, 164 files: 160 identical. The four
  that differed were `/admin/ajustes`, where one local switch had been left on when phase 0 was
  captured; those four baseline files now hold the switch off, which is the state a clean local
  database has. No control was lost.
## Phase 1b — New colours, new type, five themes and the switch (2026-11-11)

- **Executor**: `frontend` on opus, on branch `024-phase-1b` (on `024-phase-1a`). Nothing ran on
  `fable`; the advisor was not consulted.
- **Result**: done, waiting on the owner's iPhone check (human-verify).
- **What changed**:
  - `apps/web/src/styles/themes.css`: five blocks (Claro, Oscuro, Huerta, Pulso, Alto contraste),
    Automático on a light, a dark and a more-contrast device, the shared derived tokens re-derived
    on every `[data-theme]` element (so a preview is drawn in its own theme), and a
    `forced-colors` block mapping every token to a system colour. New tokens:
    `--color-brand-fill-end`, `--color-accent-start/mid/end`, `--color-ring-1…4`,
    `--color-ring-track`, `--color-highlight-fill`, `--color-on-highlight-fill`,
    `--border-width-interactive`, and per theme `--color-chart-*`, `--card-shadow`,
    `--grain-opacity` (step 0 carried from 1a: both were invalid `light-dark()` values; cards now
    draw their shadow and the grain its intended strength). `packages/ui` declares the new tokens'
    neutral defaults, `--font-weight-heavy` (800), `--radius-button`, the gradients.
  - Corners (`apps/web/src/styles/variables.css`): control 12, card 24, sheet 28, every
    `ui/components/Button` a pill; the primary button wears `--gradient-brand-fill`.
  - Fonts: Figtree (text, `wght` 400–700, 22,464 B) and Bricolage Grotesque (`h1`–`h6`, `wght`
    600–800, `opsz` kept, `wdth` pinned, 85,020 B), both OFL 1.1 with their licences beside them,
    from pinned upstream commits; Inter's two files removed. `packages/ui/scripts/build-fonts.sh`
    replaces the manual procedure.
  - `ui/components/ThemeSwitch` (on `Dropdown`, with new `DropdownRadioGroup` /
    `DropdownRadioOption`), `ui/hooks/useTheme`, `ui/utils/theme`. Rendered beside the language
    switch in `SiteHeader`, `AuthShell` and `AppNav`, and in the console's bar below 60rem and at
    the foot of its sidebar above. «Apariencia» in Perfil (`components/AppearancePicker`): six
    native radios with previews drawn by each theme's own tokens.
  - At 320 px: `SiteHeader` and `AppNav` hide the wordmark below 22.5rem (the mark keeps the
    link's name) and `AppNav`'s sign-out becomes an icon whose name is still «Cerrar sesión».
  - Icons, manifest, `theme-color` and the shared-link picture take their colours from
    `lib/brandColours.ts`, held to `themes.css` by a test; the leaf keeps its shape, drawn in the
    tomato-to-saffron gradient on aubergine.
  - `/privacidad`: the `legal` agent's sentence (§ 1.6), approved by the owner, appended to the
    second paragraph of «Cookies y almacenamiento en tu dispositivo» in both languages;
    `privacy.updated` is 11 November 2026; no version moved.
- **Evidence**:
  - `node scripts/check-contrast.mjs`: 5 themes × 77 pairs, 385 pass, 0 fail. Lowest: Claro's
    rings on their track 3.29–3.35:1 (floor 3), Claro's small accent text on the sunken ground
    4.85:1 (floor 4.5).
  - Fonts: 107,484 B for both families, against 116,308 B for the one before.
  - Unit: `ui` 506 tests, `web` 343 tests; the switch has eight of its own (nothing stored on
    open, choose, Automático clears, two switches agree, another tab, storage blocked).
  - Control baseline, 164 files re-run: no line gone. New: the «Tema» button on every page, and
    on Perfil the «Apariencia» heading and its six radios.
  - **Overflow** (PRD 6). By the executor, Automático light and dark at 320, 390 and 1280: 628
    page loads — the 11 public paths in both languages, the signed-in routes with and without a
    plan in both languages, the console's 20 pages — none overflowed or was cut. By the lead, on
    the built branch: the seven busiest signed-in screens in all five themes at 320, 360, 390,
    768 and 1280 (175 loads), four console pages in five themes at four widths: clean. **The
    public pages at 768 px failed**: with the theme menu added, the header's row ran 76 px past
    the screen in every theme. Fixed here — the section links join the row from 64rem, where it
    holds them; below that the footer carries them, as it already did below 48rem. Then a new
    sweep, `widths.mjs` (every width from 320 to 1400 in steps of 16), on 7 public paths, 11
    signed-in routes and the console's 20: no width scrolls sideways.
  - `gate.sh --full`: green (one earlier run failed in two API auth specs under machine load;
    alone they pass 60 of 60, and no API file is in this change). `pnpm --filter docs build` green.
- **Deviations from plan**:
  - `scripts/check-contrast.mjs`, the probe's `--themes` and per-element overflow check, the root
    `AGENTS.md` sections, this entry and ADR `0107` were written by the executor as files for the
    lead (the edit guard).
  - Chart colours are held to 4.5:1 on their card in every theme rather than 3:1, so no theme
    needs a second set under `prefers-contrast: more`; ui's palette keeps its own for `apps/docs`.
  - The sign-out icon and the wordmark rule are AppNav's and SiteHeader's own media queries, not
    a shared component: phase 3 rebuilds the shell.
- **Decisions**: `0107` (supersedes the numbers of `0041` and `0057`).
- **Notes for the next phase**:
  - The display-size gradient word (PRD § "What changes", 2) needs its own darker end: the bright
    saffron end is under 3:1 on cream. No token exists for it yet.
  - `--color-accent-*` is bright and not text-safe anywhere: only rings, bars, the pattern.
  - The text face has no `✓ ✗ ⚠ ≈ ⌘`; the system face draws them.
  - The professional's screens were not probed (`account.mjs link` still fails, phase 0 note).
- **Lead's check, same day**: the executor stopped before its last checks, waiting on a local
  server that had gone down; the lead took the branch, ran what was missing (above), and made two
  changes: the header breakpoint, and Alto contraste's three lightest accent steps, which were
  pink and drew a tinted wash on the next-meal card — they are neutral greys now, so that theme
  has no gradient, as the PRD says. Not done here, and said so: the no-flash measurement and the
  first-visit bytes (the script exists; the inline script's logic is unit-tested and ran in every
  probe above, which set the theme through it), and a written `apple-web-design` review beyond
  the executor's read of the screenshots (no P0 or P1 seen; the owner's exceptions apply).
- **Waiting on the owner (human-verify)**: the five themes on his iPhone — no flash on opening,
  the browser bar's colour following the theme, dark ink on the bright buttons of Oscuro and
  Pulso, and the strength of the background glow now that it draws as intended.

## After phase 1b — the theme menu opened out of sight on a scrolled page (2026-11-11)

- **Reported by the owner** on his iPhone, minutes after 1b went live: scroll, press «Tema», and
  the menu «desaparece, parece que se sube arriba del todo».
- **Cause**: `ui/components/Dropdown` was modal. A modal Radix menu locks the page's scroll by
  setting `overflow: hidden` on `<body>`; with `overflow-x: clip` on `<html>` that makes `<body>`
  the scroll container, so a sticky header stops sticking to the screen and returns to the top
  of the document, taking the menu anchored to it. Measured at a scroll of 1,500 px: the menu was
  placed at y = −1,448.
- **Fix**: the menu is not modal. It closes on a press outside and on Escape, and stays under its
  trigger. Measured again at the same scroll: y = 52 on a phone, 46 on a desktop, right under the
  button.
- **Why the probes missed it**: every probe opened a page at its top. A control in a sticky header
  is now also tried on a scrolled page.
- **Note for phase 3**: `Select`, `Dialog` and `Drawer` lock the scroll the same way, so the
  header leaves the screen while one is open. Behind a dialog's overlay nobody sees it; behind a
  select they may. The shell phase decides whether the lock or the header's stickiness changes.
## Phase 2 — The shared pieces (2026-11-11)

- **Executor**: `frontend` on opus, branch `024-phase-2` (on `024-phase-1b-ship`), with one
  forked helper for the 37 note replacements (no builds, no commits of its own). Nothing ran on
  `fable`.
- **Result**: done, for the lead's check.
- **What changed**:
  - **The motion system** (`ui/styles/motion.css`, tokens in `ui/styles/variables.css`): three
    springs (`--spring-gentle` / `lively` / `firm`) as `linear()` sampled from damped springs, with
    cubic-bezier fallbacks redefined under `@supports`; entrance durations 200 / 400 / 600 ms; named
    transitions `--motion-enter`, `-enter-short`, `-exit`, `-axis`, `-figure`, `-answer`; stagger
    50 ms, capped at the eighth row. Classes for entrances (rise, fade, scale-in, list), figures
    (sweep, draw, grow-x/y, swing, `.motion-figures`), place (shared axis, sheet, unfold from
    `--motion-origin`), answers (press, drop-in, close-up, strike, tick), and the
    `[data-in-view='waiting']` pause. The View Transition names are documented (`dish-<id>`,
    `dish-title-<id>`, `day-<index>`); phases 3–4 wire routes.
  - **The in-view trigger**: `ui/hooks/useInView` over one shared `IntersectionObserver`
    (`ui/utils/observeInView`), `ui/components/InView`; `apps/web`'s `Reveal` is now its consumer
    (`data-reveal="waiting" | "shown"`, landing behaviour unchanged).
  - **The count-up**: `ui/hooks/useCountUp` renders only the final value and writes the counting
    into the visible figure's text node, without a render; `ui/components/CountUp` holds the width
    with an invisible copy and gives assistive technology the final text at once. `StatTile` counts
    up when given `amount` (the console's summary passes it for its six whole-number tiles).
  - **`Note`** and **`Rings`** in `packages/ui`, with docs pages (`note`, `rings`, `count-up`,
    `motion`) and tests.
  - **The restyle**: Button presses (scale 0.97 on the firm spring) and the filled one carries its
    glow; colour transitions removed everywhere (only transform and opacity move); Switch springs
    its knob (48×28), Checkbox (20 px) springs and draws its tick; Tabs is the segmented control
    (sunken track, chosen segment in the text colour, heavier weight); Input turns its edge to the
    accent on focus and draws its error as icon and words; Dropdown, Select and ContextMenu unfold
    from their trigger; Dialog rises; Accordion and Collapsible move their words instead of a
    height; Skeleton's wave travels by transform; DataTable heads in small capitals; StatTile's
    figure is the heavy display face. Charts: `ChartFrame` wraps its body in `InView`; bars and the
    gauge grow, columns rise, lines and sparklines draw, donut slices sweep.
  - **The 37 coloured-edge rules** are gone: block notices are `Note` with a tone and the tone in
    a word (`common.noteTone` in both dictionaries), form errors are Note's flat inline line. The
    grep finds nothing — no rule was a divider.
  - New ui defaults: `--surface-sunken`, `--color-warning-surface`, `--color-error-surface` (the
    web themes already define all three).
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web --filter=ui`: 14 tasks green; `ui` 65 files /
    532 tests (new: Note 6, Rings 8, useCountUp + CountUp 6, useInView 5, StatTile +1), `web` 39 /
    343. `pnpm deadcode` clean. `pnpm --filter docs build` green.
  - The edge grep over `apps/web/src` and `packages/ui/src` returns nothing.
  - Contrast, with the patched script: 5 themes × 83 pairs, 415 pass, 0 fail.
  - Control baseline (public both languages, `noplan` on ten app routes, the console's 20 pages;
    164 files): no line gone. The only lines that differ from the phase-0 files are phase 1b's
    («Tema»/«Theme» everywhere, «Apariencia» and its six radios on Perfil). A note's role and name
    did not change anywhere. The `plan` state was **not** re-run (no generated plan on a probe
    account).
  - Overflow, `probe.mjs` (scrolled or cut, element by element): the docs app's 23 component pages
    at 320/360/390/768/1280 light and dark, 230 loads, clean after two fixes (two code blocks cut at
    320, the segmented control wrapping into a blob); the app's note screens — `/`, `/en`,
    `/acceder`, `/en/acceder`, `/asistente`, `/perfil`, `/inicio`, `/plan`, `/plan/generando`,
    `/onboarding/6`, `/onboarding/9`, `/check-in`, `/compra`, `/progreso` in both languages,
    `/admin`, `/admin/generacion/ia`, `/admin/ajustes` in both — at five widths in Claro and Oscuro,
    and `/asistente`, `/perfil`, `/inicio`, `/onboarding/9`, `/`, `/admin` in Huerta, Pulso and Alto
    contraste: 407 loads, 0 hits. `/en` at 768 and 1280 never reaches network idle (a prefetch of
    `/en/registro?_rsc` stays pending); it was probed with a scratch copy of the probe that waits
    for `load` instead, clean. `widths.mjs` (320→1400 every 16 px) on 21 route/language pairs:
    clean. The header's theme menu opened on a scrolled `/` and `/perfil` at 320 and 1280: inside
    the screen, header stuck. Dialog and Select opened at 320 on the docs pages: inside, nothing cut.
  - Motion (PRD 15), Chrome, 4× CPU, 390 px: CLS 0.0000 on every page measured (nine docs pages,
    `/admin`, `/admin/generacion/ia`, `/inicio`, `/asistente`, `/perfil`, `/`). Long tasks over
    50 ms: the same ones with reduced motion on (hydration, 150–190 ms at ~200 ms; 50–76 ms tasks
    later) — none attributable to an animation. Properties seen animating: `opacity`, `transform`,
    `stroke-dashoffset`, `stroke-dasharray`; on `/` also SiteHeader's `border-bottom-color` (a
    phase-3 shell transition, not this phase's). With reduced motion: no animation longer than a
    frame running at load, and every counted figure already final. The count-up was seen counting
    (115 text frames on `/admin`'s first load, and again on a client navigation back to it).
  - `apple-web-design` REVIEW of Note, Rings, Button, Switch, Checkbox, Tabs, Input and ColumnChart:
    PASS, no P0 or P1.
- **Deviations from plan**:
  - `scripts/check-contrast.mjs` gains three pair groups (Note's words on its warning and error
    grounds, success text on the sunken ground, the segmented control's chosen segment): patch in
    `for-lead-2/`, 5 themes × 83 pairs, 415 pass.
  - The segmented control's track and segments are nested rounded rectangles, not pills: at 320 px
    three segments wrap, and a wrapped pill is a blob.
  - Switch and checkbox keep the brand fill for "on", not the sheets' olive: one colour says
    "chosen" everywhere, and a new token would have been eight blocks for a hue.
  - The landing safety items, two console cost warnings that already begin with «Aviso:», and the
    fixed-meal planner's live consequence carry no tone word (their own words already say it).
  - The assistant's warning uses its own approved label («Aviso» / «Notice») as the visible tone word.
  - `apps/docs`' code blocks now wrap long lines (two pages ran past a phone's edge).
  - **A figure the server painted does not count up when the page hydrates more than 600 ms after
    navigation start and the figure is already on screen** (`useCountUp`): counting a number the
    reader has already read back from zero is a flash. On a slow phone's first load that will often
    be the case; client navigations and figures below the fold always count. PRD 15 says every
    counted figure has an entrance — this is the one place it may not, by design.
  - **The restyle is the controls and figures, not all 48.** Changed: Accordion, Button, Checkbox,
    Collapsible, ContextMenu, DataTable, Dialog, Drawer, Dropdown, Input, Select, Skeleton, Switch,
    Tabs, StatTile, ChartFrame, BarChart, ColumnChart, LineChart, DonutChart, Gauge, Sparkline;
    Carousel and RadioGroup lost their colour transitions. Left as 1b had them (tokens, radii, pill
    buttons, gradient fill already applied, and nothing in the sheets asks more of them): the layout
    and type primitives (Container, Flex, Grid, HStack, VStack, Section, Spacer, Heading, Text, Code,
    Label, Divider), AspectRatio, Avatar, Image, Picture, Link, MarbleEffect, RovingFocusGroup,
    Sidebar, Slider, Spinner, Spotlight, ThemeSwitch, Toaster. `apps/web`'s `Card` is untouched (not
    in `packages/ui`; the shell and screens are phases 3–5). Switch and checkbox keep the brand fill.
  - 23 colour/size transitions remain in `apps/web` stylesheets (SiteHeader, AppNav, MealRow,
    AssistantChat, PlanDayNav, PeriodSelector, OptionCards, MealSwap, LocaleSwitcher, ChipGroup,
    AdminNavList, the dish page, TargetProgress, PasswordMeter, NextMeal, PlanProgress and others):
    screens of later phases, each to go to transform/opacity when its phase rebuilds it.
  - `Dropdown` carries `modal={false}` (the lead's fix on main), so no menu locks the page's scroll.
- **Notes for the next phase**:
  - `Rings` has no visible legend; when Inicio draws one with the same figures, give `Rings` a way
    not to repeat its hidden list.
  - The phase-0 professional state is still not capturable (`account.mjs link`); the `Care*` and
    `Practice*` notes were not seen in a browser.
  - Under `(pointer: coarse)` the bare ui `Switch` is 28 px tall; every app use sits in a row
    (`SettingSwitch`) that is the target.

## Phase 1b — confirmed by human (2026-11-11)

- The owner, on his iPhone, after the themes went live: *«Al cambiar de tema no parpadea, se ve
  bien.»* Phase 1b confirmed by human on 2026-11-11. He had reported one bug the same evening (the
  theme menu on a scrolled page, fixed in #364); nothing else.
- **Lead's check on phase 2, same day**: branch taken into the main checkout with `main` merged
  (the non-modal `Dropdown` of #364 kept). Contrast: 5 themes × 83 pairs, 415 pass. Overflow on
  the built branch: eight signed-in screens with a generated plan in five themes at 320, 360, 390,
  768 and 1280 (200 loads); four public pages in three themes at five widths; five console pages
  in three themes at four widths; `widths.mjs` from 320 to 1,400 on twelve routes: no hit. Control
  baseline with a plan account (the state the executor could not run), nine routes: nothing gone
  but data — another plan's shopping items and the greeting's time of day. Read on screen: the
  assistant's warning as a flat block with its icon, and the console's summary.
- **Open, for the owner**: the count-up leaves a figure alone when the page hydrates late and the
  figure is already on screen, so a number somebody has read does not jump back to zero. That is
  narrower than PRD 15's "every counted figure"; it stays as built unless he says otherwise.
- **Not in this phase, by the executor's own count**: 26 of the 48 `ui` components keep phase
  1b's look (layout and type primitives and a few leaf components), and 23 colour or size
  transitions remain in `apps/web` stylesheets that phases 3–8 rebuild.
## After phase 2 — a select's words were blue on an iPhone (2026-11-11)

- **Reported by the owner**, with a screenshot of Perfil in Pulso: «Elige un día» and «Elige una
  comida» in the system's blue.
- **Cause**: `ui/components/Select` named no colour on its trigger. Its `.label` did, but Radix's
  `Value` drops the class it is given, so the words took the `<button>`'s own colour — which on
  iOS Safari is the system blue. Chrome paints `buttontext`, so no probe showed it.
- **Fix**: the trigger names its colour (the text colour for a chosen value, one tier quieter for
  the placeholder), and the reset in `ui/styles/base` makes every `button`, `input`, `select` and
  `textarea` inherit the page's colour unless its own stylesheet says otherwise.
- **Not looked at in a browser**: phase 3's executor holds the local ports. Unit tests and the
  gate are green; the owner's iPhone is the check.

## Phase 3 — The shell: header, floating bar and rail (2026-11-11)

- **Executor**: `frontend` on opus, branch `024-phase-3` (on `024-phase-2-ship`). Nothing ran on
  `fable`; the advisor was consulted before the build and before hand-back.
- **Result**: done, for the lead's check; human-verify on the owner's iPhone pending.
- **What changed**:
  - **One nav** (`components/AppNav`, «Navegación principal»), drawn as a glass pill floating
    above the foot of the screen below 48rem and as a rail at the side from 48rem; the header's
    own links are gone. The destinations and their conditions moved, unchanged, to
    `AppNav/destinations.ts`, with 11 unit tests (five, six with the assistant before Perfil,
    seven with Consulta last, the offline filter, both dictionaries, exactly one current).
  - **The current destination**: `aria-current="page"`, a filled marker (`--gradient-brand-fill`
    under `--color-on-brand-fill`) and its words; the others icons whose words are their names.
    The words drop below 22.5rem with six, below 25rem with seven, and under the large-text query.
    The marker slides from the last destination by `transform` (`AppNav/useMarkerSlide`, a FLIP
    with WAAPI on `--duration-enter` / `--spring-gentle` read from the stylesheet; none under
    reduced motion). A pressed destination is marked at once, so the bar's items settle inside
    the tap's input window instead of when the next screen arrives; the press is dropped in the
    render that sees a new address (a first version kept it ten seconds, so going back to the
    screen it was made on put the marker on the wrong destination — found in review, fixed, and
    checked: tap Plan, arrive, go back → `aria-current` on Inicio).
  - **Tokens** (`styles/variables.css`): `--app-header-block`, `--app-bar-padding`,
    `--app-bar-block`, `--app-bar-offset` (12px + `env(safe-area-inset-bottom)`),
    `--app-bar-clearance` (0 from 48rem), `--app-rail-inline`, `--app-rail-offset`,
    `--duration-drift`, `--ease-drift`. Read by the layout's bottom padding, the assistant's box
    (`bottom: var(--app-bar-clearance)`), the assistant column's height, the history sidebar's
    sticky offset and the scroll padding. No `56px` or `3.5rem` is left in the signed-in shell.
  - **The header**: brand (heading face), language, theme, sign-out. Compact (mark only, sign-out
    an icon with its name) below 23.5rem rather than 22.5rem: measured, the row wrapped at 368px on
    a phone. Offline it hides the language switch and sign-out as before. Its glass fades in over
    the first `--app-header-block` of scroll (scroll-driven opacity), so the pattern shows at the top.
  - **The hatched pattern** behind the header region of the signed-in tree: short slanted dashes in
    `--color-accent-mid`, masked to fade, drifting down by whole tiles on `transform` over
    `--duration-drift` and trailing the scroll by `translate` (scroll-driven, 6rem over 14rem).
    `--pattern-opacity`, new in every theme block (Claro and Automático light 0.2, Huerta 0.3, Oscuro, Pulso and
    Automático dark 0.28, Alto contraste, `prefers-contrast: more` and forced colours 0). The
    ambient glows and grain are off on the signed-in screens only
    (`body:has([data-shell='app'])`); public pages and the console keep them.
  - **The scroll lock** (LOG, after phase 1b): `html:has(> body[data-scroll-locked]) {
    overflow-x: visible }` in `styles/globals.css`. See Decisions.
  - **`(app)/not-found.tsx`**: the signed-in tree's 404 inside the shell, `errors.notFound` and
    `errors.boundaryHome`, no new keys.
  - `appNav.sectionsLabel` removed from both dictionaries (the header's nav is gone).
  - **`ui/styles/base`'s reduced-motion rule** also sets `animation-timeline: auto !important`.
  - **Focus in the header no longer scrolls the page**: `.header *` carries a negative
    `scroll-margin-block-start` that cancels the header's scroll padding (the menu's own rows
    never moved the page, arrows included, so they carry nothing). Before, focusing language, theme or sign-out, or opening
    «Tema», on a scrolled page moved it up by 368px (measured at 390px; pre-existing since the
    padding and the sticky header both predate this phase).
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web --filter=ui`: 14 tasks green; `ui` 65 files / 532
    tests, `web` 40 / 354 (11 new in `AppNav/destinations.test.ts`). `pnpm deadcode` clean.
    `pnpm --filter docs build` green. `node scripts/check-contrast.mjs`: 5 × 83, 415 pass (no new
    pair: the bar and rail use `--foreground-02` on `--color-glass` / `--background-01` and
    `--color-on-brand-fill` on both fill ends, all already in the list).
  - **Text over the hatch**, worst case — the text colour against a dash pixel where the mask is
    full: Claro `--foreground-02` 4.87:1, `--color-brand-11` 4.59:1 (at 0.3 they were 4.41 and 4.39,
    so Claro went to 0.2); Huerta 4.89 / 5.61; Oscuro 4.64 / 4.63; Pulso 5.88 / 5.69.
  - **Seven destinations**: `account.mjs link` fixed in a patch (`for-lead-3/`), run from a scratch
    copy: a real professional + linked client. 7 destinations at 320 fit (pill 312px, every target
    44×44, current one icon-only below 25rem, named from 400).
  - **Control baseline** (`baseline.mjs`, `noplan` and `plan`, 11 + 12 routes, both languages,
    phone and desktop, 92 files, 84 with a phase-0 twin): no line gone but data (another plan's
    dishes and shopping rows, the greeting's time of day) and `/consulta` for a non-professional,
    where Next's «This page could not be found.» / «404» became «No hemos encontrado lo que
    buscabas.» / «We could not find…» + «Ir al inicio» / «Go to the dashboard». Every destination
    link, «Cerrar sesión», «Idioma» and «Tema» present by name at both widths. Added beyond phase
    1b's lines: none. The nav landmark «Secciones» is not in the baseline (it reads headings and
    controls); the one nav is «Navegación principal» at every width.
  - **Overflow** (`probe.mjs`, element by element): every signed-in route with a generated plan
    (12, a dish included) at 320/360/390/768/1280 in Claro and Oscuro, Spanish: 120 loads, 0 hits;
    eight routes with seven destinations, English, same widths and themes: 80, 0 hits; the five
    busiest in Huerta, Pulso, Alto contraste: 75, 0 hits; after the last CSS change, four routes
    again: 40, 0 hits. `widths.mjs` (320→1400) on the 12 routes: clean. A shell sweep of its own,
    because the bar and the rail are fixed and the document's scroll width never sees them (nav and
    every destination inside the screen, ≥ 44×44, nothing clipped, one `aria-current`, the header
    on one line at normal text): 320→1392 every 16px as a phone with seven destinations in both
    languages (22 route sweeps), as a desktop pointer with a plan (11), in Oscuro and Pulso (12):
    clean after the header fix. 200% text at 320/390: no sideways scroll (header wraps, as the
    large-text rule says).
  - **Last row above the bar**: `/compra`, `/inicio`, `/asistente` at 320/360/390 in Claro and
    Oscuro: 60–61px between the lowest visible element and the bar's top. `/plan` reported a
    negative gap from a collapsed ingredient list (an invisible `ul`); the screenshot shows the
    day's card ending 63px above the bar.
  - **Targets**: at 320, 360 and 390 every destination 44×44 (the named one 85–116×44); rail 78×60.
  - **Keyboard** (390 and 1280, seven destinations): skip link › brand › Español › English › Tema
    › Cerrar sesión › the seven destinations › main; every destination focused on screen with a
    visible ring; exactly one `aria-current`; after the skip link, the next Tab is in `<main>`.
  - **Scroll lock**, scrolled page: Select on `/perfil` at 390 and 1280 — header at (0,0) / (96,0)
    before and during, scroll unchanged, no sideways scroll, list inside the screen; with the rule
    undone (control) the header went to y = −1,155. Conversations drawer on `/asistente` at 390 and
    768: header held at 0 (control: −68; the page only scrolls 68px there). Theme menu at 320 and
    1280 at scroll 1,500: header held, menu under its button, scroll unchanged.
  - **Assistant** (390): bar hidden while the box has focus, still hidden 150ms after blur,
    back at 550ms; box bottom 542 vs bar top 636; last message above the box. A thread long enough
    to scroll on its own could not be built: the stub model answers nothing, so two turns. At the
    top of a short screen (390×560 and 320×560), where the box is stuck rather than in flow: box
    bottom 450 above the bar's top 496; focused, the bar hidden and the box at the foot (518 of
    560). There the page's words pass behind the quota line under the box, which has no ground of
    its own (project 023's choice, `AssistantChat`, not this phase's offset): see Notes.
  - **Screens the shell wraps beyond the destinations**: `/onboarding/1`, `/4`, `/9`,
    `/plan/generando`, `/consentimiento`, `/invitacion/<token>` at 320/360/390 (+768/1280 for the
    invitation) and swept 320→1392 as a phone: clean; «Atrás / Continuar» on onboarding sit above
    the bar. (`/invitacion` bare is Next's global 404, outside every layout, as before.)
  - **Offline** (worker serving, network cut, clock moved 10 minutes): Inicio, Plan, Compra only;
    header keeps brand and «Tema», drops language and sign-out; the bar renders (188×52 at 390) and
    the rail at 1280; the notice is there.
  - **404s**: `/asistente` with the switch off, a made-up conversation, `/consulta` for a
    non-professional, a made-up dish: 200 with `noindex`, the streamed not-found — the same with
    and without the new screen (control build with `not-found.tsx` set aside).
  - **Motion** (390, 4× CPU, `/inicio` → Plan → Inicio by tapping the bar): marker slides on WAAPI
    `transform`; the hatch on `transform` + `translate`; the header glass on `opacity`. CLS without
    recent input 0.0000 (two shifts of the bar, both inside the tap's input window); long tasks:
    2 at load, 0 during the taps. Reduced motion: no drift (`transform: none`), the hatch's
    `translate` fixed at 6rem whatever the scroll (before the base fix it followed it), no marker
    slide, CLS 0.
  - Forced colours (emulated): no hatch, the current destination on `Highlight`.
  - `apple-web-design` REVIEW of the bar, rail and header: PASS, no P0 or P1 (see the PR).
- **Deviations from plan**:
  - `packages/ui/src/styles/base.css` (outside the phase's listed scope): the one reduced-motion
    rule gains `animation-timeline: auto !important`; without it a scroll-driven animation is not
    stilled by reduced motion, so the pattern would have followed the scroll.
  - The header goes compact below 23.5rem, not 22.5rem (PRD § "What changes", 5 says 360): at
    368px on a phone the row wrapped.
  - Scroll margin on the header's controls (a defect older than this phase,
    in scope because the header is).
  - The sheets' bar is dark ink; this one is glass (PRD § "What changes", 6 keeps glass on the
    floating bar), so no new colour token. The rail draws the current destination on the same
    filled marker as the bar, not as a tinted icon.
  - The brand stays in the header at every width (the sheet puts the mark atop the rail on desktop):
    the task said nothing moves out of the header.
- **Decisions**: the scroll lock. Lift `<html>`'s horizontal clip only while `body` carries
  `data-scroll-locked`, rather than a fixed header with a spacer: one rule, the header keeps
  wrapping and growing at large text (a spacer would have to copy its height), Safari's drawer path
  (`vaul` sets `body` fixed) leaves a sticky header at the top anyway, and outside a lock nothing
  changes, so the clip `ui/styles/base` keeps for iOS stays.
- **Notes for the next phase**:
  - Every screen that pins something to its foot reads `--app-bar-clearance`; nothing types 56px.
  - The hatch's text contrast is measured by hand; a pair for "text over the hatch" in the contrast
    script would need it to blend a token at `--pattern-opacity` over the page.
  - `env(safe-area-inset-bottom)` is 0 unless the viewport says `viewport-fit=cover`, which it does
    not; the bar floats 12px above the screen's edge whatever the device. Only the iPhone can say.
  - Not measured in Chrome: the keyboard on a phone, vaul's Safari path, the home indicator,
    Safari's handling of the scroll-driven header glass and parallax.
  - The assistant's composer has no ground: on a short screen the page's words pass behind its
    quota line. The phase that rebuilds the assistant (5) should give the composer a ground or a
    fade; this phase could touch only its offset.
  - The signed-in 404s answer 200 with `noindex` (the `(app)/loading.tsx` boundary has streamed
    the shell before `notFound()` runs) — before and after this phase alike.
  - The probe folder this session shares holds `fresh.txt`, `meal.txt` and `noplan.txt`, cookie
    files this executor did not make; whoever made them should delete those accounts.
- **Waiting on the owner (human-verify)**: on the iPhone, the bar clear of the home indicator, the
  bar gone while typing and back after, the assistant's box above the bar and above the keyboard,
  the last row of the shopping list and of a plan day above the bar, the header turning to glass
  once the page scrolls (transparent at the top), «Tema», a Select (Perfil) and «Tus
  conversaciones» on a scrolled page with the header staying put, and tapping a destination then
  swiping back (the marker follows).
- **Lead's check on phase 3 (2026-11-12)**: branch taken into the main checkout with `main`
  merged. The probe's `link` step works again with the executor's patch (the professional accepts
  the agreement through its own route; no row by hand), so the professional's state can be
  captured from now on. On the built branch: six signed-in routes with a generated plan at 320,
  360, 390, 768 and 1280 in Claro, Oscuro, Pulso and Alto contraste (120 loads), a professional
  with seven destinations at four widths, and `widths.mjs` from 320 to 1,400 on seven routes: no
  hit. Looked at: the pill at 390 in Claro and Pulso, seven icons at 320, the rail at 1280.
- **Decided by the owner (2026-11-12)**, shown both side by side on the real app: the bar stays
  glass and the brand stays in the header on desktop, over the approved sheet's dark bar and its
  brand at the top of the rail.
- **Waiting on the owner (human-verify)**: on his iPhone — the bar against the home indicator,
  the bar hiding for the keyboard, the assistant's box above the bar, the last row of the
  shopping list and of a plan day above the bar, the header staying put when «Tema», a select or
  «Tus conversaciones» opens on a scrolled page.

## After phase 2 — a dish's title was boxed on arrival (2026-11-12)

- **Reported by the owner**, with a screenshot of a dish page on his iPhone: the title drawn inside
  a ring, «como seleccionado», and his instruction that it must not happen anywhere in the app.
- **Cause**: after a route change `RouteAnnouncer` moves focus to the page's heading, and some
  thirty components do the same with a heading, a status line or a region when a step changes or
  a dialog closes. The global `:focus-visible` rule drew its ring on them as on a control. Safari
  on iOS treats focus moved by script as visible focus; Chrome does only after a key press, which
  is why it showed in one probe screenshot (after Escape) and nobody read it as a defect.
- **Fix**, once, in `ui/styles/base`: an element only script can focus (`tabindex="-1"`) that has
  no role draws no ring. Buttons, links, fields, and menu items, tabs and radios (which carry a
  role) keep theirs. Focus still moves, so a screen reader announces the page as before.
- **Checked in Chrome** on a page built from the real stylesheet, in keyboard modality: a
  heading, a paragraph and a region focused by script have no outline; a `menuitem`, a button, a
  field and a link have one.
- **Not run**: `gate.sh --full` — phase 4's executor is using the machine, which died under two
  heavy jobs on 2026-11-11. The `ui` and `web` checks ran; CI runs the rest.
## Phase 4 — Inicio and the dish, where the food is (2026-11-12)

- **Executor**: `frontend` on opus, branch `024-phase-4` (on `024-phase-3-ship`). Nothing ran on
  `fable`; the advisor was not consulted.
- **Result**: done, for the lead's check.
- **What changed**:
  - **Inicio.** The greeting is the display heading with the name in `--color-brand-11` (solid: the
    gradient's light end does not hold 3:1 on the paper, LOG phase 1b), the plan's status line
    under it. Then, on a plan's day: the targets card with **the rings of the day**
    (`components/DayRings` over `ui/Rings`, `--color-ring-1…4`) — the sum of the day's meals whose
    status is `completed` (`lib/dayRings.completedTotals`) against `profile.targets.effective`,
    the legend in words beside the rings from a 16.5rem card (360 px) and under them below it (a
    container query, so it holds at 320 px, in the desktop rail and at 200 % text), the sentence
    «Lo que suman las comidas que has marcado como hechas.» — or, with nothing marked, «Aún no has
    marcado ninguna comida como hecha. Márcala con su círculo y los anillos la irán sumando.» —
    and the plan's own total for the day in a sentence under them («El plan de hoy suma …»). The
    next meal as its picture (16:9) with a strip over its foot (slot, name, kcal · protein ·
    minutes); the day's meals with thumbnails; the fortnight strip; then shopping, weight and the
    floor-clamp notice. From 64rem the day is the main column and the targets, shopping and weight
    the rail; one source order for both. With no day (no plan, plan ended, away) the targets card
    follows the day's own content, so the one thing to do leads on a phone.
  - **A tick moves the rings at once**: `components/DayStatusProvider` holds the marks made on the
    screen since the server last answered; `MealRow` reports its optimistic mark (and the mark put
    back on a failure); a new answer from `router.refresh()` clears them.
  - **Dish rows** (`MealRow`, on Inicio and every `PlanBrowser`) show the dish's picture as a 1:1
    thumbnail (lazy, `width`/`height`, original bytes, the «IA» mark at a size capped at the
    12-point step on the small square) — or **the designed state**: the moment of the day's ring
    colour paled into the card and a glyph per moment (`lib/dishLook`, `components/DishGlyph`;
    morning cup, midday plate, snack apple, evening bowl). New derived tokens
    `--color-slot-{morning,midday,snack,evening}` and `-ground`, in the shared block of
    `themes.css` (each theme's own ring colour, so all five and Automático follow) and mapped in
    `forced-colors`.
  - **The plan's day**: day chips with the filled gradient on the chosen day; the day's card
    slides in from the direction of travel (`.motion-forward` / `.motion-back`); thumbnails; and
    the day's totals against what it was built to hit (`day.targets ?? plan.strategy`) under the
    figures, «El día, sobre sus objetivos» (`TargetProgress`, its bars now grow by transform).
  - **The dish page**: the picture large (or the designed state) with the slot line and the `h1`
    on a near-opaque strip over its foot, the caption under both; facts and equipment as chips;
    **its share of the day** (`components/DishShare`): one small ring per figure against the
    day's target (the active plan's `day.targets ?? strategy`; for an earlier plan the person's
    targets in effect), the figure counted up and «30 % del día» in words; the specification;
    ingredients, accompaniments, numbered steps (`data-ai-generated` on the `h1` and the steps
    kept), the verdict. **The actions** (Hecha, Saltada, Cambiar plato — same conditions, same
    limits, same messages) are `components/DishActions`: below 48rem a card fixed at
    `bottom: var(--app-bar-clearance)`, which writes its own height to `--dish-actions-block` for
    the page's foot, so the last line is never under it; the swap panel rises inside it and the
    card scrolls inside itself past the screen's room. From 48rem it sits in the page beside the
    picture.
  - **A dish card grows into its page** (`components/DishLink`, `lib/dishTransition`,
    `components/DishArrival`): `document.startViewTransition` where it exists and motion is not
    reduced, names `dish-<mealId>` / `dish-title-<mealId>` set on the tapped card only and on the
    page's picture and `h1`; the update waits for the dish page to mount (at most 1.5 s).
    Elsewhere an ordinary link.
  - **Motion**: the screens arrive staggered (`.motion-enter`, `.motion-list`), the rings sweep
    and their figures count (`CountUp`), the next-meal picture fades up, a tick draws itself
    (`.motion-tick`) and presses in, the swap panel rises (`.motion-sheet`), the weight counts up
    and its sparkline draws. Every colour transition on these screens is gone.
  - `packages/ui`: `Rings` gains `decorative` (no group and no hidden list where a visible legend
    already says the figures — the phase 2 note) and transitions `stroke-dashoffset`, so a ring
    moves when its value changes; `useCountUp` counts a value that changes after arrival from the
    one before (the late-hydration rule now applies only to the figure as it first arrives).
  - Dictionaries: `dashboard.ringsDone`, `ringsNone`, `ringsOf`, `ringsPlan`; `meal.shareTitle`,
    `shareOfDay`; `plan.dayVsTarget` — in both.
  - `apps/web/vitest.config.ts` resolves the app's path aliases and JSX, so a component whose
    markup is a contract can be rendered to a string in Node (`DishPicture.test.tsx`).
- **Evidence** (executor, local build, local Postgres):
  - `pnpm turbo lint ts:check test --filter=web --filter=ui`: 14 tasks green; `ui` 65 files / 534
    tests (+2: `Rings` decorative, a count-up from the previous value), `web` 43 / 370 (+16:
    `dayRings` 8, `dishLook` 2, `DishPicture` 6). `pnpm deadcode` clean. Contrast with the patched
    script: 5 themes × 87 pairs, 435 pass (new: the four moment glyphs on their grounds, lowest
    Claro 3.13:1).
  - Control baseline (`plan` and `noplan`, `/inicio`, `/plan`, `/plan/comida/<id>`, both languages,
    phone and desktop, 20 files): no line gone but data (dish names, the greeting's hour) and the
    assistant's link (its local switch was off; phase 0 had it on). New: «Tema» (1b), the dish
    page's heading «Lo que aporta a tus objetivos del día», «· # min» on the next meal's link, and
    the pressed «Quitar la marca de hecha» of a meal marked done.
  - Overflow (`probe.mjs`, element by element): the three routes with a generated plan (a meal
    done, one skipped, one swapped) at 320/360/390/768/1280 × five themes × both languages: 150
    loads, 0 hits; no plan, `/inicio` and `/plan`, five widths × Claro/Oscuro × both languages:
    40, 0 hits. `widths.mjs` 320→1400: the three routes in both languages and the no-plan pair:
    clean. Longest library names (99 and 90 characters) written into every dish name, title and
    side, five widths × 100 % and 200 % text: 150 checks in five themes (Spanish) and 60 in Claro
    and Oscuro (English), 0 runs and 0 cut boxes (the shell's hatch, cut to its band by design,
    excluded).
  - Dish actions, scrolled to the bottom: at 320 and 390 the last block ends 48 px above the
    actions card, the card 12 px above the bar; at 200 % text the same order holds; at 768 the
    rail stands in for the bar and the page ends 48 px above the screen's foot.
  - Motion (Chrome, 4× CPU, 390 px): `/inicio` and a dish, CLS 0.0000; long tasks 165–189 ms at
    load and 50–79 ms after, the same with reduced motion on (hydration, not animation); animated
    properties `opacity`, `transform`, `translate`, `stroke-dashoffset`. Reduced motion: no
    animation running 250 ms after load, every ring at its final offset on the first sample.
  - A tick on Inicio with the server's answer held back: the rings drew 941 kcal / 42 / 131 / 28 g
    within 150 ms and the caption changed; after the answer the same values.
  - View Transition from `/plan` and from Inicio: one transition started, `dish-<id>` and
    `dish-title-<id>` on the tapped card and on the page's picture and `h1`, landed on the dish.
- **Deviations from plan**: see the hand-back.
- **Inventory, line by line** — `inventory/app.md`, each row → where it is now:
  - `/inicio` 1 tour → unchanged, opens here · 2 greeting `h1` → header, name in the accent · 3
    pending-review notice → notices region, top · 4 away card → notices region · 5 «Ver mi plan»
    → inside it · 6 check-in due → notices region · 7 plan status line → under the `h1` · 8
    fortnight strip (link, aria-label) → its own card after «Hoy» · 9 next-meal card → large
    picture or designed state with strip; eyebrow, name, kcal · P (minutes added), «IA» mark and
    hidden name with a picture; link (and View Transition) to the dish · 10 «Ya no queda nada por
    hoy.» → same place · 11 fallback plate → the designed state · 12 «Hoy» + «Ver los 14 días →»
    → «Hoy» card heading · 13 today's macro summary → the plan's day total is the sentence under
    the rings (`ringsPlan`); `MacroSummary` itself only when there are no targets; `macros.note`
    at the foot of «Hoy» · 14 meal rows (tick, slot, name, sides, badges, kcal · P, link) →
    unchanged, thumbnail added · 15 «Ingredientes» → unchanged · 16–17 plan ended + its two
    links → main column · 18 scheduled card → main column · 19 waiting variant → main column ·
    20 no-plan text + card + «Crear mi plan» → main column, first after the notices · 21
    targets heading + «Ajustar →» → targets card heading · 22 targets macro summary → on a plan's
    day each target is in the legend («de 2246 kcal»); otherwise `MacroSummary` as before · 23
    estimate note → foot of the targets card · 24 «Hoy, sobre tus objetivos» (plan vs targets) →
    replaced on Inicio by the rings (marked done vs targets) and the plan-total sentence; the
    words `todayVsTarget` are now only the rings' internal label (decorative), see Deviations ·
    25 shopping snapshot → side column card · 26–30 weight panel, sparkline, form, start + link,
    error → side column card (figure counts up, line draws) · 31 floor-clamp notice → side column,
    as a `Note` (warning, «Aviso»).
  - `/plan` 1 pending notice, 2 scheduled link, 3 pantry sentence, 4 browser, 5 scheduled-only,
    6 empty → unchanged · browser 7–12 → unchanged (title heavier) · 13 week toggle → unchanged ·
    14 day group → chips restyled, `aria-current` kept · 15 day heading → unchanged, the card slides
    in by direction · 16 «Comiendo para» → unchanged · 17 macro summary + note → unchanged · new:
    «El día, sobre sus objetivos» · 18 meal rows → unchanged controls, thumbnail added · 19–24
    events card, list, capacity, form, outcome, error → unchanged.
  - `/plan/comida/[id]` 1 locked card → unchanged · 2 back link → top · 3 slot line → on the
    strip · 4 `h1` `data-ai-generated` → on the strip, View Transition name · 5 facts → chips · 6
    equipment → chips · 7 paused text → where the actions are, in the page · 8 «Podrás marcarla
    el …» → inside the actions card · 9 Hecha / Saltada → actions card (fixed above the bar on a
    phone) · 10 «Cambiar plato» with its panel, count, hints, alert → actions card, the panel
    rising inside it · 11 read-only note → where the actions are · 12 picture figure, mark, alt,
    caption, drawing wait, fallback → hero; a dish whose `pictureStatus` is `none` now shows the
    designed state there too (no caption, nothing marked) · 13 spec list → side column card · 14
    macro summary + note → share rings with figures and percentages, the note under them;
    `MacroSummary` when no target is known · 15 ingredients · 16 accompaniments · 17 steps
    (numbered badges, `data-ai-generated`) · 18 verdict → unchanged.
- **Lead's check on phase 4 (2026-11-12)**: branch taken into the main checkout with `main`
  merged; contrast 5 themes × 87 pairs, 435 pass. **With real pictures**, which the executor could
  not have: the local probe plan's recipes were pointed at public pictures read from production
  (read-only there; the rows were written to the local database and removed after), one dish in
  five left without, and a meal marked done. On that: `/inicio`, `/plan` and the dish page at 320,
  360, 390, 768 and 1280 in all five themes (75 loads) and `widths.mjs` from 320 to 1,400: no hit.
  Looked at: the rings a quarter full with their legend beside them at 390 and under them at 320;
  the next meal's picture with its «IA» mark clear of the strip; thumbnails with the mark in the
  day's rows; the dish's picture, caption and share rings; the actions card above the bar; the
  designed state beside real pictures; Pulso; the desktop layout.
- **A trap for the next probe**: the picture store refuses a headless browser (the response is
  blocked as opaque), so a probe shows the no-picture state for every dish however the data is.
  To see pictures, fetch the bytes outside the browser and hand them to the page
  (`page.route` on the store's host). On a person's phone they load.
- **Not seen**: a picture that belongs to its dish (they were assigned at random), the drawing →
  ready fade, a failed load, and the View Transition in Safari.

## After phase 3 — the header was clear over scrolling content on an iPhone (2026-11-12)

- **Reported by the owner**, with a screenshot of `/asistente` scrolled: «Tus conversaciones» read
  through «NutrIA» and «Nueva» through «Cerrar sesión» — «al hacer scroll pasa por debajo».
- **Cause**: phase 3 drew the header's glass at opacity 0 and faded it in with an animation tied
  to the scroll, wherever the browser said it supported one. His Safari says so and did not run
  it, so the glass never came. Chrome ran it in every probe.
- **Fix**: the glass is the default, and the top of the page is the exception, told by script
  (`data-at-top` on the header): before the script runs, without it, or if it fails, the header
  is readable. A short opacity transition replaces the scroll-driven one.
- **The same day, from his iPhone**: phase 3's six checks hold («Funcionan las 6 bien») —
  **phase 3 confirmed by human on 2026-11-12** — and the boxed title of #368 is gone («el título
  de recuadro está bien también»). Decided by him: «Cambiar» is added to the plan's rows (a new
  control there; its own change), and the count-up's skip on late hydration stays as built.
- **Not run locally**: `gate.sh --full` and a browser probe — phase 5's executor holds the
  machine and the ports. `web` tests, lint and types are green; CI runs the rest. The fix cannot
  be seen in Chrome failing the way Safari did; the owner's iPhone is the check.
## Phase 5 — The rest of the signed-in app (2026-11-12)

- **Executor**: `frontend` on opus, branch `024-phase-5` (on `024-phase-4-ship`), 14 commits. Nothing ran
  on `fable`; the advisor was not consulted. Cut off by a usage limit after the control baseline; the
  lead runs what is marked NOT RUN below.
- **Result**: built, for the lead's check; human-verify on the owner's iPhone pending (the keyboard first).
- **What changed**:
  - **Compra** (`/compra`, `/compra/proxima`). Heading in the heavy face. The range («Todos · Semana 1 ·
    Semana 2 · Elegir días») and the plan switch («Actual · Próximo») are segmented controls drawn as
    `ui/Tabs` is: sunken track, the chosen segment filled `--foreground-01` under `--background-01`, heavier
    weight; still radios / links, still two by two below 27rem. Progress «N de M ya en el carro» on a sunken
    card with a bar under it (`--gradient-accent` on `--color-ring-track`, `aria-hidden`), which grows in
    (`.motion-grow-x`) and eases to each new mark by `transform: scaleX`. Aisles are grouped lists: the aisle
    name as a heading, its rows on one card with hairlines, the aisles arriving staggered (`.motion-list`). A
    row checked off strikes through by `.motion-strike` (a line per line of a wrapped name, a gradient over
    the words' own box; `text-decoration` under forced colours); the box and the pencil press in. The amount
    form drops in (`.motion-drop-in`) and keeps its validation, Esc and focus return. Offline logic untouched.
  - **Progreso**. Heading heavy; the four tiles count up (`CountUp`, signed where a change, the words «Sin
    cambios», «—», «conseguido» simply there); the weight line is revealed by a veil in the card's colour
    sliding off it (`transform`, inside `InView`), with an accent wash under it. The overall «X comidas hechas
    de Y que marcaste» is now its own card with a single ring (`ui/Rings`, tone 2, decorative — the sentence
    is the text) beside it; no ring when nothing is marked (the «Marca las comidas…» sentence alone).
    Fortnight cards arrive staggered; their bar grows by transform; the check-in answers are tags (chips).
    Every link and the locked/premium row as before.
  - **Check-in**. The three questions are `OptionCards layout="segmented"` (new prop; onboarding keeps the
    cards), same radios, names, defaults and values. The error banner is a `Note` (error, `role="alert"`).
    Form and confirmation arrive (`.motion-enter`), the effects list staggers. No steps added.
  - **Asistente** (new conversation and a thread). (1) The composer has a ground of its own: the page's
    colour fading in over the top of its padding, solid behind the box and the allowance line, and the same
    ground running on below it to the bar (`::after`), so nothing scrolls visibly behind them. (2) With the
    box focused below 48rem, `--app-bar-clearance` is 0 and the new `--app-foot-space` is `--space-02`
    (`:global(html):has(.field:focus)`), so the page ends one small gap under the allowance line — the band
    the owner saw between the box and the keyboard was the layout's foot (space-09 + the bar's clearance,
    ≈132 px at 390). (3) The bar's remnant: every destination now hides itself too (`visibility` + `opacity`,
    same 300 ms return) under the bar's own selector — WebKit can leave a destination's composited layer
    painted when only the bar is hidden; the bar's hiding rule itself is unchanged. (4) The warning folds
    (`components/AssistantWarning`, the `legal` agent's design § 6.5, owner-approved): FULL while the
    conversation has no message, FOLDED to `assistant.warningShort` + a native «Aviso completo» button
    (`aria-expanded`, `aria-controls`, focus stays) once it has one, EXPANDED in place; React state only.
    The hint under the box now begins with `assistant.composerNotice`. Also: the person's bubble on ink
    (`--foreground-01`), turns added this visit drop in, the answer being written fades, the send disc on the
    brand gradient and pressing in, the dots' pulse on tokens (no own reduced-motion guard), the box's colour
    transitions gone, the thread page's supervision note is a `Note` (it pointed at a class that did not
    exist), the composer's grid track bounded (it ran 458 px wide at 200 % text on 320).
  - **Perfil**. Heading heavy; section headings in the heavy display face (no small caps); card titles bold;
    `ProfileSection` rows as a grouped list; every section, card and control as before. `PasswordMeter`'s bar
    scales by transform (was `inline-size`); `LocaleSwitcher`'s colour transition removed.
  - **Plan being made**. Running: a large ring (`ui/Rings`, lg) swept to the stages behind the job out of the
    pipeline's six (`lib/generation` `GENERATION_STEPS`, `stepsBehind`, tested), «N/6» counted in its middle,
    its text alternative «N de 6 pasos hechos»; the step line (live region) kept; the six stages as a list,
    finished ones ticked (`.motion-tick`) and struck, the current one `aria-current="step"` with a breathing
    dot. The indeterminate bar is gone — the ring replaces it. Failed and could-not-start: the message is a
    `Note` (error, `role="alert"`), detail and actions unchanged. The screen opens at its top when the job
    starts or fails (the button sat at the foot of a long page). Ready screen unchanged but for heavier
    heading and `ChipGroup`'s colour transition removed. `EventPlanner`'s tracks bounded (325 px on a 320 px
    screen at 200 % text).
  - Dictionaries: `generation.progressLabel`, `generation.stepsDone`, `assistant.warningShort`,
    `assistant.warningMore`, `assistant.composerNotice` — in both.
  - Tokens: `--app-foot-space` (`styles/variables.css`), read by `(app)/layout.module.css` and the assistant
    column's height.
  - Colour/size transitions removed in these screens: OptionCards, ChipGroup, AssistantChat (box),
    PasswordMeter (width → transform), LocaleSwitcher. Left in other phases' files: SiteHeader, AdminNavList,
    PeriodSelector, OnboardingFlow (`inline-size`), plan/historial (`border-color`).
- **Evidence** (local build, local Postgres, Chrome):
  - DONE — `pnpm turbo lint ts:check test --filter=web` green after the last code change: 14 tasks; `web`
    382 tests (new: `lib/generation.test.ts` 3, `AssistantWarning.test.tsx` 9 — the three states in both
    languages, the full text equal to the dictionary's, the button after which the text sits, no clamp, no
    storage or cookie touched); `ui` 534. The very last commit (`ShoppingItem.module.css`, two declarations)
    landed after that run: NOT re-run.
  - NOT RUN — `pnpm deadcode`, the `--filter=ui` gate after the last commit, `format:fix` on `ui` (no `ui`
    file changed).
  - DONE — contrast: `scripts/check-contrast.mjs` 5 themes × 87 pairs, 435 pass; with `for-lead-5`'s patch
    5 × 88, 440 pass (the line under the box, `--foreground-02` on `--background-01`: Claro 5.96, Oscuro
    7.98, Huerta 6.01, Pulso 8.44, Alto contraste 12.63).
  - DONE — control baseline (`baseline.mjs`, `plan` and `noplan`, `/compra`, `/compra/proxima`, `/progreso`,
    `/check-in`, `/asistente`, `/perfil`, both languages, phone and desktop, 44 files, each with a phase-0
    twin), assistant switch on: **no line gone but data** — shopping rows (another plan's ingredients) and the
    greeting's hour where `/check-in` without a plan redirects to Inicio. Added: «Tema»/«Theme» everywhere
    (1b), «Apariencia» and its six radios (1b), «Bebidas» (data), and on `/asistente` with a conversation the
    history link and «Descargar mis conversaciones» (the phase-0 account had none). A thread
    (`/asistente/<id>`, not in the phase-0 set): «Aviso completo» is present; the warning's link «política de
    privacidad» is not in the tree while folded — the expected change of the fold. `/compra/proxima` had no
    scheduled plan on the probe account, so it redirected to `/compra` (phase 0 had the same state).
  - DONE — overflow, `probe.mjs` (scrolled or cut, element by element): with a plan, `/compra`, `/progreso`,
    `/perfil`, a thread, `/plan/generando` × 320/360/390/768/1280 × five themes × both languages: 250 loads,
    0 hits; after the warning fold, `/progreso`, `/asistente`, the thread again, same grid: 150, 0 hits;
    `/check-in` and `/asistente` in Claro and Oscuro × five widths × both languages: 40, 0; no plan, six
    routes × five widths × Claro/Oscuro × both languages: 120, 0. `widths.mjs` 320→1400 on the seven
    routes, plan and no plan, both languages: 28 sweeps, clean.
  - DONE — states (own script, element by element): a row ticked and a typed amount saved on `/compra` at
    320 and 390 (Claro, Pulso): 0 hits at 100 %; the plan being made running (job answered by `page.route`,
    stage SCHEDULING_MEALS → «2 de 6», current = «Repartiendo…», 2 done), failed (POOL_TOO_SMALL, detail
    shown) and refused (429): 0 hits at 320/390, 100 % and 200 %.
  - DONE, with two fixes — 200 % text at 320 and 390 (CDP `Page.setFontSizes`), Claro and Oscuro, seven
    routes: found the composer at 458 px and the events form at 325 px on a 320 px screen, and a half-bought
    row's «… por comprar» 30 px past the screen. After the first two fixes: 28/28 clean in Spanish, clean in
    English on four routes. The third fix (`ShoppingItem`) is committed but NOT re-probed.
  - DONE — the assistant (390×844 and 320×700, touch, Claro and Pulso; new conversation and a 12-turn thread
    with a decline): unfocused, box bottom 686 / allowance line 712 vs the bar's top 780 (320: 542/568 vs
    636); the last message ends above the composer (580 vs 604); focused, document end − allowance line's
    bottom = **16 px** (was 132), the box at 802 of 844, the bar and every destination `hidden`/opacity 0;
    150 ms after blur still hidden, 500 ms visible. The warning's text equals the dictionary's (es and en);
    5 answers carry `data-ai-generated="true"`. Fold in the browser: new conversation FULL with no button;
    a thread FOLDED, «Aviso completo» 44 px tall on touch, pressing → `aria-expanded="true"`, focus on the
    button, the full text and its link shown; pressing again folds; no `localStorage`/`sessionStorage` write,
    `document.cookie` unchanged; the field's description reads «Te responde una IA: no escribas aquí datos de
    tu salud. Te quedan 20 de 20 … Enter envía…». History drawer opened (phone): header at 0, sheet 620–844,
    no sideways scroll (the trigger sits at the top of the column, so the page was at its top when opened).
  - NOT RUN — Compra and the plan being made **offline** (`apps/web/AGENTS.md` § Offline: needs `pnpm build &&
    pnpm start` with the worker, network cut). The offline code paths were not touched.
  - DONE — motion (PRD 15), 4× CPU, 390 px: `/compra`, `/progreso`, `/perfil` CLS 0.0000 each; long tasks
    98–248 ms at load, the same order with reduced motion on (hydration, not animation); properties animated
    `opacity`, `transform`, `translate`, `stroke-dashoffset`. Reduced motion: nothing running 250 ms after
    load. With reduced motion on, Perfil showed 0.01 ms *transitions* of border colours and font weight: the
    base rule forces a duration on every element whose `transition-property` is the initial `all` — `ui`'s
    behaviour, not this phase's; worth a line in `ui/styles/base`.
  - DONE (by reading screenshots, not a separate report) — `apple-web-design` REVIEW of the six screens:
    PASS, no P0 or P1. P2: the progress bar's empty track is faint on the sunken card (decorative; the
    sentence carries the figure). P3: tile labels wrap unevenly at 320. The owner's exceptions apply (motion,
    gradient on bars, radii).
- **Deviations from plan**:
  - The weight chart stays `components/WeightChart` (time axis, non-zero baseline, the target line): `ui`'s
    `LineChart` draws from zero and has no target, so a 72→74 kg line would be flat and row 6's target would be
    lost. It has no «Ver datos» table, as before; adding one would be a new control. Its entrance is a veil, not
    a stroke offset: `.motion-draw` on a line with `vector-effect: non-scaling-stroke` in a stretched box drew
    it broken into dashes in Chrome — **the same technique is in `ui/LineChart`** (phase 2), worth checking
    there at a wide aspect ratio.
  - The plan-being-made ring counts stages, not a percentage, and shows «N/6» — the sheet's «62 %» would be a
    number the pipeline does not report.
  - No «QUINCENA 9 – 22 NOV» eyebrow on the check-in, no «2 por comprar» per aisle, no percentage beside the
    shopping bar: each would be new copy or a new figure.
  - `OptionCards` gains `layout`; `AppNav.module.css` (phase 3's) gains one block; `EventPlanner` (also on
    `/plan`) gains bounded tracks; `--app-foot-space` is a new shell token.
  - Check-in **due** and **done** states could not be reached: a probe plan starts today. Not looked at.
- **Notes for the next phase**:
  - The assistant's composer, the dish's actions and the layout's foot all read `--app-bar-clearance` and
    `--app-foot-space`; a screen that must meet the keyboard overrides both while its field has focus.
  - A destination of the bar is hidden with the bar on each element — keep it so if `AppNav` changes.
  - The thread seeder (`AssistantController.open` + `append`, guarded to `@probe.invalid` and the local
    database) is in the scratchpad's `seed/thread.mjs`; worth adding to `account.mjs` as `thread`.
- **Inventory, line by line** — `inventory/app.md`, each row → where it is now:
  - `/asistente` 1 hidden `h1` → unchanged · 2 supervision note → `Note` above the conversation · 3 side column
    → unchanged (≥64rem) · 4 «Nueva conversación» → unchanged · 5 «Tus conversaciones» h2 → bolder · 6
    conversation list → unchanged, staggered · 7 empty text → unchanged · 8 «Descargar mis conversaciones» →
    unchanged, same two places · 9 download status → unchanged · 10 narrow bar button → unchanged · 11 drawer
    → unchanged · 12 «+ Nueva» → unchanged · 13 the warning → first item, FULL with no message (every word,
    the link); FOLDED with one (`warningShort` + «Aviso completo»), EXPANDED shows every word and the link ·
    14 thread `ol` → unchanged · 15 hidden speaker labels → unchanged · 16 person's bubble → on ink · 17
    withdrawn bubble → sunken, italic · 18 answer `data-ai-generated` → unchanged · 19 decline text →
    unchanged · 20 per-message delete → unchanged · 21 delete confirmation → unchanged, drops in · 22 writing
    dots → unchanged, pulse on tokens · 23 streaming text → fades in · 24 problem messages → unchanged, drop
    in · 25 polite status → unchanged · 26 composer field → unchanged; its description now starts with
    `composerNotice` · 27 send → gradient disc, presses · 28 allowance line + Enter hint → after
    `composerNotice` · 29 address replaced after first answer → unchanged · 30 unused keys → still unused.
  - `/asistente/[id]` 1 title `h1` → heavier · 2 «Borrar conversación» → unchanged · 3 confirmation →
    unchanged, drops in · 4 failure alert → unchanged · 5 navigation after delete → unchanged · 6 supervision
    note → `Note` (was an unstyled `p`) · 7 stored turns → as `/asistente` 15–21; the warning FOLDED.
  - `/check-in` 1–3 empty states and «Volver al inicio» → unchanged (not reached: see Deviations) · 4 `h1` →
    heavy · 5 intro → unchanged · 6 adherence line → unchanged · 7 error banner → `Note` error, `role="alert"`
    · 8 weight field → unchanged · 9 hunger → segmented, same three values, «Bien» default · 10 difficulty →
    segmented, «Llevadero» default · 11 satisfaction → segmented 1–5, 4 default · 12 comments → unchanged ·
    13 submit → unchanged · 14 confirmation heading (focus) → heavy, arrives · 15–16 effects → unchanged,
    staggered · 17–18 «Crear mi próximo plan» / «Volver al inicio» → unchanged.
  - `/compra` 1–2 empty state + «Ver mi plan» → unchanged · 3 `h1` → heavy · 4 plan switch → segmented, the
    chosen on ink, `aria-current` kept · 5 live region → unchanged · 6 range → segmented radios, same four,
    same ids · 7 day checkboxes → unchanged, press · 8 subtitle → unchanged · 9 row notices → unchanged · 10
    progress → sentence + growing bar · 11 «Compartir lo que falta» → unchanged · 12 «Supermercados cerca» →
    unchanged, hidden offline as before · 13 share status → unchanged · 14 empty-range panel + «Ver todos los
    días» → unchanged (rounder) · 15 aisle headings → heading face, aisles on cards, staggered · 16 item row →
    native checkbox kept (indeterminate kept), strike drawn on check · 17 pencil → unchanged, presses · 18
    amount form → unchanged fields, label, hint, Esc, drops in.
  - `/compra/proxima` 1 → as `/compra` · 2 switch with «Próximo» current → segmented · 3 next-plan subtitle
    → unchanged (redirect state only was probed).
  - `/perfil` 1 `h1` + subtitle → heavy, arrives · 2 supervision note → unchanged `Note` · 3, 61, 66, 75, 99,
    104, 107 section headings → display face, heavy · 4–13 targets card → unchanged · 14–15 meal-size note →
    unchanged · 16–26 health → unchanged · 27–31 vacations → unchanged · 32–51 fixed meals → unchanged ·
    52–60 premium → unchanged · 62–65 care link, switch, end, trail → unchanged · 67–73 data blocks → grouped
    rows, «Editar» bolder · 74 consent card → unchanged · 76–98 security (password, meter now scaling by
    transform, Google-only, two-factor steps, passkeys, sessions) → unchanged · 100–103 reminders, push,
    language (no colour transition) → unchanged · 105 tour replay → unchanged · 106 feedback → unchanged ·
    108–111 delete account (consequence, typed word, sign-in-again variant) → unchanged. «Apariencia» (1b) →
    unchanged. Two-factor on, a passkey-less account and aged sessions were **not** probed.
  - `/plan/generando` 1 ready heading/body → heavy · 2 events card → unchanged (tracks bounded) · 3–4 start
    date → unchanged, chips press · 5–11 pantry picker → unchanged · 12–15 meal-size note and actions →
    unchanged · 16 running → heading, body, step line kept; the indeterminate bar replaced by the stage ring
    and the six-stage list; safety note kept · 17 failed → heading, `Note` alert, detail, retry / complete
    profile, «Volver» · 18 could not start → heading, `Note` alert, retry, «Volver» · 19 success redirects →
    unchanged.
  - `/progreso` 1–2 unavailable / empty cards → unchanged · 3 `h1` + intro → heavy, arrives · 4 tiles → count
    up · 5 weight card + «Anotar el peso de hoy →» → unchanged · 6 chart → veil entrance, wash, axes, target,
    hidden summary, «Objetivo» line kept · 7 no-weight text → unchanged · 8 «Tus quincenas» + overall line +
    «Todos tus planes →» → the overall line moved into its own card with a ring, between the weight and the
    fortnights; heading and link where they were · 9 fortnight cards → bar grows · 10 check-in answers → tags
    · 11 «Ver el plan →» → unchanged · 12 locked row → unchanged · 13 no-fortnights text → unchanged.
- **Waiting on the owner (human-verify)**: see the hand-back.
- **Lead's check on phase 5 (2026-11-12)**: the executor was cut off by a usage limit during its
  last comparison and resumed only to write this entry; the lead took the branch, merged `main`
  (the header's glass of #370 kept, the executor's block that hides each destination kept) and ran
  what was missing on the built branch. Contrast: 5 themes × 88 pairs, 440 pass. Overflow, with a
  generated plan and a six-turn thread: `/compra`, `/progreso`, `/check-in`, `/asistente`, a
  thread, `/perfil` and `/plan/generando` at 320, 360, 390, 768 and 1280 in all five themes (175
  loads) and `widths.mjs` from 320 to 1,400 on the seven: no hit. Looked at, at phone size: a new
  conversation with the whole warning; a thread with it folded to one line and «Aviso completo»;
  the composer on its own ground with the line «Te responde una IA…» under it, in Claro and
  Pulso; Compra with a row ticked and struck; Progreso; Check-in before its day; Perfil; the plan
  being made.
- **The assistant's warning** follows `docs/legal/2026-11-11-redesign.md` § 6, which the owner
  approved on 2026-11-12 with its strings: whole while a conversation is empty, folded once it
  has a message, a fixed line under the box, nothing stored. He had asked for an X to close it;
  `legal` ruled out any dismissal that is remembered.
- **Still not seen by anybody**: the phone keyboard (the gap he reported is measured at 16 px
  under the allowance line with the field focused, down from 132), offline on Compra, check-in
  due and done, Perfil with two-factor on and aged sessions, `/compra/proxima` with a scheduled
  plan.
- **Waiting on the owner (human-verify)**: the seven checks at the end of the executor's report,
  the keyboard first.

## After phase 5 — the plan being made ticks every stage before the plan opens (2026-11-12)

**Reported by the owner on his iPhone, 2026-11-12**: «al generar un plan, se queda mucho rato
en el paso 1, y ya pasa directo al plan». The rest of phase 5 he found working («Todo funciona
bien») — **phases 4 and 5 confirmed by human on 2026-11-12**, this defect aside.

**Cause**: the screen was true to the server and the server's time is lopsided. Choosing the
dishes is nearly all of a generation; scheduling, validating, the list and the save end
together inside one polling interval (6 s), so the screen never received those stages and
went from one of six to the plan.

**Change** (`apps/web` only; the API, the polling and the six stages are unchanged):
`lib/generation` `stagesBetween` names the stages passed between two answers, and
`GenerationProgress` walks them one at a time (320 ms each) instead of drawing only the last;
on success it walks to the end, holds the closed ring at six of six for half a second and then
opens the plan. Only stages the server has already passed are walked — still no timed script.
What is said aloud (the live region) is where the job is, once, not each stage on the way;
it ends with «Tu plan está listo». While the dishes are being chosen a second line says that
this is the step that takes longest. With reduced motion nothing is played. Two new
sentences in both dictionaries (`generation.finished`, `generation.longestStep`).

**Verification**: `generation.test.ts` 7/7 (the walk's order, the end, nothing for an earlier
or unknown stage); types and lint. In a real browser against the local API, a plan generated
from the button: at 390 px the six stages ticked 320 ms apart, six of six, then `/plan`; at
320 px with reduced motion, straight to six of six, then `/plan`; no sideways overflow in
either. **Not seen**: the line under the long stage — a local generation is over before the
first answer, so the screen never rests on that stage here. The owner's phone is where it
shows.

## Phase 6 — Onboarding and the screens that had no sheet, and «Cambiar» on the plan's rows (2026-11-12)

- **Executor**: `frontend` on opus, branch `024-phase-6` (on `024-phase-5-ship`, 2860eee9), 13
  commits. Nothing ran on `fable`; the advisor was consulted once, before hand-back, and its
  list was worked through (round 2 below).
- **Result**: built, for the lead's check and the owner's approval from real captures (PRD 12).
- **What changed**:
  - **Piece A — «Cambiar plato» on the plan's rows** (the owner's decision of 2026-11-12). Each row
    of `/plan`'s day carries the dish page's own `MealSwap`, under the dish and across the row (its
    panel has the row's width at 320 px). Whether it is offered is `lib/mealSwap.swapOffered`, which
    the dish page now asks too: the plan being lived, not paused (`/plan` now reads `/vacations` as
    the dish page does), the allowance read, the meal still `planned`, online. The same POST, count
    («5 de 5»), hints, no-fit and quota answers. `MealSwap` gained: controlled `open` /
    `onOpenChange` (one panel open at a time across the day), `describedBy` (the row's button names
    its dish), focus into the panel on its chosen option, Escape closing it, focus back to the
    button (but not stolen from a second panel that opened), the count following the server's
    after any swap, and hiding itself offline. Not on Inicio, history or the next plan.
  - **Onboarding**: one segment per step under «Paso N de 9» and «N %» (the same `progressbar`,
    name and values; the reached segment grows in by transform; the `inline-size` transition is
    gone); the heavy title, subtitle and form move together on the shared axis by direction of
    travel; each step's questions in grouped cards (a list of choices per card, fields that belong
    together on one); the form's error is a `Note` (error, `role="alert"`); Atrás and Continuar
    share the row, equal width; the review's daily targets on the highlight fill. With a text field
    focused on a phone the bar's clearance and the page's foot are released (the assistant's rule).
  - **Plan history**: fortnights as cards (dates in the display face, «Plan N» in the small accent
    capitals, the chip on ink for the current plan, a locked one on the sunken ground), staggered,
    two columns from a tablet, a card presses in; the `border-color` transition is gone. A past
    plan's day and the next plan are phase 4's `PlanBrowser`.
  - **Consent interstitial and invitation**: heavy titles; the consent on one card, full-width
    button on a phone; the invitation's blocks as sunken groups with grouped rows, the health list
    dropping in, accept and decline equal width. No word of `profileConsent.*` or `care.*` changed.
  - **The professional's screens**: heavy titles, regions arriving in turn; from 64rem the
    workspace pairs patients and invitations with the plan and the invite form, and the client's
    page runs two columns (the plan to review across both). Patients as cards with their stage as a
    tag (waiting on the professional: on ink; paused: warning ground); invitations a grouped list;
    the seats and the client's meals done as decorative rings beside their sentences; the weight
    counts up; fortnight bars grow by transform on the bright gradient (was a width); check-in
    answers as tags; health as a grouped list; «Invitación enviada…» a success `Note`
    (`role="status"`); the invite and targets forms release the bar's room while typing. The
    agreement's and the access log's chevrons turn on the motion tokens.
  - `packages/ui` `Input`: a hint or an error line breaks inside a word with nowhere else to break
    («nombre@ejemplo.com» ran 45 px past a 320 px screen at 200 % text).
  - No dictionary key added or changed; no token added; no file outside `apps/web` and
    `packages/ui`.
- **Evidence** (local build, local Postgres, Chrome):
  - DONE — `pnpm turbo lint ts:check test --filter=web --filter=ui`: 14 tasks green; `web` 47
    files / 402 tests (new: `lib/mealSwap.test.ts` 10, `AssistantChat.test.tsx` 10 — piece C),
    `ui` 65 / 534. `pnpm deadcode`: clean. `format:fix`: no change left. Contrast: 5 themes × 88
    pairs, 440 pass — no new pair (every ground and text these screens use is already declared).
  - DONE — control baseline, 88 files: **captured on the base commit before any change** (same
    build, same accounts — nothing checked out twice) and after. States: `plan` (/plan, history,
    a past plan, the next plan → redirect), `sched` (a scheduled plan: /plan, /plan/proximo,
    history), `fresh` (onboarding 1–9), `resume` (/onboarding resuming at step 2, /consentimiento
    → onboarding), `pro` (/consulta, a client's page with a plan to review), `proA` (second factor
    required), `invited` (/invitacion/<token>); both languages, phone and desktop. **No line gone
    but data**: four `/plan` files and four `/plan/proximo` (redirected to /plan) lose one dish name
    that a swap replaced and gain «Cambiar plato # de #» / «Swap this dish # of #» — the only new
    control. Every other file identical. (`for-lead-6/baseline-diff.txt`; the 88 new files are in
    `for-lead-6/baseline-new/`, to add to `baseline/` with the onboarding and professional states
    phase 0 could not capture.)
  - DONE — overflow (`probe.mjs`, element by element), Spanish and English — this first sweep ran
    **before** the 200 % fixes, the `ui` Input fix and the closed-practice grid; the 200 % run, the
    paced `/consulta` sweep and `widths.mjs` below ran after them: `/plan`,
    `/onboarding/1`, `/onboarding/6`, `/consulta`, a client's page × 320/360/390/768/1280 × five
    themes; history, a past plan, the next plan, `/plan` with a scheduled plan, onboarding 2–5 and
    7–9, the second-factor gate and the invitation × five widths × Claro and Oscuro: **510 loads,
    0 hits**. `/consulta`'s roster is limited to 10 reads a minute, so part of those loads showed
    the workspace without its patients; it was swept again paced under the limit, five themes ×
    five widths × both languages: **50 loads, 0 hits**, patients and invitations on screen.
    `widths.mjs` (320→1400 every 16 px) on all 17 route/state pairs in both languages: **34
    sweeps, clean**.
  - DONE, with three fixes — 200 % text (CDP `Page.setFontSizes`) at 320 and 390, Claro and
    Oscuro, both languages, on every route above plus the swap panel open, onboarding's consent and
    pace errors, the targets form, the end-link confirmation and the invitation's health box: first
    run 184 checks, **6 hits** — the second-factor card 45 px past at 320 (its grid track sized by
    the heading's longest word; the agreement card has the same recipe and got the same fix) and
    «Aceptar la invitación» 5 px past (the label now wraps under the large-text query). After the
    fixes: **184 checks, 0 hits**. The invite form's states (invalid address, practice full —
    the API's answer stubbed in the browser, no row written —, invitation sent) at 320 and 390,
    100 % and 200 %: found the error line's example address 45 px past (the `ui` Input fix), then
    **clean**.
  - Screenshots read (320 and 360 first): onboarding 1 at 320 in Oscuro — the segments, the
    heavy title, the about-you card and the consent card, the disabled Atrás beside Continuar,
    nothing cut; onboarding 4 at 360 — six slots of four sizes in one card, «No la hago» wrapping
    inside its pill; onboarding 6 — the allergens on hairlines with «trazas», chips, the custom
    field, the dietary chips and hint; history at 320 in Oscuro — two cards, «PLAN 2» / «Actual»
    on ink, «PLAN 1» / «Sustituido»; the invitation at 360 — sunken groups, dots, both buttons
    full width; the workspace at 320 — the seats ring, «Pacientes» with the stage tag on ink, the
    invite form, the invitations card; the client's page at 320 — the plan to review with its days
    and «Cambiar plato» per meal, publish / regenerate, current plan, fortnights, weight, targets,
    review switch, health and end link; the workspace at 1280 in Pulso — two columns.
  - DONE — piece A in the browser at 320, 390 and 1280 (`swap.mjs`): three planned rows each with
    «Cambiar plato 5 de 5» named by its dish; the panel opens with focus on «Lo que encaje»,
    inside the screen (45→275 of 320, 45→345 of 390, 445→1187 of 1280), «Te quedan 5 de 5
    cambios…» in its foot, nothing past the screen; Escape closes it and focus is on the row's
    button; opening a second row's closes the first and focus is in the second; a swap completes
    at each width — the row shows the new dish, every row's count goes down by one together
    (5→4→3→2), focus back on the button. A meal marked done loses its button and gets it back when
    unmarked; history and the next plan have none.
  - DONE — onboarding walked end to end in the browser with a new account (`walk.mjs`): sent to
    step 1; step 1 with nothing ticked and an under-18 date held with the alert, then the age
    error on the field; step 2 pace 3 → «El ritmo tiene que estar entre 0 y 1…»; back to step 1
    with its saved answers, forward again; step 3 height 20 held by the API («Revisa los datos
    marcados»); **reload through `/onboarding` resumed at step 4**; step 6 an allergy and «kiwi»,
    whose status is shown going back to it; step 7 one minute held; step 8 skipped with «Omitir
    este paso»; the review with its summary and the targets on the highlight fill; «Terminar» →
    `/inicio`; `/plan/generando` opens. **PARTLY**: the plan was generated for the account by the
    same POST its button makes, run from a script (succeeded), not by pressing the button. Every
    step measured: nothing past the screen. Round 2, a new account: with every field valid and the
    box unticked the alert reads the consent sentence — and showed a raw «{privacy}», older than
    this phase; fixed (below).
  - DONE — motion (PRD 15) at 4× CPU, 390 px: onboarding step 4 → 3 (Atrás) CLS 0.0000, long
    tasks 176/50/212 ms at load and **none during the step change**; the workspace CLS 0.0000,
    long tasks 172/78 ms at load; animated: `transform`, `translate`, `opacity`,
    `stroke-dashoffset` (the rings), and opacity transitions only. Reduced motion: the same long
    tasks at load (hydration, not animation), **0 animations running 250 ms after** the change or
    the load.
  - DONE (from the screenshots and the code, not a separate tool) — `apple-web-design` REVIEW of
    onboarding, plan history and the workspace: **PASS, no P0 or P1** (verdict below).
- **Round 2 (after the advisor's read)**:
  - DONE — the keyboard release, measured at 390 on touch: onboarding step 1 with the name
    focused, `/consulta` with the invite address focused, a client's targets form with a figure
    focused — each `--app-bar-clearance` 0rem, `--app-foot-space` .5rem, the bar hidden, the
    document ending 8–9 px under the last element (unfocused: the bar's clearance and 3rem, 125 px).
    Back the moment focus leaves.
  - DONE — focus after a step change: «Continuar» → step 2 and «Atrás» → step 1 both land on the
    new step's `h1` («Tu objetivo», «Sobre ti»), as the route announcer did before the title moved
    into the keyed wrapper.
  - FIXED — the consent alert (onboarding step 1 and the interstitial) printed
    `profileConsent.note` with its «{privacy}» placeholder raw, an older defect: the placeholder is
    filled with the link's own words (`auth.legalPrivacy`); no dictionary word changed. Measured
    after: «… Más en la política de privacidad.»
  - FIXED — a closed practice on a wide screen drew its plan card alone in the right column; the
    two columns now apply only when the patients' region exists (`:has(.main)`). The closed state
    itself could not be built (`link` opens the practice), so this is checked in code only.
  - DONE — the client's page with data, built through the app's own routes (the professional's
    generation, then publish; the client marking two meals and logging two weights): the
    meals-done ring beside its sentence (it wrapped under it at 320 — the sentence's basis is now
    8rem, as on Progreso), the fortnight's bar grown on the gradient, the weight counting up. At
    320, 390 and 1280, 100 % and 200 %: 0 hits. Shots 17 and 18 retaken with that data.
  - DONE — D2 in a real chat (assistant switched on locally, off again after): a one-pair thread
    opened folded (`aria-expanded="false"`), pressed → `true`, both messages deleted → the warning
    whole with no button, a new question sent (the answer stream played in the browser, the stub
    answers nobody) → folded, `aria-expanded="false"`.
  - Judged — the probe's hint lines, unfiltered, on `/plan`, onboarding 1 and 6, `/consulta` and a
    client's page at 320, 390 and 1280: one hint, on `/plan` at touch widths — four `select`s of
    the events form at 1 px, Radix's hidden native selects behind their visible triggers (the
    triggers are the targets). Not a defect. No console error on any of them.
  - DONE — `ui` Input's `overflow-wrap: anywhere` on its hint and error lines, checked on the
    other screens that use it most: `/acceder`, `/registro`, `/en/registro` at 320 and 390, light
    and dark: 0 hits.
  - NOT REACHED — history's locked states (a locked card, the locked intro, «Ver premium», the
    PREMIUM_ONLY page of a past plan): they need a finished fortnight on a free account, which no
    route makes before its days pass. Restyled in code only.
- **`apple-web-design` REVIEW** (onboarding, plan history, the workspace and a client's page; from
  the code and the captures):
  - Overall: **PASS** — one dominant title and one primary action per view, the gradient pill only
    on the action, every control native and labelled, contrast held by the gate's pairs.
  - P0: none. P1: none.
  - P2 — card in card, considered and kept: onboarding's option cards sit inside a question card,
    and the swap panel sits inside the plan's day card. Evidence: `OnboardingFlow` `Card as
    fieldset` around `OptionCards`; `MealRow .swap` inside `PlanBrowser`'s card. The cards are the
    approved sheets' grouped lists (the check-in sheet draws its segmented questions inside one
    card); the option cards are controls with an edge, not surfaces (the 3:1 edge rule), and the
    swap panel is the sunken ground, not a raised card. Recommendation taken where cheap: the
    about-you questions share one card; the sole field of «Cocinar» has a card of its own so every
    step reads alike — a candidate to flatten if the owner finds onboarding boxy.
  - P2 — onboarding step 6 is long (16 allergens with «trazas», then three more groups):
    unchanged content; grouping it into four cards is the most this phase could do.
  - P3 — the disabled «Atrás» on step 1 keeps its full half-width; «Y 1 invitaciones…» is a
    dictionary plural older than this phase; the seats ring at 1 of 30 is nearly empty by nature.
  - What works: the segmented progress (the step reached grows in), the step moving with its title,
    the review's targets on the highlight tile, the patients as tagged cards with the waiting ones
    on ink, the two-column workspace on desktop.
  - The owner's exceptions named here: generous motion (the step's axis, the bars and rings), the
    wide gradient (progress segments, primary pills, fortnight bars), the large radii (cards, pills).
- **Deviations from the brief / plan**:
  - **The row's «Cambiar plato» sits on a line of its own under the dish**, at the row's end,
    rather than inline beside the kcal as the sheet draws it: the dish is a link (picture, name,
    figures) and a button cannot sit inside it, and the panel needs the row's whole width at 320.
  - **No sheet was drawn** (PLAN's phase 6 step 1): as the lead's brief said, the approved
    language was carried over and the owner approves from the captures in `for-lead-6/shots/`.
  - **The dish page changed in three small ways**, because the rows use its control: focus moves
    into the panel on open, Escape closes it, and the swap is not offered offline (it was drawn
    and failed with the network message). The brief named "offline" among the dish page's checks;
    the code did not have it, so both places now do.
  - **Two states could not be reached**: `/consentimiento`'s interstitial needs an account that
    finished onboarding before the consent existed (withdrawing consent from Perfil reopens
    onboarding instead, and every onboarding step now refuses without it), so no capture of it
    exists; and the agreement gate (state B of `/consulta`) needs a professional granted but not
    accepted, which `account.mjs link` does in one go — not built by hand. Both were restyled in
    code only (the interstitial's card and button; the agreement's chevron token and its column).
  - **The invitation token** came from `account.mjs link`'s own invite step stopped before the
    accept (`CareController.invite`, probe accounts, local database), because mail is off and the
    token is in no log. The practice-full alert was shown by stubbing the API's 409 in the browser.
  - The motion of the onboarding progress shows only the reached segment growing; the ones behind
    are simply filled (no replay of the whole bar on every step).
- **Notes for the next phase**:
  - `/consulta` reads the roster under a 10-a-minute limit; a probe sweep faster than that shows a
    workspace with no patients and reports it clean. Pace it, as above.
  - The 200 % sweep's full-page shots show content mid-entrance where the page was scrolled just
    before the capture (the `InView` entrances); not a defect, but wait ~600 ms after scrolling
    before a capture meant for a person.
  - `account.mjs` would earn `--no-onboarding` (a fresh account) and an `invite` action printing
    the token; this run used scratch copies of those two steps.
- **Inventory, line by line** — `inventory/app.md`, each row → where it is now:
  - `/onboarding` 1 redirect to the resume step → unchanged (a reload through `/onboarding` on the
    browser walk landed on the step left, step 4; a withdrawn-consent account lands on step 2).
  - `/onboarding/[paso]` 1 «Paso N de 9» and «N %» → unchanged, over the bar · 2 progress bar
    (`role="progressbar"`, 1–9, now = step, labelled) → same element, name and values, drawn as nine
    segments (behind filled, current growing in by transform, ahead on the track) · 3 step `h1` and
    subtitle → heavy display face, moving with the step · 4 form error banner (`role="alert"`) →
    `Note` error, `role="alert"`, same four sources of words · 5 «Atrás» (disabled on step 1 unless
    editing; «Cancelar» when editing) → unchanged, equal-width pill beside the primary · 6 primary
    «Continuar» / «Terminar» / «Guardar» / «Guardando…» → unchanged, gradient pill · 7 «Omitir este
    paso» (step 8, not editing) → unchanged, under the pair · 8 save note → unchanged, under the
    actions · 9 step transition → the title, subtitle and form move together, `.motion-forward` /
    `.motion-back` by direction of travel.
  - Step 1: 10 display name → in the step's card · 11 country cards + hint → same card · 12 birth
    date + under-18 error → same card · 13 sex cards + hint → same card · 14 consent fieldset (title,
    body, AI paragraph, checkbox pre-ticked when current, note with the privacy link, the blocking
    message) → its own card, every word of `profileConsent.*` untouched.
  - Step 2: 15 goal cards → card · 16 target weight, 17 pace + hint + local range error → one card,
    two columns from 34rem.
  - Step 3: 18 height, 19 weight → one card · 20 activity cards → card.
  - Step 4: 21 legend + hint, 22 six slots × four sizes → one card.
  - Step 5: 23 liked, 24 disliked → one card · 25 cuisine chips (data labels) → card.
  - Step 6: 26 allergies with «trazas» and its per-allergen name → card, rows on hairlines, «trazas»
    44 px tall on touch · 27 intolerance chips → card · 28 other allergies field + hint → card · 29
    enforced / best-effort status per custom allergen (inline `Note`) → unchanged, in that card · 30
    dietary pattern chips + halal/kosher hint → card.
  - Step 7: 31 cooking minutes + hint → card.
  - Step 8: 32 legend → card title · 33 intro and preference hints · 34 live count · 35 ten
    appliance rows with Tengo / No tengo / Prefiero, `aria-disabled` rules · 36 hob note →
    unchanged inside the card.
  - Step 9: 37 summary rows → one card · 38 targets box («Tus objetivos diarios (estimados)» and the
    line) → the highlight fill (`--color-highlight-fill` / `--color-on-highlight-fill`), the line in
    the display face · 39 basis text → same box · 40 clamp notice → same box · 41 «Terminar» →
    `POST /onboarding/complete`, then `/inicio` (walked).
  - `/plan/historial` 1 empty card «Tus planes» + «Tu plan» → unchanged (`EmptyState`) · 2 heading
    and intro (normal / locked variant) → heavy title, arrives · 3 plan cards (link to `/plan` or
    `/plan/historial/<id>`, range, «Plan N», chip Actual / Sustituido / Terminado) → same links and
    accessible names; dates in the display face, «Plan N» in small accent capitals, the chip on ink
    for the plan being lived, the list staggered, two columns from a tablet, a card presses in · 4
    locked card (not a link), range, «Plan N», «Premium» chip → sunken ground · 5 «Ver premium» →
    unchanged (4, 5 and the locked intro **not reached**: no route ends a fortnight early).
  - `/plan/historial/[id]` 1 locked card · 2 «Ver premium» / «Tu plan» → unchanged
    (`EmptyState`; **not reached**) · 3 PlanBrowser in history mode → phase 4's rows (pictures or the designed
    state), static ticks, no redo, no events, **no «Cambiar plato»**.
  - `/plan/proximo` 1 PlanBrowser upcoming → unchanged, no ticks, **no «Cambiar plato»**.
  - `/consentimiento` 1 heading → heavy display · 2 error (`role="alert"`, the note's words or the
    API's) → unchanged · 3 body, 4 AI paragraph, 5 required checkbox, 6 note with the privacy link →
    one card, words untouched · 7 «Continuar» / «Guardando…» → unchanged, full width on a phone.
  - `/invitacion/[token]` 1 title → heavy display · 2 intro (name, collegiate number) → unchanged ·
    3 «Si aceptas, X verá:» + list, 4 «Y podrá:» + list, 5 not-shared and trail sentences → one
    sunken group, lists as rows on hairlines · 6 health checkbox + optional note → its own sunken
    group · 7 the health list when ticked → drops in under it · 8 privacy sentence + link → unchanged ·
    9 error alert → unchanged · 10 «Aceptar la invitación» · 11 «No, gracias» → same buttons,
    equal width, stacking when they do not fit · 12 link-exists card (focusable `h1`, body, «Ver mi
    perfil») → unchanged, heavy title (not reached: needs an account already linked that opens a
    second invitation).
  - `/consulta` 1 state A (second factor) → unchanged card (reached: `proA`) · 2–9 state B, the
    agreement (heading, intro with the controller's identity, sections, collapsible terms, checkbox,
    version, error, «Aceptar y abrir mi consulta») → unchanged; the chevron turns on motion tokens
    (**not reached**, see below) · 10 «Consulta» → heavy, arrives · 11 intro → unchanged · 12–22 plan
    card → unchanged words; the seats sentence has a decorative ring beside it (tone 1, active of
    included), the figure in the heavy display face · 23 «Pacientes» → heavy region title · 24 empty
    roster text → unchanged · 25 patient card (name, stage tag, «Comparte su salud», «Paciente desde»)
    → cards, two to a row once there is room, stage on ink for the two that wait on the professional,
    paused on the warning ground · 26 active = link, paused = not a link + hint → unchanged, the link
    card presses in · 27–29 invite form → unchanged; with the address focused on a phone the bar's
    room is released · 30 sent confirmation (`role="status"`) → success `Note`, same words, drops in ·
    31 practice-full alert with «Pasar a un plan mayor» → unchanged words, drops in (shown with the
    API's answer stubbed in the browser: see Evidence) · 32 generic failure → unchanged · 33 pending
    invitations → one card, rows on hairlines · 34 agreement footnote → unchanged.
  - `/consulta/[linkId]` 1 «← Pacientes» → unchanged · 2 client name `h1` → heavy · 3 since, 4
    health chip → unchanged, chip on sunken · 5–10 the plan to review (heading focus target, range,
    intro, collapsible days with «Cambiar plato» per meal, publish, regenerate) → unchanged, spans both
    columns from 64rem (reached: the client's review switch is on by default, so the
    professional's generation waited for review) · 11–16
    current plan card, «Nueva quincena» with its reason, progress and done/failure lines → unchanged ·
    17 plans history rows → unchanged · 18 «Quincenas y check-ins» · 19 overall line → the sentence
    with a decorative ring beside it (as Progreso) · 20 fortnight items → range in the display face,
    percent heavy, the bar grows in by transform on the bright gradient (was `inline-size`) · 21
    check-in answers → tags · 22 suggested-kcal `Note` → unchanged · 23 none → unchanged · 24 «Peso» ·
    25 latest figure → counts up (`CountUp`) · 26 chart → unchanged · 27 no weight → unchanged · 28–33
    targets card, figures, «Cambiar objetivos», edit form with bounds, save / cancel / reset, errors →
    unchanged; typing a figure on a phone releases the bar's room · 34 review switch → unchanged · 35
    health card → definition list as a grouped list on hairlines · 36–38 end-link card, inline
    confirmation, error → unchanged.
  - **New (piece A, the owner's decision of 2026-11-12), `/plan` browser row 18 gains:** «Cambiar
    plato» with its count («5 de 5»), `aria-describedby` naming the dish, on each row of the plan
    being lived whose meal is still planned, the plan not paused, the allowance read and the device
    online (`lib/mealSwap.swapOffered`, the same function the dish page now asks); its panel (the
    dish page's: «¿Qué buscas en el nuevo plato?», the five choices with their hints, «Cambiar» /
    «Buscando otro plato…», «Cancelar», the count line, the no-fit and quota answers), one open at a
    time, focus into it, Escape and Cancel back to the row's button. Not on Inicio's rows, not in
    history, not on the next plan.
- **Piece C — the assistant's warning (from `legal`'s read of phase 5 against
  `docs/legal/2026-11-11-redesign.md` § 6.5)**:
  - D1: «Aviso completo» is `--target-min` tall at every pointer, not only on touch. Measured with
    the assistant switched on locally (and back off after): 125×44 at 320, 390 and 1280 with a
    mouse and on touch; at 200 % text 189×94 (320), 234×94 (390), 250×55 (1280); nothing past the
    screen in any of the ten.
  - D2: `lib/assistantWarning` holds the three states and the rule that an emptied conversation
    forgets the warning was opened; `AssistantChat` applies it while rendering when the number of
    messages changes (the "adjust state when a value changes" pattern, no effect). Nothing stored.
  - D3: `components/AssistantChat/AssistantChat.test.tsx`, es-ES and en-GB, 10 tests: the line
    under the box begins with `composerNotice` with no message and with one; with one the warning
    is folded behind `aria-expanded="false"` and the full text `hidden`; pressed, it is drawn with
    `aria-expanded="true"` and every word; no `localStorage`/`sessionStorage` write or read while
    the chat is drawn in both states and the button is pressed twice; deleted to none and sent
    again, it is FULL then FOLDED, never EXPANDED. `vitest run src/components/AssistantChat
    src/components/AssistantWarning src/lib/mealSwap.test.ts`: 3 files, 29 tests passed.
  - **PARTLY**: `apps/web` has no DOM library (its rule: render to a string in Node), so the
    press is tested through the page's own state rule and the warning's markup for that state,
    not by clicking the rendered chat; and the reset is tested on `warningOpenedAfter`, not by
    deleting messages in a rendered chat. A real click test needs `jsdom` (or happy-dom) in
    `apps/web`'s devDependencies — a lockfile change for the lead.
- **Waiting on the owner**: approval of the captures (PRD 12), then on his iPhone: onboarding
  with the keyboard open (the form should end right above it, Atrás / Continuar reachable), a
  step change moving the right way, each question's title sitting inside its card (Safari, a
  floated legend in a grid fieldset), «Cambiar plato» on a plan row (the panel, the count, a swap,
  and opening a second row's panel without the page jumping), the workspace and a client's page if
  he has a professional account, and «Aviso completo».

**The lead's own check, on `024-phase-6-ship` after merging `main` (2026-11-12)**: `gate.sh
--full` green. A fresh build against the local API, new accounts: `/plan`, `/plan/historial`,
`/onboarding/1`, `/onboarding/6`, `/onboarding/9` at 320, 360, 390, 768 and 1280 in the five
themes — 125 loads, no hit; `/consulta` and a client's page at the five widths in Claro, Oscuro
and Pulso — 30 loads, no hit; `widths.mjs` on all six routes, clean. «Cambiar plato» from a row
on a scrolled page at 320 and 768: the panel inside the screen, focus on its chosen option, a
second row's panel closing the first, a swap completing with the row changed, every count one
lower and focus back on the row's button; no page error. The 768 capture read: two columns of
options, nothing cut. Accounts deleted, servers stopped. **Owner-approves pending** — the
captures were sent to him the same day; nothing of phase 6 is merged before his answer.

## After phase 6's captures — the plan's day and the dish as the sheet draws them (2026-11-12)

**The owner's answer to the phase 6 captures** was «Cambios antes», with the approved sheet
attached: «El plan y el detalle del plan no cuadran con la maqueta. Todo se tiene que ver igual
que la maqueta, salvo las cosas que hemos ido cambiando». He also chose, the same round, to hide
the navigation during onboarding. Both built on `024-phase-6-ship`; nothing of #373 is merged
before he sees the result.

**What was wrong**: phases 4 and 6 kept the old plan screen's skeleton and restyled it. Measured
against `reference/02-mobile-complete.jpg` at full size:

| The sheet | What was built | Now |
| --- | --- | --- |
| Title «Miércoles, día 3», the fortnight and the day's kcal against its target under it | «Tu plan», the range, the history link, the redo button and its sentence, all above the days | The day is the `h1` (weekday, then «día N» in the accent), with the range, the day's kcal of its target and «hoy» under it. History and next plan keep their name as small capitals above |
| A strip of calendar chips: weekday over date | Pills: plan-day number over weekday | Rounded squares, weekday over the date; the chip's name says the whole date and «Día N» |
| One card a meal: picture, slot in capitals, name, «kcal · min», a small «⇄ Cambiar» pill at the line's end | One long card: four macro tiles and four bars first, then rows with a tick column, «kcal · g P», and a full-width «Cambiar plato 2 de 5» on its own line | One card a meal (`MealRow variant="card"`), «kcal · min», the pill at the line's end (it takes the next line below 360 px); the panel opens across the card |
| Dish: chips, four small rings in one row, «Ingredientes» with «para 1 ración» at the line's end, a grouped list | A heading over 2×2 ring cards, a source note, a specification card, then the heading, a tinted note and flat rows | Four in a row from 320 px (the short word «Hidratos»), heading and serving on one line, the list on one sunken ground |
| One action row: «Hecha» filled, «Saltada», «⇄ Cambiar» | A card of two rows, both marks outlined, «Cambiar plato 5 de 5» full width | One row: «Hecha» filled until pressed (then the toggle's wash with a tick), «Saltada» quiet, «⇄ Cambiar» as words |

**Kept, though the sheet does not draw them** (PRD 1 — nothing lost), each moved rather than
removed: the mark «hecha» on a plan's row (a disc over the picture's corner, outside the link, a
44 px target); «+Ingredientes» under the card's words; the day's four figures, their source note
and the bars against the day's targets (one card after the meals); «Planes anteriores» and the
redo with its sentence (after the day); the week switch (above the strip — fourteen days do not
fit seven chips); the flag of a day that eats for an event (under the title); the swap's count
(in the pill's name and in the panel's sentence, no longer drawn on the pill); the
specification card and the source note of the dish (after the ingredients); substitutes under
each ingredient.

**Differences that stay, and why**: the bar is glass and the brand sits in the header (his
choices, phase 3); the theme switch (his); filled buttons use the deeper gradient and accent text
is one solid deep tomato (PRD § "What changes from the sheets", 1–2); a generated picture keeps
its «IA» mark and its caption (7); **no meal time** («8:30», «14:00») — a plan's meal carries no
hour, and this project changes no route; the row's protein figure is no longer on the plan's
card (the sheet's line is «kcal · min»; the figure stays on the dish and in the day's totals);
Inicio's rows are unchanged (`variant="row"`), as he confirmed them.

**Onboarding without the bar** (his decision): the step page marks the questionnaire
(`data-questionnaire`, only when it is the flow and not one step opened from the profile); the
shell hides its destinations for the eye and for assistive technology and releases the room it
kept for them (`--app-bar-clearance`, `--app-rail-offset`). CSS only, so nothing flashes.

**Verification** (a fresh build against the local API, a new account, real pictures loaded the
phase-4 way and removed after):
- DONE — overflow: `/plan`, a dish, `/inicio`, `/plan/historial`, `/onboarding/1` at 320, 360,
  390, 768, 1280 in the five themes — 125 loads, no hit; again after the last change in Claro,
  Oscuro and Pulso — 60 loads, no hit; `widths.mjs` on the plan, the dish and onboarding, clean;
  200 % text at 320 and 390, Claro and Oscuro, plan and dish — 8 checks, no hit.
- DONE — «Cambiar» from a card on a scrolled page at 320 and 768: panel inside the screen, focus
  on its chosen option, a second card's panel closing the first, a swap completing, focus back
  on the pill. The mark over the picture, tapped at 390: the meal is marked, the page stays on
  `/plan` (the link under it is not followed), the card loses its swap.
- DONE — control baseline of `/plan` and the dish, before and after: no control gone. Renamed:
  the `h1` («Tu plan» → «Jueves, día 1»), the seven day buttons (now the whole date and «Día N»),
  the row links (no longer carry the figures, which sit outside the link). The eight files are
  refreshed in `baseline/`.
- DONE — read at 390, 320 and 1280, beside the sheet's crops.
- NOT RUN — an iPhone; the history and next-plan screens in a browser (same component, no swap
  and no mark there; their title is the eyebrow now).

**Approved and shipped**: the owner approved the captures on 2026-11-12 («Le doy el visto
bueno»); #373 merged, both production deployments succeeded, `main`'s CI green.

## After phase 6 — Inicio, Compra, Progreso and Perfil against the sheet (2026-11-12)

**Executor**: the lead, in the main checkout (the owner's rule of that day: every screen is
drawn as the approved sheet draws it, except what was changed on purpose since).

**What was compared**: `reference/02-mobile-complete.jpg` and `reference/01-…`, each screen
cropped at full size beside a 390 px capture of the build with a plan, pictures, weights and
marks. What the PRD already records as a deliberate difference was not reopened (§ "What
changes from the sheets": the deeper accent, the solid small text, the near-opaque strip, the
«IA» mark, the rings counting «Hecha»; and the owner's glass bar and header theme switch).

**Inicio**
- The line under the greeting is the sheet's: «Jueves 12 · día 1 de 14 de tu plan». How long
  is left stays on the fortnight's card.
- The rings card is the sheet's compact one: the rings with the four figures two by two beside
  them from a 390 px phone (one column under that, as before), each figure over its target.
  The heading stays for the outline (`visually-hidden`); «Ajustar» is at the card's foot.
  **Kept, smaller**: the three notes (what the rings sum, what the plan sums, that the targets
  are an estimate) — wording of record, not dropped for the look.
- The sheet's two tiles follow the next meal: the weight on the highlight fill and «N comidas ·
  Ver el día completo». Each is a link down the same screen (`#peso`, `#hoy`), so the day's
  list, the fortnight, the shopping and the weight field all stay where they were, under them.
- Found on the way: the weight sparkline stayed broken into dashes at rest in Chrome (the
  stroke-offset draw on a stretched box, the defect `WeightChart` already documents). It is
  drawn whole now, without that animation.

**Compra**
- Title «Tu lista de la compra», the sentence under it, and the four ranges on one row at
  390 px (two by two under 23rem, where a label would break). «Todos» reads «14 días» — the
  plan's own length. The legend is drawn only when the plan switch sits above the control.
- The share in the trolley as a figure at the card's end; «N por comprar» beside each aisle,
  counted from the device's marks like the bar; the rows on the sunken ground.
- **Moved**: «Compartir lo que falta» and «Supermercados cerca» go after the list, where the
  sheet draws the second. **Kept**: the pencil on each row (the sheet draws none).

**Progreso**
- The weight card leads: its change since the first reading at the head's end, the chart, the
  chart's sentence drawn (it was for a screen reader only), and «Anotar el peso de hoy» at the
  foot, landing on Inicio's weight field. Then the ring with «N de M» as its figure.
- A fortnight's card is the sheet's: dates and state in small capitals, how its meals were
  marked as its line, its check-in as chips. **Kept**: the bar and its percentage (smaller),
  the way into the plan, the plan's number.
- **Moved**: the four figures close the screen instead of opening it.

**Perfil**
- Each group of answers is the sheet's: its name and «Editar» on one line, the answers as rows
  on one sunken ground, a name at the start and the answer at the end (a long answer takes the
  line under its name).
- **Not done, and a question for the owner**: the sheet's profile is a short settings list —
  security as three rows with a switch, the account as rows. Ours carries every form open
  (password, second factor, passkeys, sessions, trips, fixed meals, health, feedback). Folding
  each behind a row changes how those flows are reached, which is not a restyle.

**Asistente**: read beside the sheet with the local switch on — same structure (the two
controls, the warning, the composer and its line). Left as the owner confirmed it in phase 5.


**Verification** (a fresh build against the local API; a premium probe account with a plan,
pictures loaded the phase-4 way, six weights and three marks; all removed after):
- DONE — overflow: `/inicio`, `/compra`, `/progreso`, `/perfil` at 320, 360, 390, 768 and 1280
  in the five themes, in Spanish and in English — 400 loads, no hit. The only hint is the two
  native selects of the fixed-meal form, as before.
- DONE — `widths.mjs` on the four, clean; 200 % text at 320 and 390, Claro and Oscuro, the four
  screens in both languages, no hit.
- DONE — control baseline, before and after: nothing gone. Renamed: Compra's `h1`, its «Todos»
  radio (now «14 días»), Progreso's weight heading and a fortnight's heading (it carries the
  state). New: Inicio's two tiles. The baseline files of the four are refreshed (taken after
  21:00, so Inicio's has no next meal — the day's last was past its hour).
- DONE — read at 390, 360 and 320 and at 1280 beside the sheet's crops. One thing the captures
  caught and no check did: the rings ignored the size their card gave them (the library's own
  size is declared later and won), so «Carbohidratos» broke mid-word in the two-column legend.
- NOT RUN — an iPhone.

**Approved**: the owner approved these captures on 2026-11-12 and chose to leave the profile's
forms open, as they are (#374).

## After phase 6 — the assistant on his iPhone: one tap sends, and the bar stays (2026-11-12)

**Reported by the owner**: with the keyboard open, tapping send closed the keyboard and sent
nothing; a second tap was needed. And, as an improvement: the title, «Nueva» and the other
conversations should stay at the top, since on a long chat a new one was a long scroll away.

**Cause of the first**: the box's place depends on its focus (`:has(.field:focus)` — the bar
steps aside and the box rides above the keyboard). The tap blurred the box before the click:
the keyboard closed, the box dropped from under the finger and the click landed on nothing.
The send button no longer takes the focus (`preventDefault` on its pointer and mouse down), so
the box keeps it, nothing moves, and the keyboard stays for the next question.

**The bar** (his three messages: the title too, glass, and deleting the conversation too): on a
phone it stays under the header as a floating capsule of the bottom bar's glass, the
conversation passing under it. On a new conversation it is the sheet's two worded controls.
With a conversation open it is the head of a chat: the list and «Nueva conversación» as icons
with their names, the conversation's name on one line between them (the page's heading has it
whole, and is the one a screen reader gets), and a bin that deletes it — its question opens
across the bar, focus on «Borrar para siempre», as before. The page's own delete button is
drawn only on the wide layout, where there is no bar.

**Verification** (local build with a placeholder assistant key; the conversation made of
questions the code declines before any model call):
- DONE — at 320 and 390, Claro and Oscuro: the bar's top under the header on a scrolled
  conversation, no sideways scroll, the three controls 44 × 44 each with its name; the delete
  question opens inside the bar and takes the focus.
- DONE — one tap on send with the box focused makes one request and the focus stays in the box.
- NOT RUN — an iPhone, which is where the defect was: the owner's check. A conversation with a
  real title (the local one has none and reads «Asistente»). The title at 320 after the last
  change (it was hidden there in the build that was captured; it is one line with an ellipsis).

**After his check of #375 (2026-11-12)**: «Está bien, pero al pulsar enviar tiene que cerrar el
teclado». On a touch screen (`pointer: coarse`) sending now gives up the box's focus once the
question is on its way — after the press has landed, so nothing moves under the finger — and a
first answer no longer puts the focus back in the box there. With a keyboard and a pointer the
focus stays in the box, as before.

**After his check of #375, again (2026-11-13)**: a new conversation opened a few pixels down,
its warning under the bar (his capture). Two causes: the conversation's column was sized for
the screen without counting the bar above it, so an empty conversation was a little taller
than the screen; and the chat went to its end on arrival, and followed it, even with nothing
in it. The column now leaves the bar's room (`--assistant-bar-space`) and a conversation with
no turns opens at its top and is not followed until something is sent. Measured on a local
build at 320, 360, 390 and 1280: a new conversation opens at scroll 0 with the warning 24 px
under the bar, and at 390 nothing is left to scroll; a conversation with turns still opens at
its end.

## Phase 7 — The public pages (2026-11-12)

- **Executor**: `frontend` on opus, branch `024-phase-7` (from `origin/main` at a9fd2ae5, #374).
  Nothing ran on `fable`; the advisor was not consulted.
- **Result**: built; the hero ships without dish pictures (nothing recorded as chosen — see
  "Waiting on the owner").
- **What changed**:
  - **Landing** (`_shared/Landing`): the sheet's hero — eyebrow in the small accent capitals, the
    title in the heavy face with its last words in the accent (`landing.titleAccent`, the title's
    own last words, `lib/titleAccent`; the `h1`'s text is unchanged), lede, the two calls to action
    side by side (stacked below 23.5rem and under large text), the note. From 64rem the food sits
    beside the copy; under it on a phone. The food is `components/LandingPictures` over
    `lib/landingPictures.ts` (empty) or — now — the illustrative plan, redrawn as the plan's day
    draws it: «Día 6 de 14» in the display face, one row a meal on the sunken ground with the
    slot's designed state (`DishPicture` without a picture), the slot in small capitals, the
    totals and the three figures. Then the sheet's three tiles (`landing.highlights`, new, both
    languages; the first on the highlight fill). Then every section the page had: the four steps
    (numbered large, no box), the six feature cards, the safety band with its three notes, the
    FAQ (accordion and its JSON-LD unchanged), the closing call to action on a card, the footer.
  - **Pictures, ready and switched off**: up to three tiles, each a `DishPicture` (`hero` variant
    for all — a `thumb`'s mark shrinks, § 2.8 N4), side by side, never overlapping or rotated
    (N2), the first eager with its dimensions and the rest lazy, the original file (B1–B2), the
    caption `landing.heroPicturesNote` (legal's exact words, both languages) in the same figure
    (N5), `data-ai-generated` on the figure (W4), no names (W3, P4). With pictures, the plan moves
    under the tiles. `LandingPictures.test.tsx` renders it to a string and checks the marks, the
    hidden names, `alt=""`, the caption, no `srcset`, eager/lazy and the cap of three;
    `lib/landing.test.ts` checks the accent split and that no landing string says «foto» /
    «photo».
  - **Header** (`SiteHeader`): the brand in the heavy face with the gradient mark, the hatched
    pattern behind it, glass by default and lifted at the top of the page (`data-at-top`, the
    app's rule); every control kept (four section links from 64rem, language, theme, «Acceder»,
    «Crear mi plan» from 40rem). Wraps instead of clipping; not sticky under large text.
  - **The pattern** is now one component, `components/HeaderPattern`, used by `AppNav` (same CSS,
    moved), `SiteHeader` and `AuthShell`.
  - **Sign-in family** (`AuthShell`, `AuthForm.module.css`): the app's header (brand, language,
    theme, the pattern) over one 25rem column that arrives (`motion-enter`); titles in the heavy
    display face, a step down under large text; the alerts flat and square. Every provider, the
    passkey path, every error and the legal notice unchanged in place.
  - **Legal pages** (`LegalScreen`): the same text, set for reading — heavy display title, the
    sections divided by hairlines with heavy `h2`s, the text at 16px on a relaxed line, accent
    list markers, the article arriving. Not a word of `privacy` or `terms` changed.
  - **Footer**: the brand in the display face; the columns no wider than their box at 200% text.
- **Evidence** (local production build against the local API, local Postgres):
  - DONE — `pnpm --filter web test`: 49 files, 416 tests (incl. `legal.test.ts`; new
    `lib/landing.test.ts` 6, `LandingPictures.test.tsx` 3). `pnpm turbo lint ts:check test
    --filter=web --filter=ui` green; `format:fix` no change left.
  - PARTLY — `gate.sh --full`, twice: **red on `api#test:coverage` only** — 18 then 24 timeouts in
    five auth suites (`ResetInBackground`, `EmailVerification`, `PasswordPolicy`,
    `AccountSecurity`, `TwoFactor`) while other agents' jobs held the machine's load at 5–7. This
    branch touches no file under `apps/api`, `packages/core` or `packages/database`; `pnpm --filter
    api test:coverage` run on its own: **127 suites, 1792 tests, all green**. Every other step run
    after it, one by one: migrations, web build, static pages, contrast (5 themes), format,
    deadcode, leaks — **all green**. The lead's gate on a quiet machine is the one to trust.
  - DONE — overflow (`probe.mjs`, viewport shots), the 22 public paths (`/`, `/acceder`,
    `/registro`, `/recuperar`, `/restablecer`, `/pendiente`, `/verificar-email`, `/acceder/codigo`,
    `/cambiar-contrasena`, `/privacidad`, `/condiciones` and their `/en/` twins) × 320/360/390/768/
    1280 × Claro, Oscuro, Huerta, Pulso, Alto contraste: **550 loads, 0 hits**. `/en` at 768 and
    1280 never reaches network idle (the `/en/registro?_rsc` prefetch stays open — the same
    finding as phase 2, LOG line ~320, older than this phase; clicking the link lands in 150 ms):
    those ten were probed with a scratch copy of the probe that waits for `load`.
  - DONE — `widths.mjs` 320→1400 on all 22 paths: clean.
  - DONE, with fixes — 200% text (CDP `Page.setFontSizes`) at 320 and 390, element by element,
    Claro (13 paths) and Oscuro (6): first run 3 pages hit — the footer's columns
    (`minmax(9rem, 1fr)` is 288 px at 32 px), the legal lists (an implicit `auto` grid track) and
    long words breaking inside themselves in the display titles. After capped gutters
    (`--gutter-page`), `minmax(min(100%, 9rem), 1fr)`, `minmax(0, 1fr)` and a title step down
    under the large-text query: **0 hits**; screenshots read («Nutrición», «Bienvenido» whole).
  - DONE — control baseline, 44 files (`*.public.*`, both languages, phone and desktop),
    **captured on the base commit before any change** and after: **identical** — no control
    gone, none renamed (`for-lead-7/baseline-diff.txt` is empty).
  - DONE — motion at 4× CPU, 390 px, `/`, `/en`, `/acceder`, `/privacidad`: CLS 0 at load and
    while scrolling the whole page on `/`, `/en`, `/privacidad`; animated properties only
    `transform`, `translate`, `opacity`; reduced motion: 0 animations running. `/acceder` measured
    0.0433 once and 0 on four later runs: the passkey button arriving after hydration below the
    submit (older than this phase).
  - NOT RUN — **Lighthouse**: no binary on the machine, and fetching one was refused. The local
    LCP read by `PerformanceObserver` (no network throttle, so not comparable with phase 0's
    1,513 ms) is 210–225 ms on `/` and `/en`; the hero has no picture, so the LCP element is the
    `h1`, painted by the server as before. Phase 0's `label-content-name-mismatch` could not be
    re-checked without Lighthouse; a script comparing every `aria-label` with its visible text on
    `/`, `/en`, `/acceder`, `/en/registro`, `/privacidad`, `/recuperar` found no mismatch.
  - NOT RUN — the `seo` and `accessibility` agents (none was running in this session); an iPhone.
  - Screenshots read beside the sheet's crops: `/` at 390 and 1280 in Claro, 320 in Oscuro, 768
    in Alto contraste and Pulso; `/acceder` at 390 Claro, 320 Oscuro; `/en/registro` at 320
    Huerta; `/privacidad` at 320.
- **Compared with the sheet** (`03-admin-and-landing.jpg` «Portada pública», `02-mobile-complete.jpg`
  «Portada pública» and «Acceder») — what remains different, and why:
  - **No dish pictures in the hero**: none chosen by the owner yet (legal § 2.8 P3); the plan
    stands in their place. When they come: a grid, not the sheet's rotated overlap (N2), and the
    «IA» mark and the caption the sheet does not draw (PRD § "What changes", 7).
  - **The title's accent is solid deep tomato, not the gradient** (PRD § "What changes", 2; the
    gradient's light end is under 3:1 on the paper, phase 1b), as Inicio's greeting.
  - **The words** are the product's («Nutrición que se adapta a ti.», «Bienvenido de nuevo»): the
    sheets' words are examples (PLAN Hand-off). The three tiles take the sheet's first two lines and
    a third about the fortnight, because the sheet's «Un asistente» is behind a switch and the page
    may not promise it when it is off.
  - **Theme switch in the header**, and «Crear mi plan» hidden in the header below 40rem (the hero
    carries it) — the owner's and phase 1b's.
  - **Kept, not drawn by the sheet**: «Personalización» and «Seguridad» in the header's links (the
    sheet draws three: «Cómo funciona», «Preguntas», «Privacidad»; ours has four and «Privacidad» is in
    the footer), the hero's note, the illustrative plan, every section below the tiles, the footer.
  - **Acceder**: the legal sentence stays **above** the provider buttons (the sheet draws it at the
    foot: `apps/web/AGENTS.md` § Auth, visible before any control that creates an account), and the
    passkey button stays **after** the submit (the sheet draws it third among the providers: it only
    exists after hydration, and at the top it would push the whole form down). «¿Has olvidado tu
    contraseña?» stays by the password and «Crea la tuya» in the foot, where they were.
  - The public pages keep their ambient light and grain under the pattern.
- **`apple-web-design` REVIEW** (landing, sign-in family, legal pages; from the code and the captures):
  - Overall: **PASS** — one dominant title per view, the primary action findable at once, every
    control native and labelled, contrast held by the gate's pairs (no new token, no new pair).
  - P0: none. P1: none.
  - P2 — two filled «Crear mi plan» in the first screen from 40rem (header and hero): considered and
    kept — one action, one destination, and the sheet draws both.
  - P2 — boxes: feature cards, the safety band, the closing card. Reduced in this phase: the steps
    lost their tiles and stand on the page.
  - P3 — the large-text header wraps to three rows on a 320 px phone (it scrolls away there).
  - What works: the hero's hierarchy (eyebrow → title → lede → one primary), the plan drawn as the
    product draws a day, the sign-in column under the app's header, the legal text at a reading measure.
  - The owner's exceptions named here: the drifting pattern (now on the public pages and sign-in),
    generous motion (arrivals, the list stagger), the wide gradient (the filled pills, the brand mark),
    the large radii (the plan card, tiles, the closing card).
- **Inventory** (`inventory/public.md`, `inventory/auth.md`): every line present — the baseline is
  identical, and the landing's 29 rows, the header's B1–B10 and the footer's C1–C14 were checked
  against the new page; A1–A6 (skip link, JSON-LD, `main#contenido`, share card, titles, manifests)
  untouched. New: the three tiles; the hero section is a named region.
- **Waiting on the owner**: the pictures (`for-lead-7/owner-pictures.md`), and the captures.
- **For the lead**: `seo` (metadata unchanged, nothing to change in sitemap/JSON-LD; O2 `noimageindex`
  becomes a question only with pictures) and `accessibility` reviews; Lighthouse ×5 on `/` where a
  binary exists.
- **The lead's check and the two reviews (2026-11-13)**: `gate.sh --full` green on a quiet
  machine (the executor's red runs were load). Read at 390 beside the sheet's crops: the
  landing (top, further down, 1280, Oscuro, 320), `/acceder`, `/registro`, `/privacidad` — no
  sideways scroll on any. `seo` (code only): nothing above P2; the `h1`'s text, the metadata,
  the sitemap and the FAQ's JSON-LD unchanged; recommends `noimageindex` on `/` and `/en` when
  the first picture is added (legal O2). `accessibility` (code only): nothing above P2; two P2
  fixed here — the header's section links get the 44 px target on a coarse pointer, and the
  public pages reserve the sticky header's height when a focused control is scrolled into view
  (2.4.11), reset where the header is not sticky.
- **Approved by the owner (2026-11-13)**: the captures, as they are — the hero without pictures.
  And his decision on the headline: the sheet's, «Come bien sin pensarlo.» («Eat well without
  thinking about it.»), its last words in the accent. This is the page's `h1` and the share
  card's line; the title and description in the head are unchanged. The four baseline files
  that name the heading are updated.
- **The hero's pictures (2026-11-13)**: the owner asked for them and delegated the choice
  («las que mejor estén. Elígelas tú»). Chosen from production, read-only, among the pictures
  the judge accepted with no note and no extra food (5/5 realism and sharpness, one dish,
  nothing that is not food), never one accepted by hand, of `seed` or `ai` dishes; each then
  looked at by the lead beside its ingredient list — no food the list lacks, no person, hand,
  brand or text — and sent to the owner to look at himself (legal § 2.8 P3):
  - `e03c398a-30a2-40f1-a8a8-e7f7fef6acaa` — Salteado de gambas y edamame al jengibre con arroz
    basmati (seed), the large one;
  - `e16f6175-0918-48fc-8af8-841115bc5c12` — Tortilla de patatas y pimientos del piquillo con
    ensalada verde (seed);
  - `6e12e063-9bb2-4fec-be80-73b8944e7b9a` — Copa de Yogur Proteico con Granada y Nueces (ai).
  With pictures on it the landing page says `noimageindex` (legal O2, `seo`'s recommendation):
  `index, follow, noimageindex` on `/` and `/en`, read in the built page. Seen on a local build
  at 390, 1280, 320 (Oscuro) and 768 (`/en`, Huerta): no sideways scroll; the first picture
  eager and the other two lazy, each the original 1200 × 896 file with no `srcset`, each with
  its «IA» mark, the caption under them. NOT RUN: Lighthouse (no binary here) — the files are
  180–226 KB each and the plan asks for Performance within three points of phase 0, or one
  picture or none; the comparison of each file's SHA-256 with a stored one (B3: none is stored
  that this check could read).

## After phase 6 — buttons side by side, and a destructive button in the theme (2026-11-13)

**Reported by the owner** with a capture of Perfil → «Verificación en dos pasos»: two buttons
of one card stood one over the other, and the filled red of «Desactivar» did not belong to the
theme. He asked for every card where it happens, and for every button's colour to be looked at.

- **One rule, `button-row`** (`packages/ui/src/styles/classnames.css`): a group of buttons
  that belong together stays on one line at the smaller button's measure; where the row is too
  narrow for every label on one line, a label wraps inside its own button, which grows.
  Applied to the action groups of the profile's cards: the second factor (its card, its setup,
  its password step, its backup codes), the passkeys, the sessions, the targets, the health
  panel, the consent card, the care link, deleting the account — and deleting a conversation.
  The two groups that hold a sentence and a button keep wrapping as they did.
- **The destructive button** is the error's own ink on its own pale ground with an edge of
  that ink — the shape of a secondary button, red only in its words — instead of a filled red
  beside the brand's filled tomato. The pair (`--color-error-text` on `--color-error-surface`)
  is one the contrast script already holds in every theme. The other three variants were read
  again in Claro and Oscuro and left as they are: the filled one in the brand's deep gradient,
  the outlined one, the text one in the solid accent.
- **Verification** (local build, a probe account with a second factor): on `/perfil` at 390 and
  320 in Claro and at 390 in Oscuro, «Generar códigos nuevos» and «Desactivar» share one line
  (at 320 the longer label wraps inside its button), no other group of two buttons stands on
  two lines, no sideways scroll. NOT RUN: the confirmation states of each card in a browser
  (they use the same rule), Huerta, Pulso and Alto contraste by eye, an iPhone.

## Phase 7b — The mails (2026-11-13)

Branch `024-phase-7b`. Scope held: only `apps/api/src/modules/email/templates/**` and their specs.

**What a mail looks like now** (`Layout.ts`, once for all fourteen):

- Cream paper (`--background-01`) on the body *and* on a full-width wrapper, because Gmail drops
  the body's style. A centred column of 32rem with a 1.25rem gutter, as before.
- The brand line: the leaf — an empty `<span>` drawn as the web's mark (one square corner, three
  round), the accent gradient over its solid start, `aria-hidden` — then «NutrIA» at the display
  weight (800, `--font-weight-heavy`) in ink. The footer «NutrIA» sits under a hairline
  (`--border-01`).
- The filled button: `--color-brand-fill` → `--color-brand-fill-end` at 135°, written as a
  `background-image` over a `background-color` of the solid deep fill, so a client without
  gradients (Outlook desktop, some webmails) paints the solid fill. Radius `--radius-control`
  (10px). `max-width:100%`, `box-sizing:border-box`, `overflow-wrap:anywhere`: a long label wraps
  inside its column.
- Links (the fallback address, the reset link in «Alguien ha intentado crear una cuenta», the
  digest's «Abrir en la consola») are `--color-brand-11`, the one solid deep tomato small text
  may wear (PRD § What changes, 2). The digest's links had no colour of their own before.
- The flat note: «Si el botón no funciona, copia esta dirección…» and the address now sit
  together in one square-cornered block on `--surface-card`, no coloured edge. Seven templates
  had that pair written by hand with the old green inline; they now call `fallbackLink()`.
- Type: the system stack as before. No web font, no picture, no remote resource — checked: the
  screenshot run blocked and logged every non-`file://` request, and there were none.

**Dark**: `<meta name="color-scheme" content="light dark">`, `supported-color-schemes`, and a
`<style>` in the head whose only content is `:root{color-scheme:light dark}` and a
`@media (prefers-color-scheme: dark)` block repainting each class (`nutria-paper`, `-ink`,
`-muted`, `-link`, `-note`, `-edge`, `-leaf`, `-fill`) with Oscuro's values, `!important` over the
inline Claro. A client that ignores the block (Gmail on the web) shows Claro, complete.

**The token spec** (`LayoutTokens.spec.ts`): it reads `Layout.ts` as text and, inside
`const CLARO = { … }` and `const OSCURO = { … }`, takes every line written
`key: '#rrggbb', // --token`. It reads `apps/web/src/styles/themes.css` as text (path relative to
the spec, five levels up), takes the block from `[data-theme='claro'] {` (or `'oscuro'`) to its
closing brace, and finds `--token: #rrggbb;` there. It fails when a literal differs from its
token, when a line in either table has no token comment, when the two tables name different keys
or tokens, and when any template file writes a colour outside those two tables. Checked by
mutation: `paper: '#fbf5eb'` fails it.

**The text spec** (`MailText.spec.ts`, `__fixtures__/mail-text.json`): 56 cases — every template
in both languages (the owner's two in Spanish only, as they are sent), every variant whose words
differ (each two-factor event and removal step, each owner alert, a full and a quiet digest, with
and without a device, one and several passkeys). For each: `kind`, subject, plain text, and of the
HTML the `<html lang>`, the `<title>`, every link's target, and the body's words — styles and
scripts removed, block tags as line breaks, inline tags dropped, entities decoded, whitespace
collapsed. Dates are replaced by a placeholder computed with the same `Intl` call, so a Node
release with other ICU data does not fail it. **Before/after**: commit `c88c8686` added the spec
and the fixture, written from the templates as `origin/main` had them, and touched no template;
the next commit changed the look and the fixture is byte-for-byte unchanged
(`git diff c88c8686 HEAD -- '*mail-text.json'` is empty). The one later edit to the spec is a
type fix of its own input (`{}` → `{ browser: null, system: null }`, the same "no device"), and
it stayed green against the unchanged fixture.

**Specs that read a mail's HTML**: six existing specs looked for `@`, an id or a health word in
the whole HTML; the stylesheet's `@media` would have tripped the `@` ones. They now read
`withoutStylesheet(html)`, which removes the exact fixed `STYLESHEET` string and nothing else, so
an address in an attribute is still caught.

**Contrast** (WCAG, measured on the literals):

| Pair | Claro | Oscuro |
| --- | --- | --- |
| body text on paper | 14.87:1 | 14.46:1 |
| muted text on paper | 5.96:1 | 7.98:1 |
| link on paper | 5.61:1 | 7.97:1 |
| muted text on the note | 5.38:1 | 6.73:1 |
| link on the note | 5.07:1 | 6.72:1 |
| button label on the fill's start | 5.71:1 (white on #b93a12) | 5.90:1 (#2a1b26 on #ff6e45) |
| button label on the fill's end | 4.66:1 (white on #c4501a) | 6.98:1 (#2a1b26 on #ff8a3d) |

Before, the button was white on #5b7f3a, 4.62:1.

**Screenshots**: every template rendered with long real-shaped inputs (a 200-character token
link, a long double-barrelled name), headless Chrome, 360 and 600 px, light and dark: 104
captures. The script measured `scrollWidth` against the viewport and every element's box: no
sideways scroll and no element past the edge in any of them. The long token link breaks inside
the note. Nothing was mailed; no mail catcher was started.

**Verification**:
- DONE — `pnpm --filter api test`: 1889/1889 green with `NUTRIA_LOCAL_PG` unset.
- PRE-EXISTING — with `NUTRIA_LOCAL_PG=1` in the environment, 23 tests in five auth specs
  (`EmailVerification`, `ResetInBackground`, `PasswordPolicy`, `AccountSecurity`, `TwoFactor`)
  fail every time; the same 23 fail with `origin/main`'s templates put back, and each passes run on
  its own. Not this phase's; for whoever owns those specs.
- DONE — `gate.sh --full` green (run with `NUTRIA_LOCAL_PG` unset, for the reason above).
- NOT TOUCHED — the API end-to-end suites (`apps/api/test/`), not run here; CI runs them.
- NOT RUN — the owner's look on his iPhone and in Gmail on the web, light and dark: the
  phase's human-verify.

**The lead (2026-11-13)**: the branch taken over and `main` merged in. `turbo.json` gives the
`test` and `test:coverage` tasks the web's `themes.css` as an input, so a cached green run is
not replayed after a Claro or Oscuro value changes (the token spec reads that file from the
`api` package, which does not depend on `web`). Two of the 104 captures read by the lead
(VerifyEmail es 360 light, CheckInReminder es 360 dark) and sent to the owner.


**The owner on the wordmark (2026-11-13)**: «NutrIA» stays in ink at the display weight, the
leaf carrying the colour, as built.

**CI's first run on the phase (#383) — red, and a deviation from the plan**: two end-to-end
suites (`picture-alerts`, `owner-alerts`; six tests) hold that an owner's mail carries no
address by asserting that no part of it contains `@`. The dark look's stylesheet is an
`@media` block, so the HTML part failed. The executor had met the same check in six unit specs
and read the mail through `withoutStylesheet`; the end-to-end suites were outside its scope.
The plan says "the API e2e suites untouched": they are touched in one line each — the HTML part
is read without its stylesheet, a fixed string with no word in it — and the invariant they hold
is unchanged. The other 55 suites were green.

## Phase 8 — The console (2026-11-13)

Executor: a `frontend` role agent, on branch `024-phase-8`; taken over by the lead on `024-phase-8-ship`. The approved sheet is `reference/04-console-remaining.html`. Steps 1 and 2 first, then the batch after the owner approved the sheet.

### Step 1 — the shell and the three approved pages
- Shell: the leaf mark and «Consola» in the display face (bar and sidebar); the current page is the ink pill (`--foreground-01` ground, `--background-01` words, the pair `PlanSwitch` holds in the contrast script) with a `forced-colors` edge; `HeaderPattern` hangs from the top of the page column, not behind the sidebar. `AdminPageHeader` at the heavy weight and display tracking; `PeriodSelector` as the dark pill.
- Resumen: «Necesita tu atención» is a card with its title inside, in one band with the charts. Interruptores: two columns from 48rem, each group a card with its name in tomato capitals inside (`components/AdminSwitchGroup`, the heading stays an `h2`), the switch at the row's end (`SettingSwitch placement="end"`; Perfil keeps the switch first); Notificaciones now before Límites; Límites one full-width card (eight rows with paragraphs and two fields each). IA y modelos: the six tiles first, failure reason as the pale error pill with its words, model names in monospace.
- 200 % text found, and fixed, the switch rows at 320 and the limits grid at 390 (`minmax(0, 1fr)` columns, `AllowanceField` wraps its button under its box, a long switch name breaks beside its switch).

### Step 2 — the sheet, and the owner's answers
One sheet for the page types that had none: (a) a table page (Cuentas), (b) a report page (Imágenes), (c) the review of one picture. Approved by the owner 2026-11-13 («Aprobada»). His other answers: every console table is **one card a row on a phone** («Filas como tarjetas»), no sideways scroll there; on desktop the table, with the pinned first column and a visible edge where more is hidden; on Resumen «Necesita tu atención» comes **before the charts** on a phone.

### The batch — the other 18 routes
- **Tables.** `AdminReflowTable` is now the one console table: a `DataTable` on a card wide enough (≥ 36rem of card) and, below that, a card with one block a row — the row header as the title, every other cell under its column's name in small capitals, two to a line, the row's actions last (a column keyed `actions`), and a table of a name and one figure (Sistema's versions, switches and limits) as one line each. A table that sorts keeps its sort links above the blocks as pills («Ordenar por», new key `adminConsole.table.sortBy` in both languages), the order being shown the dark pill. `AdminTable` renders it; so do the nine tables that used `DataTable` directly (IA ×3, Despensa, Consentimientos, Sistema ×5), whose pages lose their own table CSS. Wide tables: `DataTable` draws a soft shadow on the side that has columns behind it, and it goes when the scroll reaches that side (the scroll-shadow pair of backgrounds, no script).
- **Resumen order.** «Necesita tu atención» is first in the source and, on a phone, on the screen (the owner's answer). On a wide page the lead put it back where sheet 03 draws it — the charts wide on the left, the list narrow on the right (`order: 2` from 56rem of page) — because the owner's standing rule is the sheet, and his answer changed the phone only. The price is written down: on a wide page the tab order visits the right column before the left one.
- **The picture review** (`catalogo/[id]/imagen`): the picture takes the left column down both rows; what the judge saw and the dish, then the decision, in the right one — the same order in the source; labels in small capitals; the help text and the actions in a card; the buttons in a `button-row` (they stacked on a phone before). The destructive one is the soft button.
- **Addresses.** The email in Cuentas and Profesionales and the sender in Buzón no longer say `nowrap`: in a card they wrap inside it (the table's cell keeps them on one line).

### Checked
- Overflow, `probe.mjs` (scrolled or clipped, element by element): 21 routes × 5 widths (320/360/390/768/1280) × 5 themes × es and en, viewport screenshots: 0 hits after one fix (an address 3 px past a 320 px card in Cuentas, fixed; the three pages with that class re-run clean). `widths.mjs` 320→1400 on the 21 routes: clean. 200 % text (CDP `Page.setFontSizes`, element by element) at 320 and 390, Claro and Oscuro, es and en, 21 routes: clean.
- Data on the routes: the probe accounts add one message to Buzón (a long unbroken word) and one professional to Profesionales through the product's own routes; Cuentas has four accounts. The other tables hold the local database's rows (Recetas 1740).
- Baseline, 21 routes + an unknown address, es and en, phone and desktop, before and after: no control gone. Changes: IA's three table captions are now headings inside their cards (added, not lost); Interruptores' switch «Consulta para dietistas» reads checked (the probe's professional link turned it on — data, not markup). **A limit of the baseline script:** it does not list the buttons inside table rows (the «Retirar» in Profesionales is not in the file before or after), so row actions were checked by eye on the captures (Cuentas: Abrir cuenta, Dar premium / Pasar a gratis, Hacer profesional, Quitar el segundo factor, on the phone card and in the table).
- The console is a 404 for a non-admin account on all 21 routes and on an unknown address, light and dark: 88 of 88 loads.
- `pnpm --filter web test` 416 passed, `pnpm --filter ui test` passed; `gate.sh --full` green with `NUTRIA_LOCAL_PG` unset, servers stopped, probe accounts (admin, plain, professional, client) deleted.
- By eye: Claro and Oscuro on every page type; Huerta and Pulso on a table page (Cuentas, phone and desktop), Alto contraste on Resumen and Imágenes; Pulso on the review (shape D). Huerta on the report page and the review, and Alto contraste on a table page and the review, were not looked at.
- apple-web-design REVIEW: no P0 or P1. P2: the table's edge shadow is `--foreground-01` at 22 % (a non-text cue, measured only by eye); the toolbar keeps its grid (search, Filtros, Por página, Aplicar over rows) where the sheet drew one line. P3: `AllowanceField` is not `Input` + `Button`.

### Not verified, and why
- The picture review's shapes A, B and C (a rejected candidate, a picture accepted by hand or by the judge) need a recipe with a candidate or a published picture; the local database has none and a trail or picture row is never written by hand. The page's markup changed there (the card around the actions, `button-row`, the column rule `.review > :first-child`); shape D (nothing to review) was looked at in five themes. Worth the owner's eyes on the first real candidate.
- Huerta, Pulso and Alto contraste were not looked at on every route, only on the page types listed above; the overflow matrix covers all of them.
- Not an iPhone.

### The lead's check, and what it changed
- Full-page captures at 390, 320 and 1280 of Resumen, Cuentas, Profesionales, Recetas and Sistema, Claro, with a two-factor admin, a professional and a linked client made by `account.mjs`.
- **A row's buttons stood one over the other** in Cuentas — in the phone's card and in the table's cell, where «Quitar el segundo factor» was a sibling under the others. The owner had asked on 2026-11-12 for no button over another. `TwoFactorRemoval` now sits in the row with the others (`button-row`); in a table cell each name stays on one line, side by side; in a phone's card they are two to a line at equal widths, a long name wrapping inside its button (`--row-actions-display`, `--row-actions-space`, `--row-actions-shrink`, set by `AdminReflowTable`, read by `AccountActions` and `TwoFactorRemoval`). `ProfessionalRevoke`'s buttons take `button-row` too. Seen at 1280, 390 and 320.
- Overflow probe after those changes, 320/390/1280 × light and dark, on Resumen, Cuentas, Profesionales, Buzón, Recetas, Interruptores, IA y modelos: 0 hits, no target hint.
- Baseline: the refreshed console files are committed, less the two switch states that were the local database's and not the page's. They add `button "Tema"` to every console page and the three headings in IA y modelos; nothing is gone. Two new files: the picture review and an unknown address.
- Not seen: the dialogs opened from a row (make professional, remove the second factor, revoke) after the change; Huerta, Pulso and Alto contraste on the changed rows.

## Phase 9 — The whole thing, checked (2026-11-13)

- **Executor**: `frontend` on opus, branch `024-phase-9` from `origin/main` at 6792bb06 (#384),
  in its own worktree. Nothing ran on `fable`; the advisor was not consulted. The lead's branch
  `dish-picture-window` (a66a9441, 92d5af47) merged in at its request and checked in the app (§
  "The picture's clear window" below).
- **Result**: built — every step run; ten defects found and fixed (all of the owner's two
  standing rules: stacked buttons, and one overflow at 200 % text); waiting on the lead's
  `accessibility` and `seo` audits and on the human-verify.
- **Where each thing was checked.** Never signed in to production and never touched its
  database. **Production** (read-only GETs, `https://…vercel.app`): the public pages only — the
  control baseline and the overflow/stacked sweep. **A local production build** against the
  local API on the local Postgres (`NUTRIA_LOCAL_PG=1`, `RATE_LIMIT_MAX=100000`) with probe
  accounts made by `account.mjs`: a plain account (`noplan`), one with two generated plans
  (`plan`: a current plan and a replaced one in history), an admin with a second factor, a
  professional without a second factor (the gate) and one with it (`pro2`) linked to a client
  for whom the professional generated a plan to review (the product's own route,
  `POST /care/clients/:id/plan/generate`), and that client. The `assistant` switch was turned
  on through the console's own `PATCH /admin/settings` for the run and off after; the
  `professional` switch was turned on by `account.mjs link` and back off by its `delete`. For
  the picture check, the lead's `pictures-local.mjs` gave the probe plan's dishes picture rows
  (local only), removed after with its `clean` mode.

### Step 1 — the inventory, line by line

The inventory has 1,111 numbered rows in its five files. Each row was checked two ways:

- **Mechanically, against the code** (`inventory-ticks.md` in the hand-off, one line per
  section): every dictionary key a row names is still in `es-ES.ts` (hence `en-GB.ts`, by type)
  and still read by some file of `apps/web` or `packages/ui`, and every component file it names
  still exists. **1,098 rows pass outright.** The other 13 rows name 16 things, all explained:
  - `progress.overallLine` — split into `overallFigure` + `overallWords` (phase 5: «N de M» in
    the ring and its words under it). The words are on screen.
  - `dashboard.dayOf` («Día {current} de {total}») — replaced by the sheet's line «Viernes 13 ·
    día 1 de 14 de tu plan» (after phase 6, #374). Seen.
  - `appNav.sectionsLabel` — removed in phase 3 with the header's second nav (LOG phase 3).
  - `assistant.fieldHint`, `assistant.conversationsEmptyTitle` — rendered by nothing already at
    phase 0 (LOG phase 0, notes). Not this project's.
  - `practice.stages.awaiting_plan` — read by a computed key, present.
  - `health.supervisionRecommended` — an API field the row names, not a key.
  - `picture.removed`, `picture.accepted`, `auth.sessions_revoked`, `auth.password_changed`,
    `auth.backup_code_used`, `auth.2fa_removal_cancelled` — audit event names (data) in the
    console's register, not keys.
  - Dictionary, phase 0 (c1c2a6fc) → now: 2,607 → 2,644 keys; 3 removed (the three above), 5
    values changed, all recorded: `landing.title` (the owner's headline), `privacy.updated`
    (11 Nov), `progress.weightTitle` «Tu peso» → «Peso», `shopping.rangeWhole` «Todos» → «{count}
    días», `shopping.title` «Lista de la compra» → «Tu lista de la compra».
- **In a browser**, every route the inventory names except three (below): the control baseline
  (step 5) for every control and heading; the overflow and stacked-button sweeps (step 3 and
  below) on every route; and the states that exist only after a tap, opened one by one and never
  confirmed (`openers.mjs`): the second factor on, off and new codes (password step), change of
  password, delete the account, withdraw the health consent, adjust targets, add a trip, end the
  care link (client side and professional side), the professional's targets form and swap,
  «Cambiar» on a plan row and on the dish, a shopping row's amount, the tour (from Perfil), the
  theme menu, the console's menu, and the console's row dialogs — **make professional, remove the
  second factor, revoke a professional** (LOG phase 8: "not seen after the change") — and the
  picture review's «Retirar» dialog on a **published** picture (phase 8's shapes A–C were not
  reachable; a picture row now makes the published shape reachable locally).
- **Not looked at in a browser, and why**: `/asistente/[id]` and the message delete
  confirmation (the assistant answers «unavailable» with the stub provider, so no turn is
  stored; checked in code — the pair is a `button-row` now); `/invitacion/[token]` (only
  `account.mjs link` makes an invitation and it accepts it at once); `/plan/generando` (the
  stub finishes before a probe can look); onboarding as a **fresh** account mid-way and
  `/consentimiento`'s interstitial (`account.mjs` always completes onboarding; both rest on
  phase 6's baseline); a plan **scheduled** to start later (`sched`); the picture review's
  rejected-candidate shape (no trail row may be written by hand); offline; the premium checkout
  and the practice's plans (payments deferred, no billing locally).

### Step 2 — `apple-web-design` AUDIT on the whole

(The `accessibility` and `seo` agents' audits are the lead's, after this.)

```md
## Design Review — NutrIA, the whole product after project 024

### Overall
WARN — no P0 or P1 is left after this phase's fixes; five P2 remain, each a recorded decision or
a large-text compromise, which the protocol counts to WARN rather than PASS.

### P0 Critical
None.

### P1 Major
None left. Fixed in this phase (each was two buttons one over the other — the owner's rule —
on a phone; listed under "Defects" below): Compra's share/shops pair, the professional's
publish/regenerate pair and targets form, the console's remove-second-factor dialog, the
landing's two calls to action, the dish's «Cambiar» under «Hecha»; and one element past the
screen at 200 % text (Cuentas' row button).

### P2 Moderate
- Sign-in keeps «Entrar con llave de acceso» under «Acceder», full width
  - Evidence: `SignInForm` (`form.…_form`), every width, production and local
  - Impact: two filled-width buttons stacked in the form's column
  - Recommendation: none now — the sheet draws the sign-in's buttons as a full-width column,
    and phase 7 kept the passkey after the submit on purpose (it appears only after hydration).
    Named so the owner can overrule.
- Under text too large for the screen, some pairs still stack
  - Evidence: at 200 % on 320 px — «Atrás»/«Continuar» (onboarding), «Hecha»/«Saltada», «Me
    gusta»/«No me gusta», «Semana 1»/«Semana 2», «Español»/«English» (Perfil's language), the
    assistant's «Tus conversaciones»/«Nueva», Cuentas' row buttons
  - Impact: a reader with very large text sees one over the other
  - Recommendation: none — each pair's two words need more than the line (measured: e.g.
    383 px for «Atrás | Continuar» in 280 px); side by side they would run past the screen,
    which the owner's first condition forbids. At 390 px the pairs that fit now share the line.
- Two filled «Crear mi plan» in the landing's first screen from 40rem (header and hero)
  - Evidence: `SiteHeader`, `Landing.tsx` hero
  - Impact: two primaries in one view
  - Recommendation: kept by phase 7 (one action, one destination; the sheet draws both).
- Perfil carries every form open, card after card
  - Evidence: `/perfil` (password, second factor, passkeys, sessions, trips, fixed meals,
    health, feedback)
  - Impact: card-everything; a long screen
  - Recommendation: the owner chose to keep it (after phase 6, #374).
- The console table's edge shadow is a non-text cue measured only by eye
  - Evidence: `DataTable` scroll-shadow (`--foreground-01` at 22 %)
  - Impact: may be faint in Huerta
  - Recommendation: add the pair to the contrast script if it is to carry meaning.

### P3 Minor
- The app header wraps to three rows at 200 % text on 320 px (it scrolls away there) — phase 7.
- `AllowanceField` is not `Input` + `Button` (phase 8).
- Picture-window: the 2rem arrow on Inicio's card is drawn on the strip; it is decoration (the
  whole card is the link) — fine, recorded because the owner asked.

### What is working
- One shell, one destination model, the current one named — floating bar and rail.
- The food first: the picture's clear window above its strip is 140–197 px on a phone now, the
  designed no-picture state is never an empty frame.
- Contrast is a gate (five themes × every declared pair), the theme never flashes, Automático
  under `prefers-contrast: more` is Alto contraste (measured), forced colours draw every control.
- Nothing overflows: 0 sideways scroll and 0 element past or cut in every sweep below.

### Top 3 actions
1. The owner looks at the sign-in's passkey button under «Acceder» and says whether it may stay.
2. Safari: confirm on the iPhone that Inicio's picture reaches the card's foot (§ picture window).
3. Put the table edge shadow in the contrast script or drop it as a cue.

### Final verdict
WARN — PASS once the owner confirms the two recorded P2 decisions he has not seen in this form
(the passkey's place, the large-text stacking) or one of them changes.
```

Exceptions named (PRD 9): the drifting pattern, generous motion, the wide gradient (the filled
buttons, the brand mark) and the large radii are present as built in phases 1b–8; nothing new.

### Step 3 — reduced motion, forced colours, more contrast, 200 % text, 320 px

All by `sweep.mjs` (element by element: sideways scroll; an element past the screen; an element
that cuts its own content; two buttons one over the other with nothing between them), a local
build after the fixes, every family: the signed-in app (Inicio, the plan, a dish, history, Compra,
Progreso, Check-in, Perfil, Asistente, the 404), onboarding (nine steps), the professional
(`/consulta`, a client), the console (nine page types incl. Cuentas, Profesionales, Recetas,
Imágenes, IA, Sistema, the 404), the public pages and the sign-in family (`/`, `/acceder`,
`/registro`, `/recuperar`, `/acceder/codigo`, `/privacidad`, `/condiciones`, `/en`, `/en/registro`).

- **Reduced motion** (Automático, 320 and 1280, every family; and the five themes at 390 on
  Inicio, the plan, Progreso, the console's summary and IA, `/`, `/acceder`): **no animation
  running** 1.5 s after load on any of 104 loads; 0 overflow.
- **`forced-colors: active`** (same set, 69 loads; plus `/` and `/acceder` with a dark device):
  0 overflow; screenshots read — every button, field, chip and the bar keep a system edge, the
  rings keep their strokes, the «IA» mark keeps its ground. (Google's mark keeps its colours, as
  `0058` says.)
- **`prefers-contrast: more`** with Automático (same set, 69 loads): every page resolves to Alto
  contraste (`--background-01` is `#ffffff`, checked on each load); 0 overflow.
- **200 % text** (CDP `Page.setFontSizes`), 320 and 390, Claro and Oscuro, Spanish and English,
  every family (284 loads): **first run, one element past the screen** — Cuentas' «Quitar el
  segundo factor» ran 16 px past a 320 px screen (fixed, below); after: 0 overflow. The stacked
  pairs are the P2 above.
- **320 px**: in every sweep below (5 widths).

### Overflow and stacked buttons, every route

- **Before the fixes**, the whole product: 22 signed-in routes with a plan (onboarding's nine
  steps and the 404 included), 7 without, the professional (gate, `/consulta`, a client), 21
  console routes and its 404, 22 public paths — 320/360/390/768/1280 × Claro, Oscuro × es, en,
  then Huerta, Pulso, Alto contraste at 320 and 390: **2,048 loads, 0 sideways scroll, 0 element
  past or cut.** What it flagged was stacking (the defects below, and the judged cases: the
  sign-in's passkey; the plan's days and a desktop's day list, which are a vertical list; two
  buttons in different cards; the 404s of the made-up addresses, which are the point).
- **Production**, the 22 public paths × 5 widths × 5 themes: **550 loads, 0 overflow**; stacking
  only on the sign-in's passkey (judged) and the landing's two calls to action at 320 and 360
  (fixed here; production still has it until this ships).
- **After the fixes**, every route again in Claro, es and en, 5 widths, with the detector widened
  to every `<button>` (a pill like «⇄ Cambiar» is not a `ui` Button — that is how the dish's
  «Cambiar» under «Hecha» was found): **650 loads**; one overflow found and fixed (the swap's
  panel on the dish at 1280, introduced by this phase's first take on the actions row, below);
  then **0**. The opened states again in es and en at 320/390/1280: no pair stacked.

### Defects found and fixed (file — before → after; captures in `shots/`)

1. `components/ShoppingActions` — at 320/360 «Supermercados cerca» under «Compartir lo que
   falta» → a `button-row`, the copied line under it. `before/after-compra-actions-320.png`.
2. `app/(app)/consulta/[linkId]/page.module.css` — at 320 and 390 «Generar otro» under «Publicar
   el plan» → the two share the first line, their hint/failure line under both at the card's
   measure. `before/after-client-plan-actions-*.png`.
3. `components/CareTargetsForm` — at 320 «Cancelar» under «Guardar objetivos» → `button-row`.
4. `components/TwoFactorRemoval` (console, Cuentas' dialog) — at 320 «Programar la retirada» under
   «Cancelar» → `button-row`. `before/after-cuentas-2fa-dialog-320.png`.
5. The same wrapping pair, by code (not reachable or not seen stacking): the picture review's
   three dialogs (`PictureAcceptAction`, `PictureRemoveAction` — seen, fine —
   `PictureCandidateAction`), the care link's end confirmation (`CareEndLink`), the assistant's
   message delete (`AssistantChat`), the swap panel's «Cambiar»/«Cancelar» (`MealSwap`) →
   `button-row`.
6. `app/_shared/Landing.module.css` — below 23.5rem (320/360) «Cómo funciona» under «Crear mi
   plan», **in production too** → two equal halves of the line, less padding, a label wrapping
   inside its button. The sheet draws them side by side. `after-landing-actions-320*.png`.
7. `components/DishActions` + `components/MealStatus` — at 320 «⇄ Cambiar» on a second line
   under «Hecha» → one row from 320 (the marks ask only for their words and keep a tighter side
   padding); the row still wraps for the swap's panel. `after-dish-actions-320.png`.
8. `components/AccountActions` — at 200 % text on 320 «Quitar el segundo factor» ran 16 px past
   the screen → under text too large for the screen each row button takes the whole line (the
   owner's first condition before the button rule).
9. `MealStatus`, `RecipeVerdict`, `PlanDayNav` — under large text a pair that fits now stays
   side by side (each asks only for its longest word) — at 390/200 % «Hecha»/«Saltada», «Me
   gusta»/«No me gusta», «Semana 1»/«Semana 2».
10. `components/DishPicture` + `NextMeal` + `MealPicture` — the designed no-picture glyph under
   the strip after the picture-window change (§ below).

### Step 4 — the server diff

    git diff --stat c1c2a6fc..HEAD -- apps/api/src packages/core/src packages/database

19 files, all under `apps/api/src/modules/email/templates` (+1,144 −57), one commit: 52a1e8cb
(phase 7b, #383). Nothing else; this phase touches none of them. (Outside these paths, 7b also
changed one line in each of two API e2e suites, `picture-alerts` and `owner-alerts` — recorded
in its LOG entry.)

### Step 5 — the baseline against phase 0's files

`baseline.mjs` on the states phase 0 captured (public, noplan, plan, admin — 208 files, read
from c1c2a6fc), both languages, phone and desktop; the public pages **in production** and
locally, the rest locally; run before the fixes and again after them.

- **No control and no heading of phase 0 is gone.** Every line that differs is data or a
  recorded rename:
  - Data: dish names, shopping items, the greeting's time of day, a meal marked, a weight, the
    console's «Consulta para dietistas» switch state (the probe's link turned it on).
  - Renames already in the LOG: the landing's `h1` (the owner's headline, phase 7); «Tu plan» →
    the day as the title, «Viernes, día 1» (after phase 6), with the seven day buttons now named
    by their whole date «viernes, 13 de noviembre · Día 1» (were «13 vie»); «Cambiar plato N de
    M» keeps its name and shows «Cambiar»; Compra's `h1` and «Todos» → «14 días»; Progreso's
    «Tu peso» → «Peso» and a fortnight's heading carrying its state; the signed-in 404's words
    (phase 3).
  - Added everywhere: `button "Tema"` (phase 1b). Added: «Lo que aporta a tus objetivos del
    día» on the dish; Inicio's two tiles.
- **Later states** compared with the files later phases committed: the professional with a
  second factor (`consulta.pro`, `consulta_id.pro` with a plan to review) — identical but data
  (an unanswered-invitations heading that shows only with one; the assistant's link, on for the
  run); the gate (`proA`) — identical; a past plan (`plan_historial_id`) — the day as title, its
  «Plan anterior» now the eyebrow above it (recorded after phase 6), the day buttons renamed as
  above.
- **After the fixes** the run was repeated (228 files): 192 identical to the run before the fixes; the rest differ by data only — «Rehacer el plan» is gone from `/plan` and `/plan/proximo` because the probe account had used its one redo of the fortnight (the page says «Ya has rehecho tu plan esta quincena…»), and `consulta.pro` was taken the second time with the professional who has a second factor. No control changed name or went: the fixes moved wrappers, not controls.
- **The committed baseline files are partly stale** (taken before later renames: e.g.
  `compra_proxima.*`, `consulta.noplan.*`, `plan_historial_id.*`). The fresh set is in the
  hand-off (`baseline-new/`), to replace them if the lead wants the folder current — except
  `plan.plan.*` and `plan_proximo.plan.*`, whose missing «Rehacer el plan» is the probe's spent redo.
- Not run: the `fresh`, `resume`, `invited` and `sched` states (see step 1).

### The picture's clear window (`dish-picture-window`, a66a9441 + 92d5af47), checked in the app

Merged into `024-phase-9` (both commits) and looked at on a local production build with 32 of
the probe plan's 40 dishes given a picture by the lead's `pictures-local.mjs` (local database
only; rows removed after with its `clean` mode). The store refuses a headless browser, so the
bytes were fetched outside it and handed to the page by `page.route`, **1.2 s late**, so a
layout shift on arrival would be counted (`window.mjs`, element by element).

- **Clear picture above the strip** (strip's top − picture's top), Inicio's «Lo siguiente» /
  the dish's page: 320 px **140 / 158** (before: Inicio 64 at 390, the dish 135 at 390);
  360 px 160 / 180; 390 px **175 / 197**; 768 px 256 / 381; 1280 px 271 / 357. Identical in
  Claro and Oscuro, Spanish and English (the window does not depend on the name's length; the
  strip grows the box downwards). At 200 % text, 320 and 390: 140 / 158 and 171 / 192.
- **No gap under the picture**: the frame's bottom is the box's bottom in all 56 loads (0 px).
- **No layout shift when the picture arrives**: CLS 0.0000 in all 56 loads — the box has its
  final height before the image loads (the `::before` spacer holds it).
- **No overflow** (scrolled or cut, element by element) in any of them.
- **The «IA» mark** is never under the strip (its bottom above the strip's top in every load).
- **The strip's text and its rounded corners**: every line box's corners lie inside the
  strip's rounded shape with **8.8–10.2 px** to spare at 320 and 390, and **8 px** at 200 %
  text (where the corner's radius, `calc(var(--radius-card) - var(--space-02))`, is 8 px since
  the space token grows with the text).
- **The card still reads as the link**: the whole card is one link (unchanged), the 2rem arrow
  is decoration (`aria-hidden`) at the strip's end; seen at 390 and 320.
- **Found and fixed — the designed no-picture state** (the picture's request aborted, so the
  glyph shows): with the taller box the glyph was centred on the whole frame, and at 320 px the
  strip cut it (Inicio) or touched it (the dish). `DishPicture` now centres the glyph in the
  window the layout keeps clear (`--dish-window`, set by `NextMeal` to `min(50%, 16rem)` and
  by `MealPicture` to `min(56.25%, 20rem)`; alone, the frame's own shape). After: the glyph is
  wholly above the strip at 320, 390 and 1280 and at 200 % text (commit f7b949ef). Captures:
  `shots/picture-window/no-picture-{inicio,dish}-320-{before,after}-fix.png`.
- **A picture that stands alone is unchanged**: the landing's three (`/` and `/en`, 320, 390,
  1280) and the console's review of a published picture (`/admin/catalogo/<id>/imagen` — now
  reachable locally because of the picture rows) all measure **4:3 exactly** (1.333), box =
  frame.
- **Safari**: not seen. The fill rests on `align-self: stretch` on a grid item that also has
  `aspect-ratio`. In the CSS specification a stretched item's block size is definite and wins
  over its `aspect-ratio` (which only applies when the size is `auto`), and Chrome does that
  here. I have no WebKit to run, so I cannot say WebKit does the same; if it did not, the frame
  would keep its own 16:9 / 4:3 height inside the taller box and leave a band of the card's
  ground under the picture. The owner's iPhone is the test: on Inicio, the next meal's picture
  must reach the card's bottom edge behind the strip.
- Captures, 390 px Claro, before and after: `shots/picture-window/before-inicio-390-claro.png`,
  `after-inicio-390-claro.png`, `before-dish-390-claro.png`, `after-dish-390-claro.png`.

### Verification

- DONE — `pnpm turbo lint ts:check test --filter=web --filter=ui`: 14 of 14 tasks green.
  `pnpm --filter web --filter ui format:fix`: nothing left to change.
- DONE — `gate.sh --full` with `NUTRIA_LOCAL_PG` unset, servers stopped, nothing else running:
  migrations, checks, web build, static pages, contrast (five themes), format, dead code, leaks —
  **green**.
- DONE — clean-up: the seven probe accounts deleted through `DELETE /users/me` (a read of the
  local database after: no `@probe.invalid` account left), the probe's picture rows removed
  (`pictures-local.mjs … clean`: 0 left), the `assistant` switch back off, the `professional`
  switch back off (`account.mjs`), the servers stopped.
- NOT RUN — the API end-to-end suites (CI's); Lighthouse; WebKit; an iPhone.

### Not verified, and why

- Safari / an iPhone: nothing in this phase ran on WebKit. The picture window rests on
  `align-self: stretch` on a grid item with `aspect-ratio`; the stacked-button fixes on flex.
- Lighthouse (no binary on the machine).
- The `accessibility` and `seo` audits (the lead's).
- The screens listed in step 1's "not looked at".
- Huerta, Pulso and Alto contraste were swept for overflow and stacking at 320 and 390 only
  (Claro and Oscuro at all five widths); by eye in them: the forced-colour and Alto contraste
  captures listed above, and phase 8's console pages through the sweeps' screenshots of hits.

### Appendix — the inventory, section by section

| File | Section | Rows | Words and files in the code | Explained | Looked at in phase 9 |
| --- | --- | --- | --- | --- | --- |
| admin.md | /admin  (apps/web/src/app/(admin)/admin/page.tsx) | 28 | 28 | — | browser, local |
| admin.md | /admin/cuentas  (apps/web/src/app/(admin)/admin/cuentas/page.tsx) | 43 | 43 | — | browser, local |
| admin.md | /admin/profesionales  (apps/web/src/app/(admin)/admin/profesionales/pa | 12 | 12 | — | browser, local |
| admin.md | /admin/consentimientos  (apps/web/src/app/(admin)/admin/consentimiento | 8 | 8 | — | browser, local |
| admin.md | /admin/personas/retencion  (apps/web/src/app/(admin)/admin/personas/re | 11 | 11 | — | browser, local |
| admin.md | /admin/buzon  (apps/web/src/app/(admin)/admin/buzon/page.tsx) | 18 | 18 | — | browser, local |
| admin.md | /admin/producto  (apps/web/src/app/(admin)/admin/producto/page.tsx) | 11 | 11 | — | browser, local |
| admin.md | /admin/producto/planes  (apps/web/src/app/(admin)/admin/producto/plane | 9 | 9 | — | browser, local |
| admin.md | /admin/producto/planes/calidad  (apps/web/src/app/(admin)/admin/produc | 15 | 15 | — | browser, local |
| admin.md | /admin/notificaciones  (apps/web/src/app/(admin)/admin/notificaciones/ | 8 | 8 | — | browser, local |
| admin.md | /admin/generacion  (apps/web/src/app/(admin)/admin/generacion/page.tsx | 44 | 44 | — | browser, local |
| admin.md | /admin/generacion/ia  (apps/web/src/app/(admin)/admin/generacion/ia/pa | 46 | 46 | — | browser, local |
| admin.md | /admin/catalogo  (apps/web/src/app/(admin)/admin/catalogo/page.tsx) | 28 | 28 | — | browser, local |
| admin.md | /admin/catalogo/[id]/imagen  (apps/web/src/app/(admin)/admin/catalogo/ | 38 | 38 | — | browser, local |
| admin.md | /admin/catalogo/calidad  (apps/web/src/app/(admin)/admin/catalogo/cali | 18 | 18 | — | browser, local |
| admin.md | /admin/catalogo/ingredientes  (apps/web/src/app/(admin)/admin/catalogo | 13 | 13 | — | browser, local |
| admin.md | /admin/catalogo/despensa  (apps/web/src/app/(admin)/admin/catalogo/des | 13 | 13 | — | browser, local |
| admin.md | /admin/catalogo/imagenes  (apps/web/src/app/(admin)/admin/catalogo/ima | 23 | 23 | — | browser, local |
| admin.md | /admin/ajustes  (apps/web/src/app/(admin)/admin/ajustes/page.tsx) | 20 | 20 | — | browser, local |
| admin.md | /admin/ajustes/registro  (apps/web/src/app/(admin)/admin/ajustes/regis | 22 | 16 | `auth.password_changed`: an audit event name (data), not a dictionary key; `auth.backup_code_used`: an audit event name (data), not a dictionary key; `auth.2fa_removal_cancelled`: an audit event name (data), not a dictionary key; `auth.sessions_revoked`: an audit event name (data), not a dictionary key; `picture.removed`: an audit event name (data), not a dictionary key; `picture.accepted`: an audit event name (data), not a dictionary key | browser, local |
| admin.md | /admin/ajustes/sistema  (apps/web/src/app/(admin)/admin/ajustes/sistem | 18 | 18 | — | browser, local |
| app.md | (app) group-wide states  (`apps/web/src/app/(app)/layout.tsx`, `error. | 8 | 8 | — | shared — through the routes above |
| app.md | /asistente  (`apps/web/src/app/(app)/asistente/page.tsx`, frame in `as | 30 | 28 | `health.supervisionRecommended`: an API field named in the row, not a dictionary key; `assistant.fieldHint`: rendered by nothing already at phase 0 (LOG phase 0, notes); `assistant.conversationsEmptyTitle`: rendered by nothing already at phase 0 (LOG phase 0, notes); `assistant.fieldHint`: rendered by nothing already at phase 0 (LOG phase 0, notes); `assistant.conversationsEmptyTitle`: rendered by nothing already at phase 0 (LOG phase 0, notes) | browser, local |
| app.md | /asistente/[id]  (`apps/web/src/app/(app)/asistente/[id]/page.tsx`) | 7 | 6 | `health.supervisionRecommended`: an API field named in the row, not a dictionary key | no — no conversation can be made locally: the assistant answers «unavailable» with the stub provider, so no turn is stored |
| app.md | /check-in  (`apps/web/src/app/(app)/check-in/page.tsx`) | 18 | 18 | — | browser, local |
| app.md | /compra  (`apps/web/src/app/(app)/compra/page.tsx`) | 18 | 18 | — | browser, local |
| app.md | /compra/proxima  (`apps/web/src/app/(app)/compra/proxima/page.tsx`) | 3 | 3 | — | browser, local |
| app.md | /consentimiento  (`apps/web/src/app/(app)/consentimiento/page.tsx`) | 7 | 7 | — | browser, local |
| app.md | /consulta  (`apps/web/src/app/(app)/consulta/page.tsx`) | 34 | 33 | `practice.stages.awaiting_plan`: read by a computed key (`stages[stage]`), present in both dictionaries | browser, local |
| app.md | /consulta/[linkId]  (`apps/web/src/app/(app)/consulta/[linkId]/page.ts | 38 | 38 | — | browser, local |
| app.md | /invitacion/[token]  (`apps/web/src/app/(app)/invitacion/[token]/page. | 12 | 12 | — | no — needs an unaccepted invitation token; only `account.mjs link` makes one and it accepts it at once |
| app.md | /inicio  (`apps/web/src/app/(app)/inicio/page.tsx`) | 31 | 30 | `dashboard.dayOf`: replaced by the sheet's line «Jueves 12 · día 1 de 14 de tu plan» (after phase 6, #374) | browser, local |
| app.md | /onboarding  (`apps/web/src/app/(app)/onboarding/page.tsx`) | 1 | 1 | — | browser, local |
| app.md | /onboarding/[paso]  (`apps/web/src/app/(app)/onboarding/[paso]/page.ts | 9 | 9 | — | browser, local |
| app.md | Step 1 about-you | 5 | 5 | — | shared — through the routes above |
| app.md | Step 2 goal | 3 | 3 | — | shared — through the routes above |
| app.md | Step 3 body-activity | 3 | 3 | — | shared — through the routes above |
| app.md | Step 4 how-you-eat | 2 | 2 | — | shared — through the routes above |
| app.md | Step 5 food-preferences | 3 | 3 | — | shared — through the routes above |
| app.md | Step 6 allergies | 5 | 5 | — | shared — through the routes above |
| app.md | Step 7 cooking | 1 | 1 | — | shared — through the routes above |
| app.md | Step 8 kitchen | 5 | 5 | — | shared — through the routes above |
| app.md | Step 9 review | 5 | 5 | — | shared — through the routes above |
| app.md | Header | 2 | 1 | `health.supervisionRecommended`: an API field named in the row, not a dictionary key | shared — through the routes above |
| app.md | Section "Tu plan" | 58 | 58 | — | shared — through the routes above |
| app.md | Section "Tu dietista" (only when linked or when the trail is not empty | 5 | 5 | — | shared — through the routes above |
| app.md | Section "Tus datos" | 9 | 9 | — | shared — through the routes above |
| app.md | Section "Seguridad" (`#seguridad`; only when the account could be read | 24 | 24 | — | shared — through the routes above |
| app.md | Section "Avisos e idioma" | 5 | 5 | — | shared — through the routes above |
| app.md | Section "Ayuda" | 3 | 3 | — | shared — through the routes above |
| app.md | Section "Zona peligrosa" | 5 | 5 | — | shared — through the routes above |
| app.md | /plan  (`apps/web/src/app/(app)/plan/page.tsx`) | 6 | 6 | — | browser, local |
| app.md | Plan browser (used by /plan, /plan/proximo and /plan/historial/[id]) | 18 | 18 | — | shared — through the routes above |
| app.md | /plan/proximo  (`apps/web/src/app/(app)/plan/proximo/page.tsx`) | 1 | 1 | — | browser, local |
| app.md | /plan/historial  (`apps/web/src/app/(app)/plan/historial/page.tsx`) | 5 | 5 | — | browser, local |
| app.md | /plan/historial/[id]  (`apps/web/src/app/(app)/plan/historial/[id]/pag | 3 | 3 | — | browser, local |
| app.md | /plan/generando  (`apps/web/src/app/(app)/plan/generando/page.tsx`) | 19 | 19 | — | no — opened only while a generation runs; the stub finishes before a probe can look |
| app.md | /plan/comida/[id]  (`apps/web/src/app/(app)/plan/comida/[id]/page.tsx` | 18 | 18 | — | browser, local |
| app.md | /progreso  (`apps/web/src/app/(app)/progreso/page.tsx`) | 13 | 12 | `progress.overallLine`: split into `overallFigure` + `overallWords` (phase 5, «N de M» in the ring) | browser, local |
| auth.md | /acceder and /en/acceder  — Sign in (apps/web/src/app/_shared/SignInSc | 20 | 20 | — | browser, local + production |
| auth.md | /acceder/codigo and /en/acceder/codigo  — Two-factor code (apps/web/sr | 18 | 18 | — | browser, local + production |
| auth.md | /registro and /en/registro  — Create account (apps/web/src/app/_shared | 22 | 22 | — | browser, local + production |
| auth.md | /recuperar and /en/recuperar  — Recover password (apps/web/src/app/_sh | 10 | 10 | — | browser, local + production |
| auth.md | /restablecer and /en/restablecer  — Choose a new password (apps/web/sr | 15 | 15 | — | browser, local + production |
| auth.md | /cambiar-contrasena and /en/cambiar-contrasena  — Forced password chan | 18 | 18 | — | browser, local + production |
| auth.md | /pendiente and /en/pendiente  — Account pending (apps/web/src/app/_sha | 8 | 8 | — | browser, local + production |
| auth.md | /verificar-email and /en/verificar-email  — Email confirmed (apps/web/ | 7 | 7 | — | browser, local + production |
| public.md | Shared A. Root layout of the public trees (apps/web/src/app/(es)/layou | 6 | 6 | — | shared — through the routes above |
| public.md | Shared B. SiteHeader (apps/web/src/components/SiteHeader/SiteHeader.ts | 10 | 10 | — | shared — through the routes above |
| public.md | Shared C. SiteFooter (apps/web/src/components/SiteFooter/SiteFooter.ts | 14 | 14 | — | shared — through the routes above |
| public.md | / and /en  — Landing page (apps/web/src/app/_shared/Landing.tsx, mount | 29 | 29 | — | browser, local + production |
| public.md | /privacidad and /en/privacidad  — Privacy policy (apps/web/src/app/_sh | 20 | 20 | — | browser, local + production |
| public.md | /condiciones and /en/condiciones  — Terms of use (apps/web/src/app/_sh | 19 | 19 | — | browser, local + production |
| shell.md | 3. AppNav (apps/web/src/components/AppNav/AppNav.tsx, AppNav.module.cs | 7 | 7 | — | shared — through the routes above |

1111 rows; 1098 with every word and file still in the code; 16 names explained.

### The lead's part

- **The owner's confirmations, 2026-11-13.** He wrote «Funciona bien» and, asked with options what he had tried, marked all three: the console on his iPhone (phase 8); **the new mails, read on his iPhone and in Gmail** — phase 7b's human-verify, **confirmed by human on 2026-11-13**; and the landing with its pictures, the assistant opening at its top and closing the keyboard on send, and the profile's buttons side by side (#375–#383).
- **The picture's clear window is his decision.** He sent Inicio's card from his phone: the strip left almost no picture, there and on the dish's page. Of three options (a taller picture and the same look; the strip half off the picture; the picture above and the words under it) he chose the first, then asked for a slightly smaller title card, saw both on a static page built from the real sheets, and approved («apruebo ese cambio»). That page is not the app: the executor's check above is.
- **After the executor's check, one change of the lead's** (f8b11938): the executor could not speak for WebKit, and the owner's phone is an iPhone. Under a strip the frame's `aspect-ratio` is now `auto` (`--dish-frame-ratio`) and the image is laid over the frame (`--dish-image-position: absolute`), so the height is the layout's alone and no browser has to rank a stretch against a ratio. The first take of it let the image's own 4:3 set the height from 768 px up (Inicio's window 416 px with a picture and 256 without); laying the image over the frame removed that. Measured again with `window.mjs`, pictures routed in 1.2 s late, 320/360/390/768/1280, Claro and Oscuro: clear window 140/160/175/256/256 on Inicio and 158/180/197/320/320 on the dish's page — the same as above on a phone, and on a wide screen now the window's own cap rather than the frame's old shape (was 271 and 357–381); gap under the picture 0, shift 0, «IA» never covered; with the picture's request aborted the same heights and the glyph in the window; the landing's three and the console's review 4:3 exactly. Still not run on WebKit.
- **The baseline folder is left as it is.** The executor's fresh set was read against phase 0's and against the committed files (step 5) and is not committed: the folder stays the record phases 0–8 made — production for phase 0, each phase's own refresh after — and a local run's data would replace it.
- **The plan's wording** for steps 1 and 5 is amended to say where each was run (production for the public pages, a local build for the rest): nobody signs in to production to run a check.

### The two audits (step 2), and what they changed

**`seo`, the public tree — the redesign cost nothing in search.** Titles, descriptions, canonicals, hreflang, the sitemap, robots (`noimageindex` on the landing only), structured data and static rendering (`x-nextjs-prerender: 1` on every public route) hold in production and on this branch. One P1, older than the project: the shared header and footer linked an English page's brand, sign-in, sign-up, privacy and terms to the Spanish addresses, so the English tree was reached by the sitemap and hreflang alone — fixed by the lead (`withLocale` in `SiteHeader` and `SiteFooter`, 51dbf3c7). P2, not changed: the first landing picture is preloaded at high priority (183 KB) although on a phone it sits under the copy; a `media` on the preload would be the fix, and nothing here could measure what it buys (no Lighthouse). No smaller rendition can exist: the files are served as signed.

**`accessibility`, every family — one P1, nine P2, about ten P3**, so criterion 7 ("no finding above P2") failed until they were fixed. All ten fixed, and four of the P3, by a `frontend` agent on `024-phase-9-a11y` (nine commits, 83e3674d…0f178095); its record follows. The audit's answer to the lead's question on Resumen: at 56rem and wider the focus order — period, «Necesita tu atención» (right), Tendencias (left) — is acceptable under WCAG 2.4.3, two independent sections each with its heading. Two things a reader will see: the site footer's links stand further apart on a touch screen, and a table that scrolls sideways has a 1 px line at its edge. A new file and a flag: `app/global-not-found.tsx` with `experimental.globalNotFound` (Next 16's documented way with several root layouts) — the 404 for an address no route matches now has a language, the theme and a way home; the public pages stay prerendered (the gate's static check). Baseline: Inicio's pressed tick is named «Marcar como hecha» in both states, and the console's sort links lose a stray space; `inventory/app.md` rows 14 and 18 say so.

Left, on purpose: the console's phone card titles stay `<p>`; submit buttons that use `loading` still drop focus when their request fails; `RegisterScreen`'s «Volver a acceder» on the sent screen. Not run: a screen reader; 200 % text after these fixes; `AccountActions`, `EventPlanner` and `PictureAcceptAction` in a browser (read in code, and `Button`'s unit test).

Branch `024-phase-9-a11y`, from `024-phase-9-ship` (9f9e62e3). Nine commits, not pushed. Measured on a local
production build against the local API (`NUTRIA_LOCAL_PG=1`), with three throwaway accounts (one with a
generated plan, one with nothing, and an admin with 2FA). All three were deleted afterwards and the servers
stopped. The scripts are in `scratchpad/a11y9/` (`focus.mjs`, `measure.mjs`, `targets6.mjs`, `sortnames.mjs`),
and their raw output is in `focus.out`, `measure.out`, `targets6.out` and `overflow.out` next to them.

#### P1

##### 1. Marking a meal dropped focus to `<body>`: fixed
- `ui` Button now supports `aria-disabled`. It is drawn the way `:disabled` is drawn (opacity 0.5, no
  hover, no press). It ignores the press with `preventDefault`, which also cancels a submit and an implicit
  Enter-submit. Combined with `loading`, the button is no longer disabled, so it keeps focus and still
  shows the spinner and `aria-busy`. There is a test for this, and `button.mdx` documents it.
- These now use `aria-disabled`, never `disabled`, on the control that was just pressed:
  - MealRow tick (custom button: the handler ignores the press, and the CSS moved to `[aria-disabled]`)
  - MealStatus «Hecha»/«Saltada»
  - RecipeVerdict
  - LocaleSwitcher (both forms; `choose` already ignored a press while one was pending)
  - TargetsPanel: Guardar, Cancelar, Restablecer
  - AccountActions: Activar, Hacer premium/gratis, and the grant dialog's submit
  - EventPlanner: the row's «Cancelar» and «Añadir»
  - PictureAcceptAction: «Publicar»
  - DeleteAccount: «Borrar definitivamente»
- Kept `disabled` where the control cannot hold focus at that moment:
  - AccountActions: the sibling buttons and the «Hacer profesional» trigger (`AccountActions.tsx` ~202)
  - PictureAcceptAction's checkbox (~226). The audit pointed at it, but it is not the control that was
    pressed: «Publicar» is, and that one is fixed.
  - EventPlanner: the other rows' buttons
- Measured with Enter on the focused control, sampling `document.activeElement`:
  - Before (audit): BODY from 30 ms to 1500 ms, and it never came back.
  - After: these 6 cases stayed on the same BUTTON at +30, 300, 800, 1500 and 2500 ms, with `aria-pressed`
    flipping at once:
    - /inicio tick, mark and unmark
    - the dish page's «Hecha», «Saltada» and «Me gusta», each pressed twice
    - /perfil «English» and «Español»
  - With the request held 1.5 s:
    - +30 ms and +700 ms: `BUTTON pressed=true aria-disabled=true`
    - +2200 ms: `BUTTON pressed=true`
    - Two more presses while pending: the second was ignored.
- How it is announced: focus stays on the button whose `aria-pressed` changed. No live region was added.

#### P2

##### 2. Tour: fixed
`leave()` sets `tabIndex=-1` only when the element has no `tabindex` attribute and is not focusable by
itself (`tabIndex < 0`), which means only the heading fallback. After closing the tour, focus is on «Ver el
tutorial»: there is no `tabindex` attribute and `tabIndex` is 0. Shift+Tab then Tab lands on it again.

##### 3. Perfil: fixed
- «Ajustar mis objetivos»:
  - Opening: focus goes to the INPUT «Calorías (kcal)» at +30 ms.
  - Cancelar: focus goes back to «Ajustar mis objetivos».
  - Guardar: the save lands, and focus goes back to «Ajustar mis objetivos».
  - This uses the `ProfileConsentCard` pattern: an effect on `editing` that skips the first render.
- «Borrar mi cuenta»:
  - Opening: focus goes to the INPUT «Escribe BORRAR». The prompt paragraph is now its description
    (`describedBy`), so the consequences are read out when the field is focused.
  - Cancelar: focus goes back to the trigger.

##### 4. Console phone «Menú»: fixed
- The cause: Radix's FocusScope skips links when it moves focus in (`removeLinks`), so focus landed on
  «Cerrar».
- `ui` Sidebar now takes `onOpenAutoFocus` (documented in `sidebar.mdx`). AdminNav focuses
  `a[aria-current="page"]`, or the first link if none is current; `focus()` scrolls it into view.
- Measured at 390×844:
  - /admin: «Resumen» current=page, top 50 / bottom 94.
  - /admin/catalogo/ingredientes: «Ingredientes» current=page, top 400 / bottom 444.
  - Escape returns focus to «Menú».

##### 5. Tick and «Cambiar» pill targets: fixed
The `::after` inset now subtracts the edge: `--tick-edge` (1.5px) for the tick, and
`--border-width-interactive` for the pill. Coarse pointer at 390px; "hit" is walked out from the centre
with `elementFromPoint`.

| Control | Before (audit) | After |
| --- | --- | --- |
| /plan card tick | 41–42 | box 28, `::after` 45×45, hit 46×46 |
| /inicio row tick | 41–42 | box 24, `::after` 45×45, hit 46×46 |
| «Cambiar» pill | 41–42 | box 34 tall, `::after` 44 tall, hit 98×44 |

##### 6. Standalone links: fixed, with nothing overflowing
- «¿Has olvidado tu contraseña?» (es and en):
  - Before: 21 px tall.
  - After: the target is 45 px tall.
  - How: an asymmetric `::after` that takes the 4 px above the link and as much below as makes 44.
  - The link box and the layout do not move. The pixel above the target belongs to the password INPUT and
    the pixel below to the submit BUTTON, so there is no overlap.
- «Volver a acceder» on /recuperar (both states):
  - Before: 17 px.
  - After: the target is 44 px.
  - How: a `.footerLink` `::after` that grows evenly into the footer's padding and the card's padding.
    Nothing moves.
- Footer links:
  - Before: 17 px.
  - After: 44 px, each its own line of the list. On a coarse pointer the list's `gap` goes to 0.
  - The links sit 8 px apart, so a 44 px `::after` would overlap its neighbours. Growing the boxes is the
    only overlap-free fix.
  - This is the one visible layout change: on a touch screen the footer is taller, with links on a 44 px
    pitch. The screenshot is `scratchpad/a11y9/footer-320.png`.
- Perfil «Editar» ×7:
  - Before: 38 px wide.
  - After: 44×44.
  - How: `min-inline-size` plus `justify-content: flex-end`, so the word stays at the line's end.
- Left: RegisterScreen's sent-state «Volver a acceder» (`RegisterScreen.tsx` ~141). It was not in the
  audit, and that state cannot be reached without creating a non-probe account. It sits beside a button
  in the same footer, so a symmetric `::after` could overlap the button when they wrap.

##### 7. One h1: fixed
- `EmptyState` takes `level?: 1 | 2` (default 2). These pages pass `level={1}`: /check-in (both states),
  /compra, /progreso (both), /plan (scheduled and empty), /plan/historial, the locked plan
  (`historial/[id]`) and the locked dish.
- The console's picture review keeps h2 under its own h1. `plan/page.tsx` had no h1 above
  (`PlanPendingNotice heading={false}`).
- Measured h1 count is 1 on each of these:
  - /plan «Todavía no tienes plan»
  - /compra «Todavía no hay lista»
  - /progreso «Todavía no hay nada que medir»
  - /plan/historial «Tus planes»
  - /check-in «Todavía no toca»
  - The same pages in English
  - The 404 pages
- Not reached at runtime, but the same prop is in place: the locked plan and dish (they need an old
  premium plan), /check-in «already done», and /progreso «unavailable».

##### 8. 404 for an unmatched URL: fixed
- `app/global-not-found.tsx`, behind `experimental.globalNotFound: true`. I read Next 16.4.5's
  `node_modules/next/dist/docs/.../not-found.md` first; this is the convention for several root layouts.
- What the page draws: `RootShell` (lang, theme script, faces, skip link) and the Spanish text, then the
  same in English under a hairline, marked `lang="en"`. Each has a link to its home page (`/` and `/en`).
  It uses one new key, `errors.notFoundHome`, in both dictionaries.
- The page cannot know the address's language: it gets no props and is static. That is why it carries
  both languages.
- Measured:
  - /no-existe, /en/no-existe and, signed in, /plan/no-existe all return 404 with
    `<html lang="es-ES">`, title «Página no encontrada», `robots noindex` and h1 ×1.
  - Signed out, /plan/no-existe → 307 to sign-in (the proxy), as before.
- Build: `/_not-found` is ○. Every public page is still prerendered: the gate's static check passed,
  10 public pages.
- `notFound()` inside a tree still draws that tree's own page.

##### 9. `lang` on the language buttons: fixed
Each button carries `lang={locale}`: ES `es-ES`, EN `en-GB`, Español `es-ES`, English `en-GB`.

##### 10. Contrast: fixed

(a) DataTable's "more columns" cue: the scroll edge now carries a `--border-interactive` line
(`var(--border-width-interactive)` wide, `scroll` attachment), under the existing soft shadow. The `local`
covers hide it at the scroll's end. `--border-interactive` on every solid surface is already a gated pair
(`edge`, 3:1). Measured:

| Theme | Old shadow peak, card / page | New line, card / page |
| --- | --- | --- |
| claro | 1.55 / 1.56 | 3.75 / 4.15 |
| oscuro | 1.93 / 1.95 | 3.80 / 4.51 |
| huerta | 1.55 / 1.56 | 3.64 / 3.97 |
| pulso | 1.93 / 1.88 | 4.57 / 5.06 |
| contraste | 1.69 / 1.69 | 21.00 / 21.00 |

(b) Placeholders: `.field::placeholder` (assistant, on `--surface-card`) and `.message::placeholder`
(feedback, on `--background-01`) are now `--foreground-03`. Both are gated `text` pairs at 4.5:1. Measured:

| Theme | On card | On page |
| --- | --- | --- |
| claro | 5.38 | 5.96 |
| oscuro | 6.73 | 7.98 |
| huerta | 5.51 | 6.01 |
| pulso | 7.62 | 8.44 |
| contraste | 12.63 | 12.63 |

The feedback placeholder was drawn as rgb(111, 90, 77), which equals `--foreground-03` in claro. The
composer was not drawn: /asistente's switch is off locally. Its rule is the same.

#### P3

- Done: PlanProgress's strip has `aria-hidden` and `tabIndex={-1}`. A tap still opens /plan; the keyboard
  and screen reader get only «Ver los 14 días».
- Done: the tick has one stable name, «Marcar como hecha», with `aria-pressed`. `meal.unmarkDone` was
  deleted from both dictionaries.
- Done: the tick is described by its dish (`aria-describedby` → the name). Measured: «Ensalada de frutas
  tropicales con yogur natural y miel».
- Done: sort link names, on the phone (AdminReflowTable) and wide (DataTable). They are now
  «Correo, ordenar de forma ascendente», with no space before the comma, at both 1280 and 390 px.
  - The hint moved into `aria-label`, because the hidden span is a block to the name's computation.
  - `ui` Link now forwards `aria-label`, with a test and a row in `link.mdx`.
- Left: the console's phone card titles are still `<p>`. A heading would take the display face and
  `line-height` from `base.css`, so the look changes unless overridden. The right level also differs
  across the 14 callers (h3 or h4, depending on `showCaption` and the section). It needs a level prop and a
  per-page outline check.
- Left, as asked: headings inside meal cards, the theme menu's initial item, `/admin/x` theme and the card
  link's name.
- Seen, not fixed (not in the audit's list): FeedbackForm's «Enviar» uses `disabled`/`loading` while
  sending (focus is lost if the send fails), and the same goes for the many other `loading` buttons on
  submits that navigate away on success.

#### Baseline lines that change
(`docs/projects/024-a-livelier-look-in-five-themes/baseline/`, which the lead owns)

- The tick's name:
  - `inicio.plan.es-ES.phone.txt:7` and `inicio.plan.es-ES.desktop.txt:7`:
    `button "Quitar la marca de hecha" [pressed]` → `button "Marcar como hecha" [pressed]`
  - `inicio.plan.en-GB.phone.txt:8` and `inicio.plan.en-GB.desktop.txt:8`:
    `button "Unmark as eaten" [pressed]` → `button "Mark as eaten" [pressed]`
  - In these four files that line becomes a duplicate of the unpressed tick's line, apart from the
    `[pressed]` flag.
- Every sort link line loses the space before its comma: `link "X , …"` → `link "X, …"`. These are in the
  admin baselines, es and en, phone and desktop: `admin_catalogo*`, `admin_cuentas*`, `admin_buzon*`,
  `admin_profesionales*` and `admin_catalogo_ingredientes*`. Grep `' , '`.
- Heading levels are masked (`[level=#]`), so EmptyState's h1 changes no baseline line.
- The inventory (`inventory/app.md` rows 14 and 18) names `meal.unmarkDone`. That key is gone, the name is
  now stable, and the control is unchanged.

#### Standing rules
- Overflow probe, 5 widths (320/360/390/768/1280), on every touched route: overflow 0px, runs 0 and cut 0
  everywhere.
  - Public pages, es and en, light and dark: /, /acceder, /recuperar, /no-existe, /en, /en/acceder,
    /en/recuperar, /en/no-existe.
  - Signed in, es and en, light: /inicio, /plan, a dish, /perfil, /check-in, /plan/no-existe.
  - The empty account, es and en: /plan, /compra, /progreso, /plan/historial.
  - The console: /admin, /admin/cuentas (es and en), /admin/catalogo/ingredientes.
  - Dark at 320: /inicio, /plan, /perfil.
  - The probe's "FAIL" on the 404 routes is the expected 404 status.
  - The only hints were Perfil's 1 px native `select`s (Radix's hidden ones), which were already there.
- No two buttons were stacked by this change. The look is unchanged in screenshots except for the footer's
  link pitch on touch screens (finding 6) and the 1 px edge line on a scrollable table.
- Gate: `gate.sh --full`, with `NUTRIA_LOCAL_PG` unset. Every step passed: migrations, checks (lint,
  ts:check, test:coverage), web-build, static, contrast, format, deadcode, leaks. It ended green.

#### Not verified at runtime
- AccountActions, EventPlanner and PictureAcceptAction: these states were not reachable with probe
  accounts without hand-made data (premium switch, events, a rejected picture). They are covered by
  reading the code and by Button's unit test.
- The 200 % text size was not re-run.
- VoiceOver and NVDA were not run. That the screen reader announces the change is inferred from the
  `aria-pressed` change on the focused element.
- The assistant composer was not checked in a browser.

### The lead's last check before shipping phase 9

On a local production build of the whole branch (the executor's fixes, the picture window, the audits' fixes), with a probe account holding a generated plan and an admin with a second factor, both deleted after.

- **Each tree keeps its own 404 with `experimental.globalNotFound` on** (PRD 16). A plain account on `/admin` and `/admin/cuentas`: 404, the tree's page («No hemos encontrado lo que buscabas.», no console shell); the admin on `/admin/zzz-no-such-page`: 404, the console's own page, the heading its baseline file holds; a dish that does not exist: the app's own not-found. Only an address no route matches (`/no-existe`, `/en/no-existe`, `/plan/no-existe`) gets the new page — 404, seen at 320, 390 and 1280, Claro and Oscuro, and at 200 % text.
- **The picture on a wide screen is as tall as it is in production.** The lead's WebKit change (f8b11938) had left the window's cap to set the height from 768 px up — 348 px on Inicio and 391 on the dish's page at 1280, where production draws 382 and 450. A second spacer across both rows, at the frame's old shape (16:9 on Inicio, 4:3 on the dish's page), restores that floor without giving the frame a ratio again. `window.mjs`, 320/360/390/768/1280: picture 252/272/287/356/383 on Inicio and 251/273/267/474/450 on the dish's page; clear window 140/160/175/264/291 and 158/180/197/404/380; gap 0, shift 0. A phone is unchanged from what the owner approved.
- **The P1 on this build**, with the auditor's `focus.mjs`: after Enter on Inicio's tick and on the dish's «Hecha» and «Saltada», the active element is the same button at +30, 300, 800, 1500 and 2500 ms, `aria-pressed` flipped; again on the second press.
- **200 % text after the accessibility fixes** (`sweep.mjs --font 2`, 320 and 390): `/`, `/acceder`, `/recuperar`, both 404 addresses in Claro and Oscuro, Spanish and English; Perfil, Inicio, the plan, a dish, Compra, Progreso; the console's Resumen, Cuentas and Recetas — 0 overflow, 0 cut. What stacks is what step 2 lists as P2 (pairs whose words do not fit the line), the FAQ's accordion and the plan's day list.
- **Baseline**: the renamed lines were edited in the files, then `/inicio` and `/admin/cuentas` were regenerated and compared — the console's files are identical; Inicio's differ by data only (the hour's greeting, no meal marked, targets the audit's probe had adjusted).
- `/en` links to `/en`, `/en/acceder`, `/en/registro`, `/en/privacidad`, `/en/condiciones` and to no Spanish address.
- Not done: WebKit, a screen reader, Lighthouse. Two agent worktrees are left in place (one still locked by its agent).

## After phase 9 — Lighthouse on the landing, and the two pictures that waited (2026-11-13)

- **The owner's checks.** On his iPhone the dish's picture fills its card behind the strip («Se ve bien las imágenes») — the WebKit doubt of phase 9 is closed. He ran Lighthouse on production's landing from Chrome, in an incognito window (his first runs were distorted by extensions, as Lighthouse itself said): **desktop 99 / 100 / 100 / 100**; **mobile 74 / 100 / 100 / 100** — FCP 1.4 s, LCP 4.7 s, TBT 350 ms, CLS 0. Phase 0 recorded 99 on mobile, on a local build without pictures (LCP 1.5 s, TBT 82 ms). PRD 8 asks for no less: **it does not hold on mobile**.
- **Why, measured** (Chrome driven by the probe, Lighthouse's mobile conditions: 1.6 Mbit/s, 150 ms, CPU ×4; production, three runs each). The largest paint is the hero's first picture (183 KB) and it arrives at ~5.0 s. Without the two pictures under it: 3.5 s. Without those and the title face: 3.1 s. With no picture at all: 1.2 s, the text. The three pictures (600 KB) share a slow line with 330 KB of script, 105 KB of fonts and an 82 KB document; the two lower ones are `loading="lazy"` but near enough to the first screen that the browser asks for them at 1.4 s. `fetchpriority="low"` on them changed nothing (4.8 s); not asking for them until the window's `load` did (3.3 s).
- **Built**: `components/AfterLoad` holds its children hidden until the page has loaded, and `LandingPictures` puts the second and third tile inside it. A hidden lazy image is not requested; the tile keeps the picture's room and ground, so nothing moves. The three `<img>` and their «IA» marks are still in the prerendered HTML (the component's test counts them) — hidden until the load, which is where the legal opinion's M1 reads "outside the prerender": they are in it, and not shown without script. Local production build, same conditions, three runs: LCP **3.47–3.48 s** (production the same minute: 4.96–5.18 s); the two lower pictures are requested at 3.65 s. Overflow probe on `/` and `/en`, 320/390/1280, light and dark: 0. Seen at 1280: the three pictures in place after the load.
- **The owner's choice for the rest**, with four options: this, **and a lighter copy of the pictures for phones**. `legal` ruled the same day (`docs/legal/2026-11-13-lighter-landing-pictures.md`): acceptable with nine conditions — among them an IPTC `trainedAlgorithmicMedia` field in each copy, no leftover C2PA segment, and **the owner checking each copy for SynthID in the Gemini app before any ships (M4)**. Three candidates (720 px wide, 42–43 KB, the field written, no APP11) were made in the scratchpad and sent to him; nothing of them is in the repository. Not built until he answers.
- Not done: Lighthouse on this change (the owner's Chrome); the 350 ms of blocking time, which is script and untouched here.

## After phase 9 — a lighter copy of the landing's pictures for a phone (2026-11-13)

- **The owner's SynthID check (legal M4).** He uploaded the three candidate copies, under neutral names, to the Gemini app and asked whether Google's AI made them: **detected in all three** (asked with options, 2026-11-13). The copies committed are those bytes; `landing.test.ts` holds their SHA-256, so a re-encode cannot slip in without a new check.
- **Built**, to the nine conditions of `docs/legal/2026-11-13-lighter-landing-pictures.md`:
  - M5 — `apps/web/public/landing/<recipe id>.jpg`, three files of 42–43 KB: the original scaled to 720 px wide, JPEG quality 72 (mozjpeg, progressive), no other edit; `lib/landingPictures.ts` lists each beside its original with both hashes and the settings.
  - M2, M3 — each copy's XMP carries `Iptc4xmpExt:DigitalSourceType = …/trainedAlgorithmicMedia` and nothing else; no APP11 segment, no C2PA label. A unit test reads the committed bytes for both.
  - M1 — the same `DishPicture`: `ui` `Picture` takes `narrow` and draws `<picture><source media="(max-width: 40rem)">` around the same `<img>`, so the mark, its hidden label and the caption are the tile's whichever file loads.
  - M6 — every other screen and every other picture draws the original; the copies are referenced only from `landingPictures.ts`.
  - M7 — the list's comment says a withdrawal removes the entry and the file; the test fails if a file has no entry or an entry no file.
  - M8 — `noimageindex` untouched. A2 (advisable): `/landing/*` answers `AI-Generated: true` and `X-Robots-Tag: noindex`.
  - M9 — `0066` carries the dated exception; the comments in `landingPictures.ts`, `picture.ts`, `DishPicture.tsx` and `metadata.ts` say what the code now does.
- Not done: A1 (signing the copies with our own C2PA manifest — needs a certificate, not priced), A3 (our name and a pointer to the original in the XMP).
- **Measured** on a local production build, Lighthouse's mobile conditions (1.6 Mbit/s, 150 ms, CPU ×4), three runs: the largest paint is the hero's picture, now its lighter copy, at **1.61–1.62 s** (production today ~5.0 s; with only the two lower pictures held back, 3.5 s). Which file each width downloads: 320, 390 (×3) and 640 px the copy (720 px wide), 641, 768 and 1280 px the original (1,200 px wide); three «IA» marks shown and no overflow at each. `/landing/<id>.jpg` answers 200 `image/jpeg`, 43 KB, with `AI-Generated: true` and `X-Robots-Tag: noindex`. With a `<picture>` React no longer writes the image preload, so no screen downloads both files. Seen at 390 ×3: the copy reads as sharp as the page around it.
- Not done: Lighthouse itself (the owner's Chrome); exiftool on the live address (none on this machine — the unit test reads the committed bytes); the blocking time (300–350 ms), which is script.

## After phase 9 — why mobile Lighthouse stayed at 86, and the food under the first phone screen (2026-11-14)

- **The owner's run after the lighter copies** (production, incognito): mobile **86** — FCP 1.6 s, LCP 2.7 s, TBT 400 ms; «Ha subido un poco». Lighthouse 13 run from the scratchpad (not a dependency) agrees: production 87, a local production build 86 (LCP 3.8 s, TBT 150 ms).
- **Why, read in Lighthouse's own source** (`lantern/metrics/LargestContentfulPaint.js`). When the largest element is **text** painted with the first paint, the simulated LCP is the first paint's: scripts that do not block rendering are left out. When it is an **image**, every request that finished before it — every script chunk, both fonts — is charged to it at 1.6 Mbit/s. The redesign made the hero's picture the largest thing on a phone's first screen, so the same ~230 KB of script that phase 0 was never charged for now is. Nothing loads slower: under Lighthouse's own conditions applied for real the picture is painted at 1.6–1.9 s.
- **Proved on local production builds**, Lighthouse mobile: the commit before the redesign (`feef6db6`) **99** (LCP 1.5 s, TBT 120 ms) — phase 0's figure, reproduced; `main` **86**; `main` with the picture below the first screen **97–98**.
- **Ruled out, each measured**: link prefetching (the long tasks do not move with it blocked), the two held pictures, module evaluation outside React (~70 ms at CPU ×4). The two long tasks are React's own start-up and hydration.
- **The owner chose, with the two captures side by side** («Foto más abajo»): on a phone the three tiles stand between the copy and the food, one to a row, so the first screen is words and the picture arrives with the first scroll. From 40rem nothing changes: food under the copy on a tablet, beside it on a laptop, tiles under both.
- **Built**: the tiles' `<ul>` is the hero section's last child (it was its next sibling) and the hero grid names its areas — `copy / highlights / visual` under 40rem, `copy / visual / highlights` from 40rem, two columns from 64rem. The document's order is what it was at every width (copy, food, tiles), so the text baseline and what a screen reader hears do not change; nothing in the tiles or the pictures takes focus. The hero's bottom padding became the grid's gap, so the distances between blocks are the ones before.
- **Measured** on a local production build, Lighthouse mobile, five runs: **98, 98, 98, 98, 98** — FCP 1.5 s, LCP 1.5 s, TBT 140–160 ms, CLS 0; `/en` 98, 98. Phase 0's median was 99: within the plan's three points. The probe: `/` and `/en` at 320, 390 and 1280 px, light and dark, no overflow; the 320 px dark and 1280 px light captures read.
- **A thin margin, stated on purpose.** Lighthouse's phone is 412 × 823 px. There the picture starts at 818 px in Spanish (5 px of it in the first screen, 2,000 px² against the lede's 31,000) and at 797 px in English (26 px, 9,800 px² against 23,400): the largest element is the lede while less of the picture shows than the lede's own area, about 80 px in Spanish and 35 px in English. A shorter hero on a phone — a shorter lede, a tile fewer — brings the picture back as the largest element and the figure back to ~86; a longer one is safe. At 390 × 664, 360 × 640 and 320 × 568 the picture is wholly under the first screen; at 430 × 932 its top 150 px shows, which is fine for a person and is not what Lighthouse measures.
- **Design review** (`apple-web-design`, REVIEW, the phone hero at 320, 390 and 412 px, light and dark, both languages): PASS, nothing at P0 or P1. One primary action still leads the first screen; the tiles recompose (one to a row) rather than shrink; every value is a token; no surface, shadow or radius was added; nothing overflows. P2, accepted: on a tall phone the picture's top edge shows under the tiles.
- **Found on the way, not in this change**: every page carries the whole dictionary twice — 223 KB inside the HTML (the `LocaleProvider` prop; 59 KB compressed) and 204 KB more as a script chunk (the provider's Spanish default). Sending public pages only the sections their client components read took a local build from 86 to 88 and FCP from 1.5 to 1.2 s. The owner asked for it, with a check that no public screen can be left without a string; it is its own change.
- Not done: Lighthouse in the owner's Chrome on this change — production's blocking time is higher there (320–400 ms against 150 on a local build), so expect less than 98; an iPhone.

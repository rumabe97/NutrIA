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

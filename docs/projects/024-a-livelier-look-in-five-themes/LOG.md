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

# Plan — Project 024: A livelier look, in five themes

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: a
> planner agent via `/plan-project`; approved by the owner before execution starts.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: approved (owner, 2026-11-11, with the mails added)
- **Type**: standard
- **PRD**: ./PRD.md
- **Routing profile**: `tiered` (AGENTS.md § Model routing). No phase or agent runs on `fable`.

## Design summary

A reskin and recomposition of `packages/ui` and `apps/web`, plus the look of the mail templates
(phase 7b), and nothing else. No other file under `apps/api/src`, `packages/core/src` or
`packages/database` changes, so the API's end-to-end suites are the standing proof that no
behaviour was lost.

The work has one foundation and then goes screen family by screen family:

1. **Tokens first.** A theme is a block of semantic token values selected by `data-theme` on
   `<html>`, chosen on the device and applied by a static inline script before first paint
   ([`0106`](../../decisions/0106-a-theme-is-a-block-of-token-values-chosen-on-the-device.md)).
   Phase 1a puts the mechanism in with today's colours and no visible change; phase 1b ships
   all five themes, the switch and the new typefaces at once, so production changes colour and
   type everywhere in one step and is never half old and half new.
2. **Shared pieces second**: the components of `packages/ui`, the shell (header, floating bar,
   rail), the one note component that replaces the 37 coloured-edge rules, the rings.
3. **Then each family of screens** is recomposed against the approved sheets in `reference/`,
   reviewed, probed and shipped on its own.

What the code looks like today, and what that decides (read on 2026-11-11):

- Colour is `light-dark()` pairs plus two `prefers-color-scheme` blocks; there is no
  `data-theme` and no script that reads a scheme. `apps/web/src/styles/variables.css` is the
  brand layer and the only app file using `light-dark()`.
- Only 18 of 218 module stylesheets touch a palette step or a colour function, and none has a
  raw hex. The codebase already reads semantic tokens almost everywhere, so most of the colour
  change is in the token files. Nothing enforces it; phase 1 adds the test.
- There is no shared note component: 37 rules across about 30 stylesheets draw a 2–3 px start
  border by hand.
- `RootShell.tsx` is the one place that orders the stylesheets and renders `<html>`; it has no
  head content. The inline script goes there and nowhere else.
- The bottom bar's height (`56px`) is repeated by hand in `AppNav.module.css` and in
  `AssistantChat.module.css`. It becomes one token before the bar changes shape.
- The font is one self-hosted variable file, subset by a documented manual procedure, weights
  400–700, with no licence file beside it.
- `apps/web` has no component tests; `packages/ui` has 48 test files that assert class names.
  There is no Lighthouse, axe or stylelint in the repository. `apps/docs` imports the same token
  files and must keep working with no theme attribute.
- Dish pictures are plain `<img>` at their original bytes so the C2PA record survives (`0066`);
  lists show no picture today although `MealView.illustrationPath` is already in what they load.
- Inicio already loads each meal of the day with its status and macros. «Hecha» is `completed`.
  The sum of completed meals is computed in the page; no API field is needed. `TargetProgress`
  says today that it shows the plan and not intake, because marking a meal did not exist when
  it was written. It exists now. The rings still claim only what is known: *meals you marked as
  done*, in those words, never "eaten" or "intake", and the plan's own total stays beside them.

## Phases

### Phase 0 — What exists, written down

- [ ] pending
- **Dispatch**: sonnet @ medium — `/execute-project 024 phase 0`
- **Goal**: the inventory acceptance criterion 1 is checked against, and the figures later
  phases must not fall below.
- **Scope**: `docs/projects/024-a-livelier-look-in-five-themes/inventory.md`, `LOG.md`,
  `docs/legal/` (the `legal` agent only). No product code.
- **Steps**:
  1. `inventory.md`: for each of the 64 routes, read the page and the components it renders and
     list every control, link, form field, state and message a person can reach — signed out,
     free, premium, professional, admin, offline, empty, error — with the dictionary key of its
     words, so both languages are covered by construction. One table per route, grouped as the
     items below.
  2. **A mechanical baseline beside the hand-written one**, because a control the inventory
     missed could vanish unnoticed: a script under `.claude/skills/local-probe/scripts/` that,
     for each route, state and language it can reach with probe accounts, dumps the role and
     accessible name of every interactive element and every heading, sorted, to
     `baseline/<route>.<state>.<locale>.txt` in this folder. Every later phase runs it again and
     diffs: a line that disappears is explained in LOG.md or it is a bug.
  3. Record the figures: Lighthouse (mobile) on the landing page of a production build served
     locally, run from the scratchpad and not added as a dependency — the median of five runs of
     Performance, Accessibility, SEO, LCP and CLS — and the bytes of CSS and font a first visit
     downloads.
  4. The `legal` agent answers two questions. Does a theme kept in `localStorage` change
     `/privacidad`? And may the landing page show generated dish pictures to the public, and
     under what marks (the «IA» label, the C2PA record, AI Act art. 50)? Each answer names the
     sentence or the condition, or says none.
  5. Confirm both typefaces' licences (SIL OFL) from their upstream repositories, and note where
     the licence text will live.
- **Items**:
  - [ ] signed-in app (20 routes)
  - [ ] console (22 routes)
  - [ ] public and legal (6 routes)
  - [ ] sign-in family (16 routes)
  - [ ] shared shell: headers, navigation, offline banner, tour, toasts, error and 404 screens
- **Acceptance criteria**: PRD 1 (first half); the baseline for PRD 7; PRD open questions closed.
- **Verification**: every `page.tsx` under `apps/web/src/app` appears once in `inventory.md`
  (a `find` against the headings); the baseline script run twice gives identical files;
  `sh scripts/check-leaks.sh` clean.

### Phase 1a — The theme mechanism, with today's colours

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 024 phase 1a` — deviation justified: every later
  phase and every theme stands on this mechanism.
- **Goal**: `data-theme`, the contrast gate and the colour test exist and pass, and **nothing a
  person sees has changed**.
- **Scope**: `packages/ui/src/styles/**`, the 18 stylesheets that read a palette step,
  `apps/web/src/styles/**`, `apps/web/src/app/_shared/RootShell.tsx`, `scripts/check-contrast.mjs`,
  `.claude/skills/ship/scripts/gate.sh`, `.github/workflows/ci.yml`.
- **Steps**:
  1. Per `0106`: `packages/ui` declares the semantic colour tokens and a neutral default pair;
     `apps/web/src/styles/themes.css` defines them per theme. In this phase it holds two blocks,
     `claro` and `oscuro`, with **exactly today's values**, and Automático selects between them.
  2. Replace the 18 palette-step and `--color-white/black` uses with semantic tokens of the same
     value.
  3. `scripts/check-contrast.mjs`: reads the themes file and a declared list of
     foreground/background pairs (text on each surface, on-accent text, control edge on each
     surface, focus ring) and fails under 4.5:1, or 3:1 for display text, edges and rings, in any
     theme. In `gate.sh --full` and in CI.
  4. A test that fails on a raw colour, a palette step or a theme name in any module stylesheet
     of `apps/web` or `packages/ui`.
  5. The inline script in `RootShell.tsx`, as one static string, with a unit test of its logic
     and of an unknown stored value falling back to Automático. No control sets a value yet.
- **Acceptance criteria**: PRD 4, 5 (for the two existing schemes); PRD 2.
- **Verification**: gate `--full`; the phase-0 baseline diff is empty; `/local-probe` screenshots
  of `/`, `/inicio`, `/plan`, `/admin` at 390 in both schemes compared by eye with the ones taken
  before the change: no difference; `pnpm --filter docs build`.

### Phase 1b — New colours, new type, five themes and the switch

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 024 phase 1b` — human-verify: the owner
  switches themes on his iPhone on a public page, a signed-in screen and the console; no flash,
  and each theme is legible.
- **Goal**: production wears the new colours and typefaces in five switchable themes. Layouts are
  recomposed in later phases; here a screen may only change as far as the new type moves it.
- **Scope**: `apps/web/src/styles/**`, `packages/ui/src/styles/**` (new tokens: weight 800, the
  larger radii, the gradient and ring tokens), `packages/ui/src/fonts/**`,
  `packages/ui/scripts/`, a new `packages/ui/src/components/ThemeSwitch/`,
  `apps/web/src/app/_shared/{metadata,manifest,ogImage}.tsx`, `apps/web/src/lib/brandIcon.tsx`,
  the four headers (`SiteHeader`, `AuthShell`, `AppNav`, `AdminNav`), `(app)/perfil` for
  «Apariencia», both dictionaries, `AGENTS.md` § CSS conventions and § Branding,
  `packages/ui/AGENTS.md` § Fonts, `apps/web/AGENTS.md` § Styles, a new decision record.
- **Steps**:
  1. The five blocks in `themes.css`, starting from the values measured in the PRD
     (§ "What changes from the sheets") and adjusted until the contrast script passes in each.
     Alto contraste under `prefers-contrast: more`; a `forced-colors` block.
  2. Fonts. Subset and self-host both families the way § Fonts documents (fallback metrics
     recomputed, `tnum` kept, no `unicode-range`), turn the manual procedure into a script, add
     the OFL texts beside the files, and widen the weight scale to 800 in `font.ts`, the tokens
     and the document together. Headings take the display family.
  3. `ThemeSwitch` in `packages/ui`: a labelled button opening a menu of six radio items, built
     on the existing `Dropdown`, keyboard and screen-reader complete, named in both languages.
     It sets the attribute, `color-scheme`, the stored value and the `theme-color` meta. Rendered
     beside the language switch in all four headers — the console has no language switch today
     and gains only the theme one.
  4. «Apariencia» in Perfil: the same six as a radio group of small previews.
  5. Icons, manifest and OG image take their colours from one module, in the new palette. The
     leaf keeps its shape.
  6. Apply the `legal` agent's answer from phase 0, if it named a sentence.
  7. Rewrite the documents in scope for the new token system, and write the decision record that
     supersedes the numbers of `0041` and `0057` this phase changes.
- **Acceptance criteria**: PRD 3, 4, 5; PRD 7 for fonts; PRD 2.
- **Verification**:
  - gate `--full`; `pnpm --filter ui test && pnpm --filter web test`; `pnpm --filter docs build`
  - the baseline diff: only the theme switch's lines are new, none is gone
  - **the sideways-overflow probe on every route a probe account can reach, at 320 px**, since a
    wider typeface can break any of them, and `/local-probe` with screenshots at 320, 390 and
    1280 on `/`, `/acceder`, `/inicio`, `/plan`, `/asistente`, `/perfil`, `/admin` in each of the
    five themes, with the `apple-web-design` REVIEW
  - the first-visit bytes of CSS and font, against phase 0

### Phase 2 — The shared pieces

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 024 phase 2`
- **Goal**: every component of `packages/ui` in the new shape, and the three pieces the screens
  will be built from: the note, the rings and the motion utilities.
- **Scope**: `packages/ui/src/components/**`, `packages/ui/src/styles/motion.css`, the web
  stylesheets that hold the 37 coloured-edge rules and the components that render them, `apps/docs`
  pages that document a changed component.
- **Steps**:
  1. Restyle the 48 components to the approved shape (filled and quiet buttons, segmented
     control, switch, checkbox, input, card, tabs, dialog, drawer, table, stat tile, charts),
     keeping every prop, every class name the tests assert, and every keyboard behaviour.
  2. `Note` in `packages/ui`: a flat, square-cornered block with a tone (information, warning,
     error) carried by an icon and a word, never by colour alone. Replace all 37 coloured-edge
     rules with it, each keeping its words and its role (`role="alert"` where it had one).
  3. `Rings` in `packages/ui`: one to four concentric rings from values and maxima, with a text
     alternative that states every figure, drawn in SVG, filling on arrival.
  4. Motion utilities: count-up for a figure, ring fill, the bar marker's slide, the staggered
     list that exists. All under the single reduced-motion rule in `base.css`.
- **Items**: one checkbox per `packages/ui` component, then one per stylesheet holding a
  coloured-edge rule (the list is in LOG.md's phase 0 entry).
- **Acceptance criteria**: PRD 9; PRD 6 and 8 for the components.
- **Verification**: gate `--full`; `pnpm --filter ui test`;
  `grep -rnE "border-(inline-start|left)(-width)?: *[2-9]px" apps/web/src packages/ui/src`
  returns nothing but dividers named in LOG.md; `/local-probe` on the docs app's component pages
  and on every screen that carried a note; `apple-web-design` REVIEW.

### Phase 3 — The shell: header, floating bar and rail

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 024 phase 3` — human-verify: on the owner's
  iPhone, the bar clears the home indicator, hides for the keyboard, and never covers the
  assistant's box, a dish page's actions or the last row of a list.
- **Goal**: the navigation of the approved sheets, on every signed-in screen.
- **Scope**: `apps/web/src/components/AppNav/**`, `AssistantChat.module.css` (the offset only),
  `apps/web/src/styles/**` (the hatched header pattern replaces the glows and grain),
  `(app)/layout.*`.
- **Steps**:
  1. One token for the bar's height and its clearance; `AppNav` and `AssistantChat` both read it.
  2. The floating bar below 48rem: six or seven destinations, the current one named and marked
     with `aria-current`, every target 44 px. Below 360 px the current one drops its label.
     Safe-area inset, the keyboard rule and the offline filter kept exactly.
  3. The rail from 48rem, replacing the desktop header's links.
  4. The header: brand, language, theme, sign-out. At 320 px sign-out is an icon with its name.
  5. The hatched pattern as a CSS background behind the header, drifting slowly and following
     the scroll; still, and absent in Alto contraste and `forced-colors`.
- **Acceptance criteria**: PRD 12; PRD 6 at 320 px; PRD 14 (the 404s and the offline behaviour).
- **Verification**: gate `--full`; `/local-probe` at 320, 360, 390, 768 and 1280 on `/inicio`,
  `/plan`, `/asistente` (box focused and not), `/compra`, in Claro, Oscuro and Alto contraste;
  the offline probe steps in `apps/web/AGENTS.md` § Offline; `apple-web-design` REVIEW.

### Phase 4 — Inicio and the dish, where the food is

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 024 phase 4`
- **Goal**: Inicio, the plan's day and the dish page as approved, with pictures and rings.
- **Scope**: `(app)/inicio`, `(app)/plan` and `plan/comida/[id]`, and their components
  (`NextMeal`, `MealRow`, `PlanBrowser`, `MealPicture`, `DishPicture`, `MacroSummary`,
  `TargetProgress`, `PlanProgress`, `WeightTracker`, `ShoppingSnapshot`), dictionaries.
- **Steps**:
  1. Inicio: the greeting, the rings of the day (the sum of meals whose status is `completed`
     against the effective targets, with the plan's own total still stated in words), the next
     meal as a picture with its strip, the day's meals, weight, shopping, and every notice the
     inventory lists for this route.
  2. A dish row shows its picture when it has one. A dish without one gets the designed state:
     the slot's colour and a glyph, never an empty frame.
  3. The dish page: picture, facts, its share of the day as rings, ingredients, accompaniments,
     steps, and the three actions fixed above the bar.
  4. The picture stays a plain `<img>` at its original bytes, with its «IA» mark and name; the
     strip is a near-opaque surface unless the review accepts a material there.
  5. A dish card opens into its page with a View Transition where the browser has it.
- **Acceptance criteria**: PRD 1 for these routes; PRD 6, 8, 10; PRD 14.
- **Verification**: gate `--full`; the inventory's tables for these routes ticked line by line in
  LOG.md; `/local-probe` with an account that has a plan, in five themes at 390 and Claro/Oscuro
  at 320 and 1280; `apple-web-design` REVIEW.

### Phase 5 — The rest of the signed-in app

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 024 phase 5`
- **Goal**: Compra, Progreso, Check-in, Asistente, Perfil and the plan being made, as approved.
- **Scope**: `(app)/{compra,progreso,check-in,asistente,perfil}`, `plan/generando`, their
  components, dictionaries.
- **Steps**: recompose each against `reference/02-mobile-complete.jpg`, keeping every line of its
  inventory table. The assistant's warning is a `Note` with its text untouched; its answers keep
  `data-ai-generated`; «Descargar mis conversaciones» stays where it is reached today.
- **Items**:
  - [ ] Compra and its next-plan list
  - [ ] Progreso
  - [ ] Check-in
  - [ ] Asistente (new conversation and a thread)
  - [ ] Perfil, with every section and the account's security cards
  - [ ] Plan being made, and its failure states
- **Acceptance criteria**: PRD 1, 6, 8, 10, 14 for these routes.
- **Verification**: as phase 4.

### Phase 6 — Onboarding and the screens that had no sheet

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 024 phase 6` — owner-approves: a sheet for
  onboarding and one for plan history, next plan, consent and invitation, before either is built.
- **Goal**: the ten onboarding steps and the remaining signed-in screens in the new design.
- **Scope**: `(app)/onboarding/**`, `plan/{historial,proximo}`, `consentimiento`, `invitacion`,
  `consulta/**`, their components, dictionaries; `reference/` for the new sheets.
- **Steps**:
  1. Draw the sheets from the real screens' content (the inventory), in the approved style, and
     stop for the owner.
  2. Build what he approved. Onboarding keeps every step, every field's validation and its
     resume-where-you-left behaviour.
- **Acceptance criteria**: PRD 11; PRD 1, 6, 8, 10 for these routes.
- **Verification**: as phase 4, plus the onboarding walked end to end with a new probe account.

### Phase 7 — The public pages

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 024 phase 7`
- **Goal**: landing, the sign-in family and the two legal pages in the new design, with SEO at
  least where it was.
- **Scope**: `(es)/**`, `en/**`, `_shared/{Landing,LegalScreen,AuthShell}*`, `SiteHeader`, the
  sign-in components, dictionaries. Not a word of the legal texts.
- **Steps**:
  1. Landing: the approved hero with real dish pictures, **only as the `legal` agent's phase-0
     answer allows**: the original bytes, never re-encoded (so the C2PA record survives, `0066`),
     each with its «IA» mark and accessible name, with width, height and priority declared so
     nothing shifts. If the answer is no, the hero is drawn without photographs and the owner is
     shown it first. Then every section and FAQ the page has today.
  2. Sign-in family: every provider, the passkey path, every error and the legal notice.
  3. The legal pages: the same text, set for reading.
  4. The `seo` agent reviews metadata, canonicals, `hreflang`, sitemap and structured data.
- **Acceptance criteria**: PRD 7; PRD 1, 6, 8, 10 for these routes.
- **Verification**: gate `--full` (static pages); Lighthouse mobile on the landing page, median of
  five runs against phase 0's median: SEO 100, Accessibility 100, Performance within three points,
  LCP and CLS not worse; `web` `legal.test.ts`; `/local-probe`
  in both languages; `seo` and `accessibility` agents: nothing above P2.

### Phase 7b — The mails

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 024 phase 7b` — human-verify: the owner reads
  each mail on his iPhone and in Gmail on the web, light and dark.
- **Goal**: the fourteen mails in the new look, saying exactly what they say today.
- **Scope**: `apps/api/src/modules/email/templates/**` and their specs. Nothing else under
  `apps/api`: not `Email.service.ts`, not who is mailed or when.
- **Steps**:
  1. `Layout.ts` carries the look once: cream ground, the heading weight, the filled button with
     a solid deep-tomato fallback under its gradient, the flat note, the leaf. Colours are the
     Claro values as literals — a mail cannot read the web's tokens — written beside a comment
     naming the token each one copies, and a spec that fails when a literal and its token differ.
  2. Dark: a `prefers-color-scheme: dark` block with the Oscuro values, and the meta that tells
     a mail program the mail supports both. Programs that ignore it show Claro.
  3. Type: the system stack with the display weight; no web font is requested from a mail.
  4. No picture is added. No remote resource is requested that is not requested today.
  5. Each template's text is unchanged: a spec renders every template in both languages before
     and after and compares the subject, the plain-text part and the HTML part's text content.
  6. Send each mail to a probe inbox through the local mail catcher, and to the owner's address
     only from his own actions in production after the phase ships.
- **Items**: one checkbox per template (fourteen and the layout).
- **Acceptance criteria**: PRD 13; PRD 2 (the text unchanged).
- **Verification**: `pnpm --filter api test`; the API e2e suites untouched and green in CI; the
  text-equality spec; screenshots of every mail rendered at 360 and 600 px, light and dark.

### Phase 8 — The console

- [ ] pending
- **Dispatch**: sonnet @ medium — `/execute-project 024 phase 8` — owner-approves: one sheet for
  the console's remaining page types (a table page, a detail page, the picture review), before
  they are built.
- **Goal**: the console's 22 routes in the new design, its menu and its 404 unchanged in
  behaviour.
- **Scope**: `(admin)/**`, `AdminNav/**`, the admin components.
- **Steps**: the three approved pages first (Resumen, Interruptores, IA y modelos), then the
  sheet, then the rest as one batch. No figure, filter or action is added or removed.
- **Items**: one checkbox per console route.
- **Acceptance criteria**: PRD 1, 6, 8, 10 for these routes; PRD 14 (the 404 for a non-admin).
- **Verification**: gate `--full`; `admin.e2e-spec.ts` untouched and green in CI; `/local-probe`
  with a two-factor admin account at 390 and 1280, Claro and Oscuro.

### Phase 9 — The whole thing, checked

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 024 phase 9` — human-verify: the owner uses the
  app for a day on his iPhone in the theme of his choice.
- **Goal**: every acceptance criterion shown to hold across the finished product.
- **Scope**: fixes only, wherever the checks find them; `LOG.md`; the documents.
- **Steps**:
  1. `inventory.md` walked line by line against production; each line ticked or fixed.
  2. The `accessibility` agent audits every family in every theme; the `seo` agent the public
     tree; `apple-web-design` AUDIT on the whole.
  3. Reduced motion, `forced-colors`, `prefers-contrast`, 200 % text and 320 px, on every family.
  4. `git diff --stat <phase 0 base>..HEAD -- apps/api/src packages/core/src packages/database`
     lists only `apps/api/src/modules/email/templates`.
  5. The baseline script against production: every line of phase 0's files is present or its
     absence is explained in LOG.md.
- **Acceptance criteria**: PRD 1–14.
- **Verification**: the above, each with its output in LOG.md.

## Hand-off

Standing rules for every phase of this project:

- **Scope is `apps/web` and `packages/ui`, and the mail templates in phase 7b.** Any other
  change that seems to need the API is a plan amendment and the owner's decision, not an edit.
- **The inventory is the contract for behaviour, and the baseline is its check.** Before a
  screen ships, its table in `inventory.md` is ticked line by line in LOG.md and the baseline
  script's diff for its routes is read: a control may move or be renamed on purpose; none may go.
- **Never a raw colour, a palette step or a theme name in a component.** New need, new semantic
  token, defined in all five themes, and the contrast script's pair list updated.
- **Every phase**: `gate.sh --full`, `/local-probe` (320 px and a dark theme first, then look at
  the screenshots), the `apple-web-design` REVIEW with P0 and P1 fixed, and the verdict in the
  pull request. The owner's three exceptions (PRD criterion 8: the drifting pattern, the wide
  gradient, the large radii) are named there when a phase builds one; nothing else is excused.
- **One heavy job at a time** on the owner's machine. Tests run on the local Postgres only.
- **Shipping**: the owner authorised the agent to ship each phase (2026-11-11). `owner-approves`,
  `human-verify` and anything red still stop it. Each phase is its own branch and pull request.
- **The sheets are a direction.** Their words and numbers are examples; the product's own words
  and the PRD's § "What changes from the sheets" win.

## Out of scope

- The logo's shape, any API or data change beyond the mails' look, and any new feature: PRD § Scope.
- A theme kept on the account and synced across devices: a later project, if the owner asks.
- Automated visual regression or an accessibility tool in CI: worth a project of its own; this
  one adds only the contrast gate and the colour test.

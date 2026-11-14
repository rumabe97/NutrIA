# PRD — Project 024: A livelier look, in five themes

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's brief and choices of 2026-11-11.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: approved (owner, 2026-11-11)
- **Roadmap item**: [`docs/ROADMAP.md` § In progress](../../ROADMAP.md#in-progress)

## Problem

The owner, on 2026-11-11, about the whole product: *«Lo quiero más vivo, totalmente diferente,
más interactivo, más fluido, sin perder nada de funcionalidad… se nota que está hecho con IA…
más animaciones, más imágenes, no tan negra, más color.»*

What he sees today, and it is accurate:

- One near-black dark scheme and a pale light one, with a single muted green.
- Screens made of the same white card repeated. The food, which is the product, is a small
  picture or none.
- Informational notes drawn as a rounded box with a coloured left edge, in more than twenty
  components. He named this as the mark of a generated interface.
- Almost nothing moves.

## Outcome

Every screen of NutrIA wears the design the owner approved on 2026-11-11 (direction **D**), in
five themes he can switch from any screen, and nothing a person could do before is missing.

The approved sheets are the reference, committed beside this file:

- [`reference/01-inicio-plan-asistente.jpg`](./reference/01-inicio-plan-asistente.jpg)
- [`reference/02-mobile-complete.jpg`](./reference/02-mobile-complete.jpg)
- [`reference/03-admin-and-landing.jpg`](./reference/03-admin-and-landing.jpg)

They are a direction, not a specification: their words and figures are examples, and § "What
changes from the sheets" lists where the built product must differ from them to pass its gates.

## The design, as approved

- **Colour.** Warm paper, not white: cream ground, a tomato-to-saffron gradient as the one
  accent, olive and plum as supporting colours. The dark theme is aubergine, never black.
- **Type.** A heavy grotesque for headings (Bricolage Grotesque in the sheets) over a quiet
  sans for text (Figtree). Both self-hosted and subset the way `packages/ui/AGENTS.md` § Fonts
  does for the current font. No request to a font host.
- **Food first.** A dish is shown by its picture wherever one exists, large, with its name on a
  strip over it. A dish with no picture has a designed state of its own, since most dishes have
  none today.
- **Rings.** Progress is drawn as rings: the day's four targets on Inicio, a dish's share of the
  day on its page, meals done on Progreso, and the plan being made.
- **Navigation.** On a phone, a floating bar with the six destinations, the current one named.
  On a wide screen, a rail at the side. The console keeps its grouped menu.
- **Motion, and plenty of it** (owner, 2026-11-11: *«los anillos, gráficos, etc., tienen que
  tener animaciones de entrada, súper fluidas… mete todas las animaciones posibles para que la
  web quede atractiva y no sea monótona y aburrida»*). Nothing on a screen simply appears:
  - **Every figure that measures something draws itself in**: rings sweep to their value, bars
    and columns grow, a line chart draws along its path, a gauge swings, and the number beside
    each counts up to its value.
  - **Every screen arrives**: its title, then its blocks, staggered; a list's rows one after
    another; a picture fades up from its placeholder.
  - **Every change of place is a movement**: the bar's marker slides to the new destination, a
    dish card grows into its page and back, a day slides to the next in the direction of travel,
    a step of onboarding or of the check-in moves forward and back, a sheet rises, a menu unfolds
    from its button.
  - **Every action answers**: a button presses in, a switch and a checkbox spring, a meal marked
    done ticks and its ring moves at once, a row checked off the shopping list strikes through
    and settles, an added item drops in, a removed one closes up, a saved field confirms.
  - **The page is alive while still**: the header's pattern drifts and follows the scroll, and
    the plan being made shows its progress moving.
  - **What keeps it fluid**: only `transform` and `opacity` are animated, and SVG stroke for
    drawn figures, so nothing re-lays the page; springs and eases come from tokens, never from a
    number typed in a component; an entrance lasts between 200 and 600 ms and a list's stagger
    stops after eight rows, so nobody waits for a screen; nothing shifts the layout; nothing
    blocks a tap — an element in mid-entrance already works.
  - CSS, the Web Animations API and View Transitions only: no animation library, no WebGL.
  - **All of it stops under `prefers-reduced-motion`**: figures show their final value at once,
    screens change by a short fade or not at all.
- **Notes.** No box with a coloured left edge anywhere. A note is a flat, square-cornered block
  or a line between hairlines. The assistant's warning keeps every word of its approved text.

## Themes

Five, plus following the device:

| Theme | What it is |
| --- | --- |
| Claro | The cream theme of the sheets. The default in a light device. |
| Oscuro | Aubergine. The default in a dark device. |
| Huerta | Light and fresh: mint paper, leaf green and lime, tomato as the accent. |
| Pulso | Dark and vivid: deep indigo with a coral-to-violet gradient. |
| Alto contraste | Black on pure white, no gradients or pattern, firm edges. Also what `prefers-contrast: more` selects when the person has chosen nothing. |
| Automático | Claro or Oscuro, by the device. The default for everybody. |

- **Where the switch is** (owner): a button in the header beside the language switch, on every
  screen — the app, the public pages, sign-in and the console — opening a menu of the six. And a
  section «Apariencia» in Perfil showing each theme as a small preview.
- **Where the choice is kept** (owner): on the device. No account field, no API or database
  change. It applies before first paint, so no page flashes in the wrong theme, and the public
  pages stay static.
- A sixth theme later is a new block of token values and nothing else. No component stylesheet
  names a theme.

## What changes from the sheets, so that it passes

Measured on 2026-11-11, before any code:

1. **White text on the gradient fails contrast** (3.9:1 at the tomato end, 2.1:1 at the saffron
   end; AA needs 4.5:1). Filled buttons and the bar's current destination use a deeper gradient
   that holds 4.5:1 with white throughout, or dark text. The bright gradient stays where there is
   no small text on it: rings, bars, the pattern.
2. **Coloured small text fails** (saffron on cream 1.95:1; tomato 3.55:1). Labels, links and the
   small capitals above a title are one solid deep tomato that holds 4.5:1 on both paper and
   card. A gradient-filled word is only ever a display-size heading, and its lightest end holds
   3:1.
3. **Olive figures on a card fail** (3.7:1). Text in olive uses a darker olive; the ring keeps
   the brighter one.
4. **A control's edge must be seen** (the sheets' hairline is 1.3:1). Inputs, checkboxes and
   secondary buttons keep an edge of at least 3:1, the rule `0041` already holds.
5. **At 320 px** the header (logo, language, theme, sign-out) and the bar (six targets) are
   tight. The bar's current destination drops its label below 360 px so every target stays
   44 px; sign-out becomes an icon with its name; the rings' legend goes under the rings.
6. **The strip over a photo** is glass in the sheets. `apple-web-design` allows a material on
   navigation and floating controls, not on content. The floating bar keeps it; the strip
   becomes a near-opaque surface unless the review accepts it as an overlay control.
7. **A generated picture keeps its «IA» mark** and its accessible name («Imagen generada por
   IA»), which the sheets left out, and is served as the original file so its C2PA record
   survives.
8. **The rings on Inicio show what was eaten** (owner): the day's meals marked «Hecha», summed,
   against the day's targets. The sheets' numbers are examples.
9. **On a phone the landing's food comes after its three tiles** (owner, 2026-11-14, with both
   captures in front of him). The sheet draws the pictures right under the hero's copy; under
   40rem the tiles stand between them, one to a row, so the first screen is words. With a picture
   as the first screen's largest element Lighthouse charges every script to the largest paint
   (86 on mobile; 98 with the tiles first — LOG.md, 2026-11-14). Tablet and laptop follow the
   sheet.

## Scope

**In**

- `packages/ui` and `apps/web`: tokens, fonts, every component and every screen — the signed-in
  app, onboarding, the public pages (landing, sign-in family, `/privacidad`, `/condiciones`), the
  professional's screens and the console.
- The theme system and its two controls.
- The app icon's colours, the browser `theme-color` per theme, and the web manifest, if the new
  ground colour requires it.
- **The mails** (owner, 2026-11-11: *«los correos también tienen que tener el mismo estilo que la
  nueva web»*). The fifteen files under `apps/api/src/modules/email/templates` take the new
  look: the same colours, the heavy headings, the filled button, the flat note. Their subjects,
  their words, who receives them and when do not change. A mail is drawn in Claro, and in Oscuro
  where the mail program honours a dark preference: the theme a person chose lives on their
  device and the server never learns it.
- The documents the new values supersede, rewritten in the same phases: the CSS conventions in
  `AGENTS.md`, `apps/web/AGENTS.md` § Styles, `packages/ui/AGENTS.md` § Fonts, and decisions
  `0041` and `0057` where a number of theirs changes.

**Out**

- Any change to `apps/api`, `packages/core` or `packages/database` **other than the look of the
  mail templates**. No route, field or migration. The API's end-to-end suites pass untouched,
  which is the cheapest proof that nothing was lost.
- New features. The one new behaviour is the theme switch; the rings on Inicio read data the
  screen already loads.
  **One addition, decided by the owner on 2026-11-12** (*«me parece bien el cambiar en las filas
  del plan»*): the approved sheet draws «Cambiar» on each row of the plan's day, and the swap
  existed only on the dish page. Each row of the plan being lived now carries that same swap —
  one rule (`lib/mealSwap`), the same request, allowance, count and messages. No route changes.
  **One change of behaviour, also his (2026-11-12, «Ocultarla en onboarding»)**: while the
  questionnaire is being answered the shell shows no destinations — neither the floating bar nor
  the rail — and they return when it is done. A single step opened from the profile to change an
  answer keeps them.
- The words of the legal pages and of the assistant's warning. Their look changes, not a
  sentence.
- The logo's shape. The leaf stays and takes each theme's colours; the sheets' square mark was a
  placeholder.
- Illustration or photography the product cannot make itself. Pictures are the dish pictures
  that already exist, under their existing monthly ceiling.

## Acceptance criteria

1. **Nothing is lost.** Before the first screen is changed, an inventory is written from the
   code: per route, every control, link, form field and state a person can reach, in both
   languages. At the end, every line of it is found in the new screen. A control may move; none
   may go.
2. **No server change but the mails' look.** Outside `apps/api/src/modules/email/templates`, the
   diff touches no file under `apps/api/src`, `packages/core/src` or `packages/database`, and
   every API end-to-end suite passes as it stands. Inside it, every template's text content —
   subject, plain-text part and the words of the HTML part — is byte-for-byte what it was.
3. **Five themes and Automático** are selectable from the header on every screen, signed in or
   not, and from Perfil. The choice survives a reload and a new visit on that device, and no page
   shows another theme first.
4. **No component names a theme.** Every colour in `packages/ui` and `apps/web` comes from a
   semantic token; a test fails on a raw colour in a module stylesheet and on a theme name
   outside the token files.
5. **Contrast, measured by a script that runs in the gate**: in every theme, text and its ground
   hold 4.5:1 (3:1 at display size), a control's edge and a focus ring hold 3:1, for every token
   pair the components actually use.
6. **Nothing overflows, and nothing is cut** — the owner's first condition (2026-11-11, on a
   320 px test render whose ring legend ran out of its card: *«lo más importante es que nada se
   desborde, todo se vea bien»*). On every route, in every theme and both languages, at 320, 360,
   390, 768 and 1280 px and at 200 % text: no sideways scroll, no element wider than its
   container, no text clipped or hidden behind another element or the floating bar. Content that
   does not fit wraps or stacks; it is never shrunk below its size or cut with an ellipsis unless
   it was already so today. The probe's overflow check (scrolled **or clipped**) runs on every
   reachable route in every phase and a hit fails the phase.
7. **Accessibility.** In every theme: keyboard reaches and operates everything, focus is always
   visible, every target is at least 44 px on touch, the page reflows at 320 px and at 200 %
   text with no sideways scroll, `forced-colors` and `prefers-contrast: more` are honoured, and
   every animation stops under `prefers-reduced-motion`. The `accessibility` agent reports no
   finding above P2 on any screen.
8. **SEO.** The public pages stay statically rendered, with the same titles, descriptions,
   canonicals, `hreflang`, sitemap and structured data as today, or better. Lighthouse on the
   landing page, mobile: SEO 100, Accessibility 100, and Performance no lower than the figure
   recorded before phase 1. Fonts are self-hosted, subset and preloaded; the hero picture has
   dimensions and priority, so nothing shifts. The `seo` agent reports no finding above P2.
9. **`apple-web-design`.** Its REVIEW is run on every screen family as it is built; P0 and P1
   are fixed before that phase ships. **Four exceptions, and only these, are the owner's**
   (2026-11-11; the first three chosen with the stricter options in front of him, the fourth in
   his own words): the header's pattern drifts by itself, motion is used generously and for
   delight as § "The design" lists it, the gradient is used as widely as the sheets show (buttons, edges, labels at display
   size, a word of a title), and corners are as round as the sheets (up to 30 px). Each is
   recorded by name in the phase that builds it. Everything else the skill asks for holds:
   contrast, targets, reduced motion (under which the pattern is still), semantic controls, one
   primary action, and no material on content.
10. **No coloured-left-edge note remains**: a search of the stylesheets for a thick inline-start
   border on a note finds none.
11. **Every screen is looked at** with `/local-probe` at 320, 390 and 1280 px, in Claro and
    Oscuro at least, and each remaining theme on the screens that carry the most colour, before
    it ships.
12. **The owner sees it first where it was not drawn.** Onboarding, the plan history and next
    plan, the professional's screens and the console's remaining pages have no approved sheet:
    each family gets one, and his approval, before it is built.
13. **On the owner's iPhone**: the floating bar sits clear of the home indicator, steps aside for
    the keyboard, and never covers the assistant's box or a dish page's actions; the theme button
    is reachable with a thumb; switching theme is instant.
14. **The mails match.** Each of the fourteen mails, in both languages, is read by the owner in
    the mail program on his iPhone and in Gmail on the web, in a light and a dark setting: legible,
    the button works, nothing is cut. A mail program that ignores gradients, web fonts or a dark
    preference still shows a complete, legible mail.
15. **It moves, and it stays fluid.** Every chart, ring, bar and counted figure in the product has
    an entrance; every route has an arrival; every control in § "The design" answers. Measured in
    Chrome with a 4× CPU throttle on Inicio, the plan, a dish, Progreso and the console's summary:
    no long task over 50 ms caused by an animation, no layout shift (CLS 0), and no animated
    property other than `transform`, `opacity` and SVG stroke. With reduced motion on, a
    recording of the same screens shows no movement beyond a fade.
16. **What shipped on 2026-11-11 survives**: the assistant's warning text, the `data-ai-generated`
    marks, «Descargar mis conversaciones», and every 404 a person without the right is given.

## How it ships

- **In phases, straight to production** (owner). The first phase changes colour, type and themes
  across the whole product at once, so production is never half old and half new in colour; later
  phases recompose screens family by family.
- **The agent ships each phase** (owner, 2026-11-11, as for project 023): full gate, pull
  request, CI, merge, production checked. It stops at every `owner-approves` and `human-verify`
  gate and at anything red.

## Open questions

2. **For the `legal` agent, before phase 1**: does keeping the theme choice on the device change
   `/privacidad`? It is a preference the person sets, stored locally and never sent; the cookie
   and local-storage section may need one line.
3. **Typefaces**: Bricolage Grotesque and Figtree are both under the SIL Open Font License. The
   plan confirms the licence text travels with the subset files, as the current font's does.

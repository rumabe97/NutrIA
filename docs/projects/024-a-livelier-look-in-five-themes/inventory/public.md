# Inventory: public and legal pages

Phase 0 of project 024, acceptance criterion 1. Written from the code, not from the screens. Scope: the landing page and the two legal documents, in both languages.

Conventions used throughout this file:

- "Words" is a key path in `apps/web/src/i18n/dictionaries/es-ES.ts`; `en-GB.ts` has the same shape (typed against it), so both languages are covered. `—` means the text is not from the dictionary.
- Anchors are Spanish URL fragments in both languages on purpose (see `SiteHeader.tsx`): `#como-funciona`, `#personalizacion`, `#seguridad`, `#preguntas`, `#contenido`. They must survive the redesign unchanged.
- The unprefixed hrefs of `SiteHeader` and `SiteFooter` (`/`, `/acceder`, `/registro`, `/privacidad`, `/condiciones`) are plain `next/link` hrefs. In English they are not prefixed in the markup; `apps/web/src/proxy.ts` redirects an unprefixed public path to its `/en` twin when the locale cookie says English (and never redirects someone who has chosen nothing). The Landing's two main CTAs are the exception: they are prefixed in code with `withLocale('/registro', locale)`.
- Routes covered (6): `/`, `/en`, `/privacidad`, `/en/privacidad`, `/condiciones`, `/en/condiciones`.
- Root layouts `apps/web/src/app/(es)/layout.tsx` and `apps/web/src/app/en/layout.tsx` wrap every page below in `RootShell` (skip link, route announcer, service worker, locale provider; documented in `shell.md`) plus `SiteJsonLd`.

Shared things every page below renders, documented once here and referenced by number:

## Shared A. Root layout of the public trees (apps/web/src/app/(es)/layout.tsx, apps/web/src/app/en/layout.tsx, apps/web/src/app/_shared/SiteJsonLd.tsx, apps/web/src/app/_shared/SkipLink.tsx)
Every public route. `<html lang>` is `es-ES` or `en-GB` from the route tree.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| A1 | "Skip to content" link, first focusable node on the page, visible on focus, jumps to `#contenido` | link | `app/_shared/SkipLink.tsx` | `a11y.skipToContent` | always (visually hidden until focused) |
| A2 | Site-wide structured data: `Organization` (name NutrIA, url, logo `/icon`) and `WebSite` (description = `landing.lede`, `inLanguage`, publisher) in one `@graph` JSON-LD script | notice (machine-readable, invisible) | `app/_shared/SiteJsonLd.tsx` via `app/_shared/JsonLd.tsx` | `landing.lede` (WebSite description only); names are literal `NutrIA` | always, in the document body of every public page |
| A3 | `<main id="contenido">` landmark, the target of A1 and of the route announcer | text (landmark) | `app/_shared/Landing.tsx`, `app/_shared/LegalScreen.tsx`, `app/_shared/mainId.ts` | — | always |
| A4 | Share card image (Open Graph) per language tree: the landing title and the manifest description on a plain card | picture | `app/(es)/opengraph-image.tsx`, `app/en/opengraph-image.tsx`, `app/_shared/ogImage.tsx` | `landing.title`, `manifest.description` | only as the `og:image` of a shared link, never on the page itself |
| A5 | Document `<title>` and meta description of each route | text (tab title) | `app/_shared/metadata.ts` (`pageMetadata`) | `pages['/']`, `pages['/privacidad']`, `pages['/condiciones']` (`title`, `description`) | always; `/`, `/privacidad`, `/condiciones` are in the sitemap (`INDEXABLE_PATHS`) |
| A6 | Web app manifest for the English tree (`/en/manifest.webmanifest`) and the Spanish one (`app/manifest.ts`) | notice (invisible) | `app/en/manifest.webmanifest/route.ts`, `app/manifest.ts`, `app/_shared/manifest.ts` | `manifest.*` | always |

## Shared B. SiteHeader (apps/web/src/components/SiteHeader/SiteHeader.tsx)
Rendered by the landing page and both legal pages (and by nothing signed-in; the signed-in tree uses AppNav, see `shell.md`). Client component. Sticky; gains a bottom border once `window.scrollY > 8` (`data-scrolled`).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| B1 | Brand link to `/` with a decorative mark and the literal word "NutrIA"; accessible name "NutrIA — inicio" | link | `components/SiteHeader/SiteHeader.tsx` | `siteNav.brandHome` (name); "NutrIA" literal | always |
| B2 | Navigation landmark "Secciones" | list (nav) | same | `siteNav.sectionsLabel` | width >= 48rem only (hidden below it by `.nav { display: none }`; on a phone the four anchors are reachable only from the footer, which lacks "Seguridad") |
| B3 | Anchor link `#como-funciona` "Cómo funciona" | link | same | `siteNav.howItWorks` | always. On the legal pages the anchor points at an id that does not exist on that page (see Not sure) |
| B4 | Anchor link `#personalizacion` "Personalización" | link | same | `siteNav.personalisation` | always (same note) |
| B5 | Anchor link `#seguridad` "Seguridad" | link | same | `siteNav.safety` | always (same note) |
| B6 | Anchor link `#preguntas` "Preguntas" | link | same | `siteNav.questions` | always (same note) |
| B7 | Language switch, compact form: group labelled "Idioma" with two toggle buttons "ES" and "EN" (accessible names "Español" / "English"), `aria-pressed` on the active one, disabled while a switch is pending, busy on the pressed one. Pressing writes the locale cookie, tries `PATCH /profile` (a 404 for a signed-out visitor is swallowed), then navigates to the same page at the other URL keeping the query string | toggle | `components/LocaleSwitcher/LocaleSwitcher.tsx` (rendered with `compact`) | group label `profile.locale`; marks `ES`/`EN` and names `Español`/`English` are literal (`LOCALE_SHORT`, `LOCALE_NAMES`) | always |
| B8 | Error line under the full switcher (`role="alert"`) | notice | same | `messageFor(...)` from `errors.*` | never in the compact header form (the error state is only drawn by the full form on the profile screen); listed for completeness |
| B9 | "Acceder" link to `/acceder` | link | `components/SiteHeader/SiteHeader.tsx` | `siteNav.signIn` | always |
| B10 | "Crear mi plan" call-to-action link to `/registro` (button look, small) | link | same, via `components/CtaLink/CtaLink.tsx` | `siteNav.signUp` | width >= 40rem only (hidden below it so brand, language and sign-in fit in 360 px) |

## Shared C. SiteFooter (apps/web/src/components/SiteFooter/SiteFooter.tsx)
Landing page and both legal pages. Client component.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| C1 | Brand name "NutrIA" | text | `components/SiteFooter/SiteFooter.tsx` | literal | always |
| C2 | Tagline | text | same | `footer.tagline` | always |
| C3 | Column title "Producto" | heading (visual title, a `span`, not a heading element) | same | `footer.product` | always |
| C4 | Link `#como-funciona` "Cómo funciona" | link | same | `siteNav.howItWorks` | always |
| C5 | Link `#personalizacion` "Personalización" | link | same | `siteNav.personalisation` | always |
| C6 | Link `#preguntas` "Preguntas" | link | same | `siteNav.questions` | always. Note there is no "Seguridad" link in the footer |
| C7 | Column title "Cuenta" | heading (span) | same | `footer.account` | always |
| C8 | Link `/registro` "Crear cuenta" | link | same | `footer.createAccount` | always |
| C9 | Link `/acceder` "Acceder" | link | same | `footer.signIn` | always |
| C10 | Column title "Legal" | heading (span) | same | `footer.legal` | always |
| C11 | Link `/privacidad` "Privacidad" | link | same | `footer.privacyPolicy` | always |
| C12 | Link `/condiciones` "Condiciones" | link | same | `footer.terms` | always |
| C13 | Permanent disclaimer: plan is general, not a substitute for a doctor or registered dietitian | text | same | `footer.disclaimer` | always |
| C14 | Copyright line "© {current year} NutrIA" | text | same | year computed at render; "NutrIA" literal | always |

## / and /en  — Landing page (apps/web/src/app/_shared/Landing.tsx, mounted by apps/web/src/app/(es)/page.tsx and apps/web/src/app/en/page.tsx)
Public, statically built per language, no redirects of its own. A signed-in person is not redirected away from it (the proxy only redirects `AUTH_ROUTES`, not `/`). Renders SiteHeader (B), `<main id="contenido">`, SiteFooter (C), plus Shared A. Every block is wrapped in `Reveal` (`components/Reveal/Reveal.tsx`): content is server-rendered visible, a below-the-fold block is hidden then faded in once when scrolled to, and nothing is hidden under `prefers-reduced-motion: reduce` or without JavaScript. The reveal is decoration, not content: it must not gate any text.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | SiteHeader | list (nav) | `components/SiteHeader/SiteHeader.tsx` | see B1-B10 | always |
| 2 | Hero eyebrow "Un plan nuevo cada dos semanas" | text | `app/_shared/Landing.tsx` | `landing.eyebrow` | always |
| 3 | Page heading h1 "Nutrición que se adapta a ti." | heading | same | `landing.title` | always |
| 4 | Hero lede paragraph | text | same | `landing.lede` | always |
| 5 | Primary CTA "Crear mi plan" to `/registro` (`/en/registro` in English), large | link | same, via `CtaLink` | `landing.ctaPrimary` | always |
| 6 | Secondary CTA "Cómo funciona" to `#como-funciona`, large, secondary look | link | same | `landing.ctaSecondary` | always |
| 7 | Hero note "Sin tarjeta. Tu plan estará listo en cuanto termines el cuestionario." | text | same | `landing.heroNote` | always |
| 8 | Product preview card, static illustration (not interactive): bar with "Día 6 de 14" | text | same | `landing.preview.dayOf` | always |
| 9 | Preview bar totals "1.750 kcal · 130 g proteína" | text | same | `landing.preview.totals` | always |
| 10 | Preview meal rows, four of them (slot, dish name, kcal): Desayuno / Bol de yogur griego con fruta y avena / 410 kcal; Comida / Arroz con pollo, pimiento y brócoli / 620 kcal; Merienda / Manzana y un puñado de almendras / 180 kcal; Cena / Merluza al horno con patata y ensalada / 540 kcal | list | same | `landing.preview.meals[].slot`, `.name`, `.kcal` | always |
| 11 | Preview stat "72 %" labelled "Adherencia" | text | same | `landing.preview.adherenceValue`, `landing.preview.adherence` | always |
| 12 | Preview stat "En 8 días" labelled "Próxima revisión" | text | same | `landing.preview.nextReviewValue`, `landing.preview.nextReview` | always |
| 13 | Preview stat "18 / 24" labelled "Lista de la compra" | text | same | `landing.preview.shoppingValue`, `landing.preview.shopping` | always |
| 14 | Section `#como-funciona` heading h2 "Cuatro pasos. Después, se repite solo." | heading | same | `landing.stepsTitle` | always |
| 15 | Steps lede | text | same | `landing.stepsLede` | always |
| 16 | Four step blocks, each an h3 plus a sentence: "Nos cuentas cómo vives", "Creamos tu plan", "Lo sigues a tu ritmo", "Se adapta" | list | same | `landing.steps[].title`, `landing.steps[].body` | always |
| 17 | Section `#personalizacion` heading h2 "Tu plan sabe que te saltas el desayuno." | heading | same | `landing.personalisationTitle` | always |
| 18 | Personalisation lede | text | same | `landing.personalisationLede` | always |
| 19 | Six feature cards, each an h3 plus a sentence, inside `Card`: "Planes de catorce días", "Cambia cualquier comida", "Lista de la compra automática", "Progreso sin obsesión", "Alergias como límite duro", "Asistente de nutrición" | list | same, `components/Card/Card.tsx` | `landing.features[].title`, `landing.features[].body` | always |
| 20 | Section `#seguridad` (full-bleed band) heading h2 "Lo importante no lo decide un modelo." | heading | same | `landing.safetyTitle` | always |
| 21 | Safety lede "La IA propone comidas. Lo que puede hacerte daño lo comprueba el sistema." | text | same | `landing.safetyLede` | always |
| 22 | Three safety items, each an h3 plus a sentence: "La IA no decide sobre tu seguridad", "Los números no se improvisan", "Sabemos dónde está el límite" | list | same | `landing.safety[].title`, `landing.safety[].body` | always |
| 23 | Section `#preguntas` heading h2 "Preguntas frecuentes" | heading | same | `landing.faqTitle` | always |
| 24 | FAQ accordion, single-open and collapsible, six items; the trigger is the question, the panel is the answer. Questions: "¿Por qué catorce días?", "¿Puedo cambiar una comida que no me gusta?", "¿Cómo tratáis las alergias?", "¿Esto sustituye a un dietista o a mi médico?", "¿Qué pasa con mis planes anteriores?", "¿Puedo borrar mis datos?". Items are keyed by question text, no item is open by default | list (accordion; each trigger a button) | same, `ui/components/Accordion` (`packages/ui/src/components/Accordion`) | `landing.faq[].question`, `landing.faq[].answer` | always |
| 25 | FAQ structured data: `FAQPage` JSON-LD built from the same `landing.faq` array as the accordion, so markup and visible words cannot differ | notice (invisible) | same, `app/_shared/JsonLd.tsx` | `landing.faq[]` | always |
| 26 | Final CTA band heading h2 "Deja de decidir qué cenar." (centred) | heading | same | `landing.finalCtaTitle` | always |
| 27 | Final CTA lede | text | same | `landing.finalLede` | always |
| 28 | Final CTA button "Crear mi plan" to `/registro` (`/en/registro` in English), large | link | same | `landing.ctaPrimary` | always |
| 29 | SiteFooter | list (nav) | `components/SiteFooter/SiteFooter.tsx` | see C1-C14 | always |

Anchor map of the page (all must still resolve after the redesign): `#como-funciona` (section 14-16), `#personalizacion` (17-19), `#seguridad` (20-22), `#preguntas` (23-25), `#contenido` (main). The hero has no id. The final CTA band has no id.

## /privacidad and /en/privacidad  — Privacy policy (apps/web/src/app/_shared/LegalScreen.tsx with document="privacy"; apps/web/src/app/(es)/privacidad/page.tsx, apps/web/src/app/en/privacidad/page.tsx)
Public, static, no redirect and no condition. One column, no hero. Renders SiteHeader (B), `<main id="contenido"><article>`, SiteFooter (C), plus Shared A. `{name}` and `{email}` placeholders in the text are filled from `LEGAL_IDENTITY` (`apps/web/src/i18n/legalIdentity.ts`); the keys are `name` and `email`, values are deliberately not recorded here. The text is plain paragraphs and bullet lists: there are no links, buttons, forms or images inside the document body. Other screens link to two of its anchors (`#tu-dietista`, `#asistente`); they must keep resolving.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | SiteHeader | list (nav) | `components/SiteHeader/SiteHeader.tsx` | see B1-B10 | always |
| 2 | Heading h1 "Política de privacidad" | heading | `app/_shared/LegalScreen.tsx` | `privacy.title` | always |
| 3 | Last-updated line "Última actualización: 10 de noviembre de 2026" | text | same | `privacy.updated` | always |
| 4 | Intro paragraphs | text | same | `privacy.intro[]` | always |
| 5 | Section "Quién trata tus datos" (paragraphs) | heading (h2) | same | `privacy.sections[0].heading`, `.paragraphs[]` | always |
| 6 | Section "Qué datos recogemos y para qué" (paragraphs + bullet list) | heading (h2) | same | `privacy.sections[1].heading`, `.paragraphs[]`, `.list[]` | always |
| 7 | Section "Cuáles de estos datos son especialmente protegidos" | heading (h2) | same | `privacy.sections[2].*` | always |
| 8 | Section "Por qué podemos tratar estos datos" | heading (h2) | same | `privacy.sections[3].*` | always |
| 9 | Section `id="tu-dietista"` "Tu dietista en NutrIA" | heading (h2, anchor) | same | `privacy.sections[4].id`, `.heading`, `.paragraphs[]` | always |
| 10 | Section "La inteligencia artificial" | heading (h2) | same | `privacy.sections[5].*` | always |
| 11 | Section `id="asistente"` "El asistente" | heading (h2, anchor) | same | `privacy.sections[6].id`, `.heading`, `.paragraphs[]` | always |
| 12 | Section "Con quién compartimos tus datos" (paragraphs + bullet list) | heading (h2) | same | `privacy.sections[7].*` | always |
| 13 | Section "Transferencias fuera de la Unión Europea" | heading (h2) | same | `privacy.sections[8].*` | always |
| 14 | Section "Cuánto tiempo guardamos tus datos" | heading (h2) | same | `privacy.sections[9].*` | always |
| 15 | Section "Tus derechos" (paragraphs + bullet list) | heading (h2) | same | `privacy.sections[10].*` | always |
| 16 | Section "Cómo protegemos tus datos" | heading (h2) | same | `privacy.sections[11].*` | always |
| 17 | Section "Cookies y almacenamiento en tu dispositivo" | heading (h2) | same | `privacy.sections[12].*` | always |
| 18 | Section "Menores de edad" | heading (h2) | same | `privacy.sections[13].*` | always |
| 19 | Section "Cambios en esta política" | heading (h2) | same | `privacy.sections[14].*` | always |
| 20 | SiteFooter | list (nav) | `components/SiteFooter/SiteFooter.tsx` | see C1-C14 | always |

Structure rule from `LegalScreen`: each section is `<section id? key=heading>` with an h2, its `paragraphs[]`, and an optional `<ul>` from `list[]`; only sections that declare `id` get an `id` attribute. 15 sections; lists are in sections 1, 7 and 10 (0-based).

## /condiciones and /en/condiciones  — Terms of use (apps/web/src/app/_shared/LegalScreen.tsx with document="terms"; apps/web/src/app/(es)/condiciones/page.tsx, apps/web/src/app/en/condiciones/page.tsx)
Same screen and same rules as the privacy policy, with the `terms` dictionary entry and the same `LEGAL_IDENTITY` interpolation. One section id, `dietista`, is linked from elsewhere.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | SiteHeader | list (nav) | `components/SiteHeader/SiteHeader.tsx` | see B1-B10 | always |
| 2 | Heading h1 "Condiciones de uso" | heading | `app/_shared/LegalScreen.tsx` | `terms.title` | always |
| 3 | Last-updated line "Última actualización: 10 de noviembre de 2026" | text | same | `terms.updated` | always |
| 4 | Intro paragraphs | text | same | `terms.intro[]` | always |
| 5 | Section "Quién presta el servicio" | heading (h2) | same | `terms.sections[0].*` | always |
| 6 | Section "Qué es NutrIA, y qué no es" | heading (h2) | same | `terms.sections[1].*` | always |
| 7 | Section "Alergias e intolerancias" | heading (h2) | same | `terms.sections[2].*` | always |
| 8 | Section "Tu cuenta" (paragraphs + list) | heading (h2) | same | `terms.sections[3].*` | always |
| 9 | Section "Cómo se celebra este contrato" (paragraphs + list) | heading (h2) | same | `terms.sections[4].*` | always |
| 10 | Section "Contenido generado con inteligencia artificial" | heading (h2) | same | `terms.sections[5].*` | always |
| 11 | Section "El plan gratuito y Premium" (paragraphs + list) | heading (h2) | same | `terms.sections[6].*` | always |
| 12 | Section "Uso aceptable" (paragraphs + list) | heading (h2) | same | `terms.sections[7].*` | always |
| 13 | Section "Propiedad intelectual" | heading (h2) | same | `terms.sections[8].*` | always |
| 14 | Section "Disponibilidad y cambios en el servicio" | heading (h2) | same | `terms.sections[9].*` | always |
| 15 | Section `id="dietista"` "Si trabajas con un dietista" | heading (h2, anchor) | same | `terms.sections[10].id`, `.heading`, `.paragraphs[]` | always |
| 16 | Section "Responsabilidad" | heading (h2) | same | `terms.sections[11].*` | always |
| 17 | Section "Cambios en estas condiciones" | heading (h2) | same | `terms.sections[12].*` | always |
| 18 | Section "Ley aplicable" | heading (h2) | same | `terms.sections[13].*` | always |
| 19 | SiteFooter | list (nav) | `components/SiteFooter/SiteFooter.tsx` | see C1-C14 | always |

14 sections; lists are in sections 3, 4, 6 and 7 (0-based).

## Counts

Rows: Shared A 6, B 10, C 14 (30); Landing 29; Privacy 20; Terms 19. Total 98 rows (the three shared blocks are counted once; routes reference them).

## Not sure

- Whether the header's four anchor links (B3-B6) and the footer's anchor links (C4-C6) are meant to appear on the legal pages. In the code they render there too and point at ids that exist only on the landing page, so on `/privacidad` and `/condiciones` they do nothing (plain `#fragment` on the same page). Treated here as present on every page that mounts the header; the redesign must either keep them (same behaviour) or the later check must record the change deliberately.
- Header breakpoints were read from `SiteHeader.module.css` only by grep: `.nav` shows at >= 48rem, `.cta` at >= 40rem; brand, language switch and "Acceder" always show. Other responsive rules were not checked.
- The `Accordion` (`ui/components/Accordion`) behaviour (keyboard, `aria-expanded`, which element carries the heading role) was not read; only its props at the call site (`type="single"`, `collapsible`).
- Privacy section indices for lists: derived by pattern-matching the dictionary source, so index counts should be confirmed against `es-ES.ts` lines 2925-3118 (privacy) and 3422-3548 (terms) when the check is run. The per-paragraph text is deliberately not enumerated.
- The `Reveal` hide/show effect is perceivable (content fades in) but carries no information; recorded as decoration, not a row.
- Whether the text of `privacy` and `terms` contains inline links or emphasis: `LegalScreen` renders `fill(paragraph)` as plain strings through `Text`, so no, but a later dictionary edit could not add one without a code change.
- The English tree's `/en/manifest.webmanifest` is a route handler, not a screen; included only as invisible metadata (A6).

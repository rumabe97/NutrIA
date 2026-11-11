# Inventory: the admin console

Project 024, phase 0. This is the written contract that acceptance criterion 1 is checked against for the owner's console (`(admin)` route group). It was written from the code, by reading every `page.tsx` under `apps/web/src/app/(admin)/`, the console's frame, `apps/web/src/components/AdminNav/**`, and every component each page renders.

**How to read it.** "Words" is a key path in `apps/web/src/i18n/dictionaries/es-ES.ts` (the English dictionary `en-GB.ts` has the same keys by construction, so a key covers both languages). "Not from the dictionary" means the text comes from data (an email address, a dish name, a number, a date, a model name, an API-supplied string) or is a symbol. "Kind" is one of: heading, text, figure, picture, link, button, field, toggle, select, menu, dialog, notice, status, chart, table, list.

**The console keeps no offline copy and no app navigation.** `(admin)` is its own root layout: no `AppNav`, no offline provider, no offline copy. Everything on these screens is read per request (`dynamic = 'force-dynamic'`). The console's Spanish addresses are shown in both languages (the dictionary is switched by the locale cookie; the labels of the tables follow it).

**Words that are not translated by the dictionary but carried in data** (a redesign must still show them): account emails, free-text feedback messages, collegiate numbers, dish names, ingredient names, model names/ids, provider names, database/queue codes (for example `GENERATION_FAILED` when not mapped), allergen and ingredient names from the catalogue (supplied by the API in the active locale), dates and numbers formatted by `lib/format` for the active locale.

## Contents

0. Shared parts (used by many routes; each route section lists what it feeds them, so a route's rows name the shared part and give the specifics)
1. The frame: `(admin)/layout.tsx`, `admin/layout.tsx` (gate, second-factor-required screen), `(admin)/not-found.tsx`, `admin/[...rest]`, AdminNav (bar, drawer, sidebar, every group and link)
2. Routes, in navigation order: `/admin`, `/admin/cuentas`, `/admin/profesionales`, `/admin/consentimientos`, `/admin/personas/retencion`, `/admin/buzon`, `/admin/producto`, `/admin/producto/planes`, `/admin/producto/planes/calidad`, `/admin/notificaciones`, `/admin/generacion`, `/admin/generacion/ia`, `/admin/catalogo`, `/admin/catalogo/[id]/imagen`, `/admin/catalogo/calidad`, `/admin/catalogo/ingredientes`, `/admin/catalogo/despensa`, `/admin/catalogo/imagenes`, `/admin/ajustes`, `/admin/ajustes/registro`, `/admin/ajustes/sistema`, `/admin/[...rest]`
3. Not sure

## 0. Shared parts

Rows in a route section that say "Shared S-n" mean: this part, in full, with the route's own words filled in. The shared parts are listed once here so that nothing is dropped.

### S-1 Page header (`apps/web/src/components/AdminPageHeader/AdminPageHeader.tsx`)

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| S-1.1 | Page title (the one `h1` of the page) | heading | AdminPageHeader.tsx | the page's own `title` key | always |
| S-1.2 | One-line description under the title | text | AdminPageHeader.tsx | the page's own `intro` key | always |
| S-1.3 | Controls slot beside/under the title (holds S-2 on the pages that have a period) | (slot) | AdminPageHeader.tsx | n/a | when the page passes children |

### S-2 Period selector (`apps/web/src/components/PeriodSelector/PeriodSelector.tsx`)

Three links, not a form; a period is an address (`?period=7|30|90`; default from `core/entities/Period` `DEFAULT_PERIOD`). Every other query parameter rides along on each link. No JavaScript is needed.

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| S-2.1 | Navigation group named "Periodo" | list | PeriodSelector.tsx | `adminConsole.period` (as the nav's accessible name) | on every page that has a period |
| S-2.2 | Link "7 días" | link | PeriodSelector.tsx | `adminConsole.periodOption` with days = 7 | same |
| S-2.3 | Link "30 días" | link | PeriodSelector.tsx | `adminConsole.periodOption` with days = 30 | same |
| S-2.4 | Link "90 días" | link | PeriodSelector.tsx | `adminConsole.periodOption` with days = 90 | same |
| S-2.5 | Current-period state: the one being shown carries `aria-current="true"`, a filled segment and heavier type (never colour alone) | status | PeriodSelector.tsx + PeriodSelector.module.css | n/a | the period in force |

Pages with the selector: `/admin`, `/admin/cuentas`, `/admin/buzon`, `/admin/producto`, `/admin/producto/planes`, `/admin/producto/planes/calidad`, `/admin/notificaciones`, `/admin/generacion`, `/admin/generacion/ia`, `/admin/catalogo/calidad`, `/admin/catalogo/imagenes`, `/admin/ajustes/sistema` (each section confirms with its own row).

### S-3 Section (`apps/web/src/components/AdminSection/AdminSection.tsx`)

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| S-3.1 | Section heading (`h2`, names the region for the landmarks menu) | heading | AdminSection.tsx | the section's `title` key | always |
| S-3.2 | Optional note under the heading ("what this section counts over") | text | AdminSection.tsx | the section's `note` | only when the page passes a note |

### S-4 "How this is counted" fold (`apps/web/src/components/HowCounted/HowCounted.tsx`)

A native `<details>` closed by default. One per page at the foot of the page unless the page section says none.

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| S-4.1 | Disclosure toggle "Cómo se cuenta" with chevron | toggle | HowCounted.tsx | `adminConsole.howCounted` | pages with notes |
| S-4.2 | List of caveat paragraphs (content is the page's own `howCounted` array) | list | HowCounted.tsx | page's `howCounted` | when opened |

### S-5 Console table (`apps/web/src/components/AdminTable/AdminTable.tsx` + `components/*`, `packages/ui/src/components/DataTable`)

Every table's state is in the address (`q`, filters, `sort`, `dir`, `offset`, `size`), a GET form that also works without JavaScript; with JavaScript the form applies as it changes (search after 300 ms, selects immediately).

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| S-5.1 | Toolbar (form named "Buscar y filtrar"; role search) | (landmark) | AdminTable.tsx, AdminTableForm.tsx | `adminConsole.table.toolbar` | when the table has a search field |
| S-5.2 | Toolbar form named "Filtrar" (no search role) | (landmark) | AdminTable.tsx | `adminConsole.table.toolbarFilters` | when the table has no search field |
| S-5.3 | Search field (type search, name `q`, max 200 chars; label is the page's `search` key) | field | AdminTable.tsx (ui `Input`) | page's `search` key | when the table has a search |
| S-5.4 | Filter: native select with a first option that sends nothing (the page's `anyLabel`, usually "Cualquiera") and the page's options | select | AdminFilter.tsx | `adminConsole.table.any` + page's labels | per table |
| S-5.5 | Filter: date field (native `type=date`, empty = any) | field | AdminTable.tsx | page's label | only the generation log |
| S-5.6 | Filters fold: with more than one filter they sit inside a `<details>` whose summary reads "Filtros" or "Filtros (n activos)"/"Filtros (1 activo)"; it is open whenever a filter is on | toggle | AdminFilters.tsx | `adminConsole.table.filters`, `.filtersActive`, `.filtersActiveOne` | tables with 2 or more filters |
| S-5.7 | Page size select "Por página" (options from `PAGE_SIZES` in `core/entities/AdminQuery`) | select | AdminTable.tsx | `adminConsole.table.pageSize` | paged tables |
| S-5.8 | Submit button "Aplicar" (secondary) | button | AdminTable.tsx | `adminConsole.table.apply` | always (the only control that matters without JavaScript) |
| S-5.9 | Hidden inputs carrying every other query parameter (period, sort) | (hidden) | AdminTable.tsx | n/a | always |
| S-5.10 | Status line over the table (polite live region): sorted tables "{count} en total · por {column}, {direction}"; fixed-order tables "{count} en total". Focus lands here when a pager link or a row that held focus disappears | status | AdminTableStatus.tsx | `adminConsole.table.status`, `.count`, `.ascending`, `.descending` | always |
| S-5.11 | Table (in a focusable scroll region named by its hidden caption; first column is the row header) | table | DataTable.tsx | page's `caption` and `columns.*` | always |
| S-5.12 | Sortable column header: a link to the same address sorted by it, plus a sort icon and a hidden hint ("ordenar de forma ascendente/descendente", or when already sorted "orden ascendente; ordenar de forma descendente" and vice versa); `aria-sort` on the header | link | DataTable.tsx | `adminConsole.table.sortAsc`, `.sortDesc`, `.sortedAsc`, `.sortedDesc` | on columns that sort |
| S-5.13 | Empty state: the page's `empty` text when there are no rows and no search/filter is on | status | DataTable.tsx | page's `empty` | no rows, no filter |
| S-5.14 | No-match state: the page's `noMatch` text plus a link "Quitar la búsqueda y los filtros" (with a search field) or "Quitar los filtros" (without) | status + link | AdminTable.tsx | page's `noMatch`; `adminConsole.table.clear`, `.clearFilters` | rows empty and a search or a filter is on |
| S-5.15 | Pager (nav "Páginas de la tabla"): "Anterior" link (rel prev), range "{from}–{to} de {total}", "Siguiente" link (rel next) | list | AdminPager.tsx | `adminConsole.table.pager`, `.previous`, `.next`, `.range` | paged tables with more than one page (renders nothing if neither neighbour exists) |
| S-5.16 | Card around the table (visual) | (container) | AdminTable.tsx | n/a | always |

Common cell conventions: a missing value is "—"; yes/no cells show "Sí"/"No" (`adminConsole.yes`, `adminConsole.no`), the "No" variant carrying `data-state="off"`; dates through `lib/format` (`formatDate`).

### S-6 Stat tile (`packages/ui/src/components/StatTile/StatTile.tsx`)

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| S-6.1 | Label | text | StatTile.tsx | the tile's key | always |
| S-6.2 | Value (the big figure) | figure | StatTile.tsx | n/a (number/percent/USD formatted for the locale) | always |
| S-6.3 | Sparkline (tiny line of the tile's series) | chart | `packages/ui/src/components/Sparkline` | n/a (decorative; the figure carries the meaning) | only when the tile is given a series |
| S-6.4 | Change against the previous period: up/down triangle plus signed percentage; a hidden sentence "{change} frente al periodo anterior" is what a screen reader hears; colour is good/bad/grey by `goodDirection` | figure | StatTile.tsx | `adminConsole.changeLabel` | only when the tile has a change and it is computable (not when previous is zero/undefined); no triangle when change is 0 |
| S-6.5 | Note under the figure | text | StatTile.tsx | the tile's note key | only when the tile has a note |

Tiles are always `<li>` inside a `<ul>` whose accessible name is the page's `tilesLabel` key.

### S-7 Chart (`packages/ui/src/components/ChartFrame` + `LineChart` / `ColumnChart` / `BarChart` / `DonutChart` / `Gauge`)

Every chart is a `<figure>` with the same parts. A row in a route says "Shared S-7" and gives the type, title, series, tones and strings.

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| S-7.1 | Chart title (figcaption) | heading | ChartFrame.tsx | chart's `title` key | always |
| S-7.2 | Empty message in place of the chart | status | ChartFrame.tsx | chart's `emptyLabel` key | when there is no data (all-zero or no labels; for Gauge: no cap or non-finite value) |
| S-7.3 | The drawing (SVG, `role=img`, named by the title); every mark has a hover/long-press `<title>` "label · series: value" | chart | LineChart / ColumnChart / BarChart / DonutChart / Gauge `.tsx` | n/a (values formatted for the locale) | when not empty |
| S-7.4 | Axis: value ticks and date/week labels (line and column charts) | text | ChartAxes | n/a | line/column charts |
| S-7.5 | Legend (series names with colour swatch; for the donut it also carries "value · share") | list | ChartLegend | series names from the page | multi-series charts, always for donut |
| S-7.6 | "Ver datos" disclosure that opens a data table of the same numbers (columns: first column headed by the chart's `labelsHeader`, then one per series; stacked columns add a total column when the page passes `totalLabel`; bar chart with shares adds a share column; donut adds share column when given a `shareHeader`; gauge has value and cap columns) | toggle + table | ChartFrame.tsx | `adminConsole.dataLabel`; `adminConsole.day` or `adminConsole.week` as `labelsHeader` unless the page passes its own | when not empty |
| S-7.7 | Over-the-cap warning with triangle icon (gauge only) | notice | Gauge.tsx | gauge's `overLabel` key | only when value > cap |
| S-7.8 | Tone: each series has a tone (1..N, `success`, `failure`, `neutral`); colour must never be the only carrier (legend + data table + hover title carry the name) | (style) | `ui/types/Chart.types` | n/a | always |

### S-8 Count list (`apps/web/src/components/AdminCountList`)

See the first route section that uses it (`/admin/catalogo/calidad`, `/admin/catalogo/imagenes`, `/admin/catalogo/despensa`, `/admin/generacion`, `/admin/ajustes/sistema`); the component's own rows are given there.

### S-9 Row-action buttons

All row action buttons (Abrir cuenta, Dar premium, Pasar a gratis, Marcar como visto, Volver a abrir, Retirar, Reintentar, ...) carry an accessible name that begins with the visible words (WCAG 2.5.3) then names the row ("Abrir cuenta: {email}"), show a loading state while the request is in flight (button disabled, spinner), keep focus on the row after the table refreshes (`useKeepFocus`), and show a failure as an alert line from `errors.*` via `messageFor` (the table of API codes to messages is in `apps/web/src/lib/api.ts`; the visible sentences are `errors.*` keys listed in `## Not sure` only where the code could not settle which one appears).

## 1. The frame

### Root layout `(admin)` (`apps/web/src/app/(admin)/layout.tsx`)

Everyone who asks for any address under `/admin`. Document language from the locale cookie.

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| F-1.1 | `<html lang>` set from the cookie's locale (es-ES or en-GB), `<body>` carries the font variable | (document) | `(admin)/layout.tsx`, `app/_shared/RootShell.tsx` | n/a | always |
| F-1.2 | Skip link "Saltar al contenido", first focusable node, jumps to `#main` (the `<main>` id from `_shared/mainId`) | link | `app/_shared/SkipLink.tsx` | `a11y.skipToContent` | always (visible on focus) |
| F-1.3 | Route announcer: after a client navigation, focus moves to the new page's `h1` (or `<main>`) so a screen reader says the page | (behaviour) | `app/_shared/RouteAnnouncer.tsx` | n/a | after navigation |
| F-1.4 | Offline service worker is registered by the shell; console pages are not cached for offline use (they hold emails) | (behaviour) | `app/_shared/ServiceWorker.tsx` | n/a | always, invisible |
| F-1.5 | Document title: for an admin, the page's `pages['/admin…'].title`; for anybody else the 404 title | (document) | `admin/consoleMetadata.ts` | `pages['/admin'].title` … (list in each route); `errors.notFoundTitle` for a non-admin | always |
| F-1.6 | Metadata from `rootMetadata(locale)`, viewport from `siteViewport` | (document) | `app/_shared/metadata.ts` | n/a | always |

### Gate `admin/layout.tsx` (`apps/web/src/app/(admin)/admin/layout.tsx`)

Who reaches the console: only an account whose stored role is `admin` (read from `/users/me`). Anybody else, a signed-out visitor, an expired session, or a failed read: 404 (renders `(admin)/not-found.tsx`). An admin with a password and without the second factor gets `SecondFactorRequired` instead of the console. Every page under it is `force-dynamic`.

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| F-2.1 | 404 for any non-admin at every `/admin…` address (see the not-found section) | status | `admin/layout.tsx` -> `(admin)/not-found.tsx` | `errors.notFound` | role is not admin or user read failed |
| F-2.2 | Second-factor-required screen: `<main>` containing a card | (screen) | `admin/layout.tsx`, `components/SecondFactorRequired/SecondFactorRequired.tsx` | n/a | admin account that has a password and the second factor off (`secondFactorMissing`) |
| F-2.3 | Heading (`h1`, size lg) "Activa la verificación en dos pasos" | heading | SecondFactorRequired.tsx | `secondFactorRequired.title` | same |
| F-2.4 | Paragraph 1: why the console needs two-step verification | text | SecondFactorRequired.tsx | `secondFactorRequired.console[0]` | same |
| F-2.5 | Paragraph 2: turn it on in the profile, under Seguridad, with an authenticator app; a passkey does not replace it while the account has a password | text | SecondFactorRequired.tsx | `secondFactorRequired.console[1]` | same |
| F-2.6 | Link/button "Ir a Seguridad" to `/perfil#seguridad` (primary call to action) | link | SecondFactorRequired.tsx (`components/CtaLink`) | `secondFactorRequired.action` | same |
| F-2.7 | Shell for the real console: sidebar/bar (AdminNav) beside `<main id=main>` holding the page | (layout) | `admin/layout.tsx` | n/a | admin with the second factor satisfied |
| F-2.8 | No navigation is rendered on the second-factor-required screen (no AdminNav, no way back except the browser) | (state) | `admin/layout.tsx` | n/a | same as F-2.2 |

### 404 `(admin)/not-found.tsx` (`apps/web/src/app/(admin)/not-found.tsx`)

What anybody but an admin gets at any console address, and what a console page that cannot load its figures (the API answered 404 for it) falls back to. Renders inside the root shell with none of the console's frame, so it says nothing about the address having been real.

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| F-3.1 | Heading (`h1`) "No hemos encontrado lo que buscabas." | heading | not-found.tsx | `errors.notFound` | always on this screen |
| F-3.2 | Link/button "Ir al inicio" to `/inicio` (primary call to action) | link | not-found.tsx (`components/CtaLink`) | `errors.boundaryHome` | always on this screen |
| F-3.3 | Tab title "Página no encontrada" | (document) | `admin/[...rest]/page.tsx`, `consoleMetadata.ts` | `errors.notFoundTitle` | same |

### Unknown address `admin/[...rest]` (`apps/web/src/app/(admin)/admin/[...rest]/page.tsx`)

Any `/admin/<something that is not a page>`. For anybody (admin or not) after the gate has run, it calls `notFound()`: the same 404 screen as F-3, with the same title, so a made-up address and a real one shown to a stranger read alike. No elements of its own. (For a non-admin the gate answers first; for an admin the 404 replaces the content area and the console frame is not drawn, because the boundary sits above the gate.)

### Console navigation (`apps/web/src/components/AdminNav/AdminNav.tsx`, `components/AdminNavList/AdminNavList.tsx`, `sections.ts`)

Client component (reads the path for the current page). Wide screens (60rem and up): a sidebar that stays. Below 60rem: a top bar with the console's name and a "Menú" button that opens the same list in a drawer. One list serves both (`AdminNavList`), so they cannot disagree. Below 20rem the bar changes its layout.

| # | Element | Kind | Where | Words | When shown |
|---|---|---|---|---|---|
| N-1 | Top bar (`<header>`) | (landmark) | AdminNav.tsx | n/a | below 60rem |
| N-2 | Console name in the bar | text | AdminNav.tsx | `adminNav.title` ("Consola") | below 60rem |
| N-3 | "Menú" button with a three-line icon (secondary, small): opens the drawer | button | AdminNav.tsx (`ui/components/Sidebar` trigger) | `adminNav.menu` | below 60rem |
| N-4 | Drawer (slides from the left, titled "Consola"; focus moves into it; Escape or the overlay close it; vaul) | dialog | AdminNav.tsx, `packages/ui/src/components/Sidebar` | `adminNav.title` as drawer title | when "Menú" is activated |
| N-5 | Drawer contents: the same navigation list (N-8 to N-33) | list | AdminNav.tsx | see below | when the drawer is open |
| N-6 | Drawer button "Cerrar" (tertiary, small) closing the drawer | button | AdminNav.tsx | `common.close` | in the drawer |
| N-7 | Drawer focus rule: after following a link to a different page the drawer does not hand focus back to "Menú" (so the route announcer's focus on the new h1 is kept); Close, Escape, overlay, or a link to the page already open do return focus to "Menú". A modified click (new tab) does not close the drawer | (behaviour) | AdminNav.tsx, AdminNavList.tsx | n/a | in the drawer |
| N-8 | Sidebar (`<div>`) with the console name and the list | (landmark) | AdminNav.tsx | n/a | 60rem and up |
| N-9 | Console name at the top of the sidebar | text | AdminNav.tsx | `adminNav.title` | 60rem and up |
| N-10 | Navigation landmark named "Secciones de la consola" | list | AdminNavList.tsx | `adminNav.label` | always (sidebar and drawer) |
| N-11 | Link "Resumen" -> `/admin` (a group of one page draws just the link, no group name) | link | AdminNavList.tsx, sections.ts | `adminNav.pages.summary` | always |
| N-12 | Group name "Personas" (not a heading; names its list via aria-labelledby) | text | AdminNavList.tsx | `adminNav.groups.people` | always |
| N-13 | Link "Cuentas" -> `/admin/cuentas` | link | sections.ts | `adminNav.pages.accounts` | always |
| N-14 | Link "Profesionales" -> `/admin/profesionales` | link | sections.ts | `adminNav.pages.professionals` | always |
| N-15 | Link "Consentimientos" -> `/admin/consentimientos` | link | sections.ts | `adminNav.pages.consents` | always |
| N-16 | Link "Retención" -> `/admin/personas/retencion` | link | sections.ts | `adminNav.pages.retention` | always |
| N-17 | Link "Buzón" -> `/admin/buzon` | link | sections.ts | `adminNav.pages.inbox` | always |
| N-18 | Group name "Producto" | text | AdminNavList.tsx | `adminNav.groups.product` | always |
| N-19 | Link "Embudo y actividad" -> `/admin/producto` | link | sections.ts | `adminNav.pages.product` | always |
| N-20 | Link "Planes" -> `/admin/producto/planes` | link | sections.ts | `adminNav.pages.plans` | always |
| N-21 | Link "Calidad de los planes" -> `/admin/producto/planes/calidad` | link | sections.ts | `adminNav.pages.planQuality` | always |
| N-22 | Link "Notificaciones" -> `/admin/notificaciones` | link | sections.ts | `adminNav.pages.notifications` | always |
| N-23 | Group name "Generación" | text | AdminNavList.tsx | `adminNav.groups.generation` | always |
| N-24 | Link "Registro" -> `/admin/generacion` | link | sections.ts | `adminNav.pages.log` | always |
| N-25 | Link "IA y modelos" -> `/admin/generacion/ia` | link | sections.ts | `adminNav.pages.ai` | always |
| N-26 | Group name "Catálogo" | text | AdminNavList.tsx | `adminNav.groups.catalogue` | always |
| N-27 | Link "Recetas" -> `/admin/catalogo` | link | sections.ts | `adminNav.pages.recipes` | always |
| N-28 | Link "Calidad" -> `/admin/catalogo/calidad` | link | sections.ts | `adminNav.pages.quality` | always |
| N-29 | Link "Ingredientes" -> `/admin/catalogo/ingredientes` | link | sections.ts | `adminNav.pages.ingredients` | always |
| N-30 | Link "Despensa" -> `/admin/catalogo/despensa` | link | sections.ts | `adminNav.pages.cupboard` | always |
| N-31 | Link "Imágenes" -> `/admin/catalogo/imagenes` | link | sections.ts | `adminNav.pages.pictures` | always |
| N-32 | Group name "Ajustes" (three pages, so it is named) | text | AdminNavList.tsx | `adminNav.groups.settings` | always |
| N-33 | Links "Interruptores" -> `/admin/ajustes`, "Registro de acciones" -> `/admin/ajustes/registro`, "Sistema" -> `/admin/ajustes/sistema` | link | sections.ts | `adminNav.pages.settings`, `.auditLog`, `.system` | always |
| N-34 | Current-page state: the link whose address equals the path exactly carries `aria-current="page"` (exact match, never a prefix, so `/admin/producto` is not current on `/admin/producto/planes`) | status | AdminNavList.tsx | n/a | the page being read; no link is current on `/admin/catalogo/[id]/imagen` or on pages with no entry |
| N-35 | Back link "Volver a NutrIA" with a left-arrow icon -> `/inicio` (the way back to the app) | link | AdminNavList.tsx | `adminNav.back` | always, last in the list |
| N-36 | Group order is fixed: Resumen, Personas, Producto, Generación, Catálogo, Ajustes; a group with no page draws nothing | (rule) | sections.ts | n/a | always |

`/admin/catalogo/[id]/imagen` is not in the navigation; it is reached from the Recetas table and from the images page.

## 2. Routes

Every route below is under the gate in section 1: anybody but an admin gets the 404, and a missing answer from the page's own API read is the same 404 (`notFound()`). Where a route says "404 if the read fails", that is the `(admin)/not-found.tsx` screen (F-3).

## /admin  (apps/web/src/app/(admin)/admin/page.tsx)

Admin with the second factor satisfied. 404 if `/admin/summary` answers nothing. Nothing on this page redirects. Document title `pages['/admin'].title` ("Resumen").

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Resumen" and intro "Cómo va el servicio en el periodo elegido, frente al periodo anterior de la misma duración." (Shared S-1) | heading + text | admin/page.tsx, AdminPageHeader.tsx | `adminSummary.title`, `adminSummary.intro` | always |
| 2 | Period selector 7/30/90 days (Shared S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `adminConsole.periodOption` | always |
| 3 | Tile list named "Cifras del periodo" | list | admin/page.tsx | `adminSummary.tilesLabel` | always |
| 4 | Tile "Cuentas": total accounts (no change, no sparkline) | figure | StatTile.tsx | `adminSummary.totalAccounts` | always |
| 5 | Tile "Cuentas nuevas": figure, change against the previous period (good direction up), sparkline | figure | StatTile.tsx | `adminSummary.newAccounts`; `adminConsole.changeLabel` | always |
| 6 | Tile "Sin activar": accounts waiting for activation (includes unconfirmed) | figure | StatTile.tsx | `adminSummary.waitingAccounts` | always |
| 7 | Tile "Personas activas": figure, change (good up), sparkline | figure | StatTile.tsx | `adminSummary.activePeople`; `adminConsole.changeLabel` | always |
| 8 | Tile "Planes generados": figure, change (good up), sparkline | figure | StatTile.tsx | `adminSummary.plansGenerated`; `adminConsole.changeLabel` | always |
| 9 | Tile "Generaciones con éxito": percentage, or "—" when none finished | figure | StatTile.tsx | `adminSummary.successRate` | always |
| 10 | Note on that tile: "{n} fallidas en el periodo" (or "Ninguna terminó en el periodo" when no finished job), then " · Periodo anterior: {rate}" when a previous rate exists | text | StatTile.tsx | `adminSummary.failedInPeriod`, `adminSummary.noneFinished`, `adminSummary.previousRate` | always (parts conditional as described) |
| 11 | Tile "Mensajes sin ver": count | figure | StatTile.tsx | `adminSummary.unreadMessages` | always |
| 12 | Tile "Gasto en imágenes": USD for the period, change (colour neutral, no good direction) | figure | StatTile.tsx | `adminSummary.pictureSpend`; `adminConsole.changeLabel` | always |
| 13 | Note on that tile "Este mes: {spent} de {cap}" | text | StatTile.tsx | `adminSummary.pictureMonth` | always |
| 14 | Tile "Gasto en IA de texto": USD for the period, change (neutral), sparkline | figure | StatTile.tsx | `adminSummary.textAiSpend`; `adminConsole.changeLabel` | always |
| 15 | Note on that tile "Este mes: {spent} de {cap} ({share})" | text | StatTile.tsx | `adminSummary.textMonth` | only when the month's text-AI figures exist |
| 16 | Appended to that note: "Por encima del tope; reescritura pausada" | notice | StatTile.tsx | `adminSummary.textMonthOver` | share is 100 % or more |
| 17 | Appended instead: "Reescritura nocturna pausada" | notice | StatTile.tsx | `adminSummary.textMonthPaused` | share under 100 % and the nightly sweep is paused |
| 18 | Section "Necesita tu atención" (Shared S-3) | heading | AdminSection.tsx | `adminSummary.needsYou.title` | always |
| 19 | Row link "Cuentas esperando activación" + count (count marked `data-zero` when 0) + chevron -> `/admin/cuentas?activated=no` | link | admin/page.tsx | `adminSummary.needsYou.waiting` | always |
| 20 | Row link "Mensajes sin ver" + count -> `/admin/buzon?state=waiting` | link | admin/page.tsx | `adminSummary.needsYou.unread` | always |
| 21 | Row link "Generaciones fallidas en las últimas 24 h" + count -> `/admin/generacion?status=failed&since=24h` | link | admin/page.tsx | `adminSummary.needsYou.failed` | always |
| 22 | Section "Tendencias" (Shared S-3) | heading | AdminSection.tsx | `adminSummary.trendsTitle` | always |
| 23 | Chart "Altas por día": line chart, one series "Altas", by day (Shared S-7: legend not shown for one series) | chart | LineChart.tsx | `adminSummary.signUpsChart`, `adminSummary.signUpsSeries`, `adminConsole.day` | always |
| 24 | Its empty message "Nadie se ha registrado en este periodo." | status | ChartFrame.tsx | `adminSummary.signUpsEmpty` | no sign-ups in the period |
| 25 | Chart "Generaciones por día": stacked columns by day, series "Terminadas" (success tone), "Fallidas" (failure tone), "En cola o en curso" (neutral; queued + running), legend, data table with a "Total" column | chart | ColumnChart.tsx | `adminSummary.generationsChart`, `adminSummary.outcomes.succeeded`, `.failed`, `.pending`, `adminSummary.total` | always |
| 26 | Its empty message "Ninguna generación en este periodo." | status | ChartFrame.tsx | `adminSummary.generationsEmpty` | no generations |
| 27 | "Ver datos" disclosure on each chart (Shared S-7.6) | toggle | ChartFrame.tsx | `adminConsole.dataLabel` | charts not empty |
| 28 | "Cómo se cuenta" fold, 7 notes (the first is shared by the other pages; the activity note and the text-AI note carry the recording date `{date}` = 29 September 2026 formatted for the locale) (Shared S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminSummary.howCounted[0..6]` | always |

## /admin/cuentas  (apps/web/src/app/(admin)/admin/cuentas/page.tsx)

Admin. 404 if `/admin/accounts` answers nothing. Document title `pages['/admin/cuentas'].title`. The sign-ups chart is skipped if `/admin/people` fails. The premium action is skipped if `/admin/settings` does not return the premium flag.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Cuentas" and intro (Shared S-1) | heading + text | cuentas/page.tsx | `adminAccounts.title`, `adminAccounts.intro` | always |
| 2 | Period selector (Shared S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Section "Altas" (Shared S-3) | heading | AdminSection.tsx | `adminAccounts.signUpsTitle` | when `/admin/people` answered |
| 4 | Chart "Altas por semana": column chart by week, one series "Altas"; first column header "Semana (desde el lunes)" | chart | ColumnChart.tsx | `adminAccounts.signUpsChart`, `.signUpsSeries`, `adminConsole.week` | same |
| 5 | Empty message "Nadie se ha registrado en este periodo." | status | ChartFrame.tsx | `adminAccounts.signUpsEmpty` | no sign-ups |
| 6 | Section "Todas las cuentas" (Shared S-3) | heading | AdminSection.tsx | `adminAccounts.tableTitle` | always |
| 7 | Toolbar "Buscar y filtrar" with search field "Buscar por correo" (Shared S-5.1, S-5.3) | field | AdminTable.tsx | `adminAccounts.search`, `adminConsole.table.toolbar` | always |
| 8 | Filters fold "Filtros (n activos)" (six filters, so it folds; open when any is on) (S-5.6) | toggle | AdminFilters.tsx | `adminConsole.table.filters`, `.filtersActive`, `.filtersActiveOne` | always |
| 9 | Filter "Correo confirmado": Cualquiera / Sí / No | select | AdminFilter.tsx | `adminAccounts.columns.confirmed`, `adminConsole.table.any`, `adminConsole.yes`, `.no` | always |
| 10 | Filter "Abierta": Cualquiera / Sí / No | select | AdminFilter.tsx | `adminAccounts.columns.activated` | always |
| 11 | Filter "Nivel": Cualquiera / Gratis / Premium | select | AdminFilter.tsx | `adminAccounts.columns.tier`, `adminAccounts.tiers.free`, `.premium` | always |
| 12 | Filter "Rol": Cualquiera / Usuario / Admin | select | AdminFilter.tsx | `adminAccounts.columns.role`, `adminAccounts.roles.user`, `.admin` | always |
| 13 | Filter "Profesional": Cualquiera / Sí / No | select | AdminFilter.tsx | `adminAccounts.columns.professional` | always |
| 14 | Filter "Perfil terminado": Cualquiera / Sí / No | select | AdminFilter.tsx | `adminAccounts.columns.onboarded` | always |
| 15 | Page size select "Por página", button "Aplicar", hidden carried parameters (S-5.7, S-5.8, S-5.9) | select + button | AdminTable.tsx | `adminConsole.table.pageSize`, `.apply` | always |
| 16 | Status line "{n} en total · por {orden}, {dirección}"; order names: fecha de alta, correo, última actividad, número de planes (S-5.10) | status | AdminTableStatus.tsx | `adminConsole.table.status`, `adminAccounts.sortBy.*` | always |
| 17 | Table "Cuentas" (hidden caption), columns: Correo (sortable, first asc), Alta (sortable, first desc), Correo confirmado, Abierta, Nivel, Rol, Perfil terminado, Planes (sortable, right-aligned, first desc), Última actividad (sortable, first desc), Profesional, Acciones | table | DataTable.tsx | `adminAccounts.caption`, `adminAccounts.columns.email`, `.created`, `.confirmed`, `.activated`, `.tier`, `.role`, `.onboarded`, `.plans`, `.lastActive`, `.professional`, `.actions` | always |
| 18 | Cell: email address (not from the dictionary) | text | cuentas/page.tsx | not from the dictionary | per row |
| 19 | Cells: sign-up date; "Sí"/"No" for confirmed, activated, professional (the "No" ones styled off); tier "Gratis"/"Premium"; role "Usuario"/"Admin"; onboarded date or "—"; plan count; last-activity date or "—" | text | cuentas/page.tsx | `adminAccounts.tiers.*`, `.roles.*`, `adminConsole.yes/no` | per row |
| 20 | Empty state "No hay ninguna cuenta todavía." | status | AdminTable.tsx | `adminAccounts.empty` | no account, no filter |
| 21 | No-match state "Ninguna cuenta coincide con la búsqueda o los filtros." + link "Quitar la búsqueda y los filtros" | status + link | AdminTable.tsx | `adminAccounts.noMatch`, `adminConsole.table.clear` | filters/search on and no row |
| 22 | Pager Anterior / range / Siguiente (S-5.15) | list | AdminPager.tsx | `adminConsole.table.*` | more than one page |
| 23 | Row action "Abrir cuenta" (primary, small; aria-label "Abrir cuenta: {email}"), sends activation; loading state | button | components/AccountActions/AccountActions.tsx | `adminAccounts.activate`, `adminAccounts.activateFor` | account is not activated |
| 24 | Row action "Dar premium" / "Pasar a gratis" (secondary, small; aria-label "Dar premium: {email}" / "Pasar a gratis: {email}"); changes the tier; loading state | button | AccountActions.tsx | `adminAccounts.makePremium`, `.makePremiumFor`, `.makeFree`, `.makeFreeFor` | only when the premium switch (Ajustes) is on |
| 25 | Row action "Hacer profesional" (secondary, small; aria-label "Hacer profesional: {email}") opens the grant dialog | button | AccountActions.tsx | `adminAccounts.makeProfessional`, `.makeProfessionalFor` | account is not a professional |
| 26 | Grant dialog titled "Hacer profesional: {email}" | dialog | AccountActions.tsx (`ui/components/Dialog`) | `adminAccounts.makeProfessionalFor` | dialog open |
| 27 | Field "Número de colegiado" (required, autocomplete off) with hint "Letras, números, / o -, como aparece en su colegio. Compruébalo antes de conceder." | field | AccountActions.tsx (`ui/components/Input`) | `adminAccounts.professionalCollegiate`, `.professionalCollegiateHint` | dialog open |
| 28 | Validation message on the field "Ese número no vale: tiene que tener de 3 a 20 letras, números, / o -, sin espacios." (client pattern `^[A-Za-z0-9/-]{3,20}$`, and the API's INVALID_INPUT); focuses and selects the field | notice | AccountActions.tsx | `adminAccounts.professionalCollegiateInvalid` | invalid number submitted |
| 29 | Request failure line under the field (message from `errors.*` for the API code) | notice | AccountActions.tsx | `errors.*` via `messageFor` | grant failed for another reason |
| 30 | Hidden `role=alert` line repeating the current error so it is announced | notice | AccountActions.tsx | as 28/29 | always in the dialog |
| 31 | Dialog button "Conceder" (submit, loading state) | button | AccountActions.tsx | `adminAccounts.professionalGrant` | dialog open |
| 32 | Dialog button "Cancelar" (secondary; disabled while granting) | button | AccountActions.tsx | `common.cancel` | dialog open |
| 33 | Row-level failure line (activate / tier change) | notice | AccountActions.tsx | `errors.*` via `messageFor` | request failed |
| 34 | Second-factor line when a removal is pending: "Segundo factor: se quita a partir del {date}" (date with hour, Madrid time) | text | components/TwoFactorRemoval/TwoFactorRemoval.tsx | `adminAccounts.twoFactorRemoval.pending` | a removal is scheduled |
| 35 | Button "Cancelar" (secondary; aria-label "Cancelar la retirada del segundo factor: {email}") cancels the pending removal | button | TwoFactorRemoval.tsx | `adminAccounts.twoFactorRemoval.cancel`, `.cancelFor` | a removal is scheduled |
| 36 | Button "Quitar el segundo factor" (secondary; aria-label "Quitar el segundo factor: {email}") opens the confirmation | button | TwoFactorRemoval.tsx | `adminAccounts.twoFactorRemoval.remove`, `.removeFor` | the account has the second factor on and no removal pending |
| 37 | Confirmation dialog titled "Quitar el segundo factor de {email}" with body "Se quita entre 48 y 72 horas después de ahora. Le escribimos a esta dirección en este momento: si no lo ha pedido, le basta con entrar con su código para cancelarlo." | dialog | TwoFactorRemoval.tsx | `adminAccounts.twoFactorRemoval.title`, `.body` | dialog open |
| 38 | Dialog buttons: "Cancelar" (first, secondary; the dialog opens on it so two Enters never confirm) and "Programar la retirada" (destructive, loading state) | button | TwoFactorRemoval.tsx | `common.cancel`, `adminAccounts.twoFactorRemoval.confirm` | dialog open |
| 39 | Dialog failure line (alert) | notice | TwoFactorRemoval.tsx | `errors.*` via `messageFor` | request failed (other than 38/40) |
| 40 | Row line after a stale request: "Ya había una retirada pendiente para esta cuenta: la fecha está en su fila." / "Esta cuenta ya no tiene el segundo factor activado." (the dialog closes and the row is read again) | notice | TwoFactorRemoval.tsx | `errors.twoFactorRemovalPending`, `errors.twoFactorNotEnabled` | API says removal pending / not enabled |
| 41 | Row line "Ya no había ninguna retirada pendiente: puede que la persona la haya cancelado al entrar con su código." | notice | TwoFactorRemoval.tsx | `adminAccounts.twoFactorRemoval.notPending` | cancelling found nothing pending |
| 42 | Row failure line for cancelling | notice | TwoFactorRemoval.tsx | `errors.*` via `messageFor` | cancel failed |
| 43 | "Cómo se cuenta" fold with 4 notes (weeks start Monday Madrid time; Abierta; Última actividad with `{date}`; Planes) (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminAccounts.howCounted[0..3]` | always |

## /admin/profesionales  (apps/web/src/app/(admin)/admin/profesionales/page.tsx)

Admin. 404 if the read fails. Not paged (few rows), no period.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Profesionales" and intro "Cada profesional con sus vínculos contados. Aquí no aparece ningún paciente. Se concede desde Cuentas." (S-1) | heading + text | profesionales/page.tsx | `adminProfessionals.title`, `.intro` | always |
| 2 | Toolbar "Buscar y filtrar" with search "Buscar por correo" and button "Aplicar" (no filters, no page size) | field + button | AdminTable.tsx | `adminProfessionals.search`, `adminConsole.table.toolbar`, `.apply` | always |
| 3 | Status line "{n} en total · por {orden}, {dirección}"; order names: correo, fecha de concesión, número de vínculos | status | AdminTableStatus.tsx | `adminConsole.table.status`, `adminProfessionals.sortBy.*` | always |
| 4 | Table "Profesionales", columns: Correo (sortable, first asc), Nº de colegiado, Desde (sortable, first desc), Vínculos (sortable, first desc), Acción | table | DataTable.tsx | `adminProfessionals.caption`, `.columns.email`, `.collegiate`, `.granted`, `.links`, `.actions` | always |
| 5 | Cells: email; collegiate number (not from the dictionary); grant date; "{n} activos · {n} en pausa · {n} terminados" | text | profesionales/page.tsx | `adminProfessionals.links` | per row |
| 6 | Empty state "Todavía no hay ningún profesional." | status | AdminTable.tsx | `adminProfessionals.empty` | no professionals |
| 7 | No-match state "Ningún profesional coincide con la búsqueda." + "Quitar la búsqueda y los filtros" | status + link | AdminTable.tsx | `adminProfessionals.noMatch`, `adminConsole.table.clear` | search on and no row |
| 8 | Row action "Retirar" (secondary, small; aria-label "Retirar: concesión de {email}") opens confirmation | button | components/ProfessionalRevoke/ProfessionalRevoke.tsx | `adminProfessionals.revoke`, `.revokeFor` | per row |
| 9 | Confirmation dialog "¿Retirar a {email} como profesional?" with body "Pierde el acceso a su consulta y sus invitaciones sin responder se anulan." | dialog | ProfessionalRevoke.tsx | `adminProfessionals.revokeTitle`, `.revokeBody` | dialog open |
| 10 | Dialog buttons "Cancelar" (first, secondary; focus starts there) and "Sí, retirar" (destructive, loading) | button | ProfessionalRevoke.tsx | `common.cancel`, `adminProfessionals.revokeConfirm` | dialog open |
| 11 | Dialog error line (alert; always present, empty when no error) | notice | ProfessionalRevoke.tsx | `errors.*` via `messageFor` | revoke failed |
| 12 | No "Cómo se cuenta" fold on this page | (absence) | profesionales/page.tsx | n/a | n/a |

## /admin/consentimientos  (apps/web/src/app/(admin)/admin/consentimientos/page.tsx)

Admin. 404 if the read fails. No period, no table toolbar.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Consentimientos" and intro "Qué versión de cada consentimiento está en vigor y cuántas cuentas la tienen." (S-1) | heading + text | consentimientos/page.tsx | `adminConsents.title`, `.intro` | always |
| 2 | Tile list "Cifras de los consentimientos" with one tile "Perfil terminado con la versión vigente": count and note "{holding} de {total} cuentas con el perfil terminado." | figure | StatTile.tsx | `adminConsents.tilesLabel`, `.onboarded`, `.onboardedNote` | always |
| 3 | Section "Consentimientos por versión" (S-3) | heading | AdminSection.tsx | `adminConsents.caption` | always |
| 4 | Table (plain `DataTable`, no toolbar/sort/pager), columns: Consentimiento, Versión vigente, Con la vigente (right), Con una anterior (right), Versiones en uso | table | DataTable.tsx | `adminConsents.columns.consent`, `.version`, `.current`, `.older`, `.versions` | always |
| 5 | Row names: "Vínculo con un profesional", "Datos de salud", "Acuerdo del profesional", "Perfil", "Condiciones de uso" (one row per consent key the API returns) | text | consentimientos/page.tsx | `adminConsents.consents.care`, `.health`, `.professional`, `.profile`, `.terms` | per row |
| 6 | Cells: current version (data), counts, and the versions-in-use cell "{version}: {n}" joined with " · " or "—"; a null version reads "Sin registro" for terms and "sin aceptar" for the others | text | consentimientos/page.tsx | `adminConsents.versionOf`, `.unrecorded`, `.unaccepted` | per row |
| 7 | Empty state "Ninguna cuenta ha aceptado todavía." | status | DataTable.tsx | `adminConsents.empty` | no rows |
| 8 | "Cómo se cuenta" fold, 4 notes (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminConsents.howCounted[0..3]` | always |

## /admin/personas/retencion  (apps/web/src/app/(admin)/admin/personas/retencion/page.tsx)

Admin. 404 if `/admin/retention` answers nothing. No period selector, no links or ids from any cell. Document title `pages['/admin/personas/retencion'].title`. The two tables are `AdminReflowTable` (`apps/web/src/components/AdminReflowTable/AdminReflowTable.tsx`): a wide table on a wide screen and, on a narrow one, a list of cards (title = cohort name, then a definition list "column header: value" for each other column). Both drawings carry the same content; a redesign must keep both forms or an equivalent.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Retención" and intro "Cuánta gente sigue activa una, dos y cuatro semanas después de registrarse." (S-1) | heading + text | retencion/page.tsx | `adminRetention.title`, `.intro` | always |
| 2 | Line "Un guion (—) es una celda sin cifra: o hay menos de {min} personas evaluables, o esa semana aún no ha pasado." | text | retencion/page.tsx | `adminRetention.hidden` | always |
| 3 | Section "Hizo algo (aproximada)" with note "Alguien con una comida completada, un cambio de plato, un check-in o una medida de progreso esa semana. Es aproximada: quien solo abre la app no cuenta." (S-3) | heading + text | AdminSection.tsx | `adminRetention.didTitle`, `.didNote` | always |
| 4 | Table "Cohortes que hicieron algo" (hidden caption; narrow form is a list with the same name): columns Cohorte, Personas (right), Semana 1, Semana 2, Semana 4 (right, one per week the API returns) | table / list | AdminReflowTable.tsx, DataTable.tsx | `adminRetention.didTable`, `.cohort`, `.size`, `.week` | always |
| 5 | Section "Usó la app" with note "Alguien que entró o usó la app esa semana. Solo cuenta a quien se registró desde el {since}; las columnas se van llenando desde el {from}." (dates 29 Sep 2026 and 6 Oct 2026 formatted for the locale) | heading + text | AdminSection.tsx | `adminRetention.usedTitle`, `.usedNote` | always |
| 6 | Table "Cohortes que usaron la app", same columns | table / list | AdminReflowTable.tsx | `adminRetention.usedTable`, `.cohort`, `.size`, `.week` | always |
| 7 | Cohort cell: month and year of sign-up (for example "octubre de 2026"), derived from the date | text | retencion/page.tsx | not from the dictionary (date) | per row |
| 8 | Size cell: number of people, or "—" with hidden text "Sin cifra: menos de {min} personas evaluables" | figure | retencion/page.tsx | `adminRetention.tooFew` | per row |
| 9 | Week cell: "{active} / {eligible}", plus " · {percent}" when the cohort has at least the minimum eligible people; "—" with hidden text "Sin cifra: esa semana aún no ha pasado" when nobody is eligible yet; "—" with hidden text "Sin cifra: menos de {min} personas evaluables" when below the floor | figure | retencion/page.tsx | `adminRetention.notYet`, `.tooFew` | per cell |
| 10 | Empty state "Nadie se ha registrado en estas cohortes." (shown when every cohort has size 0, in either table) | status | AdminReflowTable.tsx | `adminRetention.empty` | no cohort with people |
| 11 | "Cómo se cuenta" fold, 5 notes (cohort = sign-up month; weeks 1/2/4; minimum people; two readings count different people; no links or names) with `{min}` and `{since}` filled (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminRetention.howCounted[0..4]` | always |

## /admin/buzon  (apps/web/src/app/(admin)/admin/buzon/page.tsx)

Admin. 404 if `/admin/feedback` answers nothing. Chart skipped if `/admin/people` fails.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Buzón" and intro "Lo que la gente te escribe, tal como lo escribió." (S-1) | heading + text | buzon/page.tsx | `adminInbox.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Section "Mensajes" (S-3) | heading | AdminSection.tsx | `adminInbox.messagesTitle` | when `/admin/people` answered |
| 4 | Chart "Mensajes por semana": column chart, one series "Mensajes"; week header "Semana (desde el lunes)" | chart | ColumnChart.tsx | `adminInbox.messagesChart`, `.messagesSeries`, `adminConsole.week` | same |
| 5 | Empty message "Nadie ha escrito en este periodo." | status | ChartFrame.tsx | `adminInbox.messagesEmpty` | no messages |
| 6 | Section "Todos los mensajes" with note "{n} sin ver" (count of unseen messages of any date) | heading + text | AdminSection.tsx | `adminInbox.tableTitle`, `adminInbox.waiting` | always |
| 7 | Toolbar with search "Buscar en el mensaje o el correo" | field | AdminTable.tsx | `adminInbox.search`, `adminConsole.table.toolbar` | always |
| 8 | Filter "Estado": Todos (default, sends nothing) / Sin ver / Vistos (one filter, so it stays in the toolbar, no fold) | select | AdminFilter.tsx | `adminInbox.state`, `adminInbox.states.all`, `.waiting`, `.seen` | always |
| 9 | Page size, "Aplicar", status line "{n} en total · por fecha, {dirección}" | select + button + status | AdminTable.tsx | `adminConsole.table.*`, `adminInbox.sortBy.createdAt` | always |
| 10 | Table "Mensajes", columns: Fecha (sortable, first desc), Quién, Tipo, Mensaje, Estado, Acción | table | DataTable.tsx | `adminInbox.caption`, `.columns.date`, `.sender`, `.kind`, `.message`, `.state`, `.actions` | always |
| 11 | Cell: date; sender email (not from the dictionary); kind label "Una idea" / "Algo falla" / "Otra cosa" (falls back to the raw kind code); message exactly as typed, wrapped, never cut (not from the dictionary) | text | buzon/page.tsx | `feedback.kinds.idea`, `.problem`, `.other` | per row |
| 12 | Cell state: "Visto" or highlighted "Sin ver" | status | buzon/page.tsx | `adminInbox.seenState`, `adminInbox.waitingState` | per row |
| 13 | Row action "Marcar como visto" (secondary, small; aria-label "Marcar como visto: mensaje de {email}") for an unseen message; becomes "Volver a abrir" (aria-label "Volver a abrir: mensaje de {email}") for a seen one; loading state | button | components/FeedbackToggle/FeedbackToggle.tsx | `adminInbox.handled`, `.handledFor`, `.reopen`, `.reopenFor` | per row |
| 14 | Row failure line (alert) | notice | FeedbackToggle.tsx | `errors.*` via `messageFor` | request failed |
| 15 | Empty state "Nadie ha escrito todavía." | status | AdminTable.tsx | `adminInbox.empty` | no messages, no filter |
| 16 | No-match state "Ningún mensaje coincide con la búsqueda o el filtro." + "Quitar la búsqueda y los filtros" | status + link | AdminTable.tsx | `adminInbox.noMatch`, `adminConsole.table.clear` | search/filter on and no row |
| 17 | Pager (S-5.15) | list | AdminPager.tsx | `adminConsole.table.*` | more than one page |
| 18 | "Cómo se cuenta" fold, 2 notes (weeks; "Sin ver" counts all unmarked messages of any date) (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminInbox.howCounted[0..1]` | always |

## /admin/producto  (apps/web/src/app/(admin)/admin/producto/page.tsx)

Admin. 404 if `/admin/product` answers nothing. Document title `pages['/admin/producto'].title` ("Embudo y actividad").

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Embudo y actividad" and intro "Hasta dónde llega la gente y qué hace cada día." (S-1) | heading + text | producto/page.tsx | `adminProduct.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Section "Embudo" with note "Desde la primera cuenta: no cambia con el periodo." (S-3) | heading + text | AdminSection.tsx | `adminProduct.funnelTitle`, `.funnelNote` | always |
| 4 | Chart "Personas en cada paso": horizontal bar chart, eight bars in this order, each with count and share of the step above ("· 82 %"): Se han registrado, Correo confirmado, Cuenta abierta, Perfil terminado, Tienen un plan, Han marcado alguna comida, Han hecho el check-in, Han vuelto a por un segundo plan; data table headed "Paso" with a "Del paso anterior" share column | chart | BarChart.tsx | `adminProduct.funnelChart`, `.funnelSeries`, `.funnelStep`, `.funnelShare`, `admin.funnel.signedUp`, `.confirmed`, `.activated`, `.onboarded`, `.planned`, `.lived`, `.checkedIn`, `.returned` | always |
| 5 | Empty message "Nadie se ha registrado todavía." | status | ChartFrame.tsx | `adminProduct.funnelEmpty` | no sign-ups ever |
| 6 | Section "Actividad" (S-3) | heading | AdminSection.tsx | `adminProduct.activityTitle` | always |
| 7 | Chart "Personas activas por día": line chart, one series "Personas" | chart | LineChart.tsx | `adminProduct.activeChart`, `.activeSeries`, `adminConsole.day` | always |
| 8 | Empty message "Nadie ha entrado en este periodo." | status | ChartFrame.tsx | `adminProduct.activeEmpty` | nobody active |
| 9 | Chart "Eventos por día": line chart, series (colour pinned per event) "Entradas" (tone 1), "Cambios de comida pedidos" (tone 2), "Usaron la app" (tone 3); legend | chart | LineChart.tsx | `adminProduct.eventsChart`, `admin.events.session_started`, `.swap_requested`, `.app_used` | always (an unknown event key shows its raw key) |
| 10 | Empty message "Ningún evento en este periodo." | status | ChartFrame.tsx | `adminProduct.eventsEmpty` | no events |
| 11 | "Cómo se cuenta" fold, 3 notes (funnel counted from state; active per day; events; `{date}` = 29 Sep 2026) (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminProduct.howCounted[0..2]` | always |

## /admin/producto/planes  (apps/web/src/app/(admin)/admin/producto/planes/page.tsx)

Admin. 404 if `/admin/plans` answers nothing.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Planes" and intro "En qué estado están los planes y cuántos se crean cada día." (S-1) | heading + text | planes/page.tsx | `adminPlans.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Section "Estado actual" with note "Todos los planes, de cualquier fecha: no cambia con el periodo." (S-3) | heading + text | AdminSection.tsx | `adminPlans.byStateTitle`, `.byStateNote` | always |
| 4 | Chart "Planes por estado": donut, one slice per state present, legend of "state · count · share", data table headed "Estado" with a "Parte" column. States and pinned tones: Activo (1), Terminado (2), Generándose (3), Borrador (4), Archivado (5), Pendiente de revisión (6), Programado (6), Fallido (failure tone) | chart | DonutChart.tsx | `adminPlans.byStateChart`, `.state`, `.share`, `.series`, `adminPlans.states.active`, `.completed`, `.generating`, `.draft`, `.archived`, `.pending_review`, `.scheduled`, `.failed` | always (unknown status shows its raw code) |
| 5 | Empty message "Todavía no hay ningún plan." | status | ChartFrame.tsx | `adminPlans.byStateEmpty` | no plans |
| 6 | Section "En el periodo" (S-3) | heading | AdminSection.tsx | `adminPlans.createdTitle` | always |
| 7 | Chart "Planes creados por día": column chart, series "Planes" | chart | ColumnChart.tsx | `adminPlans.createdChart`, `.series`, `adminConsole.day` | always |
| 8 | Empty message "No se ha creado ningún plan en este periodo." | status | ChartFrame.tsx | `adminPlans.createdEmpty` | none created |
| 9 | "Cómo se cuenta" fold, 2 notes (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminPlans.howCounted[0..1]` | always |

## /admin/producto/planes/calidad  (apps/web/src/app/(admin)/admin/producto/planes/calidad/page.tsx)

Admin. 404 if `/admin/plans/quality` answers nothing. Two shapes: the "few data" shape when fewer plans than the API's minimum were made in the period (`fewData`), and the full shape. `{min}` is the API's `minPlans`.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Calidad de los planes" and intro "Cuántos días de los planes cumplen la banda, en qué macros fallan y cuánto costó entregarlos." (S-1) | heading + text | calidad/page.tsx | `adminPlanQuality.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Section "Planes del periodo" with note: "Datos desde el {date}." (or "Todavía no hay ningún plan con la calidad registrada." when the API has no data start) followed by "El periodo termina ayer: los planes de hoy no entran." (S-3) | heading + text | AdminSection.tsx | `adminPlanQuality.tilesLabel`, `.dataSince`, `.noData`, `.untilYesterday` | always |
| 4 | Tile list "Planes del periodo": "Planes puntuados" count; "Planes sin calidad registrada" count with note "Hechos antes de registrar la calidad: no entran en las cifras." | figure | StatTile.tsx | `adminPlanQuality.tiles.plans`, `.tiles.withoutQuality`, `.withoutQualityNote` | always |
| 5 | Card "Pocos datos: {plans} planes en el periodo; hacen falta {min} para mostrar cifras." (replaces everything below this row, except the fold) | notice | calidad/page.tsx | `adminPlanQuality.few` | `fewData` |
| 6 | Section "Días dentro de la banda" with note "Un día está dentro de la banda cuando sus cuatro macros quedan a ±5 % de su objetivo." (S-3) | heading + text | AdminSection.tsx | `adminPlanQuality.bandTitle`, `.bandNote` | full shape |
| 7 | Count list named "Porcentaje de días dentro de la banda" (S-8, rows are not links): "Los cuatro macros a la vez" (percent, "{n} de {days} días"), "Calorías", "Proteína", "Hidratos", "Grasas" (each percent with "{n} de {days} días"), "Días de evento dentro de su banda" (percent, "{n} de {event days} días") | list | components/AdminCountList/AdminCountList.tsx | `adminPlanQuality.bandLabel`, `.inBandAll`, `.macros.kcal`, `.macros.protein`, `.macros.carbs`, `.macros.fat`, `.eventDays`, `.daysOf` | full shape |
| 8 | Section "Cómo se entregaron" with note "Cuántas veces hizo falta salir de lo previsto para armar los planes." (S-3) | heading + text | AdminSection.tsx | `adminPlanQuality.deliveryTitle`, `.deliveryNote` | full shape |
| 9 | Count list named "Veces que hizo falta salir de lo previsto": "Con toda la biblioteca", "Con una rotación más amplia" (one row per fallback kind returned), "Cargas de evento rechazadas" | list | AdminCountList.tsx | `adminPlanQuality.deliveryLabel`, `.fallbacks.full_library`, `.fallbacks.wider_rotation`, `.loadsRefused` | full shape |
| 10 | Section "Avisos por tipo" with note "Avisos con los que salieron los planes; ninguno impidió entregarlos." (S-3) | heading + text | AdminSection.tsx | `adminPlanQuality.advisoriesTitle`, `.advisoriesNote` | full shape |
| 11 | Count list named "Número de planes con cada aviso": one row per advisory kind returned: "Hidratos fuera de la banda", "Grasas fuera de la banda", "Calorías fuera de la banda", "Proteína por encima del objetivo", "Proteína por debajo del objetivo", "Variedad" (unknown kind shows the raw code). No empty text: with no advisories the card is an empty list | list | AdminCountList.tsx | `adminPlanQuality.advisoriesLabel`, `.advisoryKinds.*` | full shape |
| 12 | Section "Suelo de energía" with note "Se registra desde el {date}." (S-3) | heading + text | AdminSection.tsx | `adminPlanQuality.floorTitle`, `.floorSince` | full shape (note only when a start date exists) |
| 13 | Paragraph, one of: "Ningún plan del periodo registra todavía este dato." / "Ningún día del periodo tuvo la banda estrechada por el suelo." / "Días con la banda estrechada por el suelo: {days}. Fuera de banda: {narrowed}, frente a {rest} en el resto." / the same without the comparison ("... Fuera de banda: {narrowed}.") | text | calidad/page.tsx | `adminPlanQuality.floorNoData`, `.floorNone`, `.floorLine`, `.floorLineAlone` | full shape |
| 14 | Caution under it "No dice que el suelo causara un fallo: cuenta los días fuera de banda en cualquier macro, sea cual sea el motivo." | text | calidad/page.tsx | `adminPlanQuality.floorCaution` | full shape |
| 15 | "Cómo se cuenta" fold, 5 notes (with `{min}`) (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminPlanQuality.howCounted[0..4]` | always |

## /admin/notificaciones  (apps/web/src/app/(admin)/admin/notificaciones/page.tsx)

Admin. 404 if `/admin/notifications` answers nothing.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Notificaciones" and intro "A quién se puede avisar, cuántos avisos salen por canal y cuánta gente hace el check-in después." (S-1) | heading + text | notificaciones/page.tsx | `adminNotifications.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Tile list "Cifras de las notificaciones": "Suscripciones push", "Personas con push", "Personas avisadas", "Hicieron el check-in en 3 días" | figure | StatTile.tsx | `adminNotifications.tilesLabel`, `.subscriptions`, `.people`, `.reminded`, `.answered` | always |
| 4 | Note on the last tile "{share} de quienes recibieron un aviso." | text | StatTile.tsx | `adminNotifications.answeredNote` | at least one person was reminded |
| 5 | Section "Avisos" (S-3) | heading | AdminSection.tsx | `adminNotifications.remindersTitle` | always |
| 6 | Chart "Avisos por semana": column chart by week, one series per channel with pinned tones: "Correo" (1), "Push" (2); legend; week header | chart | ColumnChart.tsx | `adminNotifications.remindersChart`, `.remindersChannels.email`, `.remindersChannels.push`, `adminConsole.week` | always |
| 7 | Empty message "No salió ningún aviso en este periodo." | status | ChartFrame.tsx | `adminNotifications.remindersEmpty` | no reminders |
| 8 | "Cómo se cuenta" fold, 4 notes (`{date}` = 29 Sep 2026) (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminNotifications.howCounted[0..3]` | always |

## /admin/generacion  (apps/web/src/app/(admin)/admin/generacion/page.tsx)

Admin. 404 if `/admin/generations` answers nothing. The charts and the failures section are skipped if `/admin/generations/stats` fails. Document title `pages['/admin/generacion'].title` ("Registro"). The summary page's "needs you" row links here with `?status=failed&since=24h`.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Registro" and intro "Cada generación de un plan: cómo terminó, cuánto tardó y cada llamada al modelo." (S-1) | heading + text | generacion/page.tsx | `adminLog.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Section "En el periodo" (S-3) | heading | AdminSection.tsx | `adminLog.chartsTitle` | stats available |
| 4 | Chart "Generaciones por día": stacked columns, series "Terminadas" (success), "Fallidas" (failure), "En cola o en curso" (neutral); legend; data table with "Total" column; day header "Día" | chart | ColumnChart.tsx | `adminLog.outcomesChart`, `adminSummary.outcomes.succeeded`, `.failed`, `.pending`, `adminSummary.total`, `adminConsole.day` | stats available |
| 5 | Empty message "Ninguna generación en este periodo." | status | ChartFrame.tsx | `adminLog.outcomesEmpty` | none |
| 6 | Chart "Duración por día": line chart, series "Mediana" (tone 1) and "Percentil 95" (tone 2), values shown in seconds with one decimal ("4,2 s"), legend; days with no finished generation have no point | chart | LineChart.tsx | `adminLog.durationsChart`, `.p50`, `.p95`, `adminConsole.seconds` | stats available |
| 7 | Empty message "Ninguna generación terminó en este periodo." | status | ChartFrame.tsx | `adminLog.durationsEmpty` | no finished generation |
| 8 | Chart "Platos descartados por motivo": horizontal bar chart, one bar per reason (alérgeno, repetido, nombra algo que no lleva, sin electrodoméstico, demasiado tiempo, ración enorme, esquema, ingrediente inventado, dieta o gustos, idioma equivocado, comida equivocada; unknown reasons show their raw code), series "Platos", header "Motivo" | chart | BarChart.tsx | `adminLog.rejectionsChart`, `.rejectionsSeries`, `.reason`, `adminLog.rejection.allergen`, `.duplicate`, `.foreign_food`, `.missing_equipment`, `.over_time`, `.oversized`, `.schema`, `.unknown_ingredient`, `.unwanted`, `.wrong_language`, `.wrong_meal` | stats available |
| 9 | Empty message "Ningún plato descartado en este periodo." | status | ChartFrame.tsx | `adminLog.rejectionsEmpty` | none |
| 10 | Section "Fallos por motivo" with note "Generaciones fallidas del periodo, por el motivo que dejó el servicio. El código sin traducir sigue en la tabla y en el filtro." (S-3) | heading + text | AdminSection.tsx | `adminLog.failuresTitle`, `.failuresNote` | stats available |
| 11 | Count list named "Fallos por motivo" (S-8): one row per failure code, commonest first: label (translated code, see 29 for the ten texts, or "Sin código" when a failure left no code), count, chevron; a row with a code is a link to `/admin/generacion?code={code}&since={period}`; the "Sin código" row is not a link | list + link | components/AdminCountList/AdminCountList.tsx | `adminLog.failuresTitle`, `adminLog.codes.*`, `adminLog.noCode` | at least one failure |
| 12 | Card "Ninguna generación falló en este periodo." in place of the list | status | generacion/page.tsx | `adminLog.failuresEmpty` | no failures |
| 13 | Section "Todas las generaciones" with note "Las más recientes primero." (S-3) | heading + text | AdminSection.tsx | `adminLog.tableTitle`, `.tableNote` | always |
| 14 | Toolbar with search "Buscar por correo" | field | AdminTable.tsx | `adminLog.search`, `adminConsole.table.toolbar` | always |
| 15 | Filters fold "Filtros (n activos)" (five filters; open when any is on) (S-5.6) | toggle | AdminFilters.tsx | `adminConsole.table.filters*` | always |
| 16 | Filter "Estado": Cualquiera / Fallida / En cola / En curso / Terminada | select | AdminFilter.tsx | `adminLog.columns.status`, `adminLog.statuses.failed`, `.queued`, `.running`, `.succeeded`, `adminConsole.table.any` | always |
| 17 | Filter "Código": Cualquiera plus one option per code that happened in the period (label "translated text (CODE)", or the raw code if untranslated) and the one named in the address | select | AdminFilter.tsx | `adminLog.code`, `adminLog.codes.*` | always |
| 18 | Filter "Empezadas en": Cualquiera / Las últimas 24 horas / Los últimos 7 días / 30 días / 90 días | select | AdminFilter.tsx | `adminLog.since`, `.sinceDay`, `.sinceDays` | always |
| 19 | Filter "Desde el día" (native date field) | field | AdminTable.tsx (`ui/components/Input` type=date) | `adminLog.from` | always |
| 20 | Filter "Hasta el día" (native date field) | field | AdminTable.tsx | `adminLog.to` | always |
| 21 | Page size, "Aplicar", status line "{n} en total" (fixed order, no sorting) | select + button + status | AdminTable.tsx | `adminConsole.table.pageSize`, `.apply`, `.count` | always |
| 22 | Table "Generaciones", columns: Inicio, Estado, Cuenta, Segundos (right), Intentos (right), Plan, Código, Detalle, Llamadas al modelo (none sortable) | table | DataTable.tsx | `adminLog.caption`, `.columns.started`, `.status`, `.account`, `.seconds`, `.attempts`, `.plan`, `.code`, `.detail`, `.calls` | always |
| 23 | Cell Inicio: start date and time in Madrid time ("26 sept, 15:03") or "—" | text | generacion/page.tsx | not from the dictionary (date) | per row |
| 24 | Cell Estado: "Fallida", "En cola", "En curso", "Terminada" (unknown status shows its raw value) | status | generacion/page.tsx | `adminLog.statuses.*` | per row |
| 25 | Cell Cuenta: account email | text | generacion/page.tsx | not from the dictionary | per row |
| 26 | Cell Segundos and Intentos: numbers ("—" when unknown) | figure | generacion/page.tsx | not from the dictionary | per row |
| 27 | Cell Plan: "v{version} · {model} · prompt {prompt} · {reused} de la biblioteca" or "—" | text | generacion/page.tsx | `adminLog.logPlan` | per row |
| 28 | Cell Código: the translated code, and under it the raw code when the text is translated; or "—" | text | generacion/page.tsx | `adminLog.codes.*` | per row |
| 29 | The ten code texts: GENERATION_ABANDONED "Se quedó sin terminar y se dio por abandonada"; _AI_UNAVAILABLE "El modelo no respondió"; _FAILED "Error inesperado"; _INVALID_PLAN "El plan no pasó la validación"; _ONBOARDING_INCOMPLETE "La persona no había terminado el registro"; _POOL_TOO_SMALL "No había platos suficientes que cumplieran sus restricciones"; _PROFILE_CONSENT_REQUIRED "Faltaba el consentimiento para tratar sus datos de salud"; _PROFILE_INCOMPLETE "Faltaba parte del perfil"; _TIMED_OUT "Se agotó el tiempo"; _UNSAFE_CONTENT "Un plato no cumplía sus restricciones alimentarias" | text | generacion/page.tsx | `adminLog.codes.GENERATION_ABANDONED`, `.GENERATION_AI_UNAVAILABLE`, `.GENERATION_FAILED`, `.GENERATION_INVALID_PLAN`, `.GENERATION_ONBOARDING_INCOMPLETE`, `.GENERATION_POOL_TOO_SMALL`, `.GENERATION_PROFILE_CONSENT_REQUIRED`, `.GENERATION_PROFILE_INCOMPLETE`, `.GENERATION_TIMED_OUT`, `.GENERATION_UNSAFE_CONTENT` | wherever a code is shown (15, 17, 11, 28) |
| 30 | Cell Detalle: the service's own detail text, wrapped (not from the dictionary) or "—" | text | generacion/page.tsx | not from the dictionary | per row |
| 31 | Cell Llamadas al modelo: "Ninguna" when the generation made no model call | text | components/GenerationCalls/GenerationCalls.tsx | `adminLog.logNoCalls` | zero calls |
| 32 | Cell Llamadas al modelo: a fold "{n} llamadas" (native details with chevron) | toggle | GenerationCalls.tsx | `adminLog.logCalls` | one or more calls |
| 33 | Inside the fold, table "Llamadas al modelo de esta generación" (hidden caption), columns Comida, Modelo, Segundos (right), Resultado, Petición, Mensaje del proveedor | table | GenerationCalls.tsx | `adminLog.logCallsCaption`, `.logCallColumns.call`, `.model`, `.seconds`, `.result`, `.request`, `.error` | fold open |
| 34 | Call row, Comida: "{meal name}, ronda {n}" with the meal from the slots dictionary (Desayuno, Almuerzo, Comida, Merienda, Cena, Recena) | text | GenerationCalls.tsx | `adminLog.logCall`, `slots.breakfast`, `.morning_snack`, `.lunch`, `.afternoon_snack`, `.dinner`, `.supper` | per call |
| 35 | Call row, Modelo: answered model name (data), plus "(pedido: {model})" when the model that answered differs from the one asked, plus "· vía {provider}" | text | GenerationCalls.tsx | `adminLog.logCallAsked`, `.logCallVia` | per call |
| 36 | Call row, Segundos: seconds with one decimal or "—" | figure | GenerationCalls.tsx | not from the dictionary | per call |
| 37 | Call row, Resultado on success: "{in} / {out} tokens", optionally "({n} de razonamiento)", then "{kept} de {dishes} platos", then optionally "descartados: {reason n, ...}" | text | GenerationCalls.tsx | `adminLog.logCallTokens`, `.logCallReasoning`, `.logCallKept`, `.logCallDropped`, `.rejection.*` | call succeeded |
| 38 | Call row, Resultado on failure: "falló ({http status or —})", optionally "cuota: límite {limit}, reintentar en {n} s"; the cell is styled as failed | status | GenerationCalls.tsx | `adminLog.logCallFailed`, `.logCallQuota` | call failed |
| 39 | Call row, Petición: the gateway request id or "—" | text | GenerationCalls.tsx | not from the dictionary | per call |
| 40 | Call row, Mensaje del proveedor: the provider's error message (data) or "—" | text | GenerationCalls.tsx | not from the dictionary | per call |
| 41 | Empty state "Ninguna generación registrada todavía." | status | AdminTable.tsx | `adminLog.empty` | no generation, no filter |
| 42 | No-match state "Ninguna generación coincide con la búsqueda o los filtros." + "Quitar la búsqueda y los filtros" | status + link | AdminTable.tsx | `adminLog.noMatch`, `adminConsole.table.clear` | filter on and no row |
| 43 | Pager (S-5.15) | list | AdminPager.tsx | `adminConsole.table.*` | more than one page |
| 44 | "Cómo se cuenta" fold, 6 notes (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminLog.howCounted[0..5]` | always |

## /admin/generacion/ia  (apps/web/src/app/(admin)/admin/generacion/ia/page.tsx)

Admin. 404 if `/admin/ai` answers nothing. Three tables here (`DataTable`) show their caption visibly (no `hideCaption`); the table's section heading and the caption read alike. Money in US dollars (`formatUsd`).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "IA y modelos" and intro "Cuántas veces se llama a los modelos de texto, con cuántos tokens y cuánto cuesta." (S-1) | heading + text | ia/page.tsx | `adminAi.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Section "Este mes" with note "Desde el {date}, mes natural en UTC: no cambia con el periodo." (S-3) | heading + text | AdminSection.tsx | `adminAi.monthTitle`, `.monthNote` | always |
| 4 | Gauge "Gasto del mes contra el tope": spent vs cap in dollars, bar fill, data table headed "Este mes" with columns "Gastado" and "Tope del mes" | chart | Gauge.tsx | `adminAi.monthChart`, `.spent`, `.cap`, `.monthTitle` | the month has a cap |
| 5 | Over-the-cap warning inside the gauge "Por encima del tope" | notice | Gauge.tsx | `adminAi.over` | spent above cap |
| 6 | Gauge empty message "No hay ningún tope configurado." | status | ChartFrame.tsx | `adminAi.monthEmpty` | cap present but not usable (non-positive) |
| 7 | Without a cap: card with "Gasto de este mes: {spent}." and "No hay ningún tope configurado: el gasto se muestra, pero nada avisa cuando sube." | text | ia/page.tsx | `adminAi.monthSpent`, `.monthNoCap` | no cap |
| 8 | Warning "Aviso: el gasto supera el tope. La reescritura nocturna sigue pausada; los planes se siguen generando." (marked over) | notice | ia/page.tsx | `adminAi.warnOver` | share 100 % or more |
| 9 | Warning "Aviso: el gasto ya es el {share} del tope. La reescritura nocturna se ha pausado hasta el mes que viene; los planes se siguen generando." | notice | ia/page.tsx | `adminAi.warnSweep` | share under 100 % and the sweep is paused |
| 10 | Line "1 llamada sin coste: la cifra es un mínimo." / "{n} llamadas sin coste: la cifra es un mínimo." | text | ia/page.tsx | `adminAi.uncosted.one`, `.uncosted.many` | uncosted calls > 0 |
| 11 | Line "El tope solo avisa: nunca detiene un plan. El muro real es el tope de la propia clave de OpenRouter." | text | ia/page.tsx | `adminAi.monthOnlyOnWarns` | the month has a cap |
| 12 | Section "Asistente" with note "Aparte del gasto de arriba y con su propio tope: al llegar a él, el asistente deja de contestar hasta el mes que viene, y los planes y la reescritura nocturna siguen igual." (S-3) | heading + text | AdminSection.tsx | `adminAi.assistantTitle`, `.assistantNote` | always |
| 13 | Gauge "Gasto del asistente contra su tope" (spent vs cap, header "Asistente") | chart | Gauge.tsx | `adminAi.assistantChart`, `.spent`, `.cap`, `.assistantTitle` | assistant has a cap |
| 14 | Gauge empty message "El asistente no tiene tope configurado." | status | ChartFrame.tsx | `adminAi.assistantEmpty` | cap not usable |
| 15 | Without a cap: card with "Este mes: {n} llamadas al modelo (la etiqueta de cada pregunta y su respuesta), {spent} en total." and "Sin tope propio: el asistente no tiene dónde pararse este mes. Ponlo en AI_ASSISTANT_MONTHLY_CAP_USD." | text | ia/page.tsx | `adminAi.assistantCalls`, `.assistantNoCap` | no assistant cap |
| 16 | Warning "El asistente ha llegado a su tope: no contesta a nadie hasta el mes que viene." (marked over) | notice | ia/page.tsx | `adminAi.assistantOver` | assistant share 100 % or more |
| 17 | With a cap: the same calls line below the gauge | text | ia/page.tsx | `adminAi.assistantCalls` | assistant has a cap |
| 18 | Section "Últimos fallos" with note "Las últimas {n} llamadas al modelo que no sirvieron, sea cual sea el periodo. Solo el tipo de fallo: nunca la pregunta ni la respuesta." (S-3) | heading + text | AdminSection.tsx | `adminAi.assistantFailures.title`, `.note` | always |
| 19 | Table "Últimos fallos del asistente" (visible caption), columns Cuándo, Paso, Modelo, Motivo (not sortable, not paged) | table | DataTable.tsx | `adminAi.assistantFailures.caption`, `.columns.at`, `.step`, `.model`, `.reason` | always |
| 20 | Cells: date and time short in Madrid time; step "Responder" or "Clasificar la pregunta"; model name (data) or "—"; reason text (see 21) | text | ia/page.tsx | `adminAi.assistantFailures.steps.answer`, `.steps.label` | per row |
| 21 | Reason texts: "La persona cerró la pantalla antes de terminar"; "Respuesta cortada en el límite de longitud"; "El modelo contestó en un formato que no sirve"; "Anthropic rechazó o falló la llamada" followed by " ({status} {error type})" when known; "Sin respuesta dentro del tiempo"; "Sin motivo registrado (anterior a este registro)" followed by the code when known | text | ia/page.tsx | `adminAi.assistantFailures.reasons.abandoned`, `.cut`, `.invalid`, `.provider`, `.timeout`, `.unknown` | per row |
| 22 | Empty state "Ningún fallo registrado." | status | DataTable.tsx | `adminAi.assistantFailures.empty` | no failure |
| 23 | Section "Por función" with note on "Sin etiquetar" (calls before 29 September 2026) (S-3) | heading + text | AdminSection.tsx | `adminAi.featureTitle`, `.featureNote` | always |
| 24 | Chart "Gasto del mes por función": bar chart in dollars, bars Planes, Reescritura nocturna, Cambios de plato, Sin etiquetar; series "Coste"; header "Función" | chart | BarChart.tsx | `adminAi.featureChart`, `.features.plan`, `.rewrite`, `.swap`, `.unknown`, `.columns.cost`, `.featureColumn` | always |
| 25 | Empty message "Este mes no se ha facturado nada." (chart and table) | status | ChartFrame.tsx, DataTable.tsx | `adminAi.featureEmpty` | nothing billed |
| 26 | Table "Llamadas y gasto del mes por función" (visible caption), columns Función, Llamadas (right), Coste (right) | table | DataTable.tsx | `adminAi.featureTable`, `.featureColumn`, `.columns.calls`, `.columns.cost` | always |
| 27 | Tile list "Cifras del periodo" | list | ia/page.tsx | `adminAi.tilesLabel` | always |
| 28 | Tile "Llamadas al modelo": count, change (neutral colour), sparkline | figure | StatTile.tsx | `adminAi.calls`; `adminConsole.changeLabel` | always |
| 29 | Tile "Llamadas fallidas": count, change (good direction down) | figure | StatTile.tsx | `adminAi.failed`; `adminConsole.changeLabel` | always |
| 30 | Tile "Gasto en IA de texto": dollars, change (neutral), sparkline | figure | StatTile.tsx | `adminAi.spend`; `adminConsole.changeLabel` | always |
| 31 | Tile "Tiempo medio por llamada": seconds ("—" when no call measured its time) | figure | StatTile.tsx | `adminAi.averageMs` | always |
| 32 | Note on that tile "Periodo anterior: {seconds}" | text | StatTile.tsx | `adminAi.averageNote` | previous mean exists |
| 33 | Tile "Tokens de entrada": count, change (neutral) | figure | StatTile.tsx | `adminAi.inputTokens`; `adminConsole.changeLabel` | always |
| 34 | Tile "Tokens de salida": count, change (neutral) | figure | StatTile.tsx | `adminAi.outputTokens`; `adminConsole.changeLabel` | always |
| 35 | Section "Por día" (S-3) | heading | AdminSection.tsx | `adminAi.trendsTitle` | always |
| 36 | Chart "Llamadas por día": line chart, series "Llamadas" | chart | LineChart.tsx | `adminAi.callsChart`, `.callsSeries`, `adminConsole.day` | always |
| 37 | Empty message "Ninguna llamada al modelo en este periodo." | status | ChartFrame.tsx | `adminAi.callsEmpty` | none |
| 38 | Chart "Gasto por día": line chart in dollars, series "Gasto" | chart | LineChart.tsx | `adminAi.spendChart`, `.spendSeries` | always |
| 39 | Empty message "No se ha facturado nada en este periodo." | status | ChartFrame.tsx | `adminAi.spendEmpty` | none |
| 40 | Chart "Tokens por día": stacked columns, series "Entrada" (tone 1) and "Salida" (tone 2), legend, data table with "Total" column (spans two columns on wide screens) | chart | ColumnChart.tsx | `adminAi.tokensChart`, `.tokens.input`, `.tokens.output`, `adminSummary.total` | always |
| 41 | Empty message "Ningún token en este periodo." | status | ChartFrame.tsx | `adminAi.tokensEmpty` | none |
| 42 | Section "Por modelo" (S-3) | heading | AdminSection.tsx | `adminAi.modelsTitle` | always |
| 43 | Chart "Llamadas por modelo": bar chart, the ten most called models (label "model · provider") and one bar "Los demás ({n})" for the rest; series "Llamadas"; header "Modelo" | chart | BarChart.tsx | `adminAi.modelsChart`, `.columns.calls`, `.columns.model`, `.others` | always |
| 44 | Empty message "Ninguna llamada al modelo en este periodo." | status | ChartFrame.tsx, DataTable.tsx | `adminAi.modelsEmpty` | none |
| 45 | Table "Uso por modelo" (visible caption), columns Modelo, Llamadas, Fallidas, Media, Tokens de entrada, Tokens de salida, De razonamiento, Coste (all but the first right-aligned), one row for every model | table | DataTable.tsx | `adminAi.caption`, `.columns.model`, `.calls`, `.failed`, `.averageMs`, `.input`, `.output`, `.reasoning`, `.cost` | always |
| 46 | "Cómo se cuenta" fold, 5 notes (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminAi.howCounted[0..4]` | always |

## /admin/catalogo  (apps/web/src/app/(admin)/admin/catalogo/page.tsx)

Recetas. Admin. 404 if `/admin/catalogue/recipes` answers nothing. No period. The allergen catalogue (`/safety/allergens`) is read for names; if it fails, allergen keys are shown as they are and the allergen filter is empty. The catalogue names allergens in Spanish only (`lang="es"` is set on those spans and options so a screen reader on the English page reads them right).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Recetas" and intro "El catálogo de recetas: cuántas hay, para qué comida y de dónde vienen." (S-1; no period selector) | heading + text | catalogo/page.tsx | `adminRecipes.title`, `.intro` | always |
| 2 | Hidden polite status region used to announce a picture retry ("{dish}: Reintentando…", "{dish}: Dibujándose") | status | catalogo/page.tsx (id from `RetryPictureButton`) | `adminRecipes.retrying`, `.retryStarted` | after a retry is pressed |
| 3 | Tile list "Cifras del catálogo": "Recetas" (total), "Sin imagen", "Generadas por IA", "De la semilla", "Creadas por usuarios" (the three sources in this order) | figure | StatTile.tsx | `adminRecipes.tilesLabel`, `.tiles.total`, `.withoutImage`, `.ai`, `.seed`, `.user` | always |
| 4 | Section "Por comida" (S-3) | heading | AdminSection.tsx | `adminRecipes.bySlotTitle` | always |
| 5 | Chart "Recetas por comida": bar chart, one bar per meal (Desayuno, Almuerzo, Comida, Merienda, Cena, Recena), series "Recetas", header "Comida"; a recipe valid for two meals counts in both | chart | BarChart.tsx | `adminRecipes.bySlotChart`, `.bySlotSeries`, `.slot`, `slots.*` | always |
| 6 | Empty message "El catálogo no tiene ninguna receta." | status | ChartFrame.tsx | `adminRecipes.bySlotEmpty` | no recipes |
| 7 | Section "Todas las recetas" (S-3) | heading | AdminSection.tsx | `adminRecipes.tableTitle` | always |
| 8 | Toolbar with search "Buscar por nombre" | field | AdminTable.tsx | `adminRecipes.search`, `adminConsole.table.toolbar` | always |
| 9 | Filters fold "Filtros (n activos)" (six filters) | toggle | AdminFilters.tsx | `adminConsole.table.filters*` | always |
| 10 | Filter "Calidad": Cualquiera / Por encima del límite de una ración / Por encima del tope de su comida / Reescritura abandonada / Sin macros calculables / No encaja con ninguna comida | select | AdminFilter.tsx | `adminRecipes.check`, `.checks.over_bound`, `.over_cap`, `.refusal_limit`, `.uncosted`, `.unserved` | always |
| 11 | Filter "Comida": Cualquiera + six meals | select | AdminFilter.tsx | `adminRecipes.slot`, `slots.*` | always |
| 12 | Filter "Contiene el alérgeno": Cualquiera + every allergen of the catalogue (Spanish names) | select | AdminFilter.tsx | `adminRecipes.containsAllergen` (names from the API: not from the dictionary) | always |
| 13 | Filter "Imagen": Cualquiera / Lista / Lista, aceptada a mano / Dibujándose / Fallida / Sin imagen | select | AdminFilter.tsx | `adminRecipes.columns.picture`, `.pictureFilters.ready`, `.accepted_by_hand`, `.drawing`, `.failed`, `.none` | always |
| 14 | Filter "Origen": Cualquiera / IA / Semilla / Usuario | select | AdminFilter.tsx | `adminRecipes.columns.source`, `.sources.ai`, `.seed`, `.user` | always |
| 15 | Filter "Idioma": Cualquiera / Español / Inglés | select | AdminFilter.tsx | `adminRecipes.columns.locale`, `.locales.es-ES`, `.locales.en-GB` | always |
| 16 | Page size, "Aplicar", status line "{n} en total · por {orden}, {dirección}" (orders: nombre, kcal por ración, proteína por ración) | select + button + status | AdminTable.tsx | `adminConsole.table.*`, `adminRecipes.sortBy.name`, `.kcal`, `.protein` | always |
| 17 | Table "Recetas", columns: Nombre (sortable, first asc), Comidas, kcal (sortable, right), Proteína (g) (sortable, right), Hidratos (g) (right), Grasas (g) (right), Alérgenos, Trazas, Imagen, Origen, Idioma | table | DataTable.tsx | `adminRecipes.caption`, `.columns.name`, `.meals`, `.kcal`, `.protein`, `.carbs`, `.fat`, `.allergens`, `.mayContain`, `.picture`, `.source`, `.locale` | always |
| 18 | Cells: dish name (data); meals joined by commas (meal names from `slots`); kcal rounded and grams to one decimal per serving, "—" when the recipe cannot be calculated; allergens and traces as comma lists (Spanish, `lang="es"`) or "—"; source label; language label (unknown values shown raw) | text | catalogo/page.tsx | `slots.*`, `adminRecipes.sources.*`, `.locales.*` | per row |
| 19 | Picture cell, plain: the state "Lista" / "Dibujándose" / "Fallida" / "Sin imagen" | status | catalogo/page.tsx | `adminRecipes.pictures.ready`, `.drawing`, `.failed`, `.none` | picture is not failed/returned for a reason and not ready |
| 20 | Picture cell, ready: state "Lista", the line "Aceptada a mano, contra el revisor" only when the owner accepted it, and a link "Revisar la imagen" (aria-label "Revisar la imagen de {dish}") to `/admin/catalogo/{id}/imagen` | status + link | catalogo/page.tsx | `adminRecipes.acceptedByHand`, `.review`, `.reviewFor` | ready picture |
| 21 | Picture cell, with a reason (failed or returned): the state, the reason text (the ten texts of the images page: "La llamada falló", "Tope del mes alcanzado", "El revisor vio un alérgeno que el plato no tiene", "El revisor la rechazó", "El modelo rechazó la petición", "Sin firma C2PA", "Otro motivo", "La retiraste a mano", "El proveedor no puede cobrar", "El proveedor pidió bajar el ritmo"), and when it will retry itself ("Se reintenta sola a partir del {date}" or "Se reintenta sola en la siguiente visita") | status | catalogo/page.tsx | `adminPictures.reasons.*`, `adminRecipes.retryFrom`, `.retryNext` | picture has a reason |
| 22 | Under that, button "Reintentar" (secondary, small; aria-label "Reintentar la imagen de {dish}"); loading state; after it succeeds the button is marked aria-disabled for that state of the row | button | components/RetryPictureButton/RetryPictureButton.tsx | `adminRecipes.retry`, `.retryFor` | the failed/returned picture holds no rejected candidate |
| 23 | Instead, link "Revisar la imagen" (aria-label "Revisar la imagen de {dish}") | link | catalogo/page.tsx | `adminRecipes.review`, `.reviewFor` | the dish holds a rejected candidate picture |
| 24 | Retry failure line (alert): "Demasiados reintentos: espera un rato y vuelve a probar." on HTTP 429, else the API message | notice | RetryPictureButton.tsx | `adminRecipes.retryTooMany`, `errors.*` | retry failed |
| 25 | Empty state "El catálogo no tiene ninguna receta." | status | AdminTable.tsx | `adminRecipes.empty` | no recipe, no filter |
| 26 | No-match state "Ninguna receta coincide con la búsqueda o los filtros." + "Quitar la búsqueda y los filtros" | status + link | AdminTable.tsx | `adminRecipes.noMatch`, `adminConsole.table.clear` | filter on and no row |
| 27 | Pager (S-5.15) | list | AdminPager.tsx | `adminConsole.table.*` | more than one page |
| 28 | "Cómo se cuenta" fold, 8 notes (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminRecipes.howCounted[0..7]` | always |

## /admin/catalogo/[id]/imagen  (apps/web/src/app/(admin)/admin/catalogo/[id]/imagen/page.tsx)

Review of one dish's picture. Admin. 404 (the console 404) if the recipe id does not exist. Not in the navigation; reached from the Recetas table ("Revisar la imagen") and from the Imágenes page. Document title `pages['/admin/catalogo/[id]/imagen'].title` ("Revisar una imagen"). Four shapes: (A) a rejected candidate picture awaits a decision; (B) a published picture accepted by the owner by hand; (C) a published picture accepted by the judge; (D) nothing to review. Two hidden things hold across all: a polite status region (id `revision-estado`) where the result of an action is announced after focus returns, and the back link is the focus target after an action.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Back link "Volver a Recetas" to `/admin/catalogo` | link | imagen/page.tsx | `adminPictureReview.back` | always |
| 2 | Hidden polite status region for action results ("Imagen publicada. La aceptaste a mano.", "Imagen descartada.", "Imagen descartada. Se está dibujando otra.", "Imagen retirada. El plato ya no tiene imagen.", "Esta imagen ya no está guardada.") | status | imagen/page.tsx, PictureCandidateAction/reviewStatus.ts | `adminPictureReview.acceptDone`, `.discardDone`, `.retryDone`, `.removeDone`, `.gone` | after an action completes |
| 3 | Page title "Revisar la imagen de {dish}" | heading | AdminPageHeader.tsx | `adminPictureReview.title` | always |
| 4 | Intro (one of): shape A "El revisor rechazó esta imagen y no está publicada. Espera tu decisión: aceptarla, descartarla o reintentar el dibujo."; B "La imagen de este plato está publicada: la aceptaste a mano, contra el revisor. La ven todas las personas que reciben el plato."; C "La imagen de este plato está publicada: la aceptó el revisor. La ven todas las personas que reciben el plato."; D "Estado de la imagen del plato: {state}." or "... {state}. {reason}." | text | imagen/page.tsx | `adminPictureReview.intro`, `.acceptedIntro`, `.judgeAcceptedIntro`, `.introNothing`, `.introNothingReason`; `adminRecipes.pictures.*`; `adminPictures.reasons.*` | by shape |
| 5 | Shape A section "La imagen" (S-3) | heading | AdminSection.tsx | `adminPictureReview.pictureTitle` | A, B, C |
| 6 | The picture, large (4:3 hero), marked "IA" in a badge with a hidden label when it has no alt; alt "Imagen de {dish} generada por IA, pendiente de revisión" (A) or "Imagen de {dish} generada por IA, publicada" (B, C); candidate file is fetched through the API with the admin session | picture | components/DishPicture/DishPicture.tsx | `adminPictureReview.pictureAlt`, `.publishedAlt`; `picture.aiMark`, `picture.aiMarkLabel` | A, B, C |
| 7 | Caption under the picture: A "Imagen generada por IA. El revisor la rechazó y no está publicada: solo se ve en esta página."; B "Imagen generada por IA. La aceptaste a mano y está publicada: es la que ven las personas que reciben este plato."; C "Imagen generada por IA. La aceptó el revisor y está publicada: es la que ven las personas que reciben este plato." | text | imagen/page.tsx | `adminPictureReview.pictureCaption`, `.publishedCaption`, `.judgePublishedCaption` | A, B, C |
| 8 | Load-failure message under the picture, shown only when the image file did not load: A "No se ha podido cargar la imagen: puede que el archivo ya no esté. Recarga la página; si sigue sin verse, descártala o reinténtala. No la aceptes sin verla."; B/C "No se ha podido cargar la imagen publicada: puede que su archivo ya no esté. Recarga la página; si sigue sin verse, retírala: el plato se queda sin imagen y se vuelve a dibujar pasados al menos 7 días, o antes si lo reintentas desde Recetas." | notice | imagen/page.tsx (+ page.module.css `:has([data-failed])`) | `adminPictureReview.loadFailed`, `.publishedLoadFailed` | image file failed to load |
| 9 | A: section "Lo que vio el revisor" with note "Lo que el revisor vio en la imagen, con las palabras del catálogo. Puede incluir alérgenos que el plato lleva como trazas." (S-3) | heading + text | AdminSection.tsx | `adminPictureReview.flaggedTitle`, `.flaggedNote` | A |
| 10 | A: definition "Alérgenos que vio y el plato no tiene" -> list of Spanish allergen names, or the sentence "No señaló ninguno. Eso no quiere decir que la imagen esté bien." | list | imagen/page.tsx | `adminPictureReview.flaggedAllergens`, `.flaggedAllergensNone` | A |
| 11 | A: definition "Ingredientes del catálogo que reconoció" -> comma list or "Ninguno" | list | imagen/page.tsx | `adminPictureReview.flaggedIngredients`, `.none` | A |
| 12 | Section "El plato" (S-3) | heading | AdminSection.tsx | `adminPictureReview.dishTitle` | A, B, C |
| 13 | Definition "Alérgenos del plato" -> list or "Ninguno" | list | imagen/page.tsx | `adminPictureReview.dishAllergens`, `.none` | A, B, C |
| 14 | Definition "Trazas del plato" -> list or "Ninguno" | list | imagen/page.tsx | `adminPictureReview.dishTraces`, `.none` | A, B, C |
| 15 | Definition "Ingredientes, para la receta entera" -> list of "name  grams g" (names in Spanish), or "Ninguno" | list | imagen/page.tsx | `adminPictureReview.ingredients`, `.none`, `units.gram` | A, B, C |
| 16 | A: section "Qué hacer con ella" with note "Puedes verla hasta el {date}, hora de Madrid. Después la borra la limpieza nocturna, normalmente la noche siguiente, y hasta entonces el plato no vuelve a dibujarse solo." (S-3) | heading + text | AdminSection.tsx | `adminPictureReview.decideTitle`, `.decideNote` | A |
| 17 | A: help text "Aceptar la publica tal cual ... Descartar la borra y tampoco cuesta. Reintentar la borra y dibuja otra, que es de pago." | text | imagen/page.tsx | `adminPictureReview.decideHelp` | A |
| 18 | A: button "Aceptar" (secondary) opening the accept dialog | button | components/PictureAcceptAction/PictureAcceptAction.tsx | `adminPictureReview.accept` | A |
| 19 | Accept dialog, step 1 of 2, title "Antes de aceptar esta imagen", description "Paso 1 de 2. El revisor rechazó esta imagen. Aceptarla es publicarla contra su criterio." | dialog | PictureAcceptAction.tsx | `adminPictureReview.acceptWarningTitle`, `.acceptWarningBody` | dialog open, first step |
| 20 | Step 1 content: definitions "Alérgenos que vio y el plato no tiene" (list, or "No señaló ninguno...") and "Ingredientes del catálogo que reconoció" (list or "Ninguno"); heading "Qué pasa si la aceptas"; six bullets: the picture is published to everyone who receives the dish; a person with an allergy may distrust a safe dish if it shows an allergen the dish lacks; the dish's allergens are decided by the recipe, not the picture; the judge only looks at what is extra, not at what is missing, so compare against the dish's list; it is logged with your account and the allergens flagged; it can be removed later, which does not erase browser copies | list | PictureAcceptAction.tsx | `adminPictureReview.flaggedAllergens`, `.flaggedAllergensNone`, `.flaggedIngredients`, `.none`, `.acceptEffectsTitle`, `.acceptEffects[0..5]` | step 1 |
| 21 | Step 1 buttons: "Cancelar" (first, secondary) and "Entendido, continuar" (secondary) | button | PictureAcceptAction.tsx | `common.cancel`, `adminPictureReview.acceptContinue` | step 1 |
| 22 | Accept dialog, step 2, title "¿Publicar esta imagen?", description "Paso 2 de 2. Al confirmar, la imagen de {dish} se publica tal cual para todas las personas que reciban el plato." | dialog | PictureAcceptAction.tsx | `adminPictureReview.acceptConfirmTitle`, `.acceptConfirmBody` | step 2 |
| 23 | Step 2 checkbox: "He visto la imagen y la publico aunque el revisor vio en ella: {allergens}" or, when none flagged, "He visto la imagen y la publico aunque el revisor la rechazó." | field | PictureAcceptAction.tsx (`ui/components/Checkbox`) | `adminPictureReview.acceptAck`, `.acceptAckNone` | step 2 |
| 24 | Step 2 refusal "Marca la casilla para publicar la imagen." (focus goes to the box; the box is marked invalid) | notice | PictureAcceptAction.tsx | `adminPictureReview.acceptAckMissing` | Publish pressed with the box unticked |
| 25 | Step 2 buttons: "Cancelar" (first) and "Publicar la imagen" (primary, loading) | button | PictureAcceptAction.tsx | `common.cancel`, `adminPictureReview.acceptConfirm` | step 2 |
| 26 | Accept failure lines (alert): "Demasiadas aceptaciones en una hora: espera un rato y vuelve a probar." (HTTP 429), else the API message | notice | PictureAcceptAction.tsx | `adminPictureReview.acceptTooMany`, `errors.*` | request failed |
| 27 | Accept stale dialog, title "No se ha publicado nada", showing the message "La imagen que espera revisión ha cambiado desde que abriste la página: lo que el revisor señaló ya no es lo que viste. Recarga y mírala otra vez." (allergens mismatch), or "Esa imagen ya no está guardada: se aceptó, se descartó, se reintentó o pasaron sus 7 días." (no candidate / HTTP 404), with one button "Cerrar y recargar la página" | dialog | PictureAcceptAction.tsx | `adminPictureReview.acceptStaleTitle`, `errors.pictureAllergensMismatch`, `errors.pictureNoCandidate`, `adminPictureReview.reload` | API answers stale |
| 28 | A: button "Descartar" (secondary) opening the discard dialog | button | components/PictureCandidateAction/PictureCandidateAction.tsx | `adminPictureReview.discard` | A |
| 29 | Discard dialog "¿Descartar esta imagen?" with text "Se borra el archivo y no se puede recuperar. No cuesta nada: no se dibuja ninguna imagen nueva y el plato sigue sin imagen hasta su siguiente reintento."; buttons "Cancelar" and "Descartar la imagen" (destructive, loading); error alert line | dialog | PictureCandidateAction.tsx | `adminPictureReview.discardTitle`, `.discardBody`, `.discardConfirm`, `common.cancel`, `errors.*` | discard dialog open |
| 30 | A: button "Reintentar" (secondary) opening the retry dialog | button | PictureCandidateAction.tsx | `adminPictureReview.retry` | A |
| 31 | Retry dialog "¿Dibujar otra imagen?" with text "Se borra esta imagen y se dibuja otra ahora. Dibujar es de pago y cuenta para el tope del mes; el revisor puede volver a rechazarla."; buttons "Cancelar" and "Borrar y dibujar otra" (primary, loading); error alert line; HTTP 429 reads "Demasiados reintentos: espera un rato y vuelve a probar." | dialog | PictureCandidateAction.tsx | `adminPictureReview.retryTitle`, `.retryBody`, `.retryConfirm`, `adminRecipes.retryTooMany`, `common.cancel`, `errors.*` | retry dialog open |
| 32 | B/C: section "Imagen aceptada a mano" (B) or "Imagen aceptada por el revisor" (C) (S-3) | heading | AdminSection.tsx | `adminPictureReview.acceptedTitle`, `.judgeAcceptedTitle` | B, C |
| 33 | B/C: help text B "Retirar deja el plato sin imagen para todos y borra el archivo publicado. No cuesta nada."; C "Si muestra algo que el plato no lleva, retírala: el plato se queda sin imagen para todos y se borra el archivo publicado. No cuesta nada." | text | imagen/page.tsx | `adminPictureReview.acceptedHelp`, `.judgeAcceptedHelp` | B, C |
| 34 | B/C: button "Retirar" (secondary) opening the remove dialog | button | components/PictureRemoveAction/PictureRemoveAction.tsx | `adminPictureReview.remove` | B, C |
| 35 | Remove dialog "¿Retirar la imagen de {dish}?" with a body explaining that the dish goes back to no picture for everyone, the file is deleted and cannot be recovered, and CDN/browser copies may last briefly; buttons "Cancelar" and "Retirar la imagen" (destructive, loading); error alert line; HTTP 429 reads "Demasiadas retiradas en una hora: espera un rato y vuelve a probar." | dialog | PictureRemoveAction.tsx | `adminPictureReview.removeTitle`, `.removeBody`, `.removeConfirm`, `.removeTooMany`, `common.cancel`, `errors.*` | remove dialog open |
| 36 | Remove ended-state dialog, one of: title "Retirada, con su archivo sin borrar" with the leftover message (the image is withdrawn but the public file could not be deleted; delete it by hand in the storage panel) ; title "No se ha retirado nada" with the stale message ("Esa imagen no se puede retirar: el plato ya no tiene una imagen publicada."); one button "Cerrar y recargar la página" | dialog | PictureRemoveAction.tsx | `adminPictureReview.removeLeftoverTitle`, `.removeLeftover`, `.removeStaleTitle`, `errors.pictureNotRemovable`, `.reload` | the removal ended in either way |
| 37 | B only: line "El registro de acciones guarda cuándo se aceptó cada imagen y qué alérgenos había señalado el revisor." with link "Abrir el registro de acciones" to `/admin/ajustes/registro?action=picture.accepted` | text + link | imagen/page.tsx | `adminPictureReview.acceptedTrail`, `.acceptedTrailLink` | B |
| 38 | D: empty card with heading "No hay ninguna imagen que revisar" and body "Este plato no tiene ninguna imagen publicada ni ninguna rechazada esperando: aún no se ha dibujado, se está dibujando, se descartó, se reintentó, se retiró o pasaron sus 7 días." | status | components/EmptyState/EmptyState.tsx | `adminPictureReview.nothingTitle`, `.nothingBody` | D |

## /admin/catalogo/calidad  (apps/web/src/app/(admin)/admin/catalogo/calidad/page.tsx)

Admin. 404 if `/admin/catalogue/quality` answers nothing. The period drives only the size-rejection chart and the rewrite history; everything else is "now". Document title `pages['/admin/catalogo/calidad'].title`. Count-list rows (S-8, `apps/web/src/components/AdminCountList/AdminCountList.tsx`) have: label, count (flagged when warning), optional status word, and a chevron when the row is a link.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Calidad" and intro "Lo que el catálogo debería cumplir y no cumple, y cómo va la reescritura de los pasos." (S-1) | heading + text | calidad/page.tsx | `adminQuality.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Section "Debería ser cero" with note "Una cifra por encima de cero es un fallo aguas arriba. Las que llevan enlace abren esas recetas." (S-3) | heading + text | AdminSection.tsx | `adminQuality.zeroTitle`, `.zeroNote` | always |
| 4 | Count list named "Cifras que deberían ser cero", five rows, each with count and status "Bien" (zero) or "Revisar" (above zero, warning style): "Recetas por encima del límite de una ración" (link to Recetas `?check=over_bound` when above zero), "Recetas sin macros calculables" (`?check=uncosted`), "Platos que no encajan con ninguna comida" (`?check=unserved`), "Recetas que la reescritura ha abandonado" (`?check=refusal_limit`), "Comidas con raciones fuera de rango" (never a link) | list + link | AdminCountList.tsx | `adminQuality.zeroLabel`, `.zero.overBound`, `.uncosted`, `.unserved`, `.refusalLimit`, `.mealsOutsideServingBounds`, `.status.ok`, `.status.warn` | always |
| 5 | Section "Para mirar" with note "No son fallos: conviene mirarlos de vez en cuando." (S-3) | heading + text | AdminSection.tsx | `adminQuality.lookTitle`, `.lookNote` | always |
| 6 | Count list named "Cifras para mirar": one row per source returned "Por encima del tope de su comida, por origen: IA / Semilla / Usuario" (link to Recetas `?check=over_cap&source=…` when above zero), and "Imágenes fallidas por el propio plato" (link to Recetas `?picture=failed` when above zero) | list + link | AdminCountList.tsx | `adminQuality.lookLabel`, `.overCapBySource`, `adminRecipes.sources.*`, `adminQuality.picturesFailed` | always |
| 7 | Chart "Rechazos por tamaño por día": column chart, series "Platos rechazados" | chart | ColumnChart.tsx | `adminQuality.lookChart`, `.lookSeries`, `adminConsole.day` | always |
| 8 | Empty message "Ningún plato se rechazó por su tamaño en este periodo." | status | ChartFrame.tsx | `adminQuality.lookEmpty` | none |
| 9 | Section "Reescritura de los pasos" with note "Versión de los pasos {version}. Se abandona una receta tras {bound} rechazos." (S-3) | heading + text | AdminSection.tsx | `adminQuality.sweepTitle`, `.sweepNote` | always |
| 10 | Tile list "Estado de la reescritura": "Al día", "Pendientes", "Con rechazos", "Abandonadas", each with note "de {total} recetas" | figure | StatTile.tsx | `adminQuality.tilesLabel`, `.sweep.current`, `.pending`, `.withRefusals`, `.givenUp`, `.sweepOf` | always |
| 11 | Section "Historia de la reescritura" with note "Por día de Madrid, dentro del periodo." (S-3) | heading + text | AdminSection.tsx | `adminQuality.historyTitle`, `.historyNote` | always |
| 12 | Chart "Resultado de cada ejecución por día": stacked columns, series "Reescritas" (success), "Omitidas" (neutral), "Sin alcanzar" (tone 2), "Retenidas por el tope" (tone 1), legend, data table with "Total" column | chart | ColumnChart.tsx | `adminQuality.historyChart`, `.historySeries.rewritten`, `.skipped`, `.unreached`, `.heldByCap`, `.historyTotal` | always |
| 13 | Empty message "Ninguna ejecución reescribió ni gastó nada en este periodo." (both charts) | status | ChartFrame.tsx | `adminQuality.historyEmpty` | none |
| 14 | Chart "Gasto de la reescritura por día": column chart in dollars, series "Coste" | chart | ColumnChart.tsx | `adminQuality.historyCostChart`, `.historyCostSeries` | always |
| 15 | Table "Días con actividad de la reescritura" with a visible heading (reflow table, wide table and narrow card list), columns Día, Ejecuciones, Reescritas, Omitidas, Sin alcanzar, Retenidas por el tope, Pendientes al final, Llamadas, Coste; only days with at least one run or call | table / list | components/AdminReflowTable/AdminReflowTable.tsx | `adminQuality.historyRunsCaption`, `.historyRunsHeader`, `.historySeries.*`, `.historyPending`, `.historyCalls`, `.historyCost`, `adminConsole.day` | always |
| 16 | Cell "Pendientes al final": number, or "—" with hidden text "Sin datos" when the run recorded none | figure | calidad/page.tsx | `adminQuality.historyNoData` | per row |
| 17 | Empty state "Ninguna ejecución ni llamada en este periodo." | status | AdminReflowTable.tsx | `adminQuality.historyRunsEmpty` | no rows |
| 18 | "Cómo se cuenta" fold, 6 notes (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminQuality.howCounted[0..5]` | always |

## /admin/catalogo/ingredientes  (apps/web/src/app/(admin)/admin/catalogo/ingredientes/page.tsx)

Admin. 404 if `/admin/catalogue/ingredients` answers nothing. No period. Allergen catalogue read for names (Spanish, `lang="es"`).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Ingredientes" and intro "Cada ingrediente del catálogo, con sus cifras por 100 g y su etiqueta." (S-1) | heading + text | ingredientes/page.tsx | `adminIngredients.title`, `.intro` | always |
| 2 | Section "Todos los ingredientes" (S-3) | heading | AdminSection.tsx | `adminIngredients.tableTitle` | always |
| 3 | Toolbar with search "Buscar por nombre" | field | AdminTable.tsx | `adminIngredients.search`, `adminConsole.table.toolbar` | always |
| 4 | Filters fold "Filtros (n activos)" (two filters) | toggle | AdminFilters.tsx | `adminConsole.table.filters*` | always |
| 5 | Filter "Categoría": Cualquiera / Panadería / Bebidas / Lácteos / Congelados / Otros / Despensa / Frutas y verduras / Carne y pescado | select | AdminFilter.tsx | `adminIngredients.columns.category`, `categories.bakery`, `.beverages`, `.dairy`, `.frozen`, `.other`, `.pantry`, `.produce`, `.protein` | always |
| 6 | Filter "Contiene el alérgeno": Cualquiera + every allergen (Spanish) | select | AdminFilter.tsx | `adminIngredients.containsAllergen` (names from the API) | always |
| 7 | Page size, "Aplicar", status line "{n} en total · por {orden}, {dirección}" (orders: nombre, categoría, kcal, proteína, hidratos, grasas) | select + button + status | AdminTable.tsx | `adminConsole.table.*`, `adminIngredients.sortBy.*` | always |
| 8 | Table "Ingredientes", columns: Nombre (sortable asc), Categoría (sortable asc), kcal (sortable desc, right), Proteína (g) (sortable, right), Hidratos (g) (sortable, right), Grasas (g) (sortable, right), Alérgenos, Trazas, Comidas, Países | table | DataTable.tsx | `adminIngredients.caption`, `.columns.name`, `.category`, `.kcal`, `.protein`, `.carbs`, `.fat`, `.allergens`, `.mayContain`, `.meals`, `.countries` | always |
| 9 | Cells: name (data); category label; per-100 g figures; allergens and traces as comma lists or "—"; meals as meal names, or "Todas" when it fits any meal; countries as codes, or "Todos" when sold everywhere | text | ingredientes/page.tsx | `categories.*`, `slots.*`, `adminIngredients.everyMeal`, `.everywhere` | per row |
| 10 | Empty state "El catálogo no tiene ningún ingrediente." | status | AdminTable.tsx | `adminIngredients.empty` | no rows, no filter |
| 11 | No-match state "Ningún ingrediente coincide con la búsqueda o los filtros." + "Quitar la búsqueda y los filtros" | status + link | AdminTable.tsx | `adminIngredients.noMatch`, `adminConsole.table.clear` | filter on and no row |
| 12 | Pager (S-5.15) | list | AdminPager.tsx | `adminConsole.table.*` | more than one page |
| 13 | "Cómo se cuenta" fold, 3 notes (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminIngredients.howCounted[0..2]` | always |

## /admin/catalogo/despensa  (apps/web/src/app/(admin)/admin/catalogo/despensa/page.tsx)

Admin. 404 if either of the two cupboard reads fails. No period. Counts of accounts only, drawn from two accounts up (the floor is applied by the API and cannot be lowered here).

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Despensa" and intro "Qué no supo cocinar el catálogo con lo que la gente tiene en casa: cifras de cuentas, nunca quién." (S-1) | heading + text | despensa/page.tsx | `adminCupboard.title`, `.intro` | always |
| 2 | Section "Palabras sin alimento en el catálogo" with note "La respuesta es añadir un alimento al catálogo. Una palabra solo se muestra cuando al menos {n} cuentas la han puesto. Es deliberado: el mínimo no se puede bajar desde esta pantalla." (S-3) | heading + text | AdminSection.tsx | `adminCupboard.unresolved.title`, `.answer`, `.threshold` | always |
| 3 | Empty card: heading "Ninguna palabra llega al mínimo" and body "El selector de la despensa solo ofrece alimentos del catálogo, así que lo normal es que nada se quede sin resolver: una lista vacía es el selector funcionando. Esta lista es una foto de lo que se guarda ahora, no un historial." | status | despensa/page.tsx | `adminCupboard.unresolved.emptyTitle`, `.emptyBody` | no word reaches the floor |
| 4 | Line over the list: "Se muestran las {shown} más repetidas de {total}." (when more than 100) or "{total} en total" | text | despensa/page.tsx | `adminCupboard.unresolved.firstOnly`, `adminConsole.table.count` | at least one word |
| 5 | Table "Palabras que el catálogo no supo resolver" (hidden caption, plain, not paged), columns Palabra, Cuentas (right); the words are what people typed (data) | table | DataTable.tsx | `adminCupboard.unresolved.caption`, `.columns.word`, `.columns.accounts` | at least one word |
| 6 | Section "Ingredientes sin ningún plato" with note "La respuesta es escribir platos con estos ingredientes: están en el catálogo, pero ninguna receta los usa. Primero, los que más cuentas tienen ahora." (S-3) | heading + text | AdminSection.tsx | `adminCupboard.uncooked.title`, `.answer` | always |
| 7 | Toolbar "Filtrar" (no search): page size select "Por página" and "Aplicar" | select + button | AdminTable.tsx | `adminConsole.table.toolbarFilters`, `.pageSize`, `.apply` | always |
| 8 | Status line "{n} en total" | status | AdminTableStatus.tsx | `adminConsole.table.count` | always |
| 9 | Table "Ingredientes del catálogo que ninguna receta usa", columns Ingrediente, Categoría, "Cuentas que lo tienen, a partir de dos" (right); not sortable | table | DataTable.tsx | `adminCupboard.uncooked.caption`, `.columns.name`, `.category`, `.accounts` | always |
| 10 | Cells: ingredient name (data); category label; count of accounts, or the words "menos de dos" when the API floored it to zero (a zero is never shown as "ninguna") | text | despensa/page.tsx | `categories.*`, `adminCupboard.uncooked.belowFloor` | per row |
| 11 | Empty state "Todos los ingredientes del catálogo están en alguna receta." | status | AdminTable.tsx | `adminCupboard.uncooked.empty` | no rows |
| 12 | Pager (S-5.15) | list | AdminPager.tsx | `adminConsole.table.*` | more than one page |
| 13 | "Cómo se cuenta" fold, 3 notes (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminCupboard.howCounted[0..2]` | always |

## /admin/catalogo/imagenes  (apps/web/src/app/(admin)/admin/catalogo/imagenes/page.tsx)

Admin. 404 if `/admin/pictures` answers nothing. Counts and dollars only.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Imágenes" and intro "Lo que cuestan las imágenes de los platos y en qué estado están." (S-1) | heading + text | imagenes/page.tsx | `adminPictures.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Line "Dibujar imágenes está encendido." or "Dibujar imágenes está apagado: no se dibuja ninguna nueva." | status | imagenes/page.tsx | `adminPictures.settingsOn`, `.settingsOff` | always (by the switch) |
| 4 | Link "Cambiar en Ajustes" to `/admin/ajustes#imagenes` | link | imagenes/page.tsx | `adminPictures.settingsLink` | always |
| 5 | Section "Este mes" with note "Desde el {date}, mes natural en UTC: no cambia con el periodo." (S-3) | heading + text | AdminSection.tsx | `adminPictures.gaugeTitle`, `.gaugeNote` | always |
| 6 | Gauge "Gasto del mes contra el tope": spent vs cap in dollars; data table headed "Este mes" with "Gastado" and "Tope del mes" | chart | Gauge.tsx | `adminPictures.gaugeChart`, `.spent`, `.cap`, `.gaugeTitle` | always |
| 7 | Over-the-cap warning "Por encima del tope" | notice | Gauge.tsx | `adminPictures.over` | spent above cap |
| 8 | Gauge empty message "No hay ningún tope configurado." | status | ChartFrame.tsx | `adminPictures.gaugeEmpty` | no usable cap |
| 9 | Section "En el periodo" (S-3) | heading | AdminSection.tsx | `adminPictures.spendTitle` | always |
| 10 | Chart "Gasto en imágenes por día": line chart in dollars, series "Gasto" | chart | LineChart.tsx | `adminPictures.spendChart`, `.spendSeries`, `adminConsole.day` | always |
| 11 | Empty message "No se ha dibujado nada en este periodo." | status | ChartFrame.tsx | `adminPictures.spendEmpty` | none |
| 12 | Section "Estado actual" with note "Todas, de cualquier fecha: no cambia con el periodo." (S-3) | heading + text | AdminSection.tsx | `adminPictures.statesTitle`, `.statesNote` | always |
| 13 | Chart "Imágenes por estado": donut, four slices in order with pinned tones: Listas (success), Dibujándose (neutral), Fallidas (failure), Devueltas (tone 4); legend with count and share; data table headed "Estado" with "Del total" share column | chart | DonutChart.tsx | `adminPictures.statesChart`, `.state`, `.share`, `.statesSeries`, `.states.ready`, `.drawing`, `.failed`, `.released` | always |
| 14 | Empty message "Todavía no hay ninguna imagen." | status | ChartFrame.tsx | `adminPictures.statesEmpty` | no pictures |
| 15 | Count list named "Imágenes listas aceptadas a mano", one row "De las listas, aceptadas a mano contra el revisor" with count; a link to Recetas `?picture=accepted_by_hand` when above zero | list + link | AdminCountList.tsx | `adminPictures.acceptedByHandLabel`, `.acceptedByHand` | always |
| 16 | Section "Por qué fallaron" with note "Imágenes que fallaron por el propio plato en el periodo, o que retiraste a mano, contadas por el día en que terminaron. Se reintentan solas pasados al menos 7 días, o a mano desde Recetas." (S-3) | heading + text | AdminSection.tsx | `adminPictures.failedTitle`, `.failedNote` | always |
| 17 | Count list named "Imágenes fallidas por motivo", one row per reason with count (not links): "La llamada falló", "Tope del mes alcanzado", "El revisor vio un alérgeno que el plato no tiene", "El revisor la rechazó", "El modelo rechazó la petición", "Sin firma C2PA", "Otro motivo", "La retiraste a mano", "El proveedor no puede cobrar", "El proveedor pidió bajar el ritmo" (only those that happened) | list | AdminCountList.tsx | `adminPictures.failedListLabel`, `.reasons.call_failed`, `.cap_reached`, `.judge_allergen`, `.judge_rejected`, `.model_refused`, `.no_provenance`, `.other`, `.owner_removed`, `.payment_refused`, `.rate_limited` | at least one failure |
| 18 | Link "Ver las recetas con imagen fallida" to Recetas `?picture=failed` | link | imagenes/page.tsx | `adminPictures.failedLink` | at least one failure |
| 19 | Card "Ninguna imagen ha fallado en este periodo." | status | imagenes/page.tsx | `adminPictures.failedEmpty` | no failure |
| 20 | Section "Devueltas, no fallidas" with note "Devueltas sin culpa del plato (el tope o el pago): se vuelven a dibujar en la siguiente visita, sin esperar." (S-3) | heading + text | AdminSection.tsx | `adminPictures.releasedTitle`, `.releasedNote` | always |
| 21 | Count list named "Imágenes devueltas por motivo" (reason rows as in 17) | list | AdminCountList.tsx | `adminPictures.releasedListLabel`, `.reasons.*` | at least one |
| 22 | Card "Ninguna imagen se ha devuelto en este periodo." | status | imagenes/page.tsx | `adminPictures.releasedEmpty` | none |
| 23 | "Cómo se cuenta" fold: 4 notes plus ten more, one per reason, each "reason name: explanation" (the explanations `adminPictures.reasonHelp.*`: call ended with no usable answer; cap reached; judge saw an allergen; judge rejected for another reason; provider refused 4xx not 402; no C2PA signature; other incl. old rows; owner removed; provider cannot pay 402; rate limited 429) (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminPictures.howCounted[0..3]`, `adminPictures.reasons.*` + `adminPictures.reasonHelp.*` | always |

## /admin/ajustes  (apps/web/src/app/(admin)/admin/ajustes/page.tsx)

Interruptores. Admin. 404 if `/admin/settings` or `/admin/settings/allowances` answers nothing. No period. Document title `pages['/admin/ajustes'].title`. The page draws its own header (same words and look as S-1: `h1` plus intro). Every switch saves as soon as it is flipped (optimistic: it flips, sends, and flips back with an error line if the request fails); the hint under each switch changes with the state ("what is true now"). Anchors the rest of the console links to: `#imagenes` (dish pictures switch), `#acompanamientos`, `#despensa` (pantry in plan), `#asistente`.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Interruptores" and intro "Los interruptores del servicio. Debajo de cada uno, lo que pasa ahora mismo." | heading + text | ajustes/page.tsx | `adminSettings.title`, `.intro` | always |
| 2 | Group heading "Acceso" (`h2`) | heading | ajustes/page.tsx | `adminSettings.access` | always |
| 3 | Switch "Activación automática" (default on); hint on: "Quien confirma su correo entra directamente. Tú no tienes que hacer nada."; hint off: "Al confirmar su correo la cuenta queda esperando y te avisamos a ti. La abres tú desde esta lista." | toggle | components/FlagSwitch/FlagSwitch.tsx, components/SettingSwitch/SettingSwitch.tsx, `ui/components/Switch` | `admin.automaticActivation`, `.automaticHint`, `.manualHint` | always |
| 4 | Switch "Consulta para dietistas" (default off); hint on: "Encendido: los profesionales que concedas pueden abrir su consulta y vincular pacientes."; hint off: "Apagado: nadie ve la consulta, tampoco quien ya tenga la concesión. Sus pacientes siguen como cuentas normales." | toggle | FlagSwitch.tsx | `admin.professionalLabel`, `.professionalHint`, `.professionalOffHint` | always |
| 5 | Group heading "Producto" | heading | ajustes/page.tsx | `adminSettings.product` | always |
| 6 | Switch "Nivel de pago" (premium; default off); hint on: "Premium está activo: las cuentas a las que se lo hayas dado tienen tres replanificaciones por quincena y veinte cambios por plan."; hint off: "Premium está apagado: todo el mundo usa los límites gratuitos, incluido quien ya lo tenga concedido. Encenderlo se lo devuelve." | toggle | FlagSwitch.tsx | `admin.premiumLabel`, `.premiumHint`, `.premiumOffHint` | always |
| 7 | Switch "Dibujar las imágenes de los platos" (default off, anchor `#imagenes`); on: first-view drawing, shared by everyone, stops at the monthly cap; off: no new image, existing ones stay | toggle | FlagSwitch.tsx | `admin.picturesLabel`, `.picturesHint`, `.picturesOffHint` | always |
| 8 | Switch "Acompañamientos (pan, ensalada, fruta)" (default off, anchor `#acompanamientos`); on/off hints | toggle | FlagSwitch.tsx | `admin.accompanimentsLabel`, `.accompanimentsHint`, `.accompanimentsOffHint` | always |
| 9 | Switch "Despensa en el plan (aprovechar lo que ya hay en casa)" (default off, anchor `#despensa`); on/off hints | toggle | FlagSwitch.tsx | `admin.pantryRankLabel`, `.pantryRankHint`, `.pantryRankOffHint` | always |
| 10 | Switch "Asistente de nutrición" (default off, anchor `#asistente`); on: any account can ask in /asistente with its fortnight limit and the month's spend cap; off: /asistente does not exist for anybody, existing conversations can still be read and deleted | toggle | FlagSwitch.tsx | `admin.assistantLabel`, `.assistantHint`, `.assistantOffHint` | always |
| 11 | Switch failure line under any switch (the switch flips back) | notice | SettingSwitch.tsx | `errors.*` via `messageFor` | request failed |
| 12 | Group heading "Qué permite cada suscripción" (`h2`) and intro "Cuántos usos permite cada suscripción. Un número fuera de sus límites se rechaza, no se recorta, y mientras nadie mueva uno vale el que trae el código." | heading + text | ajustes/page.tsx | `adminAllowances.title`, `.intro` | always |
| 13 | Eight allowance rows in this order, each with: label, a cost sentence, a reason-for-the-bound sentence, and two number fields (see 14-16) | list | ajustes/page.tsx | per row below | always |
| 13a | Row "Cambios de comida, por plan" | list | ajustes/page.tsx | `adminAllowances.labelSwaps`, `.costSwaps`, `.whySwaps` | always |
| 13b | Row "Días que comen distinto, por plan" | list | ajustes/page.tsx | `adminAllowances.labelEvents`, `.costEvents`, `.whyEvents` | always |
| 13c | Row "Días que comen distinto añadidos a una quincena en marcha" | list | ajustes/page.tsx | `adminAllowances.labelMidPlan`, `.costMidPlan`, `.whyMidPlan` | always |
| 13d | Row "Comidas fijas cada semana" | list | ajustes/page.tsx | `adminAllowances.labelFixedMeals`, `.costFixedMeals`, `.whyFixedMeals` | always |
| 13e | Row "Platos que puede pedirnos al mes" | list | ajustes/page.tsx | `adminAllowances.labelDishRequests`, `.costDishRequests`, `.whyDishRequests` | always |
| 13f | Row "Mensajes al asistente por quincena", with an extra sentence on spend (the assistant's monthly cap is shared; free accounts weigh most) | list | ajustes/page.tsx | `adminAllowances.labelAssistant`, `.costAssistant`, `.whyAssistant`, `.spendAssistant` | always |
| 13g | Row "Preguntas fuera de tema que comprueba por quincena" | list | ajustes/page.tsx | `adminAllowances.labelAssistantOffTopic`, `.costAssistantOffTopic`, `.whyAssistantOffTopic` | always |
| 13h | Row "Replanificaciones por quincena", with an extra sentence on spend "Sale del presupuesto de fotos del mes, que es uno para todos..." followed by link "Ver el gasto en imágenes" to `/admin/catalogo/imagenes` | list + link | ajustes/page.tsx | `adminAllowances.labelRedos`, `.costRedos`, `.whyRedos`, `.spend`, `.spendLink` | always |
| 14 | In each row, two forms (one per tier): label "Gratis" / "Premium", a numeric field (integer, min = floor, max = ceiling, step 1), a "Guardar" button (disabled while saving or when the value is unchanged), and hint "De fábrica {shipped}. Entre {floor} y {ceiling}." | field + button | components/AllowanceField/AllowanceField.tsx | `adminAllowances.free`, `.premium`, `.save`, `.bounds` | always (16 forms) |
| 15 | Validation line "Tiene que ser un número entero." (an empty or fractional value is refused before sending) | notice | AllowanceField.tsx | `adminAllowances.whole` | non-integer typed |
| 16 | Request failure line (API refuses a value outside its bounds, premium below free, etc.) | notice | AllowanceField.tsx | `errors.*` via `messageFor` | request failed; on success the whole page is re-read |
| 17 | Group heading "Notificaciones" | heading | ajustes/page.tsx | `adminSettings.notifications` | always |
| 18 | Switch "Recordatorio del check-in" (default off); on: a daily morning reminder by email and on phones that asked, once per fortnight, each person can turn it off in their profile; off: no reminder is sent, the check-in only appears on Hoy | toggle | FlagSwitch.tsx | `admin.remindersTitle`, `.remindersHint`, `.remindersOffHint` | always |
| 19 | Button "Enviarme un aviso de prueba" (secondary; disabled while sending) | button | components/PushTestButton/PushTestButton.tsx | `admin.pushTest` | always |
| 20 | Result line after the test (polite status), one of: "Enviado: lo han aceptado {n} de tus dispositivos. Debería llegar en unos segundos."; "Ninguno de tus {n} dispositivos lo aceptó. Si quitaste el permiso o borraste la app, vuelve a activar los avisos en tu perfil."; "No tienes avisos activados en ningún dispositivo. Actívalos en tu perfil, desde el móvil, y vuelve a probar."; "El push no está configurado en el servidor: faltan las variables VAPID en la API de Vercel, o falta el redeploy."; or an API error message | status | PushTestButton.tsx | `admin.pushTestSent`, `.pushTestRefused`, `.pushTestNoDevice`, `.pushTestUnconfigured`, `errors.*` | after the button is pressed |

## /admin/ajustes/registro  (apps/web/src/app/(admin)/admin/ajustes/registro/page.tsx)

Registro de acciones. Admin. 404 if `/admin/audit` answers nothing. Read-only: no row is clickable. Reached with `?action=picture.accepted` from the picture review page.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Registro de acciones" and intro "Quién hizo cada cambio de cuenta o de ajuste, y cuándo." (S-1) | heading + text | registro/page.tsx | `adminAudit.title`, `.intro` | always |
| 2 | Section "Todas las acciones" with note "Las más recientes primero." (S-3) | heading + text | AdminSection.tsx | `adminAudit.tableTitle`, `.tableNote` | always |
| 3 | Toolbar "Filtrar" (no search) with one filter "Acción": Cualquiera + the 25 action names (see 6), page size and "Aplicar" | select + button | AdminTable.tsx | `adminAudit.columns.action`, `adminConsole.table.toolbarFilters`, `.any`, `.pageSize`, `.apply` | always |
| 4 | Status line "{n} en total" | status | AdminTableStatus.tsx | `adminConsole.table.count` | always |
| 5 | Table "Acciones", columns Fecha, Acción, Cuenta, Quién, Detalle (none sortable) | table | DataTable.tsx | `adminAudit.caption`, `.columns.date`, `.action`, `.account`, `.actor`, `.detail` | always |
| 6 | Action names: "Cuenta activada"; "Cambio de plan"; "Perfil profesional concedido"; "Perfil profesional revocado"; "Mensaje marcado como visto"; "Mensaje reabierto"; "Límite de suscripción cambiado"; "Ajuste cambiado"; "Aviso de prueba enviado"; "Imagen de un plato reintentada a mano"; "Imagen rechazada de un plato descartada a mano"; "Imagen rechazada de un plato aceptada a mano, contra el revisor"; "Imagen publicada de un plato, retirada"; "Contraseña cambiada"; "Sesiones cerradas"; "Verificación en dos pasos activada"; "Verificación en dos pasos desactivada"; "Código de respaldo usado"; "Códigos de respaldo nuevos generados"; "Retirada de la verificación en dos pasos pedida"; "Retirada de la verificación en dos pasos cancelada"; "Verificación en dos pasos quitada a petición"; "Llave de acceso añadida"; "Llave de acceso quitada"; "Cuenta sin confirmar eliminada" | text | registro/page.tsx | `adminAudit.actions['account.activated']`, `['account.tier_changed']`, `['professional.granted']`, `['professional.revoked']`, `['feedback.handled']`, `['feedback.reopened']`, `['setting.allowance_changed']`, `['setting.changed']`, `['push.test_sent']`, `['picture.retried']`, `['picture.discarded']`, `['picture.accepted']`, `['picture.removed']`, `['auth.password_changed']`, `['auth.sessions_revoked']`, `['auth.2fa_enabled']`, `['auth.2fa_disabled']`, `['auth.backup_code_used']`, `['auth.backup_codes_regenerated']`, `['auth.2fa_removal_requested']`, `['auth.2fa_removal_cancelled']`, `['auth.2fa_removed_by_owner']`, `['auth.passkey_added']`, `['auth.passkey_removed']`, `['auth.unconfirmed_account_swept']` | filter options and the Acción cell |
| 7 | Cells: date and time in Madrid time; account email or "—"; actor email, or when there is no actor the way it happened ("Automático", "Consola", "Enlace del correo") | text | registro/page.tsx | `adminAudit.via.automatic`, `.console`, `.mail_link` | per row |
| 8 | Detail "{from} → {to}" for a tier change (Gratis/Premium) | text | registro/page.tsx | `adminAudit.tierChange`, `adminAccounts.tiers.*` | `account.tier_changed` |
| 9 | Detail "{switch name}: Encendido / Apagado" for a switch change | text | registro/page.tsx | `adminAudit.settingChange`, `.state.on`, `.state.off`, `admin.*Label` | `setting.changed` |
| 10 | Detail "{limit name}, {tier}: de {from} a {value}" or "... , el valor que trae el código" when put back to the shipped number | text | registro/page.tsx | `adminAudit.allowanceChange`, `.allowanceUnset` | `setting.allowance_changed` |
| 11 | Detail for a password change: "Desde su perfil" / "Con el enlace de recuperación" | text | registro/page.tsx | `adminAudit.passwordVia.change`, `.reset` | `auth.password_changed` |
| 12 | Detail "Le quedan {n}" for a backup code used | text | registro/page.tsx | `adminAudit.backupCodesLeft` | `auth.backup_code_used` |
| 13 | Detail for a cancelled second-factor removal: "La persona, al entrar con su código" / "Desde la consola" | text | registro/page.tsx | `adminAudit.removalCancelledBy.account`, `.owner` | `auth.2fa_removal_cancelled` |
| 14 | Detail for revoked sessions: "Una" / "Todas menos la suya" / "Todas" | text | registro/page.tsx | `adminAudit.sessionsScope.one`, `.others`, `.all` | `auth.sessions_revoked` |
| 15 | Detail for an activation: how it happened ("Automático", "Consola", "Enlace del correo"), shown only when there is an actor | text | registro/page.tsx | `adminAudit.via.*` | `account.activated` with actor |
| 16 | Detail for a removed picture: "La había aceptado el revisor" / "La habías aceptado a mano, contra el revisor" (older rows say nothing: "—") | text | registro/page.tsx, `registro/removedAcceptedBy.ts` | `adminAudit.removedAcceptedBy.judge`, `.owner` | `picture.removed` |
| 17 | Detail for an accepted picture: "El revisor había señalado: {allergen names, Spanish}" or "El revisor no había señalado ningún alérgeno" | text | registro/page.tsx, `registro/overriddenAllergens.ts` | `adminAudit.allergensOverridden`, `.allergensOverriddenNone` | `picture.accepted` |
| 18 | Detail "—" for every other action or an unreadable detail | text | registro/page.tsx | not from the dictionary | otherwise |
| 19 | Empty state "El registro empieza el día en que esto se despliega: no hay ninguna fila anterior." | status | AdminTable.tsx | `adminAudit.empty` | no rows, no filter |
| 20 | No-match state "Ninguna acción coincide con el filtro." + "Quitar los filtros" | status + link | AdminTable.tsx | `adminAudit.noMatch`, `adminConsole.table.clearFilters` | filter on and no row |
| 21 | Pager (S-5.15) | list | AdminPager.tsx | `adminConsole.table.*` | more than one page |
| 22 | "Cómo se cuenta" fold, 3 notes (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminAudit.howCounted[0..2]` | always |

## /admin/ajustes/sistema  (apps/web/src/app/(admin)/admin/ajustes/sistema/page.tsx)

Sistema. Admin. 404 if `/admin/system` answers nothing. Only the mail figures follow the period. Plain `DataTable`s with hidden captions.

| # | Element | Kind | Where (component file) | Words (dictionary key) | When shown |
|---|---|---|---|---|---|
| 1 | Page title "Sistema" and intro "Qué versión corre, con qué límites, qué está configurado y si las tareas y el correo funcionan." (S-1) | heading + text | sistema/page.tsx | `adminSystem.title`, `.intro` | always |
| 2 | Period selector (S-2) | link | PeriodSelector.tsx | `adminConsole.period`, `.periodOption` | always |
| 3 | Section "Versiones" (S-3) | heading | AdminSection.tsx | `adminSystem.versionsTitle` | always |
| 4 | Table "Versiones", columns Elemento, Valor; rows: "Versión desplegada" (first seven characters of the commit in monospace, or "Desconocida"), "Plantilla de generación de platos", "Plantilla de reescritura de pasos", "Consentimiento del perfil", "Consentimiento de datos de salud", "Consentimiento del vínculo", "Acuerdo del profesional", "Condiciones de uso" (values are version strings from the API) | table | DataTable.tsx | `adminSystem.versionsTitle`, `.columns.item`, `.columns.value`, `.commit`, `.commitNone`, `.versions.prompt`, `.steps`, `.profileConsent`, `.healthConsent`, `.careConsent`, `.professionalAgreement`, `.terms` | always |
| 5 | Section "Integraciones" (S-3) | heading | AdminSection.tsx | `adminSystem.integrationsTitle` | always |
| 6 | Table of seven yes/no rows ("Sí"/"No"): "Secreto de las tareas programadas", "Correo", "Dirección del dueño para avisos", "Imágenes de los platos", "Notificaciones push", "Reescritura nocturna de los pasos", "Registro de errores" | table | DataTable.tsx | `adminSystem.integrationsTitle`, `.integrations.cronSecret`, `.mail`, `.ownerAddress`, `.pictures`, `.push`, `.rewriteSweep`, `.sentry`, `.yes`, `.no` | always |
| 7 | Section "Tareas programadas" with note "Atrasada si lleva más de 26 h sin terminar." (S-3) | heading + text | AdminSection.tsx | `adminSystem.cronTitle`, `.cronNote` | always |
| 8 | Table "Tareas programadas", columns Tarea, Última ejecución, Estado; rows "Activación de planes", "Avisos de check-in", "Reescritura de los pasos", "Retirada del segundo factor", "Borrado de enlaces caducados" | table | DataTable.tsx | `adminSystem.cronCaption`, `.columns.job`, `.lastRun`, `.state`, `.crons.activations`, `.reminders`, `.rewrite`, `.twoFactorRemovals`, `.verifications` | always |
| 9 | Cells: last finished run date and time (Madrid time) or "Nunca"; state "Al día" or "Atrasada" (stale row marked in colour and in words) | status | sistema/page.tsx | `adminSystem.cronNever`, `.cronState.ok`, `.cronState.stale` | per row |
| 10 | Empty state "Sin tareas." | status | DataTable.tsx | `adminSystem.cronEmpty` | no job rows |
| 11 | Section "Correo" (S-3) | heading | AdminSection.tsx | `adminSystem.mailTitle` | always |
| 12 | Tiles "Enviados" and "Fallidos" (totals for the period; the list has no label) | figure | StatTile.tsx | `adminSystem.mailSeries.sent`, `.failed` | always |
| 13 | Chart "Correos por día": stacked columns, series "Enviados" (success) and "Fallidos" (failure), legend, data table with day header | chart | ColumnChart.tsx | `adminSystem.mailChart`, `.mailSeries.sent`, `.failed`, `adminConsole.day` | always |
| 14 | Empty message "No salió ningún correo en este periodo." (chart and table) | status | ChartFrame.tsx, DataTable.tsx | `adminSystem.mailEmpty` | none |
| 15 | Table "Correo por plantilla", columns Plantilla, Enviados (right), Fallidos (right); one row per template with its label: "Cuenta en espera", "Código de respaldo usado", "Códigos de respaldo nuevos", "Invitación de vínculo", "Aviso de check-in", "Check-in enviado", "Alta con un correo que ya tiene cuenta", "Aviso al propietario", "Resumen diario al propietario", "Aviso de imágenes al propietario", "Llave de acceso añadida", "Contraseña cambiada", "Restablecer contraseña", "Perfil profesional concedido", "Segundo factor desactivado", "Segundo factor activado", "Retirada del segundo factor cancelada", "Retirada del segundo factor pedida", "Segundo factor quitado", "Confirmar correo" (an unknown template shows its raw name) | table | DataTable.tsx | `adminSystem.mailCaption`, `.columns.template`, `.mailKinds.account-waiting`, `.backup-code-used`, `.backup-codes-regenerated`, `.care-invitation`, `.check-in-reminder`, `.checkin-submitted`, `.existing-account-sign-up`, `.owner-alert`, `.owner-digest`, `.owner-picture-alert`, `.passkey-added`, `.password-changed`, `.password-reset`, `.professional-granted`, `.two-factor-disabled`, `.two-factor-enabled`, `.two-factor-removal-cancelled`, `.two-factor-removal-requested`, `.two-factor-removed`, `.verify-email` | always |
| 16 | Section "Límites" (S-3) | heading | AdminSection.tsx | `adminSystem.capsTitle` | always |
| 17 | Table "Límites", columns Elemento, Valor; rows: "Un plato se rechaza pasando este múltiplo del tope de su comida" ("×{n}"), "Raciones entre las que se dimensiona una comida" ("{min}–{max}"), "Tope de kcal por ración, {meal}" for each of the six meals ("{n} kcal"), "Rechazos antes de abandonar una receta en la reescritura", "Tope mensual de imágenes" (dollars) | table | DataTable.tsx | `adminSystem.capsTitle`, `.caps.oversizedFactor`, `.servingBounds`, `.servingKcal`, `.rewriteAttemptBound`, `.pictureMonthlyUsd`, `slots.*` | always |
| 18 | "Cómo se cuenta" fold, 4 notes (`{date}` = 29 Sep 2026) (S-4) | toggle + list | HowCounted.tsx | `adminConsole.howCounted`, `adminSystem.howCounted[0..3]` | always |

## /admin/[...rest]  (apps/web/src/app/(admin)/admin/[...rest]/page.tsx)

See section 1 ("Unknown address"): the page has no elements of its own; it renders the console 404 (F-3.1, F-3.2) with the tab title `errors.notFoundTitle`.

## 3. Not sure

Things that could not be settled from the code alone, or that a redesign should decide on purpose.

1. **No header, language switch, theme control or sign-out exists in the console.** `(admin)` is its own root layout and draws only the sidebar/bar (`AdminNav`) and the page. Project 024 criterion 3 says the five themes and Automático are selectable "from the header on every screen, signed in or not"; the console has no header today, so the plan must decide whether the console gets one (and what it holds). The only way out is the "Volver a NutrIA" link (N-35), which goes to `/inicio`.
2. **The second-factor-required screen has no navigation at all** (F-2.8): no AdminNav, no back link. Whether to keep that is a design choice; the link to `/perfil#seguridad` is its only exit.
3. **Interpolated English wording was not read.** Only `es-ES.ts` was read for the words; `en-GB.ts` is typed as the same shape, so keys are complete by construction, but the English sentences themselves were not checked against the Spanish ones listed here.
4. **Long strings summarised.** Where a dictionary value is long (the six "why" paragraphs in `adminAllowances`, the six "accept effects", `adminPictureReview.removeBody` and `.removeLeftover`, `adminPictures.reasonHelp.*`, the `howCounted` arrays) the row gives the key and a gist, not the full sentence. The key is authoritative; a later check should compare by key, not by the gist.
5. **`AdminPageHeader` versus the Ajustes header.** `/admin/ajustes` draws its own `h1` and intro with its own markup (`ajustes/page.module.css`), not `AdminPageHeader`. Both have the same elements; if a redesign unifies them nothing is lost, but a baseline diff may show a different structure.
6. **Switch hints for pictures, accompaniments, pantry and assistant** are listed as "on/off hints" with their keys rather than quoted in full (see `admin.picturesHint`, `.picturesOffHint`, `.accompanimentsHint`, `.accompanimentsOffHint`, `.pantryRankHint`, `.pantryRankOffHint`, `.assistantHint`, `.assistantOffHint`).
7. **Which `errors.*` sentence appears on a failed row action** depends on the API code returned (`apps/web/src/lib/api.ts` `messageFor`); I did not map every code to every action. The set that can appear is the `errors.*` block of the dictionary (notably `errors.network`, `errors.internal`, `errors.invalidInput`, `errors.request`, `errors.notFound`, `errors.reauthenticationRequired` for the console actions, plus the picture and two-factor codes named in the rows).
8. **Advisories list on `/admin/producto/planes/calidad`** (row 11) renders an empty bordered card when no advisory happened; no empty sentence exists. It is faithful to the code, but looks like an omission.
9. **Counts of people in `/admin/personas/retencion`**: the number of week columns is whatever `retention.weeks` holds; the notes say 1, 2 and 4, so the headers are "Semana 1", "Semana 2", "Semana 4". Not verified against the API's constant.
10. **Hover/long-press titles in charts** (`<title>` inside each mark) are perceivable only to pointer and some assistive technology; they are listed once in S-7.3, not per chart.
11. **Behaviour that is not visible but must survive** (listed in the rows where known, collected here): the table form applies as it changes (300 ms debounce on search); focus is kept on the row after a row action refreshes the table (`useKeepFocus`) and moves to the table's status line when the row disappears; dialogs open with Cancel focused so two Enters never confirm; route announcer focuses the `h1` after navigation; the sort, filter, page and size state lives in the address.
12. **Dark/light and 320 px behaviour** were not inspected (CSS not read beyond the media-query rules in `AdminNav.module.css`); this inventory is of content and controls, not of layout.

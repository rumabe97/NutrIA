# PRD — Project 007: The admin console

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's brief and answers of 2026-09-28 — approved by the owner
> before the plan is written.

- **Status**: delivered — closed by the owner, 2026-09-29
- **Roadmap item**: [`docs/ROADMAP.md` § Later / someday — Admin](../../ROADMAP.md) (promoted to a project by the owner, 2026-09-28)

## Problem

`/admin` is one server page of about 500 lines. It shows four tiles, five switches, the
accounts, the professionals, the inbox, AI usage, the funnel, activity, plans by state, the
last 25 jobs and the generation log, one after the other. Every list is a column of cards
or `label · number` rows. There is no chart, no search, no filter and no sort. Accounts and
the inbox can only be paged 25 at a time, and generations stop at the most recent ones.
The only way to answer "how did sign-ups go this month" or "is generation getting slower"
is to read numbers and compare them in your head.

It also carries readouts from the free-Gemini era that no longer describe production. Since
[`0064`](../../decisions/0064-generation-runs-on-paid-no-training-models-through-openrouter.md),
production runs on paid OpenRouter models. The daily request cap, the reset at Pacific
midnight and the "last refusal" readouts belong to the old setup.

The owner wants a professional console: one page per section, grouped by context, with
charts wherever a trend or a share is the answer, and tables that can be searched and
filtered in place of endless cards. It must be visual and easy to use without losing any
information the service still needs.

## Outcome

- `/admin` is a **console with its own shell**. A sidebar on desktop and a compact menu on
  the phone list the groups and their pages. The ordinary app navigation (`AppNav`) does
  not appear there, and nothing in the ordinary app links to the console
  ([`0028`](../../decisions/0028-an-admin-screen-that-cannot-read-anyone.md) holds).
- Each section has its **own page and URL**, grouped like this:

  | Group | Page | Route |
  | --- | --- | --- |
  | Resumen | Overview | `/admin` |
  | Personas | Cuentas | `/admin/cuentas` |
  | Personas | Profesionales | `/admin/profesionales` |
  | Personas | Buzón | `/admin/buzon` |
  | Producto | Embudo y actividad | `/admin/producto` |
  | Producto | Planes | `/admin/producto/planes` |
  | Generación | Registro | `/admin/generacion` |
  | Generación | IA y modelos | `/admin/generacion/ia` |
  | Catálogo | Recetas | `/admin/catalogo` |
  | Catálogo | Ingredientes | `/admin/catalogo/ingredientes` |
  | Catálogo | Imágenes | `/admin/catalogo/imagenes` |
  | Ajustes | Interruptores y prueba push | `/admin/ajustes` |

- **Charts are drawn by the console itself.** A small set lives in `packages/ui`: line,
  column, stacked column, horizontal bar and funnel, donut, sparkline and a gauge against a
  cap. They render as SVG on the server, with no chart library and no client JavaScript to
  draw them. They look the same in light and dark and follow the HIG
  ([`0057`](../../decisions/0057-the-interface-follows-the-hig.md)). Each one also carries
  its figures as a table or a text alternative, so no number exists only as a shape.
- **Tables replace cards.** A shared data table has server-side search, filters, sortable
  headers, pagination with a choice of page size, and an empty state. All of that state
  lives in the URL, so the back button, a reload and a pasted link all show the same view.
  On a 390 px iPhone the table scrolls sideways inside its own labelled region, with the
  first column pinned. The page itself never scrolls sideways.
- **A period selector** (7 / 30 / 90 days, 30 by default, kept in the URL) drives every
  chart and every "in the last N days" figure on the page it sits on. KPI tiles show the
  figure, the change against the previous period of the same length, and a sparkline.
- **Nothing still needed is lost.** Every figure the current page shows is on exactly one
  new page (inventory below) or is on the removal list with its reason.

### What each page shows

- **Resumen.** KPI tiles: total accounts, new accounts in the period, accounts waiting for
  activation, people active in the period, plans generated, generation success rate,
  unread messages, and picture spend against the cap. Two charts: sign-ups per day (line)
  and generations per day by outcome (stacked columns). A **"Needs you"** panel links
  straight to accounts waiting for activation, unread messages and failed generations in
  the last 24 h.
- **Cuentas.** Everything the current list shows, plus milestone columns: onboarding
  finished, number of plans, last activity, professional or not. These are milestones,
  never content. You can search by email and filter by confirmed, activated, tier, role,
  professional and onboarded. Every column sorts. The row actions are unchanged: activate,
  change tier, grant or revoke professional. The banner after the mailed activation link
  (`?abierta=`) lands here. Above the table sits a chart of sign-ups per week.
- **Profesionales.** Who has been granted the practice and their link counts, never a
  client named. Shown as a table with the same search and sort.
- **Buzón.** Messages in a table: date, sender, text, seen or not. You can search the text
  and sender and filter seen / not seen. Marking a message seen or reopening it works as
  today. Above the table, messages per week (columns).
- **Embudo y actividad.** The eight-step funnel as a funnel chart, with the share of the
  previous step on each bar. Active people per day (line) and each tracked event per day
  (multi-line), for the period.
- **Planes.** Plans by state (donut, with the counts beside it) and plans created per day
  (columns).
- **Registro (generaciones).** Every generation, not only the latest. It is a paged table
  that filters by outcome and failure code, searches by email and narrows by date range.
  Each row opens to its model calls with every field shown today: round, slot, model asked
  and answered, provider, time, tokens (reasoning included), dishes returned and kept,
  rejections by reason, the error and quota detail, and the request id. Charts: outcome per
  day (stacked columns), duration p50 / p95 per day (line) and failures by code
  (horizontal bars).
- **IA y modelos.** For the period: calls, failed calls, input and output tokens and
  average latency as tiles. Calls per day (line), tokens per day in and out (stacked
  columns) and a per-model / per-provider table (calls, failed, tokens, average latency),
  with a bar chart of its calls. These figures come from the `ai_call` analytics events the
  service already records.
- **Recetas.** A read-only table of the catalogue: name, locale, meal slot, the four
  macros, allergens, picture state and source (seed or generated). It searches by name and
  filters by slot, allergen, picture state, source and locale. Tiles give the counts and
  there is a chart of recipes by slot. Editing the catalogue stays in the seed file in git
  (`0028`).
- **Ingredientes.** A read-only table of ingredients with search and the attributes the
  catalogue stores (category, allergens, where it is sold).
- **Imágenes.** The picture pipeline in figures: spend this month against
  `AI_IMAGE_MONTHLY_CAP_USD` (gauge), spend per day (line) and pictures by state (ready,
  failed, drawing, released) as a donut.
- **Ajustes.** All five switches in one place with their current explanations:
  automatic activation, premium, check-in reminders, dish pictures and professional
  practice. The push test button is there too.

### Inventory — every figure the current page shows, and where it goes

| Today on `/admin` | Goes to |
| --- | --- |
| Tiles: accounts + waiting, recipes + without picture, ingredients, failures in N days | Resumen (tiles), Catálogo › Recetas (counts) |
| `?abierta=` "just opened" banner | Cuentas |
| Switches: automatic activation, premium, reminders, pictures, professional | Ajustes |
| Push test button | Ajustes |
| Picture spend vs cap, ready, failed, drawing, released | Catálogo › Imágenes |
| Accounts list, activate, tier, professional grant, pager | Cuentas (table) |
| Professionals list, hint | Profesionales |
| Inbox, waiting count, seen / reopen, pager | Buzón (table) |
| AI: calls, tokens in/out, model, per model·provider calls/failed/tokens/avg time | Generación › IA y modelos |
| Funnel with share of the step above | Producto › Embudo |
| Activity: people and events in the window | Producto › Embudo |
| Plans by state | Producto › Planes |
| Last 25 jobs with state, date, seconds, attempts, code, detail | Generación › Registro (the same rows, as a filter) |
| Generation log with account, plan version/model/prompt/reused, code, detail, calls | Generación › Registro |

### Removed on purpose ("todo lo que actualmente no necesitamos")

- **The free-Gemini quota readouts.** These are the daily request cap next to the call
  count, "resets at" (Pacific midnight), "last refusal", the refused-by-quota count and the
  tokens-per-minute limit. Paid OpenRouter has no such daily allowance (`0064`). The
  environment variables `AI_REQUESTS_PER_DAY` and `AI_TOKENS_PER_MINUTE` are read only to
  show them, so they go too. A call refused with a 429 still shows up as a failed call,
  with its status, in IA y modelos and in the log.
- **The separate "last 25 jobs" list and `GET /admin/failures`.** Both duplicate the
  generation log. They become the Registro table filtered by outcome. `/admin/failures`
  has no caller in the web app.
- **Long explanatory paragraphs on every section.** A one-line description per page and
  help text on demand replace them.
- **The query-string pagers `?cuentas=` / `?buzon=`.** The table's own URL state replaces
  them.

`GET /admin/activate` stays, because the "account waiting" mail links to it.

## Scope

**In**

- A separate root layout and route group for the console: its own shell and navigation,
  no `AppNav`, no offline copy of its pages (they hold emails), gated so that every
  console route answers 404 to anyone who is not an admin.
- The twelve pages above, in both dictionaries (`es-ES`, `en-GB`).
- Chart components and a data-table component, in `packages/ui` where they are generic and
  in `apps/web` where they are console-specific.
- API support: time series per day over a period; server-side search, filters, sort and
  paging for accounts, feedback, generations, recipes and ingredients; account milestone
  columns; per-period AI and picture figures; removal of the endpoints and fields listed
  above. Every new route sits behind the existing admin role guard.
- Unit specs for the new domain code, end-to-end coverage for every new or changed admin
  route (404 for a non-admin included), an accessibility review and a local probe at
  320 / 390 / 1280 px, light and dark.

**Out**

- Anything that reads a person's food, plan, profile or health data. No plan viewer and no
  profile viewer (`0028`).
- Editing the catalogue from the console (it stays in the seed file in git).
- Safety-flag triage (still nothing to triage), the OmniRoute gateway's own health and
  usage (production does not route through it), and billing or Stripe figures (payments
  are deferred).
- Exporting to CSV, alerts or notifications, and real-time updates. A page shows the
  figures of the moment it was loaded.
- A chart library.

## Acceptance criteria

1. Every route in the table above renders for an admin. A signed-in non-admin gets
   **404**, both on the page and on every API route it calls. With no session, every API
   route it calls answers 404, the API's standing rule, and the web's proxy sends the
   visitor to sign-in before any page renders. The API side is proven by end-to-end tests.
2. No console page renders `AppNav`, and no page outside the console links to `/admin`.
3. The console navigation shows the six groups and their pages, marks the current page
   (`aria-current`) and works with the keyboard and at 320 px.
4. Every row of the inventory table is visible on the page named for it. Every item on the
   removal list is gone from web, API and environment validation, with no dangling
   reference (`rg` for each removed name finds nothing outside history).
5. Cuentas, Buzón, Registro, Recetas and Ingredientes are data tables with server-side
   search, their listed filters, sortable columns and paging. All their state is in the URL
   and survives a reload and the back button. No console list renders as a stack of cards.
6. Every chart named above exists. Each is SVG rendered on the server, readable in light
   and dark, and has a text or table alternative with the same figures. No chart library is
   added to any `package.json`.
7. The period selector (7 / 30 / 90 days, 30 by default) changes every chart and period
   figure on its page. KPI tiles show the change against the previous period.
8. The account actions (activate, tier, professional), the feedback actions (seen /
   reopen), the five switches and the push test behave exactly as they do today.
9. No new API response carries a plan, a meal, a profile field, a health value or a
   person's allergy. Account rows carry milestones only. This is reviewed by the
   invariant-reviewer.
10. Both dictionaries are at parity for every new string, and `check:leaks` passes.
11. The accessibility agent passes every console page, and the local probe shows no
    sideways page scroll at 320, 390 and 1280 px in either theme.
12. The workspace gate (format, lint, types, unit tests, build) is green at every phase
    boundary.

## Open questions

- None. The structural choices are recorded in [`0068`](../../decisions/0068-the-admin-is-a-console-of-pages-that-still-reads-nobody.md) (the console, its shell, what it removes and how periods are counted) and [`0069`](../../decisions/0069-admin-charts-are-server-rendered-svg.md) (the chart set).

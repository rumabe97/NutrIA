# 0068 — The admin is a console of pages that still reads nobody

- **Status**: accepted
- **Date**: 2026-09-28
- **Project**: [docs/projects/007-admin-console](../projects/007-admin-console/)

## Context

[`0028`](./0028-an-admin-screen-that-cannot-read-anyone.md) made `/admin` one screen that
answers only questions needing nobody's data. Later decisions added sections to that one
page: accounts (`0030`), the inbox (`0037`), AI usage, the generation log (`0050`),
professionals (`0059`) and pictures (`0066`). It is now about 500 lines of stacked cards.
There is no chart, no search and no filter, and some readouts describe the free-Gemini
setup that [`0064`](./0064-generation-runs-on-paid-no-training-models-through-openrouter.md)
retired. The owner asked for a professional console: one page per section, grouped by
context, with charts and searchable tables, its own navigation, and nothing kept that is no
longer needed.

## Decision

- **A console, not a screen.** `/admin` becomes twelve pages in six groups: Resumen,
  Personas, Producto, Generación, Catálogo, Ajustes. Each page has a Spanish route under
  `/admin/…` (the route list is in the project's PRD).
- **Its own shell.** The console lives in its own route group, `app/(admin)`, with its own
  root layout. That layout has no `AppNav`, no offline provider and no offline copy,
  because its pages hold email addresses and must never sit in a browser cache for offline
  reading. The service worker (`apps/web/public/sw.js`) already stores only the pages it
  names, and none of them is in the console. The console has its own navigation: a
  sidebar on wide screens and a menu on the phone. A nested `admin/layout.tsx` calls
  `notFound()` unless the API confirms the caller is an admin, so every console page
  answers 404 to any other signed-in account, rendered by its own `not-found.tsx` inside
  the shell. The API's `@Roles('admin')` guard stays the real check, and it answers 404 to
  a caller with no session too. The layout is only the page-side mirror of it. Nothing
  outside the console links to it.
- **0028's rule stands unchanged.** No page, table or endpoint of the console carries a
  plan, a meal, a profile field, a health value or anybody's allergy. Account rows gain
  milestones only: onboarding finished, number of plans, last activity, professional or
  not. These are dates and counts about the account, never what the account eats. The
  catalogue tables are allowed because they name no person.
- **Periods.** Every chart and "in the last N days" figure uses a period of 7, 30 or 90
  days (30 by default) and compares it with the previous period of the same length. Days
  are calendar days in `Europe/Madrid`, the owner's time. A day with nothing in it is a
  zero, never a missing point.
- **Tables are server-side.** Search, filters, sort and paging run in SQL, and their whole
  state lives in the URL. The same form works without JavaScript as a plain GET.
- **Removed.** The free-Gemini quota readouts go: the daily request cap, "resets at",
  "last refusal", refused-by-quota and tokens per minute. So do the environment variables
  `AI_REQUESTS_PER_DAY` and `AI_TOKENS_PER_MINUTE`, which only fed those readouts. The
  separate "last 25 jobs" list and `GET /admin/failures` go too; they duplicate the
  generation log, which becomes a filterable table of every generation.
  `GET /admin/activate` stays, because the waiting-account mail links to it.

## Alternatives considered

- **Keep one page and add anchors, tabs and charts.** It would still be one long render
  that fetches everything on every visit, and it cannot give each section a URL of its own.
- **A nested layout inside `(app)`.** A nested layout cannot remove what its parent root
  layout draws, so `AppNav` and the offline copy would stay.
- **Client-side tables over the whole list.** They are fine at today's sizes, but they
  ship every row to the browser and stop working once accounts or generations grow past a
  page or two.
- **UTC days.** Simpler SQL, but an evening in Spain would count as the next day on every
  chart the owner reads.

## Consequences

- Moving between the console and the app is a full page load, because they are different
  root layouts. That is acceptable for an owner-only surface.
- `analytics_events` gets an `(event, created_at)` index and `plan_generation_jobs` a
  `created_at` index, so per-day series stay cheap as the tables grow.
- Removing the two environment variables from validation is harmless where they are still
  set. The owner may delete them from the API project whenever convenient.
- Adding a section later means a new page and a nav entry. It does not mean growing a
  single file.

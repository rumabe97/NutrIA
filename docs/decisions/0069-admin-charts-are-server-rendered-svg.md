# 0069 — Admin charts are server-rendered SVG from packages/ui

- **Status**: accepted
- **Date**: 2026-09-28
- **Project**: [docs/projects/007-admin-console](../projects/007-admin-console/)

## Context

The console ([`0068`](./0068-the-admin-is-a-console-of-pages-that-still-reads-nobody.md))
needs line, column, stacked column, horizontal bar, funnel, donut, sparkline and gauge
charts. The workspace has no chart dependency. Its one chart, `WeightChart`, is hand-drawn
SVG. The interface follows the HIG
([`0057`](./0057-the-interface-follows-the-hig.md)), runs on free tiers and is tested on
an iPhone.

## Decision

- **A small chart set in `packages/ui`**, drawn by the component as SVG from plain arrays
  of numbers and labels:
  - `LineChart` (one or more series);
  - `ColumnChart` (single or stacked);
  - `BarChart` (horizontal, also used as the funnel with a share label per bar);
  - `DonutChart`;
  - `Sparkline`;
  - `Gauge` (a value against a cap);
  - `StatTile` (figure, change against the previous period, optional sparkline).
- **Rendered on the server.** No chart is a client component, and none needs JavaScript to
  draw. Each mark carries an SVG `<title>` with its exact figure, so it can be read on
  hover or focus.
- **No number lives only in a shape.** Each chart has an accessible name and a visible
  "Ver datos" / "Show data" disclosure holding the same figures as a table. A donut always
  shows its legend with counts.
- **Colours come from the design tokens**, validated for light and dark and for contrast.
  The executor loads the `dataviz` and `apple-web-design` skills before writing a chart.
- **Scales are honest.** Columns and bars start at zero, time runs left to right at real
  spacing, and an empty series draws an empty state, never a flat line that looks like
  data.

## Alternatives considered

- **Recharts (or another library).** It would be quicker to start and brings interaction
  for free. But it adds client-only components and around 100 KB of JavaScript to every
  console page, and its styling would have to be fought to look like the rest of the
  product.
- **Charts local to `apps/web`.** They would work, but these are generic primitives. The
  docs app can show them, and a future screen (progress, the dietitian's practice) can
  reuse them.

## Consequences

- There are no hover crosshairs, zooming or live tooltips. Anything that needs real
  interaction later is a new decision.
- Each chart ships with its colocated test and a docs page in `apps/docs`, as
  `packages/ui/AGENTS.md` asks of every component.

import { AdminGenerationsRepository, AdminSeriesRepository, JOB_STATUSES } from '#repositories/Admin';
import { madridDayKeys, madridMidnight, shiftDay, windowFor } from 'core/domain/Period';

import { presentGeneration } from './AdminController';
import { presentGroup, presentWindow } from './AdminSeriesController';

import type { AdminGenerationView } from './AdminController';
import type { DaySeriesGroup, PeriodWindowView } from './AdminSeriesController';
import type { GenerationFilter } from '#repositories/Admin';
import type { GenerationQuery } from 'core/entities/AdminQuery';
import type { Paged } from 'core/controllers/User';
import type { Period } from 'core/entities/Period';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One page of the generation log (`GET /admin/generations`): every row exactly
 * as the log has always shown it — the job, the account's address and name,
 * the plan and every model call — and `total`, every generation the filters
 * match.
 */
export type AdminGenerationsView = Paged<AdminGenerationView>;

/**
 * How long the generations that finished took, per Madrid day, in seconds to
 * one decimal. A day with none is `null` — not a zero, which would read as
 * instant — so a line breaks there.
 */
export type DurationSeries = { readonly days: readonly string[]; readonly p50: readonly (number | null)[]; readonly p95: readonly (number | null)[] };

/**
 * Registro's charts (`GET /admin/generations/stats?period=`). Counts and
 * durations only: no address, no plan (`0028`).
 */
export type AdminGenerationStatsView = {
  /** Finished generations' median and 95th percentile per day, by the day each was made. */
  readonly durations: DurationSeries;
  /** Failed generations made in the period, by code, the commonest first. `null` is a failure that recorded no code. */
  readonly failuresByCode: readonly { readonly code: string | null; readonly n: number }[];
  /** Generations per day by the status each is in now — the same series as Resumen's chart. */
  readonly outcomes: DaySeriesGroup;
  readonly period: Period;
  /**
   * Dishes the model proposed and the service rejected, per reason, over the period's
   * generations, the commonest first. Totals over everybody: this is where `allergen`
   * and `unwanted` may be counted, since nothing here names a person (`0028`).
   */
  readonly rejectionsByReason: readonly { readonly n: number; readonly reason: string }[];
  readonly window: PeriodWindowView;
};

function tenths(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}

/**
 * The query's time filters as instants. `since` is the last 24 hours or a
 * console period (its first Madrid midnight, as every period means); `from`
 * and `to` are Madrid days, both included. Every one given applies, so the
 * narrowest wins. Exported for its spec.
 */
export function generationFilter(query: GenerationQuery, now: Date): GenerationFilter {
  const since =
    query.since === undefined
      ? undefined
      : query.since === '24h'
        ? new Date(now.getTime() - DAY_MS)
        : windowFor(Number(query.since) as Period, now).from;
  const from = query.from === undefined ? undefined : madridMidnight(query.from);
  const after = since === undefined ? from : from === undefined ? since : new Date(Math.max(since.getTime(), from.getTime()));

  return {
    after,
    before: query.to === undefined ? undefined : madridMidnight(shiftDay(query.to, 1)),
    code: query.code,
    q: query.q,
    status: query.status
  };
}

/**
 * Registro (`0050`, `0068`): the generation log as a table, and its charts.
 * The log is the one console read that names somebody — an address per job —
 * which is why the API gives it a controller of its own (`0028`).
 */
export const AdminLogController = {
  /** One page of the log, newest first, as the query filters it. */
  async page(query: GenerationQuery, now = new Date()): Promise<AdminGenerationsView> {
    const { rows, total } = await AdminGenerationsRepository.page(generationFilter(query, now), query.offset, query.size);

    return { offset: query.offset, rows: rows.map(presentGeneration), size: query.size, total };
  },

  /** Outcome per day, the durations per day, the failures by code and the rejections by reason, over the period. */
  async stats(period: Period, now = new Date()): Promise<AdminGenerationStatsView> {
    const window = windowFor(period, now);
    const days = madridDayKeys(window.from, window.to);
    const [outcomes, durations, failures, rejections] = await Promise.all([
      AdminSeriesRepository.generationsPerDay(window.from, window.to),
      AdminGenerationsRepository.durationsPerDay(window.from, window.to),
      AdminGenerationsRepository.failuresByCode(window.from, window.to),
      AdminGenerationsRepository.rejectionsByReason(window.from, window.to)
    ]);
    const byDay = new Map(durations.map(row => [row.day, row]));

    return {
      durations: {
        days,
        p50: days.map(day => {
          const row = byDay.get(day);

          return row === undefined ? null : tenths(row.p50);
        }),
        p95: days.map(day => {
          const row = byDay.get(day);

          return row === undefined ? null : tenths(row.p95);
        })
      },
      failuresByCode: failures.map(row => ({ code: row.code, n: row.n })),
      outcomes: presentGroup(days, JOB_STATUSES, outcomes),
      period,
      rejectionsByReason: rejections.map(row => ({ n: row.n, reason: row.reason })),
      window: presentWindow(window)
    };
  }
};

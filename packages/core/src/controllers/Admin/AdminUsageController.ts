import { AdminAiRepository, AdminRepository, AdminSeriesRepository } from '#repositories/Admin';
import { pictureReasonOf } from 'core/entities/DishPicture';
import { fillDays, madridDayKey, madridDayKeys, windowFor } from 'core/domain/Period';

import { AdminController, aiModelOf } from './AdminController';
import { AdminTextSpend } from './AdminTextSpend';
import { presentWindow } from './AdminSeriesController';

import type { AdminPicturesView, AiModelUsage } from './AdminController';
import type { TextMonthView } from './AdminTextSpend';
import type { AiCallDayRow } from '#repositories/Admin';
import type { DaySeries, DaySeriesGroup, PeriodComparison, PeriodWindowView } from './AdminSeriesController';
import type { Period } from 'core/entities/Period';
import type { PictureReason } from 'core/entities/DishPicture';

/** The period's provider requests against the period before it. */
export type AiPeriodTotals = {
  /** Mean of our own clock over the calls that recorded one; null for a period with none. */
  readonly averageMs: { readonly current: number | null; readonly previous: number | null };
  readonly calls: PeriodComparison;
  /**
   * Dollars the text models billed (`costUsd` on each `ai_call`): the dishes generated
   * for plans and the nightly step rewrites — the event does not say which. Pictures
   * are billed apart (`/admin/pictures`).
   */
  readonly costUsd: PeriodComparison;
  /** Calls recorded `ok: false`: refused, timed out, or answered with something unusable. */
  readonly failed: PeriodComparison;
  readonly inputTokens: PeriodComparison;
  readonly outputTokens: PeriodComparison;
};

/**
 * IA y modelos (`GET /admin/ai?period=`): the period's usage, all from the
 * `ai_call` events `StructuredAiClient` records. Counts, tokens, clocks and
 * model names; no person, no prompt, no answer (`0028`). Only the fields
 * `/admin/generacion/ia` reads — a page that grows a field it needs adds one
 * here, deliberately.
 */
export type AdminAiView = {
  /** Provider requests per day, whatever their outcome. */
  readonly callsPerDay: DaySeries;
  /**
   * The period's calls by the model that answered and who served it (`aiModelOf`),
   * the most used first.
   */
  readonly models: readonly AiModelUsage[];
  /**
   * The UTC month so far (not the period): spend, calls with no cost recorded and
   * spend per feature, always; `capUsd`, `share` and `sweepPaused` only when
   * `AI_TEXT_MONTHLY_CAP_USD` is set.
   */
  readonly month: TextMonthView;
  readonly period: Period;
  /** Dollars the text models billed per day, to six places as the events carry them. */
  readonly spendPerDay: DaySeries;
  /** Tokens per day: keys `input` and `output`, both always present. */
  readonly tokensPerDay: DaySeriesGroup;
  readonly totals: AiPeriodTotals;
  readonly window: PeriodWindowView;
};

/**
 * Imágenes (`GET /admin/pictures?period=`): this month's spend against the cap
 * and the pictures by state, as before, and the spend per day over the period.
 */
export type AdminPicturesPeriodView = AdminPicturesView & {
  /**
   * Pictures that failed for the dish's own reasons in the period (by when they ended), by closed
   * reason (`PICTURE_REASONS`), the commonest first; reasons with none are left out.
   */
  readonly failedByReason: readonly PictureReasonCount[];
  readonly period: Period;
  /** Pictures given back in the period for a reason that is not the dish's, by closed reason, the commonest first. */
  readonly releasedByReason: readonly PictureReasonCount[];
  /** Dollars billed for pictures per day, from `recipe_image_calls`. */
  readonly spendPerDay: DaySeries;
  readonly window: PeriodWindowView;
};

export type PictureReasonCount = { readonly n: number; readonly reason: PictureReason };

/** Rows counted by their closed reason, the commonest first and then by name, so the order is stable. Exported for its spec. */
export function countByReason(rows: readonly { readonly provenance: Record<string, unknown> | null }[]): readonly PictureReasonCount[] {
  const counts = new Map<PictureReason, number>();

  for (const row of rows) {
    const reason = pictureReasonOf(row.provenance);

    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return [...counts].map(([reason, n]) => ({ n, reason })).sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason));
}

/** The two token series, in the order a stacked chart draws them. */
export const TOKEN_KEYS = ['input', 'output'] as const;

type Totals = { calls: number; costUsd: number; failed: number; inputTokens: number; outputTokens: number; timed: number; totalMs: number };

const ZERO: Totals = { calls: 0, costUsd: 0, failed: 0, inputTokens: 0, outputTokens: 0, timed: 0, totalMs: 0 };

function add(total: Totals, row: AiCallDayRow): Totals {
  return {
    calls: total.calls + row.calls,
    costUsd: total.costUsd + row.costUsd,
    failed: total.failed + (row.failed ? row.calls : 0),
    inputTokens: total.inputTokens + row.inputTokens,
    outputTokens: total.outputTokens + row.outputTokens,
    timed: total.timed + row.timed,
    totalMs: total.totalMs + row.totalMs
  };
}

/** Cents added one call at a time drift in binary; dollars to six places, as the events carry them. */
function dollars(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function average({ timed, totalMs }: Pick<Totals, 'timed' | 'totalMs'>): number | null {
  return timed > 0 ? Math.round(totalMs / timed) : null;
}

/**
 * The period's grouped `ai_call` rows by model and provider, summed and
 * grouped by `aiModelOf`'s rule. Exported for its spec.
 */
export function modelsOf(rows: readonly AiCallDayRow[]): readonly AiModelUsage[] {
  const models = new Map<string, AiModelUsage & { timed: number; totalMs: number }>();

  for (const row of rows) {
    const { model, provider } = aiModelOf(row);
    const key = `${model} ${provider ?? ''}`;
    const entry = models.get(key) ?? {
      averageMs: null,
      calls: 0,
      costUsd: 0,
      failed: 0,
      inputTokens: 0,
      model,
      outputTokens: 0,
      provider,
      reasoningTokens: 0,
      timed: 0,
      totalMs: 0
    };

    entry.calls += row.calls;
    entry.failed += row.failed ? row.calls : 0;
    entry.costUsd += row.costUsd;
    entry.inputTokens += row.inputTokens;
    entry.outputTokens += row.outputTokens;
    entry.reasoningTokens += row.reasoningTokens;
    entry.timed += row.timed;
    entry.totalMs += row.totalMs;
    models.set(key, entry);
  }

  return [...models.values()]
    .map(({ timed, totalMs, ...entry }) => ({ ...entry, averageMs: average({ timed, totalMs }) }))
    .sort((a, b) => b.calls - a.calls);
}

/**
 * The console's usage pages over a period (`0068`): provider requests and
 * picture spend per day. Pictures keep this month's count against the cap
 * (`AdminController.pictures`, unchanged) beside the period's spend.
 */
export const AdminUsageController = {
  /**
   * The period's usage: totals against the period before, calls and tokens
   * per day, and the calls by model.
   */
  async ai(period: Period, now = new Date(), textCapUsd?: number): Promise<AdminAiView> {
    const window = windowFor(period, now);
    const days = madridDayKeys(window.from, window.to);
    const firstDay = madridDayKey(window.from);
    const [rows, month] = await Promise.all([AdminAiRepository.callsPerDay(window.previousFrom, window.to), AdminTextSpend.month(now, textCapUsd)]);
    const current = rows.filter(row => row.day >= firstDay);
    const previous = rows.filter(row => row.day < firstDay);
    const inPeriod = current.reduce(add, ZERO);
    const before = previous.reduce(add, ZERO);
    const per = (value: (row: AiCallDayRow) => number) =>
      fillDays(
        days,
        current.map(row => ({ day: row.day, n: value(row) }))
      );

    return {
      callsPerDay: { days, values: per(row => row.calls) },
      models: modelsOf(current),
      month,
      period,
      spendPerDay: { days, values: per(row => row.costUsd).map(dollars) },
      tokensPerDay: {
        days,
        series: [
          { key: TOKEN_KEYS[0], values: per(row => row.inputTokens) },
          { key: TOKEN_KEYS[1], values: per(row => row.outputTokens) }
        ]
      },
      totals: {
        averageMs: { current: average(inPeriod), previous: average(before) },
        calls: { current: inPeriod.calls, previous: before.calls },
        costUsd: { current: dollars(inPeriod.costUsd), previous: dollars(before.costUsd) },
        failed: { current: inPeriod.failed, previous: before.failed },
        inputTokens: { current: inPeriod.inputTokens, previous: before.inputTokens },
        outputTokens: { current: inPeriod.outputTokens, previous: before.outputTokens }
      },
      window: presentWindow(window)
    };
  },

  /** This month's pictures against the cap, as before, and the spend per day over the period. `capUsd` is `AI_IMAGE_MONTHLY_CAP_USD`. */
  async pictures(period: Period, capUsd: number, now = new Date()): Promise<AdminPicturesPeriodView> {
    const window = windowFor(period, now);
    const days = madridDayKeys(window.from, window.to);
    const [month, spend, ended] = await Promise.all([
      AdminController.pictures(capUsd, now),
      AdminSeriesRepository.pictureSpendPerDay(window.from, window.to),
      AdminRepository.failedPictures(window.from, window.to)
    ]);

    return {
      ...month,
      failedByReason: countByReason(ended.filter(row => !row.released)),
      period,
      releasedByReason: countByReason(ended.filter(row => row.released)),
      // Cents added one day at a time drift in binary; a day's dollars to six places, as the column stores them.
      spendPerDay: { days, values: fillDays(days, spend).map(value => Math.round(value * 1e6) / 1e6) },
      window: presentWindow(window)
    };
  }
};

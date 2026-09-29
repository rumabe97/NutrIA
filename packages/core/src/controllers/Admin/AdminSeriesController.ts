import { AdminAiRepository, AdminRepository, AdminSeriesRepository, JOB_STATUSES, PLAN_STATUSES } from '#repositories/Admin';
import { PRODUCT_EVENTS } from 'core/entities/Analytics';
import { fillDays, fillWeeks, madridDayKey, madridDayKeys, madridWeekKeys, windowFor } from 'core/domain/Period';
import { monthStart } from 'core/controllers/Recipe';

import type { Funnel, KeyedDayCountRow, Outcomes } from '#repositories/Admin';
import type { Period, PeriodWindow } from 'core/entities/Period';

// ─── Presenters ──────────────────────────────────────────────────────────────

/**
 * A figure per Madrid calendar day, shared by every console chart (`0068`).
 *
 * `days` are `YYYY-MM-DD` in `Europe/Madrid`, oldest first, one per day of the
 * period whether or not anything happened; `values` has one number per day, in
 * the same order, and a quiet day is `0`, never a gap.
 */
export type DaySeries = { readonly days: readonly string[]; readonly values: readonly number[] };

/**
 * Several figures over the same days — one per job status, one per event.
 * `key` is the raw value (`succeeded`, `session_started`); the page names it
 * in its own language. Every possible key is present, zeros included, so a
 * chart's legend does not change with what happened.
 */
export type DaySeriesGroup = {
  readonly days: readonly string[];
  readonly series: readonly { readonly key: string; readonly values: readonly number[] }[];
};

/** A figure over the chosen period and over the period of the same length before it. */
export type PeriodComparison = { readonly current: number; readonly previous: number };

/**
 * A share between 0 and 1 over each period, or null for a period with nothing
 * to divide: no generation finished is not a 0 % success rate.
 */
export type RateComparison = { readonly current: number | null; readonly previous: number | null };

/** A compared figure with its own days, for a tile's sparkline. */
export type TrendTile = PeriodComparison & { readonly sparkline: DaySeries };

/** The period a console answer covers, as ISO instants (see `PeriodWindow`). */
export type PeriodWindowView = {
  /** The first instant of the period: a Madrid midnight. */
  readonly from: string;
  /** The first instant of the period before it, which ends at `from`. */
  readonly previousFrom: string;
  /** When the answer was made; the period runs up to here. */
  readonly to: string;
};

/**
 * Resumen (`GET /admin/summary?period=`): the tiles, the two charts and what
 * needs the owner now. Counts and sums only — no person, no plan, no profile,
 * no allergy (`0028`).
 */
export type AdminSummaryView = {
  readonly charts: {
    /** Generations per day by the status each is in now: `queued`, `running`, `succeeded`, `failed`. */
    readonly generations: DaySeriesGroup;
    /** Accounts created per day. */
    readonly signUps: DaySeries;
  };
  /** What wants a hand now, whatever the period. Each links to its page. */
  readonly needsYou: {
    /** Failed generations made in the 24 hours before `window.to`. */
    readonly failedGenerations: number;
    /** Messages not marked dealt with. */
    readonly unreadMessages: number;
    /** Accounts not yet activated. */
    readonly waitingAccounts: number;
  };
  readonly period: Period;
  readonly tiles: {
    /** Distinct people who started a session in the period — one person counts once, however many days. */
    readonly activePeople: TrendTile;
    /** Accounts created in the period; the sparkline is `charts.signUps`. */
    readonly newAccounts: TrendTile;
    /**
     * Dish pictures (`0066`): `spentUsd` is the period against the one before
     * it; `monthSpentUsd` is the calendar month (UTC) so far, which is what the
     * cap counts against.
     */
    readonly pictures: {
      readonly capUsd: number;
      readonly monthSpentUsd: number;
      /** Where the month's count started, ISO. */
      readonly monthStart: string;
      readonly spentUsd: PeriodComparison;
    };
    /** Plans made in the period. A plan row exists only for a generation that succeeded. */
    readonly plansGenerated: TrendTile;
    /** Succeeded ÷ (succeeded + failed) among the generations made in each period. */
    readonly successRate: RateComparison;
    /**
     * Dollars the text models billed — the dishes generated for plans and the nightly
     * step rewrites, which the `ai_call` event does not tell apart — against the
     * period before; the sparkline is the period's spend per day. Pictures are apart.
     */
    readonly textAi: { readonly sparkline: DaySeries; readonly spentUsd: PeriodComparison };
    /** Every account there is. */
    readonly totalAccounts: number;
    /** Messages not marked dealt with. */
    readonly unreadMessages: number;
    /** Accounts not yet activated. */
    readonly waitingAccounts: number;
  };
  readonly window: PeriodWindowView;
};

/**
 * Embudo y actividad (`GET /admin/product?period=`). The funnel is counted from
 * state over every account that ever existed, exactly as `analytics` counts it
 * (`0033`); only the two series follow the period.
 */
export type AdminProductView = {
  /** Distinct people who started a session, per day. */
  readonly activePeople: DaySeries;
  /** Each tracked event per day, `ai_call` excepted: it has its own page. */
  readonly events: DaySeriesGroup;
  readonly funnel: Funnel;
  readonly period: Period;
  readonly window: PeriodWindowView;
};

/** Planes (`GET /admin/plans?period=`): every plan by the state it is in now, and plans made per day. */
export type AdminPlansView = {
  /** Every state there is, in the schema's order, zeros included. Not only the period's plans. */
  readonly byState: readonly { readonly n: number; readonly status: string }[];
  /** Plans made per day in the period. */
  readonly created: DaySeries;
  readonly period: Period;
  readonly window: PeriodWindowView;
};

/**
 * A figure per ISO week (Monday to Sunday) in `Europe/Madrid` (`0068`).
 *
 * `weeks` names each week by its Monday as `YYYY-MM-DD`, oldest first, one per
 * week with a day in the period whether or not anything happened; `values` has
 * one number per week in the same order, and a quiet week is `0`. The first
 * and last weeks are usually partial: they count only the period's days, so
 * the first week's Monday can fall before `window.from`. The shape of
 * `DaySeries`, with weeks for days.
 */
export type WeekSeries = { readonly values: readonly number[]; readonly weeks: readonly string[] };

/**
 * Cuentas and Buzón's charts (`GET /admin/people?period=`): accounts created
 * and messages written per week. Counts only — no address, no message
 * (`0028`, `0037`).
 */
export type AdminPeopleView = {
  /** Messages written to the owner per week. */
  readonly messages: WeekSeries;
  readonly period: Period;
  /** Accounts created per week. */
  readonly signUps: WeekSeries;
  readonly window: PeriodWindowView;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Events the console charts per day: what people did, never what the service did (`0071`). */
const CHARTED_EVENTS: readonly string[] = PRODUCT_EVENTS;

export function presentWindow(window: PeriodWindow): PeriodWindowView {
  return { from: window.from.toISOString(), previousFrom: window.previousFrom.toISOString(), to: window.to.toISOString() };
}

/** Keyed rows as one series per key, every key present, in the order given. */
export function presentGroup(days: readonly string[], keys: readonly string[], rows: readonly KeyedDayCountRow[]): DaySeriesGroup {
  return {
    days,
    series: keys.map(key => ({
      key,
      values: fillDays(
        days,
        rows.filter(row => row.key === key)
      )
    }))
  };
}

function rate({ failed, succeeded }: Outcomes): number | null {
  const finished = failed + succeeded;

  return finished === 0 ? null : succeeded / finished;
}

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * The console's figures over a period (`0068`): each page's tiles, charts and
 * comparisons, with the period's own days. It reads `AdminSeriesRepository`,
 * which counts and never lists, so nothing here can name a person (`0028`).
 */
export const AdminSeriesController = {
  /** Sign-ups and messages per ISO week over the period, Madrid weeks, zeros included. */
  async people(period: Period, now = new Date()): Promise<AdminPeopleView> {
    const window = windowFor(period, now);
    const weeks = madridWeekKeys(window.from, window.to);
    const [signUps, messages] = await Promise.all([
      AdminSeriesRepository.signUpsPerDay(window.from, window.to),
      AdminSeriesRepository.messagesPerDay(window.from, window.to)
    ]);

    return {
      messages: { values: fillWeeks(weeks, messages), weeks },
      period,
      signUps: { values: fillWeeks(weeks, signUps), weeks },
      window: presentWindow(window)
    };
  },

  /** Plans by state, as today's page shows them, and plans made per day. */
  async plans(period: Period, now = new Date()): Promise<AdminPlansView> {
    const window = windowFor(period, now);
    const days = madridDayKeys(window.from, window.to);
    const [states, created] = await Promise.all([
      AdminSeriesRepository.plansByState(),
      AdminSeriesRepository.plansCreatedPerDay(window.from, window.to)
    ]);
    const byStatus = new Map(states.map(row => [row.status, row.n]));

    return {
      byState: PLAN_STATUSES.map(status => ({ n: byStatus.get(status) ?? 0, status })),
      created: { days, values: fillDays(days, created) },
      period,
      window: presentWindow(window)
    };
  },

  /** The funnel as it stands, and who came back and what they did, per day. */
  async product(period: Period, now = new Date()): Promise<AdminProductView> {
    const window = windowFor(period, now);
    const days = madridDayKeys(window.from, window.to);
    const [funnel, active, events] = await Promise.all([
      AdminRepository.funnel(),
      AdminSeriesRepository.activePeoplePerDay(window.from, window.to),
      AdminSeriesRepository.eventsPerDay(CHARTED_EVENTS, window.from, window.to)
    ]);

    return {
      activePeople: { days, values: fillDays(days, active) },
      events: presentGroup(days, CHARTED_EVENTS, events),
      funnel,
      period,
      window: presentWindow(window)
    };
  },

  /**
   * Resumen: the tiles against the previous period, their sparklines, sign-ups
   * and generations per day, and what needs the owner now. `capUsd` is
   * `AI_IMAGE_MONTHLY_CAP_USD`, the number drawing stops at.
   */
  async summary(period: Period, capUsd: number, now = new Date()): Promise<AdminSummaryView> {
    const window = windowFor(period, now);
    const days = madridDayKeys(window.from, window.to);
    const month = monthStart(now);
    const [accounts, active, plans, generations, spend, unread, signUpDays, generationDays, activeDays, planDays, aiDays] = await Promise.all([
      AdminSeriesRepository.accountTotals(window),
      AdminSeriesRepository.activePeopleTotals(window),
      AdminSeriesRepository.planTotals(window),
      AdminSeriesRepository.generationTotals(window, new Date(now.getTime() - DAY_MS)),
      AdminSeriesRepository.pictureSpendTotals(window, month),
      AdminSeriesRepository.unreadMessages(),
      AdminSeriesRepository.signUpsPerDay(window.from, window.to),
      AdminSeriesRepository.generationsPerDay(window.from, window.to),
      AdminSeriesRepository.activePeoplePerDay(window.from, window.to),
      AdminSeriesRepository.plansCreatedPerDay(window.from, window.to),
      AdminAiRepository.callsPerDay(window.previousFrom, window.to)
    ]);
    const signUps: DaySeries = { days, values: fillDays(days, signUpDays) };
    const firstDay = madridDayKey(window.from);
    const dollars = (value: number) => Math.round(value * 1e6) / 1e6;
    const aiSpend = (inPeriod: boolean) => dollars(aiDays.filter(row => row.day >= firstDay === inPeriod).reduce((sum, row) => sum + row.costUsd, 0));

    return {
      charts: { generations: presentGroup(days, JOB_STATUSES, generationDays), signUps },
      needsYou: { failedGenerations: generations.recentFailures, unreadMessages: unread, waitingAccounts: accounts.waiting },
      period,
      tiles: {
        activePeople: { ...active, sparkline: { days, values: fillDays(days, activeDays) } },
        newAccounts: { ...accounts.created, sparkline: signUps },
        pictures: {
          capUsd,
          monthSpentUsd: spend.month,
          monthStart: month.toISOString(),
          spentUsd: { current: spend.current, previous: spend.previous }
        },
        plansGenerated: { ...plans, sparkline: { days, values: fillDays(days, planDays) } },
        successRate: { current: rate(generations.current), previous: rate(generations.previous) },
        textAi: {
          sparkline: {
            days,
            values: fillDays(
              days,
              aiDays.filter(row => row.day >= firstDay).map(row => ({ day: row.day, n: row.costUsd }))
            ).map(dollars)
          },
          spentUsd: { current: aiSpend(true), previous: aiSpend(false) }
        },
        totalAccounts: accounts.total,
        unreadMessages: unread,
        waitingAccounts: accounts.waiting
      },
      window: presentWindow(window)
    };
  }
};

import { AdminSystemRepository } from '#repositories/Admin';
import { CARE_CONSENT_VERSION } from 'core/entities/Care';
import { CRON_JOBS } from 'core/entities/Analytics';
import { fillDays, madridDayKeys, windowFor } from 'core/domain/Period';
import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';
import { OVERSIZED_FACTOR, SERVING_KCAL_CAP } from 'core/domain/Serving';
import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';
import { PROFILE_CONSENT_VERSION } from 'core/entities/Profile';
import { REWRITE_ATTEMPT_BOUND } from 'core/domain/Method';
import { SERVING_BOUNDS } from 'core/domain/Scheduler';
import { TERMS_VERSION } from 'core/entities/User';

import { presentWindow } from './AdminSeriesController';

import type { CronJob } from 'core/entities/Analytics';
import type { MealSlot } from 'core/entities/Plan';
import type { Period } from 'core/entities/Period';
import type { PeriodWindowView } from './AdminSeriesController';

/**
 * Whether each integration is set up — a yes or a no, never a value (`0071`).
 * `SENTRY_DNS` typed for `SENTRY_DSN` on 2026-09-21 was found by a screenshot;
 * this is how it is found by looking.
 */
export type SystemIntegrations = {
  /** `CRON_SECRET`: without it the cron routes answer 404 and only the log says so. */
  readonly cronSecret: boolean;
  /** Mail can leave: SMTP host, user, password and sender. */
  readonly mail: boolean;
  /** `OWNER_EMAIL`: the address the owner is told at. */
  readonly ownerAddress: boolean;
  /** Dish pictures can be drawn and kept: the pictures' key and the blob token. */
  readonly pictures: boolean;
  /** Web Push: the three VAPID settings. */
  readonly push: boolean;
  /** `AI_REWRITE_STEPS`: the nightly step rewrite is switched on. */
  readonly rewriteSweep: boolean;
  /** `SENTRY_DSN`. */
  readonly sentry: boolean;
};

/**
 * What the API tells the console about its own configuration, already turned
 * into what may be shown. `packages/core` cannot read the environment, so the
 * API builds this from it; nothing here is a configuration value except the
 * picture cap, which is a limit and not a secret.
 */
export type SystemSnapshot = {
  /** The deployed commit, or null when the platform gave none or it is not a hash. */
  readonly commit: string | null;
  readonly integrations: SystemIntegrations;
  /** `AI_IMAGE_MONTHLY_CAP_USD`. */
  readonly pictureMonthlyCapUsd: number;
  /** The dish-generation prompt's version. */
  readonly promptVersion: string;
  /** The step-rewrite prompt's version. */
  readonly stepsVersion: string;
};

/** A cron that has not finished in this many hours is stale: a daily cron plus two hours of slack. */
export const CRON_STALE_HOURS = 26;

/**
 * Ajustes › Sistema (`GET /admin/system?period=`, `0071`). Booleans, versions,
 * dates, one commit hash, the caps as limits, and mail as counts — never a
 * configuration value, a key, an address or a recipient (`0028`). A spec walks
 * the whole answer and refuses any other kind of leaf.
 */
export type AdminSystemView = {
  /** The limits the app enforces, not settings a secret hides behind. */
  readonly caps: {
    /** A dish is refused as `oversized` past this many times its meals' cap. */
    readonly oversizedFactor: number;
    /** `AI_IMAGE_MONTHLY_CAP_USD`. */
    readonly pictureMonthlyUsd: number;
    /** Refusals before the step rewrite gives up on a recipe. */
    readonly rewriteAttemptBound: number;
    /** Servings a meal may be sized between. */
    readonly servingBounds: { readonly max: number; readonly min: number };
    /** kcal one serving is designed to, per meal. */
    readonly servingKcal: Readonly<Record<MealSlot, number>>;
  };
  readonly commit: string | null;
  /** Each cron's last finished run, in the order of `CRON_JOBS`. `stale` also when none was ever recorded. */
  readonly crons: readonly { readonly job: CronJob; readonly lastRunAt: string | null; readonly stale: boolean }[];
  readonly integrations: SystemIntegrations;
  /**
   * Mail handed to the provider over the period. Per template only the period's
   * total, and per day only the sum over every template: a template's own daily
   * series can be one client's check-in calendar (`0028`).
   */
  readonly mail: {
    readonly days: readonly string[];
    /** Templates that sent at least once in the period, alphabetically, with their total over the period. */
    readonly kinds: readonly { readonly failed: number; readonly kind: string; readonly sent: number }[];
    /** Every template's sends summed, one number per day of `days`. */
    readonly perDay: { readonly failed: readonly number[]; readonly sent: readonly number[] };
    readonly totals: { readonly failed: number; readonly sent: number };
  };
  readonly period: Period;
  readonly versions: {
    readonly careConsent: string;
    readonly healthConsent: string;
    readonly professionalAgreement: string;
    readonly profileConsent: string;
    readonly prompt: string;
    readonly steps: string;
    readonly terms: string;
  };
  readonly window: PeriodWindowView;
};

const HOUR_MS = 60 * 60 * 1000;

/** A commit id or nothing: whatever else the platform put there is not shown. */
function commitOf(value: string | null): string | null {
  return value !== null && /^[0-9a-f]{7,40}$/i.test(value) ? value.toLowerCase() : null;
}

/** Each cron's last finished run and whether it is stale, in the order of `CRON_JOBS`: the one rule Sistema and the owner's digest both read. */
export function cronStates(
  runs: readonly { readonly at: Date; readonly job: string }[],
  now: Date
): readonly { readonly job: CronJob; readonly lastRunAt: string | null; readonly stale: boolean }[] {
  return CRON_JOBS.map(job => {
    const at = runs.find(run => run.job === job)?.at;

    return { job, lastRunAt: at?.toISOString() ?? null, stale: at === undefined || now.getTime() - at.getTime() > CRON_STALE_HOURS * HOUR_MS };
  });
}

export const AdminSystemController = {
  async system(period: Period, snapshot: SystemSnapshot, now = new Date()): Promise<AdminSystemView> {
    const window = windowFor(period, now);
    const days = madridDayKeys(window.from, window.to);
    const [runs, mail] = await Promise.all([AdminSystemRepository.lastCronRuns(), AdminSystemRepository.mailPerDay(window.from, window.to)]);
    const kinds = [...new Set(mail.map(row => row.kind))].sort();
    const total = (rows: readonly { readonly n: number }[]) => rows.reduce((sum, row) => sum + row.n, 0);
    const perKind = (kind: string, failed: boolean) => total(mail.filter(row => row.kind === kind && row.failed === failed));

    return {
      caps: {
        oversizedFactor: OVERSIZED_FACTOR,
        pictureMonthlyUsd: snapshot.pictureMonthlyCapUsd,
        rewriteAttemptBound: REWRITE_ATTEMPT_BOUND,
        servingBounds: { max: SERVING_BOUNDS.max, min: SERVING_BOUNDS.min },
        servingKcal: SERVING_KCAL_CAP
      },
      commit: commitOf(snapshot.commit),
      crons: cronStates(runs, now),
      integrations: snapshot.integrations,
      mail: {
        days,
        kinds: kinds.map(kind => ({ failed: perKind(kind, true), kind, sent: perKind(kind, false) })),
        perDay: {
          failed: fillDays(
            days,
            mail.filter(row => row.failed)
          ),
          sent: fillDays(
            days,
            mail.filter(row => !row.failed)
          )
        },
        totals: { failed: total(mail.filter(row => row.failed)), sent: total(mail.filter(row => !row.failed)) }
      },
      period,
      versions: {
        careConsent: CARE_CONSENT_VERSION,
        healthConsent: HEALTH_CONSENT_VERSION,
        professionalAgreement: PROFESSIONAL_AGREEMENT_VERSION,
        profileConsent: PROFILE_CONSENT_VERSION,
        prompt: snapshot.promptVersion,
        steps: snapshot.stepsVersion,
        terms: TERMS_VERSION
      },
      window: presentWindow(window)
    };
  }
};

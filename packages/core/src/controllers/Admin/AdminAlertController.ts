import { AdminGenerationsRepository, AdminRepository, AdminSeriesRepository, AdminSystemRepository } from '#repositories/Admin';
import { AnalyticsRepository } from '#repositories/Analytics';
import { monthStart } from 'core/controllers/Recipe';
import { windowFor } from 'core/domain/Period';

import { AdminQualityController } from './AdminQualityController';
import { AdminTextSpend } from './AdminTextSpend';
import { countByReason } from './AdminUsageController';
import { cronStates } from './AdminSystemController';

import type { CronJob } from 'core/entities/Analytics';
import type { PictureReason } from 'core/entities/DishPicture';
import type { PictureReasonCount } from './AdminUsageController';
import type { RecipeCheck } from 'core/entities/AdminQuery';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** How many finished generations in a row, all failed, tell the owner at once. */
export const FAILURE_STREAK = 3;

/** The share of a cap at which the owner is told (`0071`), and mentioned in the digest. */
export const SPEND_WARN_SHARE = 0.8;

/** The two dollar gauges the owner watches. */
export const SPEND_SOURCES = ['pictures', 'text'] as const;
export type SpendSource = (typeof SPEND_SOURCES)[number];
export type SpendThreshold = 100 | 80;

/** One month's spend against its cap. */
export type SpendFigure = { readonly capUsd: number; readonly share: number; readonly spentUsd: number };

/** A spend that crossed a threshold. */
export type SpendCrossing = SpendFigure & { readonly source: SpendSource; readonly threshold: SpendThreshold };

/**
 * The digest's counts of things that should be zero. Each is a fixed name;
 * `check` is the Recetas filter that lists exactly them, and is absent for the
 * one count that has no recipe to list.
 */
export const ZERO_ITEMS = [
  { check: 'over_bound', key: 'overBound' },
  { check: 'uncosted', key: 'uncosted' },
  { check: 'unserved', key: 'unserved' },
  { check: 'refusal_limit', key: 'refusalLimit' },
  { key: 'mealsOutsideServingBounds' }
] as const satisfies readonly { readonly check?: RecipeCheck; readonly key: string }[];

export type ZeroKey = (typeof ZERO_ITEMS)[number]['key'];

export type OwnerAlertCaps = { readonly pictureCapUsd: number; readonly textCapUsd?: number };

/**
 * The owner's daily mail, as numbers (`0071`). **Every string in it comes from
 * a closed set**: a failure code is `[A-Z_]` or `OTHER`, a mail template is a
 * lower-case label or `unknown`, a cron is a `CronJob`. There is no field for an
 * address, a name, a message or a dish, so the mail cannot carry one.
 */
export type OwnerDigest = {
  readonly crons: readonly CronJob[];
  readonly failedGenerations: readonly { readonly code: string; readonly n: number }[];
  readonly failedMail: readonly { readonly kind: string; readonly n: number }[];
  readonly newMessages: number;
  readonly pictureSpend: SpendFigure;
  readonly shouldBeZero: Readonly<Record<ZeroKey, number>>;
  readonly textSpend?: SpendFigure;
  readonly waitingAccounts: number;
};

/**
 * The two mails about dish pictures, as `owner_alerted` names their claims (project 009):
 * dishes whose drawing failed, and drawings given back because the provider turned them
 * away — the pictures' key could not pay, or reached its rate limit. Each counts since
 * the last mail of its own kind.
 */
export const PICTURE_ALERT_KINDS = { failed: 'picture-failed', refused: 'picture-payment-refused' } as const;

/** The reasons a drawing is given back for that the owner is mailed about: the provider's no. The month's cap is not one. */
const REFUSALS: readonly PictureReason[] = ['payment_refused', 'model_refused', 'rate_limited'];

/**
 * What the pictures' mails say, as numbers. A reason is one of `PICTURE_REASONS`: no
 * dish is named or numbered, and nothing a provider or the judge wrote is here.
 */
export type PictureFailures = {
  /** Dishes that failed for their own reasons — not given back — since the last `picture-failed` mail, by reason. */
  readonly failed: readonly PictureReasonCount[];
  /**
   * Dishes whose drawing the provider turned away and gave back since the last
   * `picture-payment-refused` mail, by reason: `payment_refused` (a 402, a spent key or
   * quota), `rate_limited` (a 429, the provider's pace and nothing to do with the account)
   * or `model_refused` (any other 4xx). The mail names which, because they are not the same
   * news: only the first is about money (`0094`).
   */
  readonly refused: readonly PictureReasonCount[];
};

/** A failure code as the generation records it; anything else is not shown. */
export function safeCode(value: string | null): string {
  return value !== null && /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : 'OTHER';
}

/** A mail template's label as the service records it; anything else is not shown. */
export function safeKind(value: string): string {
  return /^[a-z][a-z0-9-]{0,39}$/.test(value) ? value : 'unknown';
}

function figure(spentUsd: number, capUsd: number): SpendFigure {
  return { capUsd, share: capUsd > 0 ? Math.round((spentUsd / capUsd) * 1e6) / 1e6 : 0, spentUsd };
}

/**
 * Whether the digest has anything to say: one non-zero item, or a spend at 80 % of its
 * cap or more. The "should be zero" counts never trigger it on their own: a standing
 * catalogue defect would mail the owner every day. They ride along when something else
 * does, and the console's Calidad page always shows them.
 */
export function hasNews(digest: OwnerDigest): boolean {
  return (
    digest.waitingAccounts > 0 ||
    digest.newMessages > 0 ||
    digest.failedGenerations.length > 0 ||
    digest.failedMail.length > 0 ||
    digest.crons.length > 0 ||
    digest.pictureSpend.share >= SPEND_WARN_SHARE ||
    (digest.textSpend?.share ?? 0) >= SPEND_WARN_SHARE
  );
}

/** The threshold a share has reached: at 100 % the owner hears about 100, not also 80. */
export function crossedThreshold(share: number): SpendThreshold | null {
  return share >= 1 ? 100 : share >= SPEND_WARN_SHARE ? 80 : null;
}

async function spends(now: Date, caps: OwnerAlertCaps): Promise<{ readonly pictures: SpendFigure; readonly text?: SpendFigure }> {
  const { textCapUsd } = caps;
  const [pictures, text] = await Promise.all([
    AdminRepository.pictures(monthStart(now)),
    textCapUsd === undefined ? undefined : AdminTextSpend.month(now, textCapUsd)
  ]);

  return {
    pictures: figure(pictures.spentUsd, caps.pictureCapUsd),
    ...(text === undefined || textCapUsd === undefined ? {} : { text: figure(text.spentUsd, textCapUsd) })
  };
}

/**
 * What the owner is told by mail without opening the console (`0071`). Every
 * number is read by the console's own reader — the quality helpers, the cron
 * rule, the spend gauges — so the mail and the page cannot disagree. Nothing
 * here returns a name.
 */
export const AdminAlertController = {
  /**
   * Takes the right to send `kind`; `null` when it was sent since `since`. Give the id back to `release` if the mail did not leave.
   * `at` dates the claim by the caller's clock, for a mail that counts since the previous one.
   */
  claim(kind: string, since: Date, at?: Date): Promise<string | null> {
    return AnalyticsRepository.claimOwnerAlert(kind, since, at);
  },

  /** The day's numbers. Throws when a reader fails: the caller sends nothing rather than a digest with a hole. */
  async digest(now: Date, caps: OwnerAlertCaps & { readonly stepsVersion: string }): Promise<OwnerDigest> {
    const lastDigest = await AnalyticsRepository.lastOwnerAlert('digest');
    // Since the last digest, and at most a week back; without one, the last day.
    const messagesFrom =
      lastDigest === null ? new Date(now.getTime() - DAY_MS) : new Date(Math.max(lastDigest.getTime(), now.getTime() - 7 * DAY_MS));
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const [accounts, messages, failures, mail, runs, quality, spend] = await Promise.all([
      AdminSeriesRepository.accountTotals(windowFor(7, now)),
      AdminSeriesRepository.messagesSince(messagesFrom),
      AdminGenerationsRepository.failuresByCode(dayAgo, now),
      AdminSystemRepository.mailPerDay(dayAgo, now),
      AdminSystemRepository.lastCronRuns(),
      AdminQualityController.quality(7, caps.stepsVersion, now),
      spends(now, caps)
    ]);
    const failedMail = new Map<string, number>();

    for (const row of mail.filter(entry => entry.failed)) {
      const kind = safeKind(row.kind);

      failedMail.set(kind, (failedMail.get(kind) ?? 0) + row.n);
    }

    const codes = new Map<string, number>();

    for (const row of failures) {
      const code = safeCode(row.code);

      codes.set(code, (codes.get(code) ?? 0) + row.n);
    }

    return {
      // This sweep runs inside the reminders cron, which is therefore alive; its own record lands after the digest.
      crons: cronStates(runs, now)
        .filter(cron => cron.stale && cron.job !== 'reminders')
        .map(cron => cron.job),
      failedGenerations: [...codes].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n || a.code.localeCompare(b.code)),
      failedMail: [...failedMail].map(([kind, n]) => ({ kind, n })).sort((a, b) => a.kind.localeCompare(b.kind)),
      newMessages: messages,
      pictureSpend: spend.pictures,
      shouldBeZero: quality.shouldBeZero,
      ...(spend.text === undefined ? {} : { textSpend: spend.text }),
      waitingAccounts: accounts.waiting
    };
  },

  /** The codes of the last `FAILURE_STREAK` generations when every one of them failed, else null. */
  async failureStreak(): Promise<readonly string[] | null> {
    const last = await AdminGenerationsRepository.lastOutcomes(FAILURE_STREAK);

    return last.length === FAILURE_STREAK && last.every(job => job.status === 'failed') ? last.map(job => safeCode(job.code)) : null;
  },

  /**
   * The pictures that ended without one since the owner was last told, up to `now`
   * (project 009). Each count starts at the last mail of its own kind, or a day back
   * when there was none, so a failure that fell inside an hour's claim is in the next
   * mail and not lost. A row given back by the month's cap is in neither count: the
   * spend alert already says it. Nor is a picture the owner removed by hand
   * (`owner_removed`, `0072`): it is a failed row, and the owner's own act — a mail
   * telling them what they just did is no warning.
   *
   * Known, and small: a drawing that ends while this reads, dated before `now` and
   * written after the read, is in no mail. It is on the console either way.
   */
  async pictureFailures(now: Date): Promise<PictureFailures> {
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const [lastFailed, lastRefused] = await Promise.all([
      AnalyticsRepository.lastOwnerAlert(PICTURE_ALERT_KINDS.failed),
      AnalyticsRepository.lastOwnerAlert(PICTURE_ALERT_KINDS.refused)
    ]);
    const [failed, refused] = await Promise.all([
      AdminRepository.failedPictures(lastFailed ?? dayAgo, now),
      AdminRepository.failedPictures(lastRefused ?? dayAgo, now)
    ]);

    return {
      failed: countByReason(failed.filter(row => !row.released)).filter(({ reason }) => reason !== 'owner_removed'),
      refused: countByReason(refused.filter(row => row.released)).filter(({ reason }) => REFUSALS.includes(reason))
    };
  },

  /** Gives back a claim whose mail did not leave. */
  release(id: string): Promise<void> {
    return AnalyticsRepository.releaseOwnerAlert(id);
  },

  /** The crons whose last finished run is older than `CRON_STALE_HOURS`, or that never ran: the console's own rule, for a cron watching another. */
  async silentCrons(now: Date): Promise<readonly CronJob[]> {
    return cronStates(await AdminSystemRepository.lastCronRuns(), now)
      .filter(cron => cron.stale)
      .map(cron => cron.job);
  },

  /** Each source whose month's spend is at 80 % of its cap or more, with the threshold it has reached. */
  async spendCrossings(now: Date, caps: OwnerAlertCaps): Promise<readonly SpendCrossing[]> {
    const spend = await spends(now, caps);

    return SPEND_SOURCES.flatMap(source => {
      const current = source === 'text' ? spend.text : spend.pictures;
      const threshold = current === undefined ? null : crossedThreshold(current.share);

      return current === undefined || threshold === null ? [] : [{ ...current, source, threshold }];
    });
  }
};

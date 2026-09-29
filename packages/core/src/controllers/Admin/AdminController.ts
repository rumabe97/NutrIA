import { AdminRepository } from '#repositories/Admin';
import { AnalyticsRepository } from '#repositories/Analytics';
import { SettingsController } from 'core/controllers/Settings';

import type { ActivityRow } from '#repositories/Analytics';
import type { AiCallRecord, DishRejection } from 'core/entities/Plan';
import type { Funnel, GenerationRow, JobRow, PictureCounts } from '#repositories/Admin';
import { monthStart } from 'core/controllers/Recipe';

/** A fortnight, because that is the product's own unit: one plan, one check-in. */
const ACTIVITY_DAYS = 14;

export type AdminJobView = {
  id: string;
  attempts: number;
  /** The stable code — `GENERATION_POOL_TOO_SMALL` and its kin — never a stack. */
  code: string | null;
  /** The provider's own redacted message, when there was one. */
  detail: string | null;
  finishedAt: string | null;
  /** Wall-clock seconds the generation took, when it finished. */
  seconds: number | null;
  startedAt: string | null;
  status: string;
  step: string | null;
};

/** The period's calls to one model, as served by one provider. */
export type AiModelUsage = {
  /** Mean of our own clock over the calls that reported one. */
  averageMs: number | null;
  calls: number;
  costUsd: number;
  failed: number;
  inputTokens: number;
  /** The model that answered; a call that failed counts against the one that was asked for. */
  model: string;
  outputTokens: number;
  /** Who served it, when a gateway said; null for a direct provider. */
  provider: string | null;
  reasoningTokens: number;
};

/** This month's dish pictures (`0066`): what they cost against the cap, and how many are where. */
export type AdminPicturesView = PictureCounts & {
  /** `AI_IMAGE_MONTHLY_CAP_USD`: drawing stops when `spentUsd` reaches it. */
  readonly capUsd: number;
  /** Whether the `dishPictures` flag is on. */
  readonly enabled: boolean;
  /** Where this month's count started, ISO. */
  readonly since: string;
};

export type AdminAnalyticsView = {
  /** How many of each recorded event in the window, and how many distinct people signed in. */
  activity: { readonly events: readonly ActivityRow[]; readonly people: number };
  funnel: Funnel;
  windowDays: number;
};

/**
 * One generation for the log: the job, who asked for it, the plan it produced,
 * and every model call it made (`0050`).
 */
export type AdminGenerationView = AdminJobView & {
  /** Who asked for it — an address and a name, nothing else of theirs (`0028`). */
  account: { readonly email: string; readonly name: string | null };
  /** Every model call, in order. Empty when it never reached the model, or predates the log. */
  calls: readonly AiCallRecord[];
  /** What the plan recorded about its own making; null when the job produced none. */
  plan: {
    readonly backfilled: number | null;
    readonly fallback: string | null;
    readonly model: string | null;
    readonly promptVersion: string | null;
    readonly rejected: number | null;
    readonly reused: number | null;
    readonly version: number;
  } | null;
};

/**
 * Which model and provider one `ai_call` counts against: the model that
 * answered, or — for a call that failed and never learned who would have — the
 * model that was asked for, and `unknown` when neither was recorded. The rule
 * the period's usage (`AdminUsageController`) groups by.
 */
export function aiModelOf(properties: Readonly<Record<string, unknown>>): { readonly model: string; readonly provider: string | null } {
  const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);

  return { model: text(properties.answeredModel) ?? text(properties.model) ?? 'unknown', provider: text(properties.provider) };
}

/** The plan side of a generation, read defensively: its metadata is whatever the pipeline wrote at the time. */
function planOf(version: number | null, metadata: Record<string, unknown> | null): AdminGenerationView['plan'] {
  if (version === null) {
    return null;
  }

  const recorded = metadata ?? {};
  const text = (key: string) => (typeof recorded[key] === 'string' ? recorded[key] : null);
  const count = (key: string) => (typeof recorded[key] === 'number' ? recorded[key] : null);

  return {
    backfilled: count('backfilled'),
    fallback: text('fallback'),
    model: text('model'),
    promptVersion: text('promptVersion'),
    rejected: count('rejected'),
    reused: count('reused'),
    version
  };
}

function present(row: JobRow): AdminJobView {
  const seconds = row.startedAt && row.finishedAt ? Math.round((row.finishedAt.getTime() - row.startedAt.getTime()) / 100) / 10 : null;

  return {
    id: row.id,
    attempts: row.attempts,
    code: row.error,
    detail: row.errorDetail,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    seconds,
    startedAt: row.startedAt?.toISOString() ?? null,
    status: row.status,
    step: row.step
  };
}

/**
 * Rejection reasons that come from the person, not from the model: `allergen` is set
 * from their safety profile, `unwanted` from their way of eating, dislikes and dish
 * rules. Next to their address they would say "this person has an allergy" or keep a
 * religious rule (`0028`, `0068`), so the addressed row never carries them.
 */
const PERSONAL_REJECTIONS: ReadonlySet<DishRejection> = new Set<DishRejection>(['allergen', 'unwanted']);

/** A call as the addressed log may show it: every field, the rejections minus the person's own reasons. */
function withoutPersonalRejections(call: AiCallRecord): AiCallRecord {
  // Older records may carry no `rejected` at all; they are shown as they were.
  if (call.rejected === undefined || call.rejected === null) {
    return call;
  }

  const rejected = Object.fromEntries(
    Object.entries(call.rejected).filter(([reason]) => !PERSONAL_REJECTIONS.has(reason as DishRejection))
  ) as AiCallRecord['rejected'];

  return { ...call, rejected };
}

/**
 * An invalid plan's detail reads `kind (N días, p. ej. 1180 frente a 1850); …` — the
 * example quotes that person's own day against their own target or floor, which is
 * their plan and their energy need (`0028`). The addressed row keeps the kind and the
 * number of days and drops the example.
 */
function withoutPersonalFigures(code: string | null, detail: string | null): string | null {
  if (code !== 'GENERATION_INVALID_PLAN' || detail === null) {
    return detail;
  }

  return detail.replace(/, p\. ej\. [^);]*/g, '');
}

/** One generation for the log: the job, its account's address and name, its calls and its plan — never the reasons or figures that describe the person. */
export function presentGeneration(row: GenerationRow): AdminGenerationView {
  // Written by this service in `AiCallRecord`'s shape; null before the log existed.
  const calls = (row.aiCalls ?? []) as unknown as readonly AiCallRecord[];

  return {
    ...present(row),
    account: { email: row.email, name: row.name },
    calls: calls.map(withoutPersonalRejections),
    detail: withoutPersonalFigures(row.error, row.errorDetail),
    plan: planOf(row.planVersion, row.metadata)
  };
}

/**
 * What the owner needs to know about their own service, and nothing else.
 *
 * Deliberately not a user list, not a plan viewer, not a way to read anybody's
 * profile: those are the screens an admin surface grows by accident, and every
 * one of them turns "I run this" into "I can read your health data". The
 * questions here are whether generation is working, what it failed on, and how
 * big the catalogue is.
 */
export const AdminController = {
  /**
   * Whether the product is working for the people using it.
   *
   * The funnel is counted from state and the activity from the event log, and
   * the split is the decision (`0033`): state answers "how many got this far",
   * which the rows already know, and events answer "did anybody come back",
   * which nothing else records.
   */
  async analytics(): Promise<AdminAnalyticsView> {
    const since = new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000);
    const [funnel, activity] = await Promise.all([AdminRepository.funnel(), AnalyticsRepository.activitySince(since)]);

    return { activity: { events: activity.rows, people: activity.people }, funnel, windowDays: ACTIVITY_DAYS };
  },

  /** This month's picture spend against the cap, and the pictures ready, failed and being drawn (`0066`). */
  async pictures(capUsd: number, now = new Date()): Promise<AdminPicturesView> {
    const since = monthStart(now);
    const [counts, enabled] = await Promise.all([AdminRepository.pictures(since), SettingsController.dishPictures()]);

    return { ...counts, capUsd, enabled, since: since.toISOString() };
  }
};

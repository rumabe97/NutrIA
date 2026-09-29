import { AdminRepository } from '#repositories/Admin';
import { AnalyticsRepository } from '#repositories/Analytics';
import { SettingsController } from 'core/controllers/Settings';

import type { ActivityRow } from '#repositories/Analytics';
import type { AiCallRecord, DishRejection } from 'core/entities/Plan';
import type { Counts, Funnel, GenerationRow, JobRow, PictureCounts } from '#repositories/Admin';
import { monthStart } from 'core/controllers/Recipe';

/** A week is the window a failure is worth looking at in; older than that is history. */
const WINDOW_DAYS = 7;

/** Enough to see a pattern, few enough to read. */
const JOB_LIMIT = 25;

/** Each generation carries its whole call log, so fewer of them. */
const GENERATION_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When Google's daily count starts again.
 *
 * Their day is Pacific, not the operator's and not UTC — so a Spanish owner
 * looking at a spent allowance at nine in the morning is looking at a counter
 * that resets at nine in the morning, and nobody would guess that from a
 * calendar. Offset rather than a timezone library: this is one number, and the
 * hour it lands on moves by one twice a year, which is close enough for a
 * countdown and honest about being an estimate.
 */
function nextPacificMidnight(now: Date = new Date()): Date {
  const offsetHours = 8;
  const pacific = new Date(now.getTime() - offsetHours * 60 * 60 * 1000);
  const midnight = Date.UTC(pacific.getUTCFullYear(), pacific.getUTCMonth(), pacific.getUTCDate() + 1);

  return new Date(midnight + offsetHours * 60 * 60 * 1000);
}

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

/**
 * What today has spent of the provider's allowance (`0035`).
 *
 * `limit` is what the operator configured, and null when they configured
 * nothing — the screen then shows a count with no bar rather than inventing a
 * ceiling. `refused` is the number that predicts tomorrow: a call the provider
 * turned down for quota still spent the request.
 */
/** Today's calls to one model, as served by one provider. */
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

/** A refusal for quota, with what the provider wrote about the allowance. */
export type AiRefusal = {
  at: string;
  /** The allowance, as the provider's own message stated it — Google writes it into the refusal. */
  limit: number | null;
  model: string;
  retryAfterSeconds: number | null;
};

export type AiUsageView = {
  /**
   * Today's calls by the model that answered and who served it. Through a
   * gateway, a combo's hops show as their own rows — the one place that says
   * which model the allowance actually went to.
   */
  byModel: readonly AiModelUsage[];
  /** Provider requests since midnight in the account's own day, whatever their outcome. */
  calls: number;
  inputTokens: number;
  /** The last refusal for quota today, or null when there was none. */
  lastRefusal: AiRefusal | null;
  /** Configured allowances, or null when nothing was configured. */
  limits: { readonly requestsPerDay: number | null; readonly tokensPerMinute: number | null };
  /** The model the calls named, when they all named the same one. */
  model: string | null;
  outputTokens: number;
  /** Calls the provider refused because the allowance was spent. */
  refused: number;
  /** When the daily count starts again, ISO. Pacific midnight, which is Google's day. */
  resetsAt: string;
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

export type AdminOverviewView = {
  counts: Counts;
  jobs: readonly AdminJobView[];
  /** Days the job counts cover. */
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
 * model that was asked for, and `unknown` when neither was recorded. The one
 * rule both today's usage and the period's (`AdminUsageController`) group by.
 */
export function aiModelOf(properties: Readonly<Record<string, unknown>>): { readonly model: string; readonly provider: string | null } {
  const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);

  return { model: text(properties.answeredModel) ?? text(properties.model) ?? 'unknown', provider: text(properties.provider) };
}

/**
 * Today's `ai_call` events by the model that answered, and the last refusal
 * for quota among them.
 *
 * A call that failed never learned who would have answered, so it counts
 * against the model that was asked for. Events from before the gateway fields
 * existed have neither, and land under their requested model with no provider.
 */
export function summariseAiCalls(
  calls: readonly { readonly at: Date; readonly properties: Record<string, unknown> }[]
): Pick<AiUsageView, 'byModel' | 'lastRefusal'> {
  const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
  const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  const rows = new Map<string, AiModelUsage & { timed: number; totalMs: number }>();
  let lastRefusal: AiRefusal | null = null;

  for (const { at, properties } of calls) {
    const { model, provider } = aiModelOf(properties);
    const key = `${model}\u0000${provider ?? ''}`;
    const row = rows.get(key) ?? {
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

    row.calls += 1;
    row.failed += properties.ok === false ? 1 : 0;
    row.costUsd += amount(properties.costUsd);
    row.inputTokens += amount(properties.inputTokens);
    row.outputTokens += amount(properties.outputTokens);
    row.reasoningTokens += amount(properties.reasoningTokens);

    if (typeof properties.ms === 'number') {
      row.timed += 1;
      row.totalMs += properties.ms;
    }

    rows.set(key, row);

    if (properties.quotaExhausted === true) {
      lastRefusal = {
        at: at.toISOString(),
        limit: typeof properties.quotaLimit === 'number' ? properties.quotaLimit : null,
        model: text(properties.model) ?? model,
        retryAfterSeconds: typeof properties.retryAfterSeconds === 'number' ? properties.retryAfterSeconds : null
      };
    }
  }

  return {
    byModel: [...rows.values()]
      .map(({ timed, totalMs, ...row }) => ({ ...row, averageMs: timed > 0 ? Math.round(totalMs / timed) : null }))
      .sort((a, b) => b.calls - a.calls),
    lastRefusal
  };
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
   * The provider's day, counted here.
   *
   * Ours, not theirs: Google publishes no endpoint for what is left, so this is
   * every request that went out through this service measured against the
   * number the operator wrote down. A difference from the console is calls that
   * did not come through here.
   */
  async aiUsage(limits: { readonly requestsPerDay?: number; readonly tokensPerMinute?: number } = {}): Promise<AiUsageView> {
    const resets = nextPacificMidnight();
    const calls = await AnalyticsRepository.aiCallsSince(new Date(resets.getTime() - DAY_MS));
    const models = new Set(calls.map(call => String(call.properties.model ?? '')).filter(Boolean));
    const number = (call: (typeof calls)[number], key: string) => (typeof call.properties[key] === 'number' ? (call.properties[key] as number) : 0);

    return {
      ...summariseAiCalls(calls),
      calls: calls.length,
      inputTokens: calls.reduce((total, call) => total + number(call, 'inputTokens'), 0),
      limits: { requestsPerDay: limits.requestsPerDay ?? null, tokensPerMinute: limits.tokensPerMinute ?? null },
      model: models.size === 1 ? [...models][0] : null,
      outputTokens: calls.reduce((total, call) => total + number(call, 'outputTokens'), 0),
      refused: calls.filter(call => call.properties.quotaExhausted === true).length,
      resetsAt: resets.toISOString()
    };
  },

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

  /** Only what failed, for when something is wrong and the list is long. */
  async failures(): Promise<readonly AdminJobView[]> {
    return (await AdminRepository.recentJobs(JOB_LIMIT, true)).map(present);
  },

  /**
   * The latest generations, each with who asked for it and every model call it
   * made. The one read here that carries a person, which is why the API gives
   * it a controller of its own (`0028`, `0050`).
   */
  async generations(): Promise<readonly AdminGenerationView[]> {
    return (await AdminRepository.recentGenerations(GENERATION_LIMIT)).map(presentGeneration);
  },

  async overview(now = new Date()): Promise<AdminOverviewView> {
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [counts, jobs] = await Promise.all([AdminRepository.counts(since), AdminRepository.recentJobs(JOB_LIMIT, false)]);

    return { counts, jobs: jobs.map(present), windowDays: WINDOW_DAYS };
  },

  /** This month's picture spend against the cap, and the pictures ready, failed and being drawn (`0066`). */
  async pictures(capUsd: number, now = new Date()): Promise<AdminPicturesView> {
    const since = monthStart(now);
    const [counts, enabled] = await Promise.all([AdminRepository.pictures(since), SettingsController.dishPictures()]);

    return { ...counts, capUsd, enabled, since: since.toISOString() };
  }
};

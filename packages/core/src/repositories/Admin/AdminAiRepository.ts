import { and, desc, eq, gte, sql } from 'drizzle-orm';

import { analyticsEvents } from 'database/schema/platform';
import { database } from 'database';

import { DatabaseOperationError } from 'core/entities/Error';

import { madridDay, within } from './AdminSql';

import type { SQL } from 'drizzle-orm';

/**
 * The provider requests of one Madrid day that share a model asked for, a
 * model that answered, a provider and an outcome, summed (`ai_call` events,
 * written by `StructuredAiClient`).
 *
 * The three names are the recorded text, or null when the event recorded no
 * text for them; the caller decides which model a call counts against, with
 * the same rule as today's usage (`aiModelOf`).
 */
export type AiCallDayRow = {
  readonly answeredModel: string | null;
  readonly calls: number;
  readonly costUsd: number;
  readonly day: string;
  /** `ok: false` — a call that returned nothing usable, whatever the reason. */
  readonly failed: boolean;
  readonly inputTokens: number;
  readonly model: string | null;
  readonly outputTokens: number;
  readonly provider: string | null;
  readonly reasoningTokens: number;
  /** Calls that recorded their own clock (`ms`), and the sum of those clocks. */
  readonly timed: number;
  readonly totalMs: number;
};

/**
 * One feature's `ai_call` events since the start of a month: how many, what
 * they were billed, and how many recorded no cost at all. `feature` is the
 * recorded text, or null for an event written before the field existed.
 */
export type AiMonthRow = {
  readonly calls: number;
  readonly costUsd: number;
  readonly feature: string | null;
  /** Calls whose event has no numeric `costUsd`: the provider did not say, so the sum is a floor. */
  readonly uncosted: number;
};

/**
 * One assistant call to the model that came back with nothing usable: when,
 * which step, which model, and why — as the codes the clients record
 * (`StructuredAiClient`, `AnthropicStreamingClient`), never the provider's prose,
 * the question or the answer. Each field is null on a row written before it was
 * recorded.
 */
export type AssistantFailureRow = {
  readonly at: Date;
  /** The provider's own error type (`overloaded_error`…). */
  readonly errorType: string | null;
  /** `provider`, `invalid_output`, `timeout` or `abandoned`. */
  readonly failure: string | null;
  /** How an unusable answer ended: `length` is the output cap. */
  readonly finishReason: string | null;
  /** `answer` for the written answer; null for the label every question gets first. */
  readonly kind: string | null;
  readonly model: string | null;
  readonly ms: number | null;
  readonly status: number | null;
};

/**
 * The `ai_call` properties this repository reads (`StructuredAiClient`). A closed
 * union, because the key is written into the SQL with `sql.raw`: no value that did
 * not come from this list can ever reach it.
 */
type AiCallKey =
  | 'answeredModel'
  | 'costUsd'
  | 'errorType'
  | 'failure'
  | 'feature'
  | 'finishReason'
  | 'inputTokens'
  | 'kind'
  | 'model'
  | 'ms'
  | 'outputTokens'
  | 'provider'
  | 'reasoningTokens'
  | 'status';

/** The property's text when the event recorded a string there, else null. */
function text(key: AiCallKey): SQL<string | null> {
  return sql<
    string | null
  >`case when jsonb_typeof(${analyticsEvents.properties} -> ${sql.raw(`'${key}'`)}) = 'string' then ${analyticsEvents.properties} ->> ${sql.raw(`'${key}'`)} end`;
}

/** The property's number when the event recorded one there, else null. Written as a constant key, never input. */
function number(key: AiCallKey): SQL<number | null> {
  return sql<
    number | null
  >`case when jsonb_typeof(${analyticsEvents.properties} -> ${sql.raw(`'${key}'`)}) = 'number' then (${analyticsEvents.properties} ->> ${sql.raw(`'${key}'`)})::numeric end`.mapWith(
    Number
  );
}

/** The property's number when the event recorded one there, else 0 — summed. Written as a constant key, never input. */
function summed(key: AiCallKey): SQL<number> {
  return sql<number>`coalesce(sum(case when jsonb_typeof(${analyticsEvents.properties} -> ${sql.raw(`'${key}'`)}) = 'number' then (${analyticsEvents.properties} ->> ${sql.raw(`'${key}'`)})::numeric else 0 end), 0)`.mapWith(
    Number
  );
}

/** Exported for its spec: the fragments that read an `ai_call` event's properties. */
export const AI_CALL_FIELDS = {
  answeredModel: text('answeredModel'),
  failed: sql<boolean>`coalesce(${analyticsEvents.properties} -> 'ok' = 'false'::jsonb, false)`.mapWith(Boolean),
  model: text('model'),
  provider: text('provider')
};

/**
 * The console's IA y modelos page (`0068`): provider requests over a period,
 * from the `ai_call` events this service records at the one place a request
 * leaves it. Nothing here names a person — the events are recorded without a
 * user (`0033`) — and nothing reads a prompt or an answer: the properties are
 * counts, clocks and model names.
 */
export const AdminAiRepository = {
  /**
   * The assistant's latest failed calls, the newest first: at most `limit` rows,
   * whatever the period. Mode: the `(event, created_at)` index, read backwards.
   */
  async assistantFailures(limit: number): Promise<readonly AssistantFailureRow[]> {
    try {
      return await database()
        .select({
          at: analyticsEvents.createdAt,
          errorType: text('errorType'),
          failure: text('failure'),
          finishReason: text('finishReason'),
          kind: text('kind'),
          model: text('model'),
          ms: number('ms'),
          status: number('status')
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.event, 'ai_call'),
            sql`${analyticsEvents.properties} ->> 'feature' = 'assistant'`,
            sql`${analyticsEvents.properties} -> 'ok' = 'false'::jsonb`
          )
        )
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(limit);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Every `ai_call` in `[from, to)`, grouped by Madrid day, the model asked
   * for, the model that answered, the provider and the outcome. Sums, never
   * rows: the answer is a few rows per day however many calls were made. Mode:
   * one grouped query on the `(event, created_at)` index.
   */
  async callsPerDay(from: Date, to: Date): Promise<readonly AiCallDayRow[]> {
    try {
      const day = madridDay(analyticsEvents.createdAt);
      const { answeredModel, failed, model, provider } = AI_CALL_FIELDS;

      return await database()
        .select({
          answeredModel,
          calls: sql<number>`count(*)`.mapWith(Number),
          costUsd: summed('costUsd'),
          day,
          failed,
          inputTokens: summed('inputTokens'),
          model,
          outputTokens: summed('outputTokens'),
          provider,
          reasoningTokens: summed('reasoningTokens'),
          timed: sql<number>`count(*) filter (where jsonb_typeof(${analyticsEvents.properties} -> 'ms') = 'number')`.mapWith(Number),
          totalMs: summed('ms')
        })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.event, 'ai_call'), within(analyticsEvents.createdAt, from, to)))
        .groupBy(day, answeredModel, model, provider, failed);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * One feature's spend per Madrid day: calls and dollars from the `ai_call`
   * events it filed itself under (`feature`). A few rows. Mode: one grouped
   * query on the `(event, created_at)` index.
   */
  async featurePerDay(
    feature: 'plan' | 'rewrite' | 'swap',
    from: Date,
    to: Date
  ): Promise<readonly { readonly calls: number; readonly costUsd: number; readonly day: string }[]> {
    try {
      const day = madridDay(analyticsEvents.createdAt);

      return await database()
        .select({ calls: sql<number>`count(*)`.mapWith(Number), costUsd: summed('costUsd'), day })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.event, 'ai_call'),
            sql`${analyticsEvents.properties} ->> 'feature' = ${feature}`,
            within(analyticsEvents.createdAt, from, to)
          )
        )
        .groupBy(day);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * The text models' month so far, per feature: every `ai_call` since
   * `monthStart` (a UTC month, as the pictures' cap counts). A few rows however
   * many calls were made. Mode: one grouped query on the `(event, created_at)` index.
   */
  async monthByFeature(monthStart: Date): Promise<readonly AiMonthRow[]> {
    try {
      const feature = text('feature');

      return await database()
        .select({
          calls: sql<number>`count(*)`.mapWith(Number),
          costUsd: summed('costUsd'),
          feature,
          uncosted: sql<number>`count(*) filter (where jsonb_typeof(${analyticsEvents.properties} -> 'costUsd') is distinct from 'number')`.mapWith(
            Number
          )
        })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.event, 'ai_call'), gte(analyticsEvents.createdAt, monthStart)))
        .groupBy(feature);
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}

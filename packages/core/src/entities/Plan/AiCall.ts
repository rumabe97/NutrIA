import type { MealSlot } from './Plan';

/** Why a dish the model returned was not kept. */
export type DishRejection = 'allergen' | 'duplicate' | 'over_time' | 'schema' | 'unknown_ingredient' | 'unwanted';

/** What a failed call said about itself. */
export type AiCallFailure = {
  /** `invalid_output`: answered, not to the schema. `provider`: refused or failed. `shape`: valid JSON, not `{ dishes }`. */
  readonly kind: 'invalid_output' | 'provider' | 'shape';
  /** The provider's own message, redacted and bounded. */
  readonly message: string;
  /** What a quota refusal said about the allowance — Google writes the limit into the message. */
  readonly quota: {
    readonly limit: number | null;
    readonly metric: string | null;
    readonly model: string | null;
    readonly retryAfterSeconds: number | null;
  } | null;
  readonly status: number | null;
};

/**
 * One model call of a generation: what was asked, who answered, what it cost
 * and what came of it.
 *
 * Kept on the job row rather than on the plan, so a generation that failed
 * keeps its calls too — the case where they are needed (`0050`). Operational
 * only: no prompt, no dish, nothing about the person beyond which job it
 * served.
 */
export type AiCallRecord = {
  /** The model that answered — through a combo, not necessarily `model`. */
  readonly answeredModel: string | null;
  /** HIT or MISS, from a gateway's response cache. */
  readonly cache: string | null;
  readonly cachedInputTokens: number | null;
  /** The gateway's id for the combo execution the call was a hop of. */
  readonly comboTrace: string | null;
  readonly correlationId: string | null;
  readonly costUsd: number | null;
  /** Dishes the model returned, before any check. */
  readonly dishes: number;
  readonly error: AiCallFailure | null;
  /** The gateway's latency for the hop that answered. */
  readonly gatewayMs: number | null;
  readonly inputTokens: number | null;
  /** Dishes that passed every check and joined the pool. */
  readonly kept: number;
  /** What this service asked for: a provider's model, or a gateway alias such as a combo. */
  readonly model: string;
  /** Our clock, from request to answer. */
  readonly ms: number | null;
  readonly outputTokens: number | null;
  readonly provider: string | null;
  readonly reasoningTokens: number | null;
  /** The dishes that were dropped, by reason. */
  readonly rejected: Readonly<Partial<Record<DishRejection, number>>>;
  /** The id a gateway's dashboard lists the call under. */
  readonly requestId: string | null;
  /** 1 for the first round; a later round asks for what the first left short. */
  readonly round: number;
  /** The session a gateway filed the call under — "ext:<job>" when we sent one. */
  readonly session: string | null;
  readonly slot: MealSlot;
  /** How a combo chose, e.g. "priority". */
  readonly strategy: string | null;
};

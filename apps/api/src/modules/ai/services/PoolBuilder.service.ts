import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { dishSafety, findSafetyViolations } from 'core/domain/Safety';
import { withinTime } from 'core/domain/Preference';
import { DISHES_NEEDED_PER_SLOT } from 'core/domain/Variety';

import { AI_MODEL_BUDGET } from '../ai.config.js';
import { AiCallError, AiClient } from '../clients/AiClient.js';
import { buildPoolPrompt, languageName, POOL_SYSTEM_PROMPT, PROMPT_VERSION } from '../prompts/PoolPrompt.js';
import { generatedDishSchema, wirePoolSchema } from '../prompts/pool.schema.js';

import type { AiCall, AiFailure, AiUsage } from '../clients/AiClient.js';
import type { AiCallFailure, AiCallRecord, CandidateDish, CatalogueIngredient, DishRejection, MealSlot } from 'core/entities/Plan';
import type { GeneratedDish } from '../prompts/pool.schema.js';
import type { GenerationContext } from 'core/controllers/Recipe';
import type { PromptContext } from '../prompts/PoolPrompt.js';

/**
 * Re-exported from `core/domain/Variety`, where it is defined once: the pool
 * builder asks a model for this many per slot, and the reuse rotation hands a
 * user this many per slot. The same number, or two plans differ only by how
 * large the library happens to be.
 */
export { DISHES_NEEDED_PER_SLOT } from 'core/domain/Variety';

const MAX_ATTEMPTS = 3;

/** How much of a provider's message a call's record keeps: enough for the quota line, never a page. */
const MESSAGE_LIMIT = 400;

/** The model half's whole time when the module passes none — as when a spec builds this by hand. */
const DEFAULT_MODEL_BUDGET_MS = 170_000;

/** A later round with less than this left cannot bring a dish back in time; the library covers the rest. */
const MIN_ROUND_MS = 15_000;

export type PoolResult = {
  readonly dishes: readonly CandidateDish[];
  readonly generated: readonly CandidateDish[];
  readonly metadata: {
    /** Every model call, answered or not, in the order the rounds came back (`0050`). */
    readonly aiCalls: readonly AiCallRecord[];
    readonly attempts: number;
    /** Library dishes used to cover what the model's first round left short. */
    readonly backfilled: number;
    readonly calls: number;
    readonly inputTokens: number;
    readonly model: string;
    /** Set when the time budget cut the model short: a call timed out, or a later round never started. */
    readonly outOfTime?: true;
    readonly outputTokens: number;
    readonly promptVersion: string;
    /** Set when a configured provider actually failed, as opposed to being absent. */
    readonly providerError?: string;
    /** False when no provider is configured at all. */
    readonly providerUsed: boolean;
    readonly rejected: number;
    readonly reused: number;
  };
};

export type BuildPoolInput = {
  /**
   * Library dishes held back from `reusable` for freshness, offered to cover
   * whatever the model's first round left short — instead of a second round
   * ([`0016`](../../../../../docs/decisions/0016-one-round-per-slot-in-parallel.md)).
   */
  readonly backfill?: readonly CandidateDish[];
  readonly context: GenerationContext;
  /** Dishes wanted per slot. A whole plan wants `DISHES_NEEDED_PER_SLOT`; a single meal's swap wants a handful. */
  readonly needPerSlot?: number;
  readonly preferences: Omit<PromptContext, 'excludeSlugs' | 'forbiddenLabels' | 'language' | 'needBySlot'>;
  readonly reusable: readonly CandidateDish[];
  /** Files every call of this build under one session in a gateway's log — a generation's job id. */
  readonly session?: string;
  readonly slots: readonly MealSlot[];
};

type Verdict = { readonly dish: CandidateDish } | { readonly reason: DishRejection };

/**
 * Assembles the pool the scheduler consumes: reuse first, generate the shortfall.
 *
 * The shortfall is computed per slot, so a user whose profile is already well
 * covered by the library triggers **no model call at all** — which is the mechanism
 * that keeps this product's running cost from scaling with users
 * ([`0006`](../../../../docs/decisions/0006-reuse-before-generating.md)).
 *
 * Every call it makes is recorded — who answered, how long, the tokens, what a
 * gateway reported, and what became of each dish — in `metadata.aiCalls` and as
 * one log line, so a generation can be read back call by call (`0050`).
 */
@Injectable()
export class PoolBuilder {
  private readonly budgetMs: number;
  private readonly logger = new Logger(PoolBuilder.name);

  constructor(
    private readonly ai: AiClient,
    // The model half's whole time, from `AI_BUDGET_SECONDS` (`0050`).
    @Optional() @Inject(AI_MODEL_BUDGET) budgetMs?: number
  ) {
    this.budgetMs = budgetMs ?? DEFAULT_MODEL_BUDGET_MS;
  }

  async build({
    backfill = [],
    context,
    needPerSlot = DISHES_NEEDED_PER_SLOT,
    preferences,
    reusable,
    session,
    slots
  }: BuildPoolInput): Promise<PoolResult> {
    const accepted = new Map<string, CandidateDish>(reusable.map(dish => [dish.slug, dish]));
    const generated: CandidateDish[] = [];
    const metadata = {
      aiCalls: [] as AiCallRecord[],
      attempts: 0,
      backfilled: 0,
      calls: 0,
      inputTokens: 0,
      model: 'none',
      outOfTime: undefined as true | undefined,
      outputTokens: 0,
      promptVersion: PROMPT_VERSION,
      providerError: undefined as string | undefined,
      providerUsed: this.ai.isAvailable,
      rejected: 0,
      reused: reusable.length
    };

    // Only ingredients this user may safely eat are ever shown to the model. It
    // cannot choose what it was never offered.
    // The model is shown only what this person may and would eat: an ingredient
    // absent from the prompt cannot be proposed, which is cheaper and more
    // reliable than asking for it to be avoided and checking afterwards.
    const safeIngredients = [...context.catalogue.values()].filter(
      ingredient => isSafeIngredient(ingredient, context) && isWantedIngredient(ingredient, context)
    );
    const deadline = Date.now() + this.budgetMs;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let needBySlot = shortfall(slots, [...accepted.values()], needPerSlot);

      // After the first round, what the library still has covers the gap before
      // the model is asked again: a second round costs as much as the first and
      // arrives minutes later; a library dish arrives now.
      if (attempt > 1) {
        for (const dish of backfill) {
          if ([...needBySlot.values()].every(count => count === 0)) {
            break;
          }

          if (accepted.has(dish.slug) || !dish.slots.some(slot => (needBySlot.get(slot) ?? 0) > 0)) {
            continue;
          }

          accepted.set(dish.slug, dish);
          metadata.backfilled += 1;
          needBySlot = shortfall(slots, [...accepted.values()], needPerSlot);
        }
      }

      const wanted = [...needBySlot].filter(([, count]) => count > 0).map(([slot]) => slot);

      if (wanted.length === 0) {
        break;
      }

      if (!this.ai.isAvailable) {
        this.logger.warn('No AI provider available; serving reuse only');
        break;
      }

      // One budget for every round, so a slow model cannot hold a job past the
      // function's own limit (`0050`): the first round has all of it, and a
      // later one starts only with enough left to bring something back.
      const remaining = deadline - Date.now();

      if (attempt > 1 && remaining < MIN_ROUND_MS) {
        metadata.outOfTime = true;
        this.logger.warn(`The model's ${this.budgetMs / 1000} s are spent; the library covers what is still short`);
        break;
      }

      metadata.attempts = attempt;

      const signal = AbortSignal.timeout(Math.max(remaining, 1));

      // One request per slot, all at once. Latency is set by the longest single
      // response, and a response for one slot is a quarter the size of one for
      // four; the token cost is the same either way.
      const excludeSlugs = [...accepted.keys()];
      const rounds = await Promise.allSettled(
        wanted.map(slot =>
          this.ai.generate({
            prompt: buildPoolPrompt(
              {
                ...preferences,
                excludeSlugs,
                forbiddenLabels: context.safety.unenforceableLabels,
                language: languageName(context.locale),
                needBySlot: new Map([[slot, needBySlot.get(slot) ?? 0]])
              },
              safeIngredients
            ),
            schema: wirePoolSchema,
            session,
            signal,
            system: POOL_SYSTEM_PROMPT
          })
        )
      );

      let succeeded = 0;

      for (const [index, slot] of wanted.entries()) {
        const round = rounds[index];

        if (!round) {
          continue;
        }

        if (round.status === 'rejected') {
          const error: unknown = round.reason;
          const failure = error instanceof AiCallError ? error.failure : undefined;

          if (failure?.kind === 'timeout') {
            metadata.outOfTime = true;
          }

          metadata.providerError = error instanceof Error ? error.message : 'unknown';
          this.logger.error(`Pool generation attempt ${attempt} failed against ${metadata.model}: ${metadata.providerError}`);
          this.record(metadata.aiCalls, {
            error: {
              kind: failure?.kind ?? 'provider',
              message: metadata.providerError.slice(0, MESSAGE_LIMIT),
              quota: failure?.quota ?? null,
              status: failure?.status ?? null
            },
            failure,
            model: metadata.model,
            round: attempt,
            slot
          });
          continue;
        }

        metadata.calls += round.value.usage.calls;
        metadata.inputTokens += round.value.usage.inputTokens;
        metadata.model = round.value.usage.model;
        metadata.outputTokens += round.value.usage.outputTokens;

        // `wirePoolSchema` is deliberately loose (see its own comment: Gemini
        // rejects the stricter keywords outright), so nothing here has checked
        // that a *parsed* response actually has a `dishes` array — only that it
        // parsed as JSON at all. A provider whose "JSON mode" is looser than
        // Gemini's or Anthropic's tool-calling can hand back well-formed JSON
        // shaped some other way, and this round is a failure to report, not a
        // crash to propagate through the whole build.
        const dishes = round.value.object.dishes;

        if (!Array.isArray(dishes)) {
          metadata.providerError = 'the model returned JSON without a "dishes" array';
          this.logger.error(`Pool generation attempt ${attempt} against ${metadata.model} was not shaped { dishes: [...] }`);
          this.record(metadata.aiCalls, {
            call: round.value.call,
            error: { kind: 'shape', message: metadata.providerError, quota: null, status: null },
            model: metadata.model,
            round: attempt,
            slot,
            usage: round.value.usage
          });
          continue;
        }

        succeeded += 1;

        const rejected: Partial<Record<DishRejection, number>> = {};
        let kept = 0;

        for (const dish of dishes) {
          const verdict = this.validate(dish, context, accepted);

          if ('reason' in verdict) {
            metadata.rejected += 1;
            rejected[verdict.reason] = (rejected[verdict.reason] ?? 0) + 1;
            continue;
          }

          accepted.set(verdict.dish.slug, verdict.dish);
          generated.push(verdict.dish);
          kept += 1;
        }

        this.record(metadata.aiCalls, {
          call: round.value.call,
          dishes: dishes.length,
          kept,
          model: metadata.model,
          rejected,
          round: attempt,
          slot,
          usage: round.value.usage
        });
      }

      if (succeeded === 0) {
        break;
      }
    }

    return { dishes: [...accepted.values()], generated, metadata };
  }

  /** Adds one call to the build's log and writes its line: the two places an operator reads a generation back from. */
  private record(
    log: AiCallRecord[],
    parts: {
      readonly call?: AiCall;
      readonly dishes?: number;
      readonly error?: AiCallFailure;
      readonly failure?: AiFailure;
      readonly kept?: number;
      readonly model: string;
      readonly rejected?: Partial<Record<DishRejection, number>>;
      readonly round: number;
      readonly slot: MealSlot;
      readonly usage?: AiUsage;
    }
  ): void {
    const entry = callRecord(parts);
    const who = `${entry.answeredModel ?? entry.model}${entry.provider ? ` via ${entry.provider}` : ''}`;
    const time = entry.ms === null ? '' : ` in ${entry.ms} ms`;
    const session = entry.session ? ` [${entry.session}]` : '';

    log.push(entry);

    if (entry.error) {
      const quota = entry.error.quota
        ? `; quota limit ${entry.error.quota.limit ?? '?'}, retry in ${entry.error.quota.retryAfterSeconds ?? '?'} s`
        : '';

      this.logger.warn(
        `AI call ${entry.slot}, round ${entry.round}: ${who} failed${entry.error.status === null ? '' : ` (${entry.error.status})`}${time}${quota}${session}`
      );

      return;
    }

    const reasoning = entry.reasoningTokens ? ` (${entry.reasoningTokens} reasoning)` : '';
    const dropped = Object.entries(entry.rejected)
      .map(([reason, count]) => `${reason} ${count}`)
      .join(', ');

    this.logger.log(
      `AI call ${entry.slot}, round ${entry.round}: ${who}${time}, ${entry.inputTokens ?? 0}/${entry.outputTokens ?? 0} tokens${reasoning}, kept ${entry.kept} of ${entry.dishes}${dropped ? ` (dropped: ${dropped})` : ''}${session}`
    );
  }

  /**
   * Schema → catalogue → **allergy gate**, in that order.
   *
   * The gate runs on generated dishes even though the prompt was given only safe
   * ingredients, because a prompt is a request and this is a guarantee. A rejection
   * here is logged at error level: it means the model returned something it was
   * never shown, which is a drift worth investigating rather than a routine miss.
   *
   * Returns the dish, or why it was dropped — counted per call in its record.
   */
  private validate(raw: GeneratedDish, context: GenerationContext, accepted: ReadonlyMap<string, CandidateDish>): Verdict {
    // The wire schema is deliberately loose so the provider can express it; the
    // bounds are enforced here, against the strict schema. Anything failing this
    // is discarded exactly like an unsafe dish.
    const parsed = generatedDishSchema.safeParse(raw);

    if (!parsed.success) {
      this.logger.warn(`Dish "${raw.name}" rejected: ${parsed.error.issues.map(issue => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);

      return { reason: 'schema' };
    }

    const dish = parsed.data;
    const slug = slugify(dish.name);

    if (accepted.has(slug)) {
      return { reason: 'duplicate' };
    }

    const safety = dishSafety(dish.ingredients, context.catalogue, context.safety);

    if (safety.kind === 'unknown_ingredients') {
      this.logger.warn(`Dish "${dish.name}" rejected: unknown ingredient slugs ${safety.slugs.join(', ')}`);

      return { reason: 'unknown_ingredient' };
    }

    if (safety.kind === 'unsafe') {
      this.logger.error(
        `Dish "${dish.name}" rejected by the allergy gate: ${safety.violations.map(violation => violation.ingredientName).join(', ')}`
      );

      return { reason: 'allergen' };
    }

    // The catalogue it was given held none of these, so this is a model that
    // wrote one anyway. Not an error — the rule held — but worth counting.
    const unwanted = unwantedIn(dish, context);

    if (unwanted.length > 0) {
      this.logger.warn(`Dish "${dish.name}" rejected: ${unwanted.join(', ')} is ruled out by their way of eating or dislikes`);

      return { reason: 'unwanted' };
    }

    // The prompt states the limit; this is what makes it true.
    if (!withinTime(dish, context.preferences.maxMinutesPerDish)) {
      this.logger.warn(
        `Dish "${dish.name}" rejected: ${dish.prepMinutes + dish.cookMinutes} min, over their ${String(context.preferences.maxMinutesPerDish)} min limit and its margin`
      );

      return { reason: 'over_time' };
    }

    return {
      dish: {
        cookMinutes: dish.cookMinutes,
        cuisine: dish.cuisine,
        difficulty: dish.difficulty,
        ingredients: dish.ingredients,
        name: dish.name,
        prepMinutes: dish.prepMinutes,
        servings: dish.servings,
        slots: dish.slots,
        slug,
        // The wire has no nullable, so "none" arrives as an empty string or a zero.
        // Both leave as no key at all, which is what the pages test for.
        steps: dish.steps.map(step => ({ ...step, cue: step.cue || undefined, minutes: step.minutes || undefined }))
      }
    };
  }
}

/**
 * One call as its record: the client's account of it (or of its failure) and
 * what the build made of its dishes. A failed call has no dishes and no usage;
 * it may still have what the gateway said about it.
 */
function callRecord(parts: {
  readonly call?: AiCall;
  readonly dishes?: number;
  readonly error?: AiCallFailure;
  readonly failure?: AiFailure;
  readonly kept?: number;
  readonly model: string;
  readonly rejected?: Partial<Record<DishRejection, number>>;
  readonly round: number;
  readonly slot: MealSlot;
  readonly usage?: AiUsage;
}): AiCallRecord {
  const gateway = parts.call?.gateway ?? parts.failure?.gateway ?? null;

  return {
    answeredModel: parts.call?.answeredModel ?? gateway?.model ?? null,
    cache: gateway?.cache ?? null,
    cachedInputTokens: parts.call?.cachedInputTokens ?? null,
    comboTrace: gateway?.comboTrace ?? null,
    correlationId: gateway?.correlationId ?? null,
    costUsd: gateway?.costUsd ?? null,
    dishes: parts.dishes ?? 0,
    error: parts.error ?? null,
    gatewayMs: gateway?.latencyMs ?? null,
    inputTokens: parts.usage?.inputTokens ?? null,
    kept: parts.kept ?? 0,
    model: parts.usage?.model ?? parts.failure?.model ?? parts.model,
    ms: parts.call?.ms ?? parts.failure?.ms ?? null,
    outputTokens: parts.usage?.outputTokens ?? null,
    provider: gateway?.provider ?? null,
    reasoningTokens: parts.call?.reasoningTokens ?? null,
    rejected: parts.rejected ?? {},
    requestId: gateway?.requestId ?? null,
    round: parts.round,
    session: gateway?.session ?? null,
    slot: parts.slot,
    strategy: gateway?.strategy ?? null
  };
}

/** How many more distinct dishes each slot needs. Drives both the retry and the prompt. */
export function shortfall(
  slots: readonly MealSlot[],
  have: readonly CandidateDish[],
  needed: number = DISHES_NEEDED_PER_SLOT
): ReadonlyMap<MealSlot, number> {
  return new Map(slots.map(slot => [slot, Math.max(needed - have.filter(dish => dish.slots.includes(slot)).length, 0)]));
}

function isSafeIngredient(ingredient: CatalogueIngredient, context: GenerationContext): boolean {
  return findSafetyViolations([{ id: ingredient.id, allergens: ingredient.allergens, name: ingredient.name }], context.safety).length === 0;
}

/**
 * What their way of eating and their dislikes rule out (0023).
 *
 * Kept apart from `isSafeIngredient` because the two answer different
 * questions and deserve different words: an allergen reaching a plate is a
 * safety event and is logged as an error; a disliked ingredient is a
 * preference the product simply honours.
 */
function isWantedIngredient(ingredient: CatalogueIngredient, context: GenerationContext): boolean {
  return !context.preferences.excludedIngredientIds.has(ingredient.id);
}

function unwantedIn(dish: { readonly ingredients: readonly { readonly slug: string }[] }, context: GenerationContext): readonly string[] {
  return dish.ingredients
    .map(item => context.catalogue.get(item.slug))
    .filter((ingredient): ingredient is CatalogueIngredient => ingredient !== undefined && !isWantedIngredient(ingredient, context))
    .map(ingredient => ingredient.name);
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 140);
}

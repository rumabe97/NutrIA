import { Injectable, Logger } from '@nestjs/common';

import { dishSafety, findSafetyViolations } from 'core/domain/Safety';
import { DISHES_NEEDED_PER_SLOT } from 'core/domain/Variety';

import { AiClient } from './clients/AiClient.js';
import { buildPoolPrompt, languageName, POOL_SYSTEM_PROMPT, PROMPT_VERSION } from './PoolPrompt.js';
import { generatedDishSchema, wirePoolSchema } from './pool.schema.js';

import type { CandidateDish, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { GeneratedDish } from './pool.schema.js';
import type { GenerationContext } from 'core/controllers/Recipe';
import type { PromptContext } from './PoolPrompt.js';

/**
 * Re-exported from `core/domain/Variety`, where it is defined once: the pool
 * builder asks a model for this many per slot, and the reuse rotation hands a
 * user this many per slot. The same number, or two plans differ only by how
 * large the library happens to be.
 */
export { DISHES_NEEDED_PER_SLOT } from 'core/domain/Variety';

const MAX_ATTEMPTS = 3;

export type PoolResult = {
  readonly dishes: readonly CandidateDish[];
  readonly generated: readonly CandidateDish[];
  readonly metadata: {
    readonly attempts: number;
    /** Library dishes used to cover what the model's first round left short. */
    readonly backfilled: number;
    readonly calls: number;
    readonly inputTokens: number;
    readonly model: string;
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
  readonly slots: readonly MealSlot[];
};

/**
 * Assembles the pool the scheduler consumes: reuse first, generate the shortfall.
 *
 * The shortfall is computed per slot, so a user whose profile is already well
 * covered by the library triggers **no model call at all** — which is the mechanism
 * that keeps this product's running cost from scaling with users
 * ([`0006`](../../../../docs/decisions/0006-reuse-before-generating.md)).
 */
@Injectable()
export class PoolBuilder {
  private readonly logger = new Logger(PoolBuilder.name);

  constructor(private readonly ai: AiClient) {}

  async build({ backfill = [], context, needPerSlot = DISHES_NEEDED_PER_SLOT, preferences, reusable, slots }: BuildPoolInput): Promise<PoolResult> {
    const accepted = new Map<string, CandidateDish>(reusable.map(dish => [dish.slug, dish]));
    const generated: CandidateDish[] = [];
    const metadata = {
      attempts: 0,
      backfilled: 0,
      calls: 0,
      inputTokens: 0,
      model: 'none',
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
    const safeIngredients = [...context.catalogue.values()].filter(ingredient => isSafeIngredient(ingredient, context) && isWantedIngredient(ingredient, context));

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let needBySlot = shortfall(slots, [...accepted.values()], needPerSlot);

      // After the first round, what the library still has covers the gap before
      // the model is asked again: a second round costs as much as the first and
      // arrives minutes later; a library dish arrives now.
      if (attempt > 1) {
        for (const dish of backfill) {
          if ([...needBySlot.values()].every(count => count === 0)) {break;}

          if (accepted.has(dish.slug) || !dish.slots.some(slot => (needBySlot.get(slot) ?? 0) > 0)) {continue;}

          accepted.set(dish.slug, dish);
          metadata.backfilled += 1;
          needBySlot = shortfall(slots, [...accepted.values()], needPerSlot);
        }
      }

      const wanted = [...needBySlot].filter(([, count]) => count > 0).map(([slot]) => slot);

      if (wanted.length === 0) {break;}

      if (!this.ai.isAvailable) {
        this.logger.warn('No AI provider available; serving reuse only');
        break;
      }

      metadata.attempts = attempt;

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
            system: POOL_SYSTEM_PROMPT
          })
        )
      );

      let succeeded = 0;

      for (const round of rounds) {
        if (round.status === 'rejected') {
          const error: unknown = round.reason;

          metadata.providerError = error instanceof Error ? error.message : 'unknown';
          this.logger.error(`Pool generation attempt ${attempt} failed against ${metadata.model}: ${metadata.providerError}`);
          continue;
        }

        succeeded += 1;
        metadata.calls += round.value.usage.calls;
        metadata.inputTokens += round.value.usage.inputTokens;
        metadata.model = round.value.usage.model;
        metadata.outputTokens += round.value.usage.outputTokens;

        for (const dish of round.value.object.dishes) {
          const candidate = this.validate(dish, context, accepted);

          if (!candidate) {
            metadata.rejected += 1;
            continue;
          }

          accepted.set(candidate.slug, candidate);
          generated.push(candidate);
        }
      }

      if (succeeded === 0) {break;}
    }

    return { dishes: [...accepted.values()], generated, metadata };
  }

  /**
   * Schema → catalogue → **allergy gate**, in that order.
   *
   * The gate runs on generated dishes even though the prompt was given only safe
   * ingredients, because a prompt is a request and this is a guarantee. A rejection
   * here is logged at error level: it means the model returned something it was
   * never shown, which is a drift worth investigating rather than a routine miss.
   */
  private validate(raw: GeneratedDish, context: GenerationContext, accepted: ReadonlyMap<string, CandidateDish>): CandidateDish | undefined {
    // The wire schema is deliberately loose so the provider can express it; the
    // bounds are enforced here, against the strict schema. Anything failing this
    // is discarded exactly like an unsafe dish.
    const parsed = generatedDishSchema.safeParse(raw);

    if (!parsed.success) {
      this.logger.warn(`Dish "${raw.name}" rejected: ${parsed.error.issues.map(issue => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);

      return undefined;
    }

    const dish = parsed.data;
    const slug = slugify(dish.name);

    if (accepted.has(slug)) {return undefined;}

    const safety = dishSafety(dish.ingredients, context.catalogue, context.safety);

    if (safety.kind === 'unknown_ingredients') {
      this.logger.warn(`Dish "${dish.name}" rejected: unknown ingredient slugs ${safety.slugs.join(', ')}`);

      return undefined;
    }

    if (safety.kind === 'unsafe') {
      this.logger.error(`Dish "${dish.name}" rejected by the allergy gate: ${safety.violations.map(violation => violation.ingredientName).join(', ')}`);

      return undefined;
    }

    // The catalogue it was given held none of these, so this is a model that
    // wrote one anyway. Not an error — the rule held — but worth counting.
    const unwanted = unwantedIn(dish, context);

    if (unwanted.length > 0) {
      this.logger.warn(`Dish "${dish.name}" rejected: ${unwanted.join(', ')} is ruled out by their way of eating or dislikes`);

      return undefined;
    }

    return {
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
    };
  }
}

/** How many more distinct dishes each slot needs. Drives both the retry and the prompt. */
export function shortfall(slots: readonly MealSlot[], have: readonly CandidateDish[], needed: number = DISHES_NEEDED_PER_SLOT): ReadonlyMap<MealSlot, number> {
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

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
  readonly context: GenerationContext;
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

  async build({ context, preferences, reusable, slots }: BuildPoolInput): Promise<PoolResult> {
    const accepted = new Map<string, CandidateDish>(reusable.map(dish => [dish.slug, dish]));
    const generated: CandidateDish[] = [];
    const metadata = {
      attempts: 0,
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
    const safeIngredients = [...context.catalogue.values()].filter(ingredient => isSafeIngredient(ingredient, context));

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const needBySlot = shortfall(slots, [...accepted.values()]);

      if ([...needBySlot.values()].every(count => count === 0)) {break;}

      if (!this.ai.isAvailable) {
        // No provider configured. Reuse is all there is, and the caller decides
        // whether that is enough — silently returning a thin pool would surface
        // later as an unexplained scheduling failure.
        this.logger.warn('No AI provider available; serving reuse only');
        break;
      }

      metadata.attempts = attempt;

      let response;

      try {
        response = await this.ai.generate({
          // The forbidden labels come from the safety profile, not from the
          // caller's preferences: they are allergy data, and the one place that
          // decides what is enforceable and what is not is `toSafetyProfile`.
          prompt: buildPoolPrompt(
            {
              ...preferences,
              excludeSlugs: [...accepted.keys()],
              forbiddenLabels: context.safety.unenforceableLabels,
              // Both from the context, not the caller: the language the dishes
              // come back in and the language their ingredients were named in
              // have to be the same one, and the context is where that is decided.
              language: languageName(context.locale),
              needBySlot
            },
            safeIngredients
          ),
          schema: wirePoolSchema,
          system: POOL_SYSTEM_PROMPT
        });
      } catch (error: unknown) {
        // Degrade to whatever reuse supplied rather than failing here — but record
        // *that the provider failed*. Without this the caller cannot tell a
        // configured-but-broken provider from no provider at all, and reports
        // "not enough recipes" to someone whose credentials or model name are
        // simply wrong. That happened.
        metadata.providerError = error instanceof Error ? error.message : 'unknown';
        this.logger.error(`Pool generation attempt ${attempt} failed against ${metadata.model}: ${metadata.providerError}`);
        break;
      }

      metadata.calls += response.usage.calls;
      metadata.inputTokens += response.usage.inputTokens;
      metadata.model = response.usage.model;
      metadata.outputTokens += response.usage.outputTokens;

      for (const dish of response.object.dishes) {
        const candidate = this.validate(dish, context, accepted);

        if (!candidate) {
          metadata.rejected += 1;
          continue;
        }

        accepted.set(candidate.slug, candidate);
        generated.push(candidate);
      }
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
      steps: dish.steps
    };
  }
}

/** How many more distinct dishes each slot needs. Drives both the retry and the prompt. */
export function shortfall(slots: readonly MealSlot[], have: readonly CandidateDish[]): ReadonlyMap<MealSlot, number> {
  return new Map(slots.map(slot => [slot, Math.max(DISHES_NEEDED_PER_SLOT - have.filter(dish => dish.slots.includes(slot)).length, 0)]));
}

function isSafeIngredient(ingredient: CatalogueIngredient, context: GenerationContext): boolean {
  return findSafetyViolations([{ id: ingredient.id, allergens: ingredient.allergens, name: ingredient.name }], context.safety).length === 0;
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

import { Inject, Injectable, Logger } from '@nestjs/common';

import { RecipeController } from 'core/controllers/Recipe';

import { ENV } from '../../../config/index.js';

import { AiClient } from '../clients/AiClient.js';
import { buildRewritePrompt } from '../prompts/RewritePrompt.js';
import { isQuotaExhausted } from '../clients/quota.js';
import { languageName, STEPS_VERSION } from '../prompts/PoolPrompt.js';
import { rewrittenStepsSchema, wireRewriteSchema } from '../prompts/rewrite.schema.js';

import type { Env } from '../../../config/index.js';
import type { UndocumentedRecipe } from 'core/controllers/Recipe';

const SYSTEM = 'You rewrite cooking methods. You never change the dish, its ingredients or its timings — only how clearly the method is written.';

export type RewriteRun = { readonly pending: number; readonly rewritten: number; readonly skipped: number };

/**
 * Rewrites the method of recipes written by an older prompt.
 *
 * The library was written under prompts that asked for "three to eight steps"
 * and got three, each sentence doing the work of two or three actions. New
 * dishes come back documented; the hundred already stored do not, and they are
 * what every existing plan shows. This upgrades them in place.
 *
 * **Only `instructions` changes.** Ingredients, grams, macros and every figure a
 * past plan already computed are untouched, so a rewrite cannot alter what a
 * plan says anyone ate — and cannot reach the allergy layer, which matches on
 * ingredient ids and never on prose.
 *
 * Best-effort and bounded, like the illustrator: a refusal is counted and
 * skipped, and the recipe is simply swept again next time.
 */
@Injectable()
export class RecipeRewriter {
  private readonly logger = new Logger(RecipeRewriter.name);

  constructor(
    private readonly ai: AiClient,
    @Inject(ENV) private readonly env: Env
  ) {}

  /** Both switches: a provider to ask, and the owner's say-so that its quota may be spent on this. */
  get isAvailable(): boolean {
    return this.env.AI_REWRITE_STEPS && this.ai.isAvailable;
  }

  async rewriteOutdated(limit: number): Promise<RewriteRun> {
    // The sweep's own availability, not the client's: the owner's switch lives here.
    if (!this.isAvailable) {
      return { pending: 0, rewritten: 0, skipped: 0 };
    }

    const pending = await RecipeController.pendingStepUpgrades(STEPS_VERSION, limit);
    let rewritten = 0;
    let skipped = 0;

    for (const recipe of pending) {
      try {
        await this.rewrite(recipe);
        rewritten += 1;
      } catch (error: unknown) {
        skipped += 1;
        this.logger.warn(`Could not rewrite recipe ${recipe.id}: ${error instanceof Error ? error.message : 'unknown'}`);

        // Out of budget is not a per-recipe failure. Carrying on spends the rest of
        // the allowance on calls that cannot succeed — and that allowance is the one
        // plan generation draws on, so a sweep must never be what empties it.
        if (isQuotaExhausted(error)) {
          this.logger.warn('Provider quota is exhausted; stopping this sweep. The rest will be picked up next time.');
          break;
        }
      }
    }

    return { pending: pending.length, rewritten, skipped };
  }

  private async rewrite(recipe: UndocumentedRecipe): Promise<void> {
    const response = await this.ai.generate({
      prompt: buildRewritePrompt(recipe, languageName(recipe.locale)),
      schema: wireRewriteSchema,
      system: SYSTEM
    });

    // The wire schema is loose so the provider can express it; the bounds and the
    // step floor are applied here, against the strict one, exactly as for dishes.
    const parsed = rewrittenStepsSchema.safeParse({ ...response.object, cookMinutes: recipe.cookMinutes });

    if (!parsed.success) {
      throw new Error(parsed.error.issues.map(issue => `${issue.path.join('.')} ${issue.message}`).join('; '));
    }

    // An empty cue and a zero duration are the wire saying "none"; store neither.
    const steps = parsed.data.steps.map(step => ({ ...step, cue: step.cue || undefined, minutes: step.minutes || undefined }));

    await RecipeController.rewriteSteps(recipe.id, steps, STEPS_VERSION);
  }
}

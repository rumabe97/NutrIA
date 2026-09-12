import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { RecipeController } from 'core/controllers/Recipe';
import { isAboutTheBrief, lowerIngredientNames, methodMentions } from 'core/domain/Method';

import { ENV } from '../../../config/index.js';

import { AI_REWRITE_CLIENT } from '../ai.config.js';
import { AiCallError, AiClient } from '../clients/AiClient.js';
import { buildRewritePrompt, REWRITE_SYSTEM_PROMPT } from '../prompts/RewritePrompt.js';
import { isQuotaExhausted } from '../clients/quota.js';
import { languageName, STEPS_VERSION } from '../prompts/PoolPrompt.js';
import { rewrittenStepsSchema, wireRewriteSchema } from '../prompts/rewrite.schema.js';
import { untilAborted } from '../clients/untilAborted.js';

import type { AiResponse } from '../clients/AiClient.js';
import type { Env } from '../../../config/index.js';
import type { RewrittenSteps } from '../prompts/rewrite.schema.js';
import type { UndocumentedRecipe } from 'core/controllers/Recipe';

/**
 * What one sweep may spend in time, and how.
 *
 * A sweep is one invocation of the 300-second function (`vercel.json`), and one
 * that ran past it would be killed between an answer and its write. Measured
 * through the gateway's free model on 2026-09-12: 22 seconds to rewrite an
 * assembled dish, 33 for one briefly cooked, 74 for a cooked main — nearly all
 * of it reasoning, 2,000 to 8,500 tokens out for under 700 in.
 *
 * - `sweepMs`: the whole sweep ends by 240 seconds, a minute inside the
 *   ceiling for the last write and the response.
 * - `minCallMs`: no call starts with less than 90 seconds left — a cooked
 *   main, with room for a combo that falls to its second model.
 * - `lanes`: three calls in flight, fewer than the four a generation sends the
 *   same model, so a sweep competes less with somebody's plan being built.
 */
export type RewriteLimits = { readonly lanes: number; readonly minCallMs: number; readonly sweepMs: number };

export const REWRITE_LIMITS: RewriteLimits = { lanes: 3, minCallMs: 90_000, sweepMs: 240_000 };

/** Where a test hands in limits of milliseconds; nothing in the application binds it. */
export const REWRITE_SWEEP_LIMITS = Symbol('REWRITE_SWEEP_LIMITS');

export type RewriteRun = {
  readonly pending: number;
  readonly rewritten: number;
  readonly skipped: number;
  /** Fetched for this sweep and never started — its time ran out, or the provider's quota did. The next sweep's first. */
  readonly unreached: number;
};

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
 * ingredient ids and never on prose. The prose is read back instead
 * (`methodMentions`): a rewrite that names a food the dish does not contain, or
 * never says where one of its own goes, is refused before it is stored.
 *
 * Best-effort and bounded, like the illustrator: a refusal is counted and
 * skipped, and the recipe is simply swept again next time. Bounded in time as
 * well as in number (`RewriteLimits`): every call ends at the sweep's deadline
 * whatever the transport does with its signal, because on the platform a
 * request ran on past an aborted one until the function was killed (`7d56f3a`).
 */
@Injectable()
export class RecipeRewriter {
  private readonly logger = new Logger(RecipeRewriter.name);
  private readonly limits: RewriteLimits;

  constructor(
    @Inject(AI_REWRITE_CLIENT) private readonly ai: AiClient,
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(REWRITE_SWEEP_LIMITS) limits?: RewriteLimits
  ) {
    this.limits = limits ?? REWRITE_LIMITS;
  }

  /** Both switches: a provider to ask, and the owner's say-so that its quota may be spent on this. */
  get isAvailable(): boolean {
    return this.env.AI_REWRITE_STEPS && this.ai.isAvailable;
  }

  async rewriteOutdated(limit: number): Promise<RewriteRun> {
    // The sweep's own availability, not the client's: the owner's switch lives here.
    if (!this.isAvailable) {
      return { pending: 0, rewritten: 0, skipped: 0, unreached: 0 };
    }

    const deadline = Date.now() + this.limits.sweepMs;
    const pending = await RecipeController.pendingStepUpgrades(STEPS_VERSION, limit);
    const queue = [...pending];
    // One read of the catalogue per language per sweep, not one per recipe.
    const vocabularies = new Map<string, Promise<readonly string[]>>();
    let rewritten = 0;
    let skipped = 0;
    let stopped = false;

    // Takes the next recipe if there is time to finish it, and says whether it did.
    const next = async (): Promise<boolean> => {
      const remaining = deadline - Date.now();
      const recipe = !stopped && remaining >= this.limits.minCallMs ? queue.shift() : undefined;

      if (!recipe) {
        return false;
      }

      try {
        await this.rewrite(recipe, AbortSignal.timeout(remaining), vocabularies);
        rewritten += 1;
      } catch (error: unknown) {
        skipped += 1;
        this.logger.warn(`Could not rewrite recipe ${recipe.id}: ${describeFailure(error)}`);

        // Out of budget is not a per-recipe failure. Carrying on spends the rest of
        // the allowance on calls that cannot succeed — and that allowance may be
        // the one plan generation draws on, so a sweep must never be what empties it.
        if (isQuotaExhausted(error)) {
          this.logger.warn('Provider quota is exhausted; stopping this sweep. The rest will be picked up next time.');
          stopped = true;
        }
      }

      return true;
    };

    const lane = async (): Promise<void> => {
      if (await next()) {
        await lane();
      }
    };

    // The first call alone: a gateway that is down or out of quota says so
    // once, rather than to three calls at once.
    if (await next()) {
      await Promise.all(Array.from({ length: this.limits.lanes }, lane));
    }

    return { pending: pending.length, rewritten, skipped, unreached: queue.length };
  }

  private async rewrite(recipe: UndocumentedRecipe, signal: AbortSignal, vocabularies: Map<string, Promise<readonly string[]>>): Promise<void> {
    const request = {
      prompt: buildRewritePrompt(recipe, languageName(recipe.locale)),
      schema: wireRewriteSchema,
      // Files every call of a recipe together in a gateway's own log.
      session: `rewrite:${recipe.id}`,
      signal,
      system: REWRITE_SYSTEM_PROMPT
    };
    // Raced here too, not only inside the client: whichever `AiClient` is bound,
    // a call that outlives the sweep is abandoned rather than awaited.
    const response = await untilAborted(this.ai.generate(request), signal);

    // The wire schema is loose so the provider can express it; the bounds and the
    // step floor are applied here, against the strict one, exactly as for dishes.
    const parsed = rewrittenStepsSchema.safeParse({ ...response.object, cookMinutes: recipe.cookMinutes });

    if (!parsed.success) {
      throw new Error(parsed.error.issues.map(issue => `${issue.path.join('.')} ${issue.message}`).join('; '));
    }

    // Read back before it is stored: the ingredient list was checked against
    // somebody's allergies, and these words were not.
    const mentions = methodMentions({
      dish: recipe.ingredients.map(item => item.name),
      steps: parsed.data.steps,
      vocabulary: await vocabularyFor(recipe.locale, vocabularies)
    });

    if (mentions.foreign.length > 0) {
      throw new Error(`names ${mentions.foreign.join(', ')}, which the dish does not contain`);
    }

    if (mentions.missing.length > 0) {
      throw new Error(`never says where ${mentions.missing.join(', ')} goes`);
    }

    if (parsed.data.steps.some(step => isAboutTheBrief(`${step.text} ${step.cue ?? ''}`))) {
      throw new Error('writes about its instructions instead of the method');
    }

    // An empty cue and a zero duration are the wire saying "none"; store neither.
    // Names lose the catalogue's capital inside a sentence ("pela el boniato"),
    // and a field's name echoed into the prose — "(`1 minutes`)", seen on a real
    // rewrite — is taken out: the text is what a cook reads.
    const names = recipe.ingredients.map(item => item.name);
    const prose = (text: string): string => lowerIngredientNames(withoutFieldNames(text), names);
    const steps = parsed.data.steps.map(step => ({
      ...step,
      cue: step.cue ? prose(step.cue) : undefined,
      minutes: step.minutes || undefined,
      text: prose(step.text)
    }));

    await RecipeController.rewriteSteps(recipe.id, steps, STEPS_VERSION);
    this.logger.log(describeCall(recipe.id, response, steps.length));
  }
}

/**
 * A step's text without the wire's vocabulary: a backticked aside, a stray
 * backtick, or a zero-minute clause ("sin cocción, durante 0 minutos"), each seen
 * on a real rewrite. A step that takes no time says none.
 */
function withoutFieldNames(text: string): string {
  return text
    .replace(/\s*\(`[^`]*`\)/g, '')
    .replace(/`/g, '')
    .replace(/,?\s*(?:sin cocción,\s*)?durante 0 minutos?/giu, '')
    .replace(/,?\s*for 0 minutes?/giu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** The catalogue's foods in one language, read once per sweep however many of its recipes are rewritten. */
function vocabularyFor(locale: string, cache: Map<string, Promise<readonly string[]>>): Promise<readonly string[]> {
  const known = cache.get(locale);

  if (known) {
    return known;
  }

  const vocabulary = RecipeController.methodVocabulary(locale);

  cache.set(locale, vocabulary);

  return vocabulary;
}

/** One line per rewrite, the way `PoolBuilder` logs a call: who answered, how long, the tokens. */
function describeCall(recipeId: string, response: AiResponse<RewrittenSteps>, steps: number): string {
  const call = response.call;
  const who = `${call?.answeredModel ?? response.usage.model}${call?.gateway?.provider ? ` via ${call.gateway.provider}` : ''}`;
  const time = call ? ` in ${call.ms} ms` : '';
  const reasoning = call?.reasoningTokens ? ` (${call.reasoningTokens} reasoning)` : '';

  return `Rewrite ${recipeId}: ${who}${time}, ${response.usage.inputTokens}/${response.usage.outputTokens} tokens${reasoning}, ${steps} steps`;
}

/** What went wrong with one rewrite, with the call's own account of it when there is one. */
function describeFailure(error: unknown): string {
  if (error instanceof AiCallError) {
    const status = error.failure.status === null ? '' : ` ${error.failure.status}`;

    return `${error.failure.model} ${error.failure.kind}${status} after ${error.failure.ms} ms — ${error.message}`;
  }

  return error instanceof Error ? error.message : 'unknown';
}

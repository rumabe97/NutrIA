import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';

import { AssistantController } from 'core/controllers/Assistant';
import { AssistantSpend } from 'core/controllers/Analytics';
import { AssistantUnavailableError, QuotaExceededError } from 'core/entities/Error';
import { PlanController } from 'core/controllers/Plan';
import { personToday, ProfileController } from 'core/controllers/Profile';
import { RecipeController } from 'core/controllers/Recipe';
import { SafetyController } from 'core/controllers/Safety';
import {
  answerNamesAnAllergen,
  assistantContext,
  assistantSystemPrompt,
  claimsToAct,
  clinicalRefusal,
  declineFor,
  figuresAreAllSupplied,
  figureSet,
  flushSentences,
  forbiddenFoods,
  historyWindow,
  LABEL_SYSTEM_PROMPT,
  questionLabelSchema,
  releaseSentences
} from 'core/domain/Assistant';
import { normaliseForMatching } from 'core/domain/Safety';

import { ASSISTANT_CLIENT } from '../../ai/ai.config.js';
import { ENV } from '../../../config/index.js';
import { languageName, NAMEABLE_CUISINES } from '../../ai/prompts/PoolPrompt.js';
import { likedFoodNames, promptPreferences } from '../../meal-plans/services/GenerationShared.js';
import { StreamingAiClient } from '../../ai/clients/StreamingAiClient.js';

import type { AiClient } from '../../ai/clients/AiClient.js';
import type { AiStream } from '../../ai/clients/StreamingAiClient.js';
import type { AskAssistantDto } from '../dto/in/index.js';
import type { AssistantConversationDto, AssistantEventDto, AssistantStandingDto, AssistantThreadDto } from '../dto/out/index.js';
import type { AssistantContext, FigureSet, ForbiddenFood } from 'core/domain/Assistant';
import type { AssistantDecline, AssistantTurn } from 'core/entities/Assistant';
import type { Allergen } from 'core/entities/Safety';
import type { Env } from '../../../config/index.js';
import type { SharedPlanView } from 'core/controllers/Plan';

/** The label is a word and a few more: anything longer is a model ignoring the schema. */
const LABEL_OUTPUT_TOKENS = 120;

/**
 * An allergen's names, the person's language first. The catalogue gives one a
 * Spanish label and a key (`tree_nuts`), so an English account is searched for
 * both: the net is the one place in the product where more words is the safe
 * direction (`AllergenNet.ts`).
 */
function allergenNames(allergen: Allergen, locale: string): readonly string[] {
  const key = allergen.key.replace(/_/g, ' ');

  return locale.startsWith('en') ? [key, allergen.labelEs] : [allergen.labelEs, key];
}

/** The foods a person may never be shown: their allergies against the catalogue, by id, with every name searched (`AllergenNet.ts`). */
function forbiddenOf(
  generation: Awaited<ReturnType<typeof RecipeController.generationContext>>,
  allergens: readonly Allergen[]
): readonly ForbiddenFood[] {
  return forbiddenFoods(
    generation.safety,
    [...generation.catalogue.values()].map(ingredient => ({ id: ingredient.id, allergens: ingredient.allergens, names: [ingredient.name] })),
    allergens.map(allergen => ({ id: allergen.id, names: allergenNames(allergen, generation.locale) }))
  );
}

/** Stored answers screened against today's allergies: one that names a forbidden food is shown — and replayed — as the `allergen` decline. */
function screened(turns: readonly AssistantTurn[], forbidden: readonly ForbiddenFood[]): readonly AssistantTurn[] {
  return turns.map(turn =>
    turn.role === 'assistant' && turn.decline === null && answerNamesAnAllergen(turn.content, forbidden)
      ? { ...turn, content: '', decline: 'allergen' }
      : turn
  );
}

/**
 * The nutrition assistant (project 023): one question in, an answer out as it
 * is written — and every screen between the two (`0104`, `0105`).
 *
 * **The order of `ask` is the design**, and each step is where it is for a
 * reason that would be a bug anywhere else:
 *
 * 1. The fortnight's allowance, before anything — a person past it is told so
 *    and nothing is stored or counted (429).
 * 2. Whether the assistant can answer anybody at all — no key, or the month's
 *    ceiling reached (503). Nothing is stored or counted: it is the service that
 *    is down, not the person who is over.
 * 3. The message is **claimed** against the allowance, counted and written in
 *    one locked transaction, so a burst sent at once cannot all pass (429 for the
 *    one that loses). From here, a failure that is not the person's — a thread
 *    not theirs (404), a provider that cannot label (503) — gives the claim back.
 * 4. The thread: this person's own, or a 404, before any model is asked.
 * 5. Past the off-topic ceiling, the standing sentence, **with no call at all**;
 *    then the clinical lexicon, **before any call**; then the label — the one
 *    decision a model makes — and the cut it may lead to.
 * 6. The question is stored with its decision, in a conversation opened only
 *    now; a cut stops here, counted.
 * 7. The answer is asked for, with earlier answers screened again against
 *    today's allergies before they are replayed.
 * 8. The answer, released sentence by sentence, each only after the figure
 *    check, the allergen net and `claimsToAct` have passed on everything
 *    written so far (the owner's choice of 2026-11-09).
 *
 * **Nothing a person typed reaches a log line here.** The question and the
 * answer go to the model and to the store, and nowhere else.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly streamer: StreamingAiClient,
    @Inject(ASSISTANT_CLIENT) private readonly labeller: AiClient,
    @Inject(ENV) private readonly env: Env
  ) {}

  async standing(userId: string): Promise<AssistantStandingDto> {
    const standing = await AssistantController.standing(userId);

    return {
      allowed: standing.allowed,
      labelling: standing.labelling,
      limit: standing.limit,
      remaining: standing.remaining,
      resetsOn: standing.window.resetsOn,
      used: standing.used
    };
  }

  async conversations(userId: string): Promise<readonly AssistantConversationDto[]> {
    return AssistantController.conversations(userId);
  }

  /**
   * One conversation, its answers screened again against **today's** allergies:
   * an answer written before a milk allergy was declared and naming milk is shown
   * as the `allergen` decline, not as the words (apps/api/AGENTS.md § Allergy
   * safety — anything that shows food validates before it returns).
   */
  async thread(userId: string, conversationId: string): Promise<AssistantThreadDto> {
    const [{ conversation, turns }, forbidden] = await Promise.all([AssistantController.thread(userId, conversationId), this.forbidden(userId)]);

    return { conversation, turns: screened(turns, forbidden) };
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    await AssistantController.deleteConversation(userId, conversationId);
  }

  async deleteTurn(userId: string, turnId: string): Promise<void> {
    await AssistantController.deleteTurn(userId, turnId);
  }

  /**
   * One message. Everything that can refuse it refuses **before** this
   * returns, so the route can still answer with a status; what it returns is
   * the answer stream, which can only end — never fail as an HTTP error.
   *
   * The message is **claimed** against the allowance in one locked transaction
   * before any model is asked, so a burst sent at once cannot all pass on the
   * same count; a message that then fails through no doing of the person's — a
   * conversation not theirs, a provider that cannot label — gives its claim back.
   */
  async ask(userId: string, ask: AskAssistantDto, signal: AbortSignal): Promise<AsyncIterable<AssistantEventDto>> {
    const standing = await AssistantController.standing(userId);

    if (!standing.allowed) {
      throw new QuotaExceededError('assistant_message', standing.window.resetsOn);
    }

    if (!this.streamer.isAvailable || !this.labeller.isAvailable) {
      throw new AssistantUnavailableError('no_model');
    }

    const cap = this.env.AI_ASSISTANT_MONTHLY_CAP_USD;

    if (cap !== undefined && (await AssistantSpend.reached(cap))) {
      throw new AssistantUnavailableError('budget');
    }

    const claim = await AssistantController.claim(userId, standing);

    try {
      return await this.claimed(userId, claim, standing.labelling, ask, signal);
    } catch (error: unknown) {
      await AssistantController.release(userId, claim);

      throw error;
    }
  }

  /** A claimed message: decided, stored with its decision, then cut or answered. */
  private async claimed(
    userId: string,
    claim: string,
    labelling: boolean,
    ask: AskAssistantDto,
    signal: AbortSignal
  ): Promise<AsyncIterable<AssistantEventDto>> {
    const question = ask.message;
    // Somebody else's conversation is a 404 here, before any model is asked.
    const earlier = ask.conversationId === undefined ? [] : (await AssistantController.thread(userId, ask.conversationId)).turns;
    const decline = await this.decide(userId, claim, labelling, question, signal);
    // A question the code itself judged clinical is most likely about somebody's health: it is
    // **not kept**, word for word or as a title — only its code (`docs/legal/assistant-warning.md` F2).
    const kept = decline === 'clinical' ? '' : question;
    // Opened only once there is something to put in it: a question a provider could not label leaves no empty thread.
    const conversationId = ask.conversationId ?? (await AssistantController.open(userId, undefined, kept));

    // A cut question carries its code too, so it is never replayed paired with somebody else's answer.
    await AssistantController.append(userId, conversationId, { content: kept, decline, role: 'user' });

    if (decline !== null) {
      await AssistantController.append(userId, conversationId, { content: '', decline, role: 'assistant' });

      return (async function* events(): AsyncGenerator<AssistantEventDto> {
        yield { id: conversationId, type: 'conversation' };
        yield { decline, type: 'end' };
      })();
    }

    const { context, forbidden } = await this.context(userId);
    const history = historyWindow(screened(earlier, forbidden).map(turn => ({ replay: turn.decline === null, role: turn.role, text: turn.content })));
    const stream = this.streamer.stream({
      feature: 'assistant',
      messages: [...history, { role: 'user', text: question }],
      signal,
      system: assistantSystemPrompt(context)
    });

    return this.answer(userId, conversationId, stream, figureSet(context, question), forbidden);
  }

  /**
   * Whether the question is cut, and why — past the off-topic ceiling with no
   * call at all, on the clinical lexicon before any call, then on the label.
   */
  private async decide(userId: string, claim: string, labelling: boolean, question: string, signal: AbortSignal): Promise<AssistantDecline | null> {
    if (!labelling) {
      return 'off_topic';
    }

    if (clinicalRefusal(question) !== null) {
      return 'clinical';
    }

    const label = await this.label(question, signal);

    if (label === 'off_topic') {
      await AssistantController.markOffTopic(userId, claim);
    }

    return declineFor(label);
  }

  /**
   * The label, or a 503: a provider that cannot label cannot answer either, and
   * the claim is given back, so it costs the person nothing.
   */
  private async label(question: string, signal: AbortSignal): Promise<'clinical' | 'nutrition' | 'off_topic'> {
    try {
      const { object } = await this.labeller.generate({
        feature: 'assistant',
        maxOutputTokens: LABEL_OUTPUT_TOKENS,
        prompt: question,
        schema: questionLabelSchema,
        signal,
        system: LABEL_SYSTEM_PROMPT
      });

      return object.label;
    } catch {
      // The reason is model prose and the question is a person's words: neither is logged.
      this.logger.warn('The assistant could not label a question; it was not answered and not counted.');

      throw new AssistantUnavailableError('provider');
    }
  }

  /** The foods this person may never be shown, as of now. */
  private async forbidden(userId: string): Promise<readonly ForbiddenFood[]> {
    const [generation, allergens] = await Promise.all([RecipeController.generationContext(userId), SafetyController.listAllergens()]);

    return forbiddenOf(generation, allergens);
  }

  /**
   * What the model is told, and the foods the net looks for (never told).
   *
   * **Less than the plan generator reads, through the same doors**:
   * `promptPreferences` for the person, the same allow-list for the cuisines a
   * model may be told (`NAMEABLE_CUISINES`), and the plan as a `SharedPlanView`
   * — the cupboard is dropped at that line, by type, before anything here could
   * read it. No allergy, no goal and no way of eating: health data consented to
   * for the plan alone (`docs/decisions/LOG.md`, 2026-11-10, F1 and F5).
   */
  private async context(userId: string): Promise<{ readonly context: AssistantContext; readonly forbidden: readonly ForbiddenFood[] }> {
    const [profile, verdicts, generation, active, allergens, today] = await Promise.all([
      ProfileController.getFullProfile(userId),
      RecipeController.verdicts(userId),
      RecipeController.generationContext(userId),
      PlanController.getActivePlan(userId),
      SafetyController.listAllergens(),
      personToday(userId)
    ]);
    const plan: SharedPlanView | null = active;
    const targets = profile.targets?.effective ?? plan?.strategy ?? null;

    if (!targets) {
      // `@RequiresOnboarding()` makes this unreachable; said rather than assumed.
      throw new ConflictException('No targets yet');
    }

    const preferences = promptPreferences(profile, verdicts, [], targets, today, null, null, likedFoodNames(generation));
    const forbidden = forbiddenOf(generation, allergens);

    return {
      context: assistantContext({
        cookingTimeMinutes: preferences.cookingTimeMinutes,
        cuisines: preferences.cuisines.filter(cuisine => NAMEABLE_CUISINES.has(normaliseForMatching(cuisine))),
        days: (plan?.days ?? []).map(day => ({
          date: day.date,
          meals: day.meals.map(meal => ({
            accompaniments: meal.accompaniments.map(accompaniment => accompaniment.name),
            dish: meal.name,
            macros: { carbsG: meal.carbsG, fatG: meal.fatG, fiberG: meal.fiberG, kcal: meal.kcal, proteinG: meal.proteinG },
            slot: meal.slot
          })),
          // A day from before event days carries no targets of its own: the fortnight's, then the person's.
          targets: day.targets ?? plan?.strategy ?? targets
        })),
        dislikedNames: preferences.dislikedNames,
        kitchen: generation.preferences.kitchen,
        language: languageName(generation.locale),
        likedFoods: preferences.likedFoods,
        lovedNames: preferences.lovedNames,
        slotShares: preferences.slotShares,
        targets
      }),
      forbidden
    };
  }

  /** Which screen an answer so far fails, if any — the allergen net first, because it is the one with nothing behind it. */
  private static verdict(written: string, set: FigureSet, forbidden: readonly ForbiddenFood[]): AssistantDecline | null {
    if (answerNamesAnAllergen(written, forbidden)) {
      return 'allergen';
    }

    if (!figuresAreAllSupplied(written, set).ok) {
      return 'invented_figure';
    }

    return claimsToAct(written) ? 'acting' : null;
  }

  /**
   * The answer, a sentence at a time: each released only after every check has
   * passed on **everything written so far**, never on the sentence alone —
   * `claimsToAct`'s plan-shaped rule counts days across the whole answer.
   *
   * On a hit the stream stops, what was not released is thrown away, and the
   * decline follows the sentences already shown, which were checked and safe.
   * Whatever ends it — finished, declined, failed, or the person gone — what was
   * shown is stored, because it was shown.
   */
  private answer(
    userId: string,
    conversationId: string,
    stream: AiStream,
    set: FigureSet,
    forbidden: readonly ForbiddenFood[]
  ): AsyncIterable<AssistantEventDto> {
    const logger = this.logger;

    return (async function* events(): AsyncGenerator<AssistantEventDto> {
      let shown = '';
      let buffer = '';
      let decline: AssistantDecline | null = null;

      yield { id: conversationId, type: 'conversation' };

      try {
        for await (const chunk of stream.text) {
          buffer += chunk;

          const { released, remainder } = releaseSentences(buffer);

          if (released === '') {
            continue;
          }

          decline = AssistantService.verdict(shown + released, set, forbidden);

          if (decline !== null) {
            break;
          }

          shown += released;
          buffer = remainder;

          yield { text: released, type: 'text' };
        }

        if (decline === null && buffer !== '') {
          const { released } = flushSentences(buffer);

          decline = AssistantService.verdict(shown + released, set, forbidden);

          if (decline === null) {
            shown += released;

            yield { text: released, type: 'text' };
          }
        }

        yield { decline, type: 'end' };
      } catch {
        logger.warn('The assistant’s answer failed part-way; what was shown is kept.');

        yield { type: 'error' };
      } finally {
        if (shown !== '' || decline !== null) {
          await AssistantController.append(userId, conversationId, { content: shown, decline, role: 'assistant' });
        }
      }
    })();
  }
}

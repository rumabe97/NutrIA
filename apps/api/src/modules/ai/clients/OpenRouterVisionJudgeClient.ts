import { z } from 'zod';

import { isRecord, OpenRouterPictures, PictureCallError, pinnedProvider, reportedCost, servedBy } from './pictureTransport.js';
import { PictureJudgeClient } from './PictureJudgeClient.js';

import type { JudgeCall, JudgedIngredient } from './PictureJudgeClient.js';
import type { PictureMatch, SeenFood, SeenPicture } from 'core/domain/DishPicture';
import type { PictureSettings } from '../ai.config.js';
import type { PinnedProvider } from './pictureTransport.js';

/**
 * Call (a), the pilot's second judge word for word but for one thing: it no
 * longer asks which allergens a food carries. Nothing would read the answer —
 * the allergens come from the catalogue — and a question nobody reads is one
 * more thing for the model to get wrong.
 */
const SEE_PROMPT = [
  'You are inspecting a food photograph. Do not guess what the dish is meant to be; report only what you can see.',
  'Return JSON with:',
  '"foods": every distinct food visible, each as {"name": short English name, "specific": boolean, "amount": "main"|"side"|"garnish"|"trace"}.',
  '  "specific" is true only when you can name the actual food with confidence (e.g. "feta cheese", "mayonnaise", "tahini", "peanuts", "shrimp"). A sauce, dressing, drizzle, glaze, cream or topping you cannot identify is named generically ("sauce", "white drizzle") with "specific": false.',
  '"non_food": visible objects that are not food, tableware or table (e.g. text, hands, people, logos, packaging);',
  '"extra_dishes": number of plates/bowls/glasses with food or drink other than the main one;',
  '"realism": 1-5; "sharpness": 1-5; "plastic_or_cgi": boolean; "notes": one short sentence.'
].join('\n');

/** Call (b): a sauce the listed ingredients could make is a match, not an extra. */
function matchPrompt(seen: readonly SeenFood[], ingredients: readonly JudgedIngredient[]): string {
  return [
    'Match foods seen in a photo against a recipe ingredient list. Be fair: a close variant is a match (tuna/bonito, wholewheat spaghetti/spaghetti, poached egg/egg, goat cheese/white cheese).',
    'A sauce, dressing, drizzle, glaze, oil sheen or seasoning that could be made from listed ingredients (e.g. a pale drizzle when tahini, yoghurt or lemon is listed; a dark glaze when soy sauce or teriyaki is listed; a red dusting when paprika is listed) is a match, not an extra.',
    'An extra is only a distinct food that is clearly none of the ingredients and not made from them.',
    `Recipe ingredients: ${JSON.stringify(ingredients.map(({ name, slug }) => ({ name, slug })))}`,
    `Foods seen: ${JSON.stringify(seen.map(food => food.name))}`,
    'Return JSON: {"ingredients": [{"slug": ..., "status": "seen"|"not_seen"|"unsure", "matched": [seen names]}] (one per ingredient), "extras": [seen names that match no ingredient]}.'
  ].join('\n');
}

/*
 * What the model's JSON must be. Where it strays, it strays toward more
 * checking, never less: a food with no `specific` is taken as specific, one
 * with no known amount as a main one — never as a trace, which cannot reject.
 */
const seenSchema = z
  .object({
    extra_dishes: z.number().catch(0),
    foods: z.array(
      z.object({
        amount: z.enum(['garnish', 'main', 'side', 'trace']).catch('main'),
        name: z.string().trim().min(1),
        specific: z.boolean().catch(true)
      })
    ),
    non_food: z.array(z.string()).catch([]),
    plastic_or_cgi: z.boolean().catch(false),
    realism: z.number().optional().catch(undefined),
    sharpness: z.number().optional().catch(undefined)
  })
  .transform((raw): SeenPicture => ({
    extraDishes: raw.extra_dishes,
    foods: raw.foods,
    nonFood: raw.non_food,
    plasticOrCgi: raw.plastic_or_cgi,
    ...(raw.realism === undefined ? {} : { realism: raw.realism }),
    ...(raw.sharpness === undefined ? {} : { sharpness: raw.sharpness })
  }));

const matchSchema = z.object({
  extras: z.array(z.string()),
  ingredients: z.array(
    z.object({ matched: z.array(z.string()).catch([]), slug: z.string(), status: z.enum(['not_seen', 'seen', 'unsure']).catch('unsure') })
  )
}) satisfies z.ZodType<PictureMatch>;

/**
 * The vision judge through OpenRouter's chat completions, pinned to the
 * endpoint `AI_JUDGE_PROVIDER_ONLY` names (DeepInfra) with the same
 * no-retention block as the picture. It spends from the pictures' own key, so
 * the key's monthly limit covers judging too.
 *
 * Built by `AiModule` from `resolvePictureSettings`; null settings judge nothing.
 */
export class OpenRouterVisionJudgeClient extends PictureJudgeClient {
  private readonly api: OpenRouterPictures | null;
  private readonly provider: PinnedProvider | null;

  constructor(
    private readonly settings: PictureSettings | null,
    secrets: readonly string[],
    fetchImpl?: typeof fetch
  ) {
    super();
    this.api = settings ? new OpenRouterPictures(settings.apiKey, secrets, fetchImpl) : null;
    this.provider = settings ? pinnedProvider(settings.judgeProviders) : null;
  }

  get isAvailable(): boolean {
    return this.api !== null;
  }

  see(picture: { readonly bytes: Uint8Array; readonly contentType: string }, signal?: AbortSignal): Promise<JudgeCall<SeenPicture>> {
    // The file as it came, in base64 — carried, not re-encoded.
    const url = `data:${picture.contentType};base64,${Buffer.from(picture.bytes).toString('base64')}`;

    return this.ask(
      [
        { text: SEE_PROMPT, type: 'text' },
        { image_url: { url }, type: 'image_url' }
      ],
      seenSchema,
      signal
    );
  }

  match(seen: readonly SeenFood[], ingredients: readonly JudgedIngredient[], signal?: AbortSignal): Promise<JudgeCall<PictureMatch>> {
    return this.ask(matchPrompt(seen, ingredients), matchSchema, signal);
  }

  private async ask<T>(content: unknown, schema: z.ZodType<T>, signal?: AbortSignal): Promise<JudgeCall<T>> {
    if (!this.api || !this.provider || !this.settings) {
      throw new PictureCallError('No judge model configured', null);
    }

    const model = this.settings.judgeModel;
    const answer = await this.api.post(
      '/chat/completions',
      {
        max_tokens: 900,
        messages: [{ content, role: 'user' }],
        model,
        response_format: { type: 'json_object' },
        temperature: 0,
        usage: { include: true }
      },
      this.provider,
      signal
    );
    const parsed = schema.safeParse(parseJson(messageContent(answer.body)));

    if (!parsed.success) {
      // The model's words are not quoted: a picture that cannot be judged is not kept, and that is all anyone needs to read.
      throw new PictureCallError('The judge answered with JSON of the wrong shape', null);
    }

    return { costUsd: reportedCost(answer.body), model, provider: servedBy(answer), result: parsed.data };
  }
}

function messageContent(body: unknown): string {
  const choices = isRecord(body) && Array.isArray(body['choices']) ? (body['choices'] as unknown[]) : [];
  const message = isRecord(choices[0]) ? choices[0]['message'] : undefined;
  const content = isRecord(message) ? message['content'] : undefined;

  return typeof content === 'string' ? content : '';
}

/** JSON, with the Markdown fence some models put round it taken off. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?/, '')
        .replace(/```$/, '')
        .trim()
    ) as unknown;
  } catch {
    return null;
  }
}

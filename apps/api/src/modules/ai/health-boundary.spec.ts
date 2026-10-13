import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, jest } from '@jest/globals';
import { dirname, join } from 'node:path';

import { buildPicturePrompt } from 'core/domain/DishPicture';
import { dishVocabulary, storableName, storableProse } from 'core/domain/DishRequest';
import { Logger } from '@nestjs/common';
import { FOOD_GROUP_SLUGS } from 'core/domain/MealFit';
import { pulseKind } from 'core/domain/Variety';
import { resolvePreferences } from 'core/domain/Preference';
import { toCatalogue } from 'core/entities/Plan';

import { buildPoolPrompt } from './prompts/PoolPrompt.js';
import { likedFoodNames, promptPreferences } from '../meal-plans/services/GenerationShared.js';
import { OpenRouterImageClient } from './clients/OpenRouterImageClient.js';
import { OpenRouterVisionJudgeClient } from './clients/OpenRouterVisionJudgeClient.js';
import { PoolBuilder } from './services/PoolBuilder.service.js';

import type { AiClient, AiRequest, AiResponse } from './clients/AiClient.js';
import type { CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { FullProfileView } from 'core/controllers/Profile';
import type { GenerationContext } from 'core/controllers/Recipe';
import type { PictureRecipe } from 'core/domain/DishPicture';
import type { PictureSettings } from './ai.config.js';
import type { PromptContext } from './prompts/PoolPrompt.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The boundary from `docs/decisions/0004-deterministic-safety-layer.md`, made
 * mechanical.
 *
 * Health data is collected, stored and shown back. It is never reasoned about,
 * and the strongest form of "never" available here is that the code which talks
 * to a model has no way to reach it. These tests fail the moment someone adds
 * the import that would make it reachable — which is the moment worth catching,
 * not the moment a medication finally shows up in a prompt.
 */
describe('the health-data boundary around the AI module', () => {
  const sources = readdirSync(HERE, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
    .map(entry => join(entry.parentPath, entry.name));

  it('has sources to check, so a rename cannot turn this suite into a no-op', () => {
    expect(sources.length).toBeGreaterThan(4);
  });

  /*
   * The professional's side goes behind the same wall (PRD 004, criterion 11):
   * a link is how a professional reaches a client's conditions, and what a
   * professional reads or writes about a client is theirs and the client's,
   * never a prompt's (`0059`).
   */
  it.each([
    'core/controllers/Admin',
    'core/controllers/Health',
    'core/entities/Health',
    '#repositories/Health',
    'core/controllers/Care',
    'core/entities/Care',
    '#repositories/Care',
    'core/controllers/Professional',
    'core/entities/Professional',
    '#repositories/Professional'
  ])('imports nothing from %s', specifier => {
    const offenders = sources.filter(path => readFileSync(path, 'utf8').includes(specifier));

    expect(offenders).toEqual([]);
  });

  // The API modules that hold the same data, by any relative path into them — and `owner-alerts`,
  // which reads `core/controllers/Admin`: a drawing tells its caller it ended, never the owner (project 009).
  it.each(['care', 'health-data', 'owner-alerts'])('imports nothing from the %s module', module => {
    const into = new RegExp(`(?:from\\s+|import\\(\\s*)['"][./]*(?:modules/)?${module}/`);
    const offenders = sources.filter(path => into.test(readFileSync(path, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('builds a prompt from a context that has nowhere to put a condition or a medication', () => {
    const context: PromptContext = {
      avoidNames: [],
      cookingTimeMinutes: 30,
      cuisines: ['Mediterránea'],
      dietaryPatterns: ['omnivore'],
      dislikedNames: ['Lentejas con chorizo'],
      excludeSlugs: [],
      goal: null,
      language: 'Spanish (Spain)',
      likedFoods: ['Salmón'],
      lovedNames: ['Salmón al horno con eneldo'],
      month: 1,
      needBySlot: new Map<MealSlot, number>([['breakfast', 2]]),
      slotShares: new Map(),
      targets: { carbsG: 200, fatG: 60, fiberG: 28, kcal: 2000, proteinG: 150 }
    };

    // Every key the prompt can carry, listed. A future field called `conditions`
    // or `medications` fails here before it can ever be rendered.
    expect(Object.keys(context).filter(key => /condition|medication|health|supplement|diagnos/i.test(key))).toEqual([]);

    const prompt = buildPoolPrompt(context, []);

    for (const word of ['metformina', 'celiaquía', 'diabetes', 'embarazo', 'medicaci']) {
      expect(prompt.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

/**
 * The second boundary (owner's decision, 2026-09-25; `docs/legal/analysis.md`
 * P0-3): nothing a person typed and nothing that reveals a belief reaches a
 * model. Driven end to end — a profile full of their own words, through the
 * same `promptPreferences` and `PoolBuilder` a generation uses, to every request
 * the model would receive — so a new field, a new line or a new caller that
 * lets one through fails here.
 */
describe('the free-text and belief boundary around the AI module', () => {
  /** Each is a string that exists only in what the person typed, or a belief's name. */
  const SENTINELS = {
    checkIn: 'SENTINEL-CHECKIN me mareé',
    cuisine: 'SENTINEL-CUISINE la de mi madre',
    customAllergen: 'SENTINEL-ALLERGY altramuz silvestre',
    dislike: 'SENTINEL-DISLIKE cosas con sulfitos',
    like: 'SENTINEL-LIKE comida de hospital'
  } as const;

  const ALLERGEN_IDS = new Map([
    ['gluten', 'allergen-gluten'],
    ['lactose', 'allergen-lactose'],
    ['milk', 'allergen-milk']
  ]);
  const TAGS: Record<string, CatalogueIngredient['allergens']> = {
    leche: [
      { allergenId: 'allergen-milk', presence: 'contains' },
      { allergenId: 'allergen-lactose', presence: 'contains' }
    ],
    'pan-de-trigo': [{ allergenId: 'allergen-gluten', presence: 'contains' }]
  };
  const catalogue: CatalogueIngredient[] = ['arroz', 'pollo', 'salmon', 'leche', 'pan-de-trigo', 'vino-blanco', 'chuleta-de-cerdo'].map(slug => ({
    id: `ing-${slug}`,
    allergens: TAGS[slug] ?? [],
    carbsPer100g: 10,
    category: 'pantry',
    classes: slug === 'chuleta-de-cerdo' ? ['meat', 'pork', 'animal'] : slug === 'leche' ? ['dairy', 'animal'] : [],
    defaultUnit: 'g',
    fatPer100g: 5,
    fiberPer100g: 1,
    gramsPerUnit: null,
    kcalPer100g: 150,
    mealSlots: [],
    name: slug,
    nameLocale: 'es-ES',
    proteinPer100g: 10,
    seasonMonths: [],
    slug
  }));

  function profileFullOfWords(dietaryPatterns: readonly string[]): FullProfileView {
    return {
      cuisines: ['Mediterránea', SENTINELS.cuisine],
      dietaryPatterns,
      foodPreferences: [
        { ingredientId: null, label: SENTINELS.dislike, sentiment: 'disliked' },
        { ingredientId: null, label: SENTINELS.like, sentiment: 'liked' },
        { ingredientId: 'ing-salmon', label: 'salmon', sentiment: 'liked' }
      ],
      goal: { type: 'weight_loss' },
      preferences: { cookingTimeMinutes: 30, mealShape: undefined }
    } as unknown as FullProfileView;
  }

  async function everyRequest(dietaryPatterns: readonly string[]): Promise<string> {
    const resolved = resolvePreferences({
      allergenIdsByKey: ALLERGEN_IDS,
      dietaryPatterns,
      dislikedLabels: [SENTINELS.dislike],
      ingredients: catalogue,
      likedLabels: [SENTINELS.like, 'salmon']
    });
    const context: GenerationContext = {
      catalogue: toCatalogue(catalogue),
      dietaryPatterns,
      locale: 'es-ES',
      preferences: resolved,
      safety: {
        allergenIds: new Set(),
        crossContaminationAllergenIds: new Set(),
        excludedIngredientIds: new Set(),
        intoleranceAllergenIds: new Set(),
        unenforceableLabels: [SENTINELS.customAllergen]
      }
    };
    const generate = jest.fn(async <T>(_request: AiRequest<T>): Promise<AiResponse<T>> =>
      Promise.resolve({ object: { dishes: [] } as T, usage: { calls: 1, inputTokens: 1, model: 'stub', outputTokens: 1 } })
    );
    const client = { generate, isAvailable: true } as unknown as AiClient;
    const preferences = promptPreferences(
      profileFullOfWords(dietaryPatterns),
      { disliked: [], liked: [] },
      [],
      { carbsG: 200, fatG: 60, fiberG: 28, kcal: 2000, proteinG: 150 },
      '2026-01-12',
      { comments: SENTINELS.checkIn, difficulty: 'hard', hunger: 'hungry', satisfaction: 2 },
      null,
      likedFoodNames(context)
    );

    await new PoolBuilder(client).build({ context, feature: 'plan', preferences, reusable: [], slots: ['breakfast', 'lunch'] });

    expect(generate).toHaveBeenCalled();

    return generate.mock.calls.map(([request]) => JSON.stringify(request)).join('\n');
  }

  it.each(Object.entries(SENTINELS))('never sends the %s the person typed', async (_field, words) => {
    const sent = await everyRequest(['vegetarian']);

    expect(sent).not.toContain(words);
    expect(sent).not.toContain(words.split(' ')[0]);
  });

  it.each(['halal', 'kosher'])('never names %s — a belief — to the model, while still enforcing it in the catalogue it is shown', async pattern => {
    const sent = await everyRequest([pattern]);

    expect(sent.toLowerCase()).not.toContain(pattern);
    expect(sent).not.toContain('chuleta-de-cerdo');
    expect(sent).not.toContain('vino-blanco');
  });

  it.each([
    ['gluten_free', 'pan-de-trigo'],
    ['lactose_free', 'leche']
  ])('never names %s — it reveals a condition — while taking what it rules out from the catalogue it is shown', async (pattern, excluded) => {
    const sent = await everyRequest([pattern]);

    expect(sent.toLowerCase()).not.toContain(pattern);
    expect(sent.toLowerCase()).not.toContain(pattern.split('_')[0] ?? pattern);
    expect(sent).not.toContain(excluded);
    expect(sent).toContain('arroz');
  });

  /** The legume kinds an ask may name: `pulseKind`'s vocabulary, as `kindName` writes it, and nothing a person typed. */
  const KINDS = [...new Set([...FOOD_GROUP_SLUGS.pulses].map(slug => (pulseKind(slug) ?? slug).replaceAll('-', ' ')))].join('|');
  const ASK_GRAMMAR = new RegExp(
    `^\\d+ on (legumes( \\(25 g dry a serving\\)(, not (${KINDS})(( or |, )(${KINDS}))*)?|, light \\(warm salad, cream, hummus\\), never stewed)|a whole grain|an oily fish)$`
  );

  /*
   * 4.7.0's group asks are read off the pool and the catalogue a request is
   * shown, never off why a group is missing, and say nothing but the group:
   * no condition, no belief, no word the person typed.
   */
  it.each([[[]], [['kosher']], [['gluten_free']], [['vegetarian']]])(
    'asks only for a food group, in its own words, for a person who eats %j',
    async patterns => {
      const sent = await everyRequest(patterns);
      const asks = [...sent.matchAll(/Of these: ([^\\]*)\./g)].flatMap(match => (match[1] ?? '').split('; '));

      expect(asks.length).toBeGreaterThan(0);

      for (const ask of asks) {
        expect(ask).toMatch(ASK_GRAMMAR);
      }
    }
  );

  it('still carries the structured answers a plan is designed from', async () => {
    const sent = await everyRequest(['vegetarian']);

    expect(sent).toContain('WAY OF EATING: vegetarian');
    expect(sent).toContain('PREFERRED CUISINES: Mediterránea');
    expect(sent).toContain('LIKES: salmon');
    expect(sent).toContain('MAXIMUM TIME PER DISH: 30 minutes');
  });

  it('gives the prompt no field a typed text could live in', () => {
    const allowed = [
      'avoidNames',
      'checkIn',
      'cookingTimeMinutes',
      // The one field in any prompt whose content a person writes, added here on
      // purpose when the dish request shipped (report `0011` § 4 a, and the five
      // conditions in `docs/legal/analysis.md`, "P0-3's status at 2026-10-13").
      // Its own key and not `swapWish`'s, so that adding it had to be a line in
      // this list — which is where a reviewer is meant to stop and ask.
      'dishRequest',
      'cuisines',
      'dietaryPatterns',
      'dislikedNames',
      'excludeSlugs',
      'goal',
      'language',
      'likedFoods',
      'loadedTargets',
      'lovedNames',
      'month',
      'needBySlot',
      'slotShares',
      'swapWish',
      'targets'
    ];
    const preferences = promptPreferences(
      profileFullOfWords([]),
      { disliked: [], liked: [] },
      [],
      { carbsG: 1, fatG: 1, fiberG: 1, kcal: 1, proteinG: 1 },
      '2026-01-12'
    );

    // A key added to what the prompt is told has to be added here, on purpose.
    expect(Object.keys(preferences).filter(key => !allowed.includes(key))).toEqual([]);
  });
  /*
   * The dish request is the one field a person writes into (report `0011` § 4 a),
   * and the two places its words could come back out are a **shared** library
   * and the picture prompt, which carries a dish's name verbatim to Google.
   *
   * This drives the real builder with a model that echoes the request into both
   * the name and the method — which is the whole risk, and what an earlier
   * version of this test only pretended to do: it never put the typed words
   * into anything, so its assertion could not fail (`invariant-reviewer`,
   * 2026-10-13).
   *
   * Three claims, in one run: the words reach the prompt (they are meant to),
   * they reach **no log line**, and neither the name nor the method a model
   * wrote with them in is storable.
   */
  it('lets a typed dish request reach the prompt and nothing else — not a log line, not the library', async () => {
    const typed = 'SENTINEL-TYPED tortilla para mi madre, que toma metformina';
    const lines: string[] = [];
    const written: string[] = [];

    for (const method of ['debug', 'error', 'log', 'warn'] as const) {
      jest.spyOn(Logger.prototype, method).mockImplementation((message: unknown) => {
        lines.push(String(message));
      });
    }

    try {
      const context: GenerationContext = {
        catalogue: toCatalogue(catalogue),
        dietaryPatterns: [],
        locale: 'es-ES',
        preferences: resolvePreferences({ allergenIdsByKey: ALLERGEN_IDS, dietaryPatterns: [], dislikedLabels: [], ingredients: catalogue }),
        safety: {
          allergenIds: new Set(),
          crossContaminationAllergenIds: new Set(),
          excludedIngredientIds: new Set(),
          intoleranceAllergenIds: new Set(),
          unenforceableLabels: []
        }
      };
      // A model that answers with the request echoed into every field a name or
      // a method could carry it in.
      const echo = jest.fn(async <T>(request: AiRequest<T>): Promise<AiResponse<T>> => {
        written.push(JSON.stringify(request));

        return Promise.resolve({
          object: {
            dishes: [{ cuisine: typed, name: `Tortilla ${typed}`, steps: [{ text: `Como la hace ${typed}.` }] }]
          } as T,
          usage: { calls: 1, inputTokens: 1, model: 'stub', outputTokens: 1 }
        });
      });
      const preferences = promptPreferences(
        profileFullOfWords([]),
        { disliked: [], liked: [] },
        [],
        { carbsG: 200, fatG: 60, fiberG: 28, kcal: 2000, proteinG: 150 },
        '2026-01-12',
        null,
        null,
        [],
        typed
      );

      await new PoolBuilder({ generate: echo, isAvailable: true } as unknown as AiClient).build({
        context,
        feature: 'dish_request',
        needPerSlot: 1,
        preferences,
        reusable: [],
        slots: ['lunch']
      });

      // It is meant to be there, and nowhere else.
      expect(written.join('\n')).toContain(typed);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.filter(line => line.includes('SENTINEL-TYPED') || line.includes('madre') || line.includes('metformina'))).toEqual([]);

      // And the same build as a plan does print the name, so the silence above
      // is this feature's rule and not an empty assertion.
      lines.length = 0;

      await new PoolBuilder({ generate: echo, isAvailable: true } as unknown as AiClient).build({
        context,
        feature: 'plan',
        needPerSlot: 1,
        preferences,
        reusable: [],
        slots: ['lunch']
      });

      expect(lines.filter(line => line.includes('SENTINEL-TYPED'))).not.toEqual([]);
    } finally {
      jest.restoreAllMocks();
    }

    // Nothing the model wrote with those words in it may be stored: the name by
    // its vocabulary, the method by this account's own words.
    const vocabulary = dishVocabulary(toCatalogue(catalogue), ['Tortilla de patatas']);
    const person = { health: ['Metformina'], name: 'Probe' };

    expect(storableName(`Tortilla ${typed}`, vocabulary, person)).toEqual({ ok: false, reason: 'says_a_person' });
    expect(storableProse([`Como la hace ${typed}.`], person)).toEqual({ ok: false, reason: 'says_a_person' });
  });
});

/**
 * The dish pictures (`0066`, PRD 4). A picture is drawn once and shown to
 * everyone who eats the dish, so nothing about the person who opened it may
 * reach the image model or the judge: not their allergies, their profile or
 * their health. Driven through the prompt builder and both clients with a
 * recipe that carries a person's words in fields it should not have, to every
 * byte the three calls send.
 */
describe('the person boundary around the dish pictures', () => {
  const SENTINEL = 'SENTINEL-PERSON';
  const recipe: PictureRecipe = {
    ingredients: [
      { grams: 150, name: 'Cooked white rice', slug: 'arroz' },
      { grams: 120, name: 'Chicken breast', slug: 'pollo' }
    ],
    name: 'Arroz con pollo'
  };
  const smuggled = {
    ...recipe,
    allergies: [`${SENTINEL} altramuz`],
    ingredients: recipe.ingredients.map(ingredient => ({ ...ingredient, excludedFor: `${SENTINEL} celiaquía` })),
    userId: `${SENTINEL}-id`
  };
  const settings: PictureSettings = {
    apiKey: 'sk-or-v1-boundary-spec-key',
    imageModel: 'google/gemini-3.1-flash-lite-image',
    imageProviders: ['google-vertex/global'],
    judgeModel: 'qwen/qwen3-vl-235b-a22b-instruct',
    judgeProviders: ['deepinfra'],
    monthlyCapUsd: 10
  };

  it('sends the image model and the judge recipe data and nothing else', async () => {
    const bodies: string[] = [];
    const fake = (async (input: Request | string | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));

      return new Response(
        String(input).endsWith('/images')
          ? JSON.stringify({ data: [{ b64_json: Buffer.from([0xff, 0xd8, 0xff]).toString('base64') }], usage: { cost: 0.03 } })
          : JSON.stringify({ choices: [{ message: { content: '{"foods": [], "extras": [], "ingredients": []}' } }] })
      );
    }) as unknown as typeof fetch;
    const image = new OpenRouterImageClient(settings, [], fake, []);
    const judge = new OpenRouterVisionJudgeClient(settings, [], fake);

    const picture = await image.draw(buildPicturePrompt(smuggled));
    const seen = await judge.see(picture);
    await judge.match(seen.result.foods, smuggled.ingredients);

    expect(bodies).toHaveLength(3);
    expect(bodies.filter(body => body.includes('SENTINEL'))).toEqual([]);
    expect(bodies[0]).toContain('Arroz con pollo');
  });

});

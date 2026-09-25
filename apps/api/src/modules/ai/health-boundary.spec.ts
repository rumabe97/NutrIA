import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, jest } from '@jest/globals';
import { dirname, join } from 'node:path';

import { resolvePreferences } from 'core/domain/Preference';
import { toCatalogue } from 'core/entities/Plan';

import { buildPoolPrompt } from './prompts/PoolPrompt.js';
import { likedFoodNames, promptPreferences } from '../meal-plans/services/GenerationShared.js';
import { PoolBuilder } from './services/PoolBuilder.service.js';

import type { AiClient, AiRequest, AiResponse } from './clients/AiClient.js';
import type { CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { FullProfileView } from 'core/controllers/Profile';
import type { GenerationContext } from 'core/controllers/Recipe';
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

  // The API modules that hold the same data, by any relative path into them.
  it.each(['care', 'health-data'])('imports nothing from the %s module', module => {
    const into = new RegExp(`(?:from\\s+|import\\(\\s*)['"][./]*(?:modules/)?${module}/`);
    const offenders = sources.filter(path => into.test(readFileSync(path, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('builds a prompt from a context that has nowhere to put a condition or a medication', () => {
    const context: PromptContext = {
      avoidNames: [],
      budget: 'medium',
      cookingFrequency: null,
      cookingTimeMinutes: 30,
      cuisines: ['Mediterránea'],
      dayShape: null,
      dietaryPatterns: ['omnivore'],
      dislikedNames: ['Lentejas con chorizo'],
      excludeSlugs: [],
      goal: null,
      language: 'Spanish (Spain)',
      likedFoods: ['Salmón'],
      lovedNames: ['Salmón al horno con eneldo'],
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
 * The second boundary (owner's decision, 2026-09-25; `docs/legal/analisis.md`
 * P0-3): nothing a person typed and nothing that reveals a belief reaches a
 * model. Driven end to end — a profile full of their own words, through the
 * same `promptPreferences` and `PoolBuilder` a generation uses, to every request
 * the model would receive — so a new field, a new line or a new caller that
 * lets one through fails here.
 */
describe('the free-text and belief boundary around the AI module', () => {
  /** Each is a string that exists only in what the person typed, or a belief's name. */
  const SENTINELS = {
    breakfast: 'SENTINEL-BREAKFAST desayuno tras la insulina',
    checkIn: 'SENTINEL-CHECKIN me mareé',
    cuisine: 'SENTINEL-CUISINE la de mi madre',
    customAllergen: 'SENTINEL-ALLERGY altramuz silvestre',
    dislike: 'SENTINEL-DISLIKE cosas con sulfitos',
    like: 'SENTINEL-LIKE comida de hospital',
    portion: 'SENTINEL-PORTION poco por la gastritis',
    schedule: 'SENTINEL-SCHEDULE turnos en la mezquita'
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
      preferences: {
        breakfastStyle: SENTINELS.breakfast,
        budget: 'medium',
        cookingFrequency: 'often',
        cookingTimeMinutes: 30,
        mealShape: undefined,
        portionPreference: SENTINELS.portion,
        sleepEnd: '07:00',
        sleepStart: '23:00',
        trainingDaysPerWeek: 3,
        trainingTime: '18:00',
        workScheduleNotes: SENTINELS.schedule
      }
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
      { comments: SENTINELS.checkIn, difficulty: 'hard', hunger: 'hungry', satisfaction: 2 },
      null,
      likedFoodNames(context)
    );

    await new PoolBuilder(client).build({ context, preferences, reusable: [], slots: ['breakfast', 'lunch'] });

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

  it('still carries the structured answers a plan is designed from', async () => {
    const sent = await everyRequest(['vegetarian']);

    expect(sent).toContain('WAY OF EATING: vegetarian');
    expect(sent).toContain('PREFERRED CUISINES: Mediterránea');
    expect(sent).toContain('LIKES: salmon');
    expect(sent).toContain('Cooks: often');
    expect(sent).toContain('wakes at 07:00');
  });

  it('gives the prompt no field a typed text could live in', () => {
    const allowed = [
      'avoidNames',
      'budget',
      'checkIn',
      'cookingFrequency',
      'cookingTimeMinutes',
      'cuisines',
      'dayShape',
      'dietaryPatterns',
      'dislikedNames',
      'excludeSlugs',
      'goal',
      'language',
      'likedFoods',
      'loadedTargets',
      'lovedNames',
      'needBySlot',
      'slotShares',
      'swapWish',
      'targets'
    ];
    const preferences = promptPreferences(profileFullOfWords([]), { disliked: [], liked: [] }, [], {
      carbsG: 1,
      fatG: 1,
      fiberG: 1,
      kcal: 1,
      proteinG: 1
    });

    // A key added to what the prompt is told has to be added here, on purpose.
    expect(Object.keys(preferences).filter(key => !allowed.includes(key))).toEqual([]);
  });
});

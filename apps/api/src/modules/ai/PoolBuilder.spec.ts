import { describe, expect, it, jest } from '@jest/globals';

import { toCatalogue } from 'core/entities/Plan';

import { DISHES_NEEDED_PER_SLOT, PoolBuilder, shortfall } from './PoolBuilder.service.js';

import type { AiClient, AiRequest, AiResponse } from './clients/AiClient.js';
import type { CandidateDish, CatalogueIngredient, MealSlot } from 'core/entities/Plan';
import type { GeneratedPool } from './pool.schema.js';
import type { GenerationContext } from 'core/controllers/Recipe';

const GLUTEN = 'allergen-gluten';
const MILK = 'allergen-milk';

function ingredient(slug: string, allergens: CatalogueIngredient['allergens'] = []): CatalogueIngredient {
  return {
    id: `ing-${slug}`,
    allergens,
    carbsPer100g: 20,
    category: 'pantry',
    defaultUnit: 'g',
    fatPer100g: 6,
    fiberPer100g: 2,
    gramsPerUnit: null,
    kcalPer100g: 200,
    name: slug,
    nameLocale: 'es-ES',
    proteinPer100g: 12,
    slug
  };
}

const CATALOGUE = [
  ingredient('arroz'),
  ingredient('pollo'),
  ingredient('tomate'),
  ingredient('pan', [{ allergenId: GLUTEN, presence: 'contains' }]),
  ingredient('avena', [{ allergenId: GLUTEN, presence: 'may_contain' }]),
  ingredient('leche', [{ allergenId: MILK, presence: 'contains' }])
];

function context(overrides?: Partial<GenerationContext['safety']>): GenerationContext {
  return {
    catalogue: toCatalogue(CATALOGUE),
    locale: 'es-ES',
    safety: {
      allergenIds: new Set<string>(),
      crossContaminationAllergenIds: new Set<string>(),
      excludedIngredientIds: new Set<string>(),
      intoleranceAllergenIds: new Set<string>(),
      unenforceableLabels: [],
      ...overrides
    }
  };
}

const SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];

function dish(name: string, slots: readonly MealSlot[], slugs: readonly string[] = ['arroz']) {
  return {
    cookMinutes: 10,
    cuisine: null,
    difficulty: 'easy' as const,
    ingredients: slugs.map(slug => ({ grams: 100, slug })),
    name,
    prepMinutes: 5,
    servings: 1,
    slots: [...slots],
    steps: [{ text: 'Mezclar' }]
  };
}

/** A pool already covering every slot, as reuse would supply. */
function fullReusablePool(): CandidateDish[] {
  return SLOTS.flatMap(slot =>
    Array.from({ length: DISHES_NEEDED_PER_SLOT }, (_unused, index) => ({ ...dish(`${slot} ${index}`, [slot]), slug: `${slot}-${index}` }))
  );
}

function stubClient(responses: readonly GeneratedPool[], available = true): { client: AiClient; generate: jest.Mock } {
  let call = 0;
  const generate = jest.fn(async <T,>(_request: AiRequest<T>): Promise<AiResponse<T>> => {
    const object = responses[Math.min(call, responses.length - 1)] ?? { dishes: [] };
    call += 1;

    return { object: object as T, usage: { calls: 1, inputTokens: 100, model: 'stub-model', outputTokens: 500 } };
  });

  return { client: { generate, isAvailable: available } as unknown as AiClient, generate: generate as unknown as jest.Mock };
}

describe('shortfall', () => {
  it('asks for a full complement when nothing is reusable', () => {
    expect([...shortfall(SLOTS, []).values()]).toEqual([DISHES_NEEDED_PER_SLOT, DISHES_NEEDED_PER_SLOT, DISHES_NEEDED_PER_SLOT]);
  });

  it('asks for nothing when reuse already covers every slot', () => {
    expect([...shortfall(SLOTS, fullReusablePool()).values()]).toEqual([0, 0, 0]);
  });

  it('counts a dish once per slot it suits', () => {
    const versatile = Array.from({ length: DISHES_NEEDED_PER_SLOT }, (_u, i) => ({ ...dish(`x${i}`, ['lunch', 'dinner']), slug: `x${i}` }));

    expect(shortfall(SLOTS, versatile).get('lunch')).toBe(0);
    expect(shortfall(SLOTS, versatile).get('breakfast')).toBe(DISHES_NEEDED_PER_SLOT);
  });
});

describe('PoolBuilder', () => {
  const preferences = {
    budget: null,
    cookingTimeMinutes: 30,
    cuisines: [],
    dietaryPatterns: [],
    dislikedLabels: [],
    likedLabels: [],
    targets: { carbsG: 200, fatG: 60, fiberG: 25, kcal: 2000, proteinG: 120 }
  };

  it('makes no model call at all when reuse already covers every slot', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);
    const result = await new PoolBuilder(client).build({ context: context(), preferences, reusable: fullReusablePool(), slots: SLOTS });

    // This is the mechanism that keeps running cost from scaling with users.
    expect(generate).not.toHaveBeenCalled();
    expect(result.metadata.calls).toBe(0);
    expect(result.metadata.reused).toBe(fullReusablePool().length);
    expect(result.generated).toEqual([]);
  });

  it('generates only the shortfall and reports usage', async () => {
    const generated = SLOTS.flatMap(slot => Array.from({ length: DISHES_NEEDED_PER_SLOT }, (_u, i) => dish(`${slot} nuevo ${i}`, [slot])));
    const { client, generate } = stubClient([{ dishes: generated }]);
    const result = await new PoolBuilder(client).build({ context: context(), preferences, reusable: [], slots: SLOTS });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.metadata).toMatchObject({ calls: 1, inputTokens: 100, model: 'stub-model', outputTokens: 500, rejected: 0, reused: 0 });
    expect(result.dishes.length).toBeGreaterThanOrEqual(SLOTS.length * DISHES_NEEDED_PER_SLOT);
  });

  it('rejects a dish referencing an ingredient outside the catalogue, and retries', async () => {
    const bad = { dishes: [dish('Fantasma', ['lunch'], ['no-existe'])] };
    const { client, generate } = stubClient([bad]);
    const result = await new PoolBuilder(client).build({ context: context(), preferences, reusable: [], slots: ['lunch'] });

    expect(result.dishes).toEqual([]);
    expect(result.metadata.rejected).toBeGreaterThan(0);
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it('rejects a generated dish containing a declared allergen, and never returns it', async () => {
    const unsafe = { dishes: [dish('Tostada', ['breakfast'], ['pan'])] };
    const { client } = stubClient([unsafe]);
    const result = await new PoolBuilder(client).build({
      context: context({ allergenIds: new Set([GLUTEN]) }),
      preferences,
      reusable: [],
      slots: ['breakfast']
    });

    expect(result.dishes).toEqual([]);
    expect(result.generated).toEqual([]);
    expect(result.metadata.rejected).toBeGreaterThan(0);
  });

  it('never offers an unsafe ingredient to the model in the first place', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({ context: context({ allergenIds: new Set([GLUTEN]) }), preferences, reusable: [], slots: ['breakfast'] });

    const prompt = (generate.mock.calls[0]?.[0] as { prompt: string }).prompt;

    expect(prompt).toContain('arroz');
    expect(prompt).not.toContain('pan');
  });

  it('offers a trace-risk ingredient to a user who is not trace-sensitive', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({ context: context({ allergenIds: new Set([GLUTEN]) }), preferences, reusable: [], slots: ['breakfast'] });

    expect((generate.mock.calls[0]?.[0] as { prompt: string }).prompt).toContain('avena');
  });

  it('withholds a trace-risk ingredient from a trace-sensitive user', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({
      context: context({ allergenIds: new Set([GLUTEN]), crossContaminationAllergenIds: new Set([GLUTEN]) }),
      preferences,
      reusable: [],
      slots: ['breakfast']
    });

    expect((generate.mock.calls[0]?.[0] as { prompt: string }).prompt).not.toContain('avena');
  });

  it('rejects a generated dish using an ingredient a free-text allergy resolved to', async () => {
    // `tomate` carries no allergen link at all. The only thing standing between
    // it and the plate is the exclusion — the same gate, one more axis.
    const unsafe = { dishes: [dish('Ensalada', ['lunch'], ['tomate'])] };
    const { client } = stubClient([unsafe]);
    const result = await new PoolBuilder(client).build({
      context: context({ excludedIngredientIds: new Set(['ing-tomate']) }),
      preferences,
      reusable: [],
      slots: ['lunch']
    });

    expect(result.dishes).toEqual([]);
    expect(result.metadata.rejected).toBeGreaterThan(0);
  });

  it('never offers an ingredient excluded by a free-text allergy', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({
      context: context({ excludedIngredientIds: new Set(['ing-tomate']) }),
      preferences,
      reusable: [],
      slots: ['breakfast']
    });

    const prompt = (generate.mock.calls[0]?.[0] as { prompt: string }).prompt;

    expect(prompt).toContain('arroz');
    expect(prompt).not.toContain('tomate');
  });

  it('names an allergy it could not resolve, because there is no ingredient to withhold', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({
      context: context({ unenforceableLabels: ['marisco'] }),
      preferences,
      reusable: [],
      slots: ['breakfast']
    });

    expect((generate.mock.calls[0]?.[0] as { prompt: string }).prompt).toContain('marisco');
  });

  it('says nothing about allergies when every one of them resolved', async () => {
    // The default remains "enforce by omission": a matched allergy is removed
    // from the catalogue and never mentioned, so the prompt carries no health
    // data it does not need to.
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({
      context: context({ allergenIds: new Set([GLUTEN]), excludedIngredientIds: new Set(['ing-tomate']) }),
      preferences,
      reusable: [],
      slots: ['breakfast']
    });

    expect((generate.mock.calls[0]?.[0] as { prompt: string }).prompt).not.toContain('PROHIBIDO POR ALERGIA');
  });

  it('writes the prompt in English and asks for output in the user\u2019s language', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({ context: { ...context(), locale: 'en-GB' }, preferences, reusable: [], slots: ['breakfast'] });

    const prompt = (generate.mock.calls[0]?.[0] as { prompt: string }).prompt;

    // The instructions are English for everyone — one prompt to maintain, and the
    // one these models follow best. Only the requested output language varies.
    expect(prompt).toContain('Design dishes for a 14-day meal plan.');
    expect(prompt).toContain('BRITISH ENGLISH');
    expect(prompt).not.toContain('Diseña platos');
  });

  it('asks for Spanish when that is the user\u2019s language', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({ context: { ...context(), locale: 'es-ES' }, preferences, reusable: [], slots: ['breakfast'] });

    expect((generate.mock.calls[0]?.[0] as { prompt: string }).prompt).toContain('SPANISH (SPAIN)');
  });

  it('asks for cooking rather than combinations', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({ context: context(), preferences, reusable: [], slots: ['lunch'] });

    const prompt = (generate.mock.calls[0]?.[0] as { prompt: string }).prompt;

    // "The recipes seem too basic" was a prompt that asked for realistic and
    // varied dishes and never once asked the model to season anything.
    expect(prompt).toContain('WHAT MAKES A DISH GOOD ENOUGH TO SEND BACK');
    expect(prompt).toContain('Seasoning.');
    expect(prompt).toContain('Technique in the steps');
  });

  it('gives up after a bounded number of attempts rather than looping', async () => {
    const { client, generate } = stubClient([{ dishes: [] }]);

    await new PoolBuilder(client).build({ context: context(), preferences, reusable: [], slots: SLOTS });

    expect(generate).toHaveBeenCalledTimes(3);
  });

  it('serves reuse alone when no provider is configured, without calling anything', async () => {
    const { client, generate } = stubClient([{ dishes: [] }], false);
    const result = await new PoolBuilder(client).build({ context: context(), preferences, reusable: [dish2('sopa')], slots: SLOTS });

    expect(generate).not.toHaveBeenCalled();
    expect(result.dishes).toHaveLength(1);
    expect(result.metadata.calls).toBe(0);
  });

  it('degrades to reuse when the provider fails, instead of failing the generation here', async () => {
    const failing = {
      generate: jest.fn(async () => Promise.reject(new Error('AI_UNAVAILABLE'))),
      isAvailable: true
    } as unknown as AiClient;
    const result = await new PoolBuilder(failing).build({ context: context(), preferences, reusable: [dish2('sopa')], slots: SLOTS });

    // The scheduler decides whether this pool is enough and names the slot it
    // cannot fill — a better failure than "the AI is down".
    expect(result.dishes).toHaveLength(1);
    expect(result.metadata.calls).toBe(0);
  });

  it('does not accept the same dish twice across retries', async () => {
    const repeated = { dishes: [dish('Arroz con pollo', ['lunch'], ['arroz', 'pollo'])] };
    const { client } = stubClient([repeated, repeated, repeated]);
    const result = await new PoolBuilder(client).build({ context: context(), preferences, reusable: [], slots: ['lunch'] });

    expect(result.dishes).toHaveLength(1);
  });
});

function dish2(slug: string): CandidateDish {
  return { ...dish(slug, SLOTS), slug };
}

describe('PoolBuilder — telling a broken provider from an absent one', () => {
  const preferences = {
    budget: null,
    cookingTimeMinutes: 30,
    cuisines: [],
    dietaryPatterns: [],
    dislikedLabels: [],
    likedLabels: [],
    targets: { carbsG: 200, fatG: 60, fiberG: 25, kcal: 2000, proteinG: 120 }
  };

  it('records the provider error when a configured provider fails', async () => {
    const failing = { generate: jest.fn(async () => Promise.reject(new Error('AI_UNAVAILABLE'))), isAvailable: true } as unknown as AiClient;
    const result = await new PoolBuilder(failing).build({ context: context(), preferences, reusable: [], slots: SLOTS });

    expect(result.metadata.providerUsed).toBe(true);
    expect(result.metadata.providerError).toBe('AI_UNAVAILABLE');
  });

  it('records no provider error when none is configured — a different situation entirely', async () => {
    const { client } = stubClient([{ dishes: [] }], false);
    const result = await new PoolBuilder(client).build({ context: context(), preferences, reusable: [], slots: SLOTS });

    expect(result.metadata.providerUsed).toBe(false);
    expect(result.metadata.providerError).toBeUndefined();
  });

  it('leaves the provider error unset on a successful call', async () => {
    const { client } = stubClient([{ dishes: [] }]);
    const result = await new PoolBuilder(client).build({ context: context(), preferences, reusable: [], slots: SLOTS });

    expect(result.metadata.providerError).toBeUndefined();
  });
});

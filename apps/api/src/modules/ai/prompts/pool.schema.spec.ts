import { describe, expect, it } from '@jest/globals';

import { generatedDishSchema, wirePoolSchema } from './pool.schema.js';

/**
 * Gemini accepts only a subset of OpenAPI 3.0 and rejects the entire request with
 * an opaque "Request contains an invalid argument" if anything else appears — no
 * indication of which field. Converting the Zod schema emitted five such keywords
 * and cost a full debugging cycle to find.
 *
 * Hence a hand-written wire schema, and this test to keep it that way.
 */
const UNSUPPORTED = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'multipleOf',
  'pattern',
  'additionalProperties',
  '$ref',
  '$defs',
  '$schema',
  'anyOf',
  'oneOf',
  'allOf',
  'const',
  'not'
];

describe('the schema sent to the provider', () => {
  const serialised = JSON.stringify(wirePoolSchema.jsonSchema);

  it.each(UNSUPPORTED)('contains no "%s"', keyword => {
    expect(serialised).not.toContain(`"${keyword}"`);
  });

  it('still describes every field the pipeline needs', () => {
    const dish = (wirePoolSchema.jsonSchema as { properties: { dishes: { items: { properties: Record<string, unknown>; required: string[] } } } })
      .properties.dishes.items;

    expect(Object.keys(dish.properties).sort()).toEqual(
      ['cookMinutes', 'cuisine', 'difficulty', 'ingredients', 'name', 'prepMinutes', 'servings', 'slots', 'steps'].sort()
    );
    expect(dish.required).toHaveLength(9);
  });

  it('keeps descriptions, which are how the model learns the catalogue rule', () => {
    expect(serialised).toContain('slugs disponibles');
  });
});

describe('the strict schema still enforces what the wire schema cannot', () => {
  const valid = {
    cookMinutes: 10,
    cuisine: 'mediterranea',
    difficulty: 'easy' as const,
    ingredients: [{ grams: 100, slug: 'arroz' }],
    name: 'Arroz',
    prepMinutes: 5,
    servings: 1,
    slots: ['lunch' as const],
    steps: [{ text: 'Sofreír el ajo un minuto' }, { text: 'Añadir el arroz y cocer 18 minutos' }]
  };

  it('accepts a well-formed dish', () => {
    expect(generatedDishSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an absurd quantity the wire schema would have allowed through', () => {
    expect(generatedDishSchema.safeParse({ ...valid, ingredients: [{ grams: 50_000, slug: 'arroz' }] }).success).toBe(false);
  });

  it('rejects a negative cooking time', () => {
    expect(generatedDishSchema.safeParse({ ...valid, cookMinutes: -5 }).success).toBe(false);
  });

  it('rejects a dish with no ingredients', () => {
    expect(generatedDishSchema.safeParse({ ...valid, ingredients: [] }).success).toBe(false);
  });

  it('rejects an unknown slot', () => {
    expect(generatedDishSchema.safeParse({ ...valid, slots: ['brunch'] }).success).toBe(false);
  });

  /*
   * Prompt 2.1.0 asked for three to eight steps and the library still filled up
   * with dishes that have none. The prompt is the request; this is the guarantee.
   */
  it('rejects a dish with no method at all', () => {
    expect(generatedDishSchema.safeParse({ ...valid, cookMinutes: 0, steps: [] }).success).toBe(false);
  });

  it('rejects a cooked dish that gets one sentence', () => {
    expect(generatedDishSchema.safeParse({ ...valid, cookMinutes: 20, steps: [{ text: 'Cocinar el pollo' }] }).success).toBe(false);
  });

  /*
   * 2.4.0. "Only three steps, each has to be better documented." A step now
   * carries how long it takes and what to look for, and a bare action is not a
   * step: "Cocer el arroz." names nothing about how, how hot or how long.
   */
  it('keeps a step\u2019s minutes and cue', () => {
    const parsed = generatedDishSchema.safeParse({
      ...valid,
      steps: [
        { cue: 'hasta que el ajo dore sin quemarse', minutes: 1, text: 'Sofreír el ajo laminado en el aceite a fuego medio' },
        { cue: '', minutes: 18, text: 'Añadir el arroz y el caldo, tapar y cocer a fuego bajo' }
      ]
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.steps[0]).toEqual({
      cue: 'hasta que el ajo dore sin quemarse',
      minutes: 1,
      text: 'Sofreír el ajo laminado en el aceite a fuego medio'
    });
  });

  it('rejects a step that is only a verb and a noun', () => {
    expect(generatedDishSchema.safeParse({ ...valid, cookMinutes: 0, steps: [{ text: 'Cocer el arroz.' }] }).success).toBe(false);
  });

  it('accepts one honest sentence for something that is only assembled', () => {
    expect(generatedDishSchema.safeParse({ ...valid, cookMinutes: 0, steps: [{ text: 'Verter el yogur y esparcir las almendras' }] }).success).toBe(
      true
    );
  });

  it('turns the wire’s empty-string cuisine back into null', () => {
    const parsed = generatedDishSchema.safeParse({ ...valid, cuisine: '' });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.cuisine).toBeNull();
  });

  /**
   * 3.2.1. Shown bare slugs, a model wrote some back with the accents a slug
   * drops. Every catalogue slug is lowercase ASCII, so the fold lands on the one
   * it meant — or on nothing, and the dish is rejected downstream as before.
   */
  it('reads a slug written with accents in the catalogue’s own spelling', () => {
    const parsed = generatedDishSchema.safeParse({
      ...valid,
      ingredients: [
        { grams: 150, slug: 'Brócoli' },
        { grams: 80, slug: 'salmón-fresco' }
      ]
    });

    expect(parsed.success && parsed.data.ingredients.map(item => item.slug)).toEqual(['brocoli', 'salmon-fresco']);
  });

  /**
   * 3.2.2. The ceilings are what the store keeps (`candidateDishSchema`), no
   * tighter: on one day's calls, lower ones refused 41 dishes for their
   * seasonings, 11 lunches for a batch of six and 10 for a documented step.
   */
  it('accepts fifteen ingredients, a batch of eight and a six-hundred-character step, and nothing past them', () => {
    const ingredients = (count: number) => Array.from({ length: count }, (_unused, index) => ({ grams: 10, slug: `ingrediente-${index}` }));
    const step = (length: number) => ({ text: 'Remover a fuego medio '.padEnd(length, '.') });

    expect(generatedDishSchema.safeParse({ ...valid, ingredients: ingredients(15) }).success).toBe(true);
    expect(generatedDishSchema.safeParse({ ...valid, ingredients: ingredients(16) }).success).toBe(false);
    expect(generatedDishSchema.safeParse({ ...valid, servings: 8 }).success).toBe(true);
    expect(generatedDishSchema.safeParse({ ...valid, servings: 9 }).success).toBe(false);
    expect(generatedDishSchema.safeParse({ ...valid, steps: [step(600), step(40)] }).success).toBe(true);
    expect(generatedDishSchema.safeParse({ ...valid, steps: [step(601), step(40)] }).success).toBe(false);
  });
});

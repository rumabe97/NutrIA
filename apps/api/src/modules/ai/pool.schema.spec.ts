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
    const dish = (wirePoolSchema.jsonSchema as { properties: { dishes: { items: { properties: Record<string, unknown>; required: string[] } } } }).properties
      .dishes.items;

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
    steps: [{ text: 'Cocer' }]
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

  it('turns the wire’s empty-string cuisine back into null', () => {
    const parsed = generatedDishSchema.safeParse({ ...valid, cuisine: '' });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.cuisine).toBeNull();
  });
});

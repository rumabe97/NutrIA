import { describe, expect, expectTypeOf, it } from 'vitest';

import { buildPicturePrompt, PICTURE_PROMPT_VERSION, pictureParts } from 'core/domain/DishPicture';

import type { PictureRecipe, PictureRecipeIngredient } from 'core/domain/DishPicture';

const lentils: PictureRecipe = {
  ingredients: [
    { grams: 80, name: 'Beef', slug: 'ternera-magra' },
    { grams: 200, name: 'Cooked lentils', slug: 'lentejas-cocidas' },
    { grams: 10, name: 'Extra virgin olive oil', slug: 'aceite-de-oliva-virgen-extra' },
    { grams: 5, name: 'Garlic', slug: 'ajo' },
    { grams: 1, name: 'Salt', slug: 'sal' },
    { grams: 60, name: 'Carrot', slug: 'zanahoria' },
    { grams: 300, name: 'Vegetable stock', slug: 'caldo-de-verduras' }
  ],
  name: 'Lentejas estofadas con ternera y zanahoria'
};

describe('buildPicturePrompt', () => {
  it('is prompt v1 word for word: foods heaviest first with their share, seasonings cooked in and never shown', () => {
    expect(buildPicturePrompt(lentils)).toBe(
      [
        'A realistic photograph of one serving of a home-cooked dish, "Lentejas estofadas con ternera y zanahoria" (Spanish name).',
        'The only foods in the dish, from most to least: cooked lentils (most of the plate); beef (a generous portion); carrot (a portion).',
        'Add no spread, sauce, topping, seed or garnish that is not one of these foods.',
        'Show each food as it looks in this dish once cooked (mixed, stewed, layered or set, as the dish name says), not as separate raw items.',
        'garlic only as seasoning cooked into the dish.',
        'Seasonings such as extra virgin olive oil, salt, vegetable stock are used in cooking and are not shown as separate items.',
        'Nothing else is on the plate or on the table: no extra garnish, no side dishes, no other bowls or ingredients around it.',
        'One plate or bowl, centred, with generous empty table around it on every side, seen from a 45-degree angle, on a plain wooden or linen table.',
        'Natural window light, sharp focus across the whole dish, everything in focus, no bokeh, no blur.',
        'Real food with natural texture, as cooked at home, not a 3D render, not glossy or plastic.',
        'No text, no labels, no logos, no people, no hands; at most one fork.'
      ].join(' ')
    );
  });

  it('asks for no blur and no bokeh — the depth of field the owner does not want', () => {
    const prompt = buildPicturePrompt(lentils);

    expect(prompt).toContain('sharp focus across the whole dish');
    expect(prompt).not.toMatch(/shallow depth|depth of field/i);
  });

  it('names a cooking liquid as part of the dish, and serves a blended dish blended', () => {
    const prompt = buildPicturePrompt({
      ingredients: [
        { grams: 250, name: 'Semi-skimmed milk', slug: 'leche-semidesnatada' },
        { grams: 300, name: 'Pumpkin', slug: 'calabaza' }
      ],
      name: 'Crema de calabaza'
    });

    expect(prompt).toContain('It is served blended: a smooth, creamy dish in a bowl, with any whole pieces resting on top.');
    expect(prompt).toContain('It is cooked with semi-skimmed milk, which is part of the dish, not a separate glass.');
    expect(prompt).toContain('from most to least: pumpkin (most of the plate).');
  });

  it('shows an aromatic heavy enough to be a food, and names at most four seasonings', () => {
    const prompt = buildPicturePrompt({
      ingredients: [
        { grams: 40, name: 'Parsley', slug: 'perejil' },
        { grams: 400, name: 'Chicken', slug: 'pechuga-de-pollo' },
        ...['sal', 'pimienta-negra', 'comino', 'curcuma', 'laurel'].map(slug => ({ grams: 1, name: slug, slug }))
      ],
      name: 'Pollo al perejil'
    });

    expect(prompt).toContain('chicken (most of the plate); parsley (a portion)');
    expect(prompt).toContain('Seasonings such as sal, pimienta-negra, comino, curcuma are used');
    expect(prompt).not.toContain('laurel');
    expect(prompt).not.toContain('only as seasoning');
  });

  it('words each share of the plate in four bands', () => {
    const prompt = buildPicturePrompt({
      ingredients: [
        { grams: 45, name: 'A', slug: 'a' },
        { grams: 30, name: 'B', slug: 'b' },
        { grams: 15, name: 'C', slug: 'c' },
        { grams: 5, name: 'D', slug: 'd' }
      ],
      name: 'Plato'
    });

    expect(prompt).toContain('a (most of the plate); b (a generous portion); c (a portion); d (a small amount).');
  });

  it('builds a prompt for a dish of seasonings alone without dividing by zero', () => {
    expect(buildPicturePrompt({ ingredients: [{ grams: 5, name: 'Salt', slug: 'sal' }], name: 'Sal' })).toContain(
      'The only foods in the dish, from most to least: .'
    );
  });

  it('carries a version a stored picture can record', () => {
    expect(PICTURE_PROMPT_VERSION).toBe('2.0.1');
  });

  it('tells the model to add nothing beyond the foods listed (owner, 2026-10-09)', () => {
    expect(buildPicturePrompt(lentils)).toContain('Add no spread, sauce, topping, seed or garnish that is not one of these foods.');
  });
});

/*
 * PRD 4: the prompt is recipe data and nothing else. Its input has no field a
 * person could arrive through, and a field smuggled in at runtime is ignored.
 */
describe('what the prompt is built from', () => {
  it('takes a recipe name and each ingredient’s slug, name and grams — no user, profile, allergy or health field', () => {
    expectTypeOf<Parameters<typeof buildPicturePrompt>>().toEqualTypeOf<[PictureRecipe]>();
    expectTypeOf<keyof PictureRecipe>().toEqualTypeOf<'ingredients' | 'name'>();
    expectTypeOf<keyof PictureRecipeIngredient>().toEqualTypeOf<'grams' | 'name' | 'slug'>();
  });

  it('writes nothing from a field it was not meant to be given', () => {
    const smuggled = { ...lentils, allergies: ['SENTINEL-ALLERGY'], profile: { conditions: ['SENTINEL-CONDITION'] }, userId: 'SENTINEL-USER' };

    expect(buildPicturePrompt(smuggled)).toBe(buildPicturePrompt(lentils));
    expect(buildPicturePrompt(smuggled)).not.toContain('SENTINEL');
  });
});

describe('pictureParts', () => {
  it('finds the mains: the heaviest visible food, and any with 15 % of what is seen', () => {
    expect(pictureParts(lentils).mains.map(main => main.slug)).toEqual(['lentejas-cocidas', 'ternera-magra', 'zanahoria']);
  });
});

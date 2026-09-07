import { describe, expect, it } from 'vitest';

import { dishSafety, findSafetyViolations, isSafe, toSafetyProfile } from 'core/domain/Safety';
import { toCatalogue } from 'core/entities/Plan';
import { ALLERGEN_IDS, makeIngredient, makeSafetyProfile } from '#test/fixtures';

describe('findSafetyViolations', () => {
  it('passes an ingredient carrying no declared allergen', () => {
    expect(findSafetyViolations([makeIngredient()], makeSafetyProfile())).toEqual([]);
  });

  it('blocks an ingredient that contains a declared allergen', () => {
    const bread = makeIngredient({ id: 'ing-bread', allergens: [{ allergenId: ALLERGEN_IDS.gluten, presence: 'contains' }], name: 'Pan integral' });

    const violations = findSafetyViolations([bread], makeSafetyProfile());

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ ingredientName: 'Pan integral', kind: 'allergy', presence: 'contains' });
  });

  it('blocks an intolerance the same way as an allergy, but labels it differently', () => {
    const yogurt = makeIngredient({ id: 'ing-yogurt', allergens: [{ allergenId: ALLERGEN_IDS.milk, presence: 'contains' }], name: 'Yogur' });

    expect(findSafetyViolations([yogurt], makeSafetyProfile())[0]).toMatchObject({ kind: 'intolerance' });
  });

  it('ignores a trace warning for a user who is not trace-sensitive', () => {
    const oats = makeIngredient({ id: 'ing-oats', allergens: [{ allergenId: ALLERGEN_IDS.gluten, presence: 'may_contain' }], name: 'Avena' });

    expect(findSafetyViolations([oats], makeSafetyProfile())).toEqual([]);
  });

  it('blocks the same trace warning for a user who is trace-sensitive', () => {
    const oats = makeIngredient({ id: 'ing-oats', allergens: [{ allergenId: ALLERGEN_IDS.gluten, presence: 'may_contain' }], name: 'Avena' });
    const sensitive = makeSafetyProfile({ crossContaminationAllergenIds: new Set([ALLERGEN_IDS.gluten]) });

    expect(findSafetyViolations([oats], sensitive)).toHaveLength(1);
  });

  it('reports every violation, not just the first — one round trip should surface all of them', () => {
    const ingredients = [
      makeIngredient({ id: 'a', allergens: [{ allergenId: ALLERGEN_IDS.gluten, presence: 'contains' }], name: 'Pan' }),
      makeIngredient({ id: 'b', allergens: [{ allergenId: ALLERGEN_IDS.milk, presence: 'contains' }], name: 'Leche' }),
      makeIngredient({ id: 'c', name: 'Tomate' })
    ];

    expect(findSafetyViolations(ingredients, makeSafetyProfile()).map(v => v.ingredientId)).toEqual(['a', 'b']);
  });

  it('flags an ingredient once per offending allergen', () => {
    const mix = makeIngredient({
      id: 'ing-mix',
      allergens: [
        { allergenId: ALLERGEN_IDS.gluten, presence: 'contains' },
        { allergenId: ALLERGEN_IDS.milk, presence: 'contains' },
        { allergenId: ALLERGEN_IDS.peanuts, presence: 'contains' }
      ],
      name: 'Bizcocho'
    });

    // peanuts are not on this profile, so two of the three trip.
    expect(findSafetyViolations([mix], makeSafetyProfile())).toHaveLength(2);
  });

  it('treats an empty profile as unrestricted', () => {
    const bread = makeIngredient({ allergens: [{ allergenId: ALLERGEN_IDS.gluten, presence: 'contains' }] });
    const empty = makeSafetyProfile({ allergenIds: new Set(), intoleranceAllergenIds: new Set() });

    expect(isSafe([bread], empty)).toBe(true);
  });
});

describe('toSafetyProfile', () => {
  it('puts only trace-sensitive allergies into the cross-contamination set', () => {
    const profile = toSafetyProfile(
      [
        { allergenId: ALLERGEN_IDS.gluten, crossContaminationSensitive: true },
        { allergenId: ALLERGEN_IDS.peanuts, crossContaminationSensitive: false }
      ],
      [{ allergenId: ALLERGEN_IDS.milk }]
    );

    expect([...profile.allergenIds].sort()).toEqual([ALLERGEN_IDS.gluten, ALLERGEN_IDS.peanuts].sort());
    expect([...profile.crossContaminationAllergenIds]).toEqual([ALLERGEN_IDS.gluten]);
    expect([...profile.intoleranceAllergenIds]).toEqual([ALLERGEN_IDS.milk]);
  });
});

describe('dishSafety — the one gate both generation and reuse pass through', () => {
  const catalogue = toCatalogue([
    {
      id: 'ing-arroz',
      allergens: [],
      carbsPer100g: 20,
      category: 'pantry',
      defaultUnit: 'g',
      fatPer100g: 6,
      fiberPer100g: 2,
      gramsPerUnit: null,
      kcalPer100g: 200,
      name: 'Arroz',
      proteinPer100g: 12,
      slug: 'arroz'
    },
    {
      id: 'ing-pan',
      allergens: [{ allergenId: ALLERGEN_IDS.gluten, presence: 'contains' }],
      carbsPer100g: 41,
      category: 'bakery',
      defaultUnit: 'slice',
      fatPer100g: 3.4,
      fiberPer100g: 7,
      gramsPerUnit: 40,
      kcalPer100g: 247,
      name: 'Pan integral',
      proteinPer100g: 8.8,
      slug: 'pan'
    },
    {
      id: 'ing-avena',
      allergens: [{ allergenId: ALLERGEN_IDS.gluten, presence: 'may_contain' }],
      carbsPer100g: 60,
      category: 'pantry',
      defaultUnit: 'g',
      fatPer100g: 6.9,
      fiberPer100g: 10,
      gramsPerUnit: null,
      kcalPer100g: 389,
      name: 'Avena',
      proteinPer100g: 16.9,
      slug: 'avena'
    }
  ]);

  it('passes a dish with nothing the user reacts to', () => {
    expect(dishSafety([{ slug: 'arroz' }], catalogue, makeSafetyProfile()).kind).toBe('safe');
  });

  it('blocks a dish containing a declared allergen', () => {
    const result = dishSafety([{ slug: 'pan' }], catalogue, makeSafetyProfile());

    expect(result.kind).toBe('unsafe');

    if (result.kind === 'unsafe') {expect(result.violations[0]?.ingredientName).toBe('Pan integral');}
  });

  it('gates a reused dish exactly as it gates a generated one — the database is not a safety claim', () => {
    // Same call, same result: there is no "already in the library" bypass.
    const asGenerated = dishSafety([{ slug: 'pan' }], catalogue, makeSafetyProfile());
    const asReused = dishSafety([{ slug: 'pan' }], catalogue, makeSafetyProfile());

    expect(asReused).toEqual(asGenerated);
  });

  it('separates an unresolvable ingredient from an unsafe one', () => {
    const result = dishSafety([{ slug: 'no-existe' }], catalogue, makeSafetyProfile());

    expect(result.kind).toBe('unknown_ingredients');

    if (result.kind === 'unknown_ingredients') {expect(result.slugs).toEqual(['no-existe']);}
  });

  it('reports resolution failure before safety, since an unresolved dish cannot be judged', () => {
    const result = dishSafety([{ slug: 'pan' }, { slug: 'no-existe' }], catalogue, makeSafetyProfile());

    expect(result.kind).toBe('unknown_ingredients');
  });

  it('lets a trace risk through for a user who is not trace-sensitive', () => {
    expect(dishSafety([{ slug: 'avena' }], catalogue, makeSafetyProfile()).kind).toBe('safe');
  });

  it('blocks the same trace risk for a trace-sensitive user', () => {
    const sensitive = makeSafetyProfile({ crossContaminationAllergenIds: new Set([ALLERGEN_IDS.gluten]) });

    expect(dishSafety([{ slug: 'avena' }], catalogue, sensitive).kind).toBe('unsafe');
  });
});

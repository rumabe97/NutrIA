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

describe('a free-text allergy that resolved goes through the same gate', () => {
  it('blocks the ingredient it resolved to, even with no allergen link at all', () => {
    // Kiwi carries none of the EU-14. Nothing in the allergen tables would ever
    // stop it — the exclusion is the whole mechanism.
    const kiwi = makeIngredient({ id: 'ing-kiwi', allergens: [], name: 'Kiwi' });
    const profile = makeSafetyProfile({ excludedIngredientIds: new Set(['ing-kiwi']) });

    const violations = findSafetyViolations([kiwi], profile);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ allergenId: null, ingredientName: 'Kiwi', kind: 'custom_allergen' });
  });

  it('rejects a dish through `dishSafety`, exactly as a listed allergen does', () => {
    const catalogue = toCatalogue([
      {
        id: 'ing-kiwi',
        allergens: [],
        carbsPer100g: 15,
        category: 'produce',
        defaultUnit: 'g',
        fatPer100g: 0.5,
        fiberPer100g: 3,
        gramsPerUnit: null,
        kcalPer100g: 61,
        name: 'Kiwi',
        nameLocale: 'es-ES',
        proteinPer100g: 1.1,
        slug: 'kiwi'
      }
    ]);

    const safe = dishSafety([{ slug: 'kiwi' }], catalogue, makeSafetyProfile());
    const unsafe = dishSafety([{ slug: 'kiwi' }], catalogue, makeSafetyProfile({ excludedIngredientIds: new Set(['ing-kiwi']) }));

    expect(safe.kind).toBe('safe');
    expect(unsafe.kind).toBe('unsafe');
  });

  it('leaves every other ingredient alone', () => {
    const rice = makeIngredient({ id: 'ing-arroz', allergens: [], name: 'Arroz' });

    expect(isSafe([rice], makeSafetyProfile({ excludedIngredientIds: new Set(['ing-kiwi']) }))).toBe(true);
  });

  it('reports both an exclusion and an allergen link on the same ingredient', () => {
    // Nothing dedupes them, and nothing should: they are two independent reasons
    // the same ingredient is out, and a rejection that names one is still true.
    const bread = makeIngredient({ id: 'ing-pan', allergens: [{ allergenId: ALLERGEN_IDS.gluten, presence: 'contains' }], name: 'Pan' });

    expect(findSafetyViolations([bread], makeSafetyProfile({ excludedIngredientIds: new Set(['ing-pan']) }))).toHaveLength(2);
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

  it('splits free-text allergies into what is enforced and what is not', () => {
    const profile = toSafetyProfile(
      [],
      [],
      [
        { ingredientId: 'ing-kiwi', label: 'kiwi' },
        { ingredientId: null, label: 'marisco' }
      ]
    );

    expect([...profile.excludedIngredientIds]).toEqual(['ing-kiwi']);
    expect(profile.unenforceableLabels).toEqual(['marisco']);
  });

  it('never lets an unmatched label reach the enforced set', () => {
    // The one invariant that makes the interface's promise true: if it is in
    // `excludedIngredientIds` there is an id behind it, and an id is enforceable.
    const profile = toSafetyProfile([], [], [{ ingredientId: null, label: 'marisco' }]);

    expect(profile.excludedIngredientIds.size).toBe(0);
  });

  it('carries neither when nobody typed anything', () => {
    const profile = toSafetyProfile([], []);

    expect(profile.excludedIngredientIds.size).toBe(0);
    expect(profile.unenforceableLabels).toEqual([]);
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
      nameLocale: 'es-ES',
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
      nameLocale: 'es-ES',
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
      nameLocale: 'es-ES',
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

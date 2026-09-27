import { describe, expect, it } from 'vitest';

import { judgePicture } from 'core/domain/DishPicture';

import type { PictureCatalogueEntry, PictureMatch, PictureRecipe, SeenFood, SeenPicture } from 'core/domain/DishPicture';

/** A slice of the catalogue as the seed writes it: Spanish and English names, and what each contains. */
const CATALOGUE: readonly PictureCatalogueEntry[] = [
  { allergens: ['soy'], names: ['Tofu firme', 'Firm tofu'], slug: 'tofu-firme' },
  { allergens: [], names: ['Brócoli', 'Broccoli'], slug: 'brocoli' },
  { allergens: [], names: ['Quinoa cocida', 'Cooked quinoa'], slug: 'quinoa-cocida' },
  { allergens: ['sesame'], names: ['Tahini', 'Tahini'], slug: 'tahini' },
  { allergens: [], names: ['Limón', 'Lemon'], slug: 'limon' },
  { allergens: [], names: ['Aceite de oliva virgen extra', 'Extra virgin olive oil'], slug: 'aceite-de-oliva-virgen-extra' },
  { allergens: ['sesame'], names: ['Aceite de sésamo', 'Sesame oil'], slug: 'aceite-de-sesamo' },
  { allergens: [], names: ['Aceite de girasol', 'Sunflower oil'], slug: 'aceite-de-girasol' },
  { allergens: ['sesame'], names: ['Sésamo', 'Sesame seeds'], slug: 'sesamo' },
  { allergens: ['crustaceans'], names: ['Gambas', 'Fresh prawns'], slug: 'gambas' },
  { allergens: ['molluscs'], names: ['Pulpo cocido', 'Cooked octopus'], slug: 'pulpo-cocido' },
  { allergens: ['gluten'], names: ['Cuscús cocido', 'Cooked couscous'], slug: 'cuscus-cocido' },
  { allergens: ['milk', 'lactose'], names: ['Queso feta', 'Feta'], slug: 'queso-feta' },
  { allergens: ['milk'], names: ['Queso curado', 'Mature cheese'], slug: 'queso-curado' },
  { allergens: ['milk', 'lactose'], names: ['Skyr', 'Skyr'], slug: 'skyr' },
  { allergens: [], names: ['Arándanos', 'Blueberries'], slug: 'arandanos' },
  { allergens: ['peanuts'], names: ['Cacahuetes', 'Peanuts'], slug: 'cacahuetes' },
  { allergens: ['peanuts'], names: ['Mantequilla de cacahuete', 'Peanut butter'], slug: 'mantequilla-de-cacahuete' },
  { allergens: ['milk', 'lactose'], names: ['Mantequilla', 'Salted butter'], slug: 'mantequilla' },
  { allergens: [], names: ['Alubias blancas cocidas', 'Cooked white beans'], slug: 'alubias-blancas-cocidas' },
  { allergens: ['soy', 'gluten'], names: ['Salsa de soja', 'Soy sauce'], slug: 'salsa-de-soja' },
  { allergens: ['soy'], names: ['Bebida de soja', 'Soy milk'], slug: 'bebida-de-soja' },
  { allergens: [], names: ['Pan sin gluten', 'Gluten-free bread'], slug: 'pan-sin-gluten' },
  { allergens: ['gluten'], names: ['Pan blanco', 'White bread'], slug: 'pan-blanco' },
  { allergens: ['fish'], names: ['Merluza', 'Fresh hake'], slug: 'merluza' },
  { allergens: [], names: ['Pollo', 'Chicken'], slug: 'pollo' },
  { allergens: ['milk', 'lactose'], names: ['Queso fresco de cabra', "Fresh goat's cheese"], slug: 'queso-fresco-de-cabra' }
];

const TOFU_BOWL: PictureRecipe = {
  ingredients: [
    { grams: 150, name: 'Firm tofu', slug: 'tofu-firme' },
    { grams: 150, name: 'Broccoli', slug: 'brocoli' },
    { grams: 120, name: 'Cooked quinoa', slug: 'quinoa-cocida' },
    { grams: 15, name: 'Tahini', slug: 'tahini' },
    { grams: 5, name: 'Lemon', slug: 'limon' },
    { grams: 10, name: 'Extra virgin olive oil', slug: 'aceite-de-oliva-virgen-extra' }
  ],
  name: 'Salteado de tofu firme con brócoli, quinoa y aderezo de sésamo'
};

/** Every ingredient of the bowl seen, and matched to itself. */
const ALL_SEEN: PictureMatch['ingredients'] = TOFU_BOWL.ingredients.map(ingredient => ({
  matched: [ingredient.name.toLowerCase()],
  slug: ingredient.slug,
  status: 'seen'
}));

const ownFoods: readonly SeenFood[] = TOFU_BOWL.ingredients.map(ingredient => ({
  amount: 'main',
  name: ingredient.name.toLowerCase(),
  specific: true
}));

/** A picture of the tofu bowl showing its own foods plus `extra`, which the match call left over. */
function withExtra(...extra: readonly SeenFood[]): { match: PictureMatch; seen: SeenPicture } {
  return { match: { extras: extra.map(food => food.name), ingredients: ALL_SEEN }, seen: { foods: [...ownFoods, ...extra] } };
}

function judge(picture: { match: PictureMatch; seen: SeenPicture }, recipe: PictureRecipe = TOFU_BOWL) {
  return judgePicture({ catalogue: CATALOGUE, recipe, ...picture });
}

describe('judgePicture — the pilot’s failure shapes', () => {
  it('rejects a specific, more-than-trace extra food carrying an allergen the dish lacks', () => {
    const verdict = judge(withExtra({ amount: 'main', name: 'shrimp', specific: true }));

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras).toEqual([
      { amount: 'main', foreignAllergens: ['crustaceans'], generic: false, mappedTo: ['gambas'], name: 'shrimp', specific: true }
    ]);
    expect(verdict.notes).toContain('extra_allergen:shrimp=crustaceans');
  });

  it.each(['white drizzle', 'sauce', 'creamy sauce', 'broth'])('accepts a generic "%s", even when the judge calls it specific', name => {
    const verdict = judge(withExtra({ amount: 'main', name, specific: true }));

    expect(verdict.accepted).toBe(true);
    expect(verdict.extras[0]).toMatchObject({ foreignAllergens: [], generic: true, mappedTo: [] });
    expect(verdict.notes).toContain(`extra_food:${name}`);
  });

  it('rejects couscous on a dish with no gluten although the judge said it carries none: the allergen comes from the catalogue', () => {
    const couscous = { allergens: [], amount: 'side', name: 'couscous', specific: true } as SeenFood;
    const verdict = judge(withExtra(couscous));

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras[0]).toMatchObject({ foreignAllergens: ['gluten'], mappedTo: ['cuscus-cocido'] });
  });

  it('accepts a sauce made from the listed ingredients, which the match call counts as a match', () => {
    const verdict = judge({
      match: {
        extras: [],
        ingredients: ALL_SEEN.map(ingredient => (ingredient.slug === 'tahini' ? { ...ingredient, matched: ['pale drizzle'] } : ingredient))
      },
      seen: { foods: [...ownFoods.filter(food => food.name !== 'tahini'), { amount: 'garnish', name: 'pale drizzle', specific: false }] }
    });

    expect(verdict).toEqual({ accepted: true, extras: [], notes: [] });
  });

  it('never reads an allergen the judge offers, only the catalogue’s', () => {
    const mislabelled = { allergens: ['crustaceans'], amount: 'main', name: 'broccoli florets', specific: true } as SeenFood;

    expect(judge(withExtra(mislabelled)).accepted).toBe(true);
  });
});

describe('judgePicture — what is only a note', () => {
  it('accepts a trace of an allergen-bearing food', () => {
    const verdict = judge(withExtra({ amount: 'trace', name: 'peanuts', specific: true }));

    expect(verdict.accepted).toBe(true);
    expect(verdict.extras[0]?.foreignAllergens).toEqual(['peanuts']);
  });

  it('accepts a food neither the judge nor the catalogue can name, without calling it unmapped', () => {
    const verdict = judge(withExtra({ amount: 'main', name: 'brown lumps', specific: false }));

    expect(verdict.accepted).toBe(true);
    expect(verdict.notes).toEqual(['extra_food:brown lumps']);
  });

  it('accepts an extra whose allergen the dish already carries', () => {
    expect(judge(withExtra({ amount: 'garnish', name: 'sesame seeds', specific: true })).accepted).toBe(true);
  });

  it('accepts an extra carrying no allergen, and says it was there', () => {
    const verdict = judge(withExtra({ amount: 'side', name: 'chicken', specific: true }));

    expect(verdict.accepted).toBe(true);
    expect(verdict.notes).toEqual(['extra_food:chicken']);
  });

  it('keeps a specific food it could not map as a note, and accepts', () => {
    const verdict = judge(withExtra({ amount: 'side', name: 'kohlrabi', specific: true }));

    expect(verdict.accepted).toBe(true);
    expect(verdict.notes).toContain('unmapped:kohlrabi');
  });

  it('notes a main the judge did not see, and the picture’s quality', () => {
    const verdict = judge({
      match: {
        extras: [],
        ingredients: ALL_SEEN.map(ingredient => (ingredient.slug === 'tofu-firme' ? { ...ingredient, matched: [], status: 'not_seen' } : ingredient))
      },
      seen: {
        extraDishes: 1,
        foods: ownFoods.filter(food => food.name !== 'firm tofu'),
        nonFood: ['hand'],
        plasticOrCgi: false,
        realism: 3,
        sharpness: 3
      }
    });

    expect(verdict.accepted).toBe(true);
    expect(verdict.notes).toEqual(['missing_main:Firm tofu', 'plastic_cgi', 'blur', 'non_food', 'extra_dish']);
  });

  it('reads a picture said to be CGI as plastic whatever its realism score', () => {
    expect(
      judge({ match: { extras: [], ingredients: ALL_SEEN }, seen: { foods: ownFoods, plasticOrCgi: true, realism: 5, sharpness: 5 } }).notes
    ).toEqual(['plastic_cgi']);
  });

  it('notes a recipe ingredient the catalogue does not hold', () => {
    const recipe = { ...TOFU_BOWL, ingredients: [...TOFU_BOWL.ingredients, { grams: 5, name: 'Mystery', slug: 'misterio' }] };

    expect(judge({ match: { extras: [], ingredients: ALL_SEEN }, seen: { foods: ownFoods } }, recipe).notes).toEqual(['unknown_ingredient:misterio']);
  });
});

describe('judgePicture — a judge that leaves a food out', () => {
  it('treats a seen food the match call neither matched nor listed as an extra', () => {
    const verdict = judge({
      match: { extras: [], ingredients: ALL_SEEN },
      seen: { foods: [...ownFoods, { amount: 'main', name: 'Octopus', specific: true }] }
    });

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras[0]).toMatchObject({ foreignAllergens: ['molluscs'], name: 'Octopus' });
  });

  it('takes an extra the match call named but the first call did not at its word: specific, and more than a trace', () => {
    const verdict = judge({ match: { extras: ['prawns'], ingredients: ALL_SEEN }, seen: { foods: ownFoods } });

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras[0]).toMatchObject({ amount: 'main', specific: true });
  });

  it('finds the seen food an extra refers to when one name holds the other’s words', () => {
    const verdict = judge({
      match: { extras: ['prawns'], ingredients: ALL_SEEN },
      seen: { foods: [...ownFoods, { amount: 'trace', name: 'grilled prawns', specific: true }] }
    });

    expect(verdict.accepted).toBe(true);
    expect(verdict.extras.map(extra => [extra.name, extra.amount])).toEqual([
      ['prawns', 'trace'],
      ['grilled prawns', 'trace']
    ]);
  });

  it('counts a food named twice once', () => {
    const verdict = judge({
      match: { extras: ['Shrimp', 'shrimp'], ingredients: ALL_SEEN },
      seen: { foods: [...ownFoods, { amount: 'main', name: 'shrimp', specific: true }] }
    });

    expect(verdict.extras).toHaveLength(1);
  });
});

describe('judgePicture — mapping a name to the catalogue', () => {
  const allergensOf = (name: string, recipe: PictureRecipe = TOFU_BOWL) =>
    judge(withExtra({ amount: 'main', name, specific: true }), recipe).extras[0]?.foreignAllergens;

  it.each([
    ['peanut butter', ['peanuts']],
    ['Peanut Butter', ['peanuts']],
    ['feta cheese', ['lactose', 'milk']],
    ["goat's cheese", ['lactose', 'milk']],
    ['grated mature cheese', ['milk']],
    ['peanut sauce', ['peanuts']],
    ['soy beans', []],
    ['hard-boiled prawns', ['crustaceans']],
    ['fish fillet', ['fish']],
    ['white bread', ['gluten']],
    ['gluten-free bread', []],
    ['chicken with feta', ['lactose', 'milk']]
  ])('maps "%s" to %j beyond the dish', (name, expected) => {
    expect(allergensOf(name)).toEqual(expected);
  });

  it('takes the whole name before its words: peanut butter is not butter', () => {
    expect(judge(withExtra({ amount: 'main', name: 'peanut butter', specific: true })).extras[0]?.mappedTo).toEqual(['mantequilla-de-cacahuete']);
  });

  it('keeps a word no whole name covers: soy beans are beans and something soy', () => {
    const noSoy: PictureRecipe = { ingredients: [{ grams: 100, name: 'Chicken', slug: 'pollo' }], name: 'Pollo' };

    expect(allergensOf('soy beans', noSoy)).toEqual(['soy']);
  });

  it('counts only what every food a bare word could be carries: "oil" is not sesame', () => {
    const noSesame: PictureRecipe = { ingredients: [{ grams: 100, name: 'Chicken', slug: 'pollo' }], name: 'Pollo' };

    expect(allergensOf('oil', noSesame)).toEqual([]);
    expect(allergensOf('sesame oil', noSesame)).toEqual(['sesame']);
  });

  it('maps the judge’s English through its synonyms when the catalogue says it otherwise', () => {
    const verdict = judge(withExtra({ amount: 'main', name: 'grilled shrimp', specific: true }));

    expect(verdict.extras[0]).toMatchObject({ foreignAllergens: ['crustaceans'], mappedTo: ['gambas'] });
  });

  it('ignores a synonym whose slug the catalogue does not hold', () => {
    const catalogue = CATALOGUE.filter(entry => entry.slug !== 'gambas');
    const verdict = judgePicture({ catalogue, recipe: TOFU_BOWL, ...withExtra({ amount: 'main', name: 'shrimp', specific: true }) });

    expect(verdict.accepted).toBe(true);
    expect(verdict.notes).toContain('unmapped:shrimp');
  });
});

/*
 * The invariant review of phase 2: neither the judge's `specific` flag nor its
 * match call may be what lets an allergen through.
 */
describe('judgePicture — nothing the judge says decides alone', () => {
  it('rejects a food the judge would not call specific when its name maps to a foreign allergen', () => {
    const verdict = judge(withExtra({ amount: 'main', name: 'peanut sauce', specific: false }));

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras[0]).toMatchObject({ foreignAllergens: ['peanuts'], mappedTo: ['cacahuetes'], specific: true });
  });

  it('checks what the match call paired with an ingredient: prawns matched to broccoli are still prawns', () => {
    const verdict = judge({
      match: {
        extras: [],
        ingredients: ALL_SEEN.map(ingredient => (ingredient.slug === 'brocoli' ? { ...ingredient, matched: ['broccoli', 'prawns'] } : ingredient))
      },
      seen: { foods: [...ownFoods, { amount: 'main', name: 'prawns', specific: true }] }
    });

    expect(verdict.accepted).toBe(false);
    expect(verdict.notes).toContain('matched_foreign:prawns');
  });

  it('lets a fair variant the match call paired through, since it carries its ingredient’s allergens', () => {
    const recipe: PictureRecipe = {
      ingredients: [{ grams: 100, name: "Fresh goat's cheese", slug: 'queso-fresco-de-cabra' }],
      name: 'Queso de cabra'
    };
    const verdict = judge(
      {
        match: { extras: [], ingredients: [{ matched: ['feta cheese'], slug: 'queso-fresco-de-cabra', status: 'seen' }] },
        seen: { foods: [{ amount: 'main', name: 'feta cheese', specific: true }] }
      },
      recipe
    );

    expect(verdict).toEqual({ accepted: true, extras: [], notes: [] });
  });

  it('refuses a catalogue of the dish’s own ingredients, which would map every extra to nothing', () => {
    const own = CATALOGUE.filter(entry => TOFU_BOWL.ingredients.some(ingredient => ingredient.slug === entry.slug));

    expect(() => judgePicture({ catalogue: own, recipe: TOFU_BOWL, ...withExtra({ amount: 'main', name: 'shrimp', specific: true }) })).toThrow(
      /whole ingredient catalogue/
    );
  });

  it('maps a synonym to every slug it stands for', () => {
    const catalogue = [
      ...CATALOGUE,
      { allergens: ['milk', 'lactose'], names: ['Leche entera', 'Whole milk'], slug: 'leche-entera' },
      { allergens: ['gluten'], names: ['Harina de trigo', 'Plain flour'], slug: 'harina-de-trigo' }
    ];
    const verdict = judgePicture({ catalogue, recipe: TOFU_BOWL, ...withExtra({ amount: 'main', name: 'béchamel', specific: true }) });

    expect(verdict.extras[0]).toMatchObject({ foreignAllergens: ['gluten', 'lactose', 'milk'], mappedTo: ['leche-entera', 'harina-de-trigo'] });
  });
});

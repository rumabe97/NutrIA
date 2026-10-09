import { describe, expect, it } from 'vitest';

import { flaggedExtras, judgePicture } from 'core/domain/DishPicture';

import type { PictureCatalogueEntry, PictureMatch, PictureRecipe, PictureVerdict, SeenFood, SeenPicture } from 'core/domain/DishPicture';

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
  { allergens: ['milk', 'lactose'], names: ['Queso fresco de cabra', "Fresh goat's cheese"], slug: 'queso-fresco-de-cabra' },
  { allergens: ['gluten'], names: ['Noodles de trigo', 'Wheat noodles'], slug: 'noodles-de-trigo' },
  { allergens: ['gluten'], names: ['Noodles udon', 'Udon noodles'], slug: 'noodles-udon' },
  { allergens: [], names: ['Fideos de arroz cocidos', 'Cooked rice noodles'], slug: 'fideos-de-arroz-cocidos' },
  { allergens: ['gluten', 'eggs', 'milk'], names: ['Bizcocho', 'Sponge cake'], slug: 'bizcocho' },
  { allergens: [], names: ['Tortitas de arroz', 'Rice cakes'], slug: 'tortitas-de-arroz' },
  { allergens: ['gluten', 'milk', 'eggs'], names: ['Galletas de mantequilla', 'Butter biscuits'], slug: 'galletas-de-mantequilla' },
  { allergens: [], mayContain: ['gluten'], names: ['Copos de avena', 'Rolled oats'], slug: 'copos-de-avena' },
  { allergens: ['eggs'], names: ['Huevo', 'Egg'], slug: 'huevo' },
  { allergens: [], names: ['Arroz blanco cocido', 'Cooked white rice'], slug: 'arroz-blanco-cocido' },
  { allergens: [], names: ['Queso vegano', 'Vegan cheese'], slug: 'queso-vegano' },
  { allergens: ['milk', 'lactose'], names: ['Leche entera', 'Whole milk'], slug: 'leche-entera' }
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
  name: 'Bol de tofu firme salteado, con brócoli y quinoa al sésamo'
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

  it('rejects a picture missing a main only for an added allergen, never for the missing main itself (owner, 2026-10-09)', () => {
    const verdict = judge({
      match: {
        extras: ['shrimp'],
        ingredients: ALL_SEEN.map(ingredient => (ingredient.slug === 'tofu-firme' ? { ...ingredient, matched: [], status: 'not_seen' } : ingredient))
      },
      seen: { foods: [...ownFoods.filter(food => food.name !== 'firm tofu'), { amount: 'main', name: 'shrimp', specific: true }] }
    });

    expect(verdict.accepted).toBe(false);
    expect(verdict.notes).toContain('missing_main:Firm tofu');
    expect(verdict.notes).toContain('extra_allergen:shrimp=crustaceans');
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

/*
 * The safe reading of a bare name: what it most often is, allergens and all.
 * A wrong rejection costs a redraw; a miss shows a person an allergen.
 */
describe('judgePicture — a bare name read the safe way', () => {
  const RICE: PictureRecipe = { ingredients: [{ grams: 200, name: 'Cooked white rice', slug: 'arroz-blanco-cocido' }], name: 'Arroz blanco' };
  const NOODLE_BOWL: PictureRecipe = {
    ingredients: [{ grams: 200, name: 'Cooked rice noodles', slug: 'fideos-de-arroz-cocidos' }],
    name: 'Fideos de arroz'
  };
  const PORRIDGE: PictureRecipe = { ingredients: [{ grams: 80, name: 'Rolled oats', slug: 'copos-de-avena' }], name: 'Gachas de avena' };
  const foreign = (name: string, recipe: PictureRecipe) =>
    judge(withExtra({ amount: 'main', name, specific: true }), recipe).extras.at(-1)?.foreignAllergens;

  it.each([
    ['noodles', ['gluten']],
    ['ramen', ['gluten']],
    ['udon', ['gluten']],
    ['egg noodles', ['eggs', 'gluten']],
    ['rice noodles', []],
    ['cake', ['eggs', 'gluten', 'milk']],
    ['sponge cake', ['eggs', 'gluten', 'milk']],
    ['rice cake', []],
    ['biscuit', ['eggs', 'gluten', 'milk']],
    ['cookies', ['eggs', 'gluten', 'milk']],
    ['oats', ['gluten']],
    ['oatmeal', ['gluten']],
    ['porridge', ['gluten']]
  ])('reads "%s" on a plain rice dish as %j', (name, expected) => {
    expect(foreign(name, RICE)).toEqual(expected);
  });

  it('counts what oats may contain as gluten the rice dish lacks, and rejects', () => {
    expect(judge(withExtra({ amount: 'side', name: 'oats', specific: true }), RICE).accepted).toBe(false);
  });

  it('does not count what oats may contain against a dish of oats', () => {
    const verdict = judge(
      {
        match: { extras: [], ingredients: [{ matched: ['oatmeal'], slug: 'copos-de-avena', status: 'seen' }] },
        seen: { foods: [{ amount: 'main', name: 'oatmeal', specific: true }] }
      },
      PORRIDGE
    );

    expect(verdict).toEqual({ accepted: true, extras: [], notes: [] });
  });

  it('still rejects bread on a dish of oats: what the oats may contain does not excuse what the bread contains', () => {
    expect(judge(withExtra({ amount: 'side', name: 'bread', specific: true }), PORRIDGE).accepted).toBe(false);
  });

  it('takes "noodles" matched to the dish’s own rice noodles as those noodles', () => {
    const verdict = judge(
      {
        match: { extras: [], ingredients: [{ matched: ['noodles'], slug: 'fideos-de-arroz-cocidos', status: 'seen' }] },
        seen: { foods: [{ amount: 'main', name: 'noodles', specific: true }] }
      },
      NOODLE_BOWL
    );

    expect(verdict.accepted).toBe(true);
  });

  /*
   * Rewritten on purpose by project 010 (`0073`): until then this test pinned
   * the opposite — "noodles" left as an extra rejected the rice-noodle dish for
   * gluten, and the same picture passed or failed on the match call's answer.
   * A dish's own form is not an extra food, however the match call answered.
   */
  it('takes "noodles" the match call left as an extra on a rice-noodle dish as those noodles too', () => {
    const verdict = judge(withExtra({ amount: 'side', name: 'noodles', specific: true }), NOODLE_BOWL);

    expect(verdict.accepted).toBe(true);
    expect(verdict.notes).toContain('own_form:noodles');
  });

  it('still rejects "wheat noodles" left as an extra on a rice-noodle dish: only the form’s word is the dish’s', () => {
    const verdict = judge(withExtra({ amount: 'side', name: 'wheat noodles', specific: true }), NOODLE_BOWL);

    expect(verdict.accepted).toBe(false);
    expect(verdict.extras.at(-1)?.foreignAllergens).toEqual(['gluten']);
  });

  // Project 010 kept this one as it was: a rice cake is a cracker, not a cake, so "cake" left as an extra keeps rejecting (judge.forms.test.ts).
  it.each([
    ['matched to the dish’s own rice cakes, is those rice cakes', true, ['cake']],
    ['left as an extra on the same dish, is sponge cake', false, []]
  ])('takes "cake", %s', (_case, accepted, matchedNames) => {
    const recipe: PictureRecipe = { ingredients: [{ grams: 60, name: 'Rice cakes', slug: 'tortitas-de-arroz' }], name: 'Tortitas de arroz' };
    const verdict = judge(
      {
        match: {
          extras: matchedNames.length > 0 ? [] : ['cake'],
          ingredients: [{ matched: matchedNames, slug: 'tortitas-de-arroz', status: 'seen' }]
        },
        seen: { foods: [{ amount: 'main', name: 'cake', specific: true }] }
      },
      recipe
    );

    expect(verdict.accepted).toBe(accepted);
  });

  it('still rejects "noodles" matched to an ingredient whose name they are not', () => {
    const verdict = judge(
      {
        match: { extras: [], ingredients: [{ matched: ['noodles'], slug: 'arroz-blanco-cocido', status: 'seen' }] },
        seen: { foods: [{ amount: 'main', name: 'noodles', specific: true }] }
      },
      RICE
    );

    expect(verdict.accepted).toBe(false);
    expect(verdict.notes).toContain('matched_foreign:noodles');
  });
});

/*
 * The invariant review of the shortened-name exemption: a bare name beside a
 * fuller one matched to the same ingredient is a second food, not the first
 * one named shorter.
 */
describe('judgePicture — a short name beside the full one is a second food', () => {
  function pairedWith(slug: string, name: string, seenNames: readonly string[]): PictureVerdict {
    const recipe: PictureRecipe = {
      ingredients: [
        { grams: 150, name: 'Chicken', slug: 'pollo' },
        { grams: 20, name, slug }
      ],
      name: 'Pollo'
    };

    return judge(
      {
        match: { extras: [], ingredients: [{ matched: [...seenNames], slug, status: 'seen' }] },
        seen: { foods: seenNames.map(seen => ({ amount: 'side', name: seen, specific: true })) }
      },
      recipe
    );
  }

  it.each([
    ['mantequilla-de-cacahuete', 'Peanut butter', ['peanut butter', 'butter'], 'butter'],
    ['bebida-de-soja', 'Soy milk', ['soy milk', 'milk'], 'milk'],
    ['queso-vegano', 'Vegan cheese', ['vegan cheese', 'cheese'], 'cheese']
  ])('rejects %s with "%s" seen twice, whole and bare', (slug, name, seenNames, bare) => {
    const verdict = pairedWith(slug, name, seenNames);

    expect(verdict.accepted).toBe(false);
    expect(verdict.notes).toContain(`matched_foreign:${bare}`);
    expect(verdict.extras.find(extra => extra.name === bare)?.foreignAllergens).toEqual(expect.arrayContaining(['milk']));
  });

  it('still takes a bare name alone as the ingredient named shorter: "milk" for soy milk', () => {
    expect(pairedWith('bebida-de-soja', 'Soy milk', ['milk']).accepted).toBe(true);
  });

  it('takes the fuller name alone as the ingredient itself', () => {
    expect(pairedWith('mantequilla-de-cacahuete', 'Peanut butter', ['peanut butter']).accepted).toBe(true);
  });
});

/* 0072: what is kept of a rejected picture's verdict is ours — allergen keys and catalogue slugs — never the judge's words. */
describe('flaggedExtras', () => {
  it('keeps the allergen keys and the catalogue slugs of every food carrying an allergen the dish lacks, and no name', () => {
    const verdict: Pick<PictureVerdict, 'extras'> = {
      extras: [
        { amount: 'main', foreignAllergens: ['crustaceans'], generic: false, mappedTo: ['gambas'], name: 'jumbo shrimp', specific: true },
        { amount: 'trace', foreignAllergens: ['sesame'], generic: false, mappedTo: ['sesamo'], name: 'sesame seeds', specific: true },
        { amount: 'side', foreignAllergens: [], generic: false, mappedTo: ['limon'], name: 'lemon wedge', specific: true },
        { amount: 'side', foreignAllergens: [], generic: true, mappedTo: [], name: 'white drizzle', specific: false }
      ]
    };

    const flagged = flaggedExtras(verdict);

    expect(flagged).toEqual([
      { foreignAllergens: ['crustaceans'], mappedTo: ['gambas'] },
      { foreignAllergens: ['sesame'], mappedTo: ['sesamo'] }
    ]);
    expect(JSON.stringify(flagged)).not.toMatch(/shrimp|seeds|wedge|drizzle/);
  });

  it('is empty for a verdict that flagged nothing', () => {
    expect(flaggedExtras({ extras: [] })).toEqual([]);
  });
});

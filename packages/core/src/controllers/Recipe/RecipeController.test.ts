import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingIncompleteError, ProfileConsentRequiredError } from 'core/entities/Error';
import { NO_PREFERENCE_EXCLUSIONS } from 'core/domain/Preference';
import { DISHES_NEEDED_PER_SLOT } from 'core/domain/Variety';
import { toCatalogue } from 'core/entities/Plan';
import { makeCatalogueIngredient } from '#test/fixtures';

import { RecipeController } from './RecipeController';

import type { GenerationContext } from './RecipeController';
import type { Allergen, SafetyProfile } from 'core/entities/Safety';
import type { CatalogueIngredient } from 'core/entities/Plan';
import type { LibraryRecipe } from 'core/domain/MealFit';
import type { ReusableRecipe } from '#repositories/Recipe';

const order: string[] = [];
const requireProfileConsent = vi.fn<(userId: string) => Promise<void>>();
const findReusable = vi.fn<() => Promise<readonly ReusableRecipe[]>>();
const findOnboarding = vi.fn<() => Promise<{ completedAt: string | null } | undefined>>();
const findLibraryUsage = vi.fn<(slots: readonly string[]) => Promise<readonly LibraryRecipe[]>>();
const loadCatalogue = vi.fn<() => Promise<readonly CatalogueIngredient[]>>();
const findDietaryPatterns = vi.fn<() => Promise<readonly string[]>>();
const getSafetyProfile = vi.fn<() => Promise<SafetyProfile>>();
const listAllergens = vi.fn<() => Promise<readonly Allergen[]>>();

const NO_RESTRICTIONS: SafetyProfile = {
  allergenIds: new Set(),
  crossContaminationAllergenIds: new Set(),
  excludedIngredientIds: new Set(),
  intoleranceAllergenIds: new Set(),
  unenforceableLabels: []
};

vi.mock('#repositories/Recipe', () => ({
  FALLBACK_LOCALE: 'es-ES',
  RecipeRepository: {
    findLibraryUsage: (slots: readonly string[]) => findLibraryUsage(slots),
    findReusable: () => findReusable(),
    loadCatalogue: () => (order.push('catalogue'), loadCatalogue())
  }
}));
vi.mock('#repositories/Profile', () => ({
  ProfileRepository: {
    findByUserId: async () => Promise.resolve(undefined),
    findDietaryPatterns: () => findDietaryPatterns(),
    findFoodPreferences: async () => Promise.resolve([]),
    findPreferences: async () => Promise.resolve(undefined)
  }
}));
vi.mock('#repositories/Health', () => ({ HealthRepository: { takesProteinSupplement: async () => Promise.resolve(false) } }));
vi.mock('#repositories/Onboarding', () => ({ OnboardingRepository: { find: async () => (order.push('onboarding'), findOnboarding()) } }));
vi.mock('#repositories/Vacation', () => ({ VacationRepository: {} }));
vi.mock('core/controllers/Safety', () => ({
  SafetyController: { getSafetyProfile: () => (order.push('safety'), getSafetyProfile()), listAllergens: () => listAllergens() }
}));
vi.mock('core/controllers/Profile', () => ({ requireProfileConsent: (userId: string) => (order.push('consent'), requireProfileConsent(userId)) }));

beforeEach(() => {
  order.length = 0;
  requireProfileConsent.mockReset();
  requireProfileConsent.mockResolvedValue(undefined);
  findOnboarding.mockReset();
  findOnboarding.mockResolvedValue({ completedAt: '2026-09-01' });
  loadCatalogue.mockReset();
  loadCatalogue.mockResolvedValue([]);
  findDietaryPatterns.mockReset();
  findDietaryPatterns.mockResolvedValue([]);
  getSafetyProfile.mockReset();
  getSafetyProfile.mockResolvedValue(NO_RESTRICTIONS);
  listAllergens.mockReset();
  listAllergens.mockResolvedValue([]);
});

describe('RecipeController.generationContext — the one door every generation passes', () => {
  it('asks for the profile consent after reading the profile, never before', async () => {
    await RecipeController.generationContext('usr-1');

    // A withdrawal deletes the allergies and the consent together: a check
    // after the reads cannot miss a withdrawal the reads already saw.
    expect(order.indexOf('consent')).toBeGreaterThan(order.indexOf('safety'));
    expect(order.indexOf('consent')).toBeGreaterThan(order.indexOf('catalogue'));
    expect(requireProfileConsent).toHaveBeenCalledWith('usr-1');
  });

  it('refuses a withdrawn account, so no generation, swap or rebuild gets a context', async () => {
    requireProfileConsent.mockRejectedValue(new ProfileConsentRequiredError());

    await expect(RecipeController.generationContext('usr-1')).rejects.toBeInstanceOf(ProfileConsentRequiredError);
  });

  it('refuses an account whose onboarding was reopened — consent given again, allergies not yet answered — after the reads', async () => {
    findOnboarding.mockResolvedValue({ completedAt: null });

    await expect(RecipeController.generationContext('usr-1')).rejects.toBeInstanceOf(OnboardingIncompleteError);
    expect(order.indexOf('onboarding')).toBeGreaterThan(order.indexOf('safety'));
  });

  it('builds nobody’s context without asking anyone’s consent', async () => {
    await expect(RecipeController.nobodysContext()).resolves.toMatchObject({ locale: 'es-ES' });
    expect(requireProfileConsent).not.toHaveBeenCalled();
  });
});

describe('RecipeController.generationContext — a free-from substitute is offered only to a person who needs it', () => {
  const glutenFreeBread = makeCatalogueIngredient({ id: 'i-pan-sin-gluten', name: 'Pan sin gluten', slug: 'pan-sin-gluten' });
  const rice = makeCatalogueIngredient({ id: 'i-arroz', name: 'Arroz', slug: 'arroz' });
  const glutenAllergen = { id: 'a-gluten', isEuMandatory: true, key: 'gluten', labelEs: 'Gluten' };

  beforeEach(() => {
    loadCatalogue.mockResolvedValue([glutenFreeBread, rice]);
    listAllergens.mockResolvedValue([glutenAllergen]);
  });

  it('excludes it for somebody with no gluten allergy, intolerance or way of eating', async () => {
    const context = await RecipeController.nobodysContext();

    expect(context.preferences.excludedIngredientIds.has('i-pan-sin-gluten')).toBe(true);
    expect(context.preferences.excludedIngredientIds.has('i-arroz')).toBe(false);
  });

  it('offers it to somebody with a declared gluten allergy', async () => {
    getSafetyProfile.mockResolvedValue({ ...NO_RESTRICTIONS, allergenIds: new Set(['a-gluten']) });

    const context = await RecipeController.nobodysContext();

    expect(context.preferences.excludedIngredientIds.has('i-pan-sin-gluten')).toBe(false);
  });

  it('offers it to somebody with a declared gluten intolerance', async () => {
    getSafetyProfile.mockResolvedValue({ ...NO_RESTRICTIONS, intoleranceAllergenIds: new Set(['a-gluten']) });

    const context = await RecipeController.nobodysContext();

    expect(context.preferences.excludedIngredientIds.has('i-pan-sin-gluten')).toBe(false);
  });

  it('offers it to somebody whose way of eating is gluten-free', async () => {
    findDietaryPatterns.mockResolvedValue(['gluten_free']);

    const context = await RecipeController.nobodysContext();

    expect(context.preferences.excludedIngredientIds.has('i-pan-sin-gluten')).toBe(false);
  });

  it('drops a library dish built around it from an unrestricted person’s pool, and keeps one that has nothing to do with it', async () => {
    findReusable.mockResolvedValue([
      {
        id: 'r-tuna-pan-sin-gluten',
        cookMinutes: 0,
        cuisine: null,
        difficulty: 'easy',
        ingredients: [{ grams: 60, slug: 'pan-sin-gluten' }],
        mealSlots: ['afternoon_snack'],
        name: 'Tosta de pan sin gluten con atún',
        prepMinutes: 5,
        servings: 1,
        slug: 'tuna-pan-sin-gluten',
        steps: [
          { minutes: 5, text: 'Tostar el pan y escurrir el atún' },
          { minutes: 2, text: 'Montar la tosta y servir' }
        ]
      },
      {
        id: 'r-arroz-blanco',
        cookMinutes: 0,
        cuisine: null,
        difficulty: 'easy',
        ingredients: [{ grams: 80, slug: 'arroz' }],
        mealSlots: ['afternoon_snack'],
        name: 'Arroz blanco',
        prepMinutes: 5,
        servings: 1,
        slug: 'arroz-blanco',
        steps: [
          { minutes: 10, text: 'Lavar el arroz y ponerlo a hervir en agua con sal' },
          { minutes: 5, text: 'Escurrir, reposar dos minutos y servir caliente' }
        ]
      }
    ]);

    const unrestricted = await RecipeController.nobodysContext();
    const unrestrictedPool = await RecipeController.reusablePool(['afternoon_snack'], unrestricted);

    expect(unrestrictedPool.map(dish => dish.slug)).toEqual(['arroz-blanco']);

    getSafetyProfile.mockResolvedValue({ ...NO_RESTRICTIONS, allergenIds: new Set(['a-gluten']) });

    const restricted = await RecipeController.nobodysContext();
    const restrictedPool = await RecipeController.reusablePool(['afternoon_snack'], restricted);

    expect(restrictedPool.map(dish => dish.slug).sort()).toEqual(['arroz-blanco', 'tuna-pan-sin-gluten']);
  });
});

describe('RecipeController.reusablePool — an allergy the catalogue could not resolve', () => {
  const rice = makeCatalogueIngredient({ id: 'i-arroz', name: 'Arroz', slug: 'arroz' });
  const context: GenerationContext = {
    catalogue: toCatalogue([rice]),
    dietaryPatterns: [],
    locale: 'es-ES',
    preferences: NO_PREFERENCE_EXCLUSIONS,
    safety: {
      allergenIds: new Set(),
      crossContaminationAllergenIds: new Set(),
      excludedIngredientIds: new Set(),
      intoleranceAllergenIds: new Set(),
      unenforceableLabels: ['nuez de Brasil']
    }
  };
  const recipe = (slug: string, name: string, step: string): ReusableRecipe => ({
    id: slug,
    cookMinutes: 0,
    cuisine: null,
    difficulty: 'easy',
    ingredients: [{ grams: 80, slug: 'arroz' }],
    mealSlots: ['lunch'],
    name,
    prepMinutes: 5,
    servings: 1,
    slug,
    steps: [
      { minutes: 10, text: 'Lavar el arroz y ponerlo a hervir en agua con sal' },
      { minutes: 10, text: step }
    ]
  });

  it('drops a library dish whose name or method names it, in any number', async () => {
    findReusable.mockResolvedValue([
      recipe('arroz-con-nueces', 'Arroz con nueces', 'Servir caliente con el perejil picado por encima'),
      recipe('arroz-blanco', 'Arroz blanco', 'Terminar con unas nueces tostadas y servir'),
      recipe('arroz-sencillo', 'Arroz sencillo', 'Escurrir, reposar dos minutos y servir caliente')
    ]);

    const pool = await RecipeController.reusablePool(['lunch'], context);

    expect(pool.map(dish => dish.slug)).toEqual(['arroz-sencillo']);
  });
});

describe('RecipeController.reusablePool — a dish is served only at the meals its ingredients belong to (0062)', () => {
  const lentils = makeCatalogueIngredient({ id: 'i-lentejas', category: 'protein', classes: [], mealSlots: ['lunch'], slug: 'lentejas-cocidas' });
  const onion = makeCatalogueIngredient({ id: 'i-cebolla', category: 'produce', slug: 'cebolla' });
  const oil = makeCatalogueIngredient({ id: 'i-aceite', category: 'pantry', slug: 'aceite-de-oliva' });
  const energyDrink = makeCatalogueIngredient({ id: 'i-energetica', category: 'beverages', mealSlots: ['none'], slug: 'bebida-energetica' });
  const contextFor = (dietaryPatterns: readonly string[], ingredients = [lentils, onion, oil, energyDrink]): GenerationContext => ({
    catalogue: toCatalogue(ingredients),
    dietaryPatterns,
    locale: 'es-ES',
    preferences: NO_PREFERENCE_EXCLUSIONS,
    safety: {
      allergenIds: new Set(),
      crossContaminationAllergenIds: new Set(),
      excludedIngredientIds: new Set(),
      intoleranceAllergenIds: new Set(),
      unenforceableLabels: []
    }
  });
  const recipe = (slug: string, mealSlots: ReusableRecipe['mealSlots'], ...slugs: string[]): ReusableRecipe => ({
    id: slug,
    // No cooking time, so two steps are a usable method (`hasUsableMethod`): the meal is what is under test.
    cookMinutes: 0,
    cuisine: null,
    difficulty: 'easy',
    ingredients: slugs.map(ingredient => ({ grams: 80, slug: ingredient })),
    mealSlots,
    name: slug,
    prepMinutes: 10,
    servings: 1,
    slug,
    steps: [
      { minutes: 10, text: 'Pochar la cebolla en el aceite a fuego medio' },
      { minutes: 20, text: 'Añadir el resto, cubrir de agua y cocer hasta que esté tierno' }
    ]
  });
  const library = [
    recipe('lentejas-estofadas', ['lunch', 'dinner'], 'lentejas-cocidas', 'cebolla', 'aceite-de-oliva'),
    recipe('cebolla-asada', ['breakfast', 'lunch', 'dinner'], 'cebolla', 'aceite-de-oliva'),
    recipe('cena-energetica', ['dinner'], 'bebida-energetica', 'cebolla'),
    recipe('lentejas-de-cena', ['dinner'], 'lentejas-cocidas', 'cebolla')
  ];
  const slotsOf = (pool: readonly { readonly slots: readonly string[]; readonly slug: string }[]) =>
    Object.fromEntries(pool.map(dish => [dish.slug, dish.slots]));

  it('serves a lentil stew tagged lunch-only at lunch and not at dinner, and drops a dish left with no meal', async () => {
    findReusable.mockResolvedValue(library);

    const pool = await RecipeController.reusablePool(['breakfast', 'lunch', 'dinner'], contextFor([]));

    expect(slotsOf(pool)).toEqual({ 'cebolla-asada': ['breakfast', 'lunch', 'dinner'], 'lentejas-estofadas': ['lunch'] });
  });

  it('serves the same stew at both for a vegan, and still never the food in no meal', async () => {
    findReusable.mockResolvedValue(library);

    const pool = await RecipeController.reusablePool(['breakfast', 'lunch', 'dinner'], contextFor(['vegan']));

    expect(slotsOf(pool)).toEqual({
      'cebolla-asada': ['breakfast', 'lunch', 'dinner'],
      'lentejas-de-cena': ['dinner'],
      'lentejas-estofadas': ['lunch', 'dinner']
    });
  });

  it('changes nothing when every list is empty', async () => {
    findReusable.mockResolvedValue(library);

    const empty = [lentils, onion, oil, energyDrink].map(ingredient => ({ ...ingredient, mealSlots: [] }));
    const pool = await RecipeController.reusablePool(['breakfast', 'lunch', 'dinner'], contextFor([], empty));

    expect(slotsOf(pool)).toEqual(Object.fromEntries(library.map(item => [item.slug, item.mealSlots])));
  });

  it('narrows before the rotation, so the dinners it picks are dinners that can be served', async () => {
    // A full rotation's worth of stews the person likes — offered first — that
    // call themselves dinners, and one plain dinner behind them. Counted before
    // narrowing, the stews would fill every dinner place and the plain dish
    // would never be picked; the stews would then lose dinner and the slot
    // would be empty.
    const stews = Array.from({ length: DISHES_NEEDED_PER_SLOT }, (_, index) =>
      recipe(`lentejas-${String(index)}`, ['lunch', 'dinner'], 'lentejas-cocidas', 'cebolla')
    );

    findReusable.mockResolvedValue([...stews, recipe('cebolla-asada', ['dinner'], 'cebolla', 'aceite-de-oliva')]);

    const pool = await RecipeController.reusablePool(['dinner'], contextFor([]), {
      avoidSlugs: new Set(),
      preferSlugs: new Set(stews.map(stew => stew.slug)),
      seed: 'usr-1:1'
    });

    expect(pool.filter(dish => dish.slots.includes('dinner')).map(dish => dish.slug)).toEqual(['cebolla-asada']);
  });
});

describe('RecipeController.libraryUsage — what the library cooks lunch and dinner from (0063)', () => {
  const lentils = makeCatalogueIngredient({ id: 'i-lentejas', category: 'protein', classes: [], mealSlots: ['lunch'], slug: 'lentejas-cocidas' });
  const onion = makeCatalogueIngredient({ id: 'i-cebolla', category: 'produce', slug: 'cebolla' });
  const context = (dietaryPatterns: readonly string[]): GenerationContext => ({
    catalogue: toCatalogue([lentils, onion]),
    dietaryPatterns,
    locale: 'es-ES',
    preferences: NO_PREFERENCE_EXCLUSIONS,
    safety: {
      allergenIds: new Set(),
      crossContaminationAllergenIds: new Set(),
      excludedIngredientIds: new Set(),
      intoleranceAllergenIds: new Set(),
      unenforceableLabels: []
    }
  });
  // Stored as lunch and dinner — as a vegan's generation would have stored them.
  const stews: LibraryRecipe[] = Array.from({ length: DISHES_NEEDED_PER_SLOT }, () => ({
    ingredients: [
      { id: 'i-lentejas', slug: 'lentejas-cocidas' },
      { id: 'i-cebolla', slug: 'cebolla' }
    ],
    slots: ['lunch', 'dinner']
  }));

  beforeEach(() => {
    findLibraryUsage.mockReset();
    findLibraryUsage.mockResolvedValue(stews);
  });

  it('reads only lunch and dinner, and nothing at all for a request for neither', async () => {
    await expect(RecipeController.libraryUsage(['breakfast', 'afternoon_snack'], context([]))).resolves.toEqual(new Map());
    expect(findLibraryUsage).not.toHaveBeenCalled();

    await RecipeController.libraryUsage(['breakfast', 'lunch', 'dinner'], context([]));
    expect(findLibraryUsage).toHaveBeenCalledWith(['lunch', 'dinner']);
  });

  it('narrows every recipe for the person rather than trusting its stored meals', async () => {
    const omnivore = await RecipeController.libraryUsage(['lunch', 'dinner'], context([]));
    const vegan = await RecipeController.libraryUsage(['lunch', 'dinner'], context(['vegan']));

    expect(omnivore.get('lunch')).toEqual(new Set(['i-lentejas', 'i-cebolla']));
    expect(omnivore.has('dinner')).toBe(false);
    expect(vegan.get('dinner')).toEqual(new Set(['i-lentejas', 'i-cebolla']));
  });
});

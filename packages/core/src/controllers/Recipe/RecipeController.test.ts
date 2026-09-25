import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileConsentRequiredError } from 'core/entities/Error';
import { NO_PREFERENCE_EXCLUSIONS } from 'core/domain/Preference';
import { toCatalogue } from 'core/entities/Plan';
import { makeCatalogueIngredient } from '#test/fixtures';

import { RecipeController } from './RecipeController';

import type { GenerationContext } from './RecipeController';
import type { ReusableRecipe } from '#repositories/Recipe';

const order: string[] = [];
const requireProfileConsent = vi.fn<(userId: string) => Promise<void>>();
const findReusable = vi.fn<() => Promise<readonly ReusableRecipe[]>>();

vi.mock('#repositories/Recipe', () => ({
  FALLBACK_LOCALE: 'es-ES',
  RecipeRepository: { findReusable: () => findReusable(), loadCatalogue: async () => (order.push('catalogue'), Promise.resolve([])) }
}));
vi.mock('#repositories/Profile', () => ({
  ProfileRepository: {
    findByUserId: async () => Promise.resolve(undefined),
    findDietaryPatterns: async () => Promise.resolve([]),
    findFoodPreferences: async () => Promise.resolve([]),
    findPreferences: async () => Promise.resolve(undefined)
  }
}));
vi.mock('#repositories/Health', () => ({ HealthRepository: { takesProteinSupplement: async () => Promise.resolve(false) } }));
vi.mock('#repositories/Vacation', () => ({ VacationRepository: {} }));
vi.mock('core/controllers/Safety', () => ({
  SafetyController: {
    getSafetyProfile: async () => (
      order.push('safety'),
      Promise.resolve({
        allergenIds: new Set(),
        crossContaminationAllergenIds: new Set(),
        excludedIngredientIds: new Set(),
        intoleranceAllergenIds: new Set(),
        unenforceableLabels: []
      })
    ),
    listAllergens: async () => Promise.resolve([])
  }
}));
vi.mock('core/controllers/Profile', () => ({ requireProfileConsent: (userId: string) => (order.push('consent'), requireProfileConsent(userId)) }));

beforeEach(() => {
  order.length = 0;
  requireProfileConsent.mockReset();
  requireProfileConsent.mockResolvedValue(undefined);
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

  it('builds nobody’s context without asking anyone’s consent', async () => {
    await expect(RecipeController.nobodysContext()).resolves.toMatchObject({ locale: 'es-ES' });
    expect(requireProfileConsent).not.toHaveBeenCalled();
  });
});

describe('RecipeController.reusablePool — an allergy the catalogue could not resolve', () => {
  const rice = makeCatalogueIngredient({ id: 'i-arroz', name: 'Arroz', slug: 'arroz' });
  const context: GenerationContext = {
    catalogue: toCatalogue([rice]),
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

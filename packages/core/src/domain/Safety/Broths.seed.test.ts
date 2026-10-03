import { describe, expect, it } from 'vitest';

import { dishSafety } from 'core/domain/Safety';
import { toCatalogue } from 'core/entities/Plan';
import { makeCatalogueIngredient, makeSafetyProfile } from '#test/fixtures';

import { INGREDIENT_SEED } from '../../../../database/src/seed/ingredients';

/**
 * Project 018 phase 2 (migration 0057): the carton broths declare celery, so a
 * dish or a side holding one never reaches somebody allergic to it. Read on the
 * real seed's links — the rows production's catalogue now carries — through the
 * gate generation, swaps and `larderFor` all pass (`dishSafety`).
 */
describe('the broths, for somebody allergic to celery', () => {
  const BROTHS = ['caldo-de-pollo', 'caldo-de-verduras', 'caldo-de-carne', 'caldo-de-pescado'];

  // Allergen ids are the seed's keys: enough for a gate that compares ids.
  const catalogue = toCatalogue(
    INGREDIENT_SEED.map(row =>
      makeCatalogueIngredient({
        id: `i-${row.slug}`,
        allergens: (row.allergens ?? []).map(link => ({ allergenId: link.key, presence: link.presence ?? 'contains' })),
        name: row.name,
        slug: row.slug
      })
    )
  );
  const celery = makeSafetyProfile({ allergenIds: new Set(['celery']), intoleranceAllergenIds: new Set() });

  it.each(BROTHS)('refuses %s on its own, though they do not mind traces', slug => {
    expect(dishSafety([{ slug }], catalogue, celery).kind).toBe('unsafe');
  });

  it('refuses a dish with a splash of broth in it, and passes the same dish without it', () => {
    const rice = [{ slug: 'arroz-blanco-cocido' }, { slug: 'pimiento-rojo' }];

    expect(dishSafety(rice, catalogue, celery).kind).toBe('safe');
    expect(dishSafety([...rice, { slug: 'caldo-de-pollo' }], catalogue, celery).kind).toBe('unsafe');
  });

  it('still serves the broths to everybody else', () => {
    const nobody = makeSafetyProfile({ allergenIds: new Set(), intoleranceAllergenIds: new Set() });

    expect(BROTHS.filter(slug => dishSafety([{ slug }], catalogue, nobody).kind !== 'safe')).toEqual([]);
  });
});

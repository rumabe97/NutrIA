import { describe, expect, it } from 'vitest';
import { appliance as applianceEnum, equipmentStance as equipmentStanceEnum } from 'database/schema';

import { APPLIANCES, appliancesOf, DEFAULT_KITCHEN, EQUIPMENT_STANCES, kitchenOf, MAX_PREFERRED_APPLIANCES } from 'core/entities/Kitchen';

import type { Appliance, EquipmentStance } from 'core/entities/Kitchen';

describe('the catalogue', () => {
  it('holds the ten appliances the project promised, each once', () => {
    // Ten is a decision, not a starting point: a toaster and a kettle were left
    // out because no dish in either library needs one, and a catalogue entry is
    // a promise the library can serve it (`0102`).
    expect(APPLIANCES).toHaveLength(10);
    expect(new Set(APPLIANCES).size).toBe(10);
  });

  /*
   * The one test that catches the duplication drifting. `packages/database`
   * sits below this package and cannot import it, so the ten strings are
   * written twice on purpose — and a value added here but not there is a
   * runtime error on an insert ("invalid input value for enum"), which no
   * type-check sees.
   */
  it('is the Postgres enum, string for string and in the same order', () => {
    expect(applianceEnum.enumValues).toEqual(APPLIANCES);
    expect(equipmentStanceEnum.enumValues).toEqual(EQUIPMENT_STANCES);
  });

  it('bounds preferences at three, the same on both tiers', () => {
    expect(MAX_PREFERRED_APPLIANCES).toBe(3);
  });
});

describe('DEFAULT_KITCHEN', () => {
  it('is a stovetop, an oven and a microwave, and nothing else', () => {
    const has = APPLIANCES.filter(item => DEFAULT_KITCHEN[item] === 'has');

    expect([...has].sort()).toEqual(['microwave', 'oven', 'stovetop']);
  });

  it('answers for every appliance of the catalogue, so a caller never has to ask whether somebody spoke', () => {
    expect(Object.keys(DEFAULT_KITCHEN).sort()).toEqual([...APPLIANCES].sort());
    expect(APPLIANCES.every(item => EQUIPMENT_STANCES.includes(DEFAULT_KITCHEN[item]))).toBe(true);
  });

  it('prefers nothing — a preference is something a person said, never a default', () => {
    expect(APPLIANCES.filter(item => DEFAULT_KITCHEN[item] === 'prefers')).toEqual([]);
  });
});

describe('kitchenOf', () => {
  it('reads silence as the default kitchen', () => {
    expect(kitchenOf([])).toEqual(DEFAULT_KITCHEN);
  });

  it('lets what somebody said win over the default, in both directions', () => {
    const kitchen = kitchenOf([
      { appliance: 'oven', stance: 'missing' },
      { appliance: 'air_fryer', stance: 'prefers' }
    ]);

    // The two that change: an oven they do not have, an air fryer they would rather use.
    expect(kitchen.oven).toBe('missing');
    expect(kitchen.air_fryer).toBe('prefers');
    // And the ones they said nothing about stay exactly what the default says.
    expect(kitchen.stovetop).toBe('has');
    expect(kitchen.microwave).toBe('has');
    expect(kitchen.blender).toBe('missing');
  });

  it('answers for all ten whatever it was handed', () => {
    const kitchen = kitchenOf([{ appliance: 'grill', stance: 'has' }]);

    expect(Object.keys(kitchen).sort()).toEqual([...APPLIANCES].sort());
  });

  it('does not keep the default it was given to fold onto', () => {
    kitchenOf([{ appliance: 'oven', stance: 'missing' }]);

    // A mutated DEFAULT_KITCHEN would hand the next person somebody else's
    // kitchen — the module is loaded once for the life of the process.
    expect(DEFAULT_KITCHEN.oven).toBe('has');
  });

  it('takes the last word when a row is repeated, rather than choosing arbitrarily', () => {
    // The unique constraint makes this impossible in the database; the fold is
    // still asked to be total, because it is also given rows a test wrote.
    const kitchen = kitchenOf([
      { appliance: 'oven', stance: 'missing' },
      { appliance: 'oven', stance: 'prefers' }
    ]);

    expect(kitchen.oven).toBe('prefers');
  });
});

describe('appliancesOf', () => {
  it('keeps the appliances this release knows, in the order the dish declared them', () => {
    expect(appliancesOf(['oven', 'air_fryer'])).toEqual(['oven', 'air_fryer']);
  });

  it('reads a dish that declares nothing as needing nothing', () => {
    expect(appliancesOf([])).toEqual([]);
  });

  /*
   * `recipes.equipment` is `text[]`, so a row can name something this build has
   * never heard of — written by a later release, or by a migration whose
   * pattern list grew. It is read as *no requirement*, which is the same answer
   * `0102` gives for a dish nobody classified; the alternative would empty the
   * library for every kitchen missing anything.
   */
  it('drops what it does not recognise instead of trusting it', () => {
    expect(appliancesOf(['oven', 'sous_vide', '', 'OVEN'])).toEqual(['oven']);
  });

  it('narrows the type, so nothing downstream has to cast', () => {
    const appliances: readonly Appliance[] = appliancesOf(['pressure_cooker']);
    const stances: readonly EquipmentStance[] = appliances.map(item => DEFAULT_KITCHEN[item]);

    expect(stances).toEqual(['missing']);
  });
});

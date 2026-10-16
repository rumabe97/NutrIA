import { z } from 'zod';

/**
 * A kitchen: what it has, what it does not have, and what somebody would rather
 * cook with (`0102`).
 *
 * The catalogue is code and not reference data, which is the one structural
 * choice worth restating here: an appliance links to nothing in the database —
 * unlike an allergen, which links to ingredients — so a seeded table would buy
 * a migration per appliance added and nothing else. Its names live in the
 * dictionaries, where the screen needs them anyway.
 */

/**
 * The appliances a person may speak about. **Ten**, and the number is a
 * decision rather than a starting point: a toaster and a kettle were dropped
 * because no dish in either library needs one — a toast is a breakfast and an
 * infusion is not a dish — and **a catalogue entry is a promise** that the
 * library can offer dishes for it (`0102`).
 *
 * Appended to, never reordered: the Postgres enum beside it
 * (`database/schema/_enums`) stores these strings, and the stances already
 * written name them.
 */
export const APPLIANCES = [
  'stovetop',
  'oven',
  'microwave',
  'air_fryer',
  'pressure_cooker',
  'blender',
  'grill',
  'steamer',
  'slow_cooker',
  'rice_cooker'
] as const;

export type Appliance = (typeof APPLIANCES)[number];

export const applianceSchema = z.enum(APPLIANCES);

/**
 * The three things a person can say about one appliance.
 *
 * They are not one scale with three points: `missing` is a **constraint** and
 * is enforced in code the way an allergy is, while `prefers` is a
 * **preference** and is asked of the model — it may never remove a dish
 * (`0102`). `prefers` implies `has`, which is why there is no fourth state.
 */
export const EQUIPMENT_STANCES = ['missing', 'has', 'prefers'] as const;

export type EquipmentStance = (typeof EQUIPMENT_STANCES)[number];

export const equipmentStanceSchema = z.enum(EQUIPMENT_STANCES);

/**
 * How many appliances may be marked `prefers`.
 *
 * **The same on both tiers**: a product bound and not a price (`marketing`,
 * 2026-10-15), because a preference naming a third of the catalogue has stopped
 * steering anything. `missing` is never capped — nobody is charged for the
 * appliances they do not own.
 */
export const MAX_PREFERRED_APPLIANCES = 3;

/** Every appliance of the catalogue with the stance this person takes to it. */
export type Kitchen = Readonly<Record<Appliance, EquipmentStance>>;

/**
 * The kitchen of somebody who said nothing: **stovetop, oven, microwave and a
 * blender** (`0102`).
 *
 * Silence is not a state, so it has to resolve to one, and this is the one it
 * resolves to — expressed once here and read everywhere, so the screen, the
 * prompt, the gate and the evaluator cannot each invent their own normal
 * kitchen.
 *
 * **The blender was added on 2026-10-16, by the owner**, when the measurement
 * made the price of leaving it out visible: 20 of production's 962 dishes need
 * one — mostly breakfasts and snacks, smoothies and creams and purées — and
 * until a screen exists to say otherwise, *every* account has this kitchen. So
 * `missing` there meant taking those dishes from everybody without asking, with
 * no way for them to say so. The reasoning is the asymmetry `0102` already
 * applies to an unclassified dish: the error that costs everybody is worse than
 * the error that costs the minority who can then correct it, and a hand blender
 * is in most Spanish kitchens. Somebody without one meets a gazpacho they
 * cannot make, sees the appliance on the dish, and says "no tengo" once.
 *
 * Written out in full rather than derived from a short list, for a reason that
 * outlives this release: an appliance added to `APPLIANCES` without a stance
 * here is a type error, which is the only way a new catalogue entry can be
 * stopped from quietly defaulting to one answer or the other.
 */
export const DEFAULT_KITCHEN: Kitchen = {
  air_fryer: 'missing',
  blender: 'has',
  grill: 'missing',
  microwave: 'has',
  oven: 'has',
  pressure_cooker: 'missing',
  rice_cooker: 'missing',
  slow_cooker: 'missing',
  steamer: 'missing',
  stovetop: 'has'
};

/**
 * What a person said about one appliance — a stored row, and also exactly what
 * they send to change it.
 *
 * One schema for both because they are the same fact. The row's own `id` is
 * deliberately not here and is never handed out: there is at most one row per
 * person and appliance (`kitchen_equipment_one_per_appliance`), so the
 * appliance *is* the address, and a stance is removed by naming it rather than
 * by quoting an id back.
 */
export const kitchenStanceSchema = z.object({ appliance: applianceSchema, stance: equipmentStanceSchema });

export type KitchenStance = z.infer<typeof kitchenStanceSchema>;

/**
 * The stances a person has written, folded onto the default kitchen.
 *
 * Every one of the ten is present in the answer, which is what lets a caller
 * read `kitchen[appliance]` without asking first whether this person has ever
 * opened the screen.
 */
export function kitchenOf(stances: readonly KitchenStance[]): Kitchen {
  const kitchen: Record<Appliance, EquipmentStance> = { ...DEFAULT_KITCHEN };

  for (const { appliance, stance } of stances) {
    kitchen[appliance] = stance;
  }

  return kitchen;
}

const CATALOGUE = new Set<string>(APPLIANCES);

/**
 * The appliances a dish declares, of the ones this release knows.
 *
 * `recipes.equipment` is `text[]`, exactly as `recipes.mealSlots` is, so it can
 * hold a string this build has never heard of — a row written by a later
 * release, or by a migration whose pattern list grew. Filtering here, at the
 * boundary, is why nothing downstream needs a cast: an unknown appliance is
 * read as **no requirement**, which is the same answer `0102` gives for a dish
 * nobody classified. The alternative — treating the unknown as a requirement —
 * would empty the library for every kitchen that is missing anything.
 */
export function appliancesOf(values: readonly string[]): readonly Appliance[] {
  return values.filter((value): value is Appliance => CATALOGUE.has(value));
}

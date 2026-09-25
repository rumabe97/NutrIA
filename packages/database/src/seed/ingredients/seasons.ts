import type { IngredientSeed } from './types';

/**
 * Produce that has a season, as the months (1 to 12) it is in season in Spain.
 *
 * An exception list, like `countries.ts`: a row absent from here is in season
 * all year, which is true of rice, chicken and a tin of chickpeas. What goes
 * here is fresh fruit and vegetables whose shelf changes with the calendar.
 * One calendar, Spain's, for every locale until a second shelf exists (`0062`).
 *
 * A season orders and marks; it never forbids. The prompt lists what is in
 * season in the month a fortnight starts first, and the rest after, because a
 * tomato is still on every shelf in January.
 *
 * Empty for now: the column and its readers come first, the months after, as a
 * data change of their own.
 */
const IN_SEASON: ReadonlyMap<string, readonly number[]> = new Map();

/** The months a row is in season, or empty for every month. */
export function seasonMonthsFor(entry: IngredientSeed): readonly number[] {
  return IN_SEASON.get(entry.slug) ?? [];
}

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
 * Provenance. The months come from the seasonal calendars of the Spanish
 * Ministry of Agriculture, Fisheries and Food (MAPA, #alimentosdespaña,
 * "Frutas de temporada" and "Hortalizas de temporada", NIPO 013-17-007-7 /
 * 013-17-008-2), which mark each month at a higher or a lower level of
 * trade. **Only the higher level counts here**: a row is "in season" when it
 * is at its peak, which is what "prefer these" means to the model. Three
 * groups say where they depart from it:
 *
 * - The ministry marks tomato, pepper, cucumber, aubergine and courgette in
 *   every month, because greenhouses supply them all year. That would make
 *   them timeless, and a tomato in January is the example the owner gave
 *   (PRD § Problem). Those rows carry their open-field months instead.
 * - Rows the ministry does not list are from the general Spanish market
 *   calendars (the ones published by Mercamadrid and consumer guides) and
 *   are the ones a reviewer should check first.
 * - Absent on purpose: staples sold all year (onion, garlic, potato, carrot,
 *   lemon, lime, leek, radish, lettuce, banana), cultivated mushrooms,
 *   sprouts, fresh herbs and chillies, imported tropical fruit on the shelf
 *   all year (pineapple, papaya, passion fruit, coconut, plantain, cassava),
 *   and every dried, tinned, cooked or frozen form.
 */
/** Every named row and its months, as written, so `seasons.test.ts` can refuse a row named twice. */
export const SEASON_ROWS: readonly (readonly [string, readonly number[]])[] = [
  // Fruit, from the ministry's calendar (higher level of trade only).
  ['aguacate', [1, 2, 3, 4, 11, 12]],
  ['albaricoque', [5, 6, 7, 8]],
  ['caqui', [10, 11, 12]],
  ['cereza', [5, 6, 7]],
  ['chirimoya', [10, 11, 12]],
  ['ciruela', [6, 7, 8]],
  ['frambuesa', [1, 2, 3, 4, 10, 11, 12]],
  ['fresa', [1, 2, 3, 4, 5]],
  ['granada', [10, 11]],
  ['higo', [7, 8, 9]],
  ['kiwi', [1, 2, 3, 10, 11, 12]],
  ['mandarina', [1, 2, 3, 4, 10, 11, 12]],
  ['mango', [8, 9, 10, 11]],
  ['manzana', [1, 2, 3, 9, 10, 11, 12]],
  ['melocoton', [5, 6, 7, 8, 9]],
  ['melon', [6, 7, 8]],
  ['membrillo', [8, 9]],
  ['naranja', [1, 2, 3, 4, 5, 11, 12]],
  ['nectarina', [5, 6, 7, 8, 9]],
  ['nispero', [4, 5]],
  ['paraguayo', [6, 7, 8]],
  ['pera', [1, 2, 3, 7, 8, 9, 10, 11, 12]],
  ['pomelo', [1, 2, 3, 4, 12]],
  ['sandia', [6, 7, 8]],
  ['uva', [9, 10, 11, 12]],

  // Fruit the ministry does not list: general Spanish market calendars.
  ['arandano', [4, 5, 6, 7]],
  ['castana', [10, 11, 12]],
  ['grosella', [6, 7, 8]],
  ['higo-chumbo', [8, 9]],
  ['lichi', [1, 11, 12]],
  ['melon-cantalupo', [6, 7, 8]],
  ['mora', [7, 8, 9]],
  ['pitaya', [8, 9, 10, 11]],

  // Vegetables, from the ministry's calendar (higher level of trade only).
  ['acelga', [1, 2, 3, 4, 5, 8, 9, 10, 11, 12]],
  ['alcachofa', [1, 2, 3, 4, 5, 12]],
  ['apio', [1, 2, 3, 11, 12]],
  ['brocoli', [1, 2, 3, 4, 5, 6, 10, 11, 12]],
  ['calabaza', [1, 2, 3, 9, 10, 11, 12]],
  ['calabaza-cacahuete', [1, 2, 3, 9, 10, 11, 12]],
  ['cardo', [1, 12]],
  ['col-blanca', [1, 2, 3, 9, 10, 11, 12]],
  ['coliflor', [1, 2, 3, 4, 9, 10, 11, 12]],
  ['endibia', [9, 10, 11]],
  ['escarola', [1, 2, 3, 4, 10, 11, 12]],
  ['esparrago-verde', [3, 4, 5, 6, 9]],
  ['espinaca', [1, 2, 3, 4, 5, 6, 10, 11, 12]],
  ['guisantes-frescos', [5, 6]],
  ['habas-frescas', [1, 2, 3, 4, 5]],
  ['judia-verde', [8, 9, 10]],
  ['lombarda', [1, 2, 10, 11, 12]],
  ['nabo', [10, 11, 12]],
  ['remolacha', [8, 9, 10]],

  // Greenhouse all year in the ministry's calendar: open-field months instead.
  ['berenjena', [6, 7, 8, 9, 10]],
  ['calabacin', [5, 6, 7, 8, 9]],
  ['pepino', [6, 7, 8, 9]],
  ['pimiento-amarillo', [7, 8, 9, 10]],
  ['pimiento-italiano', [7, 8, 9, 10]],
  ['pimiento-rojo', [7, 8, 9, 10]],
  ['pimiento-verde', [7, 8, 9, 10]],
  ['tomate', [6, 7, 8, 9]],
  ['tomate-cherry', [6, 7, 8, 9]],
  ['tomate-pera', [6, 7, 8, 9]],

  // Vegetables the ministry does not list: general Spanish market calendars.
  ['ajo-tierno', [1, 2, 3, 4]],
  ['apionabo', [1, 2, 3, 10, 11, 12]],
  ['bimi', [1, 2, 3, 4, 10, 11, 12]],
  ['boletus', [9, 10, 11]],
  ['boniato', [1, 10, 11, 12]],
  ['borraja', [1, 2, 3, 4, 10, 11, 12]],
  ['canonigos', [1, 2, 3, 10, 11, 12]],
  ['chirivia', [1, 2, 3, 10, 11, 12]],
  ['col-china', [1, 2, 3, 10, 11, 12]],
  ['col-rizada', [1, 2, 3, 11, 12]],
  ['coles-de-bruselas', [1, 2, 10, 11, 12]],
  ['colinabo', [1, 2, 3, 10, 11, 12]],
  ['daikon', [1, 2, 3, 11, 12]],
  ['esparrago-blanco', [3, 4, 5, 6]],
  ['grelos', [1, 2, 3, 11, 12]],
  ['hinojo', [1, 2, 3, 4, 10, 11, 12]],
  ['mazorca-de-maiz', [7, 8, 9]],
  ['niscalos', [10, 11]],
  ['okra', [7, 8, 9]],
  ['patata-nueva', [4, 5, 6]],
  ['pimiento-de-padron', [6, 7, 8, 9]],
  ['romanesco', [1, 2, 3, 10, 11, 12]],
  ['tirabeques', [2, 3, 4, 5]]
];

const IN_SEASON: ReadonlyMap<string, readonly number[]> = new Map(SEASON_ROWS);

/** The months a row is in season, or empty for every month. */
export function seasonMonthsFor(entry: IngredientSeed): readonly number[] {
  return IN_SEASON.get(entry.slug) ?? [];
}

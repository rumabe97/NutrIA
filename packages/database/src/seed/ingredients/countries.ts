import type { IngredientSeed } from './types';

/**
 * Foods you can only reasonably buy in one country.
 *
 * The list is short on purpose. Rice, eggs and chicken are everywhere; what is
 * not is a protected designation, a regional charcuterie or a jarred dish that
 * simply is not on a shelf outside Spain. Thirty-odd rows out of nine hundred,
 * which is also why filtering by country cannot starve a plan (`0034`).
 *
 * Everything absent from here is available everywhere, which is the honest
 * default: claiming a food is unavailable somewhere is a claim, and one nobody
 * here can check for every country in the world.
 */
const SPAIN_ONLY = new Set([
  'bacalao-desalado',
  'bacalao-en-salazon',
  'boquerones',
  'butifarra',
  'chorizo',
  'croquetas-de-jamon-congeladas',
  'dulce-de-membrillo',
  'fabada-en-lata',
  'gazpacho-envasado',
  'horchata',
  'jamon-iberico',
  'jamon-serrano',
  'lentejas-con-chorizo-en-lata',
  'lomo-embuchado',
  'membrillo',
  'morcilla',
  'pimenton-ahumado',
  'pimenton-dulce',
  'pimenton-picante',
  'pimiento-de-padron',
  'pimiento-del-piquillo',
  'presa-iberica',
  'queso-cabrales',
  'queso-de-mahon',
  'queso-idiazabal',
  'queso-manchego-semicurado',
  'salmorejo-envasado',
  'sobrasada',
  'turron-de-alicante',
  'turron-de-jijona'
]);

/** ISO 3166-1 alpha-2 codes where a row can be bought, or empty for everywhere. */
export function countriesFor(entry: IngredientSeed): readonly string[] {
  return SPAIN_ONLY.has(entry.slug) ? ['ES'] : [];
}

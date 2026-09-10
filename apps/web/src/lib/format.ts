import { interpolate } from '../i18n/interpolate';

import type { Dictionary } from '../i18n/dictionaries/es-ES';
import type { Locale } from '../i18n/config';

/**
 * Numbers, dates and quantities through `Intl`, with the active locale.
 *
 * Everything here used to be hardcoded Spanish — `Intl.DateTimeFormat('es-ES')`
 * in two components, and a `.replace('.', ',')` in `formatQuantity` that turned
 * every decimal point into a comma whoever was reading it. A number formatted
 * for the wrong locale is not a translation bug you notice; it is one that makes
 * the reader quietly distrust the figure.
 */

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(isoDate: string, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(`${isoDate}T00:00:00`));
}

const KILO = 1000;

/**
 * Grams read as kilograms above 1 kg, millilitres as litres.
 *
 * The stored unit is always grams — this is display only, and the unit words
 * come from the dictionary rather than from the string `unit` the API sends,
 * which is a machine token.
 */
export function formatQuantity(quantity: number, unit: string, locale: Locale, dictionary: Dictionary): string {
  if (unit === 'g' && quantity >= KILO) {
    return `${formatNumber(quantity / KILO, locale, { maximumFractionDigits: quantity % KILO === 0 ? 0 : 1 })} ${dictionary.units.kilogram}`;
  }

  if (unit === 'ml' && quantity >= KILO) {
    return `${formatNumber(quantity / KILO, locale, { maximumFractionDigits: 1 })} ${dictionary.units.litre}`;
  }

  const value = formatNumber(quantity, locale, { maximumFractionDigits: 1 });

  if (unit === 'unit') {
    return `${value} ${dictionary.units.unit}`;
  }

  if (unit === 'slice') {
    return `${value} ${dictionary.units.slice}`;
  }

  return `${value} ${unit}`;
}

/** Re-exported so a component needs one import for "text with a value in it". */
export { interpolate };

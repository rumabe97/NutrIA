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

/**
 * Dollars as the console reads them: the narrow symbol ("12,34 $", which fits a tile on
 * a phone where "12,34 US$" would not), and up to four decimals under a dollar, because
 * a model call bills fractions of a cent and "0,00 $" would say it was free.
 */
export function formatUsd(value: number, locale: Locale): string {
  const fraction = value !== 0 && Math.abs(value) < 1 ? 4 : 2;

  return formatNumber(value, locale, {
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: fraction,
    minimumFractionDigits: 2,
    style: 'currency'
  });
}

export function formatDate(isoDate: string, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(`${isoDate}T00:00:00`));
}

/** A moment rather than a calendar day — milliseconds since the epoch, read in the reader's own time zone. */
export function formatInstant(epochMs: number, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(epochMs));
}

/**
 * A span between two instants, e.g. "10:02–10:05" — through `Intl`'s own
 * range formatter rather than two calls joined by a hardcoded dash, so the
 * separator (and any shared-date collapsing) is the locale's, not ours.
 */
export function formatInstantRange(fromMs: number, toMs: number, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).formatRange(new Date(fromMs), new Date(toMs));
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

/**
 * The calendar day as `YYYY-MM-DD` for a person: in the given time zone, or in
 * the browser's own when none is given. Never `toISOString()`, which is the UTC
 * day and is yesterday for a couple of hours after midnight in Spain.
 */
export function localIsoDate(now: Date = new Date(), timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone, year: 'numeric' }).format(now);
}

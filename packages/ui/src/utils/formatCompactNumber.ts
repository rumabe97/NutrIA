/**
 * A number short enough for an axis: 1.2K / 1,2 mil, 3M / 3 M. Below a thousand it is
 * the plain number, with at most one decimal.
 */
export function formatCompactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1, notation: 'compact' }).format(value);
}

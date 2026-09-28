/**
 * Whether a chart has nothing to draw: no labels, no series, or not one value above
 * zero. Such a chart shows its empty state, never a flat line that looks like data
 * (`0069`).
 */
export function isChartEmpty(labels: readonly string[], series: readonly { readonly values: readonly number[] }[]): boolean {
  return labels.length === 0 || !series.some(entry => entry.values.some(value => Number.isFinite(value) && value > 0));
}

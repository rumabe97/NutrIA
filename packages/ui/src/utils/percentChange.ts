/**
 * How much `current` moved against `previous`, as a fraction: 0.12 is twelve per cent
 * up. `null` when `previous` is zero, where no percentage means anything — from none
 * to some is not "infinitely more".
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0 || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return null;
  }

  return (current - previous) / Math.abs(previous);
}

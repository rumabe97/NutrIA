/**
 * Round, evenly spaced axis ticks from `min` to at least `max` — 0, 25, 50, 75, 100
 * rather than 0, 23.7, 47.4.
 *
 * The step is 1, 2, 2.5 or 5 times a power of ten, the smallest that covers the
 * range in `count` intervals or fewer. The first tick is `min` rounded down to a
 * step and the last is `max` rounded up, so the last tick is the top of the scale:
 * a chart that uses it as its domain puts every gridline on a tick.
 *
 * `integer` keeps the step at one or more, for counts: nobody signs up a quarter of a
 * time. A range with no width (all zeros, one value) still gets a scale of at least
 * one step, so a caller never divides by zero.
 */
export function niceTicks(min: number, max: number, count = 4, integer = false): number[] {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const span = high - low || Math.abs(high) || 1;
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const nice = [1, 2, 2.5, 5, 10].map(factor => factor * magnitude).find(candidate => candidate >= rough) ?? 10 * magnitude;
  const step = integer ? Math.max(1, Math.ceil(nice)) : nice;
  const first = Math.floor(low / step) * step;
  const top = high === low ? low + span : high;
  const last = Math.max(Math.ceil(top / step) * step, first + step);
  const ticks: number[] = [];

  for (let tick = first; tick <= last + step / 2; tick += step) {
    // Multiplying by a step like 0.1 drifts (0.30000000000000004); round to the step's precision.
    ticks.push(Number(tick.toPrecision(12)));
  }

  return ticks;
}

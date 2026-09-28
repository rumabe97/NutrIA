/**
 * Maps a number from `domain` onto `range` in a straight line: `linearScale([0, 100],
 * [200, 0])(25)` is 150. A domain with no width maps everything to the start of the
 * range rather than dividing by zero.
 */
export function linearScale(domain: readonly [number, number], range: readonly [number, number]): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const width = d1 - d0;

  return value => (width === 0 ? r0 : r0 + ((value - d0) / width) * (r1 - r0));
}

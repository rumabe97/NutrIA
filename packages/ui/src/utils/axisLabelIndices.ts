export interface AxisLabelIndex {
  /** Position in the chart's labels. */
  readonly index: number;
  /** A label a narrow chart drops, so the ones left do not collide. */
  readonly minor: boolean;
}

/**
 * Which of `count` labels an x axis prints: the first, the last and evenly spaced ones
 * between, `max` at most. All but the first, the middle and the last are `minor`: a
 * phone keeps those three and a wide screen shows them all. The chart hides minor labels
 * with a container query — it cannot measure itself on the server.
 *
 * `positions` (0–1 across the plot, one per label) spaces the picks by where the labels
 * are drawn rather than by their order — a line on a real time axis, where the middle
 * label may sit next to the first. Two slots that land on one label keep it once, and
 * a pick closer than half a slot to the one before is dropped (the last one never is).
 * A middle label far from the middle is minor too.
 */
export function axisLabelIndices(count: number, max = 7, positions?: readonly number[]): AxisLabelIndex[] {
  if (count <= 0) {
    return [];
  }

  const slots = Math.min(count, max);

  if (slots === 1) {
    return [{ index: 0, minor: false }];
  }

  const picked = Array.from({ length: slots }, (_, slot) =>
    positions ? nearest(positions, slot / (slots - 1)) : Math.round((slot * (count - 1)) / (slots - 1))
  );
  const unique = picked.filter((index, slot) => picked.indexOf(index) === slot);
  const indices = positions ? apart(unique, positions, 0.5 / (slots - 1)) : unique;
  const middle = Math.floor((indices.length - 1) / 2);
  // On a time axis the middle pick can sit near an end; a phone then keeps just the ends.
  const middlePosition = positions ? (positions[indices[middle] ?? 0] ?? 0.5) : 0.5;
  const keepMiddle = middlePosition >= 0.3 && middlePosition <= 0.7;

  return indices.map((index, slot) => ({
    index,
    minor: indices.length > 3 && slot !== 0 && slot !== indices.length - 1 && (slot !== middle || !keepMiddle)
  }));
}

/** Drops picks closer than `gap` to the one kept before them; the last pick wins over its neighbour. */
function apart(indices: readonly number[], positions: readonly number[], gap: number): number[] {
  const kept: number[] = [];
  const at = (index: number | undefined) => (index === undefined ? Number.NaN : (positions[index] ?? 0));

  indices.forEach((index, slot) => {
    const tooClose = kept.length > 0 && at(index) - at(kept.at(-1)) < gap;

    if (!tooClose) {
      kept.push(index);
    } else if (slot === indices.length - 1) {
      kept.splice(-1, 1, index);
    }
  });

  return kept;
}

/** The index of the position closest to `target`. */
function nearest(positions: readonly number[], target: number): number {
  let best = 0;

  positions.forEach((position, index) => {
    if (Math.abs(position - target) < Math.abs((positions[best] ?? 0) - target)) {
      best = index;
    }
  });

  return best;
}

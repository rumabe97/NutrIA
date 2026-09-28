import type { ChartTone } from 'ui/types/Chart.types';

export type ChartToneKey = 'tone1' | 'tone2' | 'tone3' | 'tone4' | 'tone5' | 'tone6' | 'toneFailure' | 'toneNeutral' | 'toneSuccess';

const SLOTS = ['tone1', 'tone2', 'tone3', 'tone4', 'tone5', 'tone6'] as const;

const OUTCOMES: Record<'failure' | 'neutral' | 'success', ChartToneKey> = { failure: 'toneFailure', neutral: 'toneNeutral', success: 'toneSuccess' };

/**
 * The class a chart puts on a mark, its legend swatch and nothing else: every chart's
 * stylesheet maps these nine names to the `--color-chart-*` tokens.
 *
 * An explicit tone wins. Without one, the series takes the categorical slot of its
 * position. There are six slots and they are never cycled: a seventh series is grey,
 * which is how "other" reads, and a chart that needs seven identities needs fewer
 * series instead.
 */
export function chartToneKey(tone: ChartTone | undefined, index: number): ChartToneKey {
  if (typeof tone === 'string') {
    return OUTCOMES[tone];
  }

  return SLOTS[(tone ?? index + 1) - 1] ?? 'toneNeutral';
}

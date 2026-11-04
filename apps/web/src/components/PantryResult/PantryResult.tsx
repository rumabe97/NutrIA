import { getDictionary } from 'i18n/server';
import { Text } from 'ui/components/Text';

import { interpolate } from 'lib/format';

import type { PlanPantryView } from 'core/controllers/Plan';

interface PantryResultProps {
  /** As the plan carries it. `null` is a plan nobody told anything to, and then nothing is said. */
  pantry: PlanPantryView | null;
}

/**
 * What the cupboard did to this fortnight, said once and with one number
 * (project 022, PRD criterion 10).
 *
 * **Read from the plan and never recomputed**: the cupboard is cleared the moment
 * the plan is saved, so there is nothing left to compute it from, and a figure
 * derived here would be a figure nobody measured. `null` means nobody was told
 * anything, which is a different fact from a cupboard that covered nothing, and
 * only the second is said (`docs/legal/pantry.md` § 6, P2-7). The number is the
 * count of shopping-list rows the cupboard covered whole, and it is not set
 * against a total or promised as a share.
 */
export async function PantryResult({ pantry }: PantryResultProps) {
  if (pantry === null) {
    return null;
  }

  const t = (await getDictionary()).pantry;

  return (
    <Text size="sm" tone="secondary">
      {pantry.coveredRows === 0 ? t.measuredNone : pantry.coveredRows === 1 ? t.measuredOne : interpolate(t.measured, { count: pantry.coveredRows })}
    </Text>
  );
}

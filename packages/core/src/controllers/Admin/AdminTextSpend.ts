import { AdminAiRepository } from '#repositories/Admin';
import { monthStart } from 'core/controllers/Recipe';
import { roundDollars as dollars, textCapOf } from 'core/controllers/Analytics';

import type { AiMonthRow } from '#repositories/Admin';
import type { TextCapView } from 'core/controllers/Analytics';

/** What an `ai_call` event is filed under: the three callers, and `unknown` for events written before the field existed. */
export const TEXT_SPEND_FEATURES = ['plan', 'swap', 'rewrite', 'unknown'] as const;

export type TextSpendFeature = (typeof TEXT_SPEND_FEATURES)[number];

/**
 * The text models' spend over the UTC calendar month so far (`0071`), counted
 * like the pictures' cap (`monthStart`). Counts and dollars only (`0028`).
 *
 * The cap fields exist only when `AI_TEXT_MONTHLY_CAP_USD` is set: with no cap
 * there is no gauge and no warning, and the keys are absent, not null.
 */
export type TextMonthView = {
  /** Calls and dollars per feature; every feature is present, zeros included. */
  readonly byFeature: readonly { readonly calls: number; readonly costUsd: number; readonly feature: TextSpendFeature }[];
  /** Where the month's count started, ISO. */
  readonly monthStart: string;
  /** Dollars billed this month. A floor when `uncostedCalls` is not 0. */
  readonly spentUsd: number;
  /** Calls this month whose event carries no cost, so `spentUsd` does not include them. */
  readonly uncostedCalls: number;
} & Partial<TextCapView>;

function featureOf(row: AiMonthRow): TextSpendFeature {
  return row.feature === 'plan' || row.feature === 'swap' || row.feature === 'rewrite' ? row.feature : 'unknown';
}

export const AdminTextSpend = {
  /** The month so far, with the gauge when `capUsd` is set. */
  async month(now: Date, capUsd?: number): Promise<TextMonthView> {
    const since = monthStart(now);
    const rows = await AdminAiRepository.monthByFeature(since);
    const byFeature = TEXT_SPEND_FEATURES.map(feature => {
      const mine = rows.filter(row => featureOf(row) === feature);

      return { calls: mine.reduce((sum, row) => sum + row.calls, 0), costUsd: dollars(mine.reduce((sum, row) => sum + row.costUsd, 0)), feature };
    });
    const spentUsd = dollars(byFeature.reduce((sum, row) => sum + row.costUsd, 0));

    return {
      byFeature,
      monthStart: since.toISOString(),
      spentUsd,
      uncostedCalls: rows.reduce((sum, row) => sum + row.uncosted, 0),
      ...(capUsd === undefined ? {} : textCapOf(spentUsd, capUsd))
    };
  }
};

export type { TextCapView };

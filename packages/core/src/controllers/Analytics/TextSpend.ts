import { AdminAiRepository } from '#repositories/Admin';
import { monthStart } from 'core/controllers/Recipe';

/** The share of the text cap at which the nightly step rewrite does not start (`0071`). */
export const TEXT_SWEEP_STOP_SHARE = 0.8;

/** The gauge: present only with a cap. */
export type TextCapView = {
  /** `AI_TEXT_MONTHLY_CAP_USD`. */
  readonly capUsd: number;
  /** `spentUsd ÷ capUsd`, not bounded at 1. */
  readonly share: number;
  /** Whether the nightly step rewrite is held back (`share` at 0.8 or more). */
  readonly sweepPaused: boolean;
};

export function roundDollars(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** The gauge for a spend against a cap: the one place that says when the sweep pauses. */
export function textCapOf(spentUsd: number, capUsd: number): TextCapView {
  const share = spentUsd / capUsd;

  return { capUsd, share: roundDollars(share), sweepPaused: share >= TEXT_SWEEP_STOP_SHARE };
}

/**
 * What the text models billed this UTC month, read from `ai_call` events. It
 * lives beside the events, not the console, so the code that talks to a model
 * can read it without reaching the admin side (`0071`).
 */
export const TextSpend = {
  /** The gauge for this month's spend against `capUsd`. Throws when the spend cannot be read: the caller fails closed. */
  async gauge(capUsd: number, now: Date = new Date()): Promise<TextCapView> {
    const rows = await AdminAiRepository.monthByFeature(monthStart(now));

    return textCapOf(roundDollars(rows.reduce((sum, row) => sum + row.costUsd, 0)), capUsd);
  }
};

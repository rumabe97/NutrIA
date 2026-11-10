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
 * The feature the assistant files its calls under (project 023). Its spend is
 * **its own and nobody else's**: it answers to `AI_ASSISTANT_MONTHLY_CAP_USD`,
 * and it never counts towards `AI_TEXT_MONTHLY_CAP_USD`, or a talkative month
 * would hold back the nightly rewrite — the shared-budget failure `0104` was
 * written to rule out.
 */
export const ASSISTANT_FEATURE = 'assistant';

/**
 * What the text models billed this UTC month, read from `ai_call` events. It
 * lives beside the events, not the console, so the code that talks to a model
 * can read it without reaching the admin side (`0071`).
 *
 * **The assistant's calls are left out**: they have a ceiling of their own
 * (`AssistantSpend`).
 */
export const TextSpend = {
  /** The gauge for this month's spend against `capUsd`. Throws when the spend cannot be read: the caller fails closed. */
  async gauge(capUsd: number, now: Date = new Date()): Promise<TextCapView> {
    const rows = await AdminAiRepository.monthByFeature(monthStart(now));

    return textCapOf(roundDollars(rows.filter(row => row.feature !== ASSISTANT_FEATURE).reduce((sum, row) => sum + row.costUsd, 0)), capUsd);
  }
};

/** The assistant's month: its calls, what they were billed, and how many recorded no cost (an abandoned answer). */
export type AssistantMonth = { readonly calls: number; readonly spentUsd: number; readonly uncostedCalls: number };

/**
 * The assistant's spend this UTC month, against its own ceiling (project 023,
 * PRD 8). Read from the same `ai_call` events, by feature, so there is one
 * record of what was billed and two ceilings over it — never one ceiling over
 * both.
 */
export const AssistantSpend = {
  async month(now: Date = new Date()): Promise<AssistantMonth> {
    const rows = (await AdminAiRepository.monthByFeature(monthStart(now))).filter(row => row.feature === ASSISTANT_FEATURE);

    return {
      calls: rows.reduce((sum, row) => sum + row.calls, 0),
      spentUsd: roundDollars(rows.reduce((sum, row) => sum + row.costUsd, 0)),
      uncostedCalls: rows.reduce((sum, row) => sum + row.uncosted, 0)
    };
  },

  /**
   * Whether the month's assistant spend has reached `capUsd`. Throws when the
   * spend cannot be read, and the route then refuses: an assistant that cannot
   * tell whether it is over budget answers as if it were (fails closed).
   */
  async reached(capUsd: number, now: Date = new Date()): Promise<boolean> {
    return (await AssistantSpend.month(now)).spentUsd >= capUsd;
  }
};

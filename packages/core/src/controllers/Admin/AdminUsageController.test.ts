import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminController, aiModelOf } from './AdminController';
import { AdminUsageController, countByReason, modelsOf } from './AdminUsageController';

import type { AdminAiRepository as Ai, AiCallDayRow, AdminSeriesRepository as Series } from '#repositories/Admin';

const ai = vi.hoisted(() => ({ callsPerDay: vi.fn<(typeof Ai)['callsPerDay']>(), monthByFeature: vi.fn<(typeof Ai)['monthByFeature']>() }));
const series = vi.hoisted(() => ({ pictureSpendPerDay: vi.fn<(typeof Series)['pictureSpendPerDay']>() }));
const failedPictures = vi.hoisted(() => vi.fn<() => Promise<{ provenance: Record<string, unknown> | null; released: boolean }[]>>());

vi.mock('#repositories/Admin', () => ({
  AdminAiRepository: ai,
  AdminRepository: { failedPictures },
  AdminSeriesRepository: series,
  JOB_STATUSES: [],
  PLAN_STATUSES: []
}));

/** Monday 28 September 2026, noon in Madrid. */
const NOW = new Date('2026-09-28T10:00:00Z');
const WEEK = ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28'];

function row(overrides: Partial<AiCallDayRow>): AiCallDayRow {
  return {
    answeredModel: null,
    calls: 1,
    costUsd: 0,
    day: '2026-09-28',
    failed: false,
    inputTokens: 0,
    model: 'asked',
    outputTokens: 0,
    provider: null,
    reasoningTokens: 0,
    timed: 0,
    totalMs: 0,
    ...overrides
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  ai.monthByFeature.mockResolvedValue([]);
  ai.callsPerDay.mockResolvedValue([
    // The period before: 14–21 September.
    row({ calls: 5, costUsd: 0.1, day: '2026-09-20', failed: true, timed: 5, totalMs: 5000 }),
    // This period.
    row({
      answeredModel: 'gemma',
      calls: 4,
      costUsd: 0.2,
      day: '2026-09-23',
      inputTokens: 400,
      outputTokens: 80,
      provider: 'DeepInfra',
      timed: 4,
      totalMs: 4000
    }),
    row({
      answeredModel: 'gemma',
      calls: 2,
      costUsd: 0.1,
      day: '2026-09-28',
      inputTokens: 200,
      outputTokens: 40,
      provider: 'DeepInfra',
      timed: 2,
      totalMs: 1000
    }),
    row({ calls: 1, day: '2026-09-28', failed: true, model: 'deepseek' })
  ]);
});

describe('AdminUsageController.ai', () => {
  it('reads the period and the one before it in one go, and tells them apart by the day', async () => {
    const view = await AdminUsageController.ai(7, NOW);

    expect(ai.callsPerDay).toHaveBeenCalledWith(new Date('2026-09-14T22:00:00Z'), NOW);
    expect(view.period).toBe(7);
    expect(view.window.from).toBe('2026-09-21T22:00:00.000Z');
    expect(view.totals).toEqual({
      averageMs: { current: 833, previous: 1000 },
      calls: { current: 7, previous: 5 },
      // Rounded to six places: 0.2 + 0.1 is 0.30000000000000004 in binary.
      costUsd: { current: 0.3, previous: 0.1 },
      failed: { current: 1, previous: 5 },
      inputTokens: { current: 600, previous: 0 },
      outputTokens: { current: 120, previous: 0 }
    });
  });

  it('lays calls and tokens on every day of the period, zeros included', async () => {
    const view = await AdminUsageController.ai(7, NOW);

    expect(view.callsPerDay).toEqual({ days: WEEK, values: [0, 4, 0, 0, 0, 0, 3] });
    expect(view.spendPerDay).toEqual({ days: WEEK, values: [0, 0.2, 0, 0, 0, 0, 0.1] });
    expect(view.tokensPerDay).toEqual({
      days: WEEK,
      series: [
        { key: 'input', values: [0, 400, 0, 0, 0, 0, 200] },
        { key: 'output', values: [0, 80, 0, 0, 0, 0, 40] }
      ]
    });
  });

  it('lists the period’s calls by the model that answered, a failed call under the one asked for', async () => {
    const view = await AdminUsageController.ai(7, NOW);

    expect(view.models.map(model => [model.model, model.provider, model.calls, model.failed, model.averageMs])).toEqual([
      ['gemma', 'DeepInfra', 6, 0, 833],
      ['deepseek', null, 1, 1, null]
    ]);
  });

  it('says null, not zero, for the latency of a period whose calls recorded no clock', async () => {
    ai.callsPerDay.mockResolvedValue([row({ calls: 2 })]);

    expect((await AdminUsageController.ai(7, NOW)).totals.averageMs).toEqual({ current: null, previous: null });
  });
});

describe('modelsOf', () => {
  it('groups by the model that answered and who served it, with sums and a mean time', () => {
    const grouped: AiCallDayRow[] = [
      row({
        answeredModel: 'gemma',
        calls: 2,
        costUsd: 0.75,
        inputTokens: 150,
        model: 'NutrIA',
        outputTokens: 15,
        provider: 'DeepInfra',
        reasoningTokens: 5,
        timed: 2,
        totalMs: 1000
      }),
      row({ calls: 1, failed: true, model: 'NutrIA', timed: 1, totalMs: 2000 }),
      row({ answeredModel: '', calls: 1, failed: true, model: '' }),
      row({ answeredModel: 'gemma', calls: 1, inputTokens: 7, model: 'NutrIA', outputTokens: 1, provider: 'Together' })
    ];

    expect(modelsOf(grouped)).toEqual([
      {
        averageMs: 500,
        calls: 2,
        costUsd: 0.75,
        failed: 0,
        inputTokens: 150,
        model: 'gemma',
        outputTokens: 15,
        provider: 'DeepInfra',
        reasoningTokens: 5
      },
      { averageMs: 2000, calls: 1, costUsd: 0, failed: 1, inputTokens: 0, model: 'NutrIA', outputTokens: 0, provider: null, reasoningTokens: 0 },
      { averageMs: null, calls: 1, costUsd: 0, failed: 1, inputTokens: 0, model: 'unknown', outputTokens: 0, provider: null, reasoningTokens: 0 },
      { averageMs: null, calls: 1, costUsd: 0, failed: 0, inputTokens: 7, model: 'gemma', outputTokens: 1, provider: 'Together', reasoningTokens: 0 }
    ]);
  });

  it('counts a call the SQL grouped with no answered model against the model that was asked for', () => {
    expect(aiModelOf({ model: 'gemini-3.6-flash' })).toEqual({ model: 'gemini-3.6-flash', provider: null });
  });
});

describe('AdminUsageController.pictures', () => {
  it('keeps the month against the cap, and lays the spend on every day of the period', async () => {
    const month = {
      acceptedByHand: 2,
      capUsd: 10,
      drawing: 1,
      enabled: true,
      failed: 2,
      ready: 30,
      released: 1,
      since: '2026-09-01T00:00:00.000Z',
      spentUsd: 3.2
    };

    vi.spyOn(AdminController, 'pictures').mockResolvedValue(month);
    series.pictureSpendPerDay.mockResolvedValue([
      { day: '2026-09-24', n: 0.1 + 0.2 },
      { day: '2026-09-28', n: 1.25 }
    ]);

    failedPictures.mockResolvedValue([]);

    const view = await AdminUsageController.pictures(7, 10, NOW);

    expect(AdminController.pictures).toHaveBeenCalledWith(10, NOW);
    expect(series.pictureSpendPerDay).toHaveBeenCalledWith(new Date('2026-09-21T22:00:00Z'), NOW);
    expect(view).toMatchObject(month);
    expect(view.spendPerDay).toEqual({ days: WEEK, values: [0, 0, 0.3, 0, 0, 0, 1.25] });
    expect(view.period).toBe(7);
    expect(view.failedByReason).toEqual([]);
    expect(view.releasedByReason).toEqual([]);
  });

  it('counts the period’s failed and released pictures by closed reason, old rows included, and never sends a provider’s words', async () => {
    vi.spyOn(AdminController, 'pictures').mockResolvedValue({
      acceptedByHand: 0,
      capUsd: 10,
      drawing: 0,
      enabled: true,
      failed: 4,
      ready: 0,
      released: 2,
      since: '2026-09-01T00:00:00.000Z',
      spentUsd: 0
    });
    series.pictureSpendPerDay.mockResolvedValue([]);
    failedPictures.mockResolvedValue([
      { provenance: { notes: ['1:rejected:extra_allergen:shrimp=crustaceans'], reason: 'judge_allergen' }, released: false },
      { provenance: { notes: ['1:rejected:extra_allergen:egg=egg', '2:rejected:extra_allergen:egg=egg'] }, released: false },
      { provenance: { notes: ['1:failed:OpenRouter /images answered 503: sk-leak'] }, released: false },
      { provenance: null, released: false },
      // 0072: a picture the owner took back is a failed row, counted here under its own reason.
      { provenance: { reason: 'owner_removed' }, released: false },
      { provenance: { reason: 'cap_reached', released: 'the month’s cap is reached' }, released: true },
      { provenance: { released: 'OpenRouter /images answered 402: Key limit exceeded' }, released: true }
    ]);

    const view = await AdminUsageController.pictures(7, 10, NOW);

    expect(failedPictures).toHaveBeenCalledWith(new Date('2026-09-21T22:00:00Z'), NOW);
    expect(view.failedByReason).toEqual([
      { n: 2, reason: 'judge_allergen' },
      { n: 1, reason: 'call_failed' },
      { n: 1, reason: 'other' },
      { n: 1, reason: 'owner_removed' }
    ]);
    expect(view.releasedByReason).toEqual([
      { n: 1, reason: 'cap_reached' },
      { n: 1, reason: 'payment_refused' }
    ]);
    expect(JSON.stringify(view)).not.toContain('sk-leak');
  });
});

describe('countByReason', () => {
  it('orders by count, then by name, and leaves out the reasons with none', () => {
    expect(
      countByReason([{ provenance: { reason: 'other' } }, { provenance: { reason: 'call_failed' } }, { provenance: { reason: 'other' } }])
    ).toEqual([
      { n: 2, reason: 'other' },
      { n: 1, reason: 'call_failed' }
    ]);
    expect(countByReason([])).toEqual([]);
  });
});

describe('the text models’ month (0071)', () => {
  it('is always there, per feature with zeros, and has no cap fields without a cap', async () => {
    ai.monthByFeature.mockResolvedValue([
      { calls: 3, costUsd: 0.2, feature: 'plan', uncosted: 1 },
      { calls: 2, costUsd: 0.1, feature: 'rewrite', uncosted: 0 },
      // Before phase 1 nobody filed the call; and a name nobody knows is filed the same way.
      { calls: 4, costUsd: 0.05, feature: null, uncosted: 4 },
      { calls: 1, costUsd: 0.05, feature: 'other', uncosted: 0 }
    ]);

    const { month } = await AdminUsageController.ai(7, NOW);

    expect(ai.monthByFeature).toHaveBeenCalledWith(new Date('2026-09-01T00:00:00Z'));
    expect(month).toEqual({
      byFeature: [
        { calls: 3, costUsd: 0.2, feature: 'plan' },
        { calls: 0, costUsd: 0, feature: 'swap' },
        { calls: 2, costUsd: 0.1, feature: 'rewrite' },
        { calls: 5, costUsd: 0.1, feature: 'unknown' }
      ],
      monthStart: '2026-09-01T00:00:00.000Z',
      spentUsd: 0.4,
      uncostedCalls: 5
    });
    expect(Object.keys(month)).not.toContain('capUsd');
  });

  it('adds the gauge with a cap, and holds the sweep from 80 %', async () => {
    ai.monthByFeature.mockResolvedValue([{ calls: 1, costUsd: 4, feature: 'plan', uncosted: 0 }]);

    expect((await AdminUsageController.ai(7, NOW, 5)).month).toMatchObject({ capUsd: 5, share: 0.8, spentUsd: 4, sweepPaused: true });

    ai.monthByFeature.mockResolvedValue([{ calls: 1, costUsd: 3.99, feature: 'plan', uncosted: 0 }]);

    expect((await AdminUsageController.ai(7, NOW, 5)).month).toMatchObject({ share: 0.798, sweepPaused: false });
  });
});

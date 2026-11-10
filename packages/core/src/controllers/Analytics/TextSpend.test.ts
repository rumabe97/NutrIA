import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminTextSpend } from 'core/controllers/Admin';

import { AssistantSpend, TextSpend } from './TextSpend';

const rows = vi.hoisted(() => ({ value: [] as { calls: number; costUsd: number; feature: string | null; uncosted: number }[] }));

vi.mock(import('#repositories/Admin'), async importOriginal => ({
  ...(await importOriginal()),
  AdminAiRepository: { monthByFeature: () => Promise.resolve(rows.value) } as never
}));

beforeEach(() => {
  rows.value = [
    { calls: 10, costUsd: 3, feature: 'plan', uncosted: 0 },
    { calls: 4, costUsd: 0.5, feature: 'rewrite', uncosted: 0 },
    // A talkative month: the assistant alone has spent more than the text cap.
    { calls: 900, costUsd: 9, feature: 'assistant', uncosted: 3 }
  ];
});

/**
 * PRD criterion 8: the assistant cannot take the plan's budget. With the
 * assistant's spend counted in, this month would be at 250 % of a 5 $ text cap
 * and the nightly rewrite would be held back; without it, at 70 %, and it runs.
 */
describe('the text cap', () => {
  it('leaves the assistant’s spend out, so a talkative month cannot hold back the nightly rewrite', async () => {
    await expect(TextSpend.gauge(5)).resolves.toEqual({ capUsd: 5, share: 0.7, sweepPaused: false });
  });
});

describe('AssistantSpend', () => {
  it('counts the assistant’s calls and nothing else', async () => {
    await expect(AssistantSpend.month()).resolves.toEqual({ calls: 900, spentUsd: 9, uncostedCalls: 3 });
  });

  it('says the ceiling is reached at the cap, not past it', async () => {
    await expect(AssistantSpend.reached(9)).resolves.toBe(true);
    await expect(AssistantSpend.reached(10)).resolves.toBe(false);
  });
});

describe('the console’s month', () => {
  it('shows the assistant apart, against its own cap, and keeps it out of the text total', async () => {
    const month = await AdminTextSpend.month(new Date('2026-11-15T12:00:00Z'), 5, 20);

    expect(month.spentUsd).toBe(3.5);
    expect(month.byFeature.map(row => row.feature)).not.toContain('assistant');
    expect(month.assistant).toEqual({ calls: 900, capUsd: 20, costUsd: 9, share: 0.45, uncostedCalls: 3 });
  });

  it('carries no assistant gauge when its cap is not set', async () => {
    expect((await AdminTextSpend.month(new Date('2026-11-15T12:00:00Z'), 5)).assistant).toEqual({ calls: 900, costUsd: 9, uncostedCalls: 3 });
  });
});

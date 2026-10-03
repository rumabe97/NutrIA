import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MailBudgetController } from './MailBudgetController';

import type { MailDecision, MailsSent } from 'core/domain/MailBudget';

const spend = vi.fn<(key: string, now: Date, decide: (sent: MailsSent | undefined) => MailDecision) => Promise<MailDecision>>();

vi.mock('#repositories/MailBudget', () => ({
  MailBudgetRepository: { spend: (key: string, now: Date, decide: (sent: MailsSent | undefined) => MailDecision) => spend(key, now, decide) }
}));

const KEY = 'k'.repeat(64);
const NOW = new Date('2026-10-03T10:00:00.000Z');
const LATER = new Date('2026-10-03T10:30:00.000Z');

beforeEach(() => {
  spend.mockReset();
});

describe('MailBudgetController.spend', () => {
  it('decides under the repository lock with the domain rule, at the same instant', async () => {
    spend.mockImplementation(async (_key, _now, decide) => Promise.resolve(decide({ count: 2, windowEndsAt: LATER })));

    await expect(MailBudgetController.spend(KEY, NOW)).resolves.toBe(true);
    expect(spend).toHaveBeenCalledWith(KEY, NOW, expect.any(Function));
  });

  it('answers false once the hour has sent three', async () => {
    spend.mockImplementation(async (_key, _now, decide) => Promise.resolve(decide({ count: 3, windowEndsAt: LATER })));

    await expect(MailBudgetController.spend(KEY, NOW)).resolves.toBe(false);
  });
});

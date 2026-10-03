import { describe, expect, it } from 'vitest';

import { decideMail, MAIL_BUDGET, mailBudgetKey } from './MailBudget';

const NOW = new Date('2026-10-03T10:00:00.000Z');
const SECRET = 'a-secret-of-at-least-thirty-two-characters';

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

describe('mailBudgetKey', () => {
  it('is 64 hex characters, the same for any casing of the address, and never holds it', () => {
    const key = mailBudgetKey('verification', 'Ana@Example.invalid', SECRET);

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(mailBudgetKey('verification', 'ana@example.invalid', SECRET));
    expect(key).not.toContain('ana');
  });

  it('keeps each kind, each address and each secret apart', () => {
    const key = mailBudgetKey('verification', 'ana@example.invalid', SECRET);

    expect(mailBudgetKey('existing-account', 'ana@example.invalid', SECRET)).not.toBe(key);
    expect(mailBudgetKey('verification', 'bea@example.invalid', SECRET)).not.toBe(key);
    expect(mailBudgetKey('verification', 'ana@example.invalid', `${SECRET}-other`)).not.toBe(key);
  });
});

describe('decideMail', () => {
  it('sends the first mail and opens an hour', () => {
    expect(decideMail(undefined, NOW)).toEqual({ kind: 'send', next: { count: 1, windowEndsAt: at(MAIL_BUDGET.windowMs) } });
  });

  it('sends three in the hour and holds the fourth', () => {
    let sent = decideMail(undefined, NOW);

    for (let i = 2; i <= MAIL_BUDGET.max; i += 1) {
      if (sent.kind !== 'send') {
        throw new Error('held too soon');
      }

      sent = decideMail(sent.next, at(i * 1000));
      expect(sent).toEqual({ kind: 'send', next: { count: i, windowEndsAt: at(MAIL_BUDGET.windowMs) } });
    }

    expect(decideMail({ count: MAIL_BUDGET.max, windowEndsAt: at(MAIL_BUDGET.windowMs) }, at(MAIL_BUDGET.windowMs - 1))).toEqual({ kind: 'held' });
  });

  it('starts again at one once the hour has ended, however much it spent', () => {
    expect(decideMail({ count: MAIL_BUDGET.max, windowEndsAt: NOW }, NOW)).toEqual({
      kind: 'send',
      next: { count: 1, windowEndsAt: at(MAIL_BUDGET.windowMs) }
    });
  });
});

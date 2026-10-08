import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import { MailBudgetController } from 'core/controllers/MailBudget';
import { mailBudgetKey } from 'core/domain/MailBudget';

import { mailBudget } from './MailBudget.js';

const SECRET = 'a'.repeat(32);
const ANA = { id: 'user-ana', email: 'Ana@Example.invalid' };

describe('mailBudget', () => {
  let spend: jest.SpiedFunction<typeof MailBudgetController.spend>;
  const lines: string[] = [];

  beforeEach(() => {
    lines.length = 0;
    spend = jest.spyOn(MailBudgetController, 'spend');

    const capture = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };

    jest.spyOn(Logger.prototype, 'error').mockImplementation(capture);
    jest.spyOn(console, 'info').mockImplementation(capture);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends while the hour has room, counted under the kind’s HMAC of the address', async () => {
    spend.mockResolvedValue(true);
    const send = jest.fn(async () => Promise.resolve());

    await mailBudget(SECRET).within('verification', ANA, send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(spend).toHaveBeenCalledWith(mailBudgetKey('verification', 'ana@example.invalid', SECRET));
    expect(lines).toEqual([]);
  });

  it('holds the mail once the hour is spent, with one line that names the account and not the address', async () => {
    spend.mockResolvedValue(false);
    const send = jest.fn(async () => Promise.resolve());

    await mailBudget(SECRET).within('existing-account', ANA, send);

    expect(send).not.toHaveBeenCalled();
    expect(lines).toEqual(["[auth] existing-account mail held: the address's hourly budget is spent (user user-ana)"]);
  });

  it('fails open: if its row cannot be read, the mail goes and one line says so, without the address', async () => {
    spend.mockRejectedValue(new Error('database down'));
    const send = jest.fn(async () => Promise.resolve());

    await mailBudget(SECRET).within('verification', ANA, send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(['mail_budget_unavailable']);
  });
});

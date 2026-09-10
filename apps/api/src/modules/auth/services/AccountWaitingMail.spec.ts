import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { notifyOwnerOfWaitingAccount } from './AccountWaitingMail.js';

import type { OutgoingEmail } from '../../email/Email.service.js';

const ACCOUNT = { id: 'usr-1', email: 'ana@example.invalid' };
const OWNER = 'owner@example.invalid';
const LINK = { apiUrl: 'https://nutria.example/api/v1', secret: 'a'.repeat(32) };

function mailer(configured = true, outcome = true) {
  return { configured, send: jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(outcome) };
}

describe('notifyOwnerOfWaitingAccount', () => {
  let info: jest.SpiedFunction<typeof console.info>;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    info.mockRestore();
  });

  it('tells the owner who is waiting and how to open the account', async () => {
    const stub = mailer();

    await notifyOwnerOfWaitingAccount(stub, OWNER, ACCOUNT, LINK);

    const message = stub.send.mock.calls[0]?.[0];

    expect(message?.to).toBe(OWNER);
    expect(message?.text).toContain('ana@example.invalid');
    // The runbook's own statement, ready to paste.
    expect(message?.text).toContain('https://nutria.example/api/v1/admin/activate?token=');
    // The statement stays as a fallback for when a link is not what you want.
    expect(message?.text).toContain('update "user" set activated_at = now()');
  });

  it('sends nothing when no owner address is configured', async () => {
    const stub = mailer();

    await notifyOwnerOfWaitingAccount(stub, undefined, ACCOUNT, LINK);

    expect(stub.send).not.toHaveBeenCalled();
  });

  it('sends nothing when there is no mail at all', async () => {
    const stub = mailer(false);

    await notifyOwnerOfWaitingAccount(stub, OWNER, ACCOUNT, LINK);

    expect(stub.send).not.toHaveBeenCalled();
  });

  it('never throws, so a sign-up is never lost to a mailbox', async () => {
    const stub = mailer();

    stub.send.mockRejectedValue(new Error('smtp closed'));

    await expect(notifyOwnerOfWaitingAccount(stub, OWNER, ACCOUNT, LINK)).resolves.toBeUndefined();
  });
});

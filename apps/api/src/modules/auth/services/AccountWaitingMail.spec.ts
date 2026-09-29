import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { notifyOwnerOfWaitingAccount } from './AccountWaitingMail.js';

import type { OutgoingEmail } from '../../email/services/Email.service.js';

const OWNER = 'owner@example.invalid';

function LINK(path: string): string {
  return `https://nutria.example${path}`;
}

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

  it('tells the owner an account is waiting and sends them to the console, naming nobody', async () => {
    const stub = mailer();

    await notifyOwnerOfWaitingAccount(stub, OWNER, LINK);

    const message = stub.send.mock.calls[0]?.[0];

    expect(message?.to).toBe(OWNER);
    expect(message?.text).toContain('https://nutria.example/admin/cuentas?activated=no');
    expect(message?.text).not.toContain('/admin/activate');
    expect(message?.text).not.toContain('token');
  });

  it('sends nothing when no owner address is configured', async () => {
    const stub = mailer();

    await notifyOwnerOfWaitingAccount(stub, undefined, LINK);

    expect(stub.send).not.toHaveBeenCalled();
  });

  it('sends nothing when there is no mail at all', async () => {
    const stub = mailer(false);

    await notifyOwnerOfWaitingAccount(stub, OWNER, LINK);

    expect(stub.send).not.toHaveBeenCalled();
  });

  it('never throws, so a sign-up is never lost to a mailbox', async () => {
    const stub = mailer();

    stub.send.mockRejectedValue(new Error('smtp closed'));

    await expect(notifyOwnerOfWaitingAccount(stub, OWNER, LINK)).resolves.toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { sendPasswordResetMail } from './PasswordResetMail.js';

import type { OutgoingEmail } from '../email/Email.service.js';

const URL = 'https://nutria.example/api/v1/auth/reset-password/tok?callbackURL=/restablecer';
const request = { acceptLanguage: 'es-ES', to: 'ana@example.com', url: URL, userId: 'user_1' };

function mailer(configured: boolean, outcome = true) {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(outcome);

  return { configured, send };
}

describe('sendPasswordResetMail', () => {
  let info: jest.SpiedFunction<typeof console.info>;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    info.mockRestore();
  });

  it('sends the reset mail to the account address, in the request language', async () => {
    const stub = mailer(true);

    await sendPasswordResetMail(stub, { ...request, acceptLanguage: 'en-GB' });

    expect(stub.send).toHaveBeenCalledTimes(1);
    const message = stub.send.mock.calls[0]?.[0];

    expect(message?.to).toBe('ana@example.com');
    expect(message?.subject).toBe('Reset your NutrIA password');
    expect(message?.text).toContain(URL);
  });

  it('falls back to Spanish when the request names no supported language', async () => {
    const stub = mailer(true);

    await sendPasswordResetMail(stub, { ...request, acceptLanguage: 'fr-FR,fr;q=0.9' });

    expect(stub.send.mock.calls[0]?.[0]?.subject).toBe('Restablece tu contraseña de NutrIA');
  });

  it('logs the link instead when no mail is configured, without the address', async () => {
    const stub = mailer(false);

    await sendPasswordResetMail(stub, request);

    expect(stub.send).not.toHaveBeenCalled();
    const line = String(info.mock.calls[0]?.[0]);

    expect(line).toContain(URL);
    expect(line).not.toContain('ana@example.com');
  });

  it('never throws when the provider refuses the mail, and never logs the address', async () => {
    const stub = mailer(true, false);

    await expect(sendPasswordResetMail(stub, request)).resolves.toBeUndefined();

    const lines = info.mock.calls.map(call => String(call[0]));

    expect(lines.some(line => line.includes('NOT sent'))).toBe(true);
    expect(lines.some(line => line.includes('ana@example.com'))).toBe(false);
  });
});

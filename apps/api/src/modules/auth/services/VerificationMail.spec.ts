import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ProfileController } from 'core/controllers/Profile';

import { sendVerificationMail } from './VerificationMail.js';

import type { OutgoingEmail } from '../../email/services/Email.service.js';

const URL = 'https://nutria.example/api/v1/auth/verify-email?token=tok&callbackURL=/cuenta';
const APP = 'https://nutria.example';
const request = { acceptLanguage: 'es-ES', appUrl: APP, nodeEnv: 'development' as const, to: 'ana@example.com', url: URL, userId: 'user_1' };

function mailer(configured: boolean, outcome = true) {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(outcome);

  return { configured, send };
}

/** The profile the API would read for this recipient, or none at all. */
function profileLocale(locale: string | null) {
  return jest.spyOn(ProfileController, 'localeOf').mockResolvedValue(locale);
}

describe('sendVerificationMail', () => {
  let info: jest.SpiedFunction<typeof console.info>;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    profileLocale(null);
  });

  afterEach(() => {
    info.mockRestore();
    jest.restoreAllMocks();
  });

  it('sends the confirmation to the account address, in the request language', async () => {
    const stub = mailer(true);

    await sendVerificationMail(stub, { ...request, acceptLanguage: 'en-GB' });

    expect(stub.send).toHaveBeenCalledTimes(1);
    const message = stub.send.mock.calls[0]?.[0];

    expect(message?.to).toBe('ana@example.com');
    expect(message?.subject).toBe('Confirm your address for NutrIA');
    expect(message?.text).toContain('verify-email?token=tok&callbackURL=https%3A%2F%2Fnutria.example%2Fen%2Fcuenta');
  });

  it('falls back to Spanish when the request names no supported language', async () => {
    const stub = mailer(true);

    await sendVerificationMail(stub, { ...request, acceptLanguage: 'fr-FR,fr;q=0.9' });

    expect(stub.send.mock.calls[0]?.[0]?.subject).toBe('Confirma tu correo en NutrIA');
  });

  it('follows the profile rather than the browser it was asked from', async () => {
    profileLocale('en-GB');
    const stub = mailer(true);

    await sendVerificationMail(stub, { ...request, acceptLanguage: 'es-ES' });

    const message = stub.send.mock.calls[0]?.[0];

    expect(message?.subject).toBe('Confirm your address for NutrIA');
    expect(message?.text).toContain('%2Fen%2Fcuenta');
  });

  it.each(['development', 'test'] as const)('logs the link instead when no mail is configured in %s, without the address', async nodeEnv => {
    const stub = mailer(false);

    await sendVerificationMail(stub, { ...request, nodeEnv });

    expect(stub.send).not.toHaveBeenCalled();
    const line = info.mock.calls.map(call => String(call[0])).find(entry => entry.includes('verification')) ?? '';

    expect(line).toContain('user_1');
    expect(line).toContain('verify-email?token=tok&callbackURL=https%3A%2F%2Fnutria.example%2Fcuenta');
    expect(line).not.toContain('ana@example.com');
  });

  it.each(['staging', 'production'] as const)('keeps the link out of the log in %s, even with no mail configured', async nodeEnv => {
    const stub = mailer(false);

    await sendVerificationMail(stub, { ...request, nodeEnv });

    expect(stub.send).not.toHaveBeenCalled();
    const lines = info.mock.calls.map(call => String(call[0]));
    const line = lines.find(entry => entry.includes('verification')) ?? '';

    expect(line).toContain('user_1');
    expect(line).toContain('link for user_1 suppressed');
    expect(lines.some(entry => entry.includes('token=tok'))).toBe(false);
    expect(lines.some(entry => entry.includes('verify-email'))).toBe(false);
    expect(lines.some(entry => entry.includes('ana@example.com'))).toBe(false);
  });

  it('never logs the address when the provider refuses the mail', async () => {
    const stub = mailer(true, false);

    await expect(sendVerificationMail(stub, request)).resolves.toBeUndefined();

    const lines = info.mock.calls.map(call => String(call[0]));

    expect(lines.some(line => line.includes('NOT sent'))).toBe(true);
    expect(lines.some(line => line.includes('ana@example.com'))).toBe(false);
  });
});

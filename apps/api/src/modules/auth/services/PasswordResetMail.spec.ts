import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ProfileController } from 'core/controllers/Profile';

import { absoluteCallback, sendPasswordResetMail } from './PasswordResetMail.js';

import type { OutgoingEmail } from '../../email/Email.service.js';

const URL = 'https://nutria.example/api/v1/auth/reset-password/tok?callbackURL=/restablecer';
const APP = 'https://nutria.example';
const request = { acceptLanguage: 'es-ES', appUrl: APP, to: 'ana@example.com', url: URL, userId: 'user_1' };

function mailer(configured: boolean, outcome = true) {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(outcome);

  return { configured, send };
}

/** The profile the API would read for this recipient, or none at all. */
function profileLocale(locale: string | null) {
  return jest.spyOn(ProfileController, 'localeOf').mockResolvedValue(locale);
}

describe('absoluteCallback', () => {
  it('makes a path callback absolute on the app origin', () => {
    expect(absoluteCallback(URL, APP, 'es-ES')).toBe(
      'https://nutria.example/api/v1/auth/reset-password/tok?callbackURL=https%3A%2F%2Fnutria.example%2Frestablecer'
    );
  });

  it('sends an English reader to the English page', () => {
    expect(absoluteCallback(URL, APP, 'en-GB')).toBe(
      'https://nutria.example/api/v1/auth/reset-password/tok?callbackURL=https%3A%2F%2Fnutria.example%2Fen%2Frestablecer'
    );
  });

  it('leaves an absolute callback alone', () => {
    const absolute = 'https://api.example/api/v1/auth/reset-password/tok?callbackURL=https%3A%2F%2Fapp.example%2Frestablecer';

    expect(absoluteCallback(absolute, APP, 'en-GB')).toBe(absolute);
  });

  it('leaves a link with no callback, or no parseable url, alone', () => {
    expect(absoluteCallback('https://api.example/api/v1/auth/reset-password/tok', APP, 'es-ES')).toBe(
      'https://api.example/api/v1/auth/reset-password/tok'
    );
    expect(absoluteCallback('not a url', APP, 'es-ES')).toBe('not a url');
  });
});

describe('sendPasswordResetMail', () => {
  let info: jest.SpiedFunction<typeof console.info>;

  beforeEach(() => {
    info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    profileLocale(null);
  });

  afterEach(() => {
    info.mockRestore();
    jest.restoreAllMocks();
  });

  it('sends the reset mail to the account address, in the request language', async () => {
    const stub = mailer(true);

    await sendPasswordResetMail(stub, { ...request, acceptLanguage: 'en-GB' });

    expect(stub.send).toHaveBeenCalledTimes(1);
    const message = stub.send.mock.calls[0]?.[0];

    expect(message?.to).toBe('ana@example.com');
    expect(message?.subject).toBe('Reset your NutrIA password');
    expect(message?.text).toContain('reset-password/tok?callbackURL=https%3A%2F%2Fnutria.example%2Fen%2Frestablecer');
  });

  it('falls back to Spanish when the request names no supported language', async () => {
    const stub = mailer(true);

    await sendPasswordResetMail(stub, { ...request, acceptLanguage: 'fr-FR,fr;q=0.9' });

    expect(stub.send.mock.calls[0]?.[0]?.subject).toBe('Restablece tu contraseña de NutrIA');
  });

  it('follows the profile rather than the browser it was asked from', async () => {
    profileLocale('en-GB');
    const stub = mailer(true);

    await sendPasswordResetMail(stub, { ...request, acceptLanguage: 'es-ES' });

    const message = stub.send.mock.calls[0]?.[0];

    expect(message?.subject).toBe('Reset your NutrIA password');
    expect(message?.text).toContain('%2Fen%2Frestablecer');
  });

  it('still sends when the profile cannot be read', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockRejectedValue(new Error('database is down'));
    const stub = mailer(true);

    await sendPasswordResetMail(stub, { ...request, acceptLanguage: 'en-GB' });

    expect(stub.send.mock.calls[0]?.[0]?.subject).toBe('Reset your NutrIA password');
  });

  it('logs the link instead when no mail is configured, without the address', async () => {
    const stub = mailer(false);

    await sendPasswordResetMail(stub, request);

    expect(stub.send).not.toHaveBeenCalled();
    const line = info.mock.calls.map(call => String(call[0])).find(entry => entry.includes('password reset')) ?? '';

    expect(line).toContain('reset-password/tok?callbackURL=https%3A%2F%2Fnutria.example%2Frestablecer');
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

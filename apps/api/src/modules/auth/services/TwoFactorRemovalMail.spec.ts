import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ProfileController } from 'core/controllers/Profile';

import { sendTwoFactorRemovalMail } from './TwoFactorRemovalMail.js';

import type { OutgoingEmail } from '../../email/services/Email.service.js';

const APP = 'https://nutria.example';
const request = {
  appUrl: APP,
  event: { dueAt: new Date('2026-10-03T17:05:00.000Z'), kind: 'requested' } as const,
  to: 'ana@example.com',
  userId: 'user_1'
};

function mailer(configured: boolean) {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(true);

  return { configured, send };
}

/* PLAN 011 phase 4: the owner's removal of a lost second factor, mailed to the account. */
describe('sendTwoFactorRemovalMail', () => {
  const logged: string[] = [];

  beforeEach(() => {
    logged.length = 0;
    jest.spyOn(console, 'info').mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mails the account’s own address in its profile’s language, with the sign-in link in that language', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('en-GB');
    const sink = mailer(true);

    await sendTwoFactorRemovalMail(sink, request);

    const sent = sink.send.mock.calls[0]?.[0];

    expect(sent).toMatchObject({
      kind: 'two-factor-removal-requested',
      subject: 'Request to remove your two-step verification',
      to: 'ana@example.com'
    });
    expect(sent?.text).toContain('https://nutria.example/en/acceder');
  });

  it('falls back to Spanish with no profile: no request header is the account’s', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue(null);
    const sink = mailer(true);

    await sendTwoFactorRemovalMail(sink, { ...request, event: { kind: 'removed' } });

    expect(sink.send.mock.calls[0]?.[0]).toMatchObject({ kind: 'two-factor-removed', subject: 'Hemos quitado tu verificación en dos pasos' });
  });

  it('never writes the address to the log, and sends nothing with no mail configured', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');
    const unconfigured = mailer(false);

    await sendTwoFactorRemovalMail(mailer(true), request);
    await sendTwoFactorRemovalMail(unconfigured, request);

    expect(unconfigured.send).not.toHaveBeenCalled();
    expect(logged).toHaveLength(2);
    expect(logged.join('\n')).not.toContain('ana@example.com');
  });
});

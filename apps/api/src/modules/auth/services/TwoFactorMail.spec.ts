import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ProfileController } from 'core/controllers/Profile';

import { sendTwoFactorMail } from './TwoFactorMail.js';

import type { OutgoingEmail } from '../../email/services/Email.service.js';

const APP = 'https://nutria.example';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const request = {
  acceptLanguage: 'es-ES',
  appUrl: APP,
  at: new Date('2026-10-01T13:05:00.000Z'),
  event: { kind: 'backup-code-used', remaining: 3 } as const,
  to: 'ana@example.com',
  userAgent: IPHONE,
  userId: 'user_1'
};

function mailer(configured: boolean) {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(true);

  return { configured, send };
}

describe('sendTwoFactorMail', () => {
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

  it('mails the account in its profile’s language, with the device family and the /recuperar link in that language', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('en-GB');
    const sink = mailer(true);

    await sendTwoFactorMail(sink, request);

    const sent = sink.send.mock.calls[0]?.[0];

    expect(sent).toMatchObject({ kind: 'backup-code-used', subject: 'You used a backup code (3 left)', to: 'ana@example.com' });
    expect(sent?.text).toContain('From: Safari on iPhone.');
    expect(sent?.text).toContain('https://nutria.example/en/recuperar');
  });

  it('never writes the user agent, the address or anything else of the request to the log', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');

    await sendTwoFactorMail(mailer(true), request);
    await sendTwoFactorMail(mailer(false), request);

    expect(logged).toHaveLength(2);
    expect(logged.join('\n')).not.toContain('iPhone');
    expect(logged.join('\n')).not.toContain('ana@example.com');
  });

  it('sends nothing with no mail configured', async () => {
    const sink = mailer(false);

    await sendTwoFactorMail(sink, request);

    expect(sink.send).not.toHaveBeenCalled();
  });
});

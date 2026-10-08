import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ProfileController } from 'core/controllers/Profile';

import { sendExistingAccountMail } from './ExistingAccountMail.js';

import type { OutgoingEmail } from '../../email/services/Email.service.js';

const APP = 'https://nutria.example';
const request = { acceptLanguage: 'es-ES', appUrl: APP, to: 'ana@example.com', userId: 'user_1' };

function mailer(configured: boolean) {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(true);

  return { configured, send };
}

describe('sendExistingAccountMail', () => {
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

  it('mails the account in its profile’s language, with /acceder and /recuperar in that language', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('en-GB');
    const sink = mailer(true);

    await sendExistingAccountMail(sink, request);

    const sent = sink.send.mock.calls[0]?.[0];

    expect(sent).toMatchObject({ kind: 'existing-account-sign-up', to: 'ana@example.com' });
    expect(sent?.text).toContain('https://nutria.example/en/acceder');
    expect(sent?.text).toContain('https://nutria.example/en/recuperar');
  });

  it('sends nothing with no mail configured, and never logs the address', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');
    const sink = mailer(false);

    await sendExistingAccountMail(sink, request);
    await sendExistingAccountMail(mailer(true), request);

    expect(sink.send).not.toHaveBeenCalled();
    expect(logged).toHaveLength(2);
    expect(logged.join('\n')).not.toContain('ana@');
  });
});

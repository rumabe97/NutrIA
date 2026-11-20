import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NoticeController } from 'core/controllers/Notice';
import { ProfileController } from 'core/controllers/Profile';

import { AdminNoticesService } from './AdminNotices.service.js';

import type { DeliverNotice } from 'core/controllers/Notice';
import type { EmailService, OutgoingEmail } from '../../email/services/index.js';
import type { Env } from '../../../config/index.js';

/*
 * Project 025 phase 10: the API's half of one notice mail — the account's own
 * language, that language's pages, the day written in it, and the mail server's
 * answer handed back as `accepted`.
 */
describe('AdminNoticesService — one account’s mail', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function harness(accepted: boolean) {
    const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(accepted);
    const service = new AdminNoticesService(
      { APP_URL: 'https://nutria.example', EMAIL_FROM: 'hola@nutria.example' } as Env,
      { send } as unknown as EmailService
    );
    let deliver: DeliverNotice | undefined;

    jest.spyOn(NoticeController, 'send').mockImplementation(async (_notice, _owner, _input, given) => {
      deliver = given;

      return { failed: 0, remaining: 0, sent: 0, skippedUnconfirmed: 0 };
    });

    return { deliver: () => deliver as DeliverNotice, send, service };
  }

  it.each([
    ['en-GB', 'https://nutria.example/en/privacidad#tu-profesional', 'https://nutria.example/en/condiciones', 'From 1 December 2026,'],
    ['es-ES', 'https://nutria.example/privacidad#tu-profesional', 'https://nutria.example/condiciones', 'A partir del 1 de diciembre de 2026,']
  ])('writes to an account whose profile is in %s in that language, with that language’s pages', async (locale, privacy, terms, day) => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue(locale);
    const { deliver, send, service } = harness(true);

    await service.send('terms-2.4.0', 'usr-owner', { date: '2026-12-01' });

    await expect(deliver()({ id: 'usr-ana', email: 'ana@example.invalid' })).resolves.toEqual({ accepted: true, locale });

    const [message] = send.mock.calls[0] ?? [];

    expect(message?.to).toBe('ana@example.invalid');
    expect(message?.kind).toBe('terms-change-notice');
    expect(message?.text).toContain(day);
    expect(message?.text).toContain(privacy);
    expect(message?.text).toContain(terms);
    expect(message?.text).toContain('hola@nutria.example');
  });

  it('writes in Spanish to an account with no profile', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue(null);
    const { deliver, service } = harness(true);

    await service.send('terms-2.4.0', 'usr-owner', { date: '2026-12-01' });

    await expect(deliver()({ id: 'usr-ana', email: 'ana@example.invalid' })).resolves.toMatchObject({ locale: 'es-ES' });
  });

  it('hands back the mail server’s refusal as not accepted, for the controller to count and record nothing', async () => {
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');
    const { deliver, service } = harness(false);

    await service.send('terms-2.4.0', 'usr-owner', { date: '2026-12-01' });

    await expect(deliver()({ id: 'usr-ana', email: 'ana@example.invalid' })).resolves.toEqual({ accepted: false, locale: 'es-ES' });
  });

  it('asks each recipient’s language for the preview the way the mail will', async () => {
    const localeOf = jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('en-GB');
    const preview = jest
      .spyOn(NoticeController, 'preview')
      .mockImplementation(async (_notice, _input, given) => ({
        alreadySent: 0,
        campaignDate: null,
        recipients: [{ email: 'ana@example.invalid', locale: await given('usr-ana') }],
        skippedUnconfirmed: 0,
        toSend: 1
      }));
    const service = new AdminNoticesService({ APP_URL: 'https://nutria.example' } as Env, { send: async () => true } as unknown as EmailService);

    await expect(service.preview('terms-2.4.0', { date: '2026-12-01' })).resolves.toMatchObject({ recipients: [{ locale: 'en-GB' }] });
    expect(preview).toHaveBeenCalledTimes(1);
    expect(localeOf).toHaveBeenCalledWith('usr-ana');
  });
});

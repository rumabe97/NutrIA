import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NotificationController } from 'core/controllers/Notification';

import { CheckInReminderService } from './CheckInReminder.service.js';

import type { EmailService, OutgoingEmail } from '../../email/services/Email.service.js';
import type { Env } from '../../../config/index.js';
import type { ErrorReporter } from '../../../shared/observability/index.js';
import type { Recipient } from 'core/controllers/Notification';

const ENV = { APP_URL: 'https://nutria.example' } as Env;

function recipient(overrides: Partial<Recipient> = {}): Recipient {
  return { email: 'ana@example.invalid', endDate: '2026-09-22', locale: 'es-ES', planId: 'plan-1', userId: 'usr-1', ...overrides };
}

function harness(options: { configured?: boolean; due?: readonly Recipient[]; sends?: boolean } = {}) {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(options.sends ?? true);
  const mailer = { configured: options.configured ?? true, send } as unknown as EmailService;
  const report = jest.fn();
  const due = jest.spyOn(NotificationController, 'checkInDue').mockResolvedValue(options.due ?? []);
  const record = jest.spyOn(NotificationController, 'recordCheckInReminder').mockResolvedValue(undefined);

  return { due, record, send, service: new CheckInReminderService(ENV, mailer, { report } as unknown as ErrorReporter) };
}

describe('CheckInReminderService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends nothing at all when no mail is configured', async () => {
    const { due, send, service } = harness({ configured: false, due: [recipient()] });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 0, failed: 0, sent: 0 });
    expect(due).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends one mail to each account due, in their language, with the link and no health data', async () => {
    const { record, send, service } = harness({ due: [recipient(), recipient({ email: 'bob@example.invalid', locale: 'en-GB', userId: 'usr-2' })] });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 2, failed: 0, sent: 2 });

    const [spanish, english] = send.mock.calls.map(call => call[0]);

    expect(spanish?.to).toBe('ana@example.invalid');
    expect(spanish?.subject).toContain('quincena');
    expect(spanish?.text).toContain('https://nutria.example/check-in');
    expect(english?.subject).toContain('fortnight');
    // The link opens the page the copy is written in, not the product's default.
    expect(english?.text).toContain('https://nutria.example/en/check-in');
    // The record is written per account, so the next sweep skips them.
    expect(record.mock.calls.map(call => call[0])).toEqual(['usr-1', 'usr-2']);
  });

  it('records nothing when the provider refuses, so tomorrow tries again', async () => {
    const { record, service } = harness({ due: [recipient()], sends: false });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 1, failed: 1, sent: 0 });
    expect(record).not.toHaveBeenCalled();
  });

  it('one recipient failing does not cost the others theirs', async () => {
    const { record, send, service } = harness({ due: [recipient(), recipient({ email: 'bob@example.invalid', userId: 'usr-2' })] });

    send.mockRejectedValueOnce(new Error('smtp closed'));

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 2, failed: 1, sent: 1 });
    expect(record.mock.calls.map(call => call[0])).toEqual(['usr-2']);
  });

  it('asks for the accounts due today, in a bounded batch', async () => {
    const { due, service } = harness();

    await service.sweep('2026-09-22');

    expect(due).toHaveBeenCalledWith('2026-09-22', 40);
  });
});

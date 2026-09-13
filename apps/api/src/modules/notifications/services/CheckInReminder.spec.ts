import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NotificationController } from 'core/controllers/Notification';
import { SettingsController } from 'core/controllers/Settings';

import { CheckInReminderService } from './CheckInReminder.service.js';

import type { EmailService, OutgoingEmail } from '../../email/services/Email.service.js';
import type { Env } from '../../../config/index.js';
import type { ErrorReporter } from '../../../shared/observability/index.js';
import type { PushMessage, PushService } from './Push.service.js';
import type { PushTarget, Recipient } from 'core/controllers/Notification';

const ENV = { APP_URL: 'https://nutria.example' } as Env;
const PHONE: PushTarget = { auth: 'auth', endpoint: 'https://web.push.apple.com/phone', p256dh: 'p256dh' };

function recipient(overrides: Partial<Recipient> = {}): Recipient {
  return {
    email: 'ana@example.invalid',
    endDate: '2026-09-22',
    locale: 'es-ES',
    planId: 'plan-1',
    pushTargets: [],
    userId: 'usr-1',
    wantsEmail: true,
    ...overrides
  };
}

function harness(options: { due?: readonly Recipient[]; mail?: boolean; push?: boolean; sends?: boolean; switchedOn?: boolean } = {}) {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(options.sends ?? true);
  const mailer = { configured: options.mail ?? true, send } as unknown as EmailService;
  // A phone accepts whatever it is sent: each target counts as delivered.
  const pushSend = jest.fn<(targets: readonly PushTarget[], message: PushMessage) => Promise<number>>(async targets => targets.length);
  const push = { configured: options.push ?? true, send: pushSend } as unknown as PushService;
  const report = jest.fn();

  jest.spyOn(SettingsController, 'checkInReminders').mockResolvedValue(options.switchedOn ?? true);

  const due = jest.spyOn(NotificationController, 'checkInDue').mockResolvedValue(options.due ?? []);
  const record = jest.spyOn(NotificationController, 'recordCheckInReminder').mockResolvedValue(undefined);

  return { due, pushSend, record, send, service: new CheckInReminderService(ENV, mailer, push, { report } as unknown as ErrorReporter) };
}

describe('CheckInReminderService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /* The owner's switch on `/admin` (`0054`): off, the sweep does not even look. */
  it('sends nothing at all while the owner has it switched off', async () => {
    const { due, pushSend, send, service } = harness({ due: [recipient({ pushTargets: [PHONE] })], switchedOn: false });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 0, failed: 0, pushed: 0, sent: 0 });
    expect(due).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(pushSend).not.toHaveBeenCalled();
  });

  it('sends nothing at all when neither mail nor push is configured', async () => {
    const { due, send, service } = harness({ due: [recipient()], mail: false, push: false });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 0, failed: 0, pushed: 0, sent: 0 });
    expect(due).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends one mail to each account due, in their language, with the link and no health data', async () => {
    const { record, send, service } = harness({ due: [recipient(), recipient({ email: 'bob@example.invalid', locale: 'en-GB', userId: 'usr-2' })] });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 2, failed: 0, pushed: 0, sent: 2 });

    const [spanish, english] = send.mock.calls.map(call => call[0]);

    expect(spanish?.to).toBe('ana@example.invalid');
    expect(spanish?.subject).toContain('quincena');
    expect(spanish?.text).toContain('https://nutria.example/check-in');
    expect(english?.subject).toContain('fortnight');
    // The link opens the page the copy is written in, not the product's default.
    expect(english?.text).toContain('https://nutria.example/en/check-in');
    // The record is written per account, so the next sweep skips them.
    expect(record.mock.calls.map(call => [call[0], call[3]])).toEqual([
      ['usr-1', 'email'],
      ['usr-2', 'email']
    ]);
  });

  it('tells the phones they subscribed as well, with the same link and nothing about their health', async () => {
    const { pushSend, record, service } = harness({ due: [recipient({ pushTargets: [PHONE] })] });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 1, failed: 0, pushed: 1, sent: 1 });
    expect(pushSend).toHaveBeenCalledWith([PHONE], {
      body: 'Dos minutos de check-in y el siguiente plan parte de ahí.',
      title: 'Tu quincena ha terminado',
      url: 'https://nutria.example/check-in'
    });
    expect(record.mock.calls.map(call => call[3])).toEqual(['email']);
  });

  it('reaches only the phone of someone who turned the mail off, and records it as a push', async () => {
    const { record, send, service } = harness({ due: [recipient({ pushTargets: [PHONE], wantsEmail: false })] });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 1, failed: 0, pushed: 1, sent: 1 });
    expect(send).not.toHaveBeenCalled();
    expect(record.mock.calls.map(call => call[3])).toEqual(['push']);
  });

  it('does not let a refused mail cost the phone its reminder', async () => {
    const { record, service } = harness({ due: [recipient({ pushTargets: [PHONE] })], sends: false });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 1, failed: 0, pushed: 1, sent: 1 });
    expect(record.mock.calls.map(call => call[3])).toEqual(['push']);
  });

  it('pushes without any mail configured', async () => {
    const { send, service } = harness({ due: [recipient({ pushTargets: [PHONE] })], mail: false });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 1, failed: 0, pushed: 1, sent: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it('records nothing when nothing accepted it, so tomorrow tries again', async () => {
    const { record, service } = harness({ due: [recipient()], sends: false });

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 1, failed: 1, pushed: 0, sent: 0 });
    expect(record).not.toHaveBeenCalled();
  });

  it('one recipient failing does not cost the others theirs', async () => {
    const { record, send, service } = harness({ due: [recipient(), recipient({ email: 'bob@example.invalid', userId: 'usr-2' })] });

    send.mockRejectedValueOnce(new Error('smtp closed'));

    await expect(service.sweep('2026-09-22')).resolves.toEqual({ considered: 2, failed: 1, pushed: 0, sent: 1 });
    expect(record.mock.calls.map(call => call[0])).toEqual(['usr-2']);
  });

  it('asks for the accounts due today, in a bounded batch', async () => {
    const { due, service } = harness();

    await service.sweep('2026-09-22');

    expect(due).toHaveBeenCalledWith('2026-09-22', 40);
  });
});

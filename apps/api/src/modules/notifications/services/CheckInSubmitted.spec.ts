import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NotificationController } from 'core/controllers/Notification';

import { CheckInSubmittedService } from './CheckInSubmitted.service.js';

import type { EmailService, OutgoingEmail } from '../../email/services/Email.service.js';
import type { Env } from '../../../config/index.js';
import type { ErrorReporter } from '../../../shared/observability/index.js';
import type { PushMessage, PushService } from './Push.service.js';
import type { PushTarget } from 'core/controllers/Notification';

const ENV = { APP_URL: 'https://nutria.example' } as Env;
const PHONE: PushTarget = { auth: 'auth', endpoint: 'https://web.push.apple.com/phone', p256dh: 'p256dh' };
const PRO = { id: 'usr-pro', email: 'dietista@example.invalid' };

function harness(options: { locale?: string | null; mail?: boolean; push?: boolean; sends?: boolean; targets?: readonly PushTarget[] } = {}) {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockResolvedValue(options.sends ?? true);
  const mailer = { configured: options.mail ?? true, send } as unknown as EmailService;
  const pushSend = jest.fn<(targets: readonly PushTarget[], message: PushMessage) => Promise<number>>(async targets => targets.length);
  const push = { configured: options.push ?? true, send: pushSend } as unknown as PushService;
  const report = jest.fn();

  jest.spyOn(NotificationController, 'pushTargets').mockResolvedValue(options.targets ?? []);
  const record = jest.spyOn(NotificationController, 'recordCheckinSubmitted').mockResolvedValue(undefined);

  return { pushSend, record, send, service: new CheckInSubmittedService(ENV, mailer, push, { report } as unknown as ErrorReporter) };
}

describe('CheckInSubmittedService.notify', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mails the professional, in their stored language, with the client’s name, a link to /consulta and nothing about the check-in', async () => {
    const { record, send, service } = harness();

    await service.notify(PRO, 'Lucía');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining('Lucía'), to: PRO.email }));
    const [sent] = send.mock.calls[0] ?? [];

    expect(sent?.text).toContain('https://nutria.example/consulta');
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(PRO.id, expect.any(String), expect.any(String), 'email');
  });

  it('tells the phones they subscribed too, with the same link', async () => {
    const { pushSend, service } = harness({ targets: [PHONE] });

    await service.notify(PRO, 'Lucía');

    expect(pushSend).toHaveBeenCalledWith(
      [PHONE],
      expect.objectContaining({ title: expect.stringContaining('Lucía'), url: 'https://nutria.example/consulta' })
    );
  });

  it('sends nothing at all when neither mail nor push is configured, and asks the database nothing', async () => {
    const { record, send, service } = harness({ mail: false, push: false });
    const pushTargets = jest.spyOn(NotificationController, 'pushTargets');

    await service.notify(PRO, 'Lucía');

    expect(send).not.toHaveBeenCalled();
    expect(pushTargets).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('pushes without any mail configured', async () => {
    const { pushSend, record, service } = harness({ mail: false, targets: [PHONE] });

    await service.notify(PRO, 'Lucía');

    expect(pushSend).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(PRO.id, expect.any(String), expect.any(String), 'push');
  });

  it('records nothing when nothing accepted it', async () => {
    const { record, service } = harness({ sends: false });

    await service.notify(PRO, 'Lucía');

    expect(record).not.toHaveBeenCalled();
  });

  it('never throws when a channel errors, and reports it', async () => {
    const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>().mockRejectedValue(new Error('smtp closed'));
    const mailer = { configured: true, send } as unknown as EmailService;
    const push = { configured: false, send: jest.fn<() => Promise<number>>().mockResolvedValue(0) } as unknown as PushService;
    const report = jest.fn();

    jest.spyOn(NotificationController, 'pushTargets').mockResolvedValue([]);
    const record = jest.spyOn(NotificationController, 'recordCheckinSubmitted').mockResolvedValue(undefined);

    const service = new CheckInSubmittedService(ENV, mailer, push, { report } as unknown as ErrorReporter);

    await expect(service.notify(PRO, 'Lucía')).resolves.toBeUndefined();
    expect(report).toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

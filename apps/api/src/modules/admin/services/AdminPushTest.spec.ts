import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { NotificationController } from 'core/controllers/Notification';
import { ProfileController } from 'core/controllers/Profile';

import { AdminPushTestService } from './AdminPushTest.service.js';

import type { Env } from '../../../config/index.js';
import type { PushMessage, PushService } from '../../notifications/index.js';
import type { PushTarget } from 'core/controllers/Notification';

const ENV = { APP_URL: 'https://nutria.example' } as Env;
const PHONE: PushTarget = { auth: 'auth', endpoint: 'https://web.push.apple.com/phone', p256dh: 'p256dh' };

function harness(options: { configured?: boolean; delivered?: number; targets?: readonly PushTarget[] } = {}) {
  const send = jest.fn<(targets: readonly PushTarget[], message: PushMessage) => Promise<number>>(async () => options.delivered ?? 1);
  const targets = jest.spyOn(NotificationController, 'pushTargets').mockResolvedValue(options.targets ?? [PHONE]);

  jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');

  return { send, service: new AdminPushTestService(ENV, { configured: options.configured ?? true, send } as unknown as PushService), targets };
}

describe('AdminPushTestService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('says so when push is not set up, and looks up nobody', async () => {
    const { send, service, targets } = harness({ configured: false });

    await expect(service.send('owner-1')).resolves.toEqual({ configured: false, delivered: 0, devices: 0 });
    expect(targets).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('says so when the owner has no browser subscribed', async () => {
    const { send, service } = harness({ targets: [] });

    await expect(service.send('owner-1')).resolves.toEqual({ configured: true, delivered: 0, devices: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the reminder's own words, marked as a test, to the owner's browsers only", async () => {
    const { send, service, targets } = harness();

    await expect(service.send('owner-1')).resolves.toEqual({ configured: true, delivered: 1, devices: 1 });
    expect(targets).toHaveBeenCalledWith('owner-1');
    expect(send).toHaveBeenCalledWith([PHONE], {
      body: 'Dos minutos de check-in y el siguiente plan parte de ahí.',
      title: 'Prueba · Tu quincena ha terminado',
      url: 'https://nutria.example/check-in'
    });
  });

  it('reports a browser that refused as subscribed but not reached', async () => {
    const { service } = harness({ delivered: 0 });

    await expect(service.send('owner-1')).resolves.toEqual({ configured: true, delivered: 0, devices: 1 });
  });
});

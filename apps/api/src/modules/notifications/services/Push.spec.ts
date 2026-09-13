import { afterEach, describe, expect, it, jest } from '@jest/globals';
import webpush from 'web-push';

import { NotificationController } from 'core/controllers/Notification';

import { PushService } from './Push.service.js';

import type { Env } from '../../../config/index.js';

const VAPID = { VAPID_PRIVATE_KEY: 'private-key', VAPID_PUBLIC_KEY: 'public-key', VAPID_SUBJECT: 'mailto:owner@example.invalid' } as Env;
const ONE = { auth: 'auth-one', endpoint: 'https://fcm.googleapis.com/fcm/send/one', p256dh: 'p256dh-one' };
const TWO = { auth: 'auth-two', endpoint: 'https://web.push.apple.com/two', p256dh: 'p256dh-two' };
const MESSAGE = { body: 'Dos minutos de check-in.', title: 'Tu quincena ha terminado', url: 'https://nutria.example/check-in' };

function failure(statusCode: number): Error {
  return Object.assign(new Error(`push service answered ${statusCode}`), { statusCode });
}

describe('PushService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends nothing, and offers no key, without all three VAPID values', async () => {
    const send = jest.spyOn(webpush, 'sendNotification');
    const service = new PushService({ VAPID_PUBLIC_KEY: 'public-key' } as Env);

    expect(service.configured).toBe(false);
    expect(service.publicKey).toBeNull();
    await expect(service.send([ONE], MESSAGE)).resolves.toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('signs each message with the VAPID keys, keeps it for a day, and counts what was accepted', async () => {
    const send = jest.spyOn(webpush, 'sendNotification').mockResolvedValue({ body: '', headers: {}, statusCode: 201 });

    await expect(new PushService(VAPID).send([ONE, TWO], MESSAGE)).resolves.toBe(2);
    expect(send).toHaveBeenCalledWith({ endpoint: ONE.endpoint, keys: { auth: ONE.auth, p256dh: ONE.p256dh } }, JSON.stringify(MESSAGE), {
      TTL: 86_400,
      vapidDetails: { privateKey: 'private-key', publicKey: 'public-key', subject: 'mailto:owner@example.invalid' }
    });
  });

  it('drops a subscription its push service says is gone, and keeps one that merely failed', async () => {
    const drop = jest.spyOn(NotificationController, 'dropPushSubscription').mockResolvedValue(undefined);

    jest.spyOn(webpush, 'sendNotification').mockRejectedValueOnce(failure(410)).mockRejectedValueOnce(failure(503));

    await expect(new PushService(VAPID).send([ONE, TWO], MESSAGE)).resolves.toBe(0);
    expect(drop.mock.calls).toEqual([[ONE.endpoint]]);
  });
});

import { Inject, Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';

import { NotificationController } from 'core/controllers/Notification';

import { ENV } from '../../../config/index.js';

import type { Env } from '../../../config/index.js';
import type { PushTarget } from 'core/controllers/Notification';

/**
 * A day. A reminder no phone could take for a whole day is not worth delivering
 * later: by then the card on the dashboard says the same thing.
 */
const TIME_TO_LIVE_SECONDS = 24 * 60 * 60;

/** What a phone shows, and where tapping it goes. Nothing about anyone's health (`0054`). */
export type PushMessage = { readonly body: string; readonly title: string; readonly url: string };

type Vapid = { readonly privateKey: string; readonly publicKey: string; readonly subject: string };

/**
 * Sends a message to the browsers somebody subscribed (`0054`), over Web Push,
 * signed with the VAPID keys that identify this server to the push services.
 *
 * Without all three keys it is unconfigured, like mail without SMTP: nothing is
 * sent, and the profile offers no switch for it.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  get configured(): boolean {
    return this.vapid !== null;
  }

  /** The key a browser subscribes with — public by design. Null when push is not set up. */
  get publicKey(): string | null {
    return this.vapid?.publicKey ?? null;
  }

  private get vapid(): Vapid | null {
    const { VAPID_PRIVATE_KEY: privateKey, VAPID_PUBLIC_KEY: publicKey, VAPID_SUBJECT: subject } = this.env;

    return privateKey && publicKey && subject ? { privateKey, publicKey, subject } : null;
  }

  /** One message to each browser. Resolves to how many accepted it, and never throws. */
  async send(targets: readonly PushTarget[], message: PushMessage): Promise<number> {
    const vapid = this.vapid;

    if (!vapid || targets.length === 0) {
      return 0;
    }

    const payload = JSON.stringify(message);
    let delivered = 0;

    for (const target of targets) {
      try {
        await webpush.sendNotification({ endpoint: target.endpoint, keys: { auth: target.auth, p256dh: target.p256dh } }, payload, {
          TTL: TIME_TO_LIVE_SECONDS,
          vapidDetails: vapid
        });
        delivered += 1;
      } catch (error: unknown) {
        await this.refused(target, error);
      }
    }

    return delivered;
  }

  /**
   * A 404 or a 410 is the push service saying the subscription is gone — the
   * app was removed, or permission withdrawn — and it will never deliver again,
   * so the row goes. Anything else may work tomorrow, and the log says what.
   */
  private async refused(target: PushTarget, error: unknown): Promise<void> {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : undefined;

    if (status === 404 || status === 410) {
      await NotificationController.dropPushSubscription(target.endpoint).catch(() => undefined);

      return;
    }

    this.logger.warn(`Push refused for one browser: ${status ?? (error instanceof Error ? error.message : 'unknown')}`);
  }
}

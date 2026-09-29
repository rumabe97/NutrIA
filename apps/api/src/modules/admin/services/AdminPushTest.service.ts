import { Inject, Injectable, Logger } from '@nestjs/common';

import { AuditController } from 'core/controllers/Audit';
import { NotificationController } from 'core/controllers/Notification';
import { webUrl } from 'core/domain/WebUrl';

import { checkInReminderTest } from '../../email/templates/CheckInReminder.js';
import { ENV } from '../../../config/index.js';
import { PushService } from '../../notifications/index.js';
import { recipientLocale } from '../../email/services/RecipientLocale.js';

import type { Env } from '../../../config/index.js';
import type { PushTestDto } from '../dto/out/index.js';

@Injectable()
export class AdminPushTestService {
  private readonly logger = new Logger(AdminPushTestService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly push: PushService
  ) {}

  /**
   * The check-in reminder, marked as a test, to the browsers the owner
   * subscribed and nobody else's (`0054`). It sends whatever the
   * `checkInReminders` switch says, because it reaches only the person who
   * pressed it. It records no notification, so their real reminder still
   * comes — but the press itself is `push.test_sent` in the admin trail
   * (`0071`), written right after the send resolves: sending a push is a call
   * to the provider, not a database write, so there is no action to share a
   * transaction with, and the row is not written when the click never
   * reached the provider at all (push not configured, or no browser
   * subscribed).
   */
  async send(userId: string): Promise<PushTestDto> {
    if (!this.push.configured) {
      return { configured: false, delivered: 0, devices: 0 };
    }

    const targets = await NotificationController.pushTargets(userId);

    if (targets.length === 0) {
      return { configured: true, delivered: 0, devices: 0 };
    }

    const locale = await recipientLocale(userId);
    const delivered = await this.push.send(targets, { ...checkInReminderTest(locale), url: webUrl(this.env.APP_URL, '/check-in', locale) });

    // The push already reached the owner's browser by the time this runs; a
    // failed row must not turn a delivered test into a reported failure —
    // there is no address or device id to log, only that the trail missed one.
    try {
      await AuditController.record({ action: 'push.test_sent', actorId: userId, entity: 'push', metadata: {} });
    } catch {
      this.logger.warn('push test delivered but its audit row was not recorded');
    }

    return { configured: true, delivered, devices: targets.length };
  }
}

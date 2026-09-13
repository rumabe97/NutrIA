import { Inject, Injectable } from '@nestjs/common';

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
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly push: PushService
  ) {}

  /**
   * The check-in reminder, marked as a test, to the browsers the owner
   * subscribed and nobody else's (`0054`). It sends whatever the
   * `checkInReminders` switch says, because it reaches only the person who
   * pressed it. It records nothing, so their real reminder still comes.
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

    return { configured: true, delivered, devices: targets.length };
  }
}

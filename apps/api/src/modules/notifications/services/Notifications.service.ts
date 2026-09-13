import { Injectable } from '@nestjs/common';

import { NotificationController } from 'core/controllers/Notification';

import { PushService } from './Push.service.js';

import type { NotificationSettingsDto, PushKeyDto } from '../dto/out/index.js';
import type { PushSubscriptionDto, RemovePushSubscriptionDto, SetNotificationSettingsDto } from '../dto/in/index.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly push: PushService) {}

  pushKey(): PushKeyDto {
    return { publicKey: this.push.publicKey };
  }

  async setSettings(userId: string, body: SetNotificationSettingsDto): Promise<NotificationSettingsDto> {
    return NotificationController.setCheckInEmail(userId, body.checkInEmail);
  }

  async settings(userId: string): Promise<NotificationSettingsDto> {
    return NotificationController.settings(userId);
  }

  async subscribe(userId: string, body: PushSubscriptionDto): Promise<void> {
    await NotificationController.savePushSubscription(userId, body);
  }

  async unsubscribe(userId: string, body: RemovePushSubscriptionDto): Promise<void> {
    await NotificationController.removePushSubscription(userId, body.endpoint);
  }
}

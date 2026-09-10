import { Injectable } from '@nestjs/common';

import { NotificationController } from 'core/controllers/Notification';

import type { NotificationSettingsDto } from '../dto/out/index.js';
import type { SetNotificationSettingsDto } from '../dto/in/index.js';

@Injectable()
export class NotificationsService {
  async setSettings(userId: string, body: SetNotificationSettingsDto): Promise<NotificationSettingsDto> {
    return NotificationController.setCheckInEmail(userId, body.checkInEmail);
  }

  async settings(userId: string): Promise<NotificationSettingsDto> {
    return NotificationController.settings(userId);
  }
}

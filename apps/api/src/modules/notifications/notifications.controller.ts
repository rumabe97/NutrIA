import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { NotificationController } from 'core/controllers/Notification';
import { setNotificationSettingsSchema } from 'core/entities/Notification';

import { CurrentUser } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { NotificationSettingsView } from 'core/controllers/Notification';
import type { SessionUser } from '../../shared/decorators/index.js';
import type { SetNotificationSettings } from 'core/entities/Notification';

/** What this product may put in someone's inbox, and their answer to it. */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  @ApiOperation({ summary: 'Which reminders this account has turned on' })
  @Get('settings')
  async settings(@CurrentUser() user: SessionUser): Promise<NotificationSettingsView> {
    return NotificationController.settings(user.id);
  }

  @ApiOperation({ summary: 'Turn the check-in reminder on or off' })
  @Patch('settings')
  async setSettings(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(setNotificationSettingsSchema)) body: SetNotificationSettings
  ): Promise<NotificationSettingsView> {
    return NotificationController.setCheckInEmail(user.id, body.checkInEmail);
  }
}

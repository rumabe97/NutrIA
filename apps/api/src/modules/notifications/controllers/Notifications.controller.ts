import { Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ZodBody } from '../../../shared/index.js';
import { NotificationsService } from '../services/index.js';
import { SetNotificationSettingsDto } from '../dto/in/index.js';

import type { NotificationSettingsDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/** What this product may put in someone's inbox, and their answer to it. */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOkResponse({ description: 'The reminders this account has turned on.' })
  @ApiOperation({ summary: 'Which reminders this account has turned on' })
  @Get('settings')
  async settings(@CurrentUser() user: SessionUser): Promise<NotificationSettingsDto> {
    return this.notifications.settings(user.id);
  }

  @ApiOkResponse({ description: 'The settings as they now stand.' })
  @ApiOperation({ summary: 'Turn the check-in reminder on or off' })
  @Patch('settings')
  async setSettings(
    @CurrentUser() user: SessionUser,
    @ZodBody(SetNotificationSettingsDto) body: SetNotificationSettingsDto
  ): Promise<NotificationSettingsDto> {
    return this.notifications.setSettings(user.id, body);
  }
}

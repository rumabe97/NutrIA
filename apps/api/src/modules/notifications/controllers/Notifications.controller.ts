import { Controller, Delete, Get, HttpCode, HttpStatus, Patch, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ZodBody } from '../../../shared/index.js';
import { NotificationsService } from '../services/index.js';
import { PushSubscriptionDto, RemovePushSubscriptionDto, SetNotificationSettingsDto } from '../dto/in/index.js';

import type { NotificationSettingsDto, PushKeyDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/** What this product may put in someone's inbox or on their phone, and their answer to it. */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOkResponse({ description: 'The key a browser subscribes with, or null when push is not set up.' })
  @ApiOperation({ summary: 'The public key for push, if push exists' })
  @Get('push')
  pushKey(): PushKeyDto {
    return this.notifications.pushKey();
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

  @ApiOkResponse({ description: 'The reminders this account has turned on.' })
  @ApiOperation({ summary: 'Which reminders this account has turned on' })
  @Get('settings')
  async settings(@CurrentUser() user: SessionUser): Promise<NotificationSettingsDto> {
    return this.notifications.settings(user.id);
  }

  /** This browser, for this account (`0054`). Idempotent: the endpoint is the key, and the last to subscribe it owns it. */
  @ApiNoContentResponse({ description: 'This browser will be told when the fortnight closes.' })
  @ApiOperation({ summary: 'Be reminded on this browser' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('push')
  async subscribe(@CurrentUser() user: SessionUser, @ZodBody(PushSubscriptionDto) body: PushSubscriptionDto): Promise<void> {
    await this.notifications.subscribe(user.id, body);
  }

  @ApiNoContentResponse({ description: 'This browser will not be told any more. Nothing happens for an endpoint that is not theirs.' })
  @ApiOperation({ summary: 'Stop being reminded on this browser' })
  @Delete('push')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(@CurrentUser() user: SessionUser, @ZodBody(RemovePushSubscriptionDto) body: RemovePushSubscriptionDto): Promise<void> {
    await this.notifications.unsubscribe(user.id, body);
  }
}

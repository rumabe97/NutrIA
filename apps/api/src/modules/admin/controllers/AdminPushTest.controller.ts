import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminPushTestService } from '../services/index.js';
import { CurrentUser, RateLimit, Roles } from '../../../shared/index.js';

import type { PushTestDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/** A test notification, to the owner's own devices (`0054`). */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminPushTestController {
  constructor(private readonly pushTest: AdminPushTestService) {}

  @ApiOkResponse({ description: 'Whether push is set up, how many of the owner’s browsers are subscribed, and how many accepted.' })
  @ApiOperation({ summary: 'Send the owner a test notification' })
  @HttpCode(HttpStatus.OK)
  @Post('push-test')
  @RateLimit({ limit: 10, ttlSeconds: 3600 })
  async send(@CurrentUser() user: SessionUser): Promise<PushTestDto> {
    return this.pushTest.send(user.id);
  }
}

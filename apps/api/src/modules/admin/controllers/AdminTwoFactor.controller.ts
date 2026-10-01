import { Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminTwoFactorService } from '../services/index.js';
import { CurrentUser, Roles } from '../../../shared/index.js';

import type { SessionUser } from '../../../shared/index.js';
import type { TwoFactorRemovalDto } from '../dto/out/index.js';

/**
 * The way back for somebody who lost the phone and the backup codes (PLAN 011
 * phase 4), as the written procedure in `docs/legal/` describes it: the owner
 * asks here, the account's own address is mailed at once, and the daily cron
 * removes the factor on its first run 48 hours later or after — unless the
 * account enters a correct code first, or the owner cancels here.
 *
 * `@Roles('admin')` on the class: a non-admin and no session get the guard's
 * 404 before anything is read. `:id` is the account acted on, never a scope
 * for a read of anybody's data; the actor is always the session's user.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminTwoFactorController {
  constructor(private readonly twoFactor: AdminTwoFactorService) {}

  @ApiCreatedResponse({ description: '`{ dueAt }`: the cron removes the factor on its first run at or after it (48–72 h). The account is mailed.' })
  @ApiConflictResponse({
    description: '`TWO_FACTOR_NOT_ENABLED`: the account has no factor on. `TWO_FACTOR_REMOVAL_PENDING`: one is already waiting.'
  })
  @ApiOperation({ summary: 'Ask for a lost second factor to be removed in 48 hours' })
  @Post('users/:id/two-factor/removal')
  async request(@Param('id') id: string, @CurrentUser() owner: SessionUser): Promise<TwoFactorRemovalDto> {
    return this.twoFactor.request(id, owner.id);
  }

  @ApiNoContentResponse({ description: 'The pending removal is cancelled and the account is mailed. 404 when none is pending.' })
  @ApiOperation({ summary: 'Cancel a pending removal of the second factor' })
  @Delete('users/:id/two-factor/removal')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param('id') id: string, @CurrentUser() owner: SessionUser): Promise<void> {
    await this.twoFactor.cancel(id, owner.id);
  }
}

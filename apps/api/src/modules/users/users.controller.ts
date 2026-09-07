import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { fromNodeHeaders } from 'better-auth/node';

import { UserController } from 'core/controllers/User';

import { AUTH } from '../auth/auth.config.js';
import { CurrentUser } from '../../shared/decorators/index.js';

import type { Auth } from '../auth/auth.config.js';
import type { Request } from 'express';
import type { SessionUser } from '../../shared/decorators/index.js';
import type { UserView } from 'core/controllers/User';

/**
 * There is no `GET /users/:id`. Every route here is scoped to the caller's own
 * session, which removes the whole class of bug where an id from the URL is used
 * to scope a query.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  @ApiOperation({ summary: "The signed-in user's account" })
  @Get('me')
  async me(@CurrentUser() user: SessionUser): Promise<UserView> {
    return UserController.getUser({ id: user.id });
  }

  @ApiOperation({ summary: 'Permanently delete the account and every row that references it' })
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: Request): Promise<void> {
    // Delegated to Better Auth so the session and credential rows go with it;
    // the ON DELETE CASCADE from `user.id` takes the profile, plans, progress,
    // check-ins and conversations. See packages/database/src/schemas/_utils.ts.
    await this.auth.api.deleteUser({ body: {}, headers: fromNodeHeaders(request.headers) });
  }
}

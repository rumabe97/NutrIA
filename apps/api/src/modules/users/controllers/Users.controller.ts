import { Controller, Delete, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowUnverified, CurrentUser } from '../../../shared/index.js';
import { UsersService } from '../services/index.js';

import type { Request } from 'express';
import type { SessionUser } from '../../../shared/index.js';
import type { UserDto } from '../dto/out/index.js';

/**
 * There is no `GET /users/:id`. Every route here is scoped to the caller's own
 * session, which removes the whole class of bug where an id from the URL is used
 * to scope a query.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @AllowUnverified()
  @ApiOkResponse({ description: 'The account, with the state of both locks.' })
  @ApiOperation({ summary: "The signed-in user's account" })
  @Get('me')
  async me(@CurrentUser() user: SessionUser): Promise<UserDto> {
    return this.users.me(user.id);
  }

  @AllowUnverified()
  @ApiNoContentResponse({ description: 'Deleted, along with every row that references the account.' })
  @ApiOperation({ summary: 'Permanently delete the account and every row that references it' })
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: Request): Promise<void> {
    await this.users.remove(request.headers);
  }
}

import { All, Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';

import { AUTH } from './auth.config.js';
import { CurrentUser, Public } from '../../shared/decorators/index.js';

import type { Auth } from './auth.config.js';
import type { Request, Response } from 'express';
import type { SessionUser } from '../../shared/decorators/index.js';

/**
 * Mounts Better Auth's own handler under `/{API_PREFIX}/auth/*`.
 *
 * Everything under it — sign-up, sign-in, sign-out, verify-email,
 * forget-password, reset-password, delete-user — is Better Auth's, not ours.
 * The route is `@Public()` because these endpoints *establish* the session the
 * global guard checks for.
 *
 * The body must reach Better Auth unread: `main.ts` deliberately mounts
 * `express.json()` after this path, because a consumed stream arrives here empty.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(@Inject(AUTH) auth: Auth) {
    this.handler = toNodeHandler(auth);
  }

  @ApiExcludeEndpoint()
  @All('*splat')
  @Public()
  async handle(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.handler(request, response);
  }

  @ApiOperation({ summary: 'The signed-in user, or 404 when there is no session' })
  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }
}

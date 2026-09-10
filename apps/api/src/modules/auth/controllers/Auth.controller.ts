import { All, Controller, Get, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowUnverified, CurrentUser, Public } from '../../../shared/index.js';
import { AuthHandlerService } from '../services/index.js';

import type { Request, Response } from 'express';
import type { SessionUserDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * Mounts Better Auth's own handler under `/{API_PREFIX}/auth/*`.
 *
 * Everything under it — sign-up, sign-in, sign-out, verify-email,
 * forget-password, reset-password, delete-user — is Better Auth's, not ours.
 * The route is `@Public()` because these endpoints *establish* the session the
 * global guard checks for.
 *
 * The body must reach Better Auth unread: `CreateApp.ts` deliberately mounts
 * `express.json()` after this path, because a consumed stream arrives here empty.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthHandlerService) {}

  @ApiExcludeEndpoint()
  @All('*splat')
  @Public()
  async handle(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.auth.handle(request, response);
  }

  @ApiOkResponse({ description: 'The session user. 404 when there is no session, like every other denial.' })
  @ApiOperation({ summary: 'The signed-in user, or 404 when there is no session' })
  @AllowUnverified()
  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUserDto {
    return user;
  }
}

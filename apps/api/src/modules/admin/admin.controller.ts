import { Controller, Get, Inject, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminController } from 'core/controllers/Admin';
import { UserController } from 'core/controllers/User';

import { ENV } from '../../config/index.js';
import { Public, Roles } from '../../shared/decorators/index.js';
import { verifyActivationToken } from '../auth/ActivationLink.js';

import type { AdminJobView, AdminOverviewView } from 'core/controllers/Admin';
import type { WaitingView } from 'core/controllers/User';
import type { Env } from '../../config/index.js';
import type { Response } from 'express';

/**
 * The owner's own window on the service. `@Roles('admin')` on the class, so a
 * route added here is guarded by default rather than by remembering — and a
 * request from anyone else is a 404, like every other denial.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminRestController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @ApiOperation({ summary: 'Counts and the most recent generations' })
  @Get('overview')
  async overview(): Promise<AdminOverviewView> {
    return AdminController.overview();
  }

  @ApiOperation({ summary: 'Only the generations that failed' })
  @Get('failures')
  async failures(): Promise<readonly AdminJobView[]> {
    return AdminController.failures();
  }

  @ApiOperation({ summary: 'Accounts waiting to be opened, oldest first' })
  @Get('waiting')
  async waiting(): Promise<readonly WaitingView[]> {
    return UserController.waiting();
  }

  @ApiOperation({ summary: 'Open one account' })
  @Post('accounts/:id/activate')
  async activate(@Param('id') id: string): Promise<{ email: string }> {
    const opened = await UserController.activate({ id });

    if (!opened) {throw new NotFoundException();}

    return opened;
  }

  /**
   * The button in the owner's mail (`0030`).
   *
   * Public because it is clicked from an inbox, where there is no session — the
   * signed token is the authority, it names one account, it expires, and it can
   * do nothing else. A bad or stale token is a 404 like every other denial, so
   * the route tells a stranger nothing.
   *
   * It redirects to the admin screen rather than answering JSON: whoever
   * clicked is a person, and the useful next thing to see is the queue.
   */
  @ApiExcludeEndpoint()
  @Get('activate')
  @Public()
  async activateByLink(@Query('token') token: string | undefined, @Res() response: Response): Promise<void> {
    const userId = token ? verifyActivationToken(token, this.env.BETTER_AUTH_SECRET) : null;

    if (!userId) {throw new NotFoundException();}

    const opened = await UserController.activate({ id: userId });

    if (!opened) {throw new NotFoundException();}

    response.redirect(`${this.env.APP_URL}/admin?abierta=${encodeURIComponent(opened.email)}`);
  }
}

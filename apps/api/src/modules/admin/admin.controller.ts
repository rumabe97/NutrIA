import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';

import { adminSettingsSchema } from 'core/entities/Settings';
import { AdminController } from 'core/controllers/Admin';
import { SettingsController } from 'core/controllers/Settings';
import { UserController } from 'core/controllers/User';

import { ENV } from '../../config/index.js';
import { Public, Roles } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';
import { verifyActivationToken } from '../auth/ActivationLink.js';

import type { AdminAnalyticsView, AdminJobView, AdminOverviewView } from 'core/controllers/Admin';
import type { AccountView } from 'core/controllers/User';
import type { AdminSettings } from 'core/entities/Settings';
import type { Env } from '../../config/index.js';
import type { SettingsView } from 'core/controllers/Settings';
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

  @ApiOperation({ summary: 'Whether the product is working for the people using it' })
  @Get('analytics')
  async analytics(): Promise<AdminAnalyticsView> {
    return AdminController.analytics();
  }

  @ApiOperation({ summary: 'Only the generations that failed' })
  @Get('failures')
  async failures(): Promise<readonly AdminJobView[]> {
    return AdminController.failures();
  }

  @ApiOperation({ summary: 'The switches the owner can throw' })
  @Get('settings')
  async settings(): Promise<SettingsView> {
    return SettingsController.read();
  }

  @ApiOperation({ summary: 'Open or close registration' })
  @Patch('settings')
  async setSettings(@Body(new ZodValidationPipe(adminSettingsSchema)) body: AdminSettings): Promise<SettingsView> {
    return SettingsController.setAutomaticActivation(body.automaticActivation);
  }

  @ApiOperation({ summary: 'Every account with the state of its two locks, oldest first' })
  @Get('accounts')
  async accounts(): Promise<readonly AccountView[]> {
    return UserController.accounts();
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

import { Controller, Get, Inject, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { DEFAULT_WEB_LOCALE, webUrl } from 'core/domain/WebUrl';

import { AdminAccountsService } from '../services/index.js';
import { ENV } from '../../../config/index.js';
import { Public, Roles, ZodBody } from '../../../shared/index.js';
import { SetTierDto } from '../dto/in/index.js';

import type { AccountsDto, ActivatedAccountDto, TierChangedDto } from '../dto/out/index.js';
import type { Env } from '../../../config/index.js';
import type { Response } from 'express';

/**
 * Who is waiting, and the key that opens them (`0030`, `0031`).
 *
 * The account list is address, dates and role and nothing else. Keep it that
 * way: the questions worth a screen are "is generation working", "how big is
 * the catalogue" and "who is waiting".
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminAccountsController {
  constructor(
    private readonly accounts: AdminAccountsService,
    @Inject(ENV) private readonly env: Env
  ) {}

  @ApiOkResponse({ description: 'One page of accounts, newest first.' })
  @ApiOperation({ summary: 'One page of accounts with the state of their two locks, newest first' })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @Get('accounts')
  async list(@Query('offset') offset?: string, @Query('size') size?: string): Promise<AccountsDto> {
    return this.accounts.list(offset, size);
  }

  @ApiCreatedResponse({ description: 'The address of the account that was opened.' })
  @ApiOperation({ summary: 'Open one account' })
  @Post('accounts/:id/activate')
  async activate(@Param('id') id: string): Promise<ActivatedAccountDto> {
    return this.accounts.activate(id);
  }

  @ApiOkResponse({ description: 'The address whose tier moved, and where it moved to.' })
  @ApiOperation({ summary: 'Move one account between tiers' })
  @Patch('accounts/:id/tier')
  async setTier(@Param('id') id: string, @ZodBody(SetTierDto) body: SetTierDto): Promise<TierChangedDto> {
    return this.accounts.setTier(id, body);
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
    const opened = await this.accounts.activateByToken(token);

    // Whoever clicked is the owner, out of the owner's own mail, which is
    // Spanish (`AccountWaitingMail`) — not the account holder, whose language
    // has nothing to do with which admin screen the owner lands on.
    response.redirect(webUrl(this.env.APP_URL, `/admin?abierta=${encodeURIComponent(opened.email)}`, DEFAULT_WEB_LOCALE));
  }
}

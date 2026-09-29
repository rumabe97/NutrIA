import { Controller, Get, Inject, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { ACCOUNT_SORTS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PAGE_SIZES, SORT_DIRECTIONS, YES_NO } from 'core/entities/AdminQuery';
import { DEFAULT_WEB_LOCALE, webUrl } from 'core/domain/WebUrl';

import { AdminAccountsService } from '../services/index.js';
import { ENV } from '../../../config/index.js';
import { CurrentUser, Public, Roles, ZodBody } from '../../../shared/index.js';
import { AccountsQueryDto, SetTierDto } from '../dto/in/index.js';
import { ZodQuery } from './ZodQuery.js';

import type { AccountsDto, ActivatedAccountDto, TierChangedDto } from '../dto/out/index.js';
import type { Env } from '../../../config/index.js';
import type { Response } from 'express';
import type { SessionUser } from '../../../shared/index.js';

/**
 * Who is waiting, and the key that opens them (`0030`, `0031`).
 *
 * The account list is address, dates, role, tier and milestones — dates and
 * counts about the account (`0068`) — and nothing else. Keep it that way: the questions worth a screen are "is generation working", "how big is
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

  @ApiOkResponse({
    description:
      'One page of accounts with their two locks and milestones (onboardedAt, plans, lastActiveAt, professional), newest first unless sorted. `total` counts every match. 422 INVALID_INPUT for an unknown sort or filter value.'
  })
  @ApiOperation({ summary: 'Search, filter, sort and page the accounts (0068)' })
  @ApiQuery({ description: 'Address contains, case-insensitive.', name: 'q', required: false, type: String })
  @ApiQuery({ enum: YES_NO, name: 'confirmed', required: false })
  @ApiQuery({ enum: YES_NO, name: 'activated', required: false })
  @ApiQuery({ enum: YES_NO, name: 'professional', required: false })
  @ApiQuery({ enum: YES_NO, name: 'onboarded', required: false })
  @ApiQuery({ enum: ['free', 'premium'], name: 'tier', required: false })
  @ApiQuery({ enum: ['user', 'admin'], name: 'role', required: false })
  @ApiQuery({ enum: ACCOUNT_SORTS, name: 'sort', required: false })
  @ApiQuery({ enum: SORT_DIRECTIONS, name: 'dir', required: false })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({
    description: `1–${MAX_PAGE_SIZE}; the console offers ${PAGE_SIZES.join(', ')}. ${DEFAULT_PAGE_SIZE} when absent.`,
    name: 'size',
    required: false,
    type: Number
  })
  @Get('accounts')
  async list(@ZodQuery(AccountsQueryDto) query: AccountsQueryDto): Promise<AccountsDto> {
    return this.accounts.list(query);
  }

  @ApiCreatedResponse({ description: 'The address of the account that was opened.' })
  @ApiOperation({ summary: 'Open one account' })
  @Post('accounts/:id/activate')
  async activate(@Param('id') id: string, @CurrentUser() owner: SessionUser): Promise<ActivatedAccountDto> {
    return this.accounts.activate(id, owner.id);
  }

  @ApiOkResponse({ description: 'The address whose tier moved, and where it moved to.' })
  @ApiOperation({ summary: 'Move one account between tiers' })
  @Patch('accounts/:id/tier')
  async setTier(@Param('id') id: string, @ZodBody(SetTierDto) body: SetTierDto, @CurrentUser() owner: SessionUser): Promise<TierChangedDto> {
    return this.accounts.setTier(id, body, owner.id);
  }

  /**
   * The button in the owner's mail (`0030`).
   *
   * Kept only for mails already in the inbox, whose tokens stay valid until
   * they expire: no new mail issues one (the account-waiting mail links to the
   * console instead). Delete this route, and `ActivationLink`, once they have.
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

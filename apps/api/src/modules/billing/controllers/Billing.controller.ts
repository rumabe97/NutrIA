import { Controller, Get, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { BillingService } from '../services/index.js';
import { CurrentUser, Public, RateLimit, SkipRateLimit } from '../../../shared/index.js';

import type { BillingStatusDto, BillingUrlDto } from '../dto/out/index.js';
import type { Request } from 'express';
import type { SessionUser } from '../../../shared/index.js';

/**
 * Paying for premium (`0056`). Checkout and the portal are Stripe's own pages:
 * these routes only hand out their addresses, and no card detail ever passes
 * through this service. The webhook is how the tier changes.
 */
@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @ApiOkResponse({ description: 'Where Stripe’s checkout is, for this account.' })
  @ApiOperation({ summary: 'Start paying for premium' })
  @HttpCode(HttpStatus.OK)
  @Post('checkout')
  @RateLimit({ limit: 10, ttlSeconds: 3600 })
  async checkout(@CurrentUser() user: SessionUser): Promise<BillingUrlDto> {
    return this.billing.checkout(user);
  }

  @ApiOkResponse({ description: 'Where Stripe’s customer portal is, for this account.' })
  @ApiOperation({ summary: 'Change the card or cancel, on Stripe’s own page' })
  @HttpCode(HttpStatus.OK)
  @Post('portal')
  @RateLimit({ limit: 10, ttlSeconds: 3600 })
  async portal(@CurrentUser() user: SessionUser): Promise<BillingUrlDto> {
    return this.billing.portal(user);
  }

  @ApiOkResponse({ description: 'Whether premium can be bought here, its price, and this account’s subscription.' })
  @ApiOperation({ summary: 'What this account pays for' })
  @Get()
  async status(@CurrentUser() user: SessionUser): Promise<BillingStatusDto> {
    return this.billing.status(user);
  }

  /**
   * Stripe's call, not a person's: no session, and the signature over the raw
   * body is the whole authority. The body is left unparsed for this route in
   * `CreateApp`, and there is no DTO because the payload is Stripe's to shape
   * and its signature is what is checked.
   */
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  @Public()
  @SkipRateLimit()
  async webhook(@Req() request: Request, @Headers('stripe-signature') signature?: string): Promise<{ readonly received: true }> {
    await this.billing.webhook(request.body, signature);

    return { received: true };
  }
}

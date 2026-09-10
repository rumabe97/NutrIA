import { Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ZodBody } from '../../../shared/index.js';
import { LogWeightDto } from '../dto/in/index.js';
import { ProgressService } from '../services/index.js';

import type { ProgressSummaryDto, WeightDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * Weight, logged and read back.
 *
 * Not behind `@RequiresOnboarding()`: someone can weigh themselves before they
 * have a plan, and a gate here would refuse a fact about their own body for want
 * of a cooking preference.
 */
@ApiTags('progress')
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @ApiOkResponse({ description: 'The window, the latest figure, and the change across it.' })
  @ApiOperation({ summary: 'Recent weights, the latest, and the change across the window' })
  @Get('weight')
  async weight(@CurrentUser() user: SessionUser): Promise<WeightDto> {
    return this.progress.weight(user.id);
  }

  @ApiOkResponse({ description: 'Read-only. Nothing is collected for this that is not already stored.' })
  @ApiOperation({ summary: 'The weight line, and every fortnight lived with its meal marks and check-in' })
  @Get('summary')
  async summary(@CurrentUser() user: SessionUser): Promise<ProgressSummaryDto> {
    return this.progress.summary(user.id);
  }

  @ApiCreatedResponse({ description: 'The window as it now stands, with the new figure in it.' })
  @ApiOperation({ summary: "Log today's weight. Logging the same day twice replaces the earlier figure." })
  @Post('weight')
  async logWeight(@CurrentUser() user: SessionUser, @ZodBody(LogWeightDto) body: LogWeightDto): Promise<WeightDto> {
    return this.progress.logWeight(user.id, body);
  }
}

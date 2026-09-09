import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { logWeightSchema } from 'core/entities/Progress';
import { ProgressController } from 'core/controllers/Progress';

import { CurrentUser } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { LogWeight } from 'core/entities/Progress';
import type { SessionUser } from '../../shared/decorators/index.js';
import type { ProgressSummaryView, WeightView } from 'core/controllers/Progress';

/**
 * Weight, logged and read back.
 *
 * Not behind `@RequiresOnboarding()`: someone can weigh themselves before they
 * have a plan, and a gate here would refuse a fact about their own body for want
 * of a cooking preference.
 */
@ApiTags('progress')
@Controller('progress')
export class ProgressRestController {
  @ApiOperation({ summary: 'Recent weights, the latest, and the change across the window' })
  @Get('weight')
  async weight(@CurrentUser() user: SessionUser): Promise<WeightView> {
    return ProgressController.getWeight(user.id);
  }

  @ApiOperation({ summary: 'The weight line, and every fortnight lived with its meal marks and check-in' })
  @Get('summary')
  async summary(@CurrentUser() user: SessionUser): Promise<ProgressSummaryView> {
    return ProgressController.summary(user.id);
  }

  @ApiOperation({ summary: "Log today's weight. Logging the same day twice replaces the earlier figure." })
  @Post('weight')
  async logWeight(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(logWeightSchema)) body: LogWeight): Promise<WeightView> {
    return ProgressController.logWeight(user.id, body);
  }
}

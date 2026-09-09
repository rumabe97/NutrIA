import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { planVacationSchema } from 'core/entities/Vacation';
import { VacationController } from 'core/controllers/Vacation';

import { CurrentUser } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { PlanVacation } from 'core/entities/Vacation';
import type { SessionUser } from '../../shared/decorators/index.js';
import type { VacationView } from 'core/controllers/Vacation';

/**
 * Being away (`0032`). Every route is scoped to the caller's own session, and
 * the id in the URL is checked against it rather than trusted.
 *
 * Not behind `@RequiresOnboarding()`: booking a holiday before finishing a
 * profile is a perfectly ordinary order of events, and there is nothing to
 * pause yet if there is no plan.
 */
@ApiTags('vacations')
@Controller('vacations')
export class VacationsRestController {
  @ApiOperation({ summary: 'Trips that have not finished yet, soonest first' })
  @Get()
  async list(@CurrentUser() user: SessionUser): Promise<readonly VacationView[]> {
    return VacationController.list(user.id);
  }

  @ApiOperation({ summary: 'Pause the plan for a stretch of days. The days after it move with it.' })
  @Post()
  async plan(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(planVacationSchema)) body: PlanVacation): Promise<VacationView> {
    return VacationController.plan(user.id, body);
  }

  @ApiOperation({ summary: 'Cancel a trip, giving the plan back the days it has not spent' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await VacationController.cancel(user.id, id);
  }
}

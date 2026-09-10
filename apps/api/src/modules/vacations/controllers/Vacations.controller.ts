import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ZodBody } from '../../../shared/index.js';
import { PlanVacationDto } from '../dto/in/index.js';
import { VacationsService } from '../services/index.js';

import type { SessionUser } from '../../../shared/index.js';
import type { VacationDto } from '../dto/out/index.js';

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
export class VacationsController {
  constructor(private readonly vacations: VacationsService) {}

  @ApiOkResponse({ description: 'Trips that have not finished yet, soonest first.' })
  @ApiOperation({ summary: 'Trips that have not finished yet, soonest first' })
  @Get()
  async list(@CurrentUser() user: SessionUser): Promise<readonly VacationDto[]> {
    return this.vacations.list(user.id);
  }

  @ApiCreatedResponse({ description: 'The trip, and the days the plan moved by.' })
  @ApiOperation({ summary: 'Pause the plan for a stretch of days. The days after it move with it.' })
  @Post()
  async plan(@CurrentUser() user: SessionUser, @ZodBody(PlanVacationDto) body: PlanVacationDto): Promise<VacationDto> {
    return this.vacations.plan(user.id, body);
  }

  @ApiNoContentResponse({ description: 'Cancelled. Only the days not yet spent come back.' })
  @ApiOperation({ summary: 'Cancel a trip, giving the plan back the days it has not spent' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.vacations.cancel(user.id, id);
  }
}

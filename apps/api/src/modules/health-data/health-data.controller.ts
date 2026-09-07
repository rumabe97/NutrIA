import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { HealthController as HealthService } from 'core/controllers/Health';
import { setHealthDataSchema } from 'core/entities/Health';

import { CurrentUser } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';

import type { HealthView } from 'core/controllers/Health';
import type { SetHealthData } from 'core/entities/Health';
import type { SessionUser } from '../../shared/decorators/index.js';

/**
 * Conditions, medications and supplements.
 *
 * Separate from `/profile` because the data is categorically different: it is
 * held under an explicit, versioned consent, it can be withdrawn on its own
 * without touching the rest of the profile, and none of it is required to use
 * the product. A route of its own is what makes "delete just this" something
 * the user can actually do.
 */
@ApiTags('health')
@Controller('health-data')
export class HealthDataController {
  @ApiOperation({ summary: "The signed-in user's recorded conditions, medications and supplements" })
  @Get()
  async get(@CurrentUser() user: SessionUser): Promise<HealthView> {
    return HealthService.get(user.id);
  }

  @ApiOperation({ summary: 'Replace the whole health section. The body must carry the current consent version.' })
  @Put()
  async replace(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(setHealthDataSchema)) body: SetHealthData): Promise<HealthView> {
    // PUT, not PATCH: the client sends the complete set, so removing a
    // medication is expressible. A partial update could never delete one.
    return HealthService.replace(user.id, body);
  }

  @ApiOperation({ summary: 'Withdraw consent and delete every health record held for the user' })
  @Delete()
  async withdraw(@CurrentUser() user: SessionUser): Promise<HealthView> {
    return HealthService.withdraw(user.id);
  }
}

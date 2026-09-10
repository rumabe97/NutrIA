import { Controller, Delete, Get, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ZodBody } from '../../../shared/index.js';
import { HealthDataService } from '../services/index.js';
import { SetHealthDataDto } from '../dto/in/index.js';

import type { HealthDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

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
  constructor(private readonly health: HealthDataService) {}

  @ApiOkResponse({ description: 'What is held, and under which consent version.' })
  @ApiOperation({ summary: "The signed-in user's recorded conditions, medications and supplements" })
  @Get()
  async get(@CurrentUser() user: SessionUser): Promise<HealthDto> {
    return this.health.read(user.id);
  }

  @ApiOkResponse({ description: 'The section as it now stands.' })
  @ApiOperation({ summary: 'Replace the whole health section. The body must carry the current consent version.' })
  @Put()
  async replace(@CurrentUser() user: SessionUser, @ZodBody(SetHealthDataDto) body: SetHealthDataDto): Promise<HealthDto> {
    // PUT, not PATCH: the client sends the complete set, so removing a
    // medication is expressible. A partial update could never delete one.
    return this.health.replace(user.id, body);
  }

  @ApiOkResponse({ description: 'The empty section that is left, so the screen can show what was deleted.' })
  @ApiOperation({ summary: 'Withdraw consent and delete every health record held for the user' })
  @Delete()
  async withdraw(@CurrentUser() user: SessionUser): Promise<HealthDto> {
    return this.health.withdraw(user.id);
  }
}

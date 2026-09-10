import { Controller, Get } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { HealthService } from '../services/index.js';
import { Public, SkipRateLimit } from '../../../shared/index.js';

import type { HealthCheckResult } from '@nestjs/terminus';
import type { LivenessDto } from '../dto/out/index.js';

/**
 * Liveness and readiness are separate on purpose: an orchestrator restarts a
 * process that fails liveness, but only stops routing traffic to one that fails
 * readiness. Conflating them turns a brief database blip into a restart loop.
 *
 * The two dependency checks carry no `@ApiOkResponse` of ours: `@HealthCheck()`
 * documents its own result shape, and a description added over it would replace
 * a real schema with a sentence.
 */
@ApiTags('health')
@Controller('health')
@Public()
@SkipRateLimit()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @ApiOperation({ summary: 'Full check — dependencies included' })
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.full();
  }

  @ApiOkResponse({ description: 'Alive. Nothing else is claimed.' })
  @ApiOperation({ summary: 'Is the process alive? No dependencies are touched.' })
  @Get('liveness')
  liveness(): LivenessDto {
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Can this instance serve traffic? Checks the database.' })
  @Get('readiness')
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    return this.health.readiness();
  }
}

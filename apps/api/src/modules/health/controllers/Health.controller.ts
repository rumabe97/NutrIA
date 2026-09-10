import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DatabaseHealthIndicator } from '../../../database/database.health.js';
import { Public, SkipRateLimit } from '../../../shared/index.js';

import type { HealthCheckResult } from '@nestjs/terminus';
import type { LivenessDto } from '../dto/out/index.js';

const HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

/**
 * Liveness and readiness are separate on purpose: an orchestrator restarts a
 * process that fails liveness, but only stops routing traffic to one that fails
 * readiness. Conflating them turns a brief database blip into a restart loop.
 */
@ApiTags('health')
@Controller('health')
@Public()
@SkipRateLimit()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly memory: MemoryHealthIndicator
  ) {}

  @ApiOkResponse({ description: 'Every indicator, with the database among them.' })
  @ApiOperation({ summary: 'Full check — dependencies included' })
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.isHealthy('database'), () => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES)]);
  }

  @ApiOkResponse({ description: 'Alive. Nothing else is claimed.' })
  @ApiOperation({ summary: 'Is the process alive? No dependencies are touched.' })
  @Get('liveness')
  liveness(): LivenessDto {
    return { status: 'ok' };
  }

  @ApiOkResponse({ description: 'Ready to serve. 503 when the database is not reachable.' })
  @ApiOperation({ summary: 'Can this instance serve traffic? Checks the database.' })
  @Get('readiness')
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.isHealthy('database')]);
  }
}

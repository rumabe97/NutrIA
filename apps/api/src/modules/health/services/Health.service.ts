import { Injectable } from '@nestjs/common';
import { HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

import { DatabaseHealthIndicator } from '../../../database/database.health.js';

import type { HealthCheckResult } from '@nestjs/terminus';

const HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

/**
 * Which indicators each check runs.
 *
 * Liveness is not here at all, and that is the point: it must touch nothing, so
 * there is nothing to compose. The moment a dependency creeps into it, a brief
 * database blip becomes a restart loop.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly database: DatabaseHealthIndicator,
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator
  ) {}

  async full(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.isHealthy('database'), () => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES)]);
  }

  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.isHealthy('database')]);
  }
}

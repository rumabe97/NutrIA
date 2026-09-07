import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';

import { ping } from 'database';

import type { HealthIndicatorResult } from '@nestjs/terminus';

/**
 * Readiness depends on the database being reachable, so this runs a real query
 * rather than checking that a client object exists. `ping()` issues `SELECT 1`,
 * the cheapest statement that proves a connection can be checked out.
 */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await ping();

      return indicator.up();
    } catch {
      // The driver's message can contain the connection string, so the cause is
      // logged by the exception filter and never put in the response body.
      return indicator.down({ message: 'unreachable' });
    }
  }
}

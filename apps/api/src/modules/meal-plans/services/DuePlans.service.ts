import { Injectable, Logger } from '@nestjs/common';

import { PlanController } from 'core/controllers/Plan';

/**
 * The nightly activation of plans that waited for their day (project 015).
 * Called by `/cron/activate-plans` at 00:05 Madrid; every read of the active
 * plan does the same for its owner, so a night this misses strands nobody.
 * No AI, no mail, no switch.
 */
@Injectable()
export class DuePlansService {
  private readonly logger = new Logger(DuePlansService.name);

  async activate(): Promise<{ readonly activated: number; readonly failed: number }> {
    const run = await PlanController.activateAllDue();

    this.logger.log(`Plans activated on their day: ${run.activated}, failed: ${run.failed}`);

    return run;
  }
}

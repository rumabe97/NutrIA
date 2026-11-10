import { Injectable, Logger } from '@nestjs/common';

import { AssistantController } from 'core/controllers/Assistant';

import type { AssistantRetentionRun } from 'core/controllers/Assistant';

/**
 * What the assistant keeps, kept no longer (project 023 phase 7), run by
 * `/cron/sweep-verifications` after the authentication's retention:
 *
 * - every conversation nobody has continued for six months, with its turns —
 *   the owner's choice of 2026-11-10, which `/privacidad` states;
 * - every row of the message count older than sixty days, past any window the
 *   allowance reads (the `legal` agent's F3).
 *
 * By date alone, nobody's in particular. No AI, no mail, no switch — it runs
 * whether the assistant is on or off, so nothing outlives its period because the
 * switch was thrown back.
 */
@Injectable()
export class AssistantRetentionService {
  private readonly logger = new Logger(AssistantRetentionService.name);

  /** Throws on failure, so the cron run shows as failed; tomorrow's run deletes what today's did not. */
  async forget(): Promise<AssistantRetentionRun> {
    const run = await AssistantController.forget();

    this.logger.log(
      `Quiet assistant conversations deleted: ${run.assistantConversations}; old assistant usage rows deleted: ${run.assistantUsageRows}`
    );

    return run;
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { CheckInReminderService } from '../../notifications/index.js';
import { CronRunService } from '../services/index.js';
import { CronSecretGuard } from '../../../shared/guards/index.js';
import { ExpiredInvitationsService } from '../../care/services/ExpiredInvitations.service.js';
import { Public, SkipRateLimit } from '../../../shared/index.js';
import { RecipeRewriter } from '../../ai/index.js';

import type { ReminderRunDto, RewriteRunDto } from '../dto/out/index.js';

/**
 * What one sweep fetches: as many as three lanes can finish inside its time
 * (`RewriteLimits`) — nine cooked mains at about seventy seconds each, a few
 * more when the batch holds quicker dishes. What is not reached is left for
 * the next sweep, never started and cut.
 */
const REWRITES_PER_SWEEP = 12;

/**
 * The platform's cron calls these; nothing else may.
 *
 * Both sweeps live on one controller because they are one caller — the
 * scheduler — and `CronSecretGuard` is their whole authorisation, on the class
 * so a third sweep is guarded by default rather than by remembering.
 *
 * `@Public()` because the bearer is the authority and there is no session; the
 * guard turns everything else into a 404, like every other denial here.
 */
@ApiExcludeController()
@Controller('cron')
@Public()
@SkipRateLimit()
@UseGuards(CronSecretGuard)
export class CronController {
  constructor(
    private readonly invitations: ExpiredInvitationsService,
    private readonly reminders: CheckInReminderService,
    private readonly rewriter: RecipeRewriter,
    private readonly runs: CronRunService
  ) {}

  /**
   * Once a day: everyone whose fortnight closed and who has not been told — and,
   * first, every expired invitation deleted, the one daily sweep that is scheduled.
   */
  @Get('reminders')
  async checkInReminders(): Promise<ReminderRunDto> {
    await this.invitations.forget();

    const run = await this.reminders.sweep();

    // At the end, so the record says the run finished (`0071`).
    await this.runs.record('reminders', run);

    return run;
  }

  @Get('rewrite-steps')
  async rewriteSteps(): Promise<RewriteRunDto> {
    const run = await this.rewriter.rewriteOutdated(REWRITES_PER_SWEEP);

    // A sweep held back by the cap says so in its record, in the place of a count of skipped recipes.
    await this.runs.record('rewrite', 'heldBy' in run ? { pending: 0, rewritten: 0, skipped: 'cap', unreached: 0 } : run);

    return run;
  }
}

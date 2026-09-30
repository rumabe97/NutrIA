import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { CheckInReminderService } from '../../notifications/index.js';
import { CronRunService } from '../services/index.js';
import { CronSecretGuard } from '../../../shared/guards/index.js';
import { ExpiredInvitationsService } from '../../care/services/ExpiredInvitations.service.js';
import { OwnerAlertsService } from '../../owner-alerts/index.js';
import { Public, SkipRateLimit } from '../../../shared/index.js';
import { RecipeRewriter } from '../../ai/index.js';

import type { ReminderRunDto, RewriteRunDto } from '../dto/out/index.js';

/**
 * The most the reminders watch and the pictures' mail may take before a sweep starts. The sweep's own clock
 * starts after it and the function dies at 300 s: a mail server that hangs must not eat
 * the minute the sweep keeps for its writes and its record.
 */
const WATCH_BUDGET_MS = 10_000;

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
    private readonly alerts: OwnerAlertsService,
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
    // The owner's digest first, before the reminders switch is looked at: they are different things (`0071`).
    // It never throws, and the catch keeps it so: a broken digest must not cost the reminders their run.
    await this.alerts.digest().catch(() => undefined);
    await this.invitations.forget();
    // The pictures that failed inside an hour's claim, with nobody opening a dish since, go out here (project 009).
    // After the deletion, which holds a deadline promised to other people; this mail only informs the owner,
    // and a mail server that hangs does not hold the reminders past the budget.
    await Promise.race([
      this.alerts.pictureFailures().catch(() => undefined),
      new Promise<void>(resolve => setTimeout(resolve, WATCH_BUDGET_MS).unref())
    ]);

    const run = await this.reminders.sweep();

    // At the end, so the record says the run finished (`0071`).
    await this.runs.record('reminders', run);

    return run;
  }

  @Get('rewrite-steps')
  async rewriteSteps(): Promise<RewriteRunDto> {
    // First, so a sweep held by the cap, empty or failing still checks the other cron: the two watch each other.
    // Then the pictures that failed and were not mailed yet (project 009), inside the same budget.
    // Neither throws, and the catch keeps it so.
    await Promise.race([
      this.alerts
        .watchReminders()
        .then(() => this.alerts.pictureFailures())
        .catch(() => undefined),
      new Promise<void>(resolve => setTimeout(resolve, WATCH_BUDGET_MS).unref())
    ]);

    const run = await this.rewriter.rewriteOutdated(REWRITES_PER_SWEEP);

    // A sweep held back by the cap says so in its record, in the place of a count of skipped recipes.
    await this.runs.record('rewrite', 'heldBy' in run ? { pending: 0, rewritten: 0, skipped: 'cap', unreached: 0 } : run);
    // The sweep is the one spender nobody waits for: the cap's warning is checked when it ends (`0071`).
    // It never throws, and the catch keeps it so: the sweep's answer does not depend on the owner's mail.
    await this.alerts.checkSpend().catch(() => undefined);

    return run;
  }
}

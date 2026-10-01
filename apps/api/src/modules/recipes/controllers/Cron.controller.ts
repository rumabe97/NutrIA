import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { CheckInReminderService } from '../../notifications/index.js';
import { CronRunService } from '../services/index.js';
import { CronSecretGuard } from '../../../shared/guards/index.js';
import { ExpiredInvitationsService } from '../../care/services/ExpiredInvitations.service.js';
import { ExpiredVerificationsService } from '../../auth/services/ExpiredVerifications.service.js';
import { OwnerAlertsService } from '../../owner-alerts/index.js';
import { PictureCandidatesService, RecipeRewriter } from '../../ai/index.js';
import { Public, SkipRateLimit } from '../../../shared/index.js';

import type { ReminderRunDto, RewriteRunDto, VerificationSweepDto } from '../dto/out/index.js';

/**
 * The most the reminders watch and the pictures' mail may take before a sweep starts. The sweep's own clock
 * starts after it and the function dies at 300 s: a mail server that hangs must not eat
 * the minute the sweep keeps for its writes and its record.
 */
const WATCH_BUDGET_MS = 10_000;

/**
 * The most the cleanup of expired picture candidates may take before the sweep starts (`0072`).
 * Its own, apart from the watch's: a store that hangs costs the sweep these seconds and no more,
 * and the two together still leave the sweep its 240 of the function's 300.
 */
const CLEANUP_BUDGET_MS = 8_000;

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
 * Every sweep lives on one controller because they are one caller — the
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
    private readonly candidates: PictureCandidatesService,
    private readonly invitations: ExpiredInvitationsService,
    private readonly reminders: CheckInReminderService,
    private readonly rewriter: RecipeRewriter,
    private readonly runs: CronRunService,
    private readonly verifications: ExpiredVerificationsService
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

    // The rejected pictures nobody can look at any more (`0072`): their files deleted, then their pointers, which is
    // what lets their dishes be drawn again. Before the sweep and on its own budget; it never throws into it. A
    // cleanup that outlasts its budget goes on behind the sweep and is recorded as none: the next night counts the rest.
    const candidatesDeleted = await Promise.race([
      this.candidates
        .clean(CLEANUP_BUDGET_MS)
        .then(cleaned => cleaned.deleted)
        .catch(() => 0),
      new Promise<number>(resolve => setTimeout(() => resolve(0), CLEANUP_BUDGET_MS).unref())
    ]);

    const run = await this.rewriter.rewriteOutdated(REWRITES_PER_SWEEP);

    // A sweep held back by the cap says so in its record, in the place of a count of skipped recipes.
    await this.runs.record('rewrite', {
      ...('heldBy' in run ? { pending: 0, rewritten: 0, skipped: 'cap' as const, unreached: 0 } : run),
      candidatesDeleted
    });
    // The sweep is the one spender nobody waits for: the cap's warning is checked when it ends (`0071`).
    // It never throws, and the catch keeps it so: the sweep's answer does not depend on the owner's mail.
    await this.alerts.checkSpend().catch(() => undefined);

    return run;
  }

  /**
   * Once a day, five minutes after the reminders so the database is usually
   * awake: every expired verification row deleted (PLAN 011). Better Auth no
   * longer prunes them inside a reset, so a reset for an unknown address costs
   * the same round trips as one for a real one. Spends nothing and needs no switch.
   */
  @Get('sweep-verifications')
  async sweepVerifications(): Promise<VerificationSweepDto> {
    const run = { deleted: await this.verifications.forget() };

    // At the end, so the record says the run finished and the console's silent-cron watch sees it (`0071`).
    await this.runs.record('verifications', run);

    return run;
  }
}

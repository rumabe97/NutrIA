import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { CheckInReminderService } from '../../notifications/index.js';
import { CronSecretGuard } from '../../../shared/guards/index.js';
import { Public, SkipRateLimit } from '../../../shared/index.js';
import { RecipeIllustrator, RecipeRewriter } from '../../ai/index.js';

import type { IllustrationRunDto, ReminderRunDto, RewriteRunDto } from '../dto/out/index.js';

/** Six images a sweep: ten seconds each, a minute of work, well inside the function's ceiling. */
const IMAGES_PER_SWEEP = 6;

/** Text is faster and free-tier, so the library drains in a few sweeps rather than a day. */
const REWRITES_PER_SWEEP = 10;

/**
 * The platform's cron calls these; nothing else may.
 *
 * All three sweeps live on one controller because they are one caller — the
 * scheduler — and `CronSecretGuard` is their whole authorisation, on the class
 * so a fourth sweep is guarded by default rather than by remembering.
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
    private readonly illustrator: RecipeIllustrator,
    private readonly reminders: CheckInReminderService,
    private readonly rewriter: RecipeRewriter
  ) {}

  @Get('illustrate')
  async illustrate(): Promise<IllustrationRunDto> {
    return this.illustrator.illustrateMissing(IMAGES_PER_SWEEP);
  }

  /** Once a day: everyone whose fortnight closed and who has not been told. */
  @Get('reminders')
  async checkInReminders(): Promise<ReminderRunDto> {
    return this.reminders.sweep();
  }

  @Get('rewrite-steps')
  async rewriteSteps(): Promise<RewriteRunDto> {
    return this.rewriter.rewriteOutdated(REWRITES_PER_SWEEP);
  }
}
